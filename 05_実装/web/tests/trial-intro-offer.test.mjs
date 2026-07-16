import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("new email verification grants 720 LI credits", async () => {
  const php = await readFile(
    new URL("api/auth/verify-email.php", root),
    "utf8",
  );
  assert.match(php, /trial_grant',720/);
  assert.match(php, /'trial',\$record\['user_id'\],720,30/);
  assert.doesNotMatch(php, /trial_grant',900/);
});

test("introductory product is 30 minutes for 500 yen", async () => {
  const migration = await readFile(
    new URL("database/009_trial_and_intro_offer.sql", root),
    "utf8",
  );
  assert.match(migration, /'intro_30','product\.intro',1800,500,'JPY'/);
});

test("subscription migration defines monthly plans and top-up credit packs", async () => {
  const migration = await readFile(
    new URL("database/010_subscription_credits.sql", root),
    "utf8",
  );
  assert.match(migration, /'subscription_lite'.*43200,980,'JPY'/);
  assert.match(migration, /'subscription_standard'.*108000,1980,'JPY'/);
  assert.match(migration, /'subscription_pro'.*259200,3980,'JPY'/);
  assert.match(migration, /'topup_small'.*18000,500,'JPY'/);
  assert.match(migration, /UPDATE wallets SET trial_seconds=trial_seconds\*12/);
});

test("voice interpretation consumes 12 LI credits per second", async () => {
  const settlement = await readFile(
    new URL("api/interpreter/settle.php", root),
    "utf8",
  );
  assert.match(settlement, /\$creditsPerSecond = 12/);
  assert.match(settlement, /\$requestedCredits=\$seconds\*\$creditsPerSecond/);
});

test("subscription checkout and renewal grant monthly credits", async () => {
  const checkout = await readFile(
    new URL("api/checkout/create.php", root),
    "utf8",
  );
  const webhook = await readFile(
    new URL("api/stripe/webhook.php", root),
    "utf8",
  );
  assert.match(checkout, /'mode' => \$isSubscription \? 'subscription' : 'payment'/);
  assert.match(checkout, /SUBSCRIPTION_REQUIRED/);
  assert.match(webhook, /invoice\.paid/);
  assert.match(webhook, /subscription_grant/);
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
