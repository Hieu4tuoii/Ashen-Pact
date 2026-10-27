import {
  ALL_WEAPON_IDS,
  type CharacterId,
  CHARACTERS,
  VIETNAMESE_VERIFICATION_STRING,
  WEAPON_RARITY_COLORS,
  WEAPONS,
  type WeaponRarity,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { CutoutRig } from '../art/cutout-rig.js';
import { hexToNum, PALETTE } from '../art/palette.js';
import {
  BABY_YETI_RIG_DEF,
  COAL_GOLEM_RIG_DEF,
  DWARF_CANNON_RIG_DEF,
  FIRE_IMP_RIG_DEF,
  FORGE_ENERGY_CORE_RIG_DEF,
  FORGE_TITAN_RIG_DEF,
  FROST_BAT_RIG_DEF,
  GOBLIN_SHAMAN_RIG_DEF,
  GOBLIN_SHOOTER_RIG_DEF,
  GREEN_SLIME_RIG_DEF,
  ICE_GOLEM_RIG_DEF,
  ICE_MAGE_RIG_DEF,
  ICE_PRISON_RIG_DEF,
  IRON_SHIELDER_RIG_DEF,
  KRYSSA_CLONE_RIG_DEF,
  KRYSSA_ICE_QUEEN_RIG_DEF,
  MERCHANT_RIG_DEF,
  MINI_SLIME_RIG_DEF,
  RIG_DEFS_BY_ID,
  SNOW_SPIRIT_RIG_DEF,
  SPORE_BOMBER_RIG_DEF,
  SPORE_KING_RIG_DEF,
  THORN_TURRET_RIG_DEF,
  VANGUARD_RIG_DEF,
  WELDER_DRONE_RIG_DEF,
  WILD_BOAR_RIG_DEF,
} from '../art/rig-defs.js';
import { TextureBaker } from '../art/texture-baker.js';
import type { ArtGalleryScene } from './ArtGalleryScene.js';

export function buildPage1StandardShowcase(
  this: ArtGalleryScene,
  parent: Phaser.GameObjects.Container,
): void {
  this.createEntityStage(parent, {
    x: 16,
    y: 72,
    w: 454,
    h: 274,
    titleVi: 'NHÂN VẬT MẪU: THIẾT VỆ (VANGUARD)',
    subtitleVi: 'Tỉ lệ Chibi (Đầu ~40%) · Viền 2.5u #141019 · Cel-Shade + Rim Light',
    rigDef: VANGUARD_RIG_DEF,
    isPlayer: true,
  });

  this.createEntityStage(parent, {
    x: 490,
    y: 72,
    w: 454,
    h: 274,
    titleVi: 'QUÁI MẪU BIOME 1: GOBLIN XẠ THỦ (GOBLIN SHOOTER)',
    subtitleVi: 'Cutout Rig 8 Bộ Phận · Animation Tham Số Idle / Run · Nỏ Tên Đỏ',
    rigDef: GOBLIN_SHOOTER_RIG_DEF,
    isPlayer: false,
  });

  this.createPaletteAndBiomePanel(parent, 16, 354, 928, 98);
}

export function buildPage2EnemiesAndBoss(
  this: ArtGalleryScene,
  parent: Phaser.GameObjects.Container,
): void {
  const textRes = TextureBaker.getBakeScale();
  const invBake = 1 / textRes;
  const entries = [
    {
      title: '1. Goblin Xạ Thủ',
      sub: 'Bắn tỉa tầm xa · Giữ khoảng cách',
      rigDef: GOBLIN_SHOOTER_RIG_DEF,
      scale: 1.25,
    },
    {
      title: '2. Slime Xanh & Slime Con',
      sub: 'Tách làm 2 Slime Con khi bị hạ',
      rigDef: GREEN_SLIME_RIG_DEF,
      scale: 1.2,
      companionDef: MINI_SLIME_RIG_DEF,
    },
    {
      title: '3. Nấm Nổ Độc',
      sub: 'Lao vào tự sát · Tạo đầm độc',
      rigDef: SPORE_BOMBER_RIG_DEF,
      scale: 1.25,
    },
    {
      title: '4. Heo Rừng Húc',
      sub: 'Telegraph đỏ 0.6s · Húc thẳng',
      rigDef: WILD_BOAR_RIG_DEF,
      scale: 1.2,
    },
    {
      title: '5. Pháp Sư Goblin',
      sub: 'Hồi máu đồng minh & bắn đạn',
      rigDef: GOBLIN_SHAMAN_RIG_DEF,
      scale: 1.25,
    },
    {
      title: '6. Ụ Gai Độc',
      sub: 'Cố định · Phóng 6 gai độc tròn',
      rigDef: THORN_TURRET_RIG_DEF,
      scale: 1.25,
    },
    {
      title: '7. Thương Nhân Hắc Ám',
      sub: 'NPC bán vũ khí, máu & giáp',
      rigDef: MERCHANT_RIG_DEF,
      scale: 1.25,
    },
    {
      title: '8. Boss: Mục Vương Nấm Độc',
      sub: 'Boss 3 Pha: Bào Tử · Độn Thổ · Sương Độc',
      rigDef: SPORE_KING_RIG_DEF,
      scale: 1.02,
    },
  ];

  const cardW = 224;
  const cardH = 184;
  const gapX = 10;
  const gapY = 12;

  entries.forEach((item, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const cx = 16 + col * (cardW + gapX);
    const cy = 72 + row * (cardH + gapY);

    const g = this.add.graphics();
    g.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.94);
    g.lineStyle(2, hexToNum(idx === 7 ? PALETTE.SOLAR_GOLD : PALETTE.INK_DARK), 1);
    g.fillRoundedRect(cx, cy, cardW, cardH, 9);
    g.strokeRoundedRect(cx, cy, cardW, cardH, 9);
    parent.add(g);

    for (let tx = 0; tx < 5; tx++) {
      for (let ty = 0; ty < 3; ty++) {
        const variant = (tx + ty) % 4;
        const spr = this.add.sprite(
          cx + 32 + tx * 32 + 16,
          cy + 56 + ty * 32 + 16,
          TextureBaker.getBiomeTileTextureKey(this.currentBiome, variant),
        );
        spr.setScale(invBake);
        this.floorTileSprites.push({ sprite: spr, variant });
        parent.add(spr);
      }
    }

    const rig = new CutoutRig(this, cx + (item.companionDef ? 94 : 112), cy + 122, item.rigDef, {
      displayScale: item.scale,
    });
    rig.setAnimState(this.currentAnim);
    this.rigs.push(rig);
    parent.add(rig.container);

    if (item.companionDef) {
      const mini = new CutoutRig(this, cx + 152, cy + 128, item.companionDef, {
        displayScale: 1.05,
      });
      mini.setAnimState(this.currentAnim);
      this.rigs.push(mini);
      parent.add(mini.container);
    }

    const tTitle = this.add.text(cx + 12, cy + 10, item.title, {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '12px',
      fontStyle: '800',
      color: idx === 7 ? PALETTE.SOLAR_GOLD : PALETTE.BONE_WHITE,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3,
      resolution: textRes,
    });
    this.textObjects.push(tTitle);
    parent.add(tTitle);

    const tSub = this.add.text(cx + 12, cy + 28, item.sub, {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '10px',
      color: PALETTE.SILVER_BRIGHT,
      resolution: textRes,
    });
    this.textObjects.push(tSub);
    parent.add(tSub);
  });
}

