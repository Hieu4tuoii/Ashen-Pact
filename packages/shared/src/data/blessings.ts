import type { ActionBlessingId, BlessingDef, BlessingId, SkillUpgradeId } from './types.js';

export const TABLE_TECH_BLESSING_IDS = [
  'table_tech_rocket',
  'table_tech_blank_nova',
  'table_tech_prism_split',
  'table_tech_billiard_master',
] as const satisfies readonly ActionBlessingId[];

export const DASH_TECH_BLESSING_IDS = [
  'dash_tidal_ram',
  'dash_venom_wake',
  'dash_flame_shackle',
  'dash_reload_acrobat',
] as const satisfies readonly ActionBlessingId[];

export const RELOAD_TECH_BLESSING_IDS = [
  'reload_tediore_chuck',
  'reload_frost_nova',
  'reload_magnet_vortex',
  'reload_repulsor_shock',
] as const satisfies readonly ActionBlessingId[];

export const BULLET_MOD_BLESSING_IDS = [
  'bullet_split_bounce',
  'bullet_ricochet_boom',
  'bullet_heavy_pinball',
  'bullet_coop_arc_relay',
] as const satisfies readonly ActionBlessingId[];

export const CORE_ACTION_BLESSING_IDS = [
  ...TABLE_TECH_BLESSING_IDS,
  ...DASH_TECH_BLESSING_IDS,
  ...RELOAD_TECH_BLESSING_IDS,
  ...BULLET_MOD_BLESSING_IDS,
] as const satisfies readonly ActionBlessingId[];

export const SKILL_UPGRADE_BLESSING_IDS = [
  'vanguard_bastion_prism',
  'vanguard_charge',
  'ranger_arrow_volley',
  'ranger_prey_chain',
  'elementalist_vortex',
  'elementalist_twin_orbit',
  'druid_poison_roots',
  'druid_sacred_grove',
  'engineer_twin_turrets',
  'engineer_self_destruct',
] as const satisfies readonly SkillUpgradeId[];

export const ALL_PHASE1_BLESSING_IDS = [
  ...CORE_ACTION_BLESSING_IDS,
  ...SKILL_UPGRADE_BLESSING_IDS,
] as const satisfies readonly BlessingId[];

export function scaleBlessingDamage(baseDmg: number, globalFloor: number): number {
  const floor = Math.max(1, Math.round(Number.isFinite(globalFloor) ? globalFloor || 1 : 1));
  return Math.max(1, Math.round(baseDmg * (1 + 0.22 * (floor - 1))));
}

