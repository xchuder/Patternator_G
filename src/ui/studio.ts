import { defaults, initialAscii, initialEffectId, initialPixelate, initialPrefilter, type AsciiParams, type EffectId, type PixelateParams, type PrefilterParams } from "../data/defaults";
import { loadGlyphFonts } from "../effects/ascii/atlas";
import { charsetWarnings } from "../effects/ascii/charset";
import { effectOrder, effects } from "../effects/registry";
import { downloadBlob, exportFilename } from "../export/png";
import { decodeImage, ImageLoadError } from "../image/load";
import { createRenderer } from "../render/create-renderer";
import {
  exportSizeMessage,
  fileMeta,
  savedMessage,
  studioCopy,
  textureLimitMessage,
  tooLargeMessage,
  videoLimitMessage,
} from "../data/studio-copy";
import { mountControls, type ControlHandle } from "./controls";

type TabId = "source" | "filter" | "effect" | "export";

interface StudioState {
  bitmap: ImageBitmap | null;
  fileName: string;
  effectId: EffectId;
  prefilter: PrefilterParams;
  ascii: AsciiParams;
  pixelate: PixelateParams;
}

export function mountStudio(root: HTMLElement): () => void {
  const state: StudioState = {
    bitmap: null,
    fileName: "",
    effectId: initialEffectId(),
    prefilter: initialPrefilter(),
    ascii: initialAscii(),
    pixelate: initialPixelate(),
  };

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.className = "file-input";
  fileInput.accept = defaults.image.accept.join(",");
  fileInput.tabIndex = -1;

  const choose = document.createElement("button");
  choose.type = "button";
  choose.className = "button";
  choose.textContent = studioCopy.choose;

  const replace = document.createElement("button");
  replace.type = "button";
  replace.className = "button";
  replace.textContent = studioCopy.replace;

  const dropTitle = document.createElement("p");
  dropTitle.className = "drop-title";
  dropTitle.textContent = studioCopy.dropTitle;
  const dropNote = document.createElement("p");
  dropNote.className = "drop-note";
  dropNote.textContent = studioCopy.dropNote;
  const drop = document.createElement("div");
  drop.className = "drop";
  drop.append(dropTitle, dropNote, choose);

  const canvas = document.createElement("canvas");
  canvas.className = "preview";
  canvas.hidden = true;

  const frame = document.createElement("div");
  frame.className = "stage-frame";
  frame.append(canvas, drop);

  const stage = document.createElement("div");
  stage.className = "stage";
  stage.append(frame);

  const meta = document.createElement("p");
  meta.className = "meta";
  meta.setAttribute("role", "status");

  const alert = document.createElement("p");
  alert.className = "alert";
  alert.setAttribute("role", "alert");
  alert.hidden = true;

  const panels = {
    source: document.createElement("div"),
    filter: document.createElement("div"),
    effect: document.createElement("div"),
    export: document.createElement("div"),
  };
  for (const panel of Object.values(panels)) panel.className = "tab-panel";

  const privacy = document.createElement("p");
  privacy.className = "quiet";
  privacy.textContent = studioCopy.privacy;
  panels.source.append(replace, privacy);

  mountFilter(panels.filter, state, () => {
    requestDraw();
  });

  const effectNotice = document.createElement("p");
  effectNotice.className = "notice";
  effectNotice.setAttribute("role", "status");
  const effectFields = document.createElement("div");
  panels.effect.append(effectNotice, effectFields);

  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.className = "button button-strong";
  exportButton.textContent = studioCopy.download;
  exportButton.disabled = true;
  const exportSize = document.createElement("p");
  exportSize.className = "quiet";
  const exportLimit = document.createElement("p");
  exportLimit.className = "quiet";
  exportLimit.textContent = videoLimitMessage(
    defaults.limits.desktopVideoMaxEdge,
    defaults.limits.mobileVideoMaxEdge,
  );
  panels.export.append(exportButton, exportSize, exportLimit);

  const tabButtons = new Map<TabId, HTMLButtonElement>();
  const tablist = document.createElement("div");
  tablist.className = "tabs";
  tablist.setAttribute("role", "tablist");
  const tabCopy: { id: TabId; label: string }[] = [
    { id: "source", label: studioCopy.sourceTab },
    { id: "filter", label: studioCopy.filterTab },
    { id: "effect", label: studioCopy.effectTab },
    { id: "export", label: studioCopy.exportTab },
  ];
  for (const tab of tabCopy) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab";
    button.textContent = tab.label;
    button.setAttribute("role", "tab");
    button.addEventListener("click", () => {
      showTab(tab.id);
    });
    tabButtons.set(tab.id, button);
    tablist.append(button);
  }

  const sheet = document.createElement("aside");
  sheet.className = "sheet";
  sheet.append(meta, alert, tablist, panels.source, panels.filter, panels.effect, panels.export);

  const browserLink = document.createElement("a");
  browserLink.className = "nav-link";
  browserLink.href = "#browser";
  browserLink.textContent = studioCopy.browserLink;
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = `Patternator · ${studioCopy.phase}`;
  const bar = document.createElement("header");
  bar.className = "studio-bar";
  bar.append(eyebrow, browserLink);

  const body = document.createElement("div");
  body.className = "studio-body";
  body.append(stage, sheet);

  const studio = document.createElement("div");
  studio.className = "studio";
  studio.append(bar, body, fileInput);
  root.replaceChildren(studio);

  const renderer = createRenderer(canvas);
  let effectControls: ControlHandle | null = null;
  let raf = 0;
  let fontsReady = false;
  let exporting = false;

  const showTab = (next: TabId): void => {
    for (const [id, button] of tabButtons) {
      const selected = id === next;
      button.setAttribute("aria-selected", selected ? "true" : "false");
      panels[id].hidden = !selected;
    }
  };

  const backendLabel = renderer.backend === "webgl2" ? studioCopy.webgl2 : studioCopy.canvas2d;

  const paintMeta = (): void => {
    const bitmap = state.bitmap;
    if (bitmap === null) {
      meta.textContent = `${studioCopy.noImage} · ${backendLabel}`;
      exportSize.textContent = studioCopy.noImage;
      exportButton.disabled = true;
      return;
    }
    meta.textContent = fileMeta(state.fileName, bitmap.width, bitmap.height, backendLabel);
    exportSize.textContent = exportSizeMessage(bitmap.width, bitmap.height);
    exportButton.disabled = exporting;
  };

  const paintNotice = (): void => {
    if (state.effectId !== "ascii") {
      effectNotice.hidden = true;
      effectNotice.textContent = "";
      return;
    }
    const messages = charsetWarnings(state.ascii.charset);
    effectNotice.hidden = messages.length === 0;
    effectNotice.textContent = messages.join(" ");
  };

  const mountEffectFields = (): void => {
    effectFields.replaceChildren();
    const choice = document.createElement("div");
    choice.className = "segment";
    choice.setAttribute("role", "group");
    choice.setAttribute("aria-label", studioCopy.effectLabel);
    for (const effect of effectOrder) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button segment-button";
      button.textContent = effect.label;
      button.setAttribute("aria-pressed", effect.id === state.effectId ? "true" : "false");
      button.addEventListener("click", () => {
        state.effectId = effect.id;
        for (const child of choice.querySelectorAll("button")) {
          child.setAttribute("aria-pressed", child === button ? "true" : "false");
        }
        mountEffectFields();
        paintNotice();
        requestDraw();
      });
      choice.append(button);
    }
    const choiceField = document.createElement("div");
    choiceField.className = "field";
    const choiceName = document.createElement("span");
    choiceName.className = "field-name";
    choiceName.textContent = studioCopy.effectLabel;
    choiceField.append(choiceName, choice);
    effectFields.append(choiceField);

    const active = state.effectId === "ascii" ? effects.ascii : effects.pixelate;
    effectControls = mountControls(effectFields, active.controls(), activeParams(state), (key, value) => {
      if (state.effectId === "ascii") {
        state.ascii = effects.ascii.withControl(state.ascii, key, value);
        effectControls?.sync(state.ascii);
        paintNotice();
      } else {
        state.pixelate = effects.pixelate.withControl(state.pixelate, key, value);
        effectControls?.sync(state.pixelate);
      }
      requestDraw();
    });
  };

  const showAlert = (message: string): void => {
    alert.hidden = message.length === 0;
    alert.textContent = message;
  };

  const requestDraw = (): void => {
    if (raf !== 0) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      drawNow();
    });
  };

  const drawNow = (): void => {
    const bitmap = state.bitmap;
    if (bitmap === null || !fontsReady) return;
    const boxW = frame.clientWidth;
    const boxH = frame.clientHeight;
    if (boxW < 2 || boxH < 2) return;
    const size = previewPixels(bitmap.width, bitmap.height, boxW, boxH);
    canvas.style.width = `${size.cssW}px`;
    canvas.style.height = `${size.cssH}px`;
    try {
      renderer.draw(bitmap, {
        effectId: state.effectId,
        prefilter: state.prefilter,
        ascii: state.ascii,
        pixelate: state.pixelate,
        width: size.bufW,
        height: size.bufH,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : studioCopy.readError;
      showAlert(message);
    }
  };

  const loadFile = (file: File): void => {
    showAlert("");
    void decodeImage(file)
      .then((bitmap) => {
        if (bitmap.width > renderer.maxTextureSize || bitmap.height > renderer.maxTextureSize) {
          bitmap.close();
          showAlert(textureLimitMessage(renderer.maxTextureSize));
          return;
        }
        state.bitmap?.close();
        state.bitmap = bitmap;
        state.fileName = file.name || "image";
        canvas.hidden = false;
        drop.hidden = true;
        renderer.setSource(bitmap);
        paintMeta();
        showTab("effect");
        requestDraw();
      })
      .catch((error: unknown) => {
        if (error instanceof ImageLoadError) {
          if (error.reason === "type") showAlert(studioCopy.typeError);
          else if (error.reason === "too-large") showAlert(tooLargeMessage(defaults.image.maxDecodeEdge));
          else showAlert(studioCopy.readError);
          return;
        }
        showAlert(studioCopy.readError);
      });
  };

  choose.addEventListener("click", () => {
    fileInput.click();
  });
  replace.addEventListener("click", () => {
    fileInput.click();
  });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (file !== undefined) loadFile(file);
  });

  const onDragOver = (event: DragEvent): void => {
    event.preventDefault();
    stage.classList.add("dragging");
  };
  const onDragLeave = (): void => {
    stage.classList.remove("dragging");
  };
  const onDrop = (event: DragEvent): void => {
    event.preventDefault();
    stage.classList.remove("dragging");
    const file = event.dataTransfer?.files[0];
    if (file !== undefined) loadFile(file);
  };
  stage.addEventListener("dragover", onDragOver);
  stage.addEventListener("dragleave", onDragLeave);
  stage.addEventListener("drop", onDrop);
  const stopNavigation = (event: DragEvent): void => {
    event.preventDefault();
  };
  window.addEventListener("dragover", stopNavigation);
  window.addEventListener("drop", stopNavigation);

  exportButton.addEventListener("click", () => {
    const bitmap = state.bitmap;
    if (bitmap === null || exporting) return;
    exporting = true;
    exportButton.disabled = true;
    exportButton.textContent = studioCopy.preparing;
    let saved = "";
    void renderer
      .exportPng(bitmap, {
        effectId: state.effectId,
        prefilter: state.prefilter,
        ascii: state.ascii,
        pixelate: state.pixelate,
      })
      .then((blob) => {
        saved = exportFilename(state.fileName, state.effectId);
        downloadBlob(blob, saved);
        showAlert("");
      })
      .catch(() => {
        showAlert(studioCopy.exportFailed);
      })
      .finally(() => {
        exporting = false;
        exportButton.textContent = studioCopy.download;
        paintMeta();
        if (saved.length > 0) exportSize.textContent = savedMessage(saved);
        requestDraw();
      });
  });

  const observer = new ResizeObserver(() => {
    requestDraw();
  });
  observer.observe(frame);

  showTab("source");
  mountEffectFields();
  paintNotice();
  paintMeta();

  void loadGlyphFonts().then(() => {
    fontsReady = true;
    requestDraw();
  });

  return () => {
    if (raf !== 0) cancelAnimationFrame(raf);
    observer.disconnect();
    window.removeEventListener("dragover", stopNavigation);
    window.removeEventListener("drop", stopNavigation);
    state.bitmap?.close();
    renderer.dispose();
  };
}