export function buildPage3WeaponsAndProps(
  this: ArtGalleryScene,
  parent: Phaser.GameObjects.Container,
): void {
  const textRes = TextureBaker.getBakeScale();
  const invBake = 1 / textRes;

  // 1. Weapons Panel (18 Weapons across 5 Rarities + Co-op Seed Gun & Tether Staff)
  const wepPanel = this.add.graphics();
  wepPanel.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.94);
  wepPanel.lineStyle(2, hexToNum(PALETTE.INK_DARK), 1);
  wepPanel.fillRoundedRect(16, 72, 928, 256, 10);
  wepPanel.strokeRoundedRect(16, 72, 928, 256, 10);
  parent.add(wepPanel);

  const wepHeader = this.add.text(
    28,
    80,
    'KHO VŨ KHÍ PROCEDURAL (18 MÓN · 5 ĐỘ HIẾM · SÚNG HẠT GIỐNG & TRƯỢNG LIÊN KẾT CO-OP)',
    {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '12px',
      fontStyle: '800',
      color: PALETTE.SOLAR_GOLD,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3,
      resolution: textRes,
    },
  );
  this.textObjects.push(wepHeader);
  parent.add(wepHeader);

  const cardW = 146;
  const cardH = 68;
  ALL_WEAPON_IDS.forEach((wId, idx) => {
    const wDef = WEAPONS[wId];
    if (!wDef) return;
    const col = idx % 6;
    const row = Math.floor(idx / 6);
    const wx = 26 + col * (cardW + 6);
    const wy = 104 + row * (cardH + 5);
    const rarityHex = WEAPON_RARITY_COLORS[wDef.rarity];
    const cadLabel =
      wDef.cadenceKind === 'CLIP_RELOAD'
        ? 'NẠP'
        : wDef.cadenceKind === 'HEAT_VENT'
          ? 'NHIỆT'
          : 'COMBO';

    const cg = this.add.graphics();
    cg.fillStyle(hexToNum(PALETTE.INK_DEEP), 0.9);
    cg.lineStyle(1.8, hexToNum(rarityHex), 1);
    cg.fillRoundedRect(wx, wy, cardW, cardH, 6);
    cg.strokeRoundedRect(wx, wy, cardW, cardH, 6);
    parent.add(cg);

    const spr = this.add.sprite(wx + cardW / 2, wy + 23, TextureBaker.getWeaponTextureKey(wId));
    spr.setScale(invBake * 0.96);
    this.bakedSprites.push({ sprite: spr, mult: 0.96 });
    parent.add(spr);

    const wName = this.add
      .text(wx + cardW / 2, wy + 46, wDef.nameVi, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '8.5px',
        fontStyle: '800',
        color: rarityHex,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.2,
        resolution: textRes,
      })
      .setOrigin(0.5);
    this.textObjects.push(wName);
    parent.add(wName);

    const wMeta = this.add
      .text(wx + cardW / 2, wy + 59, `${cadLabel} · ST ${wDef.damage} · ${wDef.fireRate}/s`, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '8px',
        color: PALETTE.SILVER_BRIGHT,
        resolution: textRes,
      })
      .setOrigin(0.5);
    this.textObjects.push(wMeta);
    parent.add(wMeta);
  });

  // 2. Dungeon Props & Chests Panel
  const propPanel = this.add.graphics();
  propPanel.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.94);
  propPanel.lineStyle(2, hexToNum(PALETTE.INK_DARK), 1);
  propPanel.fillRoundedRect(16, 334, 928, 118, 10);
  propPanel.strokeRoundedRect(16, 334, 928, 118, 10);
  parent.add(propPanel);

  const propHeader = this.add.text(
    28,
    342,
    'CÔNG TRÌNH HẦM NGỤC: 5 RƯƠNG · CỬA · TƯỢNG THẦN · TRỤ PHA LÊ · TẤM ÁP LỰC · KHỐI ĐÁ · BĂNG CHUYỀN',
    {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '11.5px',
      fontStyle: '800',
      color: PALETTE.CYAN_FROST,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3,
      resolution: textRes,
    },
  );
  this.textObjects.push(propHeader);
  parent.add(propHeader);

  const chestLabelsVi: Record<WeaponRarity, string> = {
    common: 'Rương Thường',
    uncommon: 'Rương Khá',
    rare: 'Rương Hiếm',
    epic: 'Rương Sử Thi',
    legendary: 'Rương H.Thoại',
  };
  const rarities: WeaponRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const propItems: { tex: string; label: string }[] = [
    ...rarities.map((r) => ({
      tex: TextureBaker.getChestTextureKey(r, false),
      label: chestLabelsVi[r],
    })),
    { tex: 'door_locked', label: 'Cửa Khóa' },
    { tex: 'prop_shrine_statue', label: 'Tượng Thần' },
    { tex: 'prop_crystal_pillar', label: 'Trụ Pha Lê' },
    { tex: 'prop_pressure_plate_on', label: 'Tấm Áp Lực' },
    { tex: 'prop_push_block', label: 'Khối Đá Đẩy' },
    { tex: 'surface_conveyor', label: 'Băng Chuyền' },
    { tex: 'portal_active', label: 'Cổng Tầng' },
  ];

  propItems.forEach((pItem, idx) => {
    const px = 52 + idx * 75;
    const py = 398;
    const spr = this.add.sprite(px, py, pItem.tex);
    spr.setScale(invBake * 0.85);
    this.bakedSprites.push({ sprite: spr, mult: 0.85 });
    parent.add(spr);

    const lbl = this.add
      .text(px, py + 36, pItem.label, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '8.5px',
        fontStyle: '700',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.5,
        resolution: textRes,
      })
      .setOrigin(0.5);
    this.textObjects.push(lbl);
    parent.add(lbl);
  });
}

