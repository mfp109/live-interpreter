const sections = [document.querySelector("#captionLine1"), document.querySelector("#captionLine2")];
const labels = [document.querySelector("#language1"), document.querySelector("#language2")];
const texts = [document.querySelector("#text1"), document.querySelector("#text2")];
let leaveTimer;

function applyUiLanguage(locale) {
  document.documentElement.lang = locale?.code || "ja";
  document.documentElement.dir = ["ar", "fa", "he"].includes(locale?.code) ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const text = locale?.translations?.[element.dataset.i18n];
    if (text) element.textContent = text;
  });
  document.title = locale?.translations?.sharedCaptions || "共有用字幕｜Live Interpreter";
}

window.interpreterDesktop.getUiLanguage().then(applyUiLanguage).catch(() => {});
window.interpreterDesktop.onUiLanguageChanged(applyUiLanguage);

document.body.addEventListener("mouseenter", () => {
  clearTimeout(leaveTimer);
  window.interpreterDesktop.setCaptionWindowHovered(true);
});

document.body.addEventListener("mouseleave", () => {
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => window.interpreterDesktop.setCaptionWindowHovered(false), 500);
});

function updateScrollableText(element, text) {
  const shouldFollow = !element.dataset.ready || element.scrollHeight - element.scrollTop - element.clientHeight < 36;
  element.textContent = text;
  element.dataset.ready = "true";
  if (shouldFollow) requestAnimationFrame(() => { element.scrollTop = element.scrollHeight; });
}

window.interpreterDesktop.onCaptionPayload((payload) => {
  sections.forEach((section, index) => {
    const line = payload.lines?.[index];
    section.hidden = !line;
    labels[index].textContent = line?.label || "";
    const fontSize = line?.fontSize || 34;
    const rows = line?.rows || 3;
    texts[index].style.fontSize = `${fontSize}px`;
    texts[index].style.height = `${Math.ceil(fontSize * 1.42 * rows)}px`;
    updateScrollableText(texts[index], line?.text || `${line?.label || "字幕"}の発話を待っています。`);
  });
  document.body.classList.toggle("transparent", Boolean(payload.transparent));
});
