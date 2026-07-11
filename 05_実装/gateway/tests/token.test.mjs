import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { signGatewayRequest, verifyAccessToken } from "../src/token.mjs";

const b64 = (value) => Buffer.from(value).toString("base64url");
function token(claims, secret) { const payload=b64(JSON.stringify(claims)); return `${payload}.${crypto.createHmac("sha256",secret).update(payload).digest("base64url")}`; }

test("accepts a signed unexpired access token",()=>{
  const claims={sid:"s",uid:"u",dst:"en",nonce:"n",exp:2000};
  assert.deepEqual(verifyAccessToken(token(claims,"secret"),"secret",1000),claims);
});
test("rejects tampering and expiration",()=>{
  const value=token({sid:"s",uid:"u",dst:"en",nonce:"n",exp:900},"secret");
  assert.throws(()=>verifyAccessToken(value,"secret",1000));
  assert.throws(()=>verifyAccessToken(value+"x","secret",800));
});
test("signs settlement body reproducibly",()=>{
  const signed=signGatewayRequest({session_id:"s",seconds:10},"secret",1000);
  assert.equal(signed.signature,crypto.createHmac("sha256","secret").update(`1000.${signed.body}`).digest("hex"));
});