export const BLESSINGS: Record<string, BlessingDef> = {
  // ---------------------------------------------------------------------------
  // Group 1 — Barricade / Table Techs (4 Core Cards)
  // ---------------------------------------------------------------------------
  table_tech_rocket: {
    id: 'table_tech_rocket',
    nameVi: 'Chắn Chiến Hỏa Tiễn',
    nameEn: 'Rocket Barricade',
    descriptionVi:
      'Lật Chắn [E] hoặc Đập Tường phóng 2 Tên Lửa Tầm Nhiệt (26 ST Lửa/quả). Dash-Kick biến tấm chắn thành Đầu Đạn Phản Lực nổ 60 ST Lửa (r=104px).',
    descriptionEn:
      'Flipping Cover [E] or Wall-Slamming fires 2 Homing Rockets (26 Fire DMG each). Dash-Kicking a barricade launches a 620 px/s Rocket Payload exploding for 60 Fire DMG (r=104px).',
    category: 'general',
    blessingGroup: 'table_tech',
    element: 'burn',
    accentColor: '#F97316',
  },
  table_tech_blank_nova: {
    id: 'table_tech_blank_nova',
    nameVi: 'Chắn Chiến Hàn Băng Xung',
    nameEn: 'Frost Blank Nova',
    descriptionVi:
      'Lật Chắn [E] hoặc kích nổ Đập Tường mở rộng vòng xóa đạn thành r=160px và Đóng Băng 1.5s mọi kẻ địch trong vùng.',
    descriptionEn:
      'Flipping Cover [E] or triggering a Wall-Slam expands the bullet-clearing pulse to r=160px and Freezes all enemies in range for 1.5s.',
    category: 'general',
    blessingGroup: 'table_tech',
    element: 'chill',
    accentColor: '#38BDF8',
  },
  table_tech_prism_split: {
    id: 'table_tech_prism_split',
    nameVi: 'Chắn Chiến Lăng Kính',
    nameEn: 'Prism Barricade',
    descriptionVi:
      'Tấm chắn bạn lật tỏa hào quang xanh: đạn gốc bắn xuyên qua tách làm 2 tia (±12°, +20% ST, tẩm Sét). Đập Tường phóng 2 tia lăng kính Sét.',
    descriptionEn:
      'Barricades you flip radiate a prism aura: primary bullets fired through split into 2 Shock rays (±12°, +20% Additive DMG). Wall-Slams fire 2 Shock prism rays.',
    category: 'general',
    blessingGroup: 'table_tech',
    element: 'shock',
    accentColor: '#34D399',
  },
  table_tech_billiard_master: {
    id: 'table_tech_billiard_master',
    nameVi: 'Cao Thủ Bi-a Chiến Trường',
    nameEn: 'Battlefield Billiard Master',
    descriptionVi:
      'Tấm chắn, thùng nổ và khối băng do bạn sút đi tăng +35% vận tốc, nảy qua tường tối đa 3 lần như bi-a và tăng +40% ST Đập Tường.',
    descriptionEn:
      'Barricades, barrels, and ice blocks you kick gain +35% speed, ricochet off walls up to 3 times, and deal +40% Wall-Slam damage (+1 extra Boss Stagger).',
    category: 'general',
    blessingGroup: 'table_tech',
    element: 'none',
    accentColor: '#E2E8F0',
  },

  // ---------------------------------------------------------------------------
  // Group 2 — Dash Techs (4 Core Cards)
  // ---------------------------------------------------------------------------
  dash_tidal_ram: {
    id: 'dash_tidal_ram',
    nameVi: 'Cú Lướt Sóng Ngầm Đập Tường',
    nameEn: 'Tidal Wall-Ram Dash',
    descriptionVi:
      'Lướt (Dash) bọc sóng băng húc văng quái trên đường (20 ST Băng, KB=280). Nếu quái bị húc Đập Tường, hồi 60% hồi chiêu Lướt (ICD 1.2s).',
    descriptionEn:
      'Dashing shrouds you in a Frost wave that rams foes (20 Ice DMG, KB=280). Triggering a Wall-Slam refunds 60% Dash cooldown (1.2s ICD).',
    category: 'general',
    blessingGroup: 'dash_tech',
    element: 'chill',
    accentColor: '#60A5FA',
  },
  dash_venom_wake: {
    id: 'dash_venom_wake',
    nameVi: 'Vệt Lướt Thủy Ngân Độc',
    nameEn: 'Venom Mercury Wake',
    descriptionVi:
      'Lướt để lại dải Đầm Thủy Ngân Độc (3.5s). Nếu lướt cắt qua quái hoặc Dash-Kick, lập tức Nạp 50% Băng đạn / Giảm 40% Nhiệt.',
    descriptionEn:
      'Dashing leaves a 3.5s Venom Wake. Dashing through an enemy or Dash-Kicking a prop immediately reloads 50% clip ammo or vents 40% Heat.',
    category: 'general',
    blessingGroup: 'dash_tech',
    element: 'poison',
    accentColor: '#4ADE80',
  },
  dash_flame_shackle: {
    id: 'dash_flame_shackle',
    nameVi: 'Xích Lửa Quật Tường',
    nameEn: 'Flame Wall-Shackle',
    descriptionVi:
      'Khi Lướt qua gần kẻ địch (trong 88px), phóng sợi xích lửa kéo giật con quái đập thẳng vào tường hoặc Bia Chắn gần nhất (24 ST Lửa + Đập Tường).',
    descriptionEn:
      'Dashing near an enemy (within 88px) lashes a flame chain that yanks it into the nearest wall or barricade (24 Fire DMG + instant Wall-Slam).',
    category: 'general',
    blessingGroup: 'dash_tech',
    element: 'burn',
    accentColor: '#FB923C',
  },
  dash_reload_acrobat: {
    id: 'dash_reload_acrobat',
    nameVi: 'Nhào Lộn Trợ Nạp',
    nameEn: 'Acrobatic Reload Dash',
    descriptionVi:
      'Lướt khi đang Nạp đạn hoặc có Nhiệt >= 50% tua nhanh 40% tiến độ nạp / hạ 35% Nhiệt và mở rộng Khung Vàng [R] kế tiếp gấp rưỡi (35%–80%).',
    descriptionEn:
      'Dashing while reloading or at >= 50% Heat advances reload by 40% / cools 35% Heat and widens the next [R] Perfect Reload window to 35%–80%.',
    category: 'general',
    blessingGroup: 'dash_tech',
    element: 'none',
    accentColor: '#FBBF24',
  },

  // ---------------------------------------------------------------------------
  // Group 3 — Reload, Vent & Finisher Techs (4 Core Cards)
  // ---------------------------------------------------------------------------
  reload_tediore_chuck: {
    id: 'reload_tediore_chuck',
    nameVi: 'Băng Đạn Quăng Nổ',
    nameEn: 'Volatile Magazine Chuck',
    descriptionVi:
      'Khi Perfect Reload / Tactical Vent [R] hoặc Đòn 3 Cận chiến trúng đích, ném vỏ băng đạn / lõi nhiệt về con trỏ, nổ (18 + 4 × đạn đã bắn) ST Lửa.',
    descriptionEn:
      'On Perfect Reload, Tactical Vent [R], or 3rd Melee hit/parry, hurls a volatile magazine toward the cursor exploding for (18 + 4 × rounds spent) Fire DMG.',
    category: 'general',
    blessingGroup: 'reload_tech',
    element: 'burn',
    accentColor: '#EF4444',
  },
  reload_frost_nova: {
    id: 'reload_frost_nova',
    nameVi: 'Vòng Hàn Khí Thay Đạn',
    nameEn: 'Reload Frost Nova',
    descriptionVi:
      'Perfect Reload / Tactical Vent [R] hoặc Đòn 3 Cận chiến trúng đích phóng vòng băng (r=110px, 22 ST Băng), áp 2 tầng Lạnh và xóa đạn địch sát người.',
    descriptionEn:
      'On Perfect Reload, Tactical Vent [R], or 3rd Melee hit/parry, pulses a Frost Nova (r=110px, 22 Ice DMG) applying 2 Chill stacks and clearing nearby bullets.',
    category: 'general',
    blessingGroup: 'reload_tech',
    element: 'chill',
    accentColor: '#38BDF8',
  },
  reload_magnet_vortex: {
    id: 'reload_magnet_vortex',
    nameVi: 'Xung Từ Trường Gom Quái',
    nameEn: 'Magnetic Reload Vortex',
    descriptionVi:
      'Perfect Reload / Tactical Vent [R] hoặc Đòn 3 Cận chiến trúng đích bắn mỏ neo từ trường về trước 140px, hút gom quái xung quanh chụm lại trong 0.8s.',
    descriptionEn:
      'On Perfect Reload, Tactical Vent [R], or 3rd Melee hit/parry, fires a magnetic anchor 140px ahead that pulls surrounding enemies together for 0.8s.',
    category: 'general',
    blessingGroup: 'reload_tech',
    element: 'shock',
    accentColor: '#A78BFA',
  },
  reload_repulsor_shock: {
    id: 'reload_repulsor_shock',
    nameVi: 'Xung Chấn Đẩy Lùi Đập Tường',
    nameEn: 'Repulsor Shockwave',
    descriptionVi:
      'Perfect Reload / Tactical Vent [R] hoặc Đòn 3 Cận chiến trúng đích phóng sóng xung kích nón 140° (r=165px), hất văng quái dính nguyên tố Đập Tường.',
    descriptionEn:
      'On Perfect Reload, Tactical Vent [R], or 3rd Melee hit/parry, unleashes a 140° repulsor cone (r=165px) blasting status-afflicted foes into walls (KB=260).',
    category: 'general',
    blessingGroup: 'reload_tech',
    element: 'none',
    accentColor: '#F59E0B',
  },

  // ---------------------------------------------------------------------------
  // Group 4 — Geometry & Co-op Bullet Mods (4 Core Cards)
  // ---------------------------------------------------------------------------
  bullet_split_bounce: {
    id: 'bullet_split_bounce',
    nameVi: 'Đạn Phân Thân Nảy Tường',
    nameEn: 'Split-Bounce Rounds',
    descriptionVi:
      'Đạn nhận +1 lần nảy tường. Khi đạn gốc chạm tường hoặc Bia Chắn lần đầu, tách đôi thành 2 viên đạn con (mỗi viên gây 70% ST gốc) bay góc chữ V.',
    descriptionEn:
      'Projectiles gain +1 wall bounce. On their first wall or barricade bounce, primary projectiles split into 2 child rounds (70% DMG each) in a V-pattern.',
    category: 'general',
    blessingGroup: 'bullet_mod',
    element: 'none',
    accentColor: '#CBD5E1',
  },
  bullet_ricochet_boom: {
    id: 'bullet_ricochet_boom',
    nameVi: 'Đạn Nảy Nổ Địa Chấn',
    nameEn: 'Seismic Ricochet Rounds',
    descriptionVi:
      'Mỗi khi đạn nảy qua tường hoặc vật chắn, tại điểm va chạm nổ Xung Lửa (24 ST × procCoeff, r=64px, KB=200) hất văng quái đứng gần tường.',
    descriptionEn:
      'Whenever a projectile bounces off a wall or barricade, it triggers a Seismic Fire Blast (24 DMG × procCoeff, r=64px, KB=200) knocking nearby foes away.',
    category: 'general',
    blessingGroup: 'bullet_mod',
    element: 'burn',
    accentColor: '#F97316',
  },
  bullet_heavy_pinball: {
    id: 'bullet_heavy_pinball',
    nameVi: 'Đạn Bi Sắt Đẩy Lùi',
    nameEn: 'Heavy Pinball Rounds',
    descriptionVi:
      'Đạn và đòn đánh tăng +50% Lực Đẩy Lùi. Kẻ địch bị Đập Tường nảy bật ngược lại, va vào quái khác sẽ làm cả hai cùng Choáng 0.8s.',
    descriptionEn:
      'Attacks gain +50% Knockback. Enemies Wall-Slammed ricochet backward like pinballs, stunning both enemies for 0.8s if they collide with another foe.',
    category: 'general',
    blessingGroup: 'bullet_mod',
    element: 'none',
    accentColor: '#94A3B8',
  },
  bullet_coop_arc_relay: {
    id: 'bullet_coop_arc_relay',
    nameVi: 'Trạm Tiếp Sóng Đồng Minh',
    nameEn: 'Co-op Arc Relay',
    descriptionVi:
      'Khi đạn hoặc nhát chém đi ngang qua Đồng Đội, Summon hoặc Bia Chắn Đã Lật (trong 56px), thực thể đó phóng tia Sét (20 ST × procCoeff) vào quái gần nhất.',
    descriptionEn:
      'When your shots or swings pass within 56px of an Ally, Summon, or Flipped Barricade, that entity zaps the nearest enemy with a Lightning Arc (20 DMG × procCoeff).',
    category: 'general',
    blessingGroup: 'bullet_mod',
    element: 'shock',
    accentColor: '#FACC15',
  },

  // ---------------------------------------------------------------------------
  // Group 5 — 10 Character Skill Upgrades (Phase 1)
  // ---------------------------------------------------------------------------
  vanguard_bastion_prism: {
    id: 'vanguard_bastion_prism',
    nameVi: 'Nâng Cấp: Pháo Đài Phản Xạ',
    nameEn: 'Bastion Prism',
    descriptionVi:
      'Khiên mở rộng 160°/bao bọc bảo hộ: đạn địch chạm khiên bật ngược thành đạn Lửa (20 ST); đạn đồng minh bắn qua khiên tách làm 2 tia.',
    descriptionEn:
      'Widens Ruby Shield Wall: enemy bullets hitting the shield reflect as Fire bolts (20 DMG), and primary allied bullets fired through split into 2 rays.',
    category: 'skill_upgrade',
    blessingGroup: 'skill_upgrade',
    element: 'burn',
    characterId: 'vanguard',
    accentColor: '#F97316',
  },
  vanguard_charge: {
    id: 'vanguard_charge',
    nameVi: 'Nâng Cấp: Xung Phong Khiên',
    nameEn: 'Shield Charge',
    descriptionVi:
      'Tái kích hoạt Tường Khiên lao mạnh về phía trước 130px, húc văng cả hàng quái đập vào tường (Wall-Slam) và phóng sóng xung kích.',
    descriptionEn:
      'Reactivating Ruby Shield Wall charges 130px forward, ramming enemies into walls (triggering Wall-Slam) and releasing a heavy shockwave.',
    category: 'skill_upgrade',
    blessingGroup: 'skill_upgrade',
    element: 'none',
    characterId: 'vanguard',
    accentColor: '#84CC16',
  },
  ranger_arrow_volley: {
    id: 'ranger_arrow_volley',
    nameVi: 'Nâng Cấp: Mưa Tên Khóa Góc',
    nameEn: 'Arrow Volley',
    descriptionVi:
      'Mũi Tên Săn Mồi phóng 5 mũi tên hình quạt xuyên thấu; mũi tên cắm vào tường phát nổ nhỏ và Đánh Dấu toàn bộ quái quanh điểm cắm.',
    descriptionEn:
      'Predator Arrow fires a 5-arrow piercing fan; arrows striking walls detonate in a micro-blast that Marks all nearby enemies.',
    category: 'skill_upgrade',
    blessingGroup: 'skill_upgrade',
    element: 'none',
    characterId: 'ranger',
    accentColor: '#10B981',
  },
  ranger_prey_chain: {
    id: 'ranger_prey_chain',
    nameVi: 'Nâng Cấp: Dây Xích Con Mồi',
    nameEn: 'Prey Chain',
    descriptionVi:
      'Các mục tiêu bị Đánh Dấu trong 220px nối dây xích đỏ: chia sẻ 35% sát thương nhận vào và kéo cả đám bay theo khi bị đẩy lùi.',
    descriptionEn:
      'Marked targets within 220px are linked by crimson chains, sharing 35% of damage taken and pulling linked foes along when knocked back.',
    category: 'skill_upgrade',
    blessingGroup: 'skill_upgrade',
    element: 'none',
    characterId: 'ranger',
    accentColor: '#34D399',
  },
  elementalist_vortex: {
    id: 'elementalist_vortex',
    nameVi: 'Nâng Cấp: Hố Đen Nguyên Tố',
    nameEn: 'Elemental Vortex',
    descriptionVi:
      'Vùng Cầu Nguyên Tố tạo lực xoáy hút quái vật và các vật thể lăn (Thùng Nổ/Bào Tử) trong 150px gom vào tâm vùng nổ.',
    descriptionEn:
      'Elemental Orb zone generates a gravitational vortex pulling enemies and rolling props within 150px toward its center.',
    category: 'skill_upgrade',
    blessingGroup: 'skill_upgrade',
    element: 'none',
    characterId: 'elementalist',
    accentColor: '#60A5FA',
  },
  elementalist_twin_orbit: {
    id: 'elementalist_twin_orbit',
    nameVi: 'Nâng Cấp: Song Tinh Cắt Không Gian',
    nameEn: 'Twin Orbit',
    descriptionVi:
      'Ném ra 2 vùng nguyên tố (hiện tại & kế tiếp) nối ở giữa bằng Tia Cắt Phản Ứng (24 ST/s), kích hoạt phản ứng nguyên tố ngay lập tức.',
    descriptionEn:
      'Deploys twin Elemental Zones (current and next element) linked by a Reaction Cutting Beam (24 DMG/s) that triggers reactions immediately.',
    category: 'skill_upgrade',
    blessingGroup: 'skill_upgrade',
    element: 'burn',
    characterId: 'elementalist',
    accentColor: '#C084FC',
  },
  druid_poison_roots: {
    id: 'druid_poison_roots',
    nameVi: 'Nâng Cấp: Rễ Gai Quất Tường',
    nameEn: 'Poison Roots',
    descriptionVi:
      'Cứ mỗi 1.8s, Cây Thiêng phóng rễ gai quấn lấy quái trong vùng và quật chúng vào bức tường gần nhất (Wall-Slam) kèm độc tố.',
    descriptionEn:
      'Every 1.8s, Sacred Tree lashes briar roots that yank enemies in range into the nearest wall (Wall-Slam) while applying Poison.',
    category: 'skill_upgrade',
    blessingGroup: 'skill_upgrade',
    element: 'poison',
    characterId: 'druid',
    accentColor: '#4ADE80',
  },
  druid_sacred_grove: {
    id: 'druid_sacred_grove',
    nameVi: 'Nâng Cấp: Rừng Thiêng Cộng Sinh',
    nameEn: 'Sacred Grove',
    descriptionVi:
      'Trồng 2 Cây Thiêng cùng lúc; đạn của cả đội bắn xuyên qua tán Cây Thiêng được cường hóa +1 lần nảy thông minh.',
    descriptionEn:
      'Plants 2 Sacred Trees simultaneously; allied bullets fired through a Sacred Tree canopy gain +1 Smart Bounce.',
    category: 'skill_upgrade',
    blessingGroup: 'skill_upgrade',
    element: 'poison',
    characterId: 'druid',
    accentColor: '#2DD4BF',
  },
  engineer_twin_turrets: {
    id: 'engineer_twin_turrets',
    nameVi: 'Nâng Cấp: Trụ Kép Giao Thoa',
    nameEn: 'Twin Turrets',
    descriptionVi:
      'Đặt 2 Trụ Tesla hoạt động song song; giữa 2 trụ tự động căng Hàng Rào Laser Sét làm chậm 50% kẻ địch đi cắt ngang.',
    descriptionEn:
      'Allows 2 Tesla Turrets active at once, automatically linking them with a Lightning Laser Fence that slows enemies by 50%.',
    category: 'skill_upgrade',
    blessingGroup: 'skill_upgrade',
    element: 'shock',
    characterId: 'engineer',
    accentColor: '#F59E0B',
  },
  engineer_self_destruct: {
    id: 'engineer_self_destruct',
    nameVi: 'Nâng Cấp: Quá Tải Lò Phản Ứng',
    nameEn: 'Overload Self-Destruct',
    descriptionVi:
      'Tái kích hoạt kỹ năng hoặc khi hết giờ biến Trụ Tesla thành Robot Cảm Tử lao vào cụm quái đông nhất, nổ 45 ST Lửa + Sét (r=130px).',
    descriptionEn:
      'Reactivating Skill or turret expiry turns Tesla Turret into a kamikaze bot that charges the densest enemy cluster and explodes for 45 Fire+Shock DMG (r=130px).',
    category: 'skill_upgrade',
    blessingGroup: 'skill_upgrade',
    element: 'burn',
    characterId: 'engineer',
    accentColor: '#EF4444',
  },
};

export const BLESSING_LIST: readonly BlessingDef[] = Object.values(BLESSINGS);
