# Thiết Kế Hệ Thống Hiệu Ứng Âm Thanh Thực Tế Toàn Diện (Authentic Free SFX Overhaul) — Ashen Pact v2.0.0

- **Ngày:** 2026-11-13
- **Phạm vi:** `apps/client/src/audio/`, `apps/client/public/sfx/`, `apps/client/src/scenes/`, `apps/client/src/fx/`, `CREDITS.md`, `docs/CREDITS.md`, `packages/shared/src/i18n/`
- **Mục tiêu:** Thay thế các tiếng tổng hợp sóng đơn giản bằng kho hiệu ứng âm thanh thu âm thực tế miễn phí (`CC0 1.0` & `CC-BY-4.0`) đã qua phân tích phổ âm học (DSP), cắt tỉa transient, phối lớp (layering) và mastering chuẩn thương mại, phủ kín 100% toàn bộ `105` `SfxId` (`79` ID hiện hữu + `26` ID chuyên biệt mới cho 18 vũ khí, nạp đạn, địa hình, giáp/tường, đạn quái, nhặt vật phẩm và hiệu ứng môi trường).

---

## 1. Bối Cảnh & Yêu Cầu Kỹ Thuật Nghiêm Ngặt

1. **Độ khớp 100% với gameplay:** Mỗi một trong **18 vũ khí** (cả đòn đánh thường lẫn tuyệt chiêu/finale), **5 kỹ năng nhân vật**, **6 phản ứng nguyên tố + Hội Tụ Nguyên Tố**, **cơ chế nạp đạn / Perfect Reload / xả nhiệt**, **vật cản chiến thuật (lật bàn, sút thùng, đập tường)**, **quái thường & 3 Boss**, **bước chân theo 5 loại bề mặt**, **nhặt vật phẩm phân loại** và **UI** phải có bản sắc âm học riêng biệt, nghe uy lực, chân thực và không bị nhầm lẫn trong hỗn chiến 4 người chơi Co-op.
2. **Không tạo bất kỳ `console.warn` hay `console.error` nào trong E2E:**
   - Bộ kiểm thử E2E (`phase0.spec.ts` – `phase8.spec.ts`, `visual.spec.ts`) kiểm tra nghiêm ngặt `expect(consoleWarnings).toEqual([])` và `expect(consoleErrors).toEqual([])`.
   - Khởi tạo `new AudioContext()` hoặc `new OfflineAudioContext()` trước khi người dùng tương tác (`navigator.userActivation.hasBeenActive`) sẽ bị Chromium cảnh báo `"The AudioContext was not allowed to start..."` và làm gãy E2E.
3. **Bảo toàn 100% hợp đồng API & kiểm thử hiện hữu:**
   - `SFX_PRESETS` và `WEAPON_V2_SFX_PRESETS` giữ nguyên toàn bộ khóa, `volume > 0`, `freq > 0`, `decaySec > 0`, không chứa `'bullet_graze'`.
   - `resolveWeaponShootSfx(weaponId)` giữ nguyên giá trị trả về tương thích ngược cho `ap2-p1a-weapons-vfx-audio.test.ts` và `ap2-p1b-weapons-fx.test.ts`; bổ sung hàm mới `resolveWeaponAttackSfx(weaponId, opts)` phục vụ phát âm thanh thực chiến riêng biệt cho từng cây trong 18 vũ khí.
   - `zzfx.getPlayedCount()` và `zzfx.getLastPlayedId()` tiếp tục cập nhật đồng bộ ngay đầu hàm `play()` kể cả trong môi trường Node/Vitest không có `AudioContext`.
   - `CREDITS.md` và `docs/CREDITS.md` đồng bộ tuyệt đối, giữ phiên bản `v2.0.0`, không chứa chuỗi phiên bản cũ.

---

## 2. Kiến Trúc Sample-First Hybrid WebAudio Engine