export function buildPage4CharactersAndSynergy(
  this: ArtGalleryScene,
  parent: Phaser.GameObjects.Container,
): void {
  const textRes = TextureBaker.getBakeScale();
  const invBake = 1 / textRes;
  const cardW = 179;
  const cardH = 378;
  const gapX = 8;
  const charIds: readonly CharacterId[] = [
    'vanguard',
    'ranger',
    'elementalist',
    'druid',
    'engineer',
  ];

  charIds.forEach((charId, idx) => {
    const cDef = CHARACTERS[charId];
    const rigDef = RIG_DEFS_BY_ID[charId] ?? VANGUARD_RIG_DEF;
    const cx = 16 + idx * (cardW + gapX);
    const cy = 72;

    const g = this.add.graphics();
    g.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.95);
    g.lineStyle(2.5, hexToNum(PALETTE.SOLAR_GOLD), 0.95);
    g.fillRoundedRect(cx, cy, cardW, cardH, 9);
    g.strokeRoundedRect(cx, cy, cardW, cardH, 9);
    parent.add(g);

    for (let tx = 0; tx < 4; tx++) {
      for (let ty = 0; ty < 3; ty++) {
        const variant = (tx + ty + idx) % 4;
        const spr = this.add.sprite(
          cx + 25 + tx * 32 + 16,
          cy + 62 + ty * 32 + 16,
          TextureBaker.getBiomeTileTextureKey(this.currentBiome, variant),
        );
        spr.setScale(invBake);
        this.floorTileSprites.push({ sprite: spr, variant });
        parent.add(spr);
      }
    }

    const rig1x = new CutoutRig(this, cx + 46, cy + 124, rigDef, {
      playerSlot: this.currentSlot,
      displayScale: 1.0,
    });
    rig1x.setAnimState(this.currentAnim);
    rig1x.setEquippedWeapon(cDef.starterWeaponId);
    this.rigs.push(rig1x);
    this.playerRigs.push(rig1x);
    parent.add(rig1x.container);

    const rigZoom = new CutoutRig(this, cx + 112, cy + 128, rigDef, {
      playerSlot: this.currentSlot,
      displayScale: 1.5,
      initialPhaseOffset: idx * 0.2,
    });
    rigZoom.setAnimState(this.currentAnim);
    rigZoom.setEquippedWeapon(cDef.starterWeaponId);
    this.rigs.push(rigZoom);
    this.playerRigs.push(rigZoom);
    parent.add(rigZoom.container);

    const tTitle = this.add.text(cx + 9, cy + 7, `${idx + 1}. ${cDef.nameVi.toUpperCase()}`, {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '11.5px',
      fontStyle: '800',
      color: PALETTE.SOLAR_GOLD,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3,
      resolution: textRes,
    });
    this.textObjects.push(tTitle);
    parent.add(tTitle);

    const tRole = this.add.text(
      cx + 9,
      cy + 24,
      `${cDef.titleVi}\nHP ${cDef.hp} · Giáp ${cDef.armor} · Tốc ${cDef.moveSpeed}`,
      {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '8px',
        fontStyle: '700',
        color: PALETTE.CYAN_FROST,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2,
        lineSpacing: 1,
        resolution: textRes,
      },
    );
    this.textObjects.push(tRole);
    parent.add(tRole);

    const upg1 = cDef.skill.upgrades[0];
    const upg2 = cDef.skill.upgrades[1];
    const descLines = [
      `• Nội tại (${cDef.passiveNameVi}): ${cDef.passiveDescriptionVi}`,
      `• Kỹ năng [Q] (${cDef.skill.nameVi}): ${cDef.skill.descriptionVi}`,
      `• Nâng cấp: (1) ${upg1.nameVi} | (2) ${upg2.nameVi}`,
      `• Synergy: ${cDef.skill.synergyVi}`,
    ].join('\n');

    const tDesc = this.add.text(cx + 8, cy + 165, descLines, {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '7.8px',
      fontStyle: '600',
      color: PALETTE.BONE_WHITE,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 2,
      lineSpacing: 1.7,
      wordWrap: { width: cardW - 16 },
      resolution: textRes,
    });
    this.textObjects.push(tDesc);
    parent.add(tDesc);
  });
}

