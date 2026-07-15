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
