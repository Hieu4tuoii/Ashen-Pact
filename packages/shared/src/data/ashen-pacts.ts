import type { AshenPactId, AshenRelicId } from './types.js';

export const ALL_ASHEN_PACT_IDS = [
  'pact_soul_chain',
  'pact_shattered_glass',
  'pact_searing_trigger',
  'pact_volatile_arsenal',
  'pact_ashen_hunted',
  'pact_ricochet_vow',
] as const satisfies readonly AshenPactId[];

export const ALL_ASHEN_RELIC_IDS = [
  'relic_blood_oath_tether',
  'relic_black_crystal_heart',
  'relic_perpetual_core',
  'relic_master_forge_seal',
  'relic_executioner_scythe',
  'relic_ancient_geometry_eye',
] as const satisfies readonly AshenRelicId[];

export const PACT_TO_RELIC_ID: Record<AshenPactId, AshenRelicId> = {
  pact_soul_chain: 'relic_blood_oath_tether',
  pact_shattered_glass: 'relic_black_crystal_heart',
  pact_searing_trigger: 'relic_perpetual_core',
  pact_volatile_arsenal: 'relic_master_forge_seal',
  pact_ashen_hunted: 'relic_executioner_scythe',
  pact_ricochet_vow: 'relic_ancient_geometry_eye',
};

export const RELIC_TO_PACT_ID: Record<AshenRelicId, AshenPactId> = {
  relic_blood_oath_tether: 'pact_soul_chain',
  relic_black_crystal_heart: 'pact_shattered_glass',
  relic_perpetual_core: 'pact_searing_trigger',
  relic_master_forge_seal: 'pact_volatile_arsenal',
  relic_executioner_scythe: 'pact_ashen_hunted',
  relic_ancient_geometry_eye: 'pact_ricochet_vow',
};

export interface AshenPactDef {
  id: AshenPactId;
  relicId: AshenRelicId;
  nameVi: string;
  nameEn: string;
  curseVi: string;
  curseEn: string;
  descVi: string;
  descEn: string;
  relicNameVi: string;
  relicNameEn: string;
  relicDescVi: string;
  relicDescEn: string;
  accentColor: string;
}

export interface AshenRelicDef {
  id: AshenRelicId;
  pactId: AshenPactId;
  nameVi: string;
  nameEn: string;
  descVi: string;
  descEn: string;
  tradeoffVi: string;
  tradeoffEn: string;
  accentColor: string;
}

export function scaleRelicDamage(baseDmg: number, globalFloor: number): number {
  const floor = Math.max(1, Math.round(Number.isFinite(globalFloor) ? globalFloor || 1 : 1));
  return Math.max(1, Math.round(baseDmg * (1 + 0.22 * (floor - 1))));
}