### 2.1. Giải Mã RIFF PCM16 Thuần TypeScript Không Chạm `AudioContext` (`parseWavPcm16`)
- Tất cả file âm thanh xuất vào `apps/client/public/sfx/<category>/<file>.wav` ở định dạng chuẩn **RIFF WAVE 16-bit Little-Endian Mono PCM (`32,000 Hz`)** đã qua mastering.
- Khi `PreloadScene` khởi chạy, `void zzfx.preloadSamples()` nạp bất đồng bộ các tệp `.wav` qua `fetch('./sfx/...')` và giải mã trực tiếp mảng byte `ArrayBuffer` bằng `parseWavPcm16` sang `{ sampleRate: number; samples: Float32Array }` lưu trong bộ nhớ RAM:
  - **Không khởi tạo `AudioContext` khi preload** → `0` cảnh báo autoplay trên Chromium/Edge.
  - **Tốc độ nạp tức thì:** Tổng dung lượng `160` file `.wav` (`32 kHz` mono, thời lượng `0.06s–1.8s` đúng dải năng lượng hữu ích) chỉ `3.04 MB`, nạp nội bộ LAN/localhost trong vài chục mili-giây.
  - **Hydrate `AudioBuffer` độ trễ `0 ms`:** Ngay khi người chơi nhấp chuột lần đầu (`unlockOnUserGesture()`), `ZzfxSynth` ánh xạ `Float32Array` sang `AudioBuffer` đồng bộ qua `ctx.createBuffer(1, pcm.samples.length, pcm.sampleRate)` và lưu cache theo `WeakMap<AudioContext, Map<string, AudioBuffer>>` — phát ngay phát súng/cú click đầu tiên mà không chờ `decodeAudioData` bất đồng bộ.
  - **Fallback an toàn:** Nếu một mẫu chưa kịp tải hoặc đang chạy trong môi trường test giả lập không nạp file tĩnh, hệ thống tự động rơi về nhánh tổng hợp sóng `SFX_PRESETS[id]` mà không mất tiếng.

### 2.2. Chống Lặp Máy Móc, Định Vị Không Gian 2D & Quản Lý 24 Kênh Ưu Tiên (Voice Stealing)
1. **Round-Robin Đa Biến Thể + Vi Biến Thiên Cao Độ (`playbackRate`):**
   - Các hiệu ứng tần suất cao (tiếng súng, chém cận chiến, trúng đòn, va tường, bước chân) có `2–3` biến thể file `.wav` khác nhau (`v1`, `v2`, `v3`), xoay vòng không lặp lại liên tiếp (`nextVariationIndex`), kết hợp biến thiên `playbackRate` tự nhiên (`±4.5%` cho combat, `±1.5%` cho UI, `±6%` cho bước chân).
2. **Không Gian 2D (`StereoPannerNode` + Distance Attenuation + Gain Staging):**
   - Chuỗi node chuẩn cho mỗi voice: `AudioBufferSourceNode -> GainNode -> (StereoPannerNode) -> ctx.destination`.
   - Suy giảm khoảng cách mượt `clamp(1 - dist / 980, 0.2, 1.0)` và pan trái/phải `clamp((worldX - cameraCenterX) / 440, -0.88, 0.88)`.
3. **Quản Lý `24` Kênh Đồng Thời Theo Độ Ưu Tiên (`VoicePriority`):**
   - Nâng trần đa âm từ `12` lên `24` giọng đồng thời (`MAX_CONCURRENT_VOICES = 24`) để trận Co-op 4 người không bao giờ nuốt tiếng kỹ năng hay Boss.
   - Phân 4 bậc ưu tiên:
     - `4 (CRITICAL)`: Boss gầm/chuyển pha, người chơi trúng đòn/gục/hồi sinh, Chiến thắng/Thất bại, Perfect Reload, Siêu Tân Tinh, Hố Đen, Cột Lôi Đình, Đoạn Đầu Đài.
     - `3 (HIGH)`: Tiếng vũ khí người chơi, kỹ năng nhân vật, phản ứng nguyên tố, vỡ giáp, mở rương/cửa/cổng.
     - `2 (NORMAL)`: Trúng đòn quái, tiêu diệt quái, đạn quái, nhặt vật phẩm, vật cản vỡ, UI.
     - `1 (LOW)`: Bước chân địa hình, đạn găm tường, bụi cỏ xào xạc.
   - Khi chạm ngưỡng `24` kênh, hiệu ứng có ưu tiên cao hơn sẽ tự động cắt mượt (`5ms` ramp-down chống click) kênh ưu tiên thấp nhất đang phát lâu nhất.

