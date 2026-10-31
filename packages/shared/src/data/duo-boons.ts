import { BLESSINGS } from './blessings.js';
import type { DuoBoonDef, DuoBoonId, ElementType } from './types.js';
import { WEAPONS } from './weapons.js';
import type { SimPlayerState } from '../sim/world-sim-types.js';

export const DUO_BOON_SLOT3_UPGRADE_CHANCE = 0.35;

export const ALL_DUO_BOON_IDS = [
  'duo_superheated_cyclone',
  'duo_cryo_shatter_spires',
  'duo_superconduct_rail',
  'duo_napalm_chain_plague',
  'duo_plasma_overload_star',
  'duo_magnetic_bastion_ring',
] as const satisfies readonly DuoBoonId[];

const DUO_BOON_ID_SET: ReadonlySet<string> = new Set<string>(ALL_DUO_BOON_IDS);

export const DUO_BOONS: Readonly<Record<DuoBoonId, DuoBoonDef>> = {
  duo_superheated_cyclone: {
    id: 'duo_superheated_cyclone',
    requiredElements: ['burn', 'chill'],
    reactionId: 'vaporize',
    nameVi: 'Lốc Xoáy Nước Sôi',
    nameEn: 'Superheated Cyclone',
    descriptionVi:
      'Phản ứng Hơi Nước hóa thành Lốc Xoáy Nước Sôi (4.0s, tối đa 3 lốc) tự đuổi theo kẻ địch ở 140 px/giây, gây 14 ST/giây và mù hơi nước.',
    descriptionEn:
      'Vaporize spawns a homing Superheated Cyclone (4.0s, max 3) chasing enemies at 140 px/s, dealing 14 DMG/s and applying Steam Blindness.',
    primaryColor: '#F97316',
    secondaryColor: '#38BDF8',
  },
  duo_cryo_shatter_spires: {
    id: 'duo_cryo_shatter_spires',
    requiredElements: ['chill', 'none'],
    reactionId: 'shatter',
    nameVi: 'Tứ Trụ Băng Phá',
    nameEn: 'Cryo Shatter Spires',
    descriptionVi:
      'Phản ứng Vỡ Băng đóng 4 Cột Băng Nhọn xuống sàn (4.0s) chặn đạn địch; Dash-Kick xuyên qua kích nổ cột gây 34 ST Băng (r=80px) và Đóng Băng 1.2s.',
    descriptionEn:
      'Shatter plants 4 Cryo Spires (4.0s) that block enemy bullets; Dash-Kicking through a spire detonates it for 34 Ice DMG (r=80px) and 1.2s Freeze.',
    primaryColor: '#38BDF8',
    secondaryColor: '#E2E8F0',
  },
  duo_superconduct_rail: {
    id: 'duo_superconduct_rail',
    requiredElements: ['chill', 'shock'],
    reactionId: 'superconduct',
    nameVi: 'Đường Ray Siêu Dẫn',
    nameEn: 'Superconduct Magnetic Rail',
    descriptionVi:
      'Mục tiêu đang dính Siêu Dẫn tạo từ trường (r=100px) tự động hút bẻ góc mọi viên đạn tầm xa bắn lướt qua lao thẳng vào tâm mục tiêu.',
    descriptionEn:
      'Superconducted enemies project a magnetic field (r=100px) that bends passing ranged projectiles directly toward their center.',
    primaryColor: '#38BDF8',
    secondaryColor: '#A855F7',
  },
  duo_napalm_chain_plague: {
    id: 'duo_napalm_chain_plague',
    requiredElements: ['poison', 'burn'],
    reactionId: 'toxic_blast',
    nameVi: 'Đại Dịch Nhựa Lửa-Độc',
    nameEn: 'Napalm Chain Plague',
    descriptionVi:
      'Phản ứng Nổ Độc bắn văng Nhựa Lửa-Độc (5.0s) sang quái trong 160px; hạ gục kẻ địch dính nhựa kích nổ dây chuyền 32 ST Lửa (r=110px).',
    descriptionEn:
      'Toxic Blast splashes Napalm-Venom Resin (5.0s) onto foes within 160px; slaying afflicted enemies triggers a 32 Fire DMG chain explosion (r=110px).',
    primaryColor: '#84CC16',
    secondaryColor: '#F97316',
  },
  duo_plasma_overload_star: {
    id: 'duo_plasma_overload_star',
    requiredElements: ['burn', 'shock'],
    reactionId: 'overload',
    nameVi: 'Tinh Cầu Quá Tải Plasma',
    nameEn: 'Plasma Overload Star',
    descriptionVi:
      'Phản ứng Quá Tải phóng Quả Cầu Lửa-Điện (420 px/giây, 30 ST) xuyên thấu kẻ địch và nảy 3 lần giữa các bức tường (hồi chiêu 0.35s).',
    descriptionEn:
      'Overload launches a piercing Plasma Star (420 px/s, 30 DMG) that bounces 3 times off walls across the room (0.35s ICD).',
    primaryColor: '#F97316',
    secondaryColor: '#FACC15',
  },
  duo_magnetic_bastion_ring: {
    id: 'duo_magnetic_bastion_ring',
    requiredElements: ['shock', 'none'],
    nameVi: 'Vòng Thành Lũy Điện Từ',
    nameEn: 'Magnetic Bastion Ring',
    descriptionVi:
      'Giữa mọi cặp Bia Chắn Đã Lật [E] trong phạm vi 220px tự động giăng Lưới Hồ Quang Điện Cao Thế thiêu đốt 28 ST Sét/giây lên quái đi cắt ngang.',
    descriptionEn:
      'All pairs of Flipped Barricades [E] within 220px automatically link with High-Voltage Arc Wires dealing 28 Shock DMG/s to crossing enemies.',
    primaryColor: '#FACC15',
    secondaryColor: '#94A3B8',
  },
};