export const ASHEN_RELICS: Record<AshenRelicId, AshenRelicDef> = {
  relic_blood_oath_tether: {
    id: 'relic_blood_oath_tether',
    pactId: 'pact_soul_chain',
    nameVi: 'Dây Cắt Huyết Thệ',
    nameEn: 'Blood Oath Tether',
    descVi:
      'Xóa bỏ hình phạt rút giáp! Giữa bạn và đồng đội (hoặc kẻ địch gần nhất trong 260px khi Solo) luôn căng một Tia Laser Lửa-Sét (base 22 DMG/s) đốt cháy mọi quái vật đi cắt ngang.',
    descEn:
      'Removes the armor drain penalty! Stretches a permanent Fire-Shock Laser Tether (base 22 DMG/s) between you and your nearest ally (or nearest enemy within 260px in Solo) burning foes crossing it.',
    tradeoffVi: 'Tia laser chỉ nối với mục tiêu trong tầm 260px.',
    tradeoffEn: 'Laser tether only links to targets within 260px range.',
    accentColor: '#F59E0B',
  },
  relic_black_crystal_heart: {
    id: 'relic_black_crystal_heart',
    pactId: 'pact_shattered_glass',
    nameVi: 'Trái Tim Pha Lê Đen',
    nameEn: 'Black Crystal Heart',
    descVi:
      'Khôi phục lại Giáp gốc (nhưng thời gian chờ hồi Giáp chậm hơn +0.8s). Phát bắn đầu tiên sau mỗi lần Perfect Reload / Vent [R] (hoặc Đòn 3 Cận chiến) nhận +65% Additive Damage và xuyên khiên.',
    descEn:
      'Restores original Max Armor (+0.8s slower armor regen delay). First shot after every Perfect Reload / Vent [R] (or 3rd Melee hit) gains +65% Additive Damage and pierces front shields.',
    tradeoffVi: 'Thời gian chờ hồi Giáp chậm hơn +0.8s.',
    tradeoffEn: 'Armor regeneration delay is +0.8s slower.',
    accentColor: '#A855F7',
  },
  relic_perpetual_core: {
    id: 'relic_perpetual_core',
    pactId: 'pact_searing_trigger',
    nameVi: 'Lõi Động Cơ Vĩnh Cửu',
    nameEn: 'Perpetual Engine Core',
    descVi:
      'Xóa mức phạt giật giáp và khóa cò. Khung Vàng [R] mở rộng thêm +25%, và mỗi khi thực hiện Perfect Reload / Vent [R], từ lưng bạn tự động phóng 3 Quả Tên Lửa Tro Tàn (base 20 DMG Lửa/quả).',
    descEn:
      'Removes backfire penalties. Expands the [R] Golden Window by +25%, and every Perfect Reload / Vent [R] automatically launches 3 Ashen Homing Rockets (base 20 Fire DMG each) from your back.',
    tradeoffVi: 'Đòi hỏi duy trì nhịp bấm [R] chuẩn xác để tối ưu hỏa lực.',
    tradeoffEn: 'Requires active [R] cadence timing to maximize rocket salvos.',
    accentColor: '#F97316',
  },
  relic_master_forge_seal: {
    id: 'relic_master_forge_seal',
    pactId: 'pact_volatile_arsenal',
    nameVi: 'Ấn Rèn Bậc Thầy',
    nameEn: 'Master Forge Seal',
    descVi:
      'Chấm dứt biến hình ngẫu nhiên và khôi phục lại vũ khí gốc. Vũ khí đó được Nâng Cấp Bậc Tinh Luyện Level +1 (+20% Base DMG) VÀ gắn miễn phí +1 Bản Độ Búa Rèn (Weapon Mutator).',
    descEn:
      'Stops random morphing and restores your original weapon, upgrading that slot by +1 Refine Level (+20% Base DMG) AND attaching +1 free Weapon Mutator.',
    tradeoffVi: 'Gắn cố định vào ô vũ khí đã trải qua thử thách.',
    tradeoffEn: 'Bound to the weapon slot that endured the trial.',
    accentColor: '#FBBF24',
  },
  relic_executioner_scythe: {
    id: 'relic_executioner_scythe',
    pactId: 'pact_ashen_hunted',
    nameVi: 'Lưỡi Hái Đao Phủ',
    nameEn: 'Executioner Scythe',
    descVi:
      'Bóng Ma Đao Phủ quy phục bạn! Mỗi khi bạn dùng Kỹ năng Nhân vật hoặc kích hoạt Wall-Slam (ICD = 4.0s), Đao Phủ hiện ra chém nhát Lưỡi Hái Chữ Thập (base 45 DMG) kết liễu ngay quái thường có máu <= 20%.',
    descEn:
      'The Ashen Executioner serves you! Casting your Character Skill or triggering a Wall-Slam (4.0s ICD) summons a Cross Scythe slash (base 45 DMG) that instantly executes regular enemies at <= 20% HP.',
    tradeoffVi: 'Thời gian hồi nội tại 4.0s giữa các nhát chém.',
    tradeoffEn: '4.0s internal cooldown between Executioner slashes.',
    accentColor: '#EF4444',
  },
  relic_ancient_geometry_eye: {
    id: 'relic_ancient_geometry_eye',
    pactId: 'pact_ricochet_vow',
    nameVi: 'Con Mắt Hình Học Cổ Đại',
    nameEn: 'Ancient Geometry Eye',
    descVi:
      'Giảm mức phạt bắn thẳng xuống chỉ còn -10%, đồng thời mọi vũ khí nhận vĩnh viễn +1 lần Nảy Tường Thông Minh (Smart Bounce), +55% Additive Damage cho đạn nảy, và +35% sát thương Wall-Slam.',
    descEn:
      'Reduces direct-shot penalty to only -10%, and grants all weapons +1 Smart Bounce, +55% Additive Damage on bounced shots, and +35% Wall-Slam damage.',
    tradeoffVi: 'Đạn bắn thẳng trực tiếp vẫn chịu phạt nhẹ -10% sát thương.',
    tradeoffEn: 'Direct non-bounced shots still deal -10% damage.',
    accentColor: '#38BDF8',
  },
};

