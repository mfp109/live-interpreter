import crypto from "node:crypto";

const decode = (value) => Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export function verifyAccessToken(token, secret, now = Math.floor(Date.now() / 1000)) {
  if (!secret || secret === "CHANGE_ME") throw new Error("gateway_not_configured");
  const [payloadText, signatureText, extra] = String(token || "").split(".");
  if (!payloadText || !signatureText || extra) throw new Error("token_invalid");
  const expected = crypto.createHmac("sha256", secret).update(payloadText).digest();
  const supplied = decode(signatureText);
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) throw new Error("token_invalid");
  const claims = JSON.parse(decode(payloadText).toString("utf8"));
  if (!claims.sid || !claims.uid || !claims.dst || !claims.nonce || !claims.exp || claims.exp < now) throw new Error("token_expired");
  return claims;
}

export function signGatewayRequest(payload, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return { body, timestamp: String(timestamp), signature };
}

export function verifyGatewayRequest(body, timestamp, signature, secret, now = Math.floor(Date.now() / 1000)) {
  if (!secret || secret === "CHANGE_ME" || !/^\d+$/.test(String(timestamp || "")) || Math.abs(now - Number(timestamp)) > 60) {
    throw new Error("gateway_request_expired");
  }
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest();
  const supplied = Buffer.from(String(signature || ""), "hex");
  if (!/^[a-f0-9]{64}$/.test(String(signature || "")) || expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
    throw new Error("gateway_signature_invalid");
  }
}
