import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, Menu, safeStorage, session } from "electron";
import { promises as fs } from "node:fs";
import { execFile, spawn } from "node:child_process";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractClientSecret, isAllowedLanguage, OUTPUT_LANGUAGES, parseMacApplicationProcesses } from "../shared/core.mjs";
import { builtinUiTranslations, UI_STRINGS_JA } from "../shared/ui-i18n.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rendererDirectory = path.join(__dirname, "..", "renderer");
app.setName("Live Interpreter");
let mainWindow;
let captionsWindow;
let settingsWindow;
let latestCaptionPayload = { lines: [], transparent: false };
let processAudioChild;
let apiKeyCache;

function processAudioHelperPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "process-audio-tap")
    : path.join(__dirname, "..", "native", "bin", "process-audio-tap");
}

function stopProcessAudioHelper() {
  if (!processAudioChild) return;
  processAudioChild.kill("SIGTERM");
  processAudioChild = undefined;
}

function listPsApplications() {
  return new Promise((resolve, reject) => {
    execFile("/bin/ps", ["-axww", "-o", "pid=,command="], { timeout: 5000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
      if (error) return reject(new Error("アプリ音声一覧を取得できませんでした。"));
      resolve(parseMacApplicationProcesses(stdout));
    });
  });
}

function listNativeApplications() {
  return new Promise((resolve, reject) => {
    execFile(processAudioHelperPath(), ["list"], { timeout: 4000, maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error) return reject(error);
      try {
        const payload = JSON.parse(stdout.trim());
        resolve(Array.isArray(payload) ? payload : []);
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
}

async function listRunningApplications() {
  const results = await Promise.allSettled([listPsApplications(), listNativeApplications()]);
  const availableLists = results.filter(({ status }) => status === "fulfilled").map(({ value }) => value);
  if (!availableLists.length) throw new Error("アプリ音声一覧を取得できませんでした。");
  const unique = new Map();
  for (const item of availableLists.flat()) {
    const pid = Number(item?.pid);
    const name = String(item?.name || "").trim();
    if (!pid || !name || ["Live Interpreter", "Live Interpreter Mixer"].includes(name)) continue;
    if (!unique.has(pid)) unique.set(pid, { pid, name, appPath: item.appPath || "", bundleID: item.bundleID || "" });
  }
  return [...unique.values()].sort((left, right) => left.name.localeCompare(right.name, "ja"));
}

function startProcessAudioHelper(pid) {
  stopProcessAudioHelper();
  return new Promise((resolve, reject) => {
    const child = spawn(processAudioHelperPath(), ["tap", String(pid)], { stdio: ["ignore", "pipe", "pipe"] });
    processAudioChild = child;
    let output = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("アプリ音声の準備がタイムアウトしました。"));
    }, 12000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const newline = output.indexOf("\n");
      if (newline < 0) return;
      clearTimeout(timeout);
      try {
        const payload = JSON.parse(output.slice(0, newline));
        if (payload.error) throw new Error(payload.error);
        resolve(payload);
      } catch (error) {
        child.kill("SIGTERM");
        reject(error);
      }
    });
    child.once("error", (error) => { clearTimeout(timeout); reject(new Error(`アプリ音声ヘルパーを起動できません: ${error.message}`)); });
    child.once("exit", () => { if (processAudioChild === child) processAudioChild = undefined; });
  });
}

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function apiKeyEncryptionPath() {
  return path.join(app.getPath("userData"), "api-key-encryption.bin");
}

async function apiKeyEncryptionKey() {
  try {
    const key = await fs.readFile(apiKeyEncryptionPath());
    if (key.length === 32) return key;
  } catch { /* create a private local key below */ }
  const key = randomBytes(32);
  await fs.mkdir(path.dirname(apiKeyEncryptionPath()), { recursive: true });
  await fs.writeFile(apiKeyEncryptionPath(), key, { mode: 0o600 });
  return key;
}

async function encryptApiKey(apiKey) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", await apiKeyEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") };
}

async function decryptApiKey(payload) {
  const decipher = createDecipheriv("aes-256-gcm", await apiKeyEncryptionKey(), Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]).toString("utf8");
}