---

## 3. Quy Chuẩn Tuyển Chọn Nguồn & Pipeline Mastering DSP (`scratch/build_sfx_bank.py`)

### 3.1. Các Kho Nguồn Âm Thanh Miễn Phí Đã Kiểm Định Bản Quyền (`1,306` File Gốc)
- **Still North Media — *Prepared Firearm SFX Library*** (`CC0 1.0` Public Domain): Thu âm thực địa súng ngắn `1911`, `Bersa`, `Walther PPQ`, `Ruger Single Six`, `S&W 642`, tiểu liên `PPSh-41`, `Carl Gustav M45`, shotgun `Mossberg`, `Benelli Nova`, `Winchester Model 12`, súng trường `AK-47`, `AR-15`, `Savage .300 Blackout`, `Mosin Nagant`.
- **Meta / Oculus VR, LLC — *Oculus Audio Pack 01*** (`CC-BY-4.0`): Thu âm foley chuyên nghiệp cho chém kiếm/vút gió (`WEAPSwrd_*`, `WHSH_*`, `SWSH_*`), đấm/đá/xương vỡ (`FGHTImpt_*`, `GOREBone_*`, `GORESqsh_*`), va đập kim loại/đe rèn/gỗ/kính (`METLImpt_*`, `WOODImpt_*`, `GLASBrk_*`), vỏ đạn rơi (`BLLTShel_*`), bước chân đa chất liệu (`FEETHmn_ShoeConcrete/Grass/Snow/Metal/Dirt*`), thủy lực/cửa hầm/khóa (`MACHInd_*`, `DOORMetl_*`, `MECHLock_*`, `MECHLvr_*`), quái khổng lồ (`CREAHmn_Giant/Ogre/Troll*`, `CREAMnstr_*`), nhạc hiệu thắng/thua giao hưởng (`MUSCStngr_VictoryOrchestral_*`, `MUSCStngr_LossOrchestral_*`) và UI kim loại/ma thuật (`UIClick_*`, `UIMisc_*`).
- **Kenney Vleugels — *Interface Sounds* & *UI Audio*** (`CC0 1.0`): Micro-transients sắc gọn cho UI hover/toggle/confirm.
- **OpenGameArt Curated `CC0 1.0` Collections:** *150 CC0 Combat & Spell SFX*, *80 CC0 RPG SFX*, *RPG Sound Pack* (artisticdude), *Weapons & Apparel Foley* (lamoot/qubodup), *Shotgun Foley*, *Ice Shatters & Spells*, *Cure Magic*, *25 Cannon/Bang SFX*, *Monster Vol.2*, *OGA Singles*.

### 3.2. Chuỗi Xử Lý Tín Hiệu Số (DSP Mastering Chain)
Mọi file xuất ra `apps/client/public/sfx/` bắt buộc đi qua chuỗi xử lý và kiểm định tự động:
1. **Định vị cửa sổ xung đỉnh (`Transient Window Extraction`):** Tìm điểm bùng nổ năng lượng thực sự (loại bỏ hoàn toàn `100ms–1,500ms` khoảng lặng đầu của file thu âm hiện trường), lùi về sát mép khởi phát `-38 dBFS` sao cho `attackOnsetMs <= 3.5 ms` đối với mọi SFX tức thời.
2. **Khử DC Offset & Lọc Thông Cao (`Butterworth High-Pass Filter`):**
   - `35 Hz` cho nổ lớn / Boss / búa sấm / pháo dung nham (giữ lực sub-bass).
   - `75 Hz` cho súng, kiếm, va chạm, kỹ năng.
   - `120 Hz` cho UI, nhặt đồ, bước chân (giữ bản phối sạch, không đục nền nhạc).