function mountFilter(parent: HTMLElement, state: StudioState, onChange: () => void): void {
  const spec = defaults.prefilter;
  const sliders = [spec.brightness, spec.contrast, spec.gamma, spec.threshold] as const;
  const keys = ["brightness", "contrast", "gamma", "threshold"] as const;
  sliders.forEach((slider, index) => {
    const key = keys[index];
    if (key === undefined) return;
    const label = document.createElement("label");
    label.className = "field";
    const head = document.createElement("span");
    head.className = "field-head";
    const name = document.createElement("span");
    name.className = "field-name";
    name.textContent = slider.label;
    const readout = document.createElement("span");
    readout.className = "field-value";
    const current = state.prefilter[key];
    readout.textContent = formatSlider(current, slider.step, slider.min);
    head.append(name, readout);
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(slider.min);
    input.max = String(slider.max);
    input.step = String(slider.step);
    input.value = String(current);
    input.addEventListener("input", () => {
      const next = Number(input.value);
      readout.textContent = formatSlider(next, slider.step, slider.min);
      state.prefilter = { ...state.prefilter, [key]: next };
      onChange();
    });
    label.append(head, input);
    if ("hint" in slider && typeof slider.hint === "string") {
      const hint = document.createElement("span");
      hint.className = "field-hint";
      hint.textContent = slider.hint;
      label.append(hint);
    }
    parent.append(label);
  });

  const invert = document.createElement("label");
  invert.className = "check";
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = state.prefilter.invert;
  box.addEventListener("change", () => {
    state.prefilter = { ...state.prefilter, invert: box.checked };
    onChange();
  });
  const invertName = document.createElement("span");
  invertName.textContent = spec.invert.label;
  invert.append(box, invertName);
  parent.append(invert);
}