export function buildPage5Biome2And3Showcase(
  this: ArtGalleryScene,
  parent: Phaser.GameObjects.Container,
): void {
  const textRes = TextureBaker.getBakeScale();
  const invBake = 1 / textRes;

  const biome2Entries = [
    {
      title: 'Dơi Băng',
      sub: 'Bay nhanh · Lao thẳng',
      rigDef: FROST_BAT_RIG_DEF,
      scale: 1.15,
    },
    {
      title: 'Yeti Con',
      sub: 'Đập đất làm chậm',
      rigDef: BABY_YETI_RIG_DEF,
      scale: 1.15,
    },
    {
      title: 'Pháp Sư Băng',
      sub: 'Cầu băng khóa chân',
      rigDef: ICE_MAGE_RIG_DEF,
      scale: 1.15,
    },
    {
      title: 'Golem Băng',
      sub: 'Khiên băng trước -78%',
      rigDef: ICE_GOLEM_RIG_DEF,
      scale: 1.1,
    },
    {
      title: 'Tinh Linh Tuyết',
      sub: 'Tự nổ đóng băng AoE',
      rigDef: SNOW_SPIRIT_RIG_DEF,
      scale: 1.15,
    },
    {
      title: 'Phân Thân & Lồng',
      sub: 'Không bóng đổ · Nhốt P',
      rigDef: KRYSSA_CLONE_RIG_DEF,
      scale: 0.92,
      companionDef: ICE_PRISON_RIG_DEF,
      hideShadow: true,
    },
    {
      title: 'BOSS: BĂNG HẬU KRYSSA',
      sub: 'Laser Phản Xạ · Phân Thân · Bão Tuyết',
      rigDef: KRYSSA_ICE_QUEEN_RIG_DEF,
      scale: 0.98,
      isBoss: true,
    },
  ];

  const biome3Entries = [
    {
      title: 'Tiểu Quỷ Lửa',
      sub: 'Đông đảo · Nhả đạn lửa',
      rigDef: FIRE_IMP_RIG_DEF,
      scale: 1.15,
    },
    {
      title: 'Lùn Pháo Thủ',
      sub: 'Bắn pháo cối nổ AoE',
      rigDef: DWARF_CANNON_RIG_DEF,
      scale: 1.15,
    },
    {
      title: 'Golem Than',
      sub: 'Chết để lại hồ dung nham',
      rigDef: COAL_GOLEM_RIG_DEF,
      scale: 1.1,
    },
    {
      title: 'Drone Hàn',
      sub: 'Bay · Bơm giáp đồng minh',
      rigDef: WELDER_DRONE_RIG_DEF,
      scale: 1.15,
    },
    {
      title: 'Khiên Thủ Sắt',
      sub: 'Khiên thép trước -80%',
      rigDef: IRON_SHIELDER_RIG_DEF,
      scale: 1.12,
    },
    {
      title: 'Lõi Năng Lượng Lò',
      sub: 'Phá 2 lõi trong 3s choáng',
      rigDef: FORGE_ENERGY_CORE_RIG_DEF,
      scale: 1.05,
    },
    {
      title: 'BOSS: TITAN LÒ RÈN',
      sub: 'Sóng Xung Kích · 2 Lõi · Lửa 360°',
      rigDef: FORGE_TITAN_RIG_DEF,
      scale: 0.94,
      isBoss: true,
    },
  ];

  const renderBiomeRow = (
    entries: typeof biome2Entries,
    rowIdx: number,
    biomeId: 2 | 3,
    accentHex: string,
  ) => {
    const cy = 72 + rowIdx * 192;
    entries.forEach((item, idx) => {
      const isBoss = Boolean(item.isBoss);
      const cardW = isBoss ? 172 : 120;
      const cardH = 182;
      const cx = 16 + idx * 125;

      const g = this.add.graphics();
      g.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.95);
      g.lineStyle(2, hexToNum(isBoss ? PALETTE.SOLAR_GOLD : accentHex), 1);
      g.fillRoundedRect(cx, cy, cardW, cardH, 8);
      g.strokeRoundedRect(cx, cy, cardW, cardH, 8);
      parent.add(g);

      const tileCols = isBoss ? 4 : 3;
      for (let tx = 0; tx < tileCols; tx++) {
        for (let ty = 0; ty < 3; ty++) {
          const variant = (tx + ty + idx) % 8;
          const spr = this.add.sprite(
            cx + 12 + tx * 32 + 16,
            cy + 58 + ty * 32 + 16,
            TextureBaker.getBiomeTileTextureKey(biomeId, variant),
          );
          spr.setScale(invBake);
          this.floorTileSprites.push({ sprite: spr, variant, fixedBiome: biomeId });
          parent.add(spr);
        }
      }

      const rig = new CutoutRig(
        this,
        cx + (item.companionDef ? 42 : cardW / 2),
        cy + 122,
        item.rigDef,
        { displayScale: item.scale },
      );
      if (item.hideShadow) {
        rig.setShadowVisible(false);
      }
      rig.setAnimState(this.currentAnim);
      this.rigs.push(rig);
      parent.add(rig.container);

      if (item.companionDef) {
        const comp = new CutoutRig(this, cx + 86, cy + 124, item.companionDef, {
          displayScale: 0.92,
        });
        comp.setAnimState(this.currentAnim);
        this.rigs.push(comp);
        parent.add(comp.container);
      }

      const tTitle = this.add.text(cx + 8, cy + 8, item.title, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: isBoss ? '10.5px' : '9.5px',
        fontStyle: '800',
        color: isBoss ? PALETTE.SOLAR_GOLD : PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.5,
        resolution: textRes,
      });
      this.textObjects.push(tTitle);
      parent.add(tTitle);

      const tSub = this.add.text(cx + 8, cy + 25, item.sub, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '8px',
        color: PALETTE.SILVER_BRIGHT,
        resolution: textRes,
      });
      this.textObjects.push(tSub);
      parent.add(tSub);
    });
  };

  renderBiomeRow(biome2Entries, 0, 2, PALETTE.CYAN_FROST);
  renderBiomeRow(biome3Entries, 1, 3, PALETTE.FLAME_ORANGE);
}

