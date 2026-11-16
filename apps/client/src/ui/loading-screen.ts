import { clamp, type SupportedLocale } from '@ashen-pact/shared';
import { PALETTE } from '../art/palette.js';

export type LoadingStageId =
  | 'boot'
  | 'fonts'
  | 'audio'
  | 'rigs'
  | 'world'
  | 'shaders'
  | 'ready';

export const LOADING_STAGE_ORDER: readonly LoadingStageId[] = [
  'boot',
  'fonts',
  'audio',
  'rigs',
  'world',
  'shaders',
  'ready',
] as const;

export interface LoadingStageCopy {
  id: LoadingStageId;
  targetProgress: number;
  stepIndex: number;
  label: string;
  detail: string;
}

export interface LoadingHeroCrestSpec {
  id: 'vanguard' | 'ranger' | 'elementalist' | 'druid' | 'engineer';
  nameVi: string;
  nameEn: string;
  roleVi: string;
  roleEn: string;
  accentHex: string;
  unlockProgress: number;
}

export interface LoadingTipEntry {
  id: string;
  title: string;
  body: string;
}

export const LOADING_HERO_CRESTS: readonly LoadingHeroCrestSpec[] = [
  {
    id: 'vanguard',
    nameVi: 'Thiết Vệ',
    nameEn: 'Vanguard',
    roleVi: 'Khiên Chắn · Cận Chiến',
    roleEn: 'Bulwark · Melee',
    accentHex: PALETTE.CRIMSON_BRIGHT,
    unlockProgress: 0,
  },
  {
    id: 'ranger',
    nameVi: 'Liệp Ưng',
    nameEn: 'Ranger',
    roleVi: 'Xạ Thủ · Cơ Động',
    roleEn: 'Marksman · Agile',
    accentHex: PALETTE.P3_RING,
    unlockProgress: 26,
  },
  {
    id: 'elementalist',
    nameVi: 'Pháp Sư',
    nameEn: 'Elementalist',
    roleVi: 'Nguyên Tố · Diện Rộng',
    roleEn: 'Arcane · Area Control',
    accentHex: PALETTE.P1_RING,
    unlockProgress: 50,
  },
  {
    id: 'druid',
    nameVi: 'Mộc Linh',
    nameEn: 'Druid',
    roleVi: 'Sinh Mệnh · Độc Thực',
    roleEn: 'Verdant · Bio-Venom',
    accentHex: PALETTE.LIME_GLOW,
    unlockProgress: 70,
  },
  {
    id: 'engineer',
    nameVi: 'Kỹ Sư',
    nameEn: 'Engineer',
    roleVi: 'Pháo Đài · Quang Học',
    roleEn: 'Turret · Ordnance',
    accentHex: PALETTE.P4_RING,
    unlockProgress: 88,
  },
] as const;

const STAGE_COPY_VI: Record<LoadingStageId, LoadingStageCopy> = {
  boot: {
    id: 'boot',
    targetProgress: 14,
    stepIndex: 0,
    label: 'Khởi tạo hệ thống...',
    detail: 'Thiết lập khung hình WebGL 60 FPS',
  },
  fonts: {
    id: 'fonts',
    targetProgress: 30,
    stepIndex: 1,
    label: 'Đồng bộ phông chữ giao diện...',
    detail: 'Nạp bộ ký tự Be Vietnam Pro',
  },
  audio: {
    id: 'audio',
    targetProgress: 46,
    stepIndex: 1,
    label: 'Khởi tạo âm thanh & hiệu ứng...',
    detail: 'Chuẩn bị âm thanh vũ khí & môi trường',
  },
  rigs: {
    id: 'rigs',
    targetProgress: 66,
    stepIndex: 2,
    label: 'Khởi tạo nhân vật & kho vũ khí...',
    detail: 'Kết xuất 5 lớp anh hùng & trang bị Vector',
  },
  world: {
    id: 'world',
    targetProgress: 84,
    stepIndex: 3,
    label: 'Kiến tạo Đại Sảnh & 3 quân khu...',
    detail: 'Dựng cấu trúc địa hình & cổng dịch chuyển',
  },
  shaders: {
    id: 'shaders',
    targetProgress: 96,
    stepIndex: 4,
    label: 'Tổng hợp ánh sáng & hiệu ứng...',
    detail: 'Chuẩn bị bản đồ sáng động & hạt nguyên tố',
  },
  ready: {
    id: 'ready',
    targetProgress: 100,
    stepIndex: 4,
    label: 'Hoàn tất khởi tạo',
    detail: 'Sẵn sàng tiến vào Đại Sảnh Tro Tàn',
  },
};