3. **Phối Lớp Đa Tầng (`Multi-Layer Acoustic Composite`):** Kết hợp lớp **Transient** (độ đanh đầu đòn) + lớp **Body** (lực thân vật lý) + lớp **Tail/Elemental** (đuôi kim khí, điện, lửa, băng, độc, thánh quang).
4. **Chuẩn Hóa Loudness & Soft-Clip True-Peak Limiter (`-1.0 dBFS`):**
   - Cân bằng `RMS` theo nhóm vai trò combat và khống chế đỉnh tuyệt đối `peak <= 0.891` (`-1.0 dBFS`), đảm bảo **`0` mẫu bị clipping**.
5. **Micro Fade-In (`1.2 ms`) & Raised-Cosine Fade-Out (`15–60 ms`):** Triệt tiêu hoàn toàn tiếng "tách/bụp" (`tailMaxAbs <= 0.002`) ở điểm đầu và điểm cuối file.

---

## 4. Bảng Ánh Xạ Đầy Đủ 105 `SfxId` & Tích Hợp Gameplay

### 4.1. Bộ 18 Vũ Khí Độc Bản (`resolveWeaponAttackSfx` + Vũ Khí v2 Specials)
| Vũ khí (`weaponId`) | SFX Đòn Chính | SFX Đòn Đặc Biệt / Finale | Thiết Kế Âm Học (Layered Acoustic Recipe) |
|---|---|---|---|
| `knight_sword` | `swing_sword` (3 biến thể) | `bullet_deflect` (Parry) | Vút gió trung tần + lưỡi thép ngân sắc gọn; khi chém tan đạn phát tiếng keng thép + đạn nảy kim khí. |
| `emerald_cleaver` | `swing_emerald_cleaver` (2 biến thể) | `emerald_boomerang` | Đại đao xé gió nặng + âm ngân ngọc lục bảo pha độc dịch; đòn 3 phóng lưỡi đao xoay cộng hưởng pha lê. |
| `berserker_axe` | `swing_berserker_axe` (2 biến thể) | `berserker_guillotine` | Rìu lớn bổ xé không khí + hơi lửa bùng trầm; Đoạn Đầu Đài giáng búa rèn nứt đất + lửa phụt. |
| `thunder_hammer` | `swing_thunder_hammer` (2 biến thể) | `thunder_pillar` | Búa tạ đập gió trầm + hồ quang điện nổ lách tách; Cột Lôi Đình giáng sét thiên lôi + đe thép rung chấn. |
| `hunter_crossbow` | `shoot_bow` (2 biến thể) | `crossbow_rip` | Dây nỏ bật căng + lông vũ tên xé gió; Rút Tên Móc Câu giật rách thịt/xương sắc lẹm. |
| `rivet_gun` | `shoot_pistol` (3 biến thể) | `shoot_rivet_finale` | Súng ngắn cơ khí đanh gọn (`1911`/`Walther` + chốt kim loại); phát thứ 6 Finale nổ đinh tán tích điện cao áp. |
| `scrap_shotgun` | `shoot_shotgun` (3 biến thể) | `scrap_shell_eject` | Shotgun 12-gauge nổ rền dày (`Mossberg`/`Nova`); Perfect Reload lên quy-lát keng vỏ đồng nảy sàn đá. |
| `gale_smg` | `shoot_smg` (3 biến thể) | `gale_wind_blade`, `gale_cyclone_vent` | Tiểu liên tốc độ cao (`Carl Gustav`/`PPSh`) pha luồng gió cắt; Lưỡi Gió rít sắc, Xả Lốc Xoáy bung áp suất gió. |
| `tesla_carbine` | `shoot_tesla_carbine` (2 biến thể) | `chain_lightning` | Súng trường xung nhịp (`AR-15`/`.300 BLK`) chồng tia phóng điện cao áp xanh lam. |
| `apprentice_staff` | `shoot_apprentice_staff` (2 biến thể) | `explosion` (Tri-beam) | Xung ma pháp nguyên tố ấm gọn, rõ nhịp bắn. |
| `thorn_staff` | `thorn_whip` (2 biến thể) | `thorn_bloom` | Roi dây leo quất xé gió gai độc; Gai Nở Rộ bung rễ cây + nổ độc hữu cơ. |
| `solar_archon_staff` | `shoot_solar_staff` (2 biến thể) | `solar_converge`, `solar_supernova` | Tia lửa thái dương ngân chuông vàng; Hội Tụ 3 Tia nổ cộng hưởng quang năng; Siêu Tân Tinh bùng nổ đại dương lửa thánh quang. |
| `void_staff` | `shoot_void_staff` (2 biến thể) | `void_implosion` | Cầu hư không trầm hút không gian; Hố Đen Sụp Đổ nén sub-bass rồi nổ hút chân không dữ dội. |
| `focus_laser` | `shoot_laser` / `focus_laser_hum` | `focus_laser_railgun` | Tia hội tụ quang tử sắc nét; khi xả áp Railgun nổ xuyên phá điện từ siêu thanh. |
| `frag_launcher` | `shoot_launcher` (2 biến thể) | `frag_airburst` | Ống phóng lựu *thump* rỗng đặc trưng + cơ khí cò; nổ mảnh văng kim loại trên không. |
| `magma_cannon` | `shoot_magma_cannon` (2 biến thể) | `magma_geyser` | Đại bác dung nham nổ sub-bass rền vang; Vòi Dung Nham phun trào đá nóng chảy sôi sục. |
| `seed_gun` | `shoot_seed_gun` (2 biến thể) | `seed_harvest_bloom` | Khí nén sinh học bật hạt mầm tươi; Hoa Sinh Mệnh nở bung phấn hồi phục ngân chuông dịu. |
| `tether_staff` | `shoot_tether_staff` (2 biến thể) | `tether_em_yank` | Phóng neo hồ quang điện từ; Giật Dây Nam Châm kéo sập dây xích điện + xung EMP. |