function previewPixels(
  srcW: number,
  srcH: number,
  boxW: number,
  boxH: number,
): { cssW: number; cssH: number; bufW: number; bufH: number } {
  const contain = Math.min(boxW / srcW, boxH / srcH);
  const cssW = Math.max(1, Math.floor(srcW * contain));
  const cssH = Math.max(1, Math.floor(srcH * contain));
  const dpr = Math.min(window.devicePixelRatio || 1, defaults.limits.maxDpr);
  let bufW = Math.max(1, Math.round(cssW * dpr));
  let bufH = Math.max(1, Math.round(cssH * dpr));
  const edge = Math.max(bufW, bufH);
  if (edge > defaults.limits.previewMaxEdge) {
    const scale = defaults.limits.previewMaxEdge / edge;
    bufW = Math.max(1, Math.round(bufW * scale));
    bufH = Math.max(1, Math.round(bufH * scale));
  }
  return {
    cssW,
    cssH,
    bufW: Math.min(bufW, srcW),
    bufH: Math.min(bufH, srcH),
  };
}

function activeParams(state: StudioState): AsciiParams | PixelateParams {
  return state.effectId === "ascii" ? state.ascii : state.pixelate;
}

function formatSlider(value: number, step: number, min: number): string {
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  const text = value.toFixed(decimals);
  if (min < 0 && value > 0) return `+${text}`;
  return text;
}