const STAGE_COPY_EN: Record<LoadingStageId, LoadingStageCopy> = {
  boot: {
    id: 'boot',
    targetProgress: 14,
    stepIndex: 0,
    label: 'Initializing system...',
    detail: 'Configuring 60 FPS WebGL canvas',
  },
  fonts: {
    id: 'fonts',
    targetProgress: 30,
    stepIndex: 1,
    label: 'Synchronizing typography...',
    detail: 'Loading Be Vietnam Pro font subsets',
  },
  audio: {
    id: 'audio',
    targetProgress: 46,
    stepIndex: 1,
    label: 'Preparing spatial audio...',
    detail: 'Loading combat acoustics & ambient synth',
  },
  rigs: {
    id: 'rigs',
    targetProgress: 66,
    stepIndex: 2,
    label: 'Preparing characters & arsenal...',
    detail: 'Baking 5 hero classes & vector weapons',
  },
  world: {
    id: 'world',
    targetProgress: 84,
    stepIndex: 3,
    label: 'Building Sanctuary & 3 biomes...',
    detail: 'Generating tilesets, props & portals',
  },
  shaders: {
    id: 'shaders',
    targetProgress: 96,
    stepIndex: 4,
    label: 'Compiling lighting & VFX...',
    detail: 'Preparing dynamic lightmaps & particles',
  },
  ready: {
    id: 'ready',
    targetProgress: 100,
    stepIndex: 4,
    label: 'Initialization complete',
    detail: 'Ready to enter the Ashen Sanctuary',
  },
};

const TIPS_VI: readonly LoadingTipEntry[] = [
  {
    id: 'elemental_reactions',
    title: 'MẸO CHIẾN THUẬT · PHẢN ỨNG NGUYÊN TỐ',
    body: 'Kết hợp 2 nguyên tố (Lửa + Dầu, Băng + Sét, Độc + Lửa) trên cùng mục tiêu hoặc mặt sàn để kích hoạt vụ nổ nguyên tố diện rộng.',
  },
  {
    id: 'dash_iframes',
    title: 'MẸO CHIẾN THUẬT · LƯỚT XUYÊN ĐẠN',
    body: 'Nhấn [Space] hoặc [Shift] để Lướt (Dash) qua làn đạn đỏ của địch. Khoảnh khắc bất tử ngắn giúp bạn thoát vây và phản công tức thì.',
  },
  {
    id: 'tactical_cover',
    title: 'MẸO CHIẾN THUẬT · ĐỊA HÌNH & VẬT CHẮN',
    body: 'Nhấn [E] gần bàn đá hoặc khiên chắn để lật thành công sự che đạn, hoặc bắn vỡ trụ pha lê và thùng nổ để gây choáng hàng loạt.',
  },
  {
    id: 'daedalus_forge',
    title: 'BÍ QUYẾT HẦM NGỤC · ĐE RÈN DAEDALUS',
    body: 'Phân rã vũ khí không dùng để thu thập Mảnh Phế Liệu, sau đó cường hóa đột biến vũ khí tại Đe Rèn Daedalus giữa các tầng.',
  },
  {
    id: 'coop_synergy',
    title: 'HIỆP ƯỚC ĐỒNG ĐỘI · CO-OP 1–4 NGƯỜI',
    body: 'Tại Đại Sảnh Tro Tàn, nhấn [I] hoặc ghé Bàn Hội Co-op để mở phòng LAN / P2P tức thì. Phối hợp kỹ năng giữa 5 lớp nhân vật để nhân bội DPS!',
  },
  {
    id: 'boss_armor_break',
    title: 'MẸO ĐẤU TRÙM · PHÁ LÕI QUÁ TẢI',
    body: 'Khi Boss dựng lồng bất tử, hãy tập trung hỏa lực phá hủy 2 Lõi Năng Lượng trước khi hết giờ để đánh sập giáp và nhận x1.5 sát thương!',
  },
] as const;

