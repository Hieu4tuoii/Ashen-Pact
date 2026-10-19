import type {
  BuffId,
  CharacterId,
  ElementalReactionId,
  ElementType,
  RoomType,
  WeaponRarity,
} from '../data/types.js';
import type { QuickEmoteId } from '../protocol/messages.js';
import enDict from './en.json' with { type: 'json' };
import viDict from './vi.json' with { type: 'json' };

export type SupportedLocale = 'vi' | 'en';

export type LocaleDictionary = typeof viDict;

export { enDict as enLocale, viDict as viLocale };

export const LOCALE_DICTIONARIES: Record<SupportedLocale, LocaleDictionary> = {
  vi: viDict,
  en: enDict,
};

const LOCALE_STORAGE_KEY = 'ashen_pact_locale';

function resolvePath(obj: unknown, path: string): string | undefined {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (let i = 0; i < parts.length; i++) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[parts[i]!];
  }
  if (typeof cur === 'string') return cur;
  if (
    cur !== null &&
    typeof cur === 'object' &&
    typeof (cur as { name?: unknown }).name === 'string'
  ) {
    return (cur as { name: string }).name;
  }
  return undefined;
}

export function collectLeafKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const nextKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') {
      out.push(nextKey);
    } else if (v !== null && typeof v === 'object') {
      out.push(...collectLeafKeys(v, nextKey));
    }
  }
  return out;
}

export class I18nManager {
  private locale: SupportedLocale = 'vi';
  private readonly listeners = new Set<(locale: SupportedLocale) => void>();

  constructor(initialLocale?: SupportedLocale) {
    if (initialLocale) {
      this.locale = initialLocale;
    } else {
      this.loadFromStorage();
    }
  }

  public getLocale(): SupportedLocale {
    return this.locale;
  }

  public setLocale(next: SupportedLocale): void {
    if (next !== 'vi' && next !== 'en') return;
    if (this.locale === next) return;
    this.locale = next;
    this.saveToStorage();
    for (const cb of this.listeners) {
      cb(this.locale);
    }
  }

  public toggleLocale(): SupportedLocale {
    const next: SupportedLocale = this.locale === 'vi' ? 'en' : 'vi';
    this.setLocale(next);
    return next;
  }