*(Các khóa chuẩn `shoot_rifle`, `shoot_staff`, `shoot_coop_special`, `swing_heavy` vẫn có mẫu `.wav` được mastering đầy đủ để phục vụ `resolveWeaponShootSfx`, quái/tương tác phụ như `prop_kicked` và kiểm thử tương thích).*

### 4.2. Các Nhóm Hiệu Ứng Mới Bổ Sung & Nâng Cấp Trong Gameplay
1. **Nạp đạn trọn vòng đời (`GameScene.ts`):**
   - `reload_start`: Phát khi `sim.player.reloadTimer` vừa chuyển từ `0` sang `> 0.02` (tiếng tháo băng/mở khóa nòng).
   - `reload_complete`: Phát khi `reloadTimer` về `0` và `ammoInMag > 0` (nếu không trùng nhịp `perfect_reload` trong cùng tick) — tiếng đóng quy-lát chắc nịch.
2. **Đạn quái phân loại theo chủng loại (`sim-events.ts` — `resolveEnemyProjectileSfx`):**
   - `goblin_bow` → `shoot_bow`
   - `welder_arc` → `chain_lightning`
   - `dwarf_mortar`, `shielder_slug`, `titan_*` → `shoot_enemy_heavy`
   - `shaman_staff`, `thorn_burst`, `frost_*`, `glacier_spike`, `imp_fireball`, `vengeful_ring`, `boss_spore_ring`, `spore_*`, `kryssa_*` → `shoot_enemy_magic`
   - Mặc định khác → `shoot_pistol`
