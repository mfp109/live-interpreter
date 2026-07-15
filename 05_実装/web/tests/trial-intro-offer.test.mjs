import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("new email verification grants exactly one free minute", async () => {
  const php = await readFile(
    new URL("api/auth/verify-email.php", root),
    "utf8",
  );
  assert.match(php, /trial_grant',60/);
  assert.match(php, /'trial',\$record\['user_id'\],60,30/);
  assert.doesNotMatch(php, /trial_grant',900/);
});

test("introductory product is 30 minutes for 500 yen", async () => {
  const migration = await readFile(
    new URL("database/009_trial_and_intro_offer.sql", root),
    "utf8",
  );
  assert.match(migration, /'intro_30','product\.intro',1800,500,'JPY'/);
});

test("checkout enforces first-purchase eligibility on the server", async () => {
  const checkout = await readFile(
    new URL("api/checkout/create.php", root),
    "utf8",
  );
  const products = await readFile(
    new URL("api/lib/products.php", root),
    "utf8",
  );
  assert.match(checkout, /introductory_offer_available/);
  assert.match(checkout, /INTRO_OFFER_NOT_AVAILABLE/);
  assert.match(products, /status IN \('paid','refunded','disputed'\)/);
});
