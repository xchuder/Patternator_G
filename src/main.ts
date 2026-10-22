import "./fonts.css";
import "./styles.css";
import { appCopy } from "./data/app";
import { formatFontStack, glyphFontStack } from "./data/typography";
import { mountHelloPage } from "./ui/hello-page";
import { mountStudio } from "./ui/studio";

document.title = appCopy.name;
document.documentElement.style.setProperty(
  "--font-glyph",
  formatFontStack(glyphFontStack),
);

const appRoot = document.querySelector("#app");
if (!(appRoot instanceof HTMLElement)) {
  throw new Error("Missing #app");
}
const root: HTMLElement = appRoot;

let page: "studio" | "browser" | null = null;
let cleanup: (() => void) | null = null;

function render(): void {
  const hash = location.hash;
  const next = hash === "#browser" || hash === "#privacy" ? "browser" : "studio";
  if (next === page) return;
  cleanup?.();
  cleanup = null;
  page = next;
  if (next === "browser") mountHelloPage(root);
  else cleanup = mountStudio(root);
}

window.addEventListener("hashchange", render);
render();
