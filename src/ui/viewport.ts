import { defaults } from "../data/defaults";

export interface ViewportHandle {
  reset(sourceWidth: number, sourceHeight: number): void;
  layout(): void;
  dispose(): void;
}

const spec = defaults.view;
const minZoom = spec.minPercent / 100;
const maxZoom = spec.maxPercent / 100;

export function mountViewport(frame: HTMLElement, canvas: HTMLCanvasElement): ViewportHandle {
  const bar = document.createElement("div");
  bar.className = "zoom-bar";
  bar.dataset.viewChrome = "true";
  bar.hidden = true;

  const zoomOut = zoomButton("−", spec.zoomOutLabel);
  const zoomIn = zoomButton("+", spec.zoomInLabel);
  const fit = zoomButton(spec.fitLabel, spec.fitLabel);
  const actual = zoomButton(spec.actualLabel, spec.actualLabel);
  const label = document.createElement("label");
  label.className = "zoom-label";
  const name = document.createElement("span");
  name.textContent = spec.zoomLabel;
  const input = document.createElement("input");
  input.type = "number";
  input.className = "zoom-input";
  input.min = String(spec.minPercent);
  input.max = String(spec.maxPercent);
  input.step = "1";
  input.inputMode = "numeric";
  input.setAttribute("aria-label", spec.zoomLabel);
  input.dataset.zoomInput = "true";
  const unit = document.createElement("span");
  unit.className = "zoom-unit";
  unit.textContent = "%";
  label.append(name, input, unit);
  bar.append(zoomOut, zoomIn, label, fit, actual);
  frame.append(bar);
  canvas.draggable = false;
  bar.addEventListener("wheel", (event) => {
    event.preventDefault();
    event.stopPropagation();
  }, { passive: false });

  let mode: "fit" | "manual" = "fit";
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let sourceW = 0;
  let sourceH = 0;
  let spaceDown = false;
  let panning = false;
  let pinch: { dist: number; zoom: number; imgX: number; imgY: number } | null = null;
  const pointers = new Map<number, { x: number; y: number }>();

  const viewSize = (): { w: number; h: number } => ({
    w: frame.clientWidth,
    h: frame.clientHeight,
  });

  const paint = (): void => {
    const percent = Math.round(zoom * 100);
    frame.dataset.viewZoom = String(percent);
    if (document.activeElement !== input) input.value = String(percent);
    if (sourceW < 1 || sourceH < 1) return;
    canvas.style.width = `${sourceW * zoom}px`;
    canvas.style.height = `${sourceH * zoom}px`;
    canvas.style.left = `${panX}px`;
    canvas.style.top = `${panY}px`;
    canvas.dataset.pixelated = zoom > 1 ? "true" : "false";
    const box = viewSize();
    const overflows = sourceW * zoom > box.w + 0.5 || sourceH * zoom > box.h + 0.5;
    frame.classList.toggle("is-pannable", spaceDown || overflows);
    frame.classList.toggle("is-panning", panning);
  };

  const clampPan = (): void => {
    const box = viewSize();
    const dispW = sourceW * zoom;
    const dispH = sourceH * zoom;
    const keepX = Math.min(spec.panMargin, dispW);
    const keepY = Math.min(spec.panMargin, dispH);
    const minX = keepX - dispW;
    const maxX = box.w - keepX;
    const minY = keepY - dispH;
    const maxY = box.h - keepY;
    panX = clamp(panX, Math.min(minX, maxX), Math.max(minX, maxX));
    panY = clamp(panY, Math.min(minY, maxY), Math.max(minY, maxY));
  };

  const center = (): void => {
    const box = viewSize();
    panX = (box.w - sourceW * zoom) / 2;
    panY = (box.h - sourceH * zoom) / 2;
  };

  const layout = (): void => {
    if (sourceW < 1 || sourceH < 1) return;
    const box = viewSize();
    if (box.w < 2 || box.h < 2) return;
    if (mode === "fit") {
      zoom = clamp(Math.min(box.w / sourceW, box.h / sourceH), minZoom, maxZoom);
      center();
    } else {
      clampPan();
    }
    paint();
  };

  const zoomAt = (next: number, anchorX: number, anchorY: number): void => {
    const clamped = clamp(next, minZoom, maxZoom);
    const imgX = (anchorX - panX) / zoom;
    const imgY = (anchorY - panY) / zoom;
    mode = "manual";
    zoom = clamped;
    panX = anchorX - imgX * zoom;
    panY = anchorY - imgY * zoom;
    clampPan();
    paint();
  };

  const zoomAtCenter = (next: number): void => {
    const box = viewSize();
    zoomAt(next, box.w / 2, box.h / 2);
  };

  zoomOut.addEventListener("click", () => {
    zoomAtCenter(zoom / spec.buttonStep);
  });
  zoomIn.addEventListener("click", () => {
    zoomAtCenter(zoom * spec.buttonStep);
  });
  fit.addEventListener("click", () => {
    mode = "fit";
    layout();
  });
  actual.addEventListener("click", () => {
    mode = "manual";
    zoom = 1;
    center();
    clampPan();
    paint();
  });

  const commitInput = (): void => {
    const value = Number(input.value);
    if (!Number.isFinite(value)) {
      paint();
      return;
    }
    zoomAtCenter(value / 100);
  };
  input.addEventListener("change", commitInput);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      commitInput();
      input.blur();
    }
  });

  const localPoint = (event: { clientX: number; clientY: number }): { x: number; y: number } => {
    const rect = frame.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onWheel = (event: WheelEvent): void => {
    if (sourceW < 1) return;
    const target = event.target;
    if (isViewChrome(target)) return;
    event.preventDefault();
    const point = localPoint(event);
    const factor = event.deltaY < 0 ? spec.wheelStep : 1 / spec.wheelStep;
    zoomAt(zoom * factor, point.x, point.y);
  };

  const canPan = (): boolean => {
    const box = viewSize();
    return spaceDown || sourceW * zoom > box.w + 0.5 || sourceH * zoom > box.h + 0.5;
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (sourceW < 1) return;
    const target = event.target;
    if (isViewChrome(target)) return;
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const point = localPoint(event);
    pointers.set(event.pointerId, point);
    frame.setPointerCapture(event.pointerId);
    if (pointers.size === 2) {
      pinch = pinchStart();
      panning = false;
      return;
    }
    if (pointers.size === 1 && canPan()) panning = true;
    paint();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!pointers.has(event.pointerId)) return;
    const point = localPoint(event);
    const previous = pointers.get(event.pointerId);
    pointers.set(event.pointerId, point);
    if (pointers.size >= 2 && pinch !== null) {
      const mid = midpoint();
      const dist = separation();
      if (mid === null || dist < 1) return;
      const next = pinch.zoom * (dist / pinch.dist);
      const clamped = clamp(next, minZoom, maxZoom);
      mode = "manual";
      zoom = clamped;
      panX = mid.x - pinch.imgX * zoom;
      panY = mid.y - pinch.imgY * zoom;
      clampPan();
      paint();
      return;
    }
    if (!panning || previous === undefined) return;
    panX += point.x - previous.x;
    panY += point.y - previous.y;
    mode = "manual";
    clampPan();
    paint();
  };

  const onPointerEnd = (event: PointerEvent): void => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) panning = false;
    else if (pointers.size === 1) panning = canPan();
    paint();
  };

  function pinchStart(): { dist: number; zoom: number; imgX: number; imgY: number } | null {
    const mid = midpoint();
    const dist = separation();
    if (mid === null || dist < 1) return null;
    return { dist, zoom, imgX: (mid.x - panX) / zoom, imgY: (mid.y - panY) / zoom };
  }

  function midpoint(): { x: number; y: number } | null {
    const points = [...pointers.values()];
    const first = points[0];
    const second = points[1];
    if (first === undefined || second === undefined) return null;
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  }

  function separation(): number {
    const points = [...pointers.values()];
    const first = points[0];
    const second = points[1];
    if (first === undefined || second === undefined) return 0;
    return Math.hypot(first.x - second.x, first.y - second.y);
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== " " || event.repeat) return;
    if (isTypingTarget(event.target)) return;
    spaceDown = true;
    event.preventDefault();
    paint();
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    if (event.key !== " ") return;
    spaceDown = false;
    paint();
  };
  const onBlur = (): void => {
    spaceDown = false;
    panning = false;
    paint();
  };

  frame.addEventListener("wheel", onWheel, { passive: false });
  frame.addEventListener("pointerdown", onPointerDown);
  frame.addEventListener("pointermove", onPointerMove);
  frame.addEventListener("pointerup", onPointerEnd);
  frame.addEventListener("pointercancel", onPointerEnd);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return {
    reset(nextWidth: number, nextHeight: number): void {
      sourceW = nextWidth;
      sourceH = nextHeight;
      mode = "fit";
      bar.hidden = false;
      layout();
    },
    layout,
    dispose(): void {
      frame.removeEventListener("wheel", onWheel);
      frame.removeEventListener("pointerdown", onPointerDown);
      frame.removeEventListener("pointermove", onPointerMove);
      frame.removeEventListener("pointerup", onPointerEnd);
      frame.removeEventListener("pointercancel", onPointerEnd);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      bar.remove();
    },
  };
}

function isViewChrome(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-view-chrome]") !== null;
}

function zoomButton(text: string, aria: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button zoom-button";
  button.textContent = text;
  button.setAttribute("aria-label", aria);
  return button;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || tag === "A";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
