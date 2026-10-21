import { WORLD_VIEW_HEIGHT, WORLD_VIEW_WIDTH } from '@ashen-pact/shared';
import type Phaser from 'phaser';

export type MenuInputFieldId = 'name' | 'ip';

export const MENU_NAME_MAX_LEN = 18;
export const MENU_IP_MAX_LEN = 28;

export interface MenuInputBoxBounds {
  /** Center X in 960x540 design space */
  cx: number;
  /** Center Y in 960x540 design space */
  cy: number;
  /** Width in 960x540 design space */
  w: number;
  /** Height in 960x540 design space */
  h: number;
}

export const MENU_INPUT_BOUNDS: Record<MenuInputFieldId, MenuInputBoxBounds> = {
  name: { cx: 350, cy: 176, w: 232, h: 32 },
  ip: { cx: 610, cy: 176, w: 232, h: 32 },
};

export type MenuInputEditAction =
  | { kind: 'insert'; text: string }
  | { kind: 'paste'; text: string }
  | { kind: 'backspace' }
  | { kind: 'delete' };

/**
 * Sanitizes pasted or typed text for Menu Name / IP fields.
 * Strips control characters and line breaks, and trims IP whitespace.
 */
export function sanitizeMenuInputText(
  raw: string,
  field: MenuInputFieldId,
  maxLength = field === 'name' ? MENU_NAME_MAX_LEN : MENU_IP_MAX_LEN,
): string {
  const cleaned = Array.from(raw)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');
  const normalized = field === 'ip' ? cleaned.replace(/\s+/g, '') : cleaned;
  return Array.from(normalized).slice(0, Math.max(0, maxLength)).join('');
}

/**
 * Pure helper that applies character insertion, clipboard paste, Backspace, or Delete
 * with full selection range support (`selectionStart` .. `selectionEnd`).
 */
export function applyMenuInputEdit(
  currentValue: string,
  selectionStart: number,
  selectionEnd: number,
  action: MenuInputEditAction,
  field: MenuInputFieldId,
  maxLength = field === 'name' ? MENU_NAME_MAX_LEN : MENU_IP_MAX_LEN,
): { value: string; caret: number } {
  const chars = Array.from(currentValue);
  const len = chars.length;
  const start = Math.max(0, Math.min(len, Math.min(selectionStart, selectionEnd)));
  const end = Math.max(0, Math.min(len, Math.max(selectionStart, selectionEnd)));
  const hasSelection = end > start;

  if (action.kind === 'backspace') {
    if (hasSelection) {
      const nextChars = [...chars.slice(0, start), ...chars.slice(end)];
      return { value: nextChars.join(''), caret: start };
    }
    if (start <= 0) {
      return { value: currentValue, caret: 0 };
    }
    const nextChars = [...chars.slice(0, start - 1), ...chars.slice(start)];
    return { value: nextChars.join(''), caret: start - 1 };
  }

  if (action.kind === 'delete') {
    if (hasSelection) {
      const nextChars = [...chars.slice(0, start), ...chars.slice(end)];
      return { value: nextChars.join(''), caret: start };
    }
    if (start >= len) {
      return { value: currentValue, caret: len };
    }
    const nextChars = [...chars.slice(0, start), ...chars.slice(start + 1)];
    return { value: nextChars.join(''), caret: start };
  }

  const rawInsert = sanitizeMenuInputText(action.text, field, maxLength);
  const insertChars = Array.from(rawInsert);
  const remainingBudget = Math.max(0, maxLength - (len - (end - start)));
  const allowedInsert = insertChars.slice(0, remainingBudget);
  const nextChars = [...chars.slice(0, start), ...allowedInsert, ...chars.slice(end)];
  const nextCaret = start + allowedInsert.length;
  return {
    value: nextChars.join(''),
    caret: nextCaret,
  };
}

export interface MenuDomInputCallbacks {
  onFocusChange: (field: MenuInputFieldId | null) => void;
  onValueChange: (field: MenuInputFieldId, value: string) => void;
}

/**
 * Mounts two real HTML `<input type="text">` elements over the Phaser canvas
 * for the Menu Name and LAN IP boxes so players get native text selection,
 * `Ctrl+V` / clipboard paste, `Backspace` / `Delete`, and mobile/desktop IME support
 * while preserving the custom Phaser vector card visuals underneath.
 */