const TIPS_EN: readonly LoadingTipEntry[] = [
  {
    id: 'elemental_reactions',
    title: 'TACTICAL TIP · ELEMENTAL REACTIONS',
    body: 'Combine two elements (Fire + Oil, Ice + Lightning, Venom + Fire) on targets or floor hazards to trigger devastating chain reactions.',
  },
  {
    id: 'dash_iframes',
    title: 'TACTICAL TIP · EVASIVE DASH',
    body: 'Press [Space] or [Shift] to Dash through enemy bullet patterns. Brief invulnerability frames let you reposition safely under heavy fire.',
  },
  {
    id: 'tactical_cover',
    title: 'TACTICAL TIP · INTERACTIVE COVER',
    body: 'Press [E] near stone tables or blast shields to flip cover against enemy volleys, or detonate volatile spore pods and slag crucibles.',
  },
  {
    id: 'daedalus_forge',
    title: 'DUNGEON LORE · DAEDALUS ANVIL',
    body: 'Salvage spare weapons into Scrap Shards and reforge your primary arsenal with powerful Daedalus Mutators between dungeon floors.',
  },
  {
    id: 'coop_synergy',
    title: 'ASHEN PACT · 1–4 PLAYER CO-OP',
    body: 'In the Sanctuary Hall, press [I] or visit the Co-op Guild Table to host or join LAN / WebRTC P2P runs and chain 4-player elemental combos.',
  },
  {
    id: 'boss_armor_break',
    title: 'BOSS TACTICS · CORE OVERLOAD',
    body: 'When a Boss erects its invulnerability cage, shatter both Energy Cores within the countdown window to stun the Boss for 1.5× damage!',
  },
] as const;

export function resolveInitialLoadingLocale(
  search = typeof window !== 'undefined' && window.location ? window.location.search : '',
  savedSettingsJson: string | null = null,
): SupportedLocale {
  if (search) {
    try {
      const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
      const langParam = params.get('lang')?.trim().toLowerCase();
      if (langParam === 'en') return 'en';
      if (langParam === 'vi') return 'vi';
    } catch {
      // Ignore malformed URL query
    }
  }
  const rawJson =
    savedSettingsJson ??
    (() => {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      try {
        return window.localStorage.getItem('ashen_pact_graphics_settings');
      } catch {
        return null;
      }
    })();

  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as { language?: string };
      if (parsed.language === 'en') return 'en';
      if (parsed.language === 'vi') return 'vi';
    } catch {
      // Ignore malformed storage JSON
    }
  }
  return 'vi';
}

export function getLoadingStageCopy(
  stage: LoadingStageId,
  locale: SupportedLocale = 'vi',
): LoadingStageCopy {
  const table = locale === 'en' ? STAGE_COPY_EN : STAGE_COPY_VI;
  return table[stage] ?? table.boot;
}

export function getLoadingTips(locale: SupportedLocale = 'vi'): readonly LoadingTipEntry[] {
  return locale === 'en' ? TIPS_EN : TIPS_VI;
}

export function computeActiveHeroCount(progressPercent: number): number {
  const p = clamp(Number.isFinite(progressPercent) ? progressPercent : 0, 0, 100);
  let count = 0;
  for (const crest of LOADING_HERO_CRESTS) {
    if (p >= crest.unlockProgress) {
      count += 1;
    }
  }
  return Math.max(1, count);
}

export interface LoadingScreenState {
  locale: SupportedLocale;
  stage: LoadingStageId;
  progress: number;
  tipIndex: number;
  activeHeroCount: number;
  completed: boolean;
  hidden: boolean;
}

export interface LoadingScreenControllerOptions {
  locale?: SupportedLocale;
  initialTipIndex?: number;
}

export class LoadingScreenController {
  private state: LoadingScreenState;
  private hideTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private tipIntervalId: ReturnType<typeof setInterval> | null = null;
  private boundTipClickHandler: (() => void) | null = null;

