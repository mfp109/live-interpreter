import crypto from "node:crypto";
import http from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { signGatewayRequest, verifyAccessToken } from "./token.mjs";
import {
  buildTranscriptionSession,
  mapTranscriptionEvent,
} from "./transcription.mjs";
import {
  buildSessionPlan,
  translationCaptionDelta,
} from "./session-plan.mjs";

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

async function settle(
  sessionId,
  sequence,
  seconds,
  creditsPerSecond,
  final = false,
) {
  const signed = signGatewayRequest(
    {
      session_id: sessionId,
      sequence,
      seconds,
      credits_per_second: creditsPerSecond,
      final,
    },
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
  let plan;
  let startedAt = 0;
  let activeStartedAt = 0;
  let activeElapsedMs = 0;
  let paused = false;
  let settledSeconds = 0;
  let sequence = 0;
  let chargeQueue = Promise.resolve();
  let closing = false;
  let sourceAudioPending = false;
  let sourceCommitTimer = null;
  const upstreams = new Map();
  const readyUpstreams = new Set();

  const closeAll = (code = 1000, reason = "completed") => {
    if (closing) return;
    closing = true;
    if (sourceCommitTimer) clearInterval(sourceCommitTimer);
    for (const upstream of upstreams.values()) {
      if (upstream.readyState === WebSocket.OPEN)
        upstream.send(JSON.stringify({ type: "session.close" }));
    }
    setTimeout(() => {
      for (const upstream of upstreams.values()) {
        if (upstream.readyState < WebSocket.CLOSING) upstream.close();
      }
      if (client.readyState < WebSocket.CLOSING) client.close(code, reason);
    }, 1200).unref();
  };

  const authTimer = setTimeout(
    () => closeAll(1008, "authentication_timeout"),
    10000,
  );
  authTimer.unref();

  const charge = (requestedFinal = false) => {
    chargeQueue = chargeQueue.then(async () => {
      if (!claims || !plan || !startedAt || (closing && !requestedFinal)) return;
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
        const result = await settle(
          claims.sid,
          ++sequence,
          delta,
          plan.rate,
          final,
        );
        settledSeconds += result.consumed_seconds || 0;
        if (client.readyState === WebSocket.OPEN)
          client.send(
            JSON.stringify({
              type: "billing",
              remaining_seconds: result.remaining_seconds,
              consumed_seconds: result.consumed_seconds || 0,
              credits_per_second: plan.rate,
            }),
          );
        if (result.stop) closeAll(4002, "balance_exhausted");
        else if (limitReached) closeAll(4000, "session_limit");
      } catch {
        closeAll(1011, "billing_unavailable");
      }
    });
    return chargeQueue;
  };

  const billingTimer = setInterval(() => charge(false), 5000);
  billingTimer.unref();

  const markReady = (key) => {
    readyUpstreams.add(key);
    if (
      plan &&
      readyUpstreams.size === upstreams.size &&
      client.readyState === WebSocket.OPEN
    ) {
      client.send(
        JSON.stringify({
          type: "ready",
          session_id: claims.sid,
          mode: plan.mode,
          credits_per_second: plan.rate,
          translation_sessions: plan.translationTargets.length,
          source_transcription: plan.transcribeSource,
        }),
      );
    }
  };

  const openTranslation = (language, safetyId) => {
    const key = `translation:${language}`;
    const upstream = new WebSocket(
      "wss://api.openai.com/v1/realtime/translations?model=gpt-realtime-translate",
      {
        headers: {
          Authorization: `Bearer ${config.openaiKey}`,
          "OpenAI-Safety-Identifier": safetyId,
        },
      },
    );
    upstreams.set(key, upstream);
    upstream.on("open", () => {
      upstream.send(
        JSON.stringify({
          type: "session.update",
          session: { audio: { output: { language } } },
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
      if (output.type === "session.updated") markReady(key);
      if (
        language === plan.audioTarget &&
        (output.type === "session.output_audio.delta" ||
          output.type === "response.output_audio.delta" ||
          output.type === "response.audio.delta") &&
        client.readyState === WebSocket.OPEN
      )
        client.send(JSON.stringify({ type: "audio", delta: output.delta }));
      const transcriptDelta = translationCaptionDelta(output);
      if (
        transcriptDelta &&
        plan.captions.includes(language) &&
        client.readyState === WebSocket.OPEN
      )
        client.send(
          JSON.stringify({
            type: "caption_delta",
            caption_key: language,
            item_id: `${language}:stream`,
            delta: transcriptDelta,
          }),
        );
      if (output.type === "error") {
        console.error("translation_upstream_error", output.error?.code || output.error?.type || "unknown");
        closeAll(1011, "translation_error");
      }
      if (output.type === "session.closed") closeAll();
    });
    upstream.on("error", (error) => {
      console.error("translation_upstream_unavailable", error.message);
      closeAll(1011, "translation_unavailable");
    });
    upstream.on("close", (code) => {
      if (!closing) console.error("translation_upstream_closed", code);
      if (!closing) closeAll(1011, "translation_closed");
    });
  };

  const openSourceTranscription = (safetyId) => {
    const key = "source";
    const upstream = new WebSocket(
      "wss://api.openai.com/v1/realtime?intent=transcription",
      {
        headers: {
          Authorization: `Bearer ${config.openaiKey}`,
          "OpenAI-Safety-Identifier": safetyId,
        },
      },
    );
    upstreams.set(key, upstream);
    upstream.on("open", () =>
      upstream.send(
        JSON.stringify({
          type: "session.update",
          session: buildTranscriptionSession(plan.source),
        }),
      ),
    );
    upstream.on("message", (message) => {
      let output;
      try {
        output = JSON.parse(message.toString());
      } catch {
        return;
      }
      if (output.type === "session.updated") {
        markReady(key);
        if (!sourceCommitTimer) {
          sourceCommitTimer = setInterval(() => {
            if (sourceAudioPending && upstream.readyState === WebSocket.OPEN) {
              upstream.send(
                JSON.stringify({ type: "input_audio_buffer.commit" }),
              );
              sourceAudioPending = false;
            }
          }, 3000);
          sourceCommitTimer.unref();
        }
      }
      const captionEvent = mapTranscriptionEvent(output);
      if (captionEvent && client.readyState === WebSocket.OPEN)
        client.send(
          JSON.stringify({ ...captionEvent, caption_key: "source" }),
        );
      if (output.type === "error") {
        console.error("transcription_upstream_error", output.error?.code || output.error?.type || "unknown");
        closeAll(1011, "transcription_error");
      }
      if (output.type === "session.closed") closeAll();
    });
    upstream.on("error", (error) => {
      console.error("transcription_upstream_unavailable", error.message);
      closeAll(1011, "transcription_unavailable");
    });
    upstream.on("close", (code) => {
      if (!closing) console.error("transcription_upstream_closed", code);
      if (!closing) closeAll(1011, "transcription_closed");
    });
  };

  client.on("message", (raw) => {
    let event;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return closeAll(1003, "invalid_json");
    }

    if (!claims) {
      if (event.type !== "authenticate")
        return closeAll(1008, "authentication_required");
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
        plan = buildSessionPlan(verified);
        claims = verified;
        consumedNonces.set(claims.nonce, claims.exp);
        activeSessions.add(claims.sid);
        setTimeout(
          () => consumedNonces.delete(claims.nonce),
          Math.max(1000, claims.exp * 1000 - Date.now() + 1000),
        ).unref();
        clearTimeout(authTimer);
      } catch {
        return closeAll(1008, "invalid_token");
      }

      const safetyId = crypto
        .createHash("sha256")
        .update(claims.uid)
        .digest("hex");
      for (const language of plan.translationTargets)
        openTranslation(language, safetyId);
      if (plan.transcribeSource) openSourceTranscription(safetyId);
      return;
    }

    if (
      event.type === "audio" &&
      typeof event.audio === "string" &&
      event.audio.length <= 180000 &&
      !paused
    ) {
      if (!startedAt) startedAt = Date.now();
      if (!activeStartedAt) activeStartedAt = Date.now();
      for (const [key, upstream] of upstreams) {
        if (upstream.readyState !== WebSocket.OPEN) continue;
        upstream.send(
          JSON.stringify(
            key === "source"
              ? { type: "input_audio_buffer.append", audio: event.audio }
              : { type: "session.input_audio_buffer.append", audio: event.audio },
          ),
        );
      }
      if (plan.transcribeSource) sourceAudioPending = true;
    } else if (event.type === "pause" && !paused) {
      if (activeStartedAt) activeElapsedMs += Date.now() - activeStartedAt;
      activeStartedAt = 0;
      paused = true;
      const source = upstreams.get("source");
      if (sourceAudioPending && source?.readyState === WebSocket.OPEN) {
        source.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        sourceAudioPending = false;
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
      const source = upstreams.get("source");
      if (sourceAudioPending && source?.readyState === WebSocket.OPEN) {
        source.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        sourceAudioPending = false;
      }
      charge(true).finally(() => closeAll());
    }
  });

  client.on("close", () => {
    clearTimeout(authTimer);
    clearInterval(billingTimer);
    if (sourceCommitTimer) clearInterval(sourceCommitTimer);
    connectionsByIp.set(ip, Math.max(0, (connectionsByIp.get(ip) || 1) - 1));
    if (connectionsByIp.get(ip) === 0) connectionsByIp.delete(ip);
    if (claims?.sid) activeSessions.delete(claims.sid);
    if (claims && startedAt) charge(true).catch(() => {});
    for (const upstream of upstreams.values()) {
      if (upstream.readyState < WebSocket.CLOSING) upstream.close();
    }
  });
  client.on("error", () => closeAll(1011, "client_error"));
});

server.listen(config.port, "0.0.0.0", () =>
  console.log(`gateway listening on ${config.port}`),
);
