import { packager } from "@electron/packager";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeBinary = path.join(root, "native", "bin", "process-audio-tap");
mkdirSync(path.dirname(nativeBinary), { recursive: true });
const compileResult = spawnSync(
  "xcrun",
  [
    "clang",
    "-fobjc-arc",
    "-fblocks",
    "-framework",
    "Foundation",
    "-framework",
    "AppKit",
    "-framework",
    "CoreAudio",
    path.join(root, "native", "process_audio_tap.m"),
    "-o",
    nativeBinary,
  ],
  { stdio: "inherit" },
);
if (compileResult.status !== 0)
  throw new Error("アプリ別音声取得ヘルパーのビルドに失敗しました。");

const appPaths = await packager({
  dir: root,
  name: "Live Interpreter",
  appBundleId: "tech.shalomworks.live-interpreter",
  platform: "darwin",
  arch: process.arch === "arm64" ? "arm64" : "x64",
  out: path.join(root, "dist"),
  overwrite: true,
  asar: true,
  icon: path.join(root, "assets", "live-interpreter.icns"),
  prune: true,
  extraResource: [nativeBinary],
  extendInfo: {
    CFBundleDisplayName: "Live Interpreter",
    NSAudioCaptureUsageDescription:
      "会議や動画の音声をリアルタイム通訳するために使用します。",
    NSScreenCaptureUsageDescription:
      "選択した会議アプリや画面の音声をリアルタイム通訳するために使用します。",
    NSMicrophoneUsageDescription:
      "マイク音声をリアルタイム通訳するために使用します。",
  },
});

for (const appPath of appPaths) {
  const appBundle = path.join(appPath, "Live Interpreter.app");
  const signResult = spawnSync(
    "codesign",
    ["--force", "--deep", "--sign", "-", appBundle],
    { stdio: "inherit" },
  );
  if (signResult.status !== 0)
    throw new Error("Macアプリのアドホック署名に失敗しました。");
  process.stdout.write(`${appBundle}\n`);
}
