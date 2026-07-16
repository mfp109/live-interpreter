const bridge = window.interpreterDesktop;
const form = document.querySelector("#apiKeyForm");
const input = document.querySelector("#apiKey");
const saveButton = document.querySelector("#saveButton");
const statusText = document.querySelector("#apiKeyStatus");
const statusBadge = document.querySelector("#statusBadge");
const message = document.querySelector("#message");
const languageSelect = document.querySelector("#uiLanguage");
const languageMessage = document.querySelector("#languageMessage");
let uiTranslations = {};

function applyTranslations(payload) {
  uiTranslations = payload?.translations || {};
  document.documentElement.lang = payload?.code || "ja";
  document.documentElement.dir = ["ar", "fa", "he"].includes(payload?.code) ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const text = uiTranslations[element.dataset.i18n];
    if (text) element.textContent = text;
  });
  document.title = `${uiTranslations.settings || "設定"}｜Live Interpreter`;
}

function showStatus(configured) {
  statusText.textContent = configured ? uiTranslations.keyConfigured || "APIキーは設定済みです。" : uiTranslations.keyNotConfigured || "APIキーが設定されていません。";
  statusBadge.textContent = configured ? uiTranslations.configured || "設定済み" : uiTranslations.notConfigured || "未設定";
  statusBadge.classList.toggle("configured", configured);
}

async function refreshStatus() {
  const status = await bridge.getApiKeyStatus();
  showStatus(Boolean(status?.configured));
}

async function initializeLanguage() {
  const locale = await bridge.getUiLanguage();
  applyTranslations(locale);
  languageSelect.replaceChildren(...locale.options.map(({ code, nativeLabel, label }) => new Option(nativeLabel || label, code)));
  languageSelect.value = locale.code;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";
  message.className = "";
  saveButton.disabled = true;
  try {
    await bridge.saveApiKey(input.value);
    input.value = "";
    showStatus(true);
    message.textContent = uiTranslations.keySaved || "APIキーを安全に保存し、現在のキーを置き換えました。";
  } catch (error) {
    message.textContent = error?.message || "APIキーを保存できませんでした。";
    message.className = "error";
  } finally {
    saveButton.disabled = false;
  }
});

languageSelect.addEventListener("change", async () => {
  languageMessage.className = "";
  languageMessage.textContent = uiTranslations.languageChanging || "表示言語を変更しています…";
  languageSelect.disabled = true;
  try {
    const locale = await bridge.setUiLanguage(languageSelect.value);
    applyTranslations(locale);
    languageMessage.textContent = uiTranslations.languageChanged || "表示言語を変更しました。";
    showStatus((await bridge.getApiKeyStatus())?.configured);
  } catch (error) {
    languageMessage.textContent = error?.message || "表示言語を変更できませんでした。";
    languageMessage.className = "error";
    const locale = await bridge.getUiLanguage().catch(() => null);
    if (locale) languageSelect.value = locale.code;
  } finally {
    languageSelect.disabled = false;
  }
});

bridge.onUiLanguageChanged((locale) => applyTranslations(locale));

initializeLanguage().then(refreshStatus).catch(() => {
  statusText.textContent = "APIキーの状態を確認できませんでした。";
  statusBadge.textContent = "確認失敗";
});
