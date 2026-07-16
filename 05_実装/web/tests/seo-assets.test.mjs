import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("homepage includes canonical and social sharing metadata", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  assert.match(html, /<title>Live Interpreter/);
  assert.match(
    html,
    /rel="canonical" href="https:\/\/live-interpreter\.shalomworks\.tech\/"/,
  );
  assert.match(
    html,
    /property="og:image"\s+content="https:\/\/live-interpreter\.shalomworks\.tech\/og-image\.png"/,
  );
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /"@type": "WebApplication"/);
});

test("crawler files point to the production site", async () => {
  const robots = await readFile(new URL("public/robots.txt", root), "utf8");
  const sitemap = await readFile(new URL("public/sitemap.xml", root), "utf8");
  assert.match(
    robots,
    /Sitemap: https:\/\/live-interpreter\.shalomworks\.tech\/sitemap\.xml/,
  );
  assert.match(
    sitemap,
    /<loc>https:\/\/live-interpreter\.shalomworks\.tech\/<\/loc>/,
  );
  assert.match(sitemap, /hreflang="en"/);
  assert.match(sitemap, /hreflang="zh-Hans"/);
});

test("Sonic Glass branding and account translations ship with the web app", async () => {
  const [app, entry, account] = await Promise.all([
    readFile(new URL("src/App.tsx", root), "utf8"),
    readFile(new URL("src/main.tsx", root), "utf8"),
    readFile(new URL("src/AccountTools.tsx", root), "utf8"),
  ]);
  assert.match(app, /className="sonic-logo"/);
  assert.match(app, /className="hero-caption-grid"/);
  assert.match(entry, /import "\.\/sonic\.css"/);
  for (const code of [
    "ja",
    "en",
    "zh-CN",
    "es",
    "pt",
    "fr",
    "de",
    "ru",
    "ko",
    "hi",
    "id",
    "vi",
    "it",
  ])
    assert.match(
      account,
      new RegExp(`(?:^|\\n)\\s*(?:"${code}"|${code}): \\{`),
    );
});

test("homepage demo is language-neutral and localized in every site language", async () => {
  const [app, demo, extra] = await Promise.all([
    readFile(new URL("src/App.tsx", root), "utf8"),
    readFile(new URL("src/UniversalDemo.tsx", root), "utf8"),
    readFile(new URL("src/site-copy-extra.ts", root), "utf8"),
  ]);
  assert.doesNotMatch(app, /live-demo\.mp4/);
  assert.match(app, /<UniversalDemo/);
  assert.match(demo, /\["あ", "A", "文", "한", "अ", "Ñ", "ع"\]/);
  assert.match(demo, /playSonicLogo/);
  for (const code of [
    "es",
    "pt",
    "fr",
    "de",
    "ru",
    "ko",
    "hi",
    "id",
    "vi",
    "it",
  ]) {
    assert.match(
      extra,
      new RegExp(`(?:^|\\n)\\s*${code}: \\{[\\s\\S]*?demoVisualLabel:`),
    );
  }
});
