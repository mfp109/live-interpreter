const button = document.querySelector(".menu-button");
const nav = document.querySelector(".site-nav");
button?.addEventListener("click", () => {
  const open = nav?.classList.toggle("open") ?? false;
  button.setAttribute("aria-expanded", String(open));
});
nav?.querySelectorAll("a").forEach((link) =>
  link.addEventListener("click", () => {
    nav.classList.remove("open");
    button?.setAttribute("aria-expanded", "false");
  }),
);
