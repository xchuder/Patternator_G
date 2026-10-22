import {
  pendingH264Check,
  readH264Check,
  readImmediateChecks,
  type CheckId,
  type CheckState,
} from "../capabilities/detect";
import { appCopy, glyphSample } from "../data/app";
import { browserSupport, checkLabels, statusLabel } from "../data/browser-support";

const checkOrder: readonly CheckId[] = [
  "webgl2",
  "videoEncoder",
  "videoDecoder",
  "secureContext",
  "h264",
];

export function mountHelloPage(root: HTMLElement): void {
  const banner = document.createElement("div");
  banner.className = "banner";
  banner.setAttribute("role", "status");
  banner.hidden = true;

  const rows = new Map<CheckId, { status: HTMLElement; detail: HTMLElement }>();
  const table = document.createElement("table");
  table.className = "checks";

  const caption = document.createElement("caption");
  caption.textContent = appCopy.checksCaption;
  table.append(caption);

  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.append(columnHeader(appCopy.columnCheck), columnHeader(appCopy.columnResult));
  head.append(headRow);
  table.append(head);

  const body = document.createElement("tbody");
  for (const id of checkOrder) {
    const detail = document.createElement("span");
    detail.className = "check-detail";
    const name = document.createElement("span");
    name.className = "check-name";
    name.textContent = checkLabels[id];
    const label = document.createElement("th");
    label.scope = "row";
    label.append(name, detail);

    const status = document.createElement("span");
    status.className = "status";
    const value = document.createElement("td");
    value.append(status);

    const row = document.createElement("tr");
    row.append(label, value);
    body.append(row);
    rows.set(id, { status, detail });
  }
  table.append(body);

  const rerun = document.createElement("button");
  rerun.type = "button";
  rerun.className = "button";
  rerun.textContent = appCopy.rerun;

  const checks = document.createElement("section");
  checks.className = "panel";
  checks.setAttribute("aria-labelledby", "checks-heading");
  const checksHeading = document.createElement("h2");
  checksHeading.id = "checks-heading";
  checksHeading.textContent = appCopy.checksHeading;
  checks.append(checksHeading, banner, table, rerun);

  const glyph = document.createElement("p");
  glyph.className = "glyph-sample";
  glyph.textContent = glyphSample;
  const glyphCaption = document.createElement("figcaption");
  glyphCaption.textContent = appCopy.glyphCaption;
  const specimen = document.createElement("figure");
  specimen.className = "specimen";
  specimen.append(glyph, glyphCaption);

  const privacyHeading = document.createElement("h2");
  privacyHeading.textContent = appCopy.privacyHeading;
  const privacyBody = document.createElement("p");
  privacyBody.textContent = appCopy.privacyBody;
  const privacy = document.createElement("section");
  privacy.id = "privacy";
  privacy.className = "panel";
  privacy.append(privacyHeading, privacyBody);

  const studioLink = document.createElement("a");
  studioLink.className = "nav-link";
  studioLink.href = "#studio";
  studioLink.textContent = appCopy.studioLink;
  const privacyLink = document.createElement("a");
  privacyLink.className = "nav-link";
  privacyLink.href = "#privacy";
  privacyLink.textContent = appCopy.privacyLink;
  const nav = document.createElement("nav");
  nav.className = "top-nav";
  nav.append(studioLink, privacyLink);
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = `${appCopy.name} · ${appCopy.phase}`;
  const top = document.createElement("header");
  top.className = "top";
  top.append(eyebrow, nav);

  const title = document.createElement("h1");
  title.textContent = appCopy.title;
  const summary = document.createElement("p");
  summary.className = "summary";
  summary.textContent = appCopy.summary;

  const main = document.createElement("main");
  main.append(top, title, summary, specimen, checks, privacy);
  root.replaceChildren(main);

  const state = new Map<CheckId, CheckState>();
  let generation = 0;

  const paint = (id: CheckId, check: CheckState): void => {
    state.set(id, check);
    const row = rows.get(id);
    if (row === undefined) {
      return;
    }
    row.status.dataset["status"] = check.status;
    row.status.textContent = statusLabel[check.status];
    row.detail.textContent = check.detail;
    row.detail.hidden = check.detail.length === 0;
  };

  const paintBanner = (): void => {
    const messages = bannerMessages(state);
    banner.replaceChildren();
    if (messages.length === 0) {
      banner.hidden = true;
      return;
    }
    banner.hidden = false;
    for (const message of messages) {
      const paragraph = document.createElement("p");
      paragraph.textContent = message;
      banner.append(paragraph);
    }
  };

  const run = (): void => {
    const ticket = ++generation;
    table.setAttribute("aria-busy", "true");
    rerun.disabled = true;
    const immediate = readImmediateChecks();
    paint("webgl2", immediate.webgl2);
    paint("videoEncoder", immediate.videoEncoder);
    paint("videoDecoder", immediate.videoDecoder);
    paint("secureContext", immediate.secureContext);
    paint("h264", pendingH264Check());
    paintBanner();

    void readH264Check().then((h264) => {
      if (ticket !== generation) {
        return;
      }
      paint("h264", h264);
      paintBanner();
      table.setAttribute("aria-busy", "false");
      rerun.disabled = false;
    });
  };

  rerun.addEventListener("click", run);
  run();
}

function columnHeader(text: string): HTMLTableCellElement {
  const cell = document.createElement("th");
  cell.scope = "col";
  cell.textContent = text;
  return cell;
}

function bannerMessages(state: ReadonlyMap<CheckId, CheckState>): string[] {
  const messages: string[] = [];
  const webgl2 = state.get("webgl2");
  if (webgl2?.status === "fail") {
    messages.push(browserSupport.webgl2);
  }

  const secure = state.get("secureContext");
  if (secure !== undefined && secure.status !== "pass") {
    messages.push(browserSupport.insecure);
  }

  const encoder = state.get("videoEncoder");
  const decoder = state.get("videoDecoder");
  const h264 = state.get("h264");
  const codecsMissing =
    (encoder !== undefined && encoder.status !== "pass") ||
    (decoder !== undefined && decoder.status !== "pass");
  const h264Bad =
    h264 !== undefined && h264.status !== "pending" && h264.status !== "pass";
  if (codecsMissing || h264Bad) {
    messages.push(browserSupport.mp4);
  }
  return messages;
}
