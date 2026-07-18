import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pages = [
  "index.html",
  "about.html",
  "contact.html",
  "privacy.html",
  "guides/live-interpretation.html",
  "guides/multilingual-events.html",
  "guides/privacy-and-ai.html",
];

test("every public page has useful metadata and navigation", async () => {
  for (const page of pages) {
    const html = await readFile(resolve(root, page), "utf8");
    assert.match(html, /<html lang="ja">/);
    assert.match(html, /name="description" content="[^"]{30,}"/);
    assert.match(html, /name="google-adsense-account" content="ca-pub-2159596424880595"/);
    assert.match(html, /rel="canonical" href="https:\/\/shalomworks\.tech\//);
    assert.match(html, /href="\/"/);
    assert.doesNotMatch(html, /href="#"/);
  }
});

test("guide pages contain substantial original information", async () => {
  for (const page of pages.filter((value) => value.startsWith("guides/"))) {
    const html = await readFile(resolve(root, page), "utf8");
    const text = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, "");
    assert.ok(text.length > 1700, `${page} is too short: ${text.length}`);
    assert.match(html, /<h2>/);
    assert.match(html, /最終|Reviewed|2026-07-18/);
  }
});

test("all root-relative local links resolve to files", async () => {
  for (const page of pages) {
    const html = await readFile(resolve(root, page), "utf8");
    for (const match of html.matchAll(/(?:href|src)="(\/[^"?#]+)"/g)) {
      const path = match[1] === "/" ? "/index.html" : match[1];
      assert.ok(existsSync(resolve(root, `.${path}`)), `${page} links to missing ${path}`);
    }
  }
});

test("crawler, AdSense, and security files are present", async () => {
  const [robots, sitemap, ads, access, assets] = await Promise.all([
    readFile(resolve(root, "robots.txt"), "utf8"),
    readFile(resolve(root, "sitemap.xml"), "utf8"),
    readFile(resolve(root, "ads.txt"), "utf8"),
    readFile(resolve(root, ".htaccess"), "utf8"),
    readdir(resolve(root, "assets")),
  ]);
  assert.match(robots, /Sitemap: https:\/\/shalomworks\.tech\/sitemap\.xml/);
  for (const page of pages) {
    const url = page === "index.html" ? "https://shalomworks.tech/" : `https://shalomworks.tech/${page}`;
    assert.match(sitemap, new RegExp(url.replaceAll(".", "\\.")));
  }
  assert.match(ads, /^google\.com, pub-2159596424880595, DIRECT, f08c47fec0942fa0/m);
  assert.match(access, /Content-Security-Policy/);
  assert.deepEqual(assets.sort(), ["site.css", "site.js"]);
});