async function readSettings() {
  try {
    return JSON.parse(await fs.readFile(settingsPath(), "utf8"));
  } catch {
    const legacyPath = path.join(app.getPath("appData"), "asaph-live-interpreter-mac", "settings.json");
    try { return JSON.parse(await fs.readFile(legacyPath, "utf8")); } catch { return {}; }
  }
}

async function writeSettings(settings) {
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
}

async function storedApiKey() {
  if (apiKeyCache?.startsWith("sk-")) return apiKeyCache;
  const settings = await readSettings();
  if (settings.localEncryptedApiKey) {
    try {
      const key = await decryptApiKey(settings.localEncryptedApiKey);
      if (key.startsWith("sk-")) {
        apiKeyCache = key;
        return key;
      }
    } catch { /* try the legacy store below */ }
  }
  if (safeStorage.isEncryptionAvailable()) {
    if (settings.encryptedApiKey) {
      try {
        const key = safeStorage.decryptString(Buffer.from(settings.encryptedApiKey, "base64"));
        if (key.startsWith("sk-")) {
          apiKeyCache = key;
          settings.localEncryptedApiKey = await encryptApiKey(key);
          delete settings.encryptedApiKey;
          await writeSettings(settings);
          return key;
        }
      } catch { /* fall back to the environment */ }
    }
  }
  apiKeyCache = process.env.OPENAI_API_KEY?.startsWith("sk-") ? process.env.OPENAI_API_KEY : "";
  return apiKeyCache;
}

async function currentUiLocale() {
  const settings = await readSettings();
  const code = isAllowedLanguage(settings.uiLanguage) ? settings.uiLanguage : "ja";
  const translations = builtinUiTranslations(code) || UI_STRINGS_JA;
  return { code, translations };
}

function applyWindowTitles(translations) {
  mainWindow?.setTitle(translations.appTitle);
  settingsWindow?.setTitle(`${translations.settings}｜Live Interpreter`);
  captionsWindow?.setTitle(translations.sharedCaptions);
}

function trustedSender(event) {
  return event.senderFrame?.url?.startsWith("file:") === true;
}

function windowOptions(width, height) {
  return {
    width,
    height,
    minWidth: 760,
    minHeight: 520,
    backgroundColor: "#08111f",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  };
}

function createMainWindow() {
  mainWindow = new BrowserWindow(windowOptions(1180, 820));
  mainWindow.loadFile(path.join(rendererDirectory, "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file:")) event.preventDefault();
  });
  mainWindow.webContents.on("did-finish-load", async () => applyWindowTitles((await currentUiLocale()).translations));
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    ...windowOptions(560, 620),
    title: "設定｜Live Interpreter",
    minWidth: 480,
    minHeight: 320,
    maxWidth: 760,
    maxHeight: 760,
    resizable: true,
    minimizable: false,
    fullscreenable: false,
  });
  settingsWindow.loadFile(path.join(rendererDirectory, "settings.html"));
  settingsWindow.webContents.on("did-finish-load", async () => applyWindowTitles((await currentUiLocale()).translations));
  settingsWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      settingsWindow.hide();
    }
  });
}

function openSettingsWindow() {
  if (!settingsWindow || settingsWindow.isDestroyed()) createSettingsWindow();
  settingsWindow.show();
  settingsWindow.focus();
}