export function createEntityStage(
  this: ArtGalleryScene,
  parent: Phaser.GameObjects.Container,
  cfg: {
    x: number;
    y: number;
    w: number;
    h: number;
    titleVi: string;
    subtitleVi: string;
    rigDef: typeof VANGUARD_RIG_DEF;
    isPlayer: boolean;
  },
): void {
  const textRes = TextureBaker.getBakeScale();
  const panel = this.add.graphics();
  panel.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.94);
  panel.lineStyle(2.5, hexToNum(PALETTE.INK_DARK), 1);
  panel.fillRoundedRect(cfg.x, cfg.y, cfg.w, cfg.h, 10);
  panel.strokeRoundedRect(cfg.x, cfg.y, cfg.w, cfg.h, 10);
  parent.add(panel);

  const tTitle = this.add.text(cfg.x + 16, cfg.y + 12, cfg.titleVi, {
    fontFamily: '"Be Vietnam Pro", sans-serif',
    fontSize: '13px',
    fontStyle: '800',
    color: PALETTE.BONE_WHITE,
    stroke: PALETTE.INK_DARK,
    strokeThickness: 3,
    resolution: textRes,
  });
  this.textObjects.push(tTitle);
  parent.add(tTitle);

  const tSub = this.add.text(cfg.x + 16, cfg.y + 32, cfg.subtitleVi, {
    fontFamily: '"Be Vietnam Pro", sans-serif',
    fontSize: '11px',
    color: PALETTE.SILVER_BRIGHT,
    resolution: textRes,
  });
  this.textObjects.push(tSub);
  parent.add(tSub);

  const invBake = 1 / textRes;
  const cols = 12;
  const rows = 5;
  const startX = cfg.x + 36;
  const startY = cfg.y + 72;

  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      const variant = (cx + cy) % 4;
      const spr = this.add.sprite(
        startX + cx * 32 + 16,
        startY + cy * 32 + 16,
        TextureBaker.getBiomeTileTextureKey(this.currentBiome, variant),
      );
      spr.setScale(invBake);
      this.floorTileSprites.push({ sprite: spr, variant });
      parent.add(spr);
    }
  }

  const rig1x = new CutoutRig(this, cfg.x + 125, cfg.y + 185, cfg.rigDef, {
    playerSlot: cfg.isPlayer ? this.currentSlot : null,
    displayScale: 1.0,
  });

  const rigZoom = new CutoutRig(this, cfg.x + 310, cfg.y + 194, cfg.rigDef, {
    playerSlot: cfg.isPlayer ? this.currentSlot : null,
    displayScale: 2.25,
    initialPhaseOffset: 0.25,
  });

  if (!cfg.isPlayer) {
    rig1x.setAimAngle(-0.15);
    rigZoom.setAimAngle(-0.15);
  } else {
    rig1x.setAimAngle(0.1);
    rigZoom.setAimAngle(0.1);
    this.playerRigs.push(rig1x, rigZoom);
  }

  this.rigs.push(rig1x, rigZoom);
  parent.add([rig1x.container, rigZoom.container]);

  const lbl1x = this.add
    .text(cfg.x + 125, cfg.y + 248, '1.0× Kích Thước Thực (32u)', {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '11px',
      fontStyle: '700',
      color: PALETTE.BONE_WHITE,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3,
      resolution: textRes,
    })
    .setOrigin(0.5);
  this.textObjects.push(lbl1x);
  parent.add(lbl1x);

  const lblZoom = this.add
    .text(cfg.x + 310, cfg.y + 248, '2.25× Phóng Đại Soi Chi Tiết', {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '11px',
      fontStyle: '700',
      color: PALETTE.SOLAR_GOLD,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3,
      resolution: textRes,
    })
    .setOrigin(0.5);
  this.textObjects.push(lblZoom);
  parent.add(lblZoom);
}

