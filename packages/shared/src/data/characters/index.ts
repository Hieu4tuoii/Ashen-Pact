import type { CharacterId, CharacterStatsDef } from '../types.js';

export const BASE_MOVE_SPEED = 180;

export const CHARACTERS: Record<CharacterId, CharacterStatsDef> = {
  vanguard: {
    id: 'vanguard',
    nameVi: 'Thiết Vệ',
    nameEn: 'Vanguard',
    titleVi: 'Tank / Bảo Hộ Tuyến Đầu',
    hp: 8,
    armor: 6,
    energy: 150,
    armorRegenDelaySec: 2.0,
    armorRegenPerSec: 1.0,
    moveSpeed: Math.round(BASE_MOVE_SPEED * 0.95),
    speedMultiplierPct: 95,
    baseCritChance: 0.05,
    starterWeaponId: 'knight_sword',
    passiveNameVi: 'Ý Chí Thép',
    passiveDescriptionVi: 'Giáp hồi sau 2s; mỗi viên đạn chặn bằng kỹ năng hồi 1 năng lượng.',
    skill: {
      id: 'ruby_shield_wall',
      nameVi: 'Tường Khiên Hồng Ngọc',
      nameEn: 'Ruby Shield Wall',
      cooldownSec: 9,
      durationSec: 4,
      descriptionVi:
        'Dựng khiên cung 120° chặn và tích trữ đạn địch rồi phóng ngược sóng xung kích. Đạn đồng minh bắn qua khiên từ phía sau được +30% sát thương và xuyên mục tiêu.',
      synergyVi:
        'Đạn đồng minh và Trụ Tesla bắn xuyên qua khiên từ phía sau được +30% sát thương và +1 xuyên mục tiêu.',
      upgrades: [
        {
          id: 'vanguard_fortress',
          nameVi: 'Pháo Đài',
          descriptionVi: 'Khiên bao phủ 360° quanh bản thân với bán kính nhỏ hơn.',
        },
        {
          id: 'vanguard_charge',
          nameVi: 'Xung Phong',
          descriptionVi: 'Bấm lại kỹ năng để lao tới cùng khiên, hất văng quái trên đường.',
        },
      ],
    },
  },
  ranger: {
    id: 'ranger',
    nameVi: 'Liệp Ưng',
    nameEn: 'Ranger',
    titleVi: 'Sát Thương / Đánh Dấu',
    hp: 5,
    armor: 4,
    energy: 200,
    armorRegenDelaySec: 3.0,
    armorRegenPerSec: 1.0,
    moveSpeed: Math.round(BASE_MOVE_SPEED * 1.05),
    speedMultiplierPct: 105,
    baseCritChance: 0.15,
    starterWeaponId: 'hunter_crossbow',
    passiveNameVi: 'Mắt Ưng',
    passiveDescriptionVi: 'Sát thương tăng theo khoảng cách tới mục tiêu (tối đa +30%); +10% Crit.',
    skill: {
      id: 'predator_arrow',
      nameVi: 'Mũi Tên Săn Mồi',
      nameEn: 'Predator Arrow',
      cooldownSec: 7,
      durationSec: 6,
      descriptionVi:
        'Lộn lùi (i-frame) và bắn mũi tên xuyên thấu đánh dấu quái trong 6s: nhận +25% sát thương từ mọi nguồn, lộ diện xuyên tường và rơi cầu năng lượng khi chết.',
      synergyVi:
        'Mục tiêu bị Đánh Dấu nhận +25% sát thương từ cả đội, lộ diện xuyên sương mù, bị Trụ Tesla ưu tiên khóa mục tiêu và rơi cầu năng lượng khi bị hạ.',
      upgrades: [
        {
          id: 'ranger_arrow_volley',
          nameVi: 'Mưa Tên',
          descriptionVi: 'Tách thành 5 mũi tên hình quạt.',
        },
        {
          id: 'ranger_prey_chain',
          nameVi: 'Chuỗi Con Mồi',
          descriptionVi:
            '30% sát thương lên mục tiêu bị đánh dấu lan sang các mục tiêu bị đánh dấu khác.',
        },
      ],
    },
  },
  elementalist: {
    id: 'elementalist',
    nameVi: 'Lam Hỏa',
    nameEn: 'Elementalist',
    titleVi: 'Khống Chế / Phản Ứng Nguyên Tố',
    hp: 5,
    armor: 3,
    energy: 260,
    armorRegenDelaySec: 3.0,
    armorRegenPerSec: 1.0,
    moveSpeed: BASE_MOVE_SPEED,
    speedMultiplierPct: 100,
    baseCritChance: 0.08,
    starterWeaponId: 'apprentice_staff',
    passiveNameVi: 'Vòng Xoay Nguyên Tố',
    passiveDescriptionVi:
      'Xoay vòng Lửa → Băng → Sét sau mỗi lần dùng kỹ năng; đạn thường áp nguyên tố hiện hành.',
    skill: {
      id: 'elemental_orb',
      nameVi: 'Cầu Nguyên Tố',
      nameEn: 'Elemental Orb',
      cooldownSec: 8,
      durationSec: 5,
      descriptionVi:
        'Ném quả cầu nổ thành vùng nguyên tố 5s. Đạn đồng minh bay qua vùng được tẩm nguyên tố đó.',
      synergyVi:
        'Đạn đồng minh bay qua vùng nguyên tố được tẩm nguyên tố đó, dễ dàng kích hoạt Đồng Đội Combo (+15 Năng lượng cho cả 2 người chơi).',
      upgrades: [
        {
          id: 'elementalist_vortex',
          nameVi: 'Hố Đen Nguyên Tố',
          descriptionVi: 'Vùng nguyên tố hút quái xung quanh vào tâm.',
        },
        {
          id: 'elementalist_dual',
          nameVi: 'Song Nguyên Tố',
          descriptionVi: 'Vùng chứa đồng thời 2 nguyên tố, kích hoạt phản ứng ngay lập tức.',
        },
      ],
    },
  },
  druid: {
    id: 'druid',
    nameVi: 'Mộc Linh',
    nameEn: 'Druid',
    titleVi: 'Hỗ Trợ / Hồi Phục',
    hp: 6,
    armor: 4,
    energy: 200,
    armorRegenDelaySec: 3.0,
    armorRegenPerSec: 1.0,
    moveSpeed: BASE_MOVE_SPEED,
    speedMultiplierPct: 100,
    baseCritChance: 0.05,
    starterWeaponId: 'thorn_staff',
    passiveNameVi: 'Hạt Giống Sự Sống',
    passiveDescriptionVi:
      'Quái bị hạ có 15% rơi hạt hồi 1 HP bay tới đồng đội ít máu nhất; hồi sinh nhanh gấp đôi.',
    skill: {
      id: 'sacred_tree',
      nameVi: 'Cây Thiêng',
      nameEn: 'Sacred Tree',
      cooldownSec: 12,
      durationSec: 6,
      descriptionVi:
        'Trồng cây thần hồi 1 HP mỗi 2s, trói chân quái 1.5s, chặn đạn và khiêu khích quái. Trồng lên đồng đội đang gục sẽ hồi sinh ngay với 2 HP.',
      synergyVi:
        'Trồng Cây Thiêng lên đồng đội đang gục sẽ hồi sinh tức thì với 2 HP; đạn Độc kết hợp Lửa/Sét đồng đội tạo Nổ Độc và Tê Liệt.',
      upgrades: [
        {
          id: 'druid_poison_roots',
          nameVi: 'Rễ Gai Độc',
          descriptionVi: 'Rễ cây gây sát thương và áp trạng thái Độc.',
        },
        {
          id: 'druid_sacred_grove',
          nameVi: 'Rừng Thiêng',
          descriptionVi: 'Trồng 2 cây nhỏ hơn cùng lúc.',
        },
      ],
    },
  },
  engineer: {
    id: 'engineer',
    nameVi: 'Bánh Răng',
    nameEn: 'Engineer',
    titleVi: 'Tiện Ích / Trụ Pháo',
    hp: 6,
    armor: 5,
    energy: 180,
    armorRegenDelaySec: 3.0,
    armorRegenPerSec: 1.0,
    moveSpeed: BASE_MOVE_SPEED,
    speedMultiplierPct: 100,
    baseCritChance: 0.08,
    starterWeaponId: 'rivet_gun',
    passiveNameVi: 'Thợ Sửa',
    passiveDescriptionVi:
      'Đồng minh trong 4 ô hồi giáp nhanh hơn 30%; sửa và kích hoạt máy móc trên map.',
    skill: {
      id: 'tesla_turret',
      nameVi: 'Trụ Tesla',
      nameEn: 'Tesla Turret',
      cooldownSec: 10,
      durationSec: 10,
      descriptionVi:
        'Đặt trụ phóng sét dây chuyền ưu tiên mục tiêu bị đánh dấu. Đạn đồng minh bắn trúng trụ sẽ nạp điện; đủ 100% phát xung EMP làm choáng quái và xóa đạn địch.',
      synergyVi:
        'Đồng minh bắn trúng Trụ Tesla giúp nạp điện tăng tốc bắn; đủ 100% phát nổ Xung EMP làm choáng quái và xóa sạch đạn địch xung quanh.',
      upgrades: [
        {
          id: 'engineer_twin_turrets',
          nameVi: 'Trụ Kép',
          descriptionVi: 'Đặt tối đa 2 trụ hoạt động song song.',
        },
        {
          id: 'engineer_self_destruct',
          nameVi: 'Tự Hủy',
          descriptionVi: 'Khi hết thời gian tồn tại, trụ phát nổ diện rộng.',
        },
      ],
    },
  },
};
