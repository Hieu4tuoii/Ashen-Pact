import type { WeaponCadenceKind, WeaponCategory, WeaponMutatorId } from './types.js';
import { WEAPONS } from './weapons.js';

export interface WeaponMutatorDef {
  id: WeaponMutatorId;
  nameVi: string;
  nameEn: string;
  descVi: string;
  descEn: string;
  compatibleCadences: readonly WeaponCadenceKind[];
  allowedCategories?: readonly WeaponCategory[];
  excludedCategories?: readonly WeaponCategory[];
  phase: 1 | 4;
}

export const MAX_MUTATORS_PER_WEAPON_SLOT = 2;

export const CORE_WEAPON_MUTATOR_IDS: readonly WeaponMutatorId[] = [
  'mutator_finale_jolt',
  'mutator_gravity_singularity',
  'mutator_shockwave_edge',
  'mutator_chain_harpoon',
  'mutator_prism_splitter',
  'mutator_thermal_meltdown',
];

export const PHASE4_WEAPON_MUTATOR_IDS: readonly WeaponMutatorId[] = [
  'mutator_holo_decoy_gun',
  'mutator_cluster_mortar',
  'mutator_boomerang_core',
  'mutator_elemental_infusion',
];

export const WEAPON_MUTATORS: Record<WeaponMutatorId, WeaponMutatorDef> = {
  mutator_finale_jolt: {
    id: 'mutator_finale_jolt',
    nameVi: 'Nòng Nổ Phản Lực',
    nameEn: 'Finale Jolt Barrel',
    descVi: '+20% tốc bắn; Phát Cuối Băng hoặc Xả Nhiệt Chiến Thuật [R] bắn chùm 3 tia (+40% sát thương) và đẩy lùi an toàn 48px.',
    descEn: '+20% fire rate; Finale Shot or Tactical Vent [R] fires a 3-burst (+40% additive DMG) and safely recoils 48px backward.',
    compatibleCadences: ['CLIP_RELOAD', 'HEAT_VENT'],
    excludedCategories: ['melee'],
    phase: 1,
  },
  mutator_gravity_singularity: {
    id: 'mutator_gravity_singularity',
    nameVi: 'Cực Điểm Hấp Dẫn',
    nameEn: 'Gravity Singularity Core',
    descVi: 'Phát Cuối Băng hoặc phát đầu sau Nạp Chuẩn / Xả Nhiệt [R] biến kẻ địch trúng đạn thành Cực Điểm Hấp Dẫn 1.8s hút mục tiêu trong 140px.',
    descEn: 'Finale Shot or first shot after Perfect Reload / Tactical Vent [R] turns the hit enemy into a 1.8s Gravity Singularity pulling targets within 140px.',
    compatibleCadences: ['CLIP_RELOAD', 'HEAT_VENT', 'MELEE_COMBO'],
    phase: 1,
  },
  mutator_shockwave_edge: {
    id: 'mutator_shockwave_edge',
    nameVi: 'Lưỡi Đao Sóng Xung Kích',
    nameEn: 'Shockwave Edge',
    descVi: 'Tăng 30% tầm quét cận chiến và phóng sóng kiếm tầm ngắn 180px gây 60% sát thương mỗi nhát chém.',
    descEn: '+30% melee swing range and launches a 180px shockwave blade dealing 60% damage on every swing.',
    compatibleCadences: ['MELEE_COMBO'],
    allowedCategories: ['melee'],
    phase: 1,
  },
  mutator_chain_harpoon: {
    id: 'mutator_chain_harpoon',
    nameVi: 'Móc Xích Kéo Ngược',
    nameEn: 'Chain Harpoon',
    descVi: 'Phát Cuối Băng hoặc phát đầu sau Nạp Chuẩn / Xả Nhiệt [R] phóng móc xích kéo kẻ địch va thẳng vào bàn chắn đã lật hoặc tường trong 220px gây Choáng Đập Tường.',
    descEn: 'Finale Shot or first shot after Perfect Reload / Tactical Vent [R] yanks hit enemy into nearest flipped cover or wall within 220px, triggering Wall Slam.',
    compatibleCadences: ['CLIP_RELOAD', 'HEAT_VENT'],
    excludedCategories: ['melee'],
    phase: 1,
  },
  mutator_prism_splitter: {
    id: 'mutator_prism_splitter',
    nameVi: 'Thấu Kính Phân Nhánh',
    nameEn: 'Prism Splitter Lens',
    descVi: 'Giảm 20% sát thương mỗi tia nhưng tách mỗi phát bắn thành 3 tia song song (tối đa 9 viên mỗi lần bóp cò).',
    descEn: '-20% damage per pellet, splits every shot into 3 rays (strictly capped at 9 pellets per trigger).',
    compatibleCadences: ['CLIP_RELOAD', 'HEAT_VENT'],
    excludedCategories: ['melee'],
    phase: 1,
  },
  mutator_thermal_meltdown: {
    id: 'mutator_thermal_meltdown',
    nameVi: 'Lõi Nhiệt Nóng Chảy',
    nameEn: 'Thermal Meltdown Core',
    descVi: 'Mở rộng +25% Vùng Vàng Nạp Đạn / Vùng Cam Quá Nhiệt và đạn cường hóa xuyên hoàn toàn khiên chắn phía trước của Shielder.',
    descEn: 'Expands Perfect Reload Golden Window & Orange Heat Zone by +25%, and empowered shots bypass front shields.',
    compatibleCadences: ['CLIP_RELOAD', 'HEAT_VENT'],
    excludedCategories: ['melee'],
    phase: 1,
  },
  mutator_holo_decoy_gun: {
    id: 'mutator_holo_decoy_gun',
    nameVi: 'Bóng Pháo Ảnh Phản Xạ',
    nameEn: 'Holo-Decoy Gun',
    descVi:
      'Khi Nạp Chuẩn / Xả Nhiệt [R], để lại Bóng Pháo Ảnh (3.5s, tối đa 1 bóng) bắn phụ họa (40% ST) về phía con trỏ chuột.',
    descEn:
      'On Perfect Reload / Vent [R], leave a Holo-Decoy Turret (3.5s, max 1) firing auxiliary shots (40% DMG) toward your cursor.',
    compatibleCadences: ['CLIP_RELOAD', 'HEAT_VENT'],
    excludedCategories: ['melee'],
    phase: 4,
  },
  mutator_cluster_mortar: {
    id: 'mutator_cluster_mortar',
    nameVi: 'Cối Chùm Cầu Vồng',
    nameEn: 'Cluster Mortar Core',
    descVi:
      'Đạn bay cầu vồng vượt qua vật chắn thấp/đã lật và tách thành 3 mảnh nổ phụ khi chạm đích.',
    descEn:
      'Projectiles lob in an arc over cover obstacles and split into 3 secondary cluster blasts on impact.',
    compatibleCadences: ['CLIP_RELOAD', 'HEAT_VENT'],
    excludedCategories: ['melee'],
    phase: 4,
  },
  mutator_boomerang_core: {
    id: 'mutator_boomerang_core',
    nameVi: 'Lõi Cưa Hồi Quy',
    nameEn: 'Boomerang Saw Core',
    descVi:
      'Khi Nạp Chuẩn / Xả Nhiệt [R], phóng lưỡi cưa năng lượng xoay 200px rồi thu về vị trí của bạn (32 ST).',
    descEn:
      'On Perfect Reload / Vent [R], launch a spinning energy sawblade out 200px that returns to you (32 DMG).',
    compatibleCadences: ['CLIP_RELOAD', 'HEAT_VENT'],
    excludedCategories: ['melee'],
    phase: 4,
  },
  mutator_elemental_infusion: {
    id: 'mutator_elemental_infusion',
    nameVi: 'Lõi Truyền Nguyên Tố Kép',
    nameEn: 'Elemental Infusion Core',
    descVi:
      'Vũ khí đang cầm nhận thêm Nguyên tố thứ hai từ vũ khí ở ô còn lại mỗi khi bắn Phát Cuối Băng hoặc Đạn Quá Tải.',
    descEn:
      'Active weapon gains the secondary element from your off-hand weapon on Finale Shot or Overclocked Shot.',
    compatibleCadences: ['CLIP_RELOAD', 'HEAT_VENT'],
    excludedCategories: ['melee'],
    phase: 4,
  },
};

