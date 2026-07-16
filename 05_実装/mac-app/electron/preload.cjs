const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("interpreterDesktop", {
  getApiKeyStatus: () => ipcRenderer.invoke("api-key:status"),
  saveApiKey: (apiKey) => ipcRenderer.invoke("api-key:save", apiKey),
  getUiLanguage: () => ipcRenderer.invoke("ui-language:get"),
  setUiLanguage: (code) => ipcRenderer.invoke("ui-language:set", code),
  createTranslationSession: (outputLanguage, transcribeSource = false) => ipcRenderer.invoke("translation:create-session", { outputLanguage, transcribeSource }),
  listAudioApps: () => ipcRenderer.invoke("process-audio:list"),
  startProcessAudio: (pid) => ipcRenderer.invoke("process-audio:start", { pid }),
  stopProcessAudio: () => ipcRenderer.invoke("process-audio:stop"),
  openCaptions: () => ipcRenderer.invoke("captions:open"),
  hideCaptions: () => ipcRenderer.invoke("captions:hide"),
  saveTranscript: (content) => ipcRenderer.invoke("transcript:save", { content }),
  updateCaptions: (payload) => ipcRenderer.send("captions:update", payload),
  setCaptionsAlwaysOnTop: (enabled) => ipcRenderer.invoke("captions:set-always-on-top", enabled),
  setCaptionWindowHovered: (hovered) => ipcRenderer.send("captions:set-window-hovered", hovered),
  onCaptionPayload: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("captions:payload", listener);
    return () => ipcRenderer.removeListener("captions:payload", listener);
  },
  onUiLanguageChanged: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("ui-language:changed", listener);
    return () => ipcRenderer.removeListener("ui-language:changed", listener);
  },
});
