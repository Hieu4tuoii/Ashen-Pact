import { describe, expect, it, vi } from 'vitest';
import {
  ALL_ASHEN_PACT_IDS,
  ALL_ASHEN_RELIC_IDS,
  ASHEN_PACTS,
  ASHEN_RELICS,
  PACT_TO_RELIC_ID,
  SOUL_CHAIN_MAX_DIST,
  WorldSim,
  i18n,
} from '../src/index.js';
import { PALETTE } from '../../../apps/client/src/art/palette.js';
import {
  ALL_SAMPLE_RIGS,
  ASHEN_EXECUTIONER_RIG_DEF,
  RIG_DEFS_BY_ID,
} from '../../../apps/client/src/art/rig-defs.js';
import {
  computePlayerTetherVisualSpec,
  drawP2BWorldOverlays,
  handleP2BSimEvent,
} from '../../../apps/client/src/fx/combat-fx-p2b.js';
import {
  computeAshenPactModalLayout,
  drawAshenPactEmblem,
  drawAshenRelicEmblem,
  drawPlayerPactAndRelicHudBadges,
  formatAshenPactChoiceCardMeta,
  formatAshenPactModalHeader,
  formatPlayerPactAndRelicBadges,
  formatRelicAwakenedBannerText,
  getVisualTimeMs,
  isVisualFreezeActive,
} from '../../../apps/client/src/scenes/game-scene/hud-ashen-pact-modal.js';
import { resolveInteractPromptSpec } from '../../../apps/client/src/scenes/game-scene/interact-prompt.js';