export const DUO_BOON_LIST: readonly DuoBoonDef[] = ALL_DUO_BOON_IDS.map((id) => DUO_BOONS[id]);

export function isDuoBoonId(id: string): id is DuoBoonId {
  return DUO_BOON_ID_SET.has(id);
}

export function collectPlayerOwnedElements(
  player: Pick<SimPlayerState, 'weaponSlots' | 'blessingIds'>,
): Set<ElementType> {
  const owned = new Set<ElementType>();
  for (let i = 0; i < player.weaponSlots.length; i++) {
    const wid = player.weaponSlots[i];
    if (!wid) continue;
    const weapon = WEAPONS[wid];
    if (!weapon) continue;
    owned.add(weapon.element);
    if (weapon.finaleElement) {
      owned.add(weapon.finaleElement);
    }
  }
  for (let i = 0; i < player.blessingIds.length; i++) {
    const bid = player.blessingIds[i];
    if (!bid) continue;
    const blessing = (BLESSINGS as Record<string, { element: ElementType } | undefined>)[bid];
    if (blessing) {
      owned.add(blessing.element);
    }
  }
  return owned;
}

export function getEligibleDuoBoonsForPlayer(
  player: Pick<SimPlayerState, 'weaponSlots' | 'blessingIds' | 'duoBoonIds'>,
): DuoBoonId[] {
  const owned = collectPlayerOwnedElements(player);
  if (owned.size < 2) return [];
  const eligible: DuoBoonId[] = [];
  for (let i = 0; i < ALL_DUO_BOON_IDS.length; i++) {
    const id = ALL_DUO_BOON_IDS[i]!;
    if (player.duoBoonIds.includes(id)) continue;
    const [elA, elB] = DUO_BOONS[id].requiredElements;
    if (owned.has(elA) && owned.has(elB)) {
      eligible.push(id);
    }
  }
  return eligible;
}