export class MenuDomInputOverlay {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: MenuDomInputCallbacks;
  private wrapperEl: HTMLDivElement | null = null;
  private inputs: Record<MenuInputFieldId, HTMLInputElement> | null = null;
  private activeField: MenuInputFieldId | null = null;
  private modalBlocked = false;
  private readonly boundReposition: () => void;
  private readonly boundWindowPaste: (ev: ClipboardEvent) => void;

  constructor(
    scene: Phaser.Scene,
    initialName: string,
    initialIp: string,
    callbacks: MenuDomInputCallbacks,
  ) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.boundReposition = () => this.reposition();
    this.boundWindowPaste = (ev: ClipboardEvent) => this.handleWindowPaste(ev);
    this.mount(initialName, initialIp);
  }

  private mount(initialName: string, initialIp: string): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const canvas = this.scene.game?.canvas;
    const parent = canvas?.parentElement ?? document.body;
    if (!parent) return;

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-testid', 'menu-dom-inputs-wrapper');
    Object.assign(wrapper.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      width: '0px',
      height: '0px',
      overflow: 'visible',
      zIndex: '20',
      pointerEvents: 'none',
    });

    const createField = (
      field: MenuInputFieldId,
      initialVal: string,
      maxLength: number,
    ): HTMLInputElement => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = initialVal;
      input.maxLength = maxLength;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.setAttribute('data-testid', field === 'name' ? 'menu-name-input' : 'menu-ip-input');
      input.setAttribute('aria-label', field === 'name' ? 'Player Name' : 'Server LAN IP');
      Object.assign(input.style, {
        position: 'fixed',
        background: 'transparent',
        color: 'transparent',
        caretColor: 'transparent',
        border: 'none',
        outline: 'none',
        padding: '0 8px',
        margin: '0',
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontWeight: '700',
        pointerEvents: 'auto',
        cursor: 'text',
        userSelect: 'text',
      });

      let wasFocusedBeforePointerDown = false;
      input.addEventListener('pointerdown', () => {
        wasFocusedBeforePointerDown = document.activeElement === input;
      });

      input.addEventListener('focus', () => {
        if (this.modalBlocked) {
          input.blur();
          return;
        }
        const prevField = this.activeField;
        this.activeField = field;
        if (prevField !== field) {
          const endPos = input.value.length;
          try {
            input.setSelectionRange(endPos, endPos);
          } catch {
            // Ignore selection range errors
          }
        }
        this.callbacks.onFocusChange(field);
      });

      input.addEventListener('click', () => {
        if (!wasFocusedBeforePointerDown) {
          const endPos = input.value.length;
          try {
            input.setSelectionRange(endPos, endPos);
          } catch {
            // Ignore selection range errors
          }
          wasFocusedBeforePointerDown = true;
        }
      });

      input.addEventListener('blur', () => {
        if (this.activeField === field) {
          this.activeField = null;
          this.callbacks.onFocusChange(null);
        }
      });

      input.addEventListener('input', () => {
        const sanitized = sanitizeMenuInputText(input.value, field, maxLength);
        if (input.value !== sanitized) {
          input.value = sanitized;
        }
        this.callbacks.onValueChange(field, sanitized);
      });

      input.addEventListener('paste', (ev: ClipboardEvent) => {
        const pasted = ev.clipboardData?.getData('text/plain') ?? '';
        if (!pasted) return;
        ev.preventDefault();
        ev.stopPropagation();
        const selStart = input.selectionStart ?? input.value.length;
        const selEnd = input.selectionEnd ?? input.value.length;
        const next = applyMenuInputEdit(
          input.value,
          selStart,
          selEnd,
          { kind: 'paste', text: pasted },
          field,
          maxLength,
        );
        input.value = next.value;
        try {
          input.setSelectionRange(next.caret, next.caret);
        } catch {
          // Ignore selection errors
        }
        this.callbacks.onValueChange(field, next.value);
      });

      input.addEventListener('keydown', (ev: KeyboardEvent) => {
        if (ev.key === 'Escape' || ev.key === 'Enter') {
          ev.preventDefault();
          ev.stopPropagation();
          input.blur();
          if (this.activeField !== null) {
            this.activeField = null;
            this.callbacks.onFocusChange(null);
          }
          return;
        }
        // Stop single-letter hotkeys (O, K, C, L) from bubbling to MenuScene window keydown while typing
        ev.stopPropagation();
      });

      wrapper.appendChild(input);
      return input;
    };

    const nameInput = createField('name', initialName, MENU_NAME_MAX_LEN);
    const ipInput = createField('ip', initialIp, MENU_IP_MAX_LEN);
    parent.appendChild(wrapper);

    this.wrapperEl = wrapper;
    this.inputs = { name: nameInput, ip: ipInput };
    this.reposition();

    window.addEventListener('resize', this.boundReposition);
    window.addEventListener('paste', this.boundWindowPaste);
  }

  private handleWindowPaste(ev: ClipboardEvent): void {
    if (this.modalBlocked || !this.activeField || !this.inputs) return;
    const input = this.inputs[this.activeField];
    if (document.activeElement === input) return; // Handled by input's own paste listener
    const pasted = ev.clipboardData?.getData('text/plain') ?? '';
    if (!pasted) return;
    ev.preventDefault();
    const maxLength = this.activeField === 'name' ? MENU_NAME_MAX_LEN : MENU_IP_MAX_LEN;
    const next = applyMenuInputEdit(
      input.value,
      input.value.length,
      input.value.length,
      { kind: 'paste', text: pasted },
      this.activeField,
      maxLength,
    );
    input.value = next.value;
    this.callbacks.onValueChange(this.activeField, next.value);
  }

  public reposition(): void {
    if (!this.inputs) return;
    const canvas = this.scene.game?.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const scaleX = rect.width / WORLD_VIEW_WIDTH;
    const scaleY = rect.height / WORLD_VIEW_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    const viewW = WORLD_VIEW_WIDTH * scale;
    const viewH = WORLD_VIEW_HEIGHT * scale;
    const offsetX = rect.left + (rect.width - viewW) * 0.5;
    const offsetY = rect.top + (rect.height - viewH) * 0.5;

    for (const field of ['name', 'ip'] as const) {
      const bounds = MENU_INPUT_BOUNDS[field];
      const input = this.inputs[field];
      // Leave 28px on the right of the name box for the preset-name cycle button (↻)
      const hitW = field === 'name' ? bounds.w - 28 : bounds.w;
      const leftInWorld = bounds.cx - bounds.w * 0.5;
      const topInWorld = bounds.cy - bounds.h * 0.5;

      const leftPx = offsetX + leftInWorld * scale;
      const topPx = offsetY + topInWorld * scale;
      const widthPx = hitW * scale;
      const heightPx = bounds.h * scale;

      input.style.left = `${Math.round(leftPx)}px`;
      input.style.top = `${Math.round(topPx)}px`;
      input.style.width = `${Math.round(widthPx)}px`;
      input.style.height = `${Math.round(heightPx)}px`;
      input.style.fontSize = `${Math.max(11, Math.round(12 * scale))}px`;
    }
  }

  public syncValues(name: string, ip: string): void {
    if (!this.inputs) return;
    if (this.inputs.name.value !== name) {
      this.inputs.name.value = name;
    }
    if (this.inputs.ip.value !== ip) {
      this.inputs.ip.value = ip;
    }
  }

  public focusField(field: MenuInputFieldId | null): void {
    this.activeField = field;
    if (!this.inputs) return;
    if (field === null) {
      this.inputs.name.blur();
      this.inputs.ip.blur();
      return;
    }
    const target = this.inputs[field];
    target.focus();
    const len = target.value.length;
    try {
      target.setSelectionRange(len, len);
    } catch {
      // Ignore selection range errors
    }
  }

  public setModalBlocked(blocked: boolean): void {
    this.modalBlocked = blocked;
    if (!this.inputs || !this.wrapperEl) return;
    if (blocked) {
      this.inputs.name.blur();
      this.inputs.ip.blur();
      this.inputs.name.style.pointerEvents = 'none';
      this.inputs.ip.style.pointerEvents = 'none';
      this.wrapperEl.style.display = 'none';
    } else {
      this.wrapperEl.style.display = 'block';
      this.inputs.name.style.pointerEvents = 'auto';
      this.inputs.ip.style.pointerEvents = 'auto';
      this.reposition();
    }
  }

  public destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.boundReposition);
      window.removeEventListener('paste', this.boundWindowPaste);
    }
    if (this.wrapperEl?.parentElement) {
      this.wrapperEl.parentElement.removeChild(this.wrapperEl);
    }
    this.wrapperEl = null;
    this.inputs = null;
    this.activeField = null;
  }
}