  public onChange(cb: (locale: SupportedLocale) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /**
   * Translates a dot-separated key (e.g. 'ui.menu.playSolo' or 'menu.playSolo') in the active locale,
   * falling back to Vietnamese if needed, and interpolating `{param}` placeholders.
   */
  public t(key: string, params?: Record<string, string | number>): string {
    const dict = LOCALE_DICTIONARIES[this.locale] ?? viDict;
    let raw =
      resolvePath(dict, key) ??
      resolvePath(dict, `ui.${key}`) ??
      resolvePath(viDict, key) ??
      resolvePath(viDict, `ui.${key}`) ??
      key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        raw = raw.replaceAll(`{${k}}`, String(v));
      }
    }
    return raw;
  }

  public hasKey(key: string, locale: SupportedLocale = this.locale): boolean {
    const dict = LOCALE_DICTIONARIES[locale];
    return (
      typeof resolvePath(dict, key) === 'string' ||
      typeof resolvePath(dict, `ui.${key}`) === 'string'
    );
  }

  public charName(id: CharacterId, fallback = ''): string {
    const val = this.t(`characters.${id}.name`);
    return val === `characters.${id}.name` ? fallback || id : val;
  }

  public weaponName(weaponId: string, fallback = ''): string {
    const val = this.t(`weapons.${weaponId}.name`);
    return val === `weapons.${weaponId}.name` ? fallback || weaponId : val;
  }

  public biomeName(biome: 1 | 2 | 3): string {
    return this.getBiomeName(biome);
  }

  public getCharacterText(id: CharacterId): {
    name: string;
    title: string;
    passiveName: string;
    passiveDesc: string;
    skillName: string;
    skillDesc: string;
    synergy: string;
  } {
    return {
      name: this.t(`characters.${id}.name`),
      title: this.t(`characters.${id}.title`),
      passiveName: this.t(`characters.${id}.passiveName`),
      passiveDesc: this.t(`characters.${id}.passiveDesc`),
      skillName: this.t(`characters.${id}.skillName`),
      skillDesc: this.t(`characters.${id}.skillDesc`),
      synergy: this.t(`characters.${id}.synergy`),
    };
  }

  public getWeaponText(weaponId: string): { name: string; desc: string } {
    return {
      name: this.t(`weapons.${weaponId}.name`),
      desc: this.t(`weapons.${weaponId}.desc`),
    };
  }

  public getBuffText(
    buffId: BuffId | string,
    fallbackName = '',
    fallbackDesc = '',
  ): { name: string; desc: string } {
    const nameKey = `buffs.${buffId}.name`;
    const descKey = `buffs.${buffId}.desc`;
    const nameVal = this.t(nameKey);
    const descVal = this.t(descKey);
    return {
      name: nameVal === nameKey ? fallbackName || String(buffId) : nameVal,
      desc: descVal === descKey ? fallbackDesc : descVal,
    };
  }

  public getEnemyText(enemyId: string): { name: string; subtitle: string } {
    return {
      name: this.t(`enemies.${enemyId}.name`),
      subtitle: this.t(`enemies.${enemyId}.subtitle`),
    };
  }

  public enemyName(enemyId: string, fallback = ''): string {
    const key = `enemies.${enemyId}.name`;
    const val = this.t(key);
    return val === key ? fallback || enemyId : val;
  }

  public getReactionText(reactionId: ElementalReactionId): {
    name: string;
    combo: string;
    effect: string;
  } {
    return {
      name: this.t(`reactions.${reactionId}.name`),
      combo: this.t(`reactions.${reactionId}.combo`),
      effect: this.t(`reactions.${reactionId}.effect`),
    };
  }

  public getBiomeName(biome: 1 | 2 | 3): string {
    return this.t(`biomes.${biome}`);
  }

  public getRoomTypeName(roomType: RoomType): string {
    return this.t(`rooms.${roomType}`);
  }

  public roomTypeName(roomType: RoomType): string {
    return this.getRoomTypeName(roomType);
  }

  public roomTypeLabel(roomType: RoomType | 'hub'): string {
    return roomType === 'hub' ? this.t('ui.hub.roomType') : this.getRoomTypeName(roomType);
  }

  public getElementLabel(el: ElementType, short = false): string {
    return short ? this.t(`elements.short.${el}`) : this.t(`elements.${el}`);
  }

  public elementName(el: ElementType): string {
    return this.getElementLabel(el, false);
  }

  public elementShortName(el: ElementType): string {
    return this.getElementLabel(el, true);
  }

  public getRarityLabel(rarity: WeaponRarity): string {
    return this.t(`rarities.${rarity}`);
  }

  public getEmoteLabel(id: QuickEmoteId): string {
    return this.t(`emotes.${id}`);
  }

  public emoteText(id: QuickEmoteId): string {
    return this.getEmoteLabel(id);
  }

  private loadFromStorage(): void {
    try {
      const g = globalThis as unknown as {
        window?: { localStorage?: Storage; location?: { search?: string } };
      };
      const search = g.window?.location?.search;
      if (search) {
        const params = new URLSearchParams(search);
        const langParam = params.get('lang')?.toLowerCase();
        if (langParam === 'en' || langParam === 'vi') {
          this.locale = langParam;
          return;
        }
      }
      const saved = g.window?.localStorage?.getItem(LOCALE_STORAGE_KEY);
      if (saved === 'en' || saved === 'vi') {
        this.locale = saved;
      }
    } catch {
      // Ignore storage access errors in headless/Node contexts
    }
  }

  private saveToStorage(): void {
    try {
      const g = globalThis as unknown as {
        window?: { localStorage?: Storage };
      };
      g.window?.localStorage?.setItem(LOCALE_STORAGE_KEY, this.locale);
    } catch {
      // Ignore storage errors
    }
  }
}

export const i18n = new I18nManager();
