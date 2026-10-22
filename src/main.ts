import "./fonts.css";
import "./styles.css";
import { appCopy } from "./data/app";
import { formatFontStack, glyphFontStack } from "./data/typography";
import { mountHelloPage } from "./ui/hello-page";

document.title = appCopy.name;
document.documentElement.style.setProperty(
  "--font-glyph",
  formatFontStack(glyphFontStack),
);

const root = document.querySelector("#app");
if (!(root instanceof HTMLElement)) {
  throw new Error("Missing #app");
}

mountHelloPage(root);