function createMockGraphics() {
  return {
    fillStyle: vi.fn(),
    fillCircle: vi.fn(),
    fillRect: vi.fn(),
    fillRoundedRect: vi.fn(),
    fillTriangle: vi.fn(),
    fillPath: vi.fn(),
    lineStyle: vi.fn(),
    strokeCircle: vi.fn(),
    strokeRoundedRect: vi.fn(),
    strokeTriangle: vi.fn(),
    strokePath: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    lineBetween: vi.fn(),
  };
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

describe('AP2 Phase P2B.4 — Ashen Pact Altar Modal UI, HUD Curse/Relic Badges, Rig & World VFX', () => {
  it('formats bilingual (vi & en) Ashen Pact Altar header and all 6 Pact -> 6 Awakened Relic cards', () => {
    const headerVi = formatAshenPactModalHeader(false);
    const headerEn = formatAshenPactModalHeader(true);
    expect(headerVi.titleText).toContain('TẾ ĐÀN KHẾ ƯỚC TRO TÀN');
    expect(headerVi.declineButtonText).toContain('[3] Khước Từ Khế Ước');
    expect(headerEn.titleText).toContain('ASHEN PACT ALTAR');
    expect(headerEn.declineButtonText).toContain('[3] Decline Pact');

    expect(ALL_ASHEN_PACT_IDS).toHaveLength(6);
    expect(ALL_ASHEN_RELIC_IDS).toHaveLength(6);

    for (let i = 0; i < ALL_ASHEN_PACT_IDS.length; i++) {
      const pactId = ALL_ASHEN_PACT_IDS[i]!;
      const cardVi = formatAshenPactChoiceCardMeta(pactId, i % 2, false);
      const cardEn = formatAshenPactChoiceCardMeta(pactId, i % 2, true);

      expect(cardVi.pactId).toBe(pactId);
      expect(cardVi.relicId).toBe(PACT_TO_RELIC_ID[pactId]);
      expect(cardVi.pactTitle.length).toBeGreaterThan(3);
      expect(cardEn.pactTitle.length).toBeGreaterThan(3);
      expect(cardVi.pactTitle).not.toBe(cardEn.pactTitle);
      expect(cardVi.pactCurseDesc.length).toBeGreaterThan(15);
      expect(cardEn.pactCurseDesc.length).toBeGreaterThan(15);
      expect(cardVi.relicTitle).toBe(ASHEN_RELICS[cardVi.relicId].nameVi);
      expect(cardEn.relicTitle).toBe(ASHEN_RELICS[cardEn.relicId].nameEn);
      expect(cardVi.relicBenefitDesc.length).toBeGreaterThan(15);
      expect(cardEn.relicBenefitDesc.length).toBeGreaterThan(15);
      expect(cardVi.relicTradeoffDesc.length).toBeGreaterThan(5);
      expect(cardEn.relicTradeoffDesc.length).toBeGreaterThan(5);
    }
  });

  it('computes non-overlapping Ashen Pact Altar modal geometry strictly inside 960x540 HUD space', () => {
    const layout = computeAshenPactModalLayout(960, 540);
    const { panelRect, headerRect, cards, declineBtnRect } = layout;

    expect(panelRect.x).toBeGreaterThanOrEqual(0);
    expect(panelRect.y).toBeGreaterThanOrEqual(0);
    expect(panelRect.x + panelRect.w).toBeLessThanOrEqual(960);
    expect(panelRect.y + panelRect.h).toBeLessThanOrEqual(540);

    // Header, cards, and decline button do not overlap
    expect(rectsOverlap(headerRect, cards[0])).toBe(false);
    expect(rectsOverlap(headerRect, cards[1])).toBe(false);
    expect(rectsOverlap(cards[0], cards[1])).toBe(false);
    expect(rectsOverlap(cards[0], declineBtnRect)).toBe(false);
    expect(rectsOverlap(cards[1], declineBtnRect)).toBe(false);

    // Top Trial half and Bottom Relic half inside each card do not overlap
    for (const card of cards) {
      expect(rectsOverlap(card.topHalfRect, card.bottomHalfRect)).toBe(false);
      expect(card.dividerY).toBeGreaterThanOrEqual(card.topHalfRect.y + card.topHalfRect.h);
      expect(card.bottomHalfRect.y).toBeGreaterThan(card.dividerY);
    }
  });

  it('draws distinct custom vector emblems for all 6 Ashen Pacts and all 6 Awakened Relics', () => {
    for (const pactId of ALL_ASHEN_PACT_IDS) {
      const g = createMockGraphics();
      drawAshenPactEmblem(g as never, pactId, 120, 140, 15);
      expect(g.fillCircle).toHaveBeenCalled();
      expect(g.strokeCircle).toHaveBeenCalled();
    }
    for (const relicId of ALL_ASHEN_RELIC_IDS) {
      const g = createMockGraphics();
      drawAshenRelicEmblem(g as never, relicId, 120, 260, 15);
      expect(g.fillCircle).toHaveBeenCalled();
      expect(g.strokeCircle).toHaveBeenCalled();
    }
  });

  it('formats and draws HUD Active Pact Curse Chip, retained morphed weapon timer, and Awakened Relic Badges', () => {
    const sim = new WorldSim({ seed: 9801, startInHub: false });
    const p = sim.player;
    p.activePactId = 'pact_volatile_arsenal';
    p.pactKeepMorphedWeaponId = 'plasma_rifle';
    p.pactKeepMorphedTimer = 3.4;
    p.awakenedRelicIds = ['relic_blood_oath_tether', 'relic_executioner_scythe'];

    const badgesVi = formatPlayerPactAndRelicBadges(p, false);
    const badgesEn = formatPlayerPactAndRelicBadges(p, true);
    expect(badgesVi).toHaveLength(3);
    expect(badgesVi[0]!.kind).toBe('pact');
    expect(badgesVi[0]!.labelText).toContain(ASHEN_PACTS.pact_volatile_arsenal.nameVi);
    expect(badgesVi[0]!.subLabelText).toContain('4s');
    expect(badgesEn[0]!.labelText).toContain(ASHEN_PACTS.pact_volatile_arsenal.nameEn);
    expect(badgesVi[1]!.kind).toBe('relic');
    expect(badgesVi[1]!.labelText).toContain(ASHEN_RELICS.relic_blood_oath_tether.nameVi);
    expect(badgesVi[2]!.labelText).toContain(ASHEN_RELICS.relic_executioner_scythe.nameVi);

    const g = createMockGraphics();
    const count = drawPlayerPactAndRelicHudBadges({} as never, g as never, p, 12, 102, false);
    expect(count).toBe(3);
    expect(g.fillRoundedRect).toHaveBeenCalled();

    const bannerVi = formatRelicAwakenedBannerText('relic_executioner_scythe', false);
    const bannerEn = formatRelicAwakenedBannerText('relic_executioner_scythe', true);
    expect(bannerVi).toContain('KHẾ ƯỚC THANH TẨY');
    expect(bannerVi).toContain(ASHEN_RELICS.relic_executioner_scythe.nameVi.toUpperCase());
    expect(bannerEn).toContain('PACT PURIFIED');
    expect(bannerEn).toContain(ASHEN_RELICS.relic_executioner_scythe.nameEn.toUpperCase());
  });

  it('registers ASHEN_EXECUTIONER_RIG_DEF (Bóng Ma Đao Phủ) with 8 parts and strict PALETTE colors', () => {
    expect(RIG_DEFS_BY_ID.ashen_executioner).toBe(ASHEN_EXECUTIONER_RIG_DEF);
    expect(ALL_SAMPLE_RIGS).toContain(ASHEN_EXECUTIONER_RIG_DEF);
    expect(ASHEN_EXECUTIONER_RIG_DEF.parts).toHaveLength(8);

    const validColors = new Set(Object.values(PALETTE));
    for (const part of ASHEN_EXECUTIONER_RIG_DEF.parts) {
      for (const shape of part.shapes) {
        expect(validColors.has(shape.style.fill)).toBe(true);
        if (shape.style.shade) expect(validColors.has(shape.style.shade)).toBe(true);
        if (shape.style.highlight) expect(validColors.has(shape.style.highlight)).toBe(true);
      }
    }
  });

  it('computes Soul Chain (safe <= 260px vs stretched > 260px) and Blood Oath Laser Tether visual specs & draws P2B world overlays', () => {
    const sim = new WorldSim({ seed: 9802, startInHub: false });
    const p1 = sim.player;
    p1.x = 200;
    p1.y = 200;
    const p2 = sim.addCoopPlayer(2, 'ranger', 'Đồng Đội 2');
    p2.x = 380;
    p2.y = 200; // 180px <= 260px

    p1.activePactId = 'pact_soul_chain';
    p1.soulChainTargetKind = 'player';
    p1.soulChainTargetId = p2.id;

    const safeSpec = computePlayerTetherVisualSpec(sim, p1);
    expect(safeSpec.active).toBe(true);
    expect(safeSpec.mode).toBe('pact_soul_chain');
    expect(safeSpec.distancePx).toBe(180);
    expect(safeSpec.maxSafeDistancePx).toBe(SOUL_CHAIN_MAX_DIST);
    expect(safeSpec.isStretched).toBe(false);
    expect(safeSpec.primaryColor).toBe(0x38bdf8);

    // Move p2 beyond 260px -> stretched warning
    p2.x = 520; // 320px > 260px
    p1.soulChainStretchTimer = 1.25;
    const stretchedSpec = computePlayerTetherVisualSpec(sim, p1);
    expect(stretchedSpec.isStretched).toBe(true);
    expect(stretchedSpec.primaryColor).toBe(0xf43f5e);
    expect(stretchedSpec.warningTextVi).toContain('RÚT GIÁP');
    expect(stretchedSpec.warningTextEn).toContain('ARMOR DRAIN');
    expect(stretchedSpec.stretchRatio).toBeCloseTo(0.5, 2);

    // Purify into relic_blood_oath_tether and move back within 260px
    p1.activePactId = null;
    p1.awakenedRelicIds = ['relic_blood_oath_tether'];
    p2.x = 410; // 210px <= 260px
    const relicSpec = computePlayerTetherVisualSpec(sim, p1);
    expect(relicSpec.active).toBe(true);
    expect(relicSpec.mode).toBe('relic_blood_oath_tether');
    expect(relicSpec.primaryColor).toBe(0xff6b00);
    expect(relicSpec.secondaryColor).toBe(0x38bdf8);

    // Verify drawP2BWorldOverlays & handleP2BSimEvent under visualFreeze
    const mockScene = {
      visualFreeze: true,
      camFocusX: 200,
      camFocusY: 200,
      hudBannerTextStr: '',
      hudBannerAccentColor: 0,
      hudBannerTimer: 0,
    };
    expect(isVisualFreezeActive(mockScene)).toBe(true);
    expect(getVisualTimeMs(mockScene)).toBe(1000);

    p1.blackCrystalEmpoweredNextShot = true;
    const exec = sim.spawnEnemy('ashen_executioner', 320, 260, true);
    exec.aiState = 'telegraph';
    exec.telegraphAngle = 0;

    handleP2BSimEvent(
      mockScene as never,
      {
        kind: 'explosion',
        x: 300,
        y: 240,
        radius: 96,
        damage: 60,
        sourceDefId: 'relic_executioner_scythe',
      },
      sim,
      false,
      false,
    );

    const g = createMockGraphics();
    drawP2BWorldOverlays(mockScene as never, g as never, sim, p1.x, p1.y);
    expect(g.lineBetween).toHaveBeenCalled();
    expect(g.strokeCircle).toHaveBeenCalled();
  });

  it('shows [E] Tế Đàn Khế Ước Tro Tàn / Ashen Pact Altar with 0 Gold cost in interact prompt', () => {
    const sim = new WorldSim({ seed: 9803, startInHub: false });
    const prevLocale = i18n.getLocale();
    try {
      i18n.setLocale('vi');
      const specVi = resolveInteractPromptSpec(sim, {
        kind: 'shrine',
        key: 'shrine:1',
        x: 240,
        y: 220,
        dist: 20,
        npc: {
          id: 1,
          kind: 'shrine',
          nameVi: 'Tế Đàn Khế Ước Tro Tàn',
          x: 240,
          y: 220,
          radius: 22,
          interacted: false,
          costGold: 0,
          costHp: 0,
          dialogueVi: '',
        },
      });
      expect(specVi?.titleText).toBe('Tế Đàn Khế Ước Tro Tàn');
      expect(specVi?.costGold).toBe(0);
      expect(specVi?.hasCoinIcon).toBe(false);
      expect(specVi?.priceText).toBe('');

      i18n.setLocale('en');
      const specEn = resolveInteractPromptSpec(sim, {
        kind: 'shrine',
        key: 'shrine:1',
        x: 240,
        y: 220,
        dist: 20,
        npc: {
          id: 1,
          kind: 'shrine',
          nameVi: 'Tế Đàn Khế Ước Tro Tàn',
          x: 240,
          y: 220,
          radius: 22,
          interacted: false,
          costGold: 0,
          costHp: 0,
          dialogueVi: '',
        },
      });
      expect(specEn?.titleText).toBe('Ashen Pact Altar');
      expect(specEn?.costGold).toBe(0);
      expect(specEn?.hasCoinIcon).toBe(false);
    } finally {
      i18n.setLocale(prevLocale);
    }
  });
});
