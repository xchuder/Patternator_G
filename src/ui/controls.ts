import type { ControlSpec, ControlValue } from "../effects/types";

export interface ControlHandle {
  sync(params: object): void;
}

export function mountControls(
  parent: HTMLElement,
  specs: readonly ControlSpec[],
  params: object,
  onChange: (key: string, value: ControlValue) => void,
): ControlHandle {
  const rows: { spec: ControlSpec; element: HTMLElement }[] = [];
  for (const spec of specs) {
    const element = mountSpec(parent, spec, params, onChange);
    rows.push({ spec, element });
  }
  const sync = (next: object): void => {
    for (const row of rows) {
      const when = row.spec.visibleWhen;
      row.element.hidden = when !== undefined && String(readValue(next, when.key)) !== when.equals;
    }
  };
  sync(params);
  return { sync };
}

function mountSpec(
  parent: HTMLElement,
  spec: ControlSpec,
  params: object,
  onChange: (key: string, value: ControlValue) => void,
): HTMLElement {
  const value = readValue(params, spec.key);
  switch (spec.kind) {
    case "range":
      return mountRange(parent, spec, typeof value === "number" ? value : 0, onChange);
    case "checkbox":
      return mountCheck(parent, spec, value === true, onChange);
    case "text":
      return mountText(parent, spec, typeof value === "string" ? value : "", onChange);
    case "color":
      return mountColor(parent, spec, typeof value === "string" ? value : "#ffffff", onChange);
    case "segment":
      return mountSegment(parent, spec, typeof value === "string" ? value : "", onChange);
    default:
      return document.createElement("div");
  }
}

function mountRange(
  parent: HTMLElement,
  spec: ControlSpec,
  value: number,
  onChange: (key: string, value: ControlValue) => void,
): HTMLElement {
  const min = spec.min ?? 0;
  const max = spec.max ?? 1;
  const step = spec.step ?? 1;
  const label = document.createElement("label");
  label.className = "field";
  const head = document.createElement("span");
  head.className = "field-head";
  const name = document.createElement("span");
  name.className = "field-name";
  name.textContent = spec.label;
  const readout = document.createElement("span");
  readout.className = "field-value";
  readout.textContent = formatSlider(value, step, min);
  head.append(name, readout);
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.addEventListener("input", () => {
    const next = Number(input.value);
    readout.textContent = formatSlider(next, step, min);
    onChange(spec.key, next);
  });
  label.append(head, input);
  if (spec.hint !== undefined) {
    const hint = document.createElement("span");
    hint.className = "field-hint";
    hint.textContent = spec.hint;
    label.append(hint);
  }
  parent.append(label);
  return label;
}

function mountCheck(
  parent: HTMLElement,
  spec: ControlSpec,
  value: boolean,
  onChange: (key: string, value: ControlValue) => void,
): HTMLElement {
  const label = document.createElement("label");
  label.className = "check";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = value;
  input.addEventListener("change", () => {
    onChange(spec.key, input.checked);
  });
  const name = document.createElement("span");
  name.textContent = spec.label;
  label.append(input, name);
  parent.append(label);
  return label;
}

function mountText(
  parent: HTMLElement,
  spec: ControlSpec,
  value: string,
  onChange: (key: string, value: ControlValue) => void,
): HTMLElement {
  const wrap = document.createElement("label");
  wrap.className = "field";
  const name = document.createElement("span");
  name.className = "field-name";
  name.textContent = spec.label;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "text-input";
  input.value = value;
  input.autocomplete = "off";
  input.spellcheck = false;
  input.addEventListener("input", () => {
    onChange(spec.key, input.value);
  });
  wrap.append(name, input);
  if (spec.presets !== undefined && spec.presets.length > 0) {
    const row = document.createElement("div");
    row.className = "preset-row";
    for (const preset of spec.presets) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button";
      button.textContent = preset.label;
      button.addEventListener("click", () => {
        input.value = preset.value;
        onChange(spec.key, preset.value);
      });
      row.append(button);
    }
    wrap.append(row);
  }
  parent.append(wrap);
  return wrap;
}

function mountColor(
  parent: HTMLElement,
  spec: ControlSpec,
  value: string,
  onChange: (key: string, value: ControlValue) => void,
): HTMLElement {
  const label = document.createElement("label");
  label.className = "check";
  const name = document.createElement("span");
  name.textContent = spec.label;
  const input = document.createElement("input");
  input.type = "color";
  input.value = value;
  input.addEventListener("input", () => {
    onChange(spec.key, input.value);
  });
  label.append(name, input);
  parent.append(label);
  return label;
}

function mountSegment(
  parent: HTMLElement,
  spec: ControlSpec,
  value: string,
  onChange: (key: string, value: ControlValue) => void,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const name = document.createElement("span");
  name.className = "field-name";
  name.textContent = spec.label;
  const row = document.createElement("div");
  row.className = "segment";
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", spec.label);
  const buttons: HTMLButtonElement[] = [];
  const paint = (current: string): void => {
    for (const button of buttons) {
      const selected = button.dataset["value"] === current;
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    }
  };
  for (const option of spec.options ?? []) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button segment-button";
    button.textContent = option.label;
    button.dataset["value"] = option.value;
    button.addEventListener("click", () => {
      paint(option.value);
      onChange(spec.key, option.value);
    });
    buttons.push(button);
    row.append(button);
  }
  paint(value);
  wrap.append(name, row);
  parent.append(wrap);
  return wrap;
}

function readValue(params: object, key: string): ControlValue {
  if (!Object.hasOwn(params, key)) return "";
  const value = (params as Record<string, unknown>)[key];
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  return "";
}

function formatSlider(value: number, step: number, min: number): string {
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  const text = value.toFixed(decimals);
  if (min < 0 && value > 0) return `+${text}`;
  return text;
}