export const ASHEN_PACTS: Record<AshenPactId, AshenPactDef> = {
  pact_soul_chain: {
    id: 'pact_soul_chain',
    relicId: 'relic_blood_oath_tether',
    nameVi: 'Khế Ước Xiềng Xích Linh Hồn',
    nameEn: 'Pact of the Soul Chain',
    curseVi:
      'Một Dây Xích Năng Lượng Mềm nối giữa bạn và Đồng Đội gần nhất (hoặc Kẻ Địch đang sống có maxHp cao nhất khi chơi Solo). Đứng cách quá 260px lâu hơn 2.5s sẽ bị rút 1 Giáp mỗi 2.5s (không trừ HP).',
    curseEn:
      'A Soft Energy Chain links you to your nearest Ally (or highest-maxHp living Enemy in Solo). Standing > 260px apart for > 2.5s drains 1 Armor every 2.5s (never drains HP).',
    descVi:
      'Một Dây Xích Năng Lượng Mềm nối giữa bạn và Đồng Đội gần nhất (hoặc Kẻ Địch đang sống có maxHp cao nhất khi chơi Solo). Đứng cách quá 260px lâu hơn 2.5s sẽ bị rút 1 Giáp mỗi 2.5s (không trừ HP).',
    descEn:
      'A Soft Energy Chain links you to your nearest Ally (or highest-maxHp living Enemy in Solo). Standing > 260px apart for > 2.5s drains 1 Armor every 2.5s (never drains HP).',
    relicNameVi: ASHEN_RELICS.relic_blood_oath_tether.nameVi,
    relicNameEn: ASHEN_RELICS.relic_blood_oath_tether.nameEn,
    relicDescVi: ASHEN_RELICS.relic_blood_oath_tether.descVi,
    relicDescEn: ASHEN_RELICS.relic_blood_oath_tether.descEn,
    accentColor: '#F43F5E',
  },
  pact_shattered_glass: {
    id: 'pact_shattered_glass',
    relicId: 'relic_black_crystal_heart',
    nameVi: 'Khế Ước Thân Xác Thủy Tinh',
    nameEn: 'Pact of Shattered Glass',
    curseVi:
      'Trong suốt Biome này (kể cả khi đánh Boss), Giáp tối đa của bạn bị giảm đi 50% (làm tròn xuống, tối thiểu còn 1 Giáp), đổi lại bạn được +20% Tốc độ di chuyển để né đòn.',
    curseEn:
      'Throughout this Biome (including the Boss fight), your Max Armor is reduced by 50% (floored, min 1 Armor), granting +20% Move Speed to dodge attacks.',
    descVi:
      'Trong suốt Biome này (kể cả khi đánh Boss), Giáp tối đa của bạn bị giảm đi 50% (làm tròn xuống, tối thiểu còn 1 Giáp), đổi lại bạn được +20% Tốc độ di chuyển để né đòn.',
    descEn:
      'Throughout this Biome (including the Boss fight), your Max Armor is reduced by 50% (floored, min 1 Armor), granting +20% Move Speed to dodge attacks.',
    relicNameVi: ASHEN_RELICS.relic_black_crystal_heart.nameVi,
    relicNameEn: ASHEN_RELICS.relic_black_crystal_heart.nameEn,
    relicDescVi: ASHEN_RELICS.relic_black_crystal_heart.descVi,
    relicDescEn: ASHEN_RELICS.relic_black_crystal_heart.descEn,
    accentColor: '#A855F7',
  },
  pact_searing_trigger: {
    id: 'pact_searing_trigger',
    relicId: 'relic_perpetual_core',
    nameVi: 'Khế Ước Cò Súng Nóng Bỏng',
    nameEn: 'Pact of the Searing Trigger',
    curseVi:
      'Trong suốt Biome này, nếu bạn bấm [R] trượt ngoài Khung Vàng hoặc để vũ khí Quá Nhiệt chạm 100%, súng giật lửa làm bạn mất 1 Giáp và khóa cò thêm 0.4s.',
    curseEn:
      'Throughout this Biome, missing the [R] Golden Window or letting weapon Overheat hit 100% backfires, costing 1 Armor and locking your trigger for +0.4s.',
    descVi:
      'Trong suốt Biome này, nếu bạn bấm [R] trượt ngoài Khung Vàng hoặc để vũ khí Quá Nhiệt chạm 100%, súng giật lửa làm bạn mất 1 Giáp và khóa cò thêm 0.4s.',
    descEn:
      'Throughout this Biome, missing the [R] Golden Window or letting weapon Overheat hit 100% backfires, costing 1 Armor and locking your trigger for +0.4s.',
    relicNameVi: ASHEN_RELICS.relic_perpetual_core.nameVi,
    relicNameEn: ASHEN_RELICS.relic_perpetual_core.nameEn,
    relicDescVi: ASHEN_RELICS.relic_perpetual_core.descVi,
    relicDescEn: ASHEN_RELICS.relic_perpetual_core.descEn,
    accentColor: '#F97316',
  },
  pact_volatile_arsenal: {
    id: 'pact_volatile_arsenal',
    relicId: 'relic_master_forge_seal',
    nameVi: 'Khế Ước Loạn Đao Hoán Vũ',
    nameEn: 'Pact of the Volatile Arsenal',
    curseVi:
      'Lưu lại vũ khí đang cầm. Trong suốt Biome này, cứ mỗi khi dọn xong 1 đợt quái (Wave) hoặc mỗi 20 giây trong phòng Boss, ô súng đó tự động biến hình ngẫu nhiên theo độ hiếm của Biome hiện tại.',
    curseEn:
      'Saves your equipped weapon. Throughout this Biome, after every combat Wave or every 20s in a Boss room, that weapon slot morphs randomly into another weapon from the current Biome rarity pool.',
    descVi:
      'Lưu lại vũ khí đang cầm. Trong suốt Biome này, cứ mỗi khi dọn xong 1 đợt quái (Wave) hoặc mỗi 20 giây trong phòng Boss, ô súng đó tự động biến hình ngẫu nhiên theo độ hiếm của Biome hiện tại.',
    descEn:
      'Saves your equipped weapon. Throughout this Biome, after every combat Wave or every 20s in a Boss room, that weapon slot morphs randomly into another weapon from the current Biome rarity pool.',
    relicNameVi: ASHEN_RELICS.relic_master_forge_seal.nameVi,
    relicNameEn: ASHEN_RELICS.relic_master_forge_seal.nameEn,
    relicDescVi: ASHEN_RELICS.relic_master_forge_seal.descVi,
    relicDescEn: ASHEN_RELICS.relic_master_forge_seal.descEn,
    accentColor: '#FBBF24',
  },
  pact_ashen_hunted: {
    id: 'pact_ashen_hunted',
    relicId: 'relic_executioner_scythe',
    nameVi: 'Khế Ước Tử Thần Truy Sát',
    nameEn: 'Pact of the Ashen Hunted',
    curseVi:
      'Trong mọi phòng giao tranh và phòng Boss của Biome này, xuất hiện tối đa 1 Bóng Ma Đao Phủ bất tử đi bộ truy đuổi và chém sóng lửa về phía người ký, chỉ biến mất khi phòng được dọn sạch.',
    curseEn:
      'In every combat and Boss room of this Biome, spawns up to 1 immortal Ashen Executioner that stalks signed players and slashes fire waves at them until the room is cleared.',
    descVi:
      'Trong mọi phòng giao tranh và phòng Boss của Biome này, xuất hiện tối đa 1 Bóng Ma Đao Phủ bất tử đi bộ truy đuổi và chém sóng lửa về phía người ký, chỉ biến mất khi phòng được dọn sạch.',
    descEn:
      'In every combat and Boss room of this Biome, spawns up to 1 immortal Ashen Executioner that stalks signed players and slashes fire waves at them until the room is cleared.',
    relicNameVi: ASHEN_RELICS.relic_executioner_scythe.nameVi,
    relicNameEn: ASHEN_RELICS.relic_executioner_scythe.nameEn,
    relicDescVi: ASHEN_RELICS.relic_executioner_scythe.descVi,
    relicDescEn: ASHEN_RELICS.relic_executioner_scythe.descEn,
    accentColor: '#EF4444',
  },
  pact_ricochet_vow: {
    id: 'pact_ricochet_vow',
    relicId: 'relic_ancient_geometry_eye',
    nameVi: 'Khế Ước Đạn Đạo Phản Chiếu',
    nameEn: 'Pact of the Ricochet Vow',
    curseVi:
      'Trong suốt Biome này, đạn bắn thẳng trực tiếp vào quái bị giảm 35% sát thương; nhưng đạn sau khi nảy qua tường/bia chắn hoặc sát thương từ Wall-Slam / Đồ Chơi Phòng nhận +70% Additive Damage và +1 lần nảy.',
    curseEn:
      'Throughout this Biome, direct shots deal -35% damage; shots after bouncing off walls/barricades or damage from Wall-Slams / Room Props gain +70% Additive Damage and +1 bounce.',
    descVi:
      'Trong suốt Biome này, đạn bắn thẳng trực tiếp vào quái bị giảm 35% sát thương; nhưng đạn sau khi nảy qua tường/bia chắn hoặc sát thương từ Wall-Slam / Đồ Chơi Phòng nhận +70% Additive Damage và +1 lần nảy.',
    descEn:
      'Throughout this Biome, direct shots deal -35% damage; shots after bouncing off walls/barricades or damage from Wall-Slams / Room Props gain +70% Additive Damage and +1 bounce.',
    relicNameVi: ASHEN_RELICS.relic_ancient_geometry_eye.nameVi,
    relicNameEn: ASHEN_RELICS.relic_ancient_geometry_eye.nameEn,
    relicDescVi: ASHEN_RELICS.relic_ancient_geometry_eye.descVi,
    relicDescEn: ASHEN_RELICS.relic_ancient_geometry_eye.descEn,
    accentColor: '#38BDF8',
  },
};
