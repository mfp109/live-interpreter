import crypto from "node:crypto";
import http from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { signGatewayRequest, verifyAccessToken } from "./token.mjs";

const config = {
  port: Number(process.env.PORT || 8787),
  openaiKey: process.env.OPENAI_API_KEY || "",
  sharedSecret: process.env.GATEWAY_SHARED_SECRET || "",
  apiBase: (process.env.WEB_API_BASE || "").replace(/\/$/, ""),
  allowedOrigin: process.env.ALLOWED_ORIGIN || "",
};

function configured() {
  return config.openaiKey && config.openaiKey !== "CHANGE_ME" && config.sharedSecret && config.sharedSecret !== "CHANGE_ME" && config.apiBase && config.allowedOrigin;
}

async function settle(sessionId, sequence, seconds, final = false) {
  const signed = signGatewayRequest({ session_id: sessionId, sequence, seconds, final }, config.sharedSecret);
  const response = await fetch(`${config.apiBase}/interpreter/settle.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Gateway-Timestamp": signed.timestamp, "X-Gateway-Signature": signed.signature },
    body: signed.body,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`settlement_${response.status}`);
  return response.json();
}

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(configured() ? 200 : 503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ ok: configured(), service: "live-interpreter-gateway" }));
    return;
  }
  response.writeHead(404).end();
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
server.on("upgrade", (request, socket, head) => {
  const origin = request.headers.origin || "";
  if (!configured() || request.url !== "/translate" || origin !== config.allowedOrigin) return socket.destroy();
  wss.handleUpgrade(request, socket, head, (client) => wss.emit("connection", client, request));
});

wss.on("connection", (client) => {
  let claims;
  let upstream;
  let startedAt = 0;
  let settledSeconds = 0;
  let sequence = 0;
  let settling = false;
  let closing = false;

  const closeBoth = (code = 1000, reason = "completed") => {
    if (closing) return;
    closing = true;
    if (upstream?.readyState === WebSocket.OPEN) upstream.send(JSON.stringify({ type: "session.close" }));
    setTimeout(() => {
      if (upstream?.readyState < WebSocket.CLOSING) upstream.close();
      if (client.readyState < WebSocket.CLOSING) client.close(code, reason);
    }, 1200).unref();
  };

  const charge = async (final = false) => {
    if (!claims || !startedAt || settling || closing && !final) return;
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const delta = Math.min(30, Math.max(0, elapsed - settledSeconds));
    if (delta === 0 && !final) return;
    settling = true;
    try {
      const result = await settle(claims.sid, ++sequence, delta, final);
      settledSeconds += result.consumed_seconds || 0;
      client.send(JSON.stringify({ type: "billing", remaining_seconds: result.remaining_seconds, consumed_seconds: result.consumed_seconds || 0 }));
      if (result.stop) closeBoth(4002, "balance_exhausted");
    } catch {
      closeBoth(1011, "billing_unavailable");
    } finally { settling = false; }
  };

  const billingTimer = setInterval(() => charge(false), 5000);
  billingTimer.unref();

  client.on("message", (raw) => {
    let event;
    try { event = JSON.parse(raw.toString()); } catch { return closeBoth(1003, "invalid_json"); }
    if (!claims) {
      if (event.type !== "authenticate") return closeBoth(1008, "authentication_required");
      try { claims = verifyAccessToken(event.access_token, config.sharedSecret); } catch { return closeBoth(1008, "invalid_token"); }
      const safetyId = crypto.createHash("sha256").update(claims.uid).digest("hex");
      upstream = new WebSocket("wss://api.openai.com/v1/realtime/translations?model=gpt-realtime-translate", {
        headers: { Authorization: `Bearer ${config.openaiKey}`, "OpenAI-Safety-Identifier": safetyId },
      });
      upstream.on("open", () => {
        upstream.send(JSON.stringify({ type: "session.update", session: { audio: { output: { language: claims.dst } } } }));
        client.send(JSON.stringify({ type: "ready", session_id: claims.sid }));
      });
      upstream.on("message", (message) => {
        let output;
        try { output = JSON.parse(message.toString()); } catch { return; }
        if (output.type === "session.output_audio.delta") client.send(JSON.stringify({ type: "audio", delta: output.delta }));
        if (output.type === "error") closeBoth(1011, "translation_error");
        if (output.type === "session.closed") closeBoth();
      });
      upstream.on("error", () => closeBoth(1011, "translation_unavailable"));
      upstream.on("close", () => { if (!closing) closeBoth(1011, "translation_closed"); });
      return;
    }
    if (event.type === "audio" && typeof event.audio === "string" && event.audio.length <= 180000 && upstream?.readyState === WebSocket.OPEN) {
      if (!startedAt) startedAt = Date.now();
      upstream.send(JSON.stringify({ type: "session.input_audio_buffer.append", audio: event.audio }));
    } else if (event.type === "stop") {
      charge(true).finally(() => closeBoth());
    }
  });

  client.on("close", () => {
    clearInterval(billingTimer);
    if (claims && startedAt && !closing) charge(true).catch(() => {});
    if (upstream?.readyState < WebSocket.CLOSING) upstream.close();
  });
  client.on("error", () => closeBoth(1011, "client_error"));
});

server.listen(config.port, "0.0.0.0", () => console.log(`gateway listening on ${config.port}`));
