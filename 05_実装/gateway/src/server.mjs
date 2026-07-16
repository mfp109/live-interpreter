import crypto from "node:crypto";
import http from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import {
  signGatewayRequest,
  verifyAccessToken,
  verifyGatewayRequest,
} from "./token.mjs";
import { generatePreparationBrief } from "./preparation.mjs";
import {
  buildTerminologyInstructions,
  shouldUseTerminologyMode,
} from "./terminology.mjs";
import {
  buildTranscriptionSession,
  isCaptionMode,
  mapTranscriptionEvent,
} from "./transcription.mjs";

const config = {
  port: Number(process.env.PORT || 8787),
  openaiKey: process.env.OPENAI_API_KEY || "",
  sharedSecret: process.env.GATEWAY_SHARED_SECRET || "",
  apiBase: (process.env.WEB_API_BASE || "").replace(/\/$/, ""),
  allowedOrigin: process.env.ALLOWED_ORIGIN || "",
};

function configured() {
  return Boolean(
    config.openaiKey &&
    config.openaiKey !== "CHANGE_ME" &&
    config.sharedSecret &&
    config.sharedSecret !== "CHANGE_ME" &&
    config.apiBase &&
    config.allowedOrigin,
  );
}

async function settle(sessionId, sequence, seconds, final = false) {
  const signed = signGatewayRequest(
    { session_id: sessionId, sequence, seconds, final },
    config.sharedSecret,
  );
  const response = await fetch(`${config.apiBase}/interpreter/settle.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gateway-Timestamp": signed.timestamp,
      "X-Gateway-Signature": signed.signature,
    },
    body: signed.body,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`settlement_${response.status}`);
  return response.json();
}

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(configured() ? 200 : 503, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(
      JSON.stringify({ ok: configured(), service: "live-interpreter-gateway" }),
    );
    return;
  }
  if (request.url === "/prepare" && request.method === "POST") {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > 64 * 1024) request.destroy();
    });
    request.on("end", async () => {
      try {
        verifyGatewayRequest(
          body,
          request.headers["x-gateway-timestamp"],
          request.headers["x-gateway-signature"],
          config.sharedSecret,
        );
        const input = JSON.parse(body);
        const length = [input.situation, input.purpose, input.key_terms]
          .map((value) => String(value || ""))
          .join("").length;
        const allowed = new Set([
          "ja",
          "en",
          "zh",
          "ko",
          "es",
          "fr",
          "de",
          "pt",
          "it",
          "ru",
          "ar",
          "hi",
          "th",
          "vi",
        ]);
        if (
          !configured() ||
          !input.user_id ||
          !allowed.has(input.source_language) ||
          !allowed.has(input.target_language) ||
          input.source_language === input.target_language ||
          !String(input.situation || "").trim() ||
          length > 2000
        ) {
          response.writeHead(400, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          });
          response.end(JSON.stringify({ ok: false, error: "invalid_request" }));
          return;
        }
        const brief = await generatePreparationBrief(input, config.openaiKey);
        response.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        response.end(JSON.stringify({ ok: true, brief }));
      } catch (error) {
        const authError = String(error?.message || "").startsWith("gateway_");
        response.writeHead(authError ? 401 : 503, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        response.end(
          JSON.stringify({
            ok: false,
            error: authError ? "unauthorized" : "generation_unavailable",
          }),
        );
      }
    });
    return;
  }
  response.writeHead(404).end();
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
const connectionsByIp = new Map();
const consumedNonces = new Map();
const activeSessions = new Set();
server.on("upgrade", (request, socket, head) => {
  const origin = request.headers.origin || "";
  if (
    !configured() ||
    request.url !== "/translate" ||
    origin !== config.allowedOrigin
  )
    return socket.destroy();
  const ip = request.socket.remoteAddress || "unknown";
  if (wss.clients.size >= 200 || (connectionsByIp.get(ip) || 0) >= 20)
    return socket.destroy();
  wss.handleUpgrade(request, socket, head, (client) =>
    wss.emit("connection", client, request),
  );
});

wss.on("connection", (client, request) => {
  const ip = request.socket.remoteAddress || "unknown";
  connectionsByIp.set(ip, (connectionsByIp.get(ip) || 0) + 1);
  let claims;
  let upstream;
  let startedAt = 0;
  let activeStartedAt = 0;
  let activeElapsedMs = 0;
  let paused = false;
  let settledSeconds = 0;
  let sequence = 0;
  let chargeQueue = Promise.resolve();
  let closing = false;
  let captionAudioPending = false;
  let captionCommitTimer = null;
  const authTimer = setTimeout(
    () => closeBoth(1008, "authentication_timeout"),
    10000,
  );
  authTimer.unref();

  const closeBoth = (code = 1000, reason = "completed") => {
    if (closing) return;
    closing = true;
    if (captionCommitTimer) clearInterval(captionCommitTimer);
    if (upstream?.readyState === WebSocket.OPEN)
      upstream.send(JSON.stringify({ type: "session.close" }));
    setTimeout(() => {
      if (upstream?.readyState < WebSocket.CLOSING) upstream.close();
      if (client.readyState < WebSocket.CLOSING) client.close(code, reason);
    }, 1200).unref();
  };

  const charge = (requestedFinal = false) => {
    chargeQueue = chargeQueue.then(async () => {
      if (!claims || !startedAt || (closing && !requestedFinal)) return;
      const elapsed = Math.floor(
        (activeElapsedMs +
          (activeStartedAt ? Date.now() - activeStartedAt : 0)) /
          1000,
      );
      const limitReached = elapsed >= 7200;
      const final = requestedFinal || limitReached;
      const delta = Math.min(30, Math.max(0, elapsed - settledSeconds));
      if (delta === 0 && !final) return;
      try {
        const result = await settle(claims.sid, ++sequence, delta, final);
        settledSeconds += result.consumed_seconds || 0;
        if (client.readyState === WebSocket.OPEN)
          client.send(
            JSON.stringify({
              type: "billing",
              remaining_seconds: result.remaining_seconds,
              consumed_seconds: result.consumed_seconds || 0,
            }),
          );
        if (result.stop) closeBoth(4002, "balance_exhausted");
        else if (limitReached) closeBoth(4000, "session_limit");
      } catch {
        closeBoth(1011, "billing_unavailable");
      }
    });
    return chargeQueue;
  };

  const billingTimer = setInterval(() => charge(false), 5000);
  billingTimer.unref();

  client.on("message", (raw) => {
    let event;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return closeBoth(1003, "invalid_json");
    }
    if (!claims) {
      if (event.type !== "authenticate")
        return closeBoth(1008, "authentication_required");
      try {
        const verified = verifyAccessToken(
          event.access_token,
          config.sharedSecret,
        );
        const nonceExpiry = consumedNonces.get(verified.nonce);
        if (
          !verified.nonce ||
          (nonceExpiry && nonceExpiry >= Math.floor(Date.now() / 1000)) ||
          activeSessions.has(verified.sid)
        )
          throw new Error("replayed_token");
        claims = verified;
        consumedNonces.set(claims.nonce, claims.exp);
        activeSessions.add(claims.sid);
        setTimeout(
          () => consumedNonces.delete(claims.nonce),
          Math.max(1000, claims.exp * 1000 - Date.now() + 1000),
        ).unref();
        clearTimeout(authTimer);
      } catch {
        return closeBoth(1008, "invalid_token");
      }
      const safetyId = crypto
        .createHash("sha256")
        .update(claims.uid)
        .digest("hex");
      const glossary = Array.isArray(claims.glossary) ? claims.glossary : [];
      const terminologyMode = shouldUseTerminologyMode(claims);
      const captionMode = isCaptionMode(claims);
      const upstreamUrl = captionMode
        ? "wss://api.openai.com/v1/realtime?model=gpt-realtime-whisper"
        : terminologyMode
          ? "wss://api.openai.com/v1/realtime?model=gpt-realtime"
          : "wss://api.openai.com/v1/realtime/translations?model=gpt-realtime-translate";
      upstream = new WebSocket(upstreamUrl, {
        headers: {
          Authorization: `Bearer ${config.openaiKey}`,
          "OpenAI-Safety-Identifier": safetyId,
        },
      });
      upstream.on("open", () => {
        const session = captionMode
          ? buildTranscriptionSession("ja")
          : terminologyMode
            ? {
                type: "realtime",
                instructions: buildTerminologyInstructions(
                  claims.src,
                  claims.dst,
                  glossary,
                ),
              }
            : { audio: { output: { language: claims.dst } } };
        upstream.send(JSON.stringify({ type: "session.update", session }));
        if (!terminologyMode && !captionMode)
          client.send(
            JSON.stringify({
              type: "ready",
              session_id: claims.sid,
              terminology_mode: false,
              mode: "interpretation",
            }),
          );
      });
      upstream.on("message", (message) => {
        let output;
        try {
          output = JSON.parse(message.toString());
        } catch {
          return;
        }
        if (terminologyMode && output.type === "session.updated")
          client.send(
            JSON.stringify({
              type: "ready",
              session_id: claims.sid,
              terminology_mode: true,
            }),
          );
        if (captionMode && output.type === "session.updated") {
          client.send(
            JSON.stringify({
              type: "ready",
              session_id: claims.sid,
              terminology_mode: false,
              mode: "caption",
            }),
          );
          captionCommitTimer = setInterval(() => {
            if (
              captionAudioPending &&
              upstream?.readyState === WebSocket.OPEN
            ) {
              upstream.send(
                JSON.stringify({ type: "input_audio_buffer.commit" }),
              );
              captionAudioPending = false;
            }
          }, 3000);
          captionCommitTimer.unref();
        }
        const captionEvent = captionMode ? mapTranscriptionEvent(output) : null;
        if (captionEvent && client.readyState === WebSocket.OPEN)
          client.send(JSON.stringify(captionEvent));
        if (
          output.type === "session.output_audio.delta" ||
          output.type === "response.output_audio.delta" ||
          output.type === "response.audio.delta"
        )
          client.send(JSON.stringify({ type: "audio", delta: output.delta }));
        if (output.type === "error") closeBoth(1011, "translation_error");
        if (output.type === "session.closed") closeBoth();
      });
      upstream.on("error", () => closeBoth(1011, "translation_unavailable"));
      upstream.on("close", () => {
        if (!closing) closeBoth(1011, "translation_closed");
      });
      return;
    }
    if (
      event.type === "audio" &&
      typeof event.audio === "string" &&
      event.audio.length <= 180000 &&
      upstream?.readyState === WebSocket.OPEN &&
      !paused
    ) {
      if (!startedAt) startedAt = Date.now();
      if (!activeStartedAt) activeStartedAt = Date.now();
      const terminologyMode = shouldUseTerminologyMode(claims);
      const captionMode = isCaptionMode(claims);
      upstream.send(
        JSON.stringify(
          terminologyMode || captionMode
            ? { type: "input_audio_buffer.append", audio: event.audio }
            : { type: "session.input_audio_buffer.append", audio: event.audio },
        ),
      );
      if (captionMode) captionAudioPending = true;
    } else if (event.type === "pause" && !paused) {
      if (activeStartedAt) activeElapsedMs += Date.now() - activeStartedAt;
      activeStartedAt = 0;
      paused = true;
      if (
        isCaptionMode(claims) &&
        captionAudioPending &&
        upstream?.readyState === WebSocket.OPEN
      ) {
        upstream.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        captionAudioPending = false;
      }
      charge(false).finally(() => {
        if (client.readyState === WebSocket.OPEN)
          client.send(JSON.stringify({ type: "paused" }));
      });
    } else if (event.type === "resume" && paused) {
      activeStartedAt = 0;
      paused = false;
      if (client.readyState === WebSocket.OPEN)
        client.send(JSON.stringify({ type: "resumed" }));
    } else if (event.type === "stop") {
      if (
        isCaptionMode(claims) &&
        captionAudioPending &&
        upstream?.readyState === WebSocket.OPEN
      ) {
        upstream.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        captionAudioPending = false;
      }
      charge(true).finally(() => closeBoth());
    }
  });

  client.on("close", () => {
    clearTimeout(authTimer);
    clearInterval(billingTimer);
    if (captionCommitTimer) clearInterval(captionCommitTimer);
    connectionsByIp.set(ip, Math.max(0, (connectionsByIp.get(ip) || 1) - 1));
    if (connectionsByIp.get(ip) === 0) connectionsByIp.delete(ip);
    if (claims?.sid) activeSessions.delete(claims.sid);
    if (claims && startedAt) charge(true).catch(() => {});
    if (upstream?.readyState < WebSocket.CLOSING) upstream.close();
  });
  client.on("error", () => closeBoth(1011, "client_error"));
});

server.listen(config.port, "0.0.0.0", () =>
  console.log(`gateway listening on ${config.port}`),
);