export const ALL_WEAPON_MUTATOR_IDS: readonly WeaponMutatorId[] = Object.keys(
  WEAPON_MUTATORS,
) as WeaponMutatorId[];

export function isMutatorCompatibleWithWeapon(mutatorId: string, weaponId: string): boolean {
  const mutator = WEAPON_MUTATORS[mutatorId as WeaponMutatorId];
  const weapon = WEAPONS[weaponId];
  if (!mutator || !weapon) return false;
  if (!mutator.compatibleCadences.includes(weapon.cadenceKind)) return false;
  if (mutator.allowedCategories && !mutator.allowedCategories.includes(weapon.category)) {
    return false;
  }
  if (mutator.excludedCategories && mutator.excludedCategories.includes(weapon.category)) {
    return false;
  }
  return true;
}

export function getCompatibleCoreMutatorsForWeapon(
  weaponId: string,
  alreadyAttached: readonly string[] = [],
): WeaponMutatorId[] {
  const attachedSet = new Set(alreadyAttached);
  return CORE_WEAPON_MUTATOR_IDS.filter(
    (id) => !attachedSet.has(id) && isMutatorCompatibleWithWeapon(id, weaponId),
  );
}

export function getCompatibleWeaponMutators(
  weaponId: string,
  alreadyAttached: readonly string[] = [],
): WeaponMutatorId[] {
  const attachedSet = new Set(alreadyAttached);
  return ALL_WEAPON_MUTATOR_IDS.filter(
    (id) => !attachedSet.has(id) && isMutatorCompatibleWithWeapon(id, weaponId),
  );
}

export const MAX_MUTATORS_PER_WEAPON = MAX_MUTATORS_PER_WEAPON_SLOT;