  constructor(options?: LoadingScreenControllerOptions) {
    const locale = options?.locale ?? resolveInitialLoadingLocale();
    const tips = getLoadingTips(locale);
    const initialTipIndex =
      options?.initialTipIndex !== undefined
        ? ((options.initialTipIndex % tips.length) + tips.length) % tips.length
        : 0;
    const bootCopy = getLoadingStageCopy('boot', locale);

    this.state = {
      locale,
      stage: 'boot',
      progress: bootCopy.targetProgress,
      tipIndex: initialTipIndex,
      activeHeroCount: computeActiveHeroCount(bootCopy.targetProgress),
      completed: false,
      hidden: false,
    };

    this.bindDomInteractions();
    this.syncDom();
  }

  public getState(): Readonly<LoadingScreenState> {
    return this.state;
  }

  public setLocale(locale: SupportedLocale): void {
    if (this.state.locale === locale) return;
    this.state = {
      ...this.state,
      locale,
    };
    this.syncDom();
  }

  public setStage(stage: LoadingStageId, customProgress?: number): void {
    if (this.state.completed) return;
    const copy = getLoadingStageCopy(stage, this.state.locale);
    const nextProgress = Math.max(
      this.state.progress,
      clamp(Math.round(customProgress ?? copy.targetProgress), 0, 100),
    );
    this.state = {
      ...this.state,
      stage,
      progress: nextProgress,
      activeHeroCount: computeActiveHeroCount(nextProgress),
    };
    this.syncDom();
  }

  public setProgress(progressPercent: number): void {
    if (this.state.completed) return;
    const clamped = clamp(Math.round(progressPercent), 0, 100);
    const nextProgress = Math.max(this.state.progress, clamped);
    this.state = {
      ...this.state,
      progress: nextProgress,
      activeHeroCount: computeActiveHeroCount(nextProgress),
    };
    this.syncDom();
  }

  public getCurrentTip(): LoadingTipEntry {
    const tips = getLoadingTips(this.state.locale);
    return tips[this.state.tipIndex % tips.length] ?? tips[0]!;
  }

  public nextTip(): LoadingTipEntry {
    const tips = getLoadingTips(this.state.locale);
    this.state = {
      ...this.state,
      tipIndex: (this.state.tipIndex + 1) % tips.length,
    };
    this.syncDom();
    return this.getCurrentTip();
  }

  public complete(immediate = false): void {
    if (this.tipIntervalId !== null) {
      clearInterval(this.tipIntervalId);
      this.tipIntervalId = null;
    }
    if (this.hideTimeoutId !== null) {
      clearTimeout(this.hideTimeoutId);
      this.hideTimeoutId = null;
    }

    this.state = {
      ...this.state,
      stage: 'ready',
      progress: 100,
      activeHeroCount: LOADING_HERO_CRESTS.length,
      completed: true,
      hidden: immediate ? true : this.state.hidden,
    };
    this.syncDom();

    if (typeof document === 'undefined') {
      this.state = { ...this.state, hidden: true };
      return;
    }

    const root = document.getElementById('ashen-loading-screen');
    if (!root) {
      this.state = { ...this.state, hidden: true };
      return;
    }

    if (immediate) {
      root.classList.add('is-complete', 'is-hidden');
      root.style.display = 'none';
      root.setAttribute('aria-hidden', 'true');
      this.state = { ...this.state, hidden: true };
      return;
    }

    root.classList.add('is-complete');
    root.setAttribute('aria-busy', 'false');
    this.hideTimeoutId = setTimeout(() => {
      root.classList.add('is-hidden');
      root.style.display = 'none';
      root.setAttribute('aria-hidden', 'true');
      this.state = { ...this.state, hidden: true };
    }, 420);
  }

  private bindDomInteractions(): void {
    if (typeof document === 'undefined') return;
    const w = window as unknown as { __ASHEN_BOOT_LOADING_TIMER__?: ReturnType<typeof setInterval> };
    if (w.__ASHEN_BOOT_LOADING_TIMER__) {
      clearInterval(w.__ASHEN_BOOT_LOADING_TIMER__);
      delete w.__ASHEN_BOOT_LOADING_TIMER__;
    }

    const tipCard = document.getElementById('loading-tip-card');
    if (tipCard && !this.boundTipClickHandler) {
      this.boundTipClickHandler = () => {
        this.nextTip();
      };
      tipCard.addEventListener('click', this.boundTipClickHandler);
    }

    if (typeof window !== 'undefined' && this.tipIntervalId === null) {
      this.tipIntervalId = setInterval(() => {
        if (!this.state.completed) {
          this.nextTip();
        }
      }, 4200);
    }
  }