function configureApplicationMenu(translations = UI_STRINGS_JA) {
  const template = [
    {
      label: "Live Interpreter",
      submenu: [
        { role: "about", label: translations.menuAbout },
        { type: "separator" },
        { label: translations.menuSettings, accelerator: "CommandOrControl+,", click: openSettingsWindow },
        { type: "separator" },
        { role: "services", label: translations.menuServices },
        { type: "separator" },
        { role: "hide", label: translations.menuHide },
        { role: "hideOthers", label: translations.menuHideOthers },
        { role: "unhide", label: translations.menuShowAll },
        { type: "separator" },
        { role: "quit", label: translations.menuQuit },
      ],
    },
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createCaptionsWindow() {
  captionsWindow = new BrowserWindow({
    ...windowOptions(1000, 620),
    title: "共有用字幕｜Live Interpreter",
    minWidth: 560,
    minHeight: 260,
    transparent: false,
    backgroundColor: "#05070b",
    hasShadow: true,
    frame: true,
    titleBarStyle: "hiddenInset",
    movable: true,
    resizable: true,
    minimizable: true,
    fullscreenable: false,
    skipTaskbar: false,
  });
  captionsWindow.setContentProtection(false);
  if (process.platform === "darwin") {
    captionsWindow.setHiddenInMissionControl(false);
    captionsWindow.setWindowButtonVisibility(false);
  }
  captionsWindow.loadFile(path.join(rendererDirectory, "captions.html"));
  captionsWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      captionsWindow.hide();
    }
  });
  captionsWindow.webContents.on("did-finish-load", () => {
    captionsWindow.setOpacity(latestCaptionPayload.transparent ? 0.72 : 1);
    captionsWindow.webContents.send("captions:payload", latestCaptionPayload);
    currentUiLocale().then(({ translations }) => applyWindowTitles(translations));
  });
}

function configurePermissionsAndCapture() {
  const allowedPermissions = new Set(["media", "display-capture", "speaker-selection"]);
  session.defaultSession.setPermissionCheckHandler((_webContents, permission, _origin, details) => {
    return allowedPermissions.has(permission) && details?.isMainFrame !== false;
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(allowedPermissions.has(permission));
  });

  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 0, height: 0 },
        fetchWindowIcons: false,
      });
      callback(sources[0] ? { video: sources[0], audio: "loopback" } : {});
    } catch {
      callback({});
    }
  }, { useSystemPicker: true });
}