3. **Va chạm vật lý chi tiết (`sim-events.ts`):**
   - Đánh vào giáp địch (`ev.hitArmor && !ev.isCrit`): phát `hit_armor` (tiếng kim khí đanh khác hẳn tiếng trúng thịt `hit_enemy`).
   - Đạn găm tường (`ev.hitWall && !ev.blockedByShield && !ev.destroyedByMelee`, giới hạn 1 lần/step): phát `impact_wall` (tiếng đạn văng gạch đá).
   - `solar_converge_burst` (`combat-fx-weapons-p1b.ts`): phát `solar_converge`.
   - `shaman_heal`: phát `shaman_heal`.
   - `grass_rustle`: phát `grass_rustle`.
   - `shockwave_spawned`: phát `shockwave_slam`.
4. **Nhặt vật phẩm phân loại (`sim-events.ts`):**
   - `gold` → `pickup` (xu vàng leng keng)
   - `life_seed` → `pickup_health` (hạt máu tươi dịu)
   - `prey_emblem` → `pickup_energy` (xung năng lượng thợ săn)
   - `item_purchased`: `costGold === 0` (nhặt vũ khí rơi dưới đất) → `pickup_weapon`; `costGold > 0` (mua đồ cửa hàng) → `pickup`.
5. **Bước chân theo bề mặt địa hình (`GameScene.ts` — `resolveFootstepSurfaceSfx`):**
   - Gắn trực tiếp vào nhịp chân nhân vật tại `shouldEmitFootstepDust(...)` khi `zzfx.isAudioReady()` (chỉ phát khi người chơi đã mở khóa âm thanh thực tế, giữ nguyên hành vi bộ đếm `playedCount` trong các bài unit test headless).
   - Bề mặt `water` / `electrified_water` / `poison_swamp` / `oil` → `footstep_water`
   - Bề mặt `ice` hoặc nền mặc định Biome 2 → `footstep_ice`
   - Bề mặt `grass` / `burning_grass` → `footstep_grass`
   - Bề mặt `conveyor` hoặc nền mặc định Biome 3 → `footstep_metal`
   - Còn lại (Đại Sảnh, Biome 1, đá/tro) → `footstep_stone`.

---

## 5. Ghi Nhận Bản Quyền & Kiểm Định Hoàn Tất

- Cập nhật đồng bộ `CREDITS.md` và `docs/CREDITS.md` (giữ nguyên chuẩn `v2.0.0`) ghi nhận đầy đủ:
  - **"Oculus Audio Pack 01" by Oculus VR, LLC** — cấp phép theo **Creative Commons Attribution 4.0 International (`CC-BY-4.0`)** (`https://creativecommons.org/licenses/by/4.0/`), chú thích rõ các tệp đã qua cắt tỉa/phối lớp/mastering cho hiệu ứng chiến đấu, bước chân và giao diện.
  - **Still North Media — *Prepared Firearm SFX Library*** (`CC0 1.0`).
  - **Kenney Vleugels — *Interface Sounds* & *UI Audio*** (`CC0 1.0`).
  - **Các bộ sưu tập OpenGameArt `CC0 1.0`**.
  - Lưu kèm `apps/client/public/sfx/LICENSE-THIRD-PARTY.txt` và `apps/client/public/sfx/manifest.json` truy xuất nguồn gốc từng file.
- Kiểm định bằng:
  1. Script kiểm tra độc lập `scratch/verify_mastered_sfx.py` (`100%` file đạt chuẩn RIFF PCM16, `0` clipping, `onset <= 3.5ms` cho SFX tức thời, không tiếng nổ cụt cuối file).
  2. Bộ unit test TDD `apps/client/test/authentic-sfx-overhaul.test.ts`.
  3. Kiểm tra thực tế trên trình duyệt Chromium bằng Playwright (`100%` file nạp `200 OK`, giải mã sang `AudioBuffer`, đo năng lượng đầu ra thực tế `> 0` với `0` console warnings/errors).
  4. Chạy trọn bộ `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm e2e` xanh 100%.