  public syncDom(): void {
    if (typeof document === 'undefined') return;
    const root = document.getElementById('ashen-loading-screen');
    if (!root) return;

    const { locale, stage, progress, activeHeroCount, tipIndex } = this.state;
    const stageCopy = getLoadingStageCopy(stage, locale);
    const tips = getLoadingTips(locale);
    const tip = tips[tipIndex % tips.length] ?? tips[0]!;

    const subtitleEl = document.getElementById('loading-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent =
        locale === 'en' ? 'PACT OF THE ASHEN SANCTUARY' : 'KHẾ ƯỚC TRO TÀN';
    }

    const taglineEl = document.getElementById('loading-tagline');
    if (taglineEl) {
      taglineEl.textContent =
        locale === 'en'
          ? 'Top-Down Co-op Action Roguelite · 1–4 Players LAN & WebRTC'
          : 'Top-Down Co-op Action Roguelite · 1–4 Người Chơi LAN & P2P';
    }

    const stageLabelEl = document.getElementById('loading-stage-label');
    if (stageLabelEl) {
      stageLabelEl.textContent = stageCopy.label;
    }

    const stageDetailEl = document.getElementById('loading-stage-detail');
    if (stageDetailEl) {
      stageDetailEl.textContent = stageCopy.detail;
    }

    const percentEl = document.getElementById('loading-progress-percent');
    if (percentEl) {
      percentEl.textContent = `${progress}%`;
    }

    const fillEl = document.getElementById('loading-progress-fill');
    if (fillEl) {
      fillEl.style.width = `${progress}%`;
    }

    const trackEl = document.getElementById('loading-progress-track');
    if (trackEl) {
      trackEl.setAttribute('aria-valuenow', String(progress));
    }

    const heroCards = root.querySelectorAll<HTMLElement>('[data-hero-index]');
    heroCards.forEach((card) => {
      const idx = Number(card.getAttribute('data-hero-index') ?? '0');
      const spec = LOADING_HERO_CRESTS[idx];
      const isUnlocked = idx < activeHeroCount;
      const isCurrent = idx === activeHeroCount - 1 && progress < 100;
      card.classList.toggle('is-active', isUnlocked);
      card.classList.toggle('is-current', isCurrent);
      if (spec) {
        const nameNode = card.querySelector<HTMLElement>('.loading-hero-name');
        const roleNode = card.querySelector<HTMLElement>('.loading-hero-role');
        if (nameNode) nameNode.textContent = locale === 'en' ? spec.nameEn : spec.nameVi;
        if (roleNode) roleNode.textContent = locale === 'en' ? spec.roleEn : spec.roleVi;
      }
    });

    const pips = root.querySelectorAll<HTMLElement>('[data-step-pip]');
    pips.forEach((pip) => {
      const pipIdx = Number(pip.getAttribute('data-step-pip') ?? '0');
      pip.classList.toggle('is-done', pipIdx < stageCopy.stepIndex || progress >= 100);
      pip.classList.toggle('is-current', pipIdx === stageCopy.stepIndex && progress < 100);
    });

    const tipTitleEl = document.getElementById('loading-tip-title');
    if (tipTitleEl) {
      tipTitleEl.textContent = tip.title;
    }
    const tipBodyEl = document.getElementById('loading-tip-body');
    if (tipBodyEl) {
      tipBodyEl.textContent = tip.body;
    }
    const tipCounterEl = document.getElementById('loading-tip-counter');
    if (tipCounterEl) {
      const nextHint = locale === 'en' ? 'Click for next tip ▸' : 'Nhấp để xem mẹo tiếp ▸';
      tipCounterEl.textContent = `${(tipIndex % tips.length) + 1}/${tips.length} · ${nextHint}`;
    }
  }
}

let sharedLoadingController: LoadingScreenController | null = null;

export function getLoadingScreen(): LoadingScreenController {
  if (!sharedLoadingController) {
    sharedLoadingController = new LoadingScreenController();
  }
  return sharedLoadingController;
}