function registerIpc() {
  ipcMain.handle("process-audio:list", async (event) => {
    if (!trustedSender(event)) return [];
    return (await listRunningApplications()).slice(0, 100);
  });

  ipcMain.handle("process-audio:start", async (event, request) => {
    if (!trustedSender(event)) throw new Error("許可されていない操作です。");
    const pid = Number(request?.pid);
    if (!Number.isInteger(pid) || pid <= 0) throw new Error("音声元の指定が正しくありません。");
    return startProcessAudioHelper(pid);
  });

  ipcMain.handle("process-audio:stop", (event) => {
    if (!trustedSender(event)) return false;
    stopProcessAudioHelper();
    return true;
  });

  ipcMain.handle("api-key:status", async (event) => {
    if (!trustedSender(event)) return { configured: false };
    return { configured: (await storedApiKey()).startsWith("sk-") };
  });

  ipcMain.handle("api-key:save", async (event, apiKey) => {
    if (!trustedSender(event)) throw new Error("許可されていない操作です。");
    const normalized = String(apiKey || "").trim();
    if (!normalized.startsWith("sk-") || normalized.length < 20) throw new Error("OpenAI APIキーの形式を確認してください。");
    const settings = await readSettings();
    settings.localEncryptedApiKey = await encryptApiKey(normalized);
    delete settings.encryptedApiKey;
    await writeSettings(settings);
    apiKeyCache = normalized;
    return { ok: true };
  });

  ipcMain.handle("ui-language:get", async (event) => {
    if (!trustedSender(event)) throw new Error("許可されていない操作です。");
    const locale = await currentUiLocale();
    return { ...locale, base: UI_STRINGS_JA, options: OUTPUT_LANGUAGES };
  });

  ipcMain.handle("ui-language:set", async (event, codeValue) => {
    if (!trustedSender(event)) throw new Error("許可されていない操作です。");
    const code = String(codeValue || "");
    if (!isAllowedLanguage(code)) throw new Error("対応していない表示言語です。");
    const translations = builtinUiTranslations(code);
    if (!translations) throw new Error("対応していない表示言語です。");
    const settings = await readSettings();
    settings.uiLanguage = code;
    delete settings.uiTranslations;
    await writeSettings(settings);
    configureApplicationMenu(translations);
    applyWindowTitles(translations);
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send("ui-language:changed", { code, translations, base: UI_STRINGS_JA });
    return { code, translations, base: UI_STRINGS_JA };
  });

  ipcMain.handle("translation:create-session", async (event, request) => {
    if (!trustedSender(event)) throw new Error("許可されていない操作です。");
    const outputLanguage = String(request?.outputLanguage || "");
    const transcribeSource = Boolean(request?.transcribeSource);
    if (!isAllowedLanguage(outputLanguage)) throw new Error("出力言語が未対応です。");
    const apiKey = await storedApiKey();
    if (!apiKey) throw new Error("先にOpenAI APIキーを設定してください。");
    const response = await fetch("https://api.openai.com/v1/realtime/translations/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": "asaph-mac-live-interpreter",
      },
      body: JSON.stringify({
        session: {
          model: "gpt-realtime-translate",
          audio: {
            ...(transcribeSource ? { input: { transcription: { model: "gpt-realtime-whisper" } } } : {}),
            output: { language: outputLanguage },
          },
        },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    const clientSecret = extractClientSecret(payload);
    if (!response.ok || !clientSecret) throw new Error("翻訳セッションを準備できませんでした。APIキーと通信状態を確認してください。");
    return { clientSecret };
  });

  ipcMain.handle("captions:open", (event) => {
    if (!trustedSender(event)) return false;
    if (!captionsWindow || captionsWindow.isDestroyed()) createCaptionsWindow();
    captionsWindow.setOpacity(latestCaptionPayload.transparent ? 0.72 : 1);
    captionsWindow.show();
    captionsWindow.webContents.send("captions:payload", latestCaptionPayload);
    return true;
  });

  ipcMain.handle("captions:hide", (event) => {
    if (!trustedSender(event)) return false;
    if (process.platform === "darwin") captionsWindow?.setWindowButtonVisibility(false);
    captionsWindow?.hide();
    return true;
  });

  ipcMain.on("captions:set-window-hovered", (event, hovered) => {
    if (!trustedSender(event) || process.platform !== "darwin" || !captionsWindow || captionsWindow.isDestroyed()) return;
    captionsWindow.setWindowButtonVisibility(Boolean(hovered));
  });

  ipcMain.on("captions:update", (event, payload) => {
    if (!trustedSender(event)) return;
    latestCaptionPayload = {
      lines: Array.isArray(payload?.lines) ? payload.lines.slice(0, 2).map((line) => ({
        code: String(line?.code || "").slice(0, 12),
        label: String(line?.label || "").slice(0, 40),
        text: String(line?.text || ""),
        fontSize: Math.min(72, Math.max(16, Number(line?.fontSize) || 34)),
        rows: Math.min(12, Math.max(1, Math.round(Number(line?.rows) || 3))),
      })) : [],
      transparent: Boolean(payload?.transparent),
    };
    captionsWindow?.setOpacity(latestCaptionPayload.transparent ? 0.72 : 1);
    captionsWindow?.webContents.send("captions:payload", latestCaptionPayload);
  });

  ipcMain.handle("transcript:save", async (event, request) => {
    if (!trustedSender(event)) throw new Error("許可されていない操作です。");
    const content = String(request?.content || "");
    if (!content.trim()) throw new Error("出力できる字幕がありません。");
    if (Buffer.byteLength(content, "utf8") > 25 * 1024 * 1024) throw new Error("字幕データが大きすぎます。");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "字幕をTXTで保存",
      defaultPath: path.join(app.getPath("documents"), `多言語ライブ通訳_${stamp}.txt`),
      filters: [{ name: "テキストファイル", extensions: ["txt"] }],
    });
    if (result.canceled || !result.filePath) return { saved: false };
    await fs.writeFile(result.filePath, content, "utf8");
    return { saved: true, filePath: result.filePath };
  });

  ipcMain.handle("captions:set-always-on-top", (event, enabled) => {
    if (!trustedSender(event)) return false;
    captionsWindow?.setAlwaysOnTop(Boolean(enabled), "floating");
    return true;
  });
}

app.whenReady().then(async () => {
  configurePermissionsAndCapture();
  registerIpc();
  const locale = await currentUiLocale();
  configureApplicationMenu(locale.translations);
  createMainWindow();
  createCaptionsWindow();
  applyWindowTitles(locale.translations);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      createCaptionsWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on("before-quit", () => {
  app.isQuitting = true;
  stopProcessAudioHelper();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