export function createPaletteAndBiomePanel(
  this: ArtGalleryScene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const textRes = TextureBaker.getBakeScale();
  const panel = this.add.graphics();
  panel.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.94);
  panel.lineStyle(2, hexToNum(PALETTE.INK_DARK), 1);
  panel.fillRoundedRect(x, y, w, h, 10);
  panel.strokeRoundedRect(x, y, w, h, 10);
  parent.add(panel);

  const tViet = this.add.text(x + 16, y + 10, VIETNAMESE_VERIFICATION_STRING, {
    fontFamily: '"Be Vietnam Pro", sans-serif',
    fontSize: '15px',
    fontStyle: '800',
    color: PALETTE.BONE_WHITE,
    stroke: PALETTE.INK_DARK,
    strokeThickness: 3.5,
    resolution: textRes,
  });
  this.textObjects.push(tViet);
  parent.add(tViet);

  const tSub = this.add.text(
    x + 16,
    y + 34,
    'Bảng Màu Chuẩn (42 Màu Cố Định) · Hướng Sáng Trên-Trái (-135°) · Đầy Đủ 4 Màu Định Danh P1–P4:',
    {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '11px',
      color: PALETTE.SILVER_BRIGHT,
      resolution: textRes,
    },
  );
  this.textObjects.push(tSub);
  parent.add(tSub);

  const swatches = Object.values(PALETTE);
  const swGraphics = this.add.graphics();
  const swW = 19.5;
  const swH = 26;
  swatches.forEach((hex, idx) => {
    const sx = x + 16 + idx * (swW + 2);
    const sy = y + 56;
    swGraphics.fillStyle(hexToNum(hex), 1);
    swGraphics.lineStyle(1.5, hexToNum(PALETTE.INK_DARK), 1);
    swGraphics.fillRoundedRect(sx, sy, swW, swH, 3);
    swGraphics.strokeRoundedRect(sx, sy, swW, swH, 3);
  });
  parent.add(swGraphics);
}
