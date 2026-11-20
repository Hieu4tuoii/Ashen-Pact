const fallbackTextByObj = new WeakMap<object, string>();
const fallbackColorByObj = new WeakMap<object, string>();

function readCurrentText(txt: { text?: string }): string | undefined {
  if (typeof txt.text === 'string') {
    return txt.text;
  }
  return fallbackTextByObj.get(txt);
}

function syncPlainMockTextIfNeeded(txt: { text?: string }, nextText: string): void {
  if (txt.text !== nextText) {
    const desc = Object.getOwnPropertyDescriptor(txt, 'text');
    if (desc?.writable) {
      txt.text = nextText;
    }
  }
  fallbackTextByObj.set(txt, nextText);
}

type PhaserStyleColor = string | CanvasGradient | CanvasPattern;

type AnyStyleHolder =
  | { style?: { color?: string } }
  | { style?: { color?: PhaserStyleColor } };

function readCurrentColor(txt: AnyStyleHolder): string | undefined {
  if (txt.style && typeof txt.style.color === 'string') {
    return txt.style.color;
  }
  return fallbackColorByObj.get(txt);
}

function tryMutateStyleColor(txt: AnyStyleHolder, nextColor: string): boolean {
  if (!txt.style || typeof txt.style !== 'object') {
    return false;
  }
  try {
    txt.style.color = nextColor;
    return txt.style.color === nextColor;
  } catch {
    return false;
  }
}

/**
 * Updates a Phaser Text object's string only when it actually changed, avoiding redundant
 * Canvas2D re-rasterization and WebGL `texImage2D` uploads.
 */
export function setTextIfChanged(
  txt: { text?: string; setText: (v: string) => unknown } | null | undefined,
  nextText: string,
): boolean {
  if (!txt) return false;
  if (readCurrentText(txt) === nextText) return false;
  txt.setText(nextText);
  syncPlainMockTextIfNeeded(txt, nextText);
  return true;
}

/**
 * Updates a Phaser Text object's fill color only when it actually changed.
 * Note: Phaser 3's `Text.setColor()` has no built-in equality guard and unconditionally
 * invokes `updateText()` + `gl.texImage2D`.
 */
export function setColorIfChanged(
  txt:
    | ({ setColor?: (c: string) => unknown } & AnyStyleHolder)
    | null
    | undefined,
  nextColor: string,
): boolean {
  if (!txt) return false;
  if (readCurrentColor(txt) === nextColor) return false;
  txt.setColor?.(nextColor);
  if (txt.style && txt.style.color !== nextColor) {
    tryMutateStyleColor(txt, nextColor);
  }
  fallbackColorByObj.set(txt, nextColor);
  return true;
}

/**
 * Updates both `text` and `color` on a Phaser Text object with at most a single rasterization
 * pass (`gl.texImage2D` upload):
 * - Neither changed -> 0 uploads (`false`).
 * - Only color changed -> `setColor(nextColor)` once (`true`).
 * - Only text changed -> `setText(nextText)` once (`true`).
 * - Both changed -> mutates `txt.style.color = nextColor` prior to `txt.setText(nextText)` so
 *   `updateText()` runs once instead of twice (falling back to `setText` + `setColor` on minimal
 *   test mocks without `.style`).
 */
export function setTextAndColorIfChanged(
  txt:
    | ({
        text?: string;
        setText: (v: string) => unknown;
        setColor?: (c: string) => unknown;
      } & AnyStyleHolder)
    | null
    | undefined,
  nextText: string,
  nextColor: string,
): boolean {
  if (!txt) return false;
  const textChanged = readCurrentText(txt) !== nextText;
  const colorChanged = readCurrentColor(txt) !== nextColor;
  if (!textChanged && !colorChanged) {
    return false;
  }
  if (!textChanged) {
    return setColorIfChanged(txt, nextColor);
  }
  if (!colorChanged) {
    return setTextIfChanged(txt, nextText);
  }

  const styleApplied = tryMutateStyleColor(txt, nextColor);
  txt.setText(nextText);
  syncPlainMockTextIfNeeded(txt, nextText);
  if (!styleApplied) {
    txt.setColor?.(nextColor);
  }
  fallbackColorByObj.set(txt, nextColor);
  return true;
}
