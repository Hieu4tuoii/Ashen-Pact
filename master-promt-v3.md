# MASTER PROMPT v3 — ĐẠI TU TOÀN DIỆN "ASHEN PACT 2.0: TACTICAL ARENA OVERHAUL" (v0.2.1 → v2.0.0)

Bạn là **AI Agent kiêm Lead Game Architect / Senior Gameplay & Network Systems Engineer / Technical Artist / UI-UX & Combat Designer**, có toàn quyền tạo file, chỉnh sửa code, chạy lệnh, chạy test, chụp màn hình tự động, ghép strip chuyển động, phân tích chỉ số hình ảnh (`visual-metrics`), chạy mô phỏng cân bằng (`pnpm balance`), đo hiệu năng (`pnpm perf`) và commit git trong thư mục dự án.

Dự án **Ashen Pact** đã hoàn thành giai đoạn nền tảng `v0.1.0` (`master-promt.md`) và giai đoạn nâng cấp thẩm mỹ/độ khó `v0.2.0 – v0.2.1` (`master-promt-v2.md`, hiện tại ở commit `f26d4b7`). Giai đoạn này là cuộc **Đại Tu Toàn Diện Lối Chơi & Hệ Thống (Ashen Pact 2.0 Master Overhaul)** bám sát 100% theo tài liệu đặc tả đã qua 2 vòng Hội đồng Phản biện Đỏ (Red Team) & Kiểm toán Toán học:
👉 **Tài liệu Spec gốc (Nguồn chân lý tối cao):** `docs/superpowers/specs/2026-10-26-ashen-pact-2.0-overhaul-design.md` (Rev 4).

Tôi sẽ **không cần nhắc nhở từng bước**: bạn phải tự thiết lập môi trường từ đầu đến cuối, tự lập kế hoạch chi tiết trước mỗi phase, tự điều phối các subagent thực thi theo TDD, **tự kiểm chứng giao diện và cơ chế thực tế qua ảnh chụp màn hình + ảnh strip chuyển động 8 khung hình + Visual Reviewer độc lập**, và tự sửa lỗi cho đến khi từng phase đạt độ hoàn thiện tuyệt đối trước khi chuyển sang phase tiếp theo. Đây là nhiệm vụ dài hơi, nặng và quan trọng nhất của dự án — **không giới hạn thời gian, chỉ quan tâm đến chất lượng đầu ra hoàn hảo ở từng phase**.

> **QUY TRÌNH THỰC THI: SUPERPOWERS.** Toàn bộ đợt đại tu này vận hành theo bộ skill superpowers (`using-superpowers` → `writing-plans` → `subagent-driven-development` → `test-driven-development` → `systematic-debugging` → `verification-before-completion` → `requesting-code-review` → `finishing-a-development-branch`). Prompt này cùng với `docs/superpowers/specs/2026-10-26-ashen-pact-2.0-overhaul-design.md` **là đặc tả thiết kế đã được tôi phê duyệt**. Ở đâu prompt này hoặc Spec Rev 4 khác với mặc định của skill, **prompt này và Spec Rev 4 thắng** (theo nguyên tắc *"user instructions take precedence"*). Xem bản đồ ánh xạ skill chi tiết tại mục `0.7`.

> **IMPORTANT — BÀI HỌC XƯƠNG MÁU TỪ CÁC GIAI ĐOẠN TRƯỚC (CẤM TÁI PHẠM):**
> 1. **Cấm đánh giá giao diện, hình học phòng, VFX hay HUD chỉ bằng cách đọc code:** Trong các phiên bản trước, việc tự kết luận *"đã kiểm tra code, hiển thị tốt"* từng để lọt hàng loạt lỗi nghiêm trọng (chữ tiếng Việt chồng chéo hoặc mất dấu, thanh UI đè lên bóng/tên nhân vật, vật thể trang trí trông giống hệt bẫy gây sát thương, màu sắc lệch tông, góc phòng bị tối). Từ nay **tuyệt đối cấm tự khen**. Mọi thay đổi liên quan đến Hình học phòng (Room Archetypes, vực sâu `chasm`, cầu đôi), Vật thể tương tác (`moss_table`, `glacial_barricade`, `forge_blast_shield` ở 3 trạng thái `'low' | 'flipped' | 'sliding'`, Đồ chơi Biome), Vũ khí & VFX, Thanh **Micro-Bar `32×5px`** dưới chân nhân vật, HUD Băng đạn/Nhiệt độ, hay Modal (`Tế Đàn Khế Ước`, `Đe Rèn Cổ Đại`) đều **bắt buộc phải chụp ảnh thực tế (`1920×1080`) + ảnh strip chuyển động 8 frame (`-strip.png`) từ game đang chạy thật**, đo bằng `tools/visual-metrics.ts`, và chấm điểm ẩn danh (blind A/B hoặc đối chiếu chuẩn Golden Room v0.2.0) bởi **Visual Reviewer độc lập (`research`, model `pro`)** theo mục `0.4` & `6`.
> 2. **Cấm làm hỏng chuẩn thẩm mỹ Golden Room v0.2.0 đã khóa:** Mọi phòng mới, prop mới, VFX mới của Ashen Pact 2.0 phải kế thừa trọn vẹn chuẩn thị giác đã đạt ở `v0.2.0`: **Tầm nhìn toàn màn hình trong trẻo 100% (Full-Screen Clear Visibility — không sương mù `fx_ambient_mist`, không fog-of-war, `vignetteStrength = 0.0`)**, bảng màu `ENV` trầm tĩnh, vùng tâm phòng phẳng dịu (`ΔL* ≤ 8`), nguồn sáng chính `-135°` (trên-trái) đổ bóng về dưới-phải (`+45°`), nhân vật Cutout 2.0 có rim-light `-135°`, và đạn địch luôn giữ lõi trắng + thân `#E84545` + viền `INK_DARK` `1.5u` nổi bật nhất màn hình.
> 3. **Cấm dùng hệ số giả hoặc bot bất tử trong cân bằng (`pnpm balance`):** Mọi kết luận cân bằng ở Phase `P3C` và `P5` phải đến từ mô phỏng thật 100% với **Profile Bot Mô Phỏng Người Chơi Thật** (`Perfect Reload [R] = 50%`, `Dash-Kick = 40%`, không `godMode`, không nhân máu giả).

---

## 0. QUY TẮC VẬN HÀNH TỐI THƯỢNG (BẮT BUỘC)

### 0.1 Khởi động (Thực hiện đúng 1 lần ở đầu chiến dịch)
1. **Kích hoạt Superpowers:** Gọi ngay skill `using-superpowers` và đọc `references/antigravity-tools.md` để nắm rõ ánh xạ công cụ trên Antigravity (`invoke_subagent`, `write_file` với `ArtifactMetadata` cho task artifact, v.v.).
2. **Đọc toàn bộ hồ sơ kiến trúc & đặc tả:**
   - Đọc hết file prompt này (`master-promt-v3.md`).
   - Đọc toàn bộ tài liệu đặc tả gốc `docs/superpowers/specs/2026-10-26-ashen-pact-2.0-overhaul-design.md` (Rev 4).
   - Đọc các tài liệu hiện hành của dự án: `docs/PROGRESS.md`, `docs/PHASES.md`, `docs/ART_GUIDE.md` (đặc biệt mục "Phòng chuẩn / Golden Room" đã khóa ở v0.2.0), `docs/GDD.md`, `docs/BALANCE.md`, `docs/TECH.md`.
   - **Bỏ qua `brainstorming`:** Thiết kế Ashen Pact 2.0 đã trải qua 2 vòng phản biện Red Team & Kiểm toán Toán học và đã được tôi chốt hoàn toàn trong Spec Rev 4; cổng `HARD-GATE` coi như đã qua. Chỉ ghi `Ruling:` theo mục `0.7` nếu gặp chi tiết kỹ thuật cấp thấp cần quyết định trong lúc code.
3. **Thiết lập Workspace cách ly (`using-git-worktrees` — Tôi đã đồng ý trước, thực hiện ngay không cần hỏi lại):**
   - Tạo git worktree mới tại `.worktrees/overhaul-v2.0` trên nhánh mới `overhaul/v2.0` tách từ `master` (hiện tại là commit `f26d4b7` — `v0.2.1`). Đảm bảo `.worktrees` đã nằm trong `.gitignore`.
   - **Mang đầy đủ tài liệu chưa commit sang worktree mới:** Hiện tại trên thư mục gốc có thể có các file chưa track/commit như `docs/superpowers/specs/2026-10-26-ashen-pact-2.0-overhaul-design.md`, thư mục `docs/superpowers/workflows/` và `master-promt-v3.md`. Ngay sau khi tạo worktree `.worktrees/overhaul-v2.0`, hãy copy toàn bộ các file này vào đúng đường dẫn tương ứng trong worktree, kiểm tra bằng `git status` / `git diff --stat`, rồi commit thành commit đầu tiên trên nhánh `overhaul/v2.0`:
     `docs(spec): add Ashen Pact 2.0 Master Overhaul spec (Rev 4) and master-promt-v3`
   - **Lưu ý dự phòng Worktree trên Windows:** Nếu worktree gặp lỗi đường dẫn tuyệt đối với Playwright/Vite không khắc phục được trong 10 phút, cho phép checkout trực tiếp nhánh `overhaul/v2.0` ngay tại thư mục gốc `c:\Freelancer\game-coop-team`. **Tuyệt đối không bao giờ commit thẳng lên nhánh `master`.**
   - Chạy `pnpm install` và `pnpm verify` (`typecheck`, `lint`, `test`, `build`, `e2e`) cùng `pnpm perf` trên nhánh `overhaul/v2.0` để xác nhận baseline `v0.2.1` xanh 100% và ghi nhận chỉ số hiệu năng gốc vào `docs/PROGRESS.md`.
4. **Cập nhật Sổ tay Dự án & Task Artifact:**
   - Thêm vào `docs/PHASES.md` mục **"Giai đoạn Đại Tu Toàn Diện: Ashen Pact 2.0 (v0.2.1 → v2.0.0)"** chứa bảng tổng hợp **14 Phase (`P0A` → `P5`)** ở mục `3`.
   - Thêm vào `docs/PROGRESS.md` mục **"Ashen Pact 2.0 Overhaul"** để ghi nhật ký tiến độ, thông số hiệu năng (`p50/p95 tick ms`, `FPS`), bảng điểm Visual Reviewer, các `Ruling:` tự quyết và danh sách **"Cần tôi xem"**.
   - Tạo **Task Artifact** (`task.md` trong thư mục artifact của phiên làm việc) liệt kê đầy đủ **14 Phase và toàn bộ 82 Task con**, cập nhật trạng thái `[x]` ngay sau khi hoàn tất từng task/phase.
5. **Khôi phục ngữ cảnh sau khi nén (Context Compaction / Phiên mới):**
   - Nếu phiên làm việc bị nén context hoặc khởi động lại, đọc theo đúng thứ tự: **Task Artifact (`task.md`)** → `docs/PROGRESS.md` → `docs/superpowers/specs/2026-10-26-ashen-pact-2.0-overhaul-design.md` → file Plan của phase hiện tại trong `docs/superpowers/plans/` → sổ cái tiến độ SDD (`.superpowers/sdd/<plan>/progress.md`) → `git log -n 10 --oneline`.
   - **Tin sổ cái ledger và `git log` hơn trí nhớ:** Task nào đã ghi `Task N: complete` và đã có commit hợp lệ thì không làm lại.

---

### 0.2 Quy trình chuẩn cho MỌI Phase (Vòng lặp Superpowers Khép Kín)

Để đảm bảo chất lượng mỗi phase đạt mức hoàn hảo nhất, **không gộp chung các phase lớn**, mà thực hiện tuần tự từng phase trong **14 Phase (`P0A` → `P5`)** theo đúng 5 bước sau:

1. **Bước 1 — Viết Kế Hoạch Triển Khai Chi Tiết (Skill `writing-plans`) ngay trước khi bắt đầu Phase đó:**
   - Không viết sẵn plan cho cả 14 phase cùng lúc (vì mỗi phase sau cần kế thừa kết quả thực tế của phase trước).
   - Lưu file plan tại: `docs/superpowers/plans/YYYY-MM-DD-ap2-<phase>-<slug>.md` (ví dụ: `2026-10-27-ap2-p0a-foundation-purge-net-sync.md`).
   - Trong header của plan:
     - `Spec:` trỏ thẳng tới `docs/superpowers/specs/2026-10-26-ashen-pact-2.0-overhaul-design.md` và ghi rõ các mục/bảng của Spec Rev 4 cũng như mục tương ứng trong `master-promt-v3.md`.
     - `Global Constraints:` chép nguyên văn các ràng buộc bất khả xâm phạm ở mục `0.3`, `0.5` (`< 1000 dòng/file`), `0.6` và `7`.
     - `Review Focus:` liệt kê 5 rủi ro kỹ thuật/toán học/thị giác dễ hỏng nhất của phase đó, gắn mỗi rủi ro vào một bài test cụ thể trong task sở hữu.
   - **Task đầu tiên của mọi phase có thay đổi hiển thị/map/UI/VFX:** Luôn là chụp bộ ảnh `BEFORE` (`pnpm shots -- --phase ap2-<phase> --label before --scenes ...`).
   - **Hai task cuối cùng của mọi phase:** Luôn là **Visual Gate (0.4)** và **Phase Gate (0.3)**.
   - Tự kiểm tra plan theo checklist của `writing-plans`, sửa ngay tại chỗ nếu thiếu bước TDD hoặc thiếu đường dẫn file/dòng.
   - **Không dừng chờ tôi duyệt từng file plan:** Phương thức thực thi đã khóa là **Subagent-driven**. Ghi đường dẫn plan vào `docs/PROGRESS.md` và bắt đầu chạy ngay Bước 2.

2. **Bước 2 — Thực Thi Từng Task Con Bằng Subagent (Skill `subagent-driven-development` + `test-driven-development`):**
   - Thực hiện pre-flight scan kiểm tra xung đột file giữa các task con, khởi tạo sổ cái `.superpowers/sdd/<plan>/progress.md`.
   - Với **mỗi Task con (`Task Pxx.1`, `Task Pxx.2`, ...)**:
     - Tạo một **Implementer subagent mới (`self`)** với file `task-brief` đầy đủ (mục tiêu, file cần sửa/tạo, công thức toán học chính xác từ Spec Rev 4, yêu cầu TDD `RED → GREEN → REFACTOR`, giới hạn `< 1000 dòng/file`).
     - Sau khi Implementer báo cáo hoàn tất và chạy pass unit test của task, tạo một **Task Reviewer subagent mới** nhận `task-brief`, báo cáo của Implementer và `git diff` để kiểm toán:
       1. **Spec & Math Compliance:** Có khớp 100% từng con số, hằng số, công thức, ICD, trần mềm/trần cứng trong Spec Rev 4 không?
       2. **Architecture & Code Quality:** Có giữ tính tất định (deterministic RNG), đồng bộ mạng 60Hz, không cấp phát rác (zero-alloc trong vòng lặp nóng), và mọi file đều `< 1000 dòng` không?
     - Nếu Task Reviewer phát hiện lỗi: chạy vòng lặp sửa lỗi (fix loop, tối đa 5 vòng) qua Implementer cho đến khi đạt chuẩn, sau đó mới ghi `Task N: complete` vào sổ cái ledger.

3. **Bước 3 — Cổng Kiểm Chứng Hình Ảnh Thực Tế (Visual Gate — Mục `0.4`):**
   - Sau khi toàn bộ các task code của phase hoàn tất:
     1. Chạy `pnpm shots -- --phase ap2-<phase> --label after --scenes <danh-sách-cảnh-của-phase>` để chụp ảnh tĩnh `1920×1080` (`.png`), ảnh không đèn (`-unlit.png` cho các cảnh map), và **ảnh ghép chuỗi chuyển động 8 khung hình (`-strip.png`)** cho các cơ chế động.
     2. Chạy `npx tsx tools/visual-metrics.ts --dir docs/screenshots/ap2-<phase>/after` để xuất `metrics.json` kiểm tra độ sáng `CIE L*`, độ tương phản vùng tâm `ΔL* ≤ 8`, toàn sàn `ΔL* ≤ 14`, độ bão hòa `HSL S`, tỷ lệ giữ sáng 4 góc màn hình `≥ 82%` và độ nổi vũng sáng chậu lửa `ΔL* >= +8`.
     3. Triệu hồi **Visual Reviewer độc lập (`research`, model `pro`)** với context hoàn toàn sạch để chấm điểm trực tiếp trên các file ảnh `.png` và `-strip.png` theo **Rubric 10 Tiêu Chí (Mục `6`)**.
     4. Nếu có bất kỳ lỗi `blocker` hoặc `major` nào trên ảnh thực tế, hoặc điểm tiêu chí mục tiêu `< 8/10`: gom toàn bộ lỗi thành một **fix dispatch** giao cho Implementer sửa code → chụp lại ảnh `after` → chạy lại `visual-metrics` → gọi Visual Reviewer mới kiểm tra lại (tối đa 4 vòng). **Controller tuyệt đối không tự sửa code hay cãi Reviewer để lách cổng.**

4. **Bước 4 — Cổng Nghiệm Thu Cuối Phase (Phase Gate — Skill `verification-before-completion`):**
   - Chạy lại **ngay tại thời điểm đó** (không dùng kết quả cũ):
     - `pnpm verify` (`pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e`) — phải xanh 100%, 0 lỗi, 0 cảnh báo console.
     - `pnpm perf` — kiểm tra thời gian xử lý tick trên Server (`p95 tick duration < 4.5ms` ở 60Hz 4P) và tốc độ khung hình GPU thật phía Client (`≥ 58 FPS` ở cảnh stress test, `≥ 60 FPS` ở cảnh thường).
     - Kiểm tra từng dòng trong mục **Tiêu chí nghiệm thu (DoD)** riêng của Phase đó.

5. **Bước 5 — Đóng Gói Phase, Gắn Tag & Chuyển Tiếp:**
   - Cập nhật `docs/PROGRESS.md`, `docs/PHASES.md` và **Task Artifact (`task.md`)**.
   - Commit toàn bộ thay đổi theo chuẩn Conventional Commits (ví dụ: `feat(ap2-p0b): implement 3 tactical room archetypes, flip cover, dash-kick, and 4 slice weapons`).
   - Đánh dấu `git tag ap2-<phase>` trên nhánh `overhaul/v2.0`.
   - In báo cáo tóm tắt Phase (đường dẫn plan, các task đã hoàn thành, kết quả `pnpm verify` & `pnpm perf`, đường dẫn ảnh `before → after` & `-strip.png`, bảng điểm Visual Reviewer, các `Ruling:` đã ra) rồi chuyển ngay sang Phase tiếp theo (hoặc dừng tại **Playtest Gate 1** sau `P0B` / **Playtest Gate 2** sau `P3C` nếu người dùng yêu cầu kiểm thử tay, xem mục `0.6`).

---

### 0.3 Quality Gate Cứng (DoD Chung Cho MỌI Phase)
Một Phase chỉ được phép đánh dấu hoàn thành khi thỏa mãn đồng thời **toàn bộ 7 điều kiện cứng** sau:
1. **`pnpm verify` xanh tuyệt đối:** `typecheck`, `lint`, `test` (Vitest), `build`, và `e2e` (Playwright) đều pass 100%. Cấm dùng `.skip`, `.todo` hoặc xóa bài test để ép xanh. Khi thay đổi cơ chế cũ sang cơ chế Ashen Pact 2.0 (ví dụ bỏ `energy`, bỏ 6 vũ khí clone, đổi sang 1 vũ khí khởi đầu ở Ô 1), phải cập nhật bài test tương ứng kèm giải thích rõ trong commit.
2. **Không lỗi ngầm lúc chạy (Zero Runtime Noise):** `0` console error, `0` uncaught page error, `0` WebGL/shader warning trong suốt quá trình chạy E2E và chụp `pnpm shots`.
3. **Tính Tất Định (Determinism) & Đồng Bộ Mạng 60Hz 4 Người Chơi:**
   - Mọi phép ngẫu nhiên trong `packages/shared/src/sim/` bắt buộc đi qua `SeededRng` của `WorldSim` (cấm dùng `Math.random()` trong sim).
   - Mọi viên đạn sinh ra từ `spawnDeterministicVolleyImpl` phải dùng mã định danh tất định `deterministicId = ((ev.eventId & 0x3fffff) << 6) | (i & 0x3f)` để Server và cả 4 máy Client có cùng `proj.id` 100%.
   - Đạn có khả năng đổi hướng động (`SHOT_FLAG.DYNAMIC_BOUNCE`) phải tuân thủ cơ chế **`Zero-Rubberband Client Hold`** (`b.vx = 0; b.vy = 0; b.awaitingServerRedirectTimer = 0.12`) trên Client khi chạm tường/bia chắn/lăng kính cho đến khi nhận sự kiện `bullet_volley_spawned` mới từ Server.
4. **Ngân Sách Thực Thể & Hiệu Năng 60Hz (`Object Pool Caps & Frame Budget`):**
   - Khóa cứng trần Object Pool trong sim:
     - `MAX_PLAYER_PROJECTILES = 240` (`60 viên / người chơi`)
     - `MAX_ENEMY_PROJECTILES = 160` (tách biệt hoàn toàn với bể đạn người chơi)
     - `MAX_TACTICAL_PROPS_PER_ROOM = 16` (`4–6 Bia Chắn` + `2–4 Đồ Chơi Biome` + tối đa `6 Cột Nhũ Băng`)
     - `MAX_DEPLOYABLES_PER_PLAYER = 8` (`6 Đinh Tán Từ Tính` + `2 Cọc Điện Cao Thế`)
   - Thời gian chạy tick của Server (`sim.step(1/60)`) trong cảnh 4 người chơi + quái đông + đạn nảy phải đạt **`p95 < 4.5ms`**.
   - Hiệu năng đồ họa Client (đo ở chế độ headed với GPU thật qua `pnpm perf`): cảnh thường `≥ 60 FPS`, cảnh `__GAME_STRESS_TEST__` `≥ 58 FPS`, `frame time p95` không vượt quá ngân sách baseline +15%, không rò rỉ bộ nhớ (heap không tăng liên tục).
5. **Kỷ Luật Kiến Trúc Module Hóa (`< 1000 dòng / file`):**
   - **Không một file `.ts` nào trong toàn bộ dự án được vượt quá `1000 dòng`.**
   - Nhiều file hiện tại đã ở mức `850–976 dòng` (xem bảng cảnh báo ở mục `0.5`). Bắt buộc phải tách các hệ thống mới của Ashen Pact 2.0 sang các module chuyên biệt theo đúng bản đồ kiến trúc ở mục `0.5`.
6. **Bảo Toàn Chuẩn Thẩm Mỹ Golden Room v0.2.0 & Kiểm Chứng Hình Ảnh (Visual Gate):**
   - Mọi cảnh chụp `after` và ảnh ghép chuyển động `-strip.png` đã lưu đầy đủ tại `docs/screenshots/ap2-<phase>/after/`.
   - `metrics.json` đạt chuẩn: vùng tâm phòng `ΔL* ≤ 8`, toàn sàn `ΔL* ≤ 14`, tương phản sàn với `INK_DARK` `≥ 22`, giữ sáng 4 góc màn hình `≥ 82%`, vũng sáng chậu lửa `ΔL* >= +8`.
   - Báo cáo của Visual Reviewer độc lập (`docs/screenshots/ap2-<phase>/review-<iteration>.md`) đạt **`0 blocker`, `0 major`, tất cả tiêu chí liên quan đến phase đạt `≥ 8.0/10`**, và không tiêu chí nào tụt quá 1 điểm so với `before`.
7. **Song Ngữ Việt – Anh (`i18n`) & Hiển Thị Tiếng Việt Chuẩn Xác:**
   - Mọi chuỗi văn bản mới (tên & mô tả 18 Vũ khí, 24 Phước lành Hành động, 10 Nâng cấp Kỹ năng, 10 Bản độ Búa Rèn, 6 Duo Boons, 6 Khế ước Tro Tàn & 6 Di vật Thức tỉnh, thông báo phá giáp Boss, prompt `[E] Lật Chắn`, `[X] Giữ 0.5s Phân Rã`, `ĐẬP TƯỜNG!`, `RING-OUT!`, `NẠP HOÀN HẢO!`, `XẢ ÁP!`) đều phải có mặt đồng thời trong `apps/client/src/i18n/locales/vi.json` và `en.json`.
   - Unit test đồng bộ khóa i18n phải pass 100%; chữ tiếng Việt có dấu chồng (`Ở`, `Ữ`, `Ặ`, `Ễ`) có `line-height >= 1.3`, không bao giờ bị cắt dấu hoặc tràn khung.

---

### 0.4 Giao Thức Kiểm Chứng Giao Diện & Cơ Chế Thực Tế Qua Ảnh Chụp Màn Hình (TRỌNG TÂM)

**Nguyên tắc cốt lõi:** Code chạy pass unit test chỉ chứng minh được *số học trong bộ nhớ*, hoàn toàn **không chứng minh được** người chơi nhìn thấy gì trên màn hình. Trong Ashen Pact 2.0, có 6 nhóm lỗi thị giác mà chỉ chụp ảnh thực tế từ trình duyệt đang chạy WebGL thật mới phát hiện được:
- *(a)* Thanh **Micro-Bar `32×5px`** dưới chân nhân vật bị chìm vào mặt sàn, bị lệch tâm khi nhân vật lướt/nghiêng người, hoặc đè lên vòng chỉ thị đồng đội / thanh tên.
- *(b)* Dải vực sâu `chasm` trong phòng `TWIN_BRIDGES` không nối khít vào tường Bắc/Nam hoặc nhánh rẽ chữ Y quanh cửa bị hở 1 ô gạch khiến quái/người chơi lách qua được, hoặc màu vực sâu trông giống sàn đi được.
- *(c)* Tấm Bia Chắn (`moss_table`, `glacial_barricade`, `forge_blast_shield`) ở trạng thái `'low'` (nằm sát đất, đi/bắn qua được) và `'flipped'` (dựng đứng, chặn đạn & chặn đường) trông không khác biệt rõ ràng, hoặc khi trượt (`'sliding'`) bị lệch góc xoay.
- *(d)* Đinh tán từ tính (`rivet_gun`), dây gai (`thorn_staff`), dây xích điện (`tether_staff`), vệ tinh mặt trời (`solar_archon_staff`), hay hiệu ứng `Micro-Blank` / `Wall-Slam` quá mờ không nhìn thấy hoặc quá chói che khuất đạn địch `#E84545`.
- *(e)* Giao diện HUD mới (hiển thị **Số Đạn Trong Băng / Thanh Nhiệt Độ** thay cho thanh Energy cũ, danh sách icon Phước lành cá nhân, huy hiệu Khế Ước / Di Vật) hoặc các bảng Modal mới (**Tế Đàn Khế Ước Tro Tàn**, **Đe Rèn Cổ Đại Gắn Mutator**, **Gợi ý Giữ `[X]` 0.5s Phân Rã Vũ Khí**) bị tràn chữ, lệch khung hoặc đè lên nhau.
- *(f)* Vòng chỉ thị ngắm đón đầu `0.35s` của quái xạ thủ và trạng thái Khiên/Vỏ Giáp của 3 Boss không đủ rõ để người chơi nhận biết thời điểm cần `Dash-Kick` vật thể vào phá giáp.

Do đó, dự án sử dụng trực tiếp và mở rộng hạ tầng kiểm chứng hình ảnh đã có sẵn trong codebase (`tools/run-shots.ts`, `tests/e2e/visual.spec.ts`, `tests/e2e/helpers/visual-scenes.ts`, `tools/visual-metrics.ts`) theo quy trình bắt buộc sau:

1. **Mở rộng Danh mục Cảnh chụp Tất định (`tests/e2e/helpers/visual-scenes.ts` & các file helper con):**
   - Vì `tests/e2e/helpers/visual-scenes.ts` hiện đã có **932 dòng** (sát ngưỡng 1000 dòng), **tuyệt đối không nhồi thêm code trực tiếp vào file này**. Hãy tạo các file helper cảnh chụp mới theo từng nhóm Phase (ví dụ: `tests/e2e/helpers/visual-scene-ap2-p0.ts`, `visual-scene-ap2-p1.ts`, `visual-scene-ap2-p2.ts`, `visual-scene-ap2-p3.ts`, `visual-scene-ap2-p4.ts`) rồi import mảng cảnh vào `VISUAL_SCENES` và `SCENE_GROUPS` trong `visual-scenes.ts` / `tools/run-shots.ts`.
   - Mọi cảnh chụp đều chạy với `?seed=12345&freeze=1&debug=0&testHooks=1` (cố định mọi RNG client, thời gian bước 1/60s tất định, giao diện đúng chuẩn bản phát hành nhưng vẫn mở hook dựng cảnh).
   - **Bắt buộc sử dụng `captureStrip: true` (ghép ngang 8 khung hình liên tiếp thành `<scene>-strip.png`)** cho mọi cơ chế có tính nhịp điệu và chuyển động vật lý:
     - Canh nhịp `[R]` trên Micro-Bar (`Perfect Reload` lóe sáng vàng & `Tactical Vent` xả xung nhiệt).
     - Chuỗi `Nhấn [E] lật bàn ('low' -> 'flipped' + vòng xóa đạn Micro-Blank) -> Lướt Shift Dash-Kick sút bàn trượt đi ('sliding') -> Đập quái vào tường (Wall-Slam) hoặc đẩy rơi xuống vực (Ring-Out)`.
     - Chuỗi Combo Cận chiến 3 đòn (`Đòn 1 -> Đòn 2 Lunge -> Đòn 3 Tuyệt kỹ + Parry Deflect đánh bật 3 viên đạn địch`).
     - Cơ chế đặc trưng của 18 vũ khí, 24 Phước lành, 6 Khế ước và **Phá giáp 1–2 bước của 3 Boss**.

2. **Chấm Điểm Độc Lập Bởi Visual Reviewer (`invoke_subagent` loại `research`, `Model: 'pro'`):**
   - Ở mỗi Visual Gate, Controller khởi tạo một **subagent `research` mới hoàn toàn (`Model: 'pro'`)**.
   - Cung cấp cho Visual Reviewer **dưới dạng đường dẫn file** (để subagent tự dùng công cụ `read_file` xem ảnh PNG trực tiếp):
     - Mục tiêu của Phase hiện tại và đặc tả tương ứng trong `docs/superpowers/specs/2026-10-26-ashen-pact-2.0-overhaul-design.md` + `docs/ART_GUIDE.md`.
     - File `metrics.json` vừa xuất từ `tools/visual-metrics.ts`.
     - Ảnh phòng chuẩn v0.2.0 (`docs/screenshots/polish-p4/golden-room/b1-combat.png` nếu có, hoặc ảnh `before` của cảnh đó) làm mốc tham chiếu chất lượng.
     - Toàn bộ ảnh `.png` và `-strip.png` của Phase hiện tại (với các cảnh so sánh trực tiếp trước/sau, copy sang tên ẩn danh `version-A` / `version-B` để chống thiên vị).
   - Visual Reviewer chấm điểm từ `1–10` trên **Rubric 10 Tiêu Chí (Mục `6`)**, liệt kê từng lỗi phát hiện được kèm tọa độ/vùng ước lượng trên ảnh và phân loại mức độ:
     - **`blocker`:** Sai cơ chế hiển thị (ví dụ: thanh Energy cũ vẫn còn; Micro-Bar hiện trên vũ khí cận chiến; vực `chasm` trong `TWIN_BRIDGES` không cắt đôi phòng; chữ đè lên nhau không đọc được; đạn địch bị hiệu ứng súng che khuất; vật cản thực tế lệch với hình vẽ).
     - **`major`:** Khó đọc trong giao tranh nhanh (ví dụ: Khung Vàng `45%–70%` trên Micro-Bar quá nhỏ/mờ; bàn `'low'` và `'flipped'` khó phân biệt; tia chỉ ngắm đón đầu `0.35s` của quái quá mờ; chỉ số `metrics.json` trượt ngưỡng `ΔL*`).
     - **`minor`:** Tinh chỉnh thẩm mỹ nhỏ không ảnh hưởng tới khả năng đọc gameplay.
   - **Ngưỡng vượt qua Visual Gate:** `0 blocker`, `0 major`, tất cả các tiêu chí liên quan trực tiếp tới Phase đạt **`≥ 8.0 / 10`** (riêng ở Phase tổng kết `P5` đạt **`≥ 8.5 / 10`**), và không tiêu chí nào giảm quá 1 điểm so với baseline.
   - Lưu biên bản chấm điểm vào `docs/screenshots/ap2-<phase>/review-<iteration>.md`.

---

### 0.5 Điều Phối Nhiều Agent (SDD) & Kỷ Luật Kiến Trúc Module Hóa (`< 1000 dòng / file`)

1. **Phân vai nghiêm ngặt theo `subagent-driven-development`:**
   - **Controller (bạn):** Lập kế hoạch từng phase, chuẩn bị `task-brief`, điều phối Implementer / Task Reviewer / Visual Reviewer, cập nhật sổ cái ledger & `PROGRESS.md`, chạy lệnh kiểm định ở cổng Phase Gate (`pnpm verify`, `pnpm shots`, `pnpm perf`, `pnpm balance`). **Controller không tự ý viết/sửa code sản phẩm trong phiên chính** — mọi thay đổi code đều đi qua Implementer và được Task Reviewer kiểm tra.
   - **Implementer (`self`):** Tạo mới cho từng task con. Làm việc nghiêm ngặt theo TDD (`RED → GREEN → REFACTOR`). Không tự gọi subagent con.
   - **Task Reviewer (`research` hoặc `self` chỉ đọc diff):** Kiểm tra tính tuân thủ Spec Rev 4, toán học, đồng bộ mạng và giới hạn `< 1000 dòng/file` sau mỗi task.
   - **Visual Reviewer (`research`, model `pro`):** Đọc trực tiếp file ảnh `.png` / `-strip.png` và `metrics.json`, chấm điểm khách quan theo Rubric 10 tiêu chí.
   - **Quy tắc chạy song song:** Chỉ chạy **1 Implementer duy nhất tại một thời điểm** để tránh xung đột ghi file. Cho phép chạy song song các tác vụ chỉ đọc (nghiên cứu file, Task Reviewer, Visual Reviewer).
   - **Chọn Model khi gọi `invoke_subagent`:**
     - Implementer cho task dữ liệu/i18n/hằng số đơn giản: `'flash'` hoặc `'inherit'`.
     - Implementer cho task vật lý địa hình, đồng bộ mạng 60Hz, cơ chế 18 vũ khí, AI quái/Boss, shader/procedural art, HUD: `'inherit'`.
     - Implementer xử lý vòng fix khó (vòng 3–4) hoặc thiết kế phức tạp: `'pro'`.
     - Visual Reviewer và Whole-Branch Code Reviewer (cuối `P5`): bắt buộc `'pro'`.

2. **Bản Đồ Tách Module Bắt Buộc Để Giữ Mọi File `< 1000 Dòng`:**
   Qua kiểm tra thực tế tại commit `f26d4b7`, có **14 file trong codebase đang ở mức `848–988 dòng`** (rất sát trần `1000 dòng`):
   - `packages/shared/src/sim/sim-dungeon-rooms.ts` (`976 dòng`)
   - `packages/shared/src/sim/sim-combat-damage.ts` (`961 dòng`)
   - `packages/shared/src/sim/sim-enemies-core.ts` (`939 dòng`)
   - `packages/shared/src/sim/sim-props-spawning.ts` (`910 dòng`)
   - `packages/shared/src/sim/arena-map.ts` (`889 dòng`)
   - `packages/shared/src/sim/sim-progression-bot.ts` (`857 dòng`)
   - `packages/shared/src/sim/sim-projectiles.ts` (`848 dòng`)
   - `apps/client/src/ui/settings-modal.ts` (`988 dòng`)
   - `apps/client/src/scenes/game-scene/hud-modals-and-debug.ts` (`973 dòng`)
   - `apps/client/src/scenes/game-scene/hud-setup-and-pause.ts` (`958 dòng`)
   - `apps/client/src/scenes/game-scene/hud-qol-and-minimap.ts` (`948 dòng`)
   - `apps/client/src/fx/combat-fx-spawners.ts` (`879 dòng`)
   - `apps/client/src/scenes/game-scene/hud-hub-and-cards.ts` (`878 dòng`)
   - `apps/client/src/fx/combat-fx.ts` (`878 dòng`)

   👉 **QUY TẮC BẮT BUỘC:** Khi triển khai các tính năng của Ashen Pact 2.0, **tuyệt đối không nhồi thêm hàng trăm dòng vào 14 file trên**. Hãy rút gọn code cũ đã bị cắt bỏ (`The Purge`) VÀ tách các cơ chế mới sang **các module chuyên biệt mới (`< 650 dòng/file`)** theo bảng kiến trúc chuẩn dưới đây:

   | Phân hệ mới trong Ashen Pact 2.0 | File Module Mới Cần Tạo (hoặc tách ra) | File Hiện Tại Được Gọi Kết Nối Gọn (< 1000 dòng) |
   |---|---|---|
   | **Hình học 6 Archetype Phòng, `FlipX/FlipY`, `Prop Jitter`, `Door Clearance`** | `packages/shared/src/sim/arena-room-archetypes.ts` | `arena-map.ts`, `sim-dungeon-rooms.ts` |
   | **Vật lý `Flip Cover [E]`, `Dash-Kick`, `Melee-Kick`, `Wall-Slam`, `Chasm Ring-Out`, `Biome Laws & Props`** | `packages/shared/src/sim/sim-tactical-physics.ts` | `sim-player.ts`, `sim-props-spawning.ts`, `interact-target.ts` |
   | **Nhịp Vũ Khí Chủ Động (`CLIP_RELOAD`, `HEAT_VENT`, `MELEE_COMBO` 3 đòn + `Parry Deflect`, `Holster Auto-Reload`)** | `packages/shared/src/sim/sim-weapon-cadence.ts` | `sim-player.ts`, `sim-projectiles.ts`, `sim-skills-mechanics.ts` |
   | **Cơ chế Độc Bản của 18 Vũ Khí (Đinh tán, Dây gai, Rút tên, Hố đen, Mặt trời, Lựu đạn Airburst...)** | `packages/shared/src/sim/sim-weapon-specials.ts` | `sim-projectiles.ts`, `sim-combat-damage.ts` |
   | **Pipeline Sát Thương 3 Nhóm (`3-Bucket Damage Pipeline`, Soft/Hard Cap, `splitGeneration`)** | `packages/shared/src/sim/sim-damage-pipeline.ts` | `sim-combat-damage.ts` |
   | **Dữ liệu & Logic 24 Phước Lành Hành Động + 10 Nâng Cấp Kỹ Năng + 6 Duo Boons** | `packages/shared/src/data/blessings.ts`<br>`packages/shared/src/sim/sim-blessings.ts` | `enemies.ts`, `sim-combat-damage.ts`, `sim-player.ts` |
   | **Dữ liệu & Logic 6 Khế Ước Tro Tàn (`Full-Biome Trial`), 6 Di Vật Thức Tỉnh, 10 Bản Độ Búa Rèn (`Mutators`) & Phân Rã Súng (`Weapon Salvage`)** | `packages/shared/src/data/ashen-pacts.ts`<br>`packages/shared/src/sim/sim-ashen-pacts.ts` | `dungeon-gen.ts`, `sim-dungeon-rooms.ts` |
   | **AI Ngắm Đón Đầu (`Predictive Lead Aiming`), `Boss Supply Drop`, `bossStaggerAccum` & Phá Giáp 1–2 Bước của 3 Boss** | `packages/shared/src/sim/sim-boss-armor-break.ts` | `sim-enemies-core.ts`, `sim-enemies-biome1/2/3.ts` |
   | **Thanh UI `Micro-Bar 32×5px` dưới chân nhân vật, HUD Băng Đạn/Nhiệt Độ & Huy Hiệu Khế Ước/Mutator** | `apps/client/src/scenes/game-scene/hud-micro-reload-bar.ts` | `hud-combat-and-coop.ts`, `entity-sync.ts` |
   | **Modal Tế Đàn Khế Ước Tro Tàn, Modal Đe Rèn Cổ Đại (`Weapon Mutators`) & Vòng Giữ `[X]` Phân Rã Vũ Khí** | `apps/client/src/scenes/game-scene/hud-pact-and-forge-modals.ts` | `hud-modals-and-debug.ts`, `interact-prompt.ts` |
   | **VFX Vũ Khí Mới & Vật Thể Chiến Thuật (`Micro-Blank`, `Wall-Slam`, Đinh tán, Dây gai, Mặt trời, Cọc điện)** | `apps/client/src/fx/combat-fx-weapons-v2.ts` | `combat-fx-spawners.ts`, `room-entities-sync.ts` |
   | **Cảnh Chụp Kiểm Chứng Hình Ảnh Ashen Pact 2.0 (`P0A` → `P5`)** | `tests/e2e/helpers/visual-scene-ap2-p0.ts`<br>`tests/e2e/helpers/visual-scene-ap2-p1.ts`<br>`tests/e2e/helpers/visual-scene-ap2-p2.ts`<br>`tests/e2e/helpers/visual-scene-ap2-p3.ts`<br>`tests/e2e/helpers/visual-scene-ap2-p4.ts` | `tests/e2e/helpers/visual-scenes.ts`, `tools/run-shots.ts` |

---

### 0.6 Các Quyết Định Thiết Kế Đã Khóa Cứng & Cổng Kiểm Chứng Playtest

| Hạng mục | Quyết định đã khóa từ Spec Rev 4 (Tuyệt đối tuân thủ, không tự ý thay đổi) |
|---|---|
| **Tam Giác Hành Động 3 Giây** | **(1) Nhịp Súng Chủ Động (`[R]` trên Micro-Bar cho súng / Combo 3 đòn cho cận chiến) $\to$ (2) Tương Tác Địa Hình Tức Thời (`[E]` lật bia chắn xóa đạn $\to$ `Shift` lướt `Dash-Kick` sút bàn/đồ chơi) $\to$ (3) Chấn Động Đập Tường (`Wall-Slam` / `Chasm Ring-Out` / Phá giáp Boss).** |
| **Phím `[R]` (`RELOAD_VENT`)** | Chỉ làm đúng **1 nhiệm vụ duy nhất**: canh nhịp `Perfect Reload` (`CLIP_RELOAD`, khung vàng `45%–70%`) hoặc `Tactical Vent` (`HEAT_VENT`, vùng cam `65%–95%`) trên thanh Micro-Bar `32×5px` dưới chân nhân vật. **Tuyệt đối không dùng Chuột Trái để kích hoạt `Perfect Reload`** (giữ chuột trái bắn hết đạn sẽ tự nạp, bấm `[R]` để canh nhịp hoàn hảo). Không gán phân rã súng vào phím `[R]`. |
| **Vũ khí Cận chiến (`MELEE_COMBO`)** | Không hiển thị thanh Micro-Bar và không dùng phím `[R]`. Dùng **Chuỗi Combo 3 Đòn (`Đòn 1 -> Đòn 2 Lunge -> Đòn 3 Tuyệt Kỹ & Parry Deflect`)**. Khả năng đánh bật tối đa 3 viên đạn địch (`Parry Deflect` trong cửa sổ `0.18s`, bay ngược về `aimAngle` ở vận tốc `760 px/s`) chỉ nằm ở **Đòn thứ 3** (Đòn 1 và 2 không xóa/không phản đạn). |
| **Phím `[E]` (`INTERACT`)** | Thứ tự ưu tiên cứng trong bán kính `52px` (cho lật bàn) / `64px` (tương tác chung): **Ưu tiên 1: Cứu đồng đội gục (`Revive`) $\to$ Ưu tiên 2: Lật Bia Chắn từ `'low'` sang `'flipped'` (kèm `Micro-Blank` `r=56px` trong `0.15s` xóa đạn địch) $\to$ Ưu tiên 3: Nhặt đồ / Mở rương / Tương tác đài**. Khi bàn đã ở trạng thái `'flipped'`, nhấn `[E]` lần nữa **không làm gì cả** (không tự hủy chỗ nấp). |
| **Đá Trượt (`Dash-Kick` & `Melee-Kick`)** | Lướt (`Shift`) xuyên qua Bia Chắn đã lật `'flipped'` với góc hướng tới **`dot(dashDir, dirFromPlayerToProp) >= 0.45`** (`±63°`) hoặc chạm Đồ Chơi hình tròn ở bất kỳ góc nào trong lúc lướt sẽ kích hoạt **`Dash-Kick`**: chuyển ngay `prop.coverState = 'sliding'`, `prop.blocksMovement = false`, **bỏ qua đẩy lùi vị trí người chơi ở tick đó** (lướt mượt không khựng frame) và sút vật thể bay đi ở vận tốc **`520 px/s` theo `aimAngle`**. Chém cận chiến hoặc Xung Phong Khiên vào vật thể cũng kích hoạt `Melee-Kick` tương tự. |
| **Phím `[X]` (`DROP_WEAPON`)** | Bấm nhanh để vứt vũ khí đang cầm ra đất; **giữ `0.50s` (`30 ticks`) ngoài giao tranh (`enemies.length === 0`)** khi đứng trong `48px` cạnh vũ khí rơi dưới đất để **Phân Rã Vũ Khí (`Weapon Salvage`)** thành Vàng cá nhân (`Common = 10G, Uncommon = 15G, Rare = 22G, Epic = 30G`). |
| **Khởi tạo Vũ khí Nhân vật** | Mọi Class bắt đầu chuyến đi với **đúng 1 vũ khí khởi đầu đặc trưng ở Ô 1 (`starterWeapons = [cDef.starterWeaponId]`)**, để trống Ô 2 (giúp vũ khí đầu tiên nhặt được tự động vào Ô 2 mà không làm rơi vũ khí khởi đầu). Vũ khí cất trong túi tự nạp đầy sau `2.0s` (`Holster Auto-Reload`). |
| **Tách Build & Kinh Tế Theo Từng Người Chơi (`Per-Player`)** | Xóa bỏ mảng toàn cục `worldSim.activeBuffIds`. Mỗi `SimPlayerState` lưu độc lập `blessingIds`, `weaponMutators`, `duoBoonIds`, `activePactId`, `awakenedRelicIds` và `gold` cá nhân. |
| **Khế Ước Tro Tàn (`1 Tế Đàn / Biome`)** | Phòng `shrine` **chỉ xuất hiện ở Tầng 1 của mỗi Biome (`localFloor === 1`: Tầng 1, 3, 5)**. Lời nguyền kéo dài **xuyên suốt cả 2 tầng của Biome đó (bao gồm cả trận đánh Boss cuối Biome ở Tầng 2/4/6)**; chỉ khi hạ gục Boss Biome mới thanh tẩy thành **Di Vật Tro Tàn Thức Tỉnh**. |
| **Phá Giáp 3 Boss (`1–2 Bước`)** | Ở `66%` và `33% HP`, Boss bật trạng thái Giáp/Khiên đặc trưng. Người chơi dùng **`Dash-Kick` Bia Chắn / Đồ Chơi Biome tông vào Boss** (hoặc dụ Boss húc Cột Đá Mục / kích hoạt Búa Máy) để phá giáp ngay trong 1–2 bước, gây `6% MaxHP` sát thương chuẩn và làm Boss **Choáng Phá Giáp `3.0–4.0s` (`+40% EnemyVuln`)**. Phòng Boss có **`Boss Supply Drop` mỗi `18.0s`** và thanh **`bossStaggerAccum (0..100)`**. |
| **Cổng Kiểm Chứng Thực Tế (`Playtest Gates`)** | Lộ trình có 2 mốc kiểm chứng lớn: **Sau `Phase P0B` (Vertical Slice Độ Vui)** và **Sau `Phase P3C` (Hoàn thiện Boss & Balance)**. Ở 2 mốc này, sau khi vượt qua toàn bộ Automated Tests + Visual Gate (`pro`), bạn sẽ in bảng báo cáo kiểm chứng đầy đủ kèm hướng dẫn test nhanh cho tôi và **tiếp tục chạy thẳng sang phase kế tiếp** (trừ khi gặp lỗi blocker không tự giải quyết được theo mục `0.7`). |

---

### 0.7 Bản Đồ Skill Superpowers & Quy Tắc Ra Quyết Định (`Ruling`)

| Thời điểm | Skill cần gọi | Điều chỉnh áp dụng riêng cho dự án này |
|---|---|---|
| Bắt đầu mọi phiên | `using-superpowers` | Đọc `references/antigravity-tools.md`. |
| Đầu chiến dịch | `brainstorming` | **Bỏ qua:** Spec Rev 4 và prompt này đã được duyệt hoàn chỉnh. |
| Đầu chiến dịch | `using-git-worktrees` | Tạo `.worktrees/overhaul-v2.0` nhánh `overhaul/v2.0` (đã có đồng ý trước). |
| Đầu mỗi phase (`P0A` → `P5`) | `writing-plans` | Viết 1 file plan chi tiết cho đúng phase sắp chạy tại `docs/superpowers/plans/YYYY-MM-DD-ap2-<phase>-<slug>.md`. |
| Trong mỗi phase | `subagent-driven-development` | Chạy tuần tự từng task con qua Implementer + Task Reviewer + sổ cái ledger, kết thúc bằng Visual Gate (0.4). |
| Mọi task logic / sim / toán học / mạng | `test-driven-development` | Bắt buộc viết unit test trước (`RED`), chạy thấy fail đúng lý do, rồi mới viết code (`GREEN`) và làm sạch (`REFACTOR`). |
| Mọi task render / art / HUD / map | Visual TDD (ngoại lệ TDD cho đồ họa) | `RED` = dựng cảnh chụp tất định trong `visual-scene-ap2-*.ts`, chụp `before` thấy chưa có tính năng hoặc trượt ngưỡng; `GREEN` = cài đặt render/UI, chạy e2e assert hành vi + chụp `after` + đạt ngưỡng `metrics.json` và Visual Reviewer `≥ 8/10`. |
| Khi gặp bug / test fail / lệch đồng bộ | `systematic-debugging` | Khoanh vùng nguyên nhân gốc (root cause) trước khi sửa. Cấm đoán mò hoặc vá tạm bợ. |
| Khi đọc/kiểm toán độc lập | `dispatching-parallel-agents` | Chỉ dùng cho các subagent chỉ đọc (`research`). |
| Cuối mỗi phase | `verification-before-completion` | Chạy mới `pnpm verify` + `pnpm perf` ngay lúc đó để lấy bằng chứng sống trước khi gắn tag `ap2-<phase>`. |
| Cuối `Phase P5` | `requesting-code-review` + `finishing-a-development-branch` | Tổng duyệt toàn bộ nhánh `overhaul/v2.0` bằng subagent `pro`, sau đó trình menu 3 lựa chọn kết thúc nhánh và chờ tôi chọn. |

**Khi nào được phép dừng lại hỏi tôi (ngoài 5 trường hợp dưới đây, bạn phải tự ra quyết định kỹ thuật, ghi `Ruling: <quyết định> — <lý do> — <rủi ro nếu sai>` vào sổ cái ledger + `docs/PROGRESS.md` và chạy tiếp không ngừng):**
1. Thao tác hủy diệt dữ liệu hoặc không thể đảo ngược (xóa nhánh, `git push --force`, xóa file ngoài phạm vi dự án).
2. Merge vào nhánh `master` ở cuối `Phase P5` (bắt buộc chờ tôi chọn trong menu `finishing-a-development-branch`).
3. Một Phase thất bại ở Visual Gate sau đủ **4 vòng sửa lỗi liên tiếp** mà vẫn còn lỗi `blocker` hoặc có từ 2 tiêu chí trở lên `< 7/10`.
4. Phát hiện mâu thuẫn toán học hoặc kiến trúc nghiêm trọng khiến toàn bộ các phase sau không thể hoạt động nếu không đổi thiết kế cốt lõi.
5. Môi trường máy tính hỏng phần cứng/driver (ví dụ trình duyệt không thể khởi tạo WebGL context dù đã thử lại).

---

## 1. HIỆN TRẠNG CODEBASE ĐÃ KIỂM CHỨNG (TẠI COMMIT `f26d4b7` — `v0.2.1`)

Trước khi sửa bất kỳ file nào, bạn và các Implementer phải nắm rõ cấu trúc file hiện tại (mọi file đều đã được tách module `< 1000 dòng` ở `v0.2.1`; lưu ý mở file đọc kiểm chứng dòng trước khi sửa vì số dòng sẽ dịch chuyển qua từng phase):

### 1.1. Phân hệ Mô phỏng, Giao thức Mạng & Server (`packages/shared/src/` & `apps/server/src/`)
- **Giao thức mạng & Phòng Co-op (`packages/shared/src/protocol/` & `apps/server/src/rooms/`):**
  - `messages.ts` (`109 dòng`): Định nghĩa `INPUT_BUTTON` (`:7-16`, hiện mới có 8 bit từ `FIRE = 1 << 0` đến `READY = 1 << 7`, **chưa có `RELOAD_VENT`**), `BulletVolleySpawnNetEvent` (`:75-87`, hiện chưa có `shotFlags` hay `replacedProjectileId`).
  - `snapshot-codec.ts` (`356 dòng`): Mã hóa/giải mã snapshot 30Hz; lưu ý tại `:298-305` đang cắt cứng `netEvents` bằng `.slice(0, 32)` (cần ưu tiên giữ 100% sự kiện đồng bộ đạn `bullet_volley_spawned` & `projectiles_destroyed` và nâng trần lên `64`).
  - `network-transport.ts` (`853 dòng`): Đồng bộ state & dự đoán phía Client; tại `:232-233` đang gán `this.sim.activeBuffIds`, tại `:323-324` đang gán `pState.energy / maxEnergy`, tại `:367` & `:711` đang chạy dự đoán va chạm tường tĩnh (`resolveCircleCollision`) mà chưa gọi `resolvePropMovementCollision`, và tại `:615-630` đang xử lý `snapshot.events`.
  - `apps/server/src/rooms/CoopRoom.ts` (`535 dòng`): Quản lý phòng Colyseus 60Hz; tại `:198-203` đang xử lý `select_buff` toàn cục (bỏ qua `_client`), cần tra `this.playersBySession.get(client.sessionId)` để áp dụng lựa chọn theo từng `meta.playerId`.
  - `transport.ts` (`186 dòng`), `wifi-sim.ts` (`221 dòng`).
- **Dữ liệu tĩnh (`packages/shared/src/data/`):**
  - `types.ts` (`165 dòng`): Định nghĩa `WeaponId`, `WeaponDef`, `CharacterDef`, `EnemyKind`, `SurfaceKind`, `FloorBuffId`, `PropKind`...
  - `weapons.ts` (`516 dòng`): Hiện chứa **24 vũ khí** có trường `energyCost`, chưa có cơ chế `cadenceKind: 'CLIP_RELOAD' | 'HEAT_VENT' | 'MELEE_COMBO'`, chưa có `clipSize`, `reloadDurationSec`, `heatPerShot`, `procCoefficient`.
  - `enemies.ts` (`596 dòng`): Chứa bảng thông số quái, 3 Boss và mảng `FLOOR_BUFFS` (gồm cả 6 thẻ cộng chỉ số phẳng cũ cần cắt bỏ).
  - `scaling.ts` (`72 dòng`): Công thức scaling theo tầng và số người chơi Co-op.
- **Mô phỏng Thế giới Tất định (`packages/shared/src/sim/`):**
  - `world-sim.ts` (`473 dòng`): Lớp điều phối chính `WorldSim`. Ở dòng `:83` vẫn đang dùng mảng toàn cục `activeBuffIds: FloorBuffId[] = []` dùng chung cho cả phòng!
  - `world-sim-types.ts` (`531 dòng`): Định nghĩa `SimPlayerState`, `SimEnemy`, `SimProjectile`, `SimProp`, `SimWorldItem`...
  - `world-sim-events.ts` (`372 dòng`): Các sự kiện sim phát ra cho client/network.
  - `sim-player.ts` (`831 dòng`): Xử lý di chuyển, Lướt (`Dash`), thanh `energy` / `maxEnergy` (`:163-183`, `:523-536`), va chạm vật thể.
  - `sim-coop-hub.ts` (`815 dòng`): Khởi tạo `SimPlayerState` tại `createPlayerStateImpl` (`:19`) và `applyCharacterStatsToPlayer` (`:355`) hiện đang gán `const starterWeapons = [cDef.starterWeaponId, 'rusty_pistol'].slice(0, MAX_WEAPON_SLOTS);`.
  - `arena-map.ts` (`889 dòng`): Tạo lưới `36×22` ô gạch (`1152×704px`), hiện vẫn đặt 4 cột đá `2×2` cố định ở 4 góc (`:60-65`, `:150-218`) và surface cố định (`:168-186`).
  - `dungeon-gen.ts` (`676 dòng`): Sinh đồ thị phòng mỗi tầng; hiện vẫn gắn cứng phòng `secret` ở tọa độ `(3,2)` phía Bắc phòng `start` (`:198-212`).
  - `sim-dungeon-rooms.ts` (`976 dòng` — **Sát trần 1000 dòng!**): Quản lý chuyển phòng, cửa (`N: (18,1)`, `S: (18,20)`, `W: (1,11)`, `E: (34,11)` tại `:27-39`), giải đố bàn đạp + cục đá nam châm ở phòng `treasure` (`:222-251`), đặt prop tọa độ cứng (`:276-294`).
  - `sim-props-spawning.ts` (`910 dòng` — **Sát trần 1000 dòng!**): Spawn prop (2 thùng nổ đặt sẵn trước cửa phòng bí mật tại `:25-26`), spawn quái (`spawnEnemyImpl`).
  - `interact-target.ts` (`364 dòng`): Hàm `findInteractTarget` dùng chung giữa sim và client để tìm mục tiêu phím `[E]`.
  - `sim-projectiles.ts` (`848 dòng`): `spawnDeterministicVolleyImpl` (`:7-88`) hiện gán `id: ++this.nextEntityId` cục bộ; `stepClientProjectilesCosmeticImpl` (`:629+`) mô phỏng đạn phía client.
  - `sim-combat-damage.ts` (`961 dòng` — **Sát trần 1000 dòng!**): Tính toán sát thương, phản ứng nguyên tố (*Hơi Nước, Vỡ Băng, Siêu Dẫn, Nổ Độc, Tê Liệt, Quá Tải*).
  - `sim-skills-mechanics.ts` (`814 dòng`): Kỹ năng 5 nhân vật (`vanguard`, `ranger`, `elementalist`, `druid`, `engineer`).
  - `sim-enemies-core.ts` (`939 dòng` — **Sát trần 1000 dòng!**) & `sim-enemies-biome1.ts` (`839 dòng`), `sim-enemies-biome2.ts` (`709 dòng`), `sim-enemies-biome3.ts` (`733 dòng`): AI quái và 3 Boss.
  - `sim-progression-bot.ts` (`857 dòng`): Bot tự động chọn buff, tương tác và chiến đấu.

### 1.2. Phân hệ Client, Đồ họa Procedural, HUD & Âm thanh (`apps/client/src/`)
- **Scene chính & HUD (`apps/client/src/scenes/`):**
  - `GameScene.ts` & `HudScene.ts`: Đã tách HUD sang overlay `HudScene` ở `v0.2.0`.
  - `game-scene/arena-tiles.ts` (`868 dòng`), `entity-sync.ts` (`600 dòng`), `room-entities-sync.ts` (`700 dòng`), `portal-door-sync.ts` (`905 dòng`), `telegraphs-and-overlays.ts` (`773 dòng`), `sim-events.ts` (`571 dòng`), `input-and-network.ts` (`665 dòng`), `interact-prompt.ts` (`719 dòng`).
  - `game-scene/hud-combat-and-coop.ts` (`654 dòng`): Đang vẽ thanh Energy màu xanh và 2 ô vũ khí.
  - `game-scene/hud-setup-and-pause.ts` (`958 dòng`), `hud-modals-and-debug.ts` (`973 dòng`), `hud-qol-and-minimap.ts` (`948 dòng`), `hud-hub-and-cards.ts` (`878 dòng`), `p11-drama-hud.ts` (`472 dòng`).
- **Đồ họa Vector / Cutout Rig 2.0 / Texture Baker (`apps/client/src/art/` & `world/`):**
  - `rig-defs.ts` (`160 dòng`), `rig-defs-weapons-1.ts` (`436 dòng`), `rig-defs-weapons-2.ts` (`434 dòng`): Đã có sẵn toàn bộ rig và icon của 18 vũ khí giữ lại (cần gỡ 6 vũ khí bị xóa khỏi danh sách export/gallery).
  - `texture-baker.ts` (`477 dòng`), `texture-baker-tiles.ts` (`588 dòng`), `texture-baker-props.ts` (`609 dòng`), `texture-baker-surfaces.ts` (`779 dòng`), `texture-baker-fx.ts` (`765 dòng`).
  - `world/biome-architecture.ts` (`710 dòng`) & `biome-architecture-render.ts` (`863 dòng`): Kiến trúc ven tường P1/P2/P3/P4 đã khóa ở `v0.2.0`.
- **Hiệu ứng Chiến đấu, Ánh sáng & Âm thanh (`apps/client/src/fx/` & `audio/`):**
  - `combat-fx.ts` (`878 dòng`), `combat-fx-pools.ts` (`859 dòng`), `combat-fx-spawners.ts` (`879 dòng`): Đã có sẵn VFX của `seed_gun` (`life_blossom`), `tether_staff` (`tetherBeams`), `focus_laser`, `thunder_hammer` (`shockwaveRings`), `frag_launcher` & `magma_cannon`.
  - `lighting-pipeline.ts` (`820 dòng`), `lighting-config.ts` (`914 dòng`).
  - `audio/zzfx.ts` (`860 dòng`), `audio/music-synth.ts` (`286 dòng`).

---

## 2. ĐẶC TẢ KỸ THUẬT & TOÁN HỌC CỐT LÕI ( TÓM TẮT KHÓA CHẶT TỪ SPEC REV 4 )

Mọi Implementer và Task Reviewer phải đối chiếu trực tiếp với các phương trình và bảng quy tắc dưới đây (chi tiết đầy đủ nằm trong `docs/superpowers/specs/2026-10-26-ashen-pact-2.0-overhaul-design.md`):

### 2.1. Giao Thức Nút Bấm (`messages.ts`) & Đồng Bộ Đạn 2 Tầng Tất Định
1. **Cập nhật `INPUT_BUTTON` trong `packages/shared/src/protocol/messages.ts`:**
   ```ts
   export const INPUT_BUTTON = {
     FIRE: 1 << 0,        // Chuột trái: Bắn / Chém Combo 3 đòn / Giữ & Buông để kích nổ Airburst/Implosion
     SKILL: 1 << 1,       // Phím Kỹ năng Nhân vật (Phím E cũ đổi sang Space/Chuột phải hoặc phím kỹ năng hiện hành; tái nhấn để Xung Phong Khiên / Nổ Trụ Tesla)
     DASH: 1 << 2,        // Phím Lướt (Shift — Lướt qua vật chắn 'flipped'/đồ chơi để Dash-Kick)
     INTERACT: 1 << 3,    // Phím [E]: 1. Cứu đồng đội -> 2. Lật Bia Chắn ('low' -> 'flipped') -> 3. Tương tác/Nhặt
     SWAP: 1 << 4,        // Phím [Q]: Đổi Vũ khí (Vũ khí cất trong túi tự nạp sau 2.0s)
     PING: 1 << 5,
     DROP_WEAPON: 1 << 6, // Phím [X]: Bấm nhanh: Vứt súng | Giữ 0.5s ngoài combat: Phân Rã Vũ Khí thành Vàng!
     READY: 1 << 7,
     RELOAD_VENT: 1 << 8, // MỚI — Phím [R]: Chỉ dùng cho Perfect Reload (CLIP_RELOAD) & Tactical Vent (HEAT_VENT)
   } as const;
   ```
2. **Định danh đạn tất định (`deterministicId`) & `SHOT_FLAG`:**
   - Trong `spawnDeterministicVolleyImpl(ev)`:
     ```ts
     const deterministicId = ((ev.eventId & 0x3fffff) << 6) | (i & 0x3f);
     ```
   - Định nghĩa cờ phát bắn:
     ```ts
     export const SHOT_FLAG = {
       FINALE_SHOT: 1 << 0,       // Viên cuối băng (+50% Additive DMG, 100% nguyên tố)
       OVERCLOCKED_SHOT: 1 << 1,  // Phát đầu sau Perfect Reload (+45% Additive DMG)
       DYNAMIC_BOUNCE: 1 << 2,    // Đạn có khả năng Smart Bounce / Split Bounce / Orbit Return / Homing
     } as const;
     ```
   - **Hành vi chờ của Client tại điểm va chạm (`Zero-Rubberband Client Hold`):** Khi viên đạn có `SHOT_FLAG.DYNAMIC_BOUNCE` chạm tường, Bia Chắn hoặc Lăng Kính trong `stepClientProjectilesCosmeticImpl`, Client **không tự nảy gương hay tự tìm quái**, mà neo viên đạn tại chỗ (`b.vx = 0; b.vy = 0; b.awaitingServerRedirectTimer = 0.12`) chờ sự kiện `bullet_volley_spawned` mới từ Server (có `replacedProjectileId = b.id`) để thay thế tức thì.
   - **Sự kiện xóa đạn hàng loạt (`projectiles_destroyed`):** Khi `Micro-Blank` (lật bàn `[E]`), `Parry Deflect` (Đòn 3 cận chiến), `reload_frost_nova`, `dash_thunder_decoy`, `dash_phase_blade` hoặc `void_staff` xóa/nuốt đạn địch trên Server, Server đẩy `{ kind: 'projectiles_destroyed', ids: number[] }` vào `snapshot.events` để Client xóa ngay các viên đạn đó.

### 2.2. Phương Trình Scaling Sát Thương Môi Trường & Thanh Chấn Động Boss
Gọi tầng toàn cục là $F = \text{globalFloor} \in \{1..6\}$, hệ số tầng là:
$$M_{\text{floor}}(F) = 1 + 0.22 \times (F - 1) \quad (\text{Tầng 1: } 1.00\times \longrightarrow \text{Tầng 6: } 2.10\times)$$

1. **Sát thương Đá Trượt Vật Chắn (`Kick-Slide` — tốc độ trượt `520 px/s`, `600 px/s` cho khối băng):**
   $$\text{Dmg}_{\text{KickSlide}}(e) = \text{round}\Big(20 \times M_{\text{floor}}(F) + \alpha_{\text{kick}}(e) \times e.\text{maxHp}\Big), \quad \alpha_{\text{kick}} = \begin{cases} 0.10 & \text{(Quái thường)} \\ 0.05 & \text{(Tinh Anh)} \\ 0.015 & \text{(Boss)} \end{cases}$$
   *(Gây Choáng `1.0s` và đẩy lùi `knockback = 260`).*

2. **Sát thương Chấn Động Đập Tường (`Wall-Slam` — khi quái bị đẩy lùi với `hypot(kbVx, kbVy) >= 120 px/s` đập vào tường/cột/bia chắn):**
   $$\text{Dmg}_{\text{WallSlam}}(e) = \text{round}\Big(14 \times M_{\text{floor}}(F) + 0.30 \times \text{lastHitDmg} + \alpha_{\text{slam}}(e) \times e.\text{maxHp}\Big), \quad \alpha_{\text{slam}} = \begin{cases} 0.08 & \text{(Quái thường)} \\ 0.04 & \text{(Tinh Anh)} \\ 0.01 & \text{(Boss)} \end{cases}$$
   *(Làm khựng Hit-stun `0.40s` ngắt Telegraph của quái thường/Tinh Anh kèm popup `ĐẬP TƯỜNG!`; nếu quái đang Đóng Băng `frozenTimer > 0` thì kích nổ ngay phản ứng `VỠ BĂNG / Shatter`).*

3. **Sát thương Đồ Chơi Hạng Nặng Của Biome (`Trụ Đá Mục`, `Cọc Nhũ Băng`, `Búa Máy`, `Thảm Dung Nham`):**
   $$\text{Dmg}_{\text{Hazard}}(e) = \begin{cases} \text{round}\big(\text{baseHazardDmg} \times M_{\text{floor}}(F) + 0.20 \times e.\text{maxHp}\big) & \text{nếu } !e.\text{isBoss} \\ \text{round}\big(0.06 \times e.\text{maxHp}\big) & \text{nếu } e.\text{isBoss} \text{ (Đòn Phá Giáp Boss = 6% MaxHP)} \end{cases}$$

4. **Đẩy Quái Xuống Vực (`Chasm Ring-Out` — dùng chung `SurfaceKind = 'chasm'` ở cả 3 Biome):**
   - Quái bộ binh (`!e.flying && !e.isBoss`) bị đẩy rơi vào ô `chasm`:
     - **Quái thường:** Tiêu diệt tức thì (`RING-OUT!`), bắn vọt vàng/loot ngược lên mép sàn gần nhất.
     - **Quái Tinh Anh:** Mất `30% MaxHP`, nảy bật ngược lên mép sàn kèm Choáng `1.0s`.

5. **Thanh Chấn Động Boss (`bossStaggerAccum: 0..100`):**
   - Nhận đòn có `knockback > 0` cộng $\Delta\text{Stagger} = (\text{knockback} / 12) \times \text{procCoefficient}$; bị `Dash-Kick` Bia Chắn / Đồ Chơi đập trúng cộng thẳng `+50 Stagger`.
   - Khi `bossStaggerAccum >= 100`: Reset về `0` (Cooldown tích lại `6.0s`), kích nổ `WALL-SLAM!` ngay trên người Boss (khựng `0.5s` + kích hoạt mọi Phước lành `Wall-Slam` / `Barricade Techs`).

### 2.3. Hệ Phương Trình Chống Nổ Số Nhân (`3-Bucket Damage Pipeline`)
1. **Giới hạn Thế Hệ Phân Tách Đạn (`splitGeneration: 0 | 1`):**
   - Đạn gốc có `splitGeneration = 0`. Qua cơ chế tách đạn đầu tiên (`table_tech_prism_split`, `vanguard_bastion_prism`, `cryo_prism_pillar`, `bullet_split_bounce`) $\to$ tách thành đạn con có `splitGeneration = 1`.
   - Đạn đã có `splitGeneration === 1` **tuyệt đối không tách thêm tia mới**; nếu đi qua vật tách đạn tiếp theo, chỉ nhận `+20% Additive Damage` và `+1 bounceRemaining` (`MAX_BOUNCE_COUNT = 4`). Tổng số tia đạn từ 1 lần bóp cò bị khóa trần cứng **`MAX_PELLETS_PER_TRIGGER = 9`**.
2. **Công thức Sát Thương Cuối Cùng:**
   $$\text{FinalDamage} = \text{round}\Big(D_{\text{base}} \times M_{\text{upgrade}} \times M_{\text{AdditivePool}}(S) \times M_{\text{Crit}} \times M_{\text{EnemyVuln}} \times M_{\text{Reaction}}\Big)$$
   - $M_{\text{upgrade}} = 1 + 0.20 \times \text{upgradeLevel}$ (`Level 0..3` $\implies 1.00\times \to 1.60\times$).
   - **Tổng Cộng Dồn $S$ (`Additive Pool`):**
     $$S = \delta_{\text{finale}}(0.50) + \delta_{\text{overclock}}(0.45) + \delta_{\text{overheat}}(0.25) + \delta_{\text{bounce}}(0.35 n_b) + \delta_{\text{shield}}(0.30) + \delta_{\text{zone}}(0.15) + \delta_{\text{prism}}(0.20) + \delta_{\text{pact}} + \delta_{\text{relic}}$$
   - **Hàm Trần Mềm (`Soft Cap` ở $2.80\times$) & Trần Cứng (`Hard Cap` ở $3.80\times$):**
     $$M_{\text{AdditivePool}}(S) = \min\left(3.80,\ \begin{cases} 1 + S & \text{nếu } S \le 1.80 \\ 2.80 + 0.35 \times (S - 1.80) & \text{nếu } S > 1.80 \end{cases}\right)$$
   - **Nhóm Giảm Phòng Thủ Mục Tiêu:**
     $$M_{\text{EnemyVuln}} = \min\Big(1.75,\ 1 + \delta_{\text{marked}}(0.25) + \delta_{\text{superconduct}}(0.25) + \delta_{\text{caustic}}(0.25) + \delta_{\text{bossArmorBreak}}(0.40)\Big)$$
   - **Phản ứng `Shatter (Vỡ Băng)`:** `×2.0` trên quái thường/Tinh Anh, kẹp cứng ở **`×1.35` trên Boss** (tổng hệ số nhân 1 đòn trên Boss không bao giờ vượt quá `18×` sát thương gốc).
   - **Hàm Scaling Sát Thương Phước Lành & Kỹ Năng Theo Tầng:**
     $$\text{scaleBlessingDamage}(\text{baseDmg}, F) = \text{round}\big(\text{baseDmg} \times (1 + 0.22 \times (F - 1))\big)$$

---

## 3. BẢNG TỔNG HỢP LỘ TRÌNH 14 PHASE (`P0A` → `P5`)

Để đảm bảo mỗi phase có phạm vi vừa vặn, được kiểm chứng TDD và Visual Gate kỹ lưỡng nhất (không gộp hàng chục tính năng vào một phase khổng lồ làm giảm chất lượng), lộ trình 6 giai đoạn lớn trong Phần 8 của Spec Rev 4 được chia nhỏ thành **14 Phase tuần tự (`ap2-p0a` → `ap2-p5`)** với **82 Task con**:

| Mã Phase | Tag Git | Tên Phase & Trọng Tâm Triển Khai | Số Task Con | Mục Spec Rev 4 Tham Chiếu | Cổng Kiểm Chứng Đặc Biệt |
|---|---|---|---:|---|---|
| **`P0A`** | `ap2-p0a` | **Hạ Tầng Nền, The Purge, Per-Player State & Đồng Bộ Đạn Tất Định 60Hz** | `6 Tasks` | Phần 1 (`1.1–1.3`), Phần 3 (`3.1`), Phần 4 (`4.1`), Phần 7 (`7.1–7.2`) | Unit test 100% + HUD Băng đạn/Nhiệt độ |
| **`P0B`** | `ap2-p0b` | **Vertical Slice Độ Vui: 3 Archetype Phòng, Vật Lý `Flip Cover [E] + Dash-Kick + Wall-Slam + Ring-Out` & 4 Vũ Khí Đại Diện** | `7 Tasks` | Phần 2 (`2.1–2.3` Biome 1), Phần 3 (`3.2–3.3`), Phần 7 (`7.3`), Phần 8 (`0B`) | **Visual Gate + Playtest Gate 1** |
| **`P1A`** | `ap2-p1a` | **Kho Vũ Khí Độc Bản Đợt 1 (7 Vũ Khí: Starter, Uncommon & Rare) + VFX/Audio** | `6 Tasks` | Phần 3 (`3.2–3.3`: Vũ khí #2, #4, #6, #7, #8, #10, #11), Phần 7 (`7.3`) | Visual Gate (7 Strip 8-frame vũ khí) |
| **`P1B`** | `ap2-p1b` | **Kho Vũ Khí Độc Bản Đợt 2 (7 Vũ Khí: Rare, Epic & Legendary) & 3-Bucket Damage Pipeline** | `6 Tasks` | Phần 3 (`3.3`: Vũ khí #12–#18), Phần 4 (`4.6` Toán chống nổ số) | Visual Gate (7 Strip 8-frame) + Property Test Boss `<= 18x` |
| **`P1C`** | `ap2-p1c` | **Mở Rộng 3 Archetype Phòng Mới & Hệ Sinh Thái Tương Tác Biome 2 (Hầm Băng) + Biome 3 (Lò Rèn)** | `6 Tasks` | Phần 2 (`2.1` Archetype 4–6, `2.3` Biome 2 & 3), Phần 7 (`7.3`) | Visual Gate Map & Props B2/B3 (`metrics.json`) |
| **`P1D`** | `ap2-p1d` | **Hệ Thống 26 Thẻ Nâng Cấp Cốt Lõi (16 Action Blessings + 10 Character Skill Upgrades)** | `6 Tasks` | Phần 4 (`4.1–4.3`) | Visual Gate Modal Phước lành & Strip Kỹ năng |
| **`P2A`** | `ap2-p2a` | **Đồ Thị Phòng Động, Phòng Bí Mật Nứt Tường, Đe Rèn Cổ Đại (`6 Core Mutators`) & Phân Rã Súng (`Weapon Salvage`)** | `6 Tasks` | Phần 1 (`1.1` #4–5), Phần 4 (`4.4`), Phần 5 (`5.2`) | Connectivity 1000 seeds + Visual Gate Đe Rèn/Salvage |
| **`P2B`** | `ap2-p2b` | **Hệ Thống "Khế Ước Tro Tàn" (`1 Tế Đàn / Biome — Full-Biome Trial`) & 6 Di Vật Thức Tỉnh** | `6 Tasks` | Phần 5 (`5.1`) | Visual Gate Tế Đàn, Dây Xích, Đao Phủ & Di Vật |
| **`P3A`** | `ap2-p3a` | **Đại Tu AI Quái (`Bounded Predictive Lead Aiming`) & 12 Hành Vi Quái Tương Tác Địa Hình** | `6 Tasks` | Phần 6 (`6.1–6.2`) | Visual Gate Tia ngắm đón đầu `0.35s` & AI Props |
| **`P3B`** | `ap2-p3b` | **Thiết Kế Lại 3 Boss Phá Giáp Trực Quan (`1–2 Bước`), `Boss Supply Drop` & `bossStaggerAccum`** | `6 Tasks` | Phần 2 (`2.2` Boss Stagger/Supply), Phần 6 (`6.3`) | Visual Gate Strip Phá giáp 3 Boss |
| **`P3C`** | `ap2-p3c` | **Nâng Cấp Bot AI Thực Tế (`Human-Like Bot Profile`), Cân Bằng Tự Động (`pnpm balance`) & Playtest Gate 2** | `5 Tasks` | Phần 3 (`3.3` Target DPS), Phần 8 (`Phase 3`) | **`pnpm balance` (30 runs/class) + Playtest Gate 2** |
| **`P4A`** | `ap2-p4a` | **Mở Rộng Chiều Sâu Đợt 1: 8 Phước Lành Hành Động Nâng Cao & 4 Bản Độ Búa Rèn Mở Rộng** | `5 Tasks` | Phần 4 (`4.2` Phase 4 cards, `4.4` Mutators #7–#10) | Visual Gate Cọc Điện, Quỹ Đạo Hồi Quy, Pháo Ảnh |
| **`P4B`** | `ap2-p4b` | **Mở Rộng Chiều Sâu Đợt 2: 6 Phước Lành Giao Thoa (`Elemental Duo Boons`) & Đấu Trường Bí Mật 20 Giây** | `5 Tasks` | Phần 4 (`4.5` Duo Boons), Phần 5 (`5.2` Secret 20s) | Visual Gate 6 Duo Boons & Đấu Trường 20s |
| **`P5`** | `ap2-p5` | **Tổng Duyệt Hồi Quy Toàn Diện, Hiệu Năng 60Hz 4P, Đóng Gói `v2.0.0` & Kết Thúc Nhánh** | `6 Tasks` | Toàn bộ Spec Rev 4 | **Holistic Visual Gate (`≥ 8.5/10`) + Code Review (`pro`)** |

---

## 4. ĐẶC TẢ CHI TIẾT TỪNG PHASE & DANH SÁCH TASK CON (`P0A` → `P5`)

---

### PHASE P0A — Hạ Tầng Nền, The Purge, Per-Player State & Đồng Bộ Đạn Tất Định 60Hz
> **Tham chiếu Spec Rev 4:** Phần 1 (`1.1`, `1.2`, `1.3`), Phần 3 (`3.1`), Phần 4 (`4.1`), Phần 7 (`7.1`, `7.2`), Phần 8 (`Phase 0A`).
> **Mục tiêu:** Thực hiện sạch sẽ toàn bộ các cải tiến kiến trúc nền tảng, cắt bỏ triệt để hệ thống Thanh Năng Lượng (`energy`), 6 vũ khí clone, 6 thẻ cộng chỉ số phẳng, tách `Per-Player Build State` + `Instanced Gold`, và cài đặt kiến trúc đồng bộ đạn tất định 2 tầng 60Hz.

#### Danh sách Task con của `Phase P0A`:
- **`Task P0A.1` — Cắt bỏ Thanh Năng Lượng (`energy`) & Cập nhật Nội tại Nhân vật (`Section 1.1 #1 & Section 3.1`):**
  - **Files:** `packages/shared/src/sim/world-sim-types.ts`, `packages/shared/src/sim/sim-player.ts`, `packages/shared/src/sim/sim-combat-damage.ts`, `packages/shared/src/sim/sim-skills-mechanics.ts`, `packages/shared/src/data/types.ts`, `packages/shared/src/data/weapons.ts`, `packages/shared/src/protocol/snapshot-codec.ts`, `packages/shared/src/protocol/network-transport.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. Xóa các trường `energy`, `maxEnergy`, `energyRegen` khỏi `SimPlayerState`, `WeaponDef` (`energyCost`), `snapshot-codec.ts` và `network-transport.ts` (`:323-324` đang gán `pState.energy = ps.energy; pState.maxEnergy = ps.maxEnergy`); xóa loại hạt rơi `kind: 'energy'` khỏi `SimPickup`.
    2. Cập nhật **Nội tại Thiết Vệ (`vanguard` — Ý Chí Thép):** Giáp tự hồi với delay `3.0s`; mỗi viên đạn địch bị chặn bởi `Tường Khiên Hồng Ngọc` **nạp lại 1 viên đạn vào băng đang cầm (hoặc giảm `15%` Nhiệt) VÀ cộng `+15% Additive Damage` (`vanguardShieldBonusAdd`) cho phát bắn / nhát chém kế tiếp (tối đa `+75%`)**.
    3. Cập nhật **Kỹ năng Liệp Ưng (`ranger` — Mũi Tên Săn Mồi):** Hạ gục mục tiêu bị Đánh Dấu sinh ra pickup **Huy Hiệu Săn Mồi (`kind: 'prey_emblem'`)**: nhặt vào lập tức **Nạp Đầy Băng Đạn Cường Hóa (`Overclocked Shot`) / đưa Nhiệt về `0%` + giảm `2.0s` hồi chiêu Kỹ năng**.
    4. Cập nhật **Đồng Đội Combo (`Team Elemental Reaction`):** Khi người chơi A áp nguyên tố mồi (`elementalPrimerPlayerId`) và người chơi B (`B !== A`) kích nổ Phản Ứng Nguyên Tố trong vòng `3.0s`, cả A và B nhận buff **Hội Tụ Nguyên Tố (`elementalConvergenceTimer = 3.0s`)**: làm mới đầy Băng đạn / đưa Nhiệt về `0%` + tăng `+20%` Tốc độ di chuyển & `+20%` Tốc độ bắn.

- **`Task P0A.2` — Cắt bỏ 6 Vũ khí Clone (`24 -> 18 Vũ khí`), 6 Thẻ Stat-Sticks & Migration Khởi tạo Ô Vũ khí (`Section 1.2 & 1.3`):**
  - **Files:** `packages/shared/src/data/types.ts`, `packages/shared/src/data/weapons.ts`, `packages/shared/src/data/enemies.ts`, `packages/shared/src/sim/sim-coop-hub.ts`, `packages/shared/src/sim/world-sim-types.ts`, `apps/client/src/art/rig-defs.ts`, `apps/client/src/scenes/art-gallery-pages.ts`, `apps/client/src/scenes/game-scene/entity-sync.ts`, `packages/shared/test/*.test.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. Xóa 6 vũ khí clone khỏi `WeaponId` và `WEAPONS`: `rusty_pistol`, `dual_pistols`, `venom_smg`, `frost_bow`, `frost_scepter`, `dragon_breath_shotgun`.
    2. Xóa 6 thẻ cộng chỉ số phẳng khỏi `FLOOR_BUFFS` trong `enemies.ts`: `vitality_surge`, `iron_bastion`, `arcane_wellspring`, `eagle_precision`, `gale_reflex`, `ricochet_mastery` (bản cũ); đổi tên 2 thẻ kỹ năng: `vanguard_fortress` $\to$ `vanguard_bastion_prism`, `elementalist_dual` $\to$ `elementalist_twin_orbit`.
    3. Tại cả 2 vị trí `createPlayerStateImpl` (`sim-coop-hub.ts:19`) và `applyCharacterStatsToPlayer` (`sim-coop-hub.ts:355`), đổi khởi tạo vũ khí thành:
       ```ts
       const starterWeapons = [cDef.starterWeaponId];
       ```
       (Mọi nhân vật bắt đầu với **1 vũ khí khởi đầu ở Ô 1**, để trống Ô 2).
    4. Gỡ bỏ 6 entry vũ khí đã xóa khỏi `rig-defs.ts`, `art-gallery-pages.ts`, `entity-sync.ts` (giữ nguyên 18 rig vũ khí còn lại trong `rig-defs-weapons-1/2.ts`).
    5. Cập nhật toàn bộ unit test và e2e helper (`visual-scenes.ts` dòng 608–609 đang gọi `'dragon_breath_shotgun'` và `'frost_bow'`) sang các ID hợp lệ trong bộ 18 vũ khí (`'magma_cannon'`, `'hunter_crossbow'`, `'rivet_gun'`, `'gale_smg'`).

- **`Task P0A.3` — Tách Biệt Build & Kinh Tế Theo Từng Người Chơi (`Per-Player Build State & Instanced Gold` — `Section 1.1 #6, 4.1 & 5.2B`):**
  - **Files:** `packages/shared/src/sim/world-sim-types.ts`, `packages/shared/src/sim/world-sim.ts`, `packages/shared/src/sim/sim-coop-hub.ts`, `packages/shared/src/sim/sim-progression-bot.ts`, `packages/shared/src/sim/sim-dungeon-rooms.ts`, `packages/shared/src/protocol/snapshot-codec.ts`, `packages/shared/src/protocol/network-transport.ts`, `apps/server/src/rooms/CoopRoom.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. Xóa mảng toàn cục `activeBuffIds` và `pendingBuffChoices` khỏi `WorldSim` (`world-sim.ts:83`) và khỏi `network-transport.ts` (`:232-233`).
    2. Thêm trực tiếp vào từng `SimPlayerState` các trường độc lập:
       - `blessingIds: BlessingId[]`
       - `weaponMutators: Record<number, WeaponMutatorId[]>` (theo slot vũ khí `0 | 1`)
       - `duoBoonIds: DuoBoonId[]`
       - `activePactId: AshenPactId | null`
       - `pactOriginalWeaponId: WeaponId | null`
       - `awakenedRelicIds: AshenRelicId[]`
       - `buffChoices: BlessingId[]` (3 lựa chọn rút riêng cho từng người chơi mỗi khi qua cổng tầng, không làm cạn bể thẻ của đồng đội).
    3. Đảm bảo `p.gold` là **Vàng cá nhân (`Instanced Gold`)**: Khi quái chết rơi vàng, mở rương, nhận thưởng phòng hoặc phân rã súng, số vàng được cộng/rơi instanced cho từng người chơi độc lập; khi mua hàng ở Chợ Đen (`merchant`), trừ vào `p.gold` của đúng người chơi nhấn `[E]`.
    4. Cập nhật `snapshot-codec.ts` và `network-transport.ts` để mã hóa, giải mã và đồng bộ đầy đủ các trường per-player mới (`blessingIds`, `weaponMutators`, `duoBoonIds`, `activePactId`, `awakenedRelicIds`, `buffChoices`) trên từng `SimPlayerState` qua mạng 60Hz.
    5. Tại `apps/server/src/rooms/CoopRoom.ts` (`:198-203`), sửa trình xử lý `this.onMessage('select_buff', (client, payload) => ...)`: tra `const meta = this.playersBySession.get(client.sessionId)` và truyền `meta.playerId` vào `this.sim.selectFloorBuff(payload.buffId, meta.playerId)` để áp dụng lựa chọn Phước lành cho đúng người chơi đó (thay vì áp dụng toàn cục).

- **`Task P0A.4` — Giao Thức `INPUT_BUTTON.RELOAD_VENT` (`[R]`), Định Danh Đạn Tất Định (`deterministicId`), `SHOT_FLAG` & Ngân Sách Thực Thể 60Hz (`Section 7.1 & 7.2`):**
  - **Files:** `packages/shared/src/protocol/messages.ts`, `packages/shared/src/protocol/snapshot-codec.ts`, `packages/shared/src/protocol/network-transport.ts`, `packages/shared/src/sim/sim-projectiles.ts`, `packages/shared/src/sim/world-sim-events.ts`, `apps/client/src/scenes/game-scene/input-and-network.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. Thêm `RELOAD_VENT: 1 << 8` vào `INPUT_BUTTON` (`messages.ts`) và gắn phím `KeyR` phía Client (`input-and-network.ts`) vào bit `INPUT_BUTTON.RELOAD_VENT` trong mọi trận đấu.
    2. Thêm `SHOT_FLAG` (`FINALE_SHOT`, `OVERCLOCKED_SHOT`, `DYNAMIC_BOUNCE`) và mở rộng `BulletVolleySpawnNetEvent` với `shotFlags?: number` và `replacedProjectileId?: number`.
    3. Trong `spawnDeterministicVolleyImpl(ev)` (`sim-projectiles.ts`), gán `id` cho từng viên đạn thứ `i` bằng công thức tất định:
       `const deterministicId = ((ev.eventId & 0x3fffff) << 6) | (i & 0x3f);`
       Viết unit test chứng minh Server và 4 Client chạy `spawnDeterministicVolleyImpl` luôn sinh ra mảng `projectiles` có `id` khớp nhau 100%.
    4. Cài đặt **`Zero-Rubberband Client Hold`** trong `stepClientProjectilesCosmeticImpl`: Khi viên đạn có cờ `SHOT_FLAG.DYNAMIC_BOUNCE` chạm tường/bia chắn/lăng kính trên Client, gán `b.vx = 0; b.vy = 0; b.awaitingServerRedirectTimer = 0.12` chờ gói `bullet_volley_spawned` có `replacedProjectileId = b.id` từ Server.
    5. Thêm sự kiện mạng `{ kind: 'projectiles_destroyed', ids: number[] }` để xóa đạn tức thì trên Client khi có `Micro-Blank` / `Parry Deflect`. Cập nhật vòng lặp xử lý `snapshot.events` trong `network-transport.ts` (`:615-630`):
       - Khi nhận `ev.kind === 'bullet_volley_spawned'` có `ev.replacedProjectileId !== undefined`, xóa ngay viên đạn đang giữ (`awaitingServerRedirectTimer`) có `id === ev.replacedProjectileId` khỏi `this.sim.projectiles` trước khi spawn chùm đạn đổi hướng.
       - Khi nhận `ev.kind === 'projectiles_destroyed'`, lọc xóa tức thì mọi viên đạn trong `this.sim.projectiles` có `id` nằm trong `ev.ids`.
    6. **Chống rơi sự kiện đạn trong `snapshot-codec.ts` (`:298-305`):** Thay thế lệnh cắt mù `.slice(0, 32)` trên `netEvents` bằng cơ chế **ưu tiên giữ 100% các sự kiện đồng bộ đạn (`bullet_volley_spawned`, `projectiles_destroyed`)** trước khi điền các sự kiện hiệu ứng (`damage_number`, `status_applied`, `enemy_killed`), đồng thời nâng trần `netEvents` mỗi gói snapshot từ `32` lên **`64`**.
    7. Nâng và tách bể Object Pool: `MAX_PLAYER_PROJECTILES = 240`, `MAX_ENEMY_PROJECTILES = 160`, `MAX_TACTICAL_PROPS_PER_ROOM = 16`, `MAX_DEPLOYABLES_PER_PLAYER = 8`.

- **`Task P0A.5` — Cập Nhật HUD Thay Thế Thanh Energy Bằng Trạng Thái Băng Đạn / Nhiệt Độ (`Section 1.3 #2`):**
  - **Files:** `apps/client/src/scenes/game-scene/hud-combat-and-coop.ts`, `apps/client/src/scenes/game-scene/hud-setup-and-pause.ts`, `apps/client/src/scenes/game-scene/hud-hub-and-cards.ts`, `apps/client/src/i18n/locales/vi.json`, `apps/client/src/i18n/locales/en.json`.
  - **Chi tiết thực hiện:**
    1. Gỡ bỏ thanh Energy màu xanh dương khỏi thẻ trạng thái người chơi góc trên-trái và khỏi thẻ đồng đội Co-op.
    2. Thay thế bằng thanh hiển thị **Nhịp Vũ Khí Đang Cầm** rõ ràng, sắc nét:
       - Với súng `CLIP_RELOAD`: Hiển thị các viên đạn phân đoạn (`Segmented Clip Bar`, viên cuối cùng tô màu Vàng Cam `Finale Shot`) kèm số `Đạn hiện tại / Kích thước băng`.
       - Với súng `HEAT_VENT`: Hiển thị thanh Nhiệt Độ chuyển sắc (`Xanh -> Vàng -> Vùng Cam 65%–95% -> Đỏ 100%`) kèm nhãn `% Nhiệt`.
       - Với vũ khí `MELEE_COMBO`: Hiển thị 3 nấc nhịp đòn chém (`Combo 1 -> 2 -> 3 PARRY!`).
    3. Trên 2 thẻ vũ khí góc dưới-phải và thẻ so sánh vũ khí (`updateWeaponComparisonCardImpl`), thay dòng "Tiêu hao NL" bằng thông tin nhịp (`Băng: X viên · Nạp: Ys` / `Nhiệt: X%/phát` / `Combo 3 đòn · Parry Đòn 3`).

- **`Task P0A.6` — Visual Gate & Phase Gate `P0A`:**
  - Chụp `pnpm shots -- --phase ap2-p0a --label after --scenes hub-solo,b1-start-room,b1-combat,coop-4p-combat,b1-hud-weapon-compare,b1-dark-interactables`.
  - Kiểm tra bằng Visual Reviewer (`pro`): xác nhận thanh Energy đã biến mất hoàn toàn, HUD Băng đạn/Nhiệt độ mới không chồng lấp chữ tiếng Việt, thẻ vũ khí hiển thị đúng 1 vũ khí khởi đầu ở Ô 1 và Ô 2 trống khi bắt đầu.
  - Chạy `pnpm verify` & `pnpm perf` đạt 100%. Commit trên nhánh `overhaul/v2.0` và gắn tag `ap2-p0a` *(Lưu ý: giữ nguyên toàn bộ commit trên nhánh `overhaul/v2.0` cho đến hết `Phase P5`, ghi đè ghi chú "Merge thẳng vào main" ở Mục 8 của Spec Rev 4)*.

---

### PHASE P0B — Vertical Slice Độ Vui: 3 Archetype Phòng Chiến Thuật, Vật Lý `Flip Cover [E] + Dash-Kick + Wall-Slam + Ring-Out` & 4 Vũ Khí Đại Diện
> **Tham chiếu Spec Rev 4:** Phần 2 (`2.1` 3 Archetype đầu, `2.2` Quy luật Vật lý 1 & 2, `2.3` Biome 1 Law & Props), Phần 3 (`3.2`, `3.3` 4 vũ khí đại diện), Phần 7 (`7.3` VFX/Art/Audio Phase 0B), Phần 8 (`Phase 0B`).
> **Mục tiêu:** Dựng hoàn chỉnh và kiểm chứng độ sướng tay của **Tam Giác Hành Động 3 Giây** trong Biome 1 trước khi nhân rộng ra toàn bộ 18 vũ khí và 3 Biome.

#### Danh sách Task con của `Phase P0B`:
- **`Task P0B.1` — Cài Đặt 3 Archetype Hình Học Phòng Chiến Thuật Đầu Tiên (`TWIN_BRIDGES`, `GAUNTLET_CHOKEPOINT`, `CENTRAL_BASTION`) Có `Mirror & Prop Jitter` (`Section 2.1`):**
  - **Files:** Tạo mới `packages/shared/src/sim/arena-room-archetypes.ts`, kết nối vào `packages/shared/src/sim/arena-map.ts` và `packages/shared/src/sim/sim-dungeon-rooms.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. Xóa bỏ bố cục 4 cột đá `2×2` cố định ở 4 góc và các tọa độ prop/surface đặt cứng trong `arena-map.ts` & `sim-dungeon-rooms.ts`.
    2. Cài đặt `configureRoomLayout(roomSeed, archetype, biome, activeDoorSides)`:
       - **Biến thiên chống học thuộc lòng:** Áp dụng `flipX = (roomSeed & 1) !== 0`, `flipY = (roomSeed & 2) !== 0` và dịch chuyển vị trí neo prop ngẫu nhiên `±1..2` ô gạch (`Prop Jitter`) theo `roomSeed`.
       - **Bảo toàn hành lang cửa (`Door Clearance Guarantee`):** Tại 4 tọa độ cửa chuẩn (`N: (18,1)`, `S: (18,20)`, `W: (1,11)`, `E: (34,11)`), vùng sảnh `3×3` quanh các cửa đang mở (`activeDoorSides`) luôn là sàn `floor` thông suốt vào cầu/hành lang chính.
       - **Archetype 1 — `TWIN_BRIDGES`:** Dùng `SurfaceKind = 'chasm'` cắt dọc phòng từ `ty: 1..20` (`tx: 15..20`), chỉ chừa đúng **2 cây cầu rộng 3 ô (`ty: 5..7` và `ty: 14..16`)**. Nếu phòng có cửa Bắc `(18,1)` hoặc Nam `(18,20)`, dải vực `chasm` tự động rẽ nhánh chữ Y ôm quanh sảnh cửa (`tx: 13..15` và `tx: 20..22` nối sát tường Bắc/Nam) để **chặn đứng 100% việc đi vòng dọc mép tường trên/dưới — buộc mọi quái bộ binh và người chơi phải đi qua 2 cây cầu**!
       - **Archetype 2 — `GAUNTLET_CHOKEPOINT`:** 4 khối tường chữ L (`4×3` ô) nhô ra từ 4 góc vào trung tâm (`tx: 8..11, 24..27`) + 2 tường chắn ngắn tạo hành lang chữ thập rộng `160–220px` tối ưu cho đạn nảy `Ricochet` và `Wall-Slam`.
       - **Archetype 3 — `CENTRAL_BASTION`:** Trung tâm phòng (`tx: 15..20, ty: 8..13`) là cụm công sự hình hộp có 2 lối vào, bao quanh bởi 4 Bia Chắn Lật Được và Đồ Chơi Biome.
    3. Viết unit test kiểm tra: với 500 `roomSeed` và mọi tổ hợp `activeDoorSides`, BFS từ mọi cửa mở đều đi tới được mọi cửa mở khác, và trong `TWIN_BRIDGES` không tồn tại bất kỳ đường đi bộ nào từ nửa Tây (`tx < 13`) sang nửa Đông (`tx > 22`) mà không đi qua 2 cây cầu `ty: 5..7` hoặc `ty: 14..16`.

- **`Task P0B.2` — Cài Đặt Quy Luật Vật Lý Toàn Cục: `Flip Cover [E]`, `Dash-Kick / Melee-Kick`, `Wall-Slam` & `Chasm Ring-Out` (`Section 2.2`):**
  - **Files:** Tạo mới `packages/shared/src/sim/sim-tactical-physics.ts`, kết nối vào `packages/shared/src/sim/interact-target.ts`, `packages/shared/src/sim/sim-player.ts`, `packages/shared/src/sim/sim-enemies-core.ts`, `packages/shared/src/protocol/network-transport.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **Thứ tự ưu tiên cứng của Phím `[E]` (`INTERACT`) trong `findInteractTarget` (`interact-target.ts`):**
       - **Ưu tiên 1 (`r <= 52px`):** Cứu đồng đội đang gục (`Revive`).
       - **Ưu tiên 2 (`r <= 52px`):** Lật Bia Chắn đang ở trạng thái `'low'` sang `'flipped'` (`hp = 60` cho `moss_table`, chặn đạn địch & chặn di chuyển). Ngay khoảnh khắc lật, phát vòng **`Micro-Blank` bán kính `56px` trong `0.15s` xóa sạch đạn địch trong vùng** (đẩy `projectiles_destroyed`) và đẩy lùi nhẹ quái sát bên. Khi bàn đã ở `'flipped'`, nhấn `[E]` **không làm gì cả** (`findInteractTarget` bỏ qua bàn đã `'flipped'`).
       - **Ưu tiên 3 (`r <= 64px`):** Nhặt vật phẩm / Mở rương / Tương tác đài.
    2. **Cơ chế `Dash-Kick` & `Melee-Kick` (`520 px/s`) + Đồng bộ Dự Đoán Va Chạm Client (`Client-Side Prediction`):**
       - Trong `resolvePropMovementCollision(p)` khi `p.dashTimer > 0`:
         - Nếu chạm Bia Chắn đang `'flipped'` với **`dot(dashDir, dirFromPlayerToProp) >= 0.45`** (hoặc chạm Đồ Chơi hình tròn ở bất kỳ góc nào): lập tức chuyển `prop.coverState = 'sliding'`, `prop.blocksMovement = false`, **bỏ qua việc đẩy lùi tọa độ `(p.x, p.y)` của người chơi ở tick đó** (lướt xuyên mượt 100%), và gán vận tốc trượt `520 px/s` theo hướng `p.aimAngle`.
         - Chém cận chiến hoặc Xung Phong Khiên trúng Bia Chắn `'flipped'` / Đồ Chơi cũng kích hoạt `Melee-Kick` trượt đi ở `520 px/s` theo `p.aimAngle`.
       - Trên đường trượt, vật thể gây $\text{Dmg}_{\text{KickSlide}}(e)$, làm Choáng `1.0s`, đẩy lùi `knockback = 260`, và vỡ/nổ khi đâm vào tường.
       - **Bắt buộc cập nhật `network-transport.ts` (`:367` vòng lặp replay input chưa xác nhận & `:711` hàm `stepLocalPrediction`):** Gọi cùng hàm va chạm vật thể (`resolvePropMovementCollision` bao gồm quy tắc bỏ qua đẩy lùi khi `Dash-Kick` với `dot >= 0.45`) ngay sau `this.sim.map.resolveCircleCollision` để Client dự đoán chuẩn xác 100% khi đi sát Bia Chắn `'flipped'` hoặc lướt `Dash-Kick` xuyên qua nó trong Co-op LAN, chống giật lùi (rubberbanding).
    3. **Cơ chế `Wall-Slam` & `Chasm Ring-Out`:**
       - Khi quái có vận tốc đẩy lùi `hypot(e.kbVx, e.kbVy) >= 120 px/s` va vào tường, cột đá hoặc Bia Chắn `'flipped'`: gây $\text{Dmg}_{\text{WallSlam}}(e)$, làm khựng **Hit-stun `0.40s`** (ngắt Telegraph của quái thường/Tinh Anh), phát sự kiện popup `ĐẬP TƯỜNG!`, và nếu `e.frozenTimer > 0` thì kích nổ ngay phản ứng **`VỠ BĂNG (Shatter)`**.
       - Khi quái bộ binh (`!e.flying && !e.isBoss`) bị đẩy rơi vào ô `SurfaceKind === 'chasm'`: Quái thường chết tức thì (`RING-OUT!`) và bắn vọt vàng/loot ngược lên ô sàn hợp lệ gần nhất; Quái Tinh Anh mất `30% MaxHP`, nảy ngược lên bờ và bị Choáng `1.0s`.

- **`Task P0B.3` — Cài Đặt Quy Luật Sinh Tồn Biome 1 (`Thảm Thực Vật Cộng Hưởng`) & 3 Vật Thể Chiến Thuật Biome 1 (`Section 2.3 Biome 1`):**
  - **Files:** `packages/shared/src/sim/sim-tactical-physics.ts`, `packages/shared/src/sim/sim-props-spawning.ts`, `packages/shared/src/sim/arena-room-archetypes.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **Luật Biome 1:**
       - Đứng trên ô **Cỏ Rậm (`tall_grass`)** và thực hiện **`Dash`** hoặc bấm trúng **`Perfect Reload [R]`** sẽ bung phấn hoa tăng **`+25%` Tốc chạy trong `2.0s`**.
       - Đạn/kỹ năng nguyên tố **Lửa (`fire`)** chạm vào `tall_grass` hoặc `poison_swamp` sẽ kích hoạt **cháy lan dây chuyền (`320 px/s`)**, thiêu đốt mọi kẻ địch đứng trên thảm cỏ/đầm độc đó.
    2. **3 Vật Thể Tương Tác Đặc Trưng Biome 1:**
       - **`moss_table` (Bàn Đá Rêu Cổ — *Bia Chắn Lật `[E]`*):** Lật bằng `[E]` tạo bia chắn đá `60 HP`. Khi bị bắn vỡ hoặc `Dash-Kick` đâm vỡ, bung vùng **Phấn Hoa Hồi Giáp (`+1 Giáp`, `r=72px`)**.
       - **`volatile_spore_pod` (Túi Bào Tử Căng Phồng):** Dùng `Dash-Kick` hoặc đòn Cận chiến sút văng quả nang bay đi (`520 px/s`), chạm quái/tường nổ vùng **Độc + Trói chân `1.2s` (`r=96px`)**.
       - **`rotten_totem_pillar` (Trụ Đá Mục):** Khi bị bắn gãy hoặc có quái bị `Wall-Slam` / `Dash-Kick` đập vào, cột **đổ sập theo hướng lực tác động**, đè dải chữ nhật **`160×56px`** gây $\text{Dmg}_{\text{Hazard}}$ + Choáng `1.5s`.

- **`Task P0B.4` — Cài Đặt Hệ Thống Nhịp Vũ Khí (`CLIP_RELOAD`, `HEAT_VENT`, `MELEE_COMBO` 3 Đòn + `Parry Deflect`) & 4 Vũ Khí Đại Diện (`Section 3.2 & 3.3`):**
  - **Files:** Tạo mới `packages/shared/src/sim/sim-weapon-cadence.ts` và `packages/shared/src/sim/sim-weapon-specials.ts`, cập nhật `packages/shared/src/data/weapons.ts`, `packages/shared/src/sim/sim-projectiles.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. Cài đặt 3 cơ chế nhịp vũ khí trong `sim-weapon-cadence.ts`:
       - **`CLIP_RELOAD`:** Băng đạn ngắn; viên cuối băng (`Finale Shot`) gây **`+50% Additive DMG`** + 100% nguyên tố + hiệu ứng đặc trưng; đang nạp đạn mà nhấn **`[R]` (`INPUT_BUTTON.RELOAD_VENT`)** trong **Khung Vàng (`45% – 70%`)** sẽ hoàn tất nạp đạn ngay lập tức và cường hóa phát đầu tiên của băng mới thành **`Overclocked Shot (+45% Additive DMG)`** (nếu bấm `[R]` trượt ngoài khung vàng: khóa nút `[R]` trong chu kỳ nạp đó, nạp hết thời gian còn lại). **Tuyệt đối không cho Chuột Trái kích hoạt `Perfect Reload`.**
       - **`HEAT_VENT`:** Bắn tăng Nhiệt `0% -> 100%`; ở **Vùng Nhiệt Cam (`65% – 95%`)** nhận **`+25%` Tốc độ bắn** và **`+25% Additive DMG`**; chạm `100%` bị Quá Nhiệt khóa cò `1.10s`; nhấn **`[R]` trong vùng `65% – 95%`** kích hoạt **`Tactical Vent`** trong `0.25s` đưa Nhiệt về `0%` và nổ hiệu ứng xả áp đặc trưng.
       - **`MELEE_COMBO`:** Chuỗi 3 đòn chém (`Đòn 1 -> Đòn 2 Lunge -> Đòn 3 Tuyệt Kỹ`, nhịp nghỉ `comboRecoverySec = 0.25s`). **Đòn thứ 3** mở cửa sổ **`Parry Deflect` trong `0.18s`**: đánh bật tối đa **3 viên đạn địch** chạm lưỡi vũ khí bay ngược về `aimAngle` ở tốc độ `760 px/s` thành đạn nổ của người chơi! (Đòn 1 và 2 không xóa/không phản đạn).
       - **`Holster Auto-Reload`:** Vũ khí cất ở ô phụ tự động nạp đầy băng / hạ sạch nhiệt sau `2.0s`.
    2. Cài đặt đầy đủ cơ chế độc bản cho **4 Vũ Khí Đại Diện của Phase 0B**:
       - **`rivet_gun` (`CLIP_RELOAD`, Băng `6`, Nạp `0.90s`, `9 DMG`, `Finale: 15 DMG Sét`, `3.4/s`, `procCoeff = 0.55`):** Mỗi phát cắm 1 Đinh Tán Từ Tính vào quái/tường/bia chắn (tối đa `maxActiveRivets = 6`). Khi bắn Viên thứ 6 (`Finale Shot`) HOẶC bấm trúng `Perfect Reload [R]`, toàn bộ đinh tán trong `180px` phóng hồ quang điện nối liền nhau rồi tự hủy, gây `5 DMG Sét/đinh` (`7.5 DMG/đinh` khi `Perfect Reload`).
       - **`apprentice_staff` (`HEAT_VENT`, `11 DMG`, Nhiệt Cam `13.8`, `2.6/s`, `heatPerShot = 14%`, xoay vòng `Lửa/Băng/Sét`, `procCoeff = 0.75`):** Phát thứ 3 liên tiếp phóng Quả Cầu Lớn (`17 DMG`, nổ `r=56px`). Nhấn `[R]` `Tactical Vent` ở `65%–95%` Nhiệt phát xung `r=56px` xóa đạn địch sát thân và phóng **1 Tia Tam Giác Nguyên Tố tới vị trí con trỏ chuột (`22 DMG`, nổ `r=72px`, 100% áp nguyên tố)**.
       - **`knight_sword` (`MELEE_COMBO`, DMG `12 -> 14 -> 24`, `2.1/s`, recovery `0.25s`, tầm `56px`, KB `150/180/260`, `procCoeff = 0.80`):** Đòn 1 & 2 chém ngang/chéo kèm `Lunge 24px`. Đòn 3 phóng **Lưỡi Kiếm Khí Bán Nguyệt tầm xa `240px` (`24 DMG`, xuyên quái)** đồng thời kích hoạt **`Parry Deflect` `0.18s`** đánh bật tối đa 3 viên đạn địch!
       - **`tesla_carbine` (`CLIP_RELOAD`, Băng `8`, Nạp `1.00s`, `12 DMG Sét` xuyên 1, nảy tường `2 lần`, `procCoeff = 0.60`):** Đạn gắn `SHOT_FLAG.DYNAMIC_BOUNCE`; khi đã xuyên qua ít nhất 1 quái HOẶC bắn qua Bia Chắn / Lăng Kính, lần chạm tường tiếp theo trên Server tự động bẻ góc tìm quái gần nhất (**`Smart Bounce`**) và nhận **`+35% Additive DMG/lần nảy`**. `Finale Shot` giật sét dây chuyền 3 mục tiêu; `Perfect Reload [R]` cộng `+1 lần nảy` cho băng mới.

- **`Task P0B.5` — Giao Diện Thanh `Micro-Bar 32×5px` Dưới Chân Nhân Vật, Texture Baker Props Biome 1, VFX & 4 Hiệu Ứng Âm Thanh ZzFX (`Section 7.3`):**
  - **Files:** Tạo mới `apps/client/src/scenes/game-scene/hud-micro-reload-bar.ts` và `apps/client/src/fx/combat-fx-weapons-v2.ts`, cập nhật `apps/client/src/art/texture-baker-props.ts`, `apps/client/src/art/texture-baker-surfaces.ts`, `apps/client/src/audio/zzfx.ts`, `apps/client/src/scenes/game-scene/room-entities-sync.ts`.
  - **Chi tiết thực hiện:**
    1. **Thanh `Micro-Bar 32×5px` dưới chân nhân vật (`hud-micro-reload-bar.ts`):**
       - Chỉ hiển thị cho vũ khí tầm xa (`CLIP_RELOAD` khi đang nạp đạn, hoặc `HEAT_VENT` khi có Nhiệt `> 0%`). **Ẩn hoàn toàn khi cầm vũ khí `MELEE_COMBO`.**
       - Vẽ khung viền `INK_DARK` `1px`, đánh dấu nổi bật vùng **Khung Vàng `45% – 70%`** (cho `CLIP_RELOAD`) hoặc **Vùng Cam `65% – 95%`** (cho `HEAT_VENT`), có vạch con chạy rõ nét và hiệu ứng lóe sáng vàng + chữ nổi nhỏ `HOÀN HẢO!` / `XẢ ÁP!` khi bấm trúng `[R]`.
    2. **Bake Texture Procedural (`texture-baker-props.ts` & `texture-baker-surfaces.ts`):**
       - Vẽ `SurfaceKind = 'chasm'` theo chủ đề Biome (Vực Rễ Sâu tối thẳm có rễ cây bám mép đá ở Biome 1, Vực Băng Thẳm ở Biome 2, Vực Lò Nung ở Biome 3) và mặt cầu gỗ/đá bắc qua vực trong `TWIN_BRIDGES`.
       - Vẽ 3 trạng thái rõ ràng của `moss_table`: `'low'` (bàn đá rêu nằm thấp, không viền chặn), `'flipped'` (dựng đứng thành bia chắn dày có mặt đá đón sáng `-135°` và vệt rêu phát sáng nhẹ), `'sliding'` (nghiêng lướt kèm vệt bụi).
       - Vẽ `volatile_spore_pod` (nang bào tử căng phồng phát quang lục) và `rotten_totem_pillar` (cột đá mục có vết nứt chân cột + dải sập `160×56px`).
    3. **VFX & Audio (`combat-fx-weapons-v2.ts` & `zzfx.ts`):**
       - Vẽ đinh tán cắm & tia hồ quang nối đinh của `rivet_gun`; tia tam giác nguyên tố của `apprentice_staff`; lưỡi kiếm khí bán nguyệt `240px` & tia lóe trắng `Parry Deflect` của `knight_sword`; vòng sóng trắng `Micro-Blank` (`r=56px`) khi lật bàn `[E]`; vệt gió `Dash-Kick`; vệt nứt chấn động + chữ `ĐẬP TƯỜNG!` (`Wall-Slam`) & `RING-OUT!`.
       - Thêm 4 âm thanh tổng hợp ZzFX trong `zzfx.ts`: tiếng *"Ching!"* kim khí trong trẻo khi `Perfect Reload`, tiếng xả hơi áp suất khi `Tactical Vent`, tiếng lật bàn đá nặng, và tiếng va đập chấn động `Wall-Slam`.

- **`Task P0B.6` — Xây Dựng Bộ Cảnh Chụp Kiểm Chứng Hình Ảnh & Strip 8-Frame Cho `Phase P0B` (`tests/e2e/helpers/visual-scene-ap2-p0.ts`):**
  - **Files:** Tạo mới `tests/e2e/helpers/visual-scene-ap2-p0.ts`, đăng ký nhóm cảnh `ap2-p0b` vào `tests/e2e/helpers/visual-scenes.ts` và `tools/run-shots.ts`.
  - **Lưu ý kỹ thuật bắt buộc về `sampleRects` (`floor_center`) cho `tools/visual-metrics.ts`:** Trong `tests/e2e/helpers/visual-scene-helpers.ts:33`, hằng số `ENVIRONMENT_SAMPLE_RECTS` mặc định đặt vùng đo `floor_center` tại `{ x: 832, y: 664, width: 128, height: 96 }` (ngay chính giữa phòng `tx: 15..20`). Với các phòng mà vùng chính giữa là vực sâu `chasm` (`ap2-b1-twin-bridges`) hoặc tường công sự trung tâm (`ap2-b1-central-bastion`), khi định nghĩa scene **bắt buộc phải truyền `sampleRects: ENVIRONMENT_SAMPLE_RECTS.map(...)` ghi đè tọa độ `floor_center` sang vùng sàn đi bộ thông thoáng ở nửa Tây hoặc nửa Đông của phòng** (tương tự cách `b1-poison-swamp` và `b3-lava-surface` trong `visual-scenes.ts:646,712` đang làm) để `visual-metrics.ts` đo đúng độ đồng nhất mặt sàn (`centerDeltaL <= 8`, `contrastWithInkDark >= 22`) mà không đo nhầm vào vực sâu/tường đá.
  - **Danh sách cảnh chụp bắt buộc của `Phase P0B`:**
    1. `ap2-b1-twin-bridges`: Phòng `TWIN_BRIDGES` ở Biome 1 (chụp cả lit và `-unlit.png` để đo `metrics.json`, có ghi đè `sampleRects.floor_center` sang mặt sàn nửa Tây/Đông), hiển rõ dải vực `chasm` cắt đôi phòng có nhánh chữ Y quanh cửa Bắc/Nam, 2 cây cầu rộng 3 ô, bàn đá `moss_table` và túi bào tử `volatile_spore_pod`.
    2. `ap2-b1-gauntlet-chokepoint`: Phòng `GAUNTLET_CHOKEPOINT` với 4 khối tường chữ L và hành lang chữ thập.
    3. `ap2-b1-central-bastion`: Phòng `CENTRAL_BASTION` với công sự trung tâm và 4 bàn chắn bao quanh (có ghi đè `sampleRects.floor_center` ra ngoài công sự trung tâm).
    4. `ap2-flip-cover-microblank` (`captureStrip: true`, 8 frame): Người chơi nhấn `[E]` lật `moss_table` từ `'low'` sang `'flipped'`, phát vòng sóng trắng `Micro-Blank` `r=56px` xóa sạch chùm đạn địch đang bay tới.
    5. `ap2-dash-kick-wall-slam` (`captureStrip: true`, 8 frame): Người chơi lướt `Shift` (`Dash-Kick`) sút tấm `moss_table` đã lật trượt đi ở `520 px/s`, tông văng quái đập vào tường kích nổ `ĐẬP TƯỜNG!` (`Wall-Slam`) và bung phấn hoa hồi giáp.
    6. `ap2-chasm-ring-out` (`captureStrip: true`, 8 frame): Trên cầu `TWIN_BRIDGES`, người chơi đẩy quái bộ binh rơi xuống vực `chasm` hiện chữ `RING-OUT!` và bắn vọt vàng ngược lên mặt cầu.
    7. `ap2-microbar-perfect-reload` (`captureStrip: true`, 8 frame): Nhân vật cầm `rivet_gun` bắn viên cuối `Finale Shot` rồi bấm `[R]` ngay trong Khung Vàng `45%–70%` trên thanh `Micro-Bar 32×5px`, kích nổ lưới hồ quang điện nối 6 đinh tán.
    8. `ap2-heat-vent-staff` (`captureStrip: true`, 8 frame): Nhân vật cầm `apprentice_staff` ở vùng Nhiệt Cam `80%`, nhấn `[R]` `Tactical Vent` xóa đạn sát thân và phóng Tia Tam Giác Nguyên Tố nổ tại con trỏ.
    9. `ap2-melee-combo3-parry` (`captureStrip: true`, 8 frame): Nhân vật `vanguard` cầm `knight_sword` (không hiện Micro-Bar) vung Đòn 3 phóng Lưỡi Kiếm Khí `240px` qua bên kia vực `TWIN_BRIDGES` đồng thời `Parry Deflect` đánh bật 3 viên đạn địch bay ngược lại.
    10. `ap2-tesla-smart-bounce` (`captureStrip: true`, 8 frame): Nhân vật cầm `tesla_carbine` bắn xuyên qua Bia Chắn / quái đầu tiên, viên đạn chạm tường trong `GAUNTLET_CHOKEPOINT` tự động bẻ góc `Smart Bounce` tìm quái khuất sau góc chữ L.

- **`Task P0B.7` — Visual Gate, Phase Gate `P0B` & Báo Cáo Kiểm Chứng `Playtest Gate 1`:**
  - Chạy `pnpm shots -- --phase ap2-p0b --label after --group ap2-p0b` và `visual-metrics.ts`.
  - Triệu hồi Visual Reviewer (`pro`) chấm toàn bộ 10 cảnh và strip chuyển động trên. Sửa triệt để mọi lỗi `blocker`/`major` cho đến khi đạt `≥ 8.0/10`.
  - Chạy `pnpm verify` (kèm bài test đồng bộ mạng 4P cho `tesla_carbine` Smart Bounce và `knight_sword` Parry Deflect) & `pnpm perf`.
  - Tag `ap2-p0b`, xuất báo cáo **Human Playtest Gate 1** trong `docs/PROGRESS.md` đối chiếu đủ 4 câu hỏi nghiệm thu ở Mục 8 (`Phase 0B`) của Spec Rev 4.

---

### PHASE P1A — Hoàn Thiện Kho Vũ Khí Độc Bản Đợt 1 (7 Vũ Khí: Starter, Uncommon & Rare)
> **Tham chiếu Spec Rev 4:** Phần 3 (`3.2`, `3.3` — Vũ khí #2 `hunter_crossbow`, #4 `thorn_staff`, #6 `scrap_shotgun`, #7 `gale_smg`, #8 `frag_launcher`, #10 `seed_gun`, #11 `tether_staff`), Phần 7 (`7.3`).
> **Mục tiêu:** Cài đặt hoàn chỉnh 7 vũ khí độc bản tiếp theo (bao gồm 2 vũ khí khởi đầu còn lại của `ranger` và `druid`, cùng 5 vũ khí Uncommon/Rare) với đầy đủ logic tất định, VFX và unit test.

#### Danh sách Task con của `Phase P1A`:
- **`Task P1A.1` — Hai Vũ Khí Khởi Đầu Còn Lại: `hunter_crossbow` (Liệp Ưng) & `thorn_staff` (Mộc Linh) (`Section 3.3A #2 & #4`):**
  - **Files:** `packages/shared/src/data/weapons.ts`, `packages/shared/src/sim/sim-weapon-specials.ts`, `packages/shared/src/sim/sim-projectiles.ts`, `apps/client/src/fx/combat-fx-weapons-v2.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **`hunter_crossbow` (`CLIP_RELOAD`, Băng `4`, Nạp `0.95s`, `15 DMG`, giữ cò `0.35s`: `22 DMG` xuyên 2, `kb=220`, `procCoeff = 1.00`):**
       - Mỗi mũi tên trúng đích cắm lại trên thân quái (`e.stuckArrows`, tối đa **4 mũi/mục tiêu**).
       - Khi bắn **Mũi thứ 4 (`Finale Shot`) HOẶC bấm trúng `Perfect Reload [R]`:** Giật dây rút toàn bộ mũi tên đang cắm trên các quái trong tầm, gây **`6 DMG × số mũi tên`** và làm chậm `30%` trong `1.5s`!
    2. **`thorn_staff` (`CLIP_RELOAD`, Băng `5`, Nạp `1.00s`, `11 DMG`, `Finale: 17 DMG Độc`, tốc quất `2.8/s`, tầm `240px`, `procCoeff = 0.75`):**
       - Mỗi phát vươn dây gai dài `240px` quất xuyên hàng quái, áp `Độc` và cắm **1 Gai Ký Sinh (`e.parasiticThorns`, tối đa 5 gai/mục tiêu)**.
       - **Nhịp thứ 5 (`Finale Shot`):** Dây gai quấn kẻ địch ở cuối tầm và **kéo giật nó văng ngược về trước mặt người chơi `90px`** (hỗ trợ kéo quái xuống vực `chasm`!).
       - **Khi bấm trúng `Perfect Reload [R]` (hoặc sau `Finale Shot`):** Toàn bộ Gai Ký Sinh nở bung gây **`7 DMG Độc × số gai`**!

- **`Task P1A.2` — Bộ Ba Vũ Khí Uncommon: `scrap_shotgun`, `gale_smg` & `frag_launcher` (`Section 3.3B #6, #7, #8`):**
  - **Files:** `packages/shared/src/data/weapons.ts`, `packages/shared/src/sim/sim-weapon-specials.ts`, `packages/shared/src/sim/sim-projectiles.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **`scrap_shotgun` (`CLIP_RELOAD`, Băng `2`, Nạp `0.85s`, `5 × 6 mảnh = 30 DMG`, `kb = 250`, `procCoeff = 0.22/mảnh`):**
       - Bắn ở cự ly gần (`dist <= 96px`) đạt **Point-Blank (`×1.35 DMG`)** và đẩy lùi quái cực mạnh đập vào tường (`Wall-Slam`).
       - **Viên thứ 2 (`Finale Shot`):** Bắn cụm phế liệu nóng đỏ (`+50% Additive DMG`, áp `Lửa`).
       - **`Perfect Reload [R]`:** Hất văng 2 vỏ đạn nóng ra phía trước gây `16 DMG Lửa` + làm khựng `0.3s`.
    2. **`gale_smg` (`HEAT_VENT`, `5 DMG`, Nhiệt Cam `6.25`, Spin-up `6.0 -> 10.5/s`, `heatPerShot = 3.0%`, `procCoeff = 0.25`):**
       - Giữ cò tăng tốc bắn từ `6.0` lên `10.5/s` và tăng **`+15%` Tốc chạy**.
       - Ở vùng Nhiệt Cam (`65%–95%`), mỗi viên thứ 6 phóng kèm **Lưỡi Gió Xuyên Thấu (`14 DMG`, `kb=140`)**.
       - **Nhấn `[R]` Xả Áp (`Tactical Vent`):** Nổ **Cơn Lốc Xoáy (`r=96px`, `24 DMG`)** xóa đạn địch sát thân và hất văng quái xung quanh đập vào tường (`Wall-Slam`)!
    3. **`frag_launcher` (`CLIP_RELOAD`, Băng `3`, Nạp `1.10s`, nổ chính `22 DMG Lửa` `r=68px`, 5 mảnh con `× 6 DMG` khóa trần tối đa 2 mảnh trúng cùng 1 mục tiêu):**
       - Quả lựu đạn nảy 1 nhịp rồi nổ `22 DMG` + bung 5 mảnh con.
       - **Kích Nổ Trên Không Bằng Buông Cò (`Hold-and-Release Airburst`):** Giữ chuột trái lúc bắn và **buông chuột trái khi lựu đạn đang bay** để kích nổ `Airburst` ngay trên không (`r=104px`, mảnh văng vòng qua sau lưng khiên của `iron_shielder`)!

- **`Task P1A.3` — Hai Vũ Khí Rare: `seed_gun` & `tether_staff` (`Section 3.3B #10 & #11`):**
  - **Files:** `packages/shared/src/data/weapons.ts`, `packages/shared/src/sim/sim-weapon-specials.ts`, `packages/shared/src/sim/sim-skills-mechanics.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **`seed_gun` (`CLIP_RELOAD`, Băng `4`, Nạp `1.00s`, `13 DMG Độc`, `2.4/s`, `procCoeff = 0.80`):**
       - Mỗi phát gieo **1 Nụ Hoa Sinh Mệnh (`Life Bud`, tối đa 4 nụ)** rỉa `6 DMG Độc/s`.
       - **Nở Hoa Mùa Gặt (`Finale Shot` hoặc `Perfect Reload [R]`):** Toàn bộ Nụ Hoa nở rộ gây **`24 DMG Độc` + Trói chân `1.0s` (`r=88px`)**. **Chỉ khi nở trúng ít nhất 1 quái đang sống** mới bung **Sương Hồi Phục (`+1 Giáp`, hồi `+1 HP` với ICD `12.0s/người`, tối đa 2 lần/phòng)** — chống tuyệt đối việc đứng ngoài phòng trống bắn nở hoa hồi máu vô hạn!
    2. **`tether_staff` (`HEAT_VENT`, `11 DMG / 0.25s Sét`, `heatPerSec = 22%/s`, tầm `280px`, `procCoeff = 0.28/nhịp`):**
       - Phát đầu gắn đầu neo vào **Đồng Đội, Summon, Bia Chắn Lật Được** hoặc **Con Quái đầu tiên**. Giữ cò tạo **Dây Cắt Sét Cao Thế** nối căng từ người chơi tới điểm neo, cắt qua mọi kẻ địch nằm giữa.
       - **Nhấn `[R]` Xả Áp (`Tactical Vent`):** Thu ngắn sợi dây, **kéo giật toàn bộ quái chạm dây gom về điểm neo** rồi phát nổ điện từ (`32 DMG Sét`)!

- **`Task P1A.4` — Procedural VFX & Audio Cho 7 Vũ Khí Đợt 1 (`apps/client/src/fx/combat-fx-weapons-v2.ts` & `room-entities-sync.ts`):**
  - Vẽ mũi tên cắm trên thân quái & tia giật rút tên của `hunter_crossbow`; dây gai vươn quất `240px` & nụ gai ký sinh nở bung của `thorn_staff`; chùm phế liệu nóng đỏ & vỏ đạn văng của `scrap_shotgun`; lưỡi gió & lốc xoáy `[R]` của `gale_smg`; vòng nổ trên không `Airburst` của `frag_launcher`; tái sử dụng và nâng cấp `life_blossom` của `seed_gun` và `tetherBeams` + xung kéo `[R]` của `tether_staff`.

- **`Task P1A.5` — Xây Dựng Cảnh Chụp & Strip 8-Frame Cho 7 Vũ Khí Đợt 1 (`tests/e2e/helpers/visual-scene-ap2-p1.ts`):**
  - Tạo 7 cảnh strip chuyển động 8 frame (`ap2-wep-crossbow-rip`, `ap2-wep-thorn-pull`, `ap2-wep-shotgun-wallslam`, `ap2-wep-gale-vent`, `ap2-wep-frag-airburst`, `ap2-wep-seed-bloom`, `ap2-wep-tether-pull`).

- **`Task P1A.6` — Visual Gate & Phase Gate `P1A`:**
  - Chạy `pnpm shots -- --phase ap2-p1a --label after --group ap2-p1a`, chấm qua Visual Reviewer (`pro` `≥ 8.0/10`), chạy `pnpm verify` & `pnpm perf`. Tag `ap2-p1a`.

---

### PHASE P1B — Hoàn Thiện Kho Vũ Khí Độc Bản Đợt 2 (7 Vũ Khí: Rare, Epic & Legendary) & 3-Bucket Damage Pipeline
> **Tham chiếu Spec Rev 4:** Phần 3 (`3.3B` — Vũ khí #12 `focus_laser`, #13 `emerald_cleaver`, #14 `void_staff`, #15 `berserker_axe`, #16 `solar_archon_staff`, #17 `magma_cannon`, #18 `thunder_hammer`), Phần 4 (`4.6` Hệ phương trình chống nổ số).
> **Mục tiêu:** Hoàn tất đủ **18/18 vũ khí độc bản** và khóa chặt **3-Bucket Damage Pipeline** kèm bài kiểm toán toán học chống nổ số nhân.

#### Danh sách Task con của `Phase P1B`:
- **`Task P1B.1` — Cài Đặt Vũ Khí Rare & Epic Tầm Xa: `focus_laser` & `void_staff` (`Section 3.3B #12 & #14`):**
  - **Files:** `packages/shared/src/data/weapons.ts`, `packages/shared/src/sim/sim-weapon-specials.ts`, `packages/shared/src/sim/sim-projectiles.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **`focus_laser` (`HEAT_VENT`, DMG tia tăng `4 -> 11` mỗi `0.15s`, `Lửa`, tầm `520px`, `procCoeff = 0.25/nhịp`):**
       - Chiếu **Tia Laser Liên Tục (`Hitscan Beam`)** tăng dần độ dày và sát thương khi Nhiệt tăng. Khi chiếu vào Lăng Kính (`cryo_prism_pillar`) hoặc Khiên Thiết Vệ, tia khúc xạ thành 3 tia quạt.
       - **Nhấn `[R]` Xả Áp (`65%–95%` Nhiệt):** Phóng 1 phát **Pháo Railgun Tức Thời (`46 DMG Lửa`, xuyên toàn phòng)** rồi đưa nhiệt về `0%`!
    2. **`void_staff` (`CLIP_RELOAD`, Băng `2 Cầu Hố Đen`, Nạp `1.05s`, tốc đạn `320 px/s`, hút `12 DMG/nhịp`, nổ Implosion `52 DMG Độc`, `procCoeff = 1.00`):**
       - Giữ chuột trái bắn ra **Quả Cầu Hố Đen** hút quái và nuốt đạn địch trong bán kính `110px` cuốn vào tâm (phát `projectiles_destroyed` cho các viên đạn địch bị nuốt).
       - **Buông Chuột Trái (`Hold-and-Release Implosion`) hoặc khi hết tầm:** Quả cầu co rút nổ tung **`52 DMG Độc` (+ `6 DMG` cho mỗi viên đạn địch đã nuốt, tối đa `+36 DMG`)**, gom quái vào một điểm!

- **`Task P1B.2` — Cài Đặt Hai Vũ Khí Epic Cận Chiến (`MELEE_COMBO` 3 Đòn + `Parry Deflect`): `emerald_cleaver` & `berserker_axe` (`Section 3.3B #13 & #15`):**
  - **Files:** `packages/shared/src/data/weapons.ts`, `packages/shared/src/sim/sim-weapon-cadence.ts`, `packages/shared/src/sim/sim-weapon-specials.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **`emerald_cleaver` (`MELEE_COMBO`, DMG 3 đòn: `22 -> 26 -> 32 Boomerang`, `Độc`, `procCoeff = 0.85`):**
       - Đòn 1 & 2: Chém vòng cung rộng `135°` áp `Độc`.
       - **Đòn 3 (Tuyệt Kỹ + `Parry Deflect` `0.18s`):** Ném xoay thanh Đại Đao bay tới điểm con trỏ (`280px`), xoay tròn `0.40s` phản tối đa 3 viên đạn địch rồi **bay ngược về vị trí hiện tại của người chơi (`32 DMG`, kéo quái theo đường về)**!
    2. **`berserker_axe` (`MELEE_COMBO`, DMG 3 đòn: `24 -> 30 -> 52 Đoạn Đầu Đài`, `Lửa`, `procCoeff = 0.80`):**
       - Mỗi đòn chém trúng quái cộng dồn **Huyết Nộ** tăng tốc đánh (tối đa `+35%`, thêm `+15%` khi mất Giáp).
       - **Đòn 3 (Tuyệt Kỹ + `Parry Deflect` `0.18s`):** Nhảy vọt tới trước `96px` bổ nhát **Đoạn Đầu Đài (`52 DMG Lửa`)**, **đập vỡ ngay khiên của `iron_shielder`**, phản tối đa 3 viên đạn và tạo vệt nứt lửa dài `160px`!

- **`Task P1B.3` — Cài Đặt Bộ Ba Vũ Khí Huyền Thoại (`Legendary`): `solar_archon_staff`, `magma_cannon` & `thunder_hammer` (`Section 3.3B #16, #17, #18`):**
  - **Files:** `packages/shared/src/data/weapons.ts`, `packages/shared/src/sim/sim-weapon-specials.ts`, `packages/shared/src/sim/sim-projectiles.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **`solar_archon_staff` (`HEAT_VENT`, `15 × 3 tia hội tụ Lửa`, vệ tinh chạm `12 DMG` với ICD `0.40s/quả`, nổ Siêu Tân Tinh `[R]`: `68 DMG`):**
       - **3 Mặt Trời Nhỏ** xoay quanh người chơi. Mỗi phát bắn phóng 3 tia lửa hội tụ tại vị trí con trỏ chuột (`r=52px`).
       - **Nhấn `[R]` Xả Áp (`Supernova Convergence` ở `65%–95%` Nhiệt):** 3 Mặt Trời lao chụm vào con trỏ chuột nổ **Siêu Tân Tinh (`68 DMG Lửa`, `r=120px`)** và để lại vùng Lửa Thái Dương `3.5s`!
    2. **`magma_cannon` (`CLIP_RELOAD`, Băng `3 Nham Cầu`, Nạp `1.25s`, `38 DMG Lửa`, `kb = 280`, `procCoeff = 1.00`):**
       - Bắn **Khối Đá Nham Thạch (`r=20px`, `420 px/s`)** lăn ủi quái trên đường đi đập thẳng vào tường cuối phòng (**kích hoạt `Wall-Slam` hàng loạt**) và trải **Thảm Dung Nham rộng `48px` (`3.5s`)**.
       - **Viên Thứ 3 (`Finale Shot`) & `Perfect Reload [R]`:** Phun **4 Vòi Dung Nham (`22 DMG/vòi`)** dọc theo vệt dung nham trên sàn!
    3. **`thunder_hammer` (`MELEE_COMBO`, DMG 3 đòn: `30 -> 34 -> 54 Cột Lôi Đình`, `Sét`, `kb = 320`):**
       - Đòn 1 & 2: Vung búa với `knockback = 320`, đánh văng quái hoặc Thùng Nổ/Khối Băng bay xuyên phòng (`Wall-Slam`).
       - **Đòn 3 (Tuyệt Kỹ + `Parry Deflect` `0.18s`):** Đập búa xuống đất tạo **Cột Thu Lôi**, đánh bật 3 viên đạn địch thành tia sét và giáng **3 tia sét lớn (`54 DMG Sét`, `r=110px`)**!

- **`Task P1B.4` — Cài Đặt `3-Bucket Damage Pipeline` & Kiểm Toán Toán Học Chống Nổ Số Nhân (`Section 4.6`):**
  - **Files:** Tạo mới `packages/shared/src/sim/sim-damage-pipeline.ts`, kết nối vào `packages/shared/src/sim/sim-combat-damage.ts` và `packages/shared/src/sim/sim-projectiles.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. Cài đặt chính xác hàm `computeThreeBucketDamage` theo công thức ở Mục `2.3` (`M_upgrade`, `M_AdditivePool(S)` với Soft Cap `2.80×` khi `S > 1.80` và Hard Cap `3.80×`, `M_EnemyVuln <= 1.75`, `Shatter` `×2.0` trên quái và `×1.35` trên Boss).
    2. Cài đặt khóa thế hệ tách đạn `splitGeneration: 0 | 1` và trần cứng `MAX_PELLETS_PER_TRIGGER = 9`, `MAX_BOUNCE_COUNT = 4`.
    3. Viết bài **Property-Based Unit Test (`packages/shared/test/ap2-damage-pipeline.test.ts`)** vét cạn hàng ngàn tổ hợp cộng dồn (Finale + Overclock + Overheat + 4 Bounces + Shield + Zone + Prism + Pact + Relic + Crit + Shatter + Boss Armor Break) để chứng minh:
       - `M_AdditivePool(S)` không bao giờ vượt quá `3.80`.
       - Đạn `splitGeneration === 1` không bao giờ sinh thêm đạn con khi qua vật tách đạn thứ 2.
       - Tổng hệ số nhân 1 đòn đơn lẻ trên Boss không bao giờ vượt quá `18.0×` sát thương gốc.

- **`Task P1B.5` — Procedural VFX Cho 7 Vũ Khí Đợt 2 & Bộ Cảnh Chụp Strip 8-Frame (`visual-scene-ap2-p1.ts`):**
  - Vẽ quả cầu hút đen & vòng co rút Implosion của `void_staff`; đao xoay Boomerang `emerald_cleaver`; vệt nứt lửa Đoạn Đầu Đài `berserker_axe`; 3 vệ tinh Mặt Trời xoay quanh & vụ nổ Siêu Tân Tinh của `solar_archon_staff`; tia Railgun `[R]` của `focus_laser`; khối nham thạch lăn & 4 vòi dung nham của `magma_cannon`; cột thu lôi Đòn 3 của `thunder_hammer`.
  - Tạo 7 cảnh strip 8 frame (`ap2-wep-laser-railgun`, `ap2-wep-cleaver-boomerang`, `ap2-wep-void-implosion`, `ap2-wep-axe-guillotine`, `ap2-wep-solar-supernova`, `ap2-wep-magma-geysers`, `ap2-wep-hammer-thunder`) và cập nhật trang `ArtGalleryScene` hiển thị đúng 18 vũ khí độc bản.

- **`Task P1B.6` — Visual Gate & Phase Gate `P1B`:**
  - Chạy `pnpm shots -- --phase ap2-p1b --label after --group ap2-p1b`, chấm qua Visual Reviewer (`pro` `≥ 8.0/10`), chạy `pnpm verify` & `pnpm perf`. Tag `ap2-p1b`.

---

### PHASE P1C — Mở Rộng 3 Archetype Phòng Mới & Hệ Sinh Thái Tương Tác Biome 2 (Hầm Băng) + Biome 3 (Lò Rèn)
> **Tham chiếu Spec Rev 4:** Phần 2 (`2.1` — 3 Archetype còn lại: `CROSSFIRE_CONVEYORS`, `PRISM_LABYRINTH`, `CRUMBLING_PILLAR_RING`; `2.3` — Quy luật & Đồ chơi Biome 2 và Biome 3), Phần 7 (`7.3`).
> **Mục tiêu:** Hoàn thiện toàn bộ 6 Archetype hình học phòng chiến thuật và toàn bộ hệ sinh thái tương tác địa hình của cả 3 Biome.

#### Danh sách Task con của `Phase P1C`:
- **`Task P1C.1` — Cài Đặt 3 Archetype Phòng Chiến Thuật Tiếp Theo (`CROSSFIRE_CONVEYORS`, `PRISM_LABYRINTH`, `CRUMBLING_PILLAR_RING`) (`Section 2.1`):**
  - **Files:** `packages/shared/src/sim/arena-room-archetypes.ts`, `packages/shared/src/sim/arena-map.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **`CROSSFIRE_CONVEYORS` (Dây Chuyền Giao Lộ Tốc Độ Cao):** Hai làn Băng Chuyền / Luồng Gió / Dòng Chảy rộng 3 ô chạy song song (`ty: 6..8` chảy sang Đông, `ty: 13..15` chảy sang Tây), cuốn người chơi, quái vật và các Vật Chắn đang trượt đi với vận tốc `110 px/s`.
    2. **`PRISM_LABYRINTH` (Mê Cung Khúc Xạ So Le):** 5 bức tường chắn so le (`2×4` ô) bố trí dạng bàn cờ khắp phòng, xen kẽ là các `cryo_prism_pillar` / `rotten_totem_pillar` / `pneumatic_press`.
    3. **`CRUMBLING_PILLAR_RING` (Vòng Tròn Sáu Cột Sập):** 6 cây cột lớn (`2×2` ô) xếp thành hình lục giác quanh tâm phòng, kèm 4 Bia Chắn nằm giữa các khe cột. Khi cột đá bị bắn gãy hoặc có quái bị `Wall-Slam` đập vào, cột sập xuống đè bẹp một vùng dài `160px` và mở thông dần không gian phòng.
    4. Đảm bảo cả 3 Archetype đều áp dụng `FlipX/FlipY`, `Prop Jitter ±1..2` và `Door Clearance Guarantee`.

- **`Task P1C.2` — Cài Đặt Quy Luật Sinh Tồn & 3 Vật Thể Tương Tác Biome 2 (`Hầm Băng Vĩnh Cửu`) (`Section 2.3 Biome 2`):**
  - **Files:** `packages/shared/src/sim/sim-tactical-physics.ts`, `packages/shared/src/sim/sim-props-spawning.ts`, `packages/shared/src/sim/sim-projectiles.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **Luật Biome 2 ("Quán Tính Băng Vĩnh Cửu"):**
       - Trên mặt băng (`ice`), lực đẩy lùi (`Knockback`) lên quái vật và khoảng cách/vận tốc trượt của các vật thể (`Dash-Kick`) **tăng `+50%`**.
       - Mọi đòn `Wall-Slam` trong Biome 2 tự động phát xung áp **1 cộng dồn Lạnh (`Chill`)** lên kẻ địch trong bán kính `r=64px`.
    2. **3 Vật Thể Tương Tác Đặc Trưng Biome 2:**
       - **`glacial_barricade` (Phiến Băng Cổ Đại — *Bia Chắn Lật `[E]`*):** Lật bằng `[E]` tạo bia chắn băng (`65 HP`). Khi **`Dash-Kick` sút trượt đi** và đâm trúng quái/tường, phiến băng vỡ tung và **đóng cọc 3 Nhũ Băng Nhọn xuống sàn ($\text{Dmg}_{\text{Hazard}}$ + Đóng Băng `1.5s`, tồn tại `4.0s` làm cột chắn đạn, tuân thủ trần `MAX_TACTICAL_PROPS_PER_ROOM = 16`)**.
       - **`sliding_ice_block` (Khối Băng Trượt):** Dùng `Dash-Kick` hoặc Cận chiến sút khối băng trượt xuyên phòng (`600 px/s`), **nảy qua tường 1 lần như bi-a**, húc văng cả hàng quái.
       - **`cryo_prism_pillar` (Lăng Kính Pha Lê):** Khi bắn đạn (`splitGeneration === 0`) vào Lăng Kính, viên đạn **khúc xạ tách làm 3 tia hình quạt (`splitGeneration = 1`, `+20% Additive DMG`, tẩm `Lạnh`, gắn `SHOT_FLAG.DYNAMIC_BOUNCE`)** hướng về phía cụm quái đông nhất!

- **`Task P1C.3` — Cài Đặt Quy Luật Sinh Tồn & 3 Vật Thể Tương Tác Biome 3 (`Lò Rèn Dung Nham`) (`Section 2.3 Biome 3`):**
  - **Files:** `packages/shared/src/sim/sim-tactical-physics.ts`, `packages/shared/src/sim/sim-props-spawning.ts`, `packages/shared/src/sim/sim-weapon-cadence.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **Luật Biome 3 ("Nhịp Đập Lò Nung"):**
       - Các dải **Băng Chuyền Thép (`conveyor`)** tự động đảo chiều đồng bộ theo **Chu Kỳ Nhà Máy mỗi `8.0s`** (có trạng thái `conveyorWarningTimer = 1.2s` nhấp nháy đèn mũi tên cảnh báo trước khi đổi chiều).
       - Trong Biome 3, vũ khí `HEAT_VENT` tăng nhiệt nhanh hơn `+15%`, nhưng **Xung Xả Áp `[R]` (`Tactical Vent`) có bán kính rộng gấp rưỡi (`r=110px`)**.
    2. **3 Vật Thể Tương Tác Đặc Trưng Biome 3:**
       - **`forge_blast_shield` (Tấm Chắn Thép Phản Nhiệt — *Bia Chắn Lật `[E]`*):** Lật bằng `[E]` tạo khiên thép `85 HP`. Khi **`Dash-Kick` sút tấm chắn đi**, nó lao dọc sàn và phóng kèm **Cơn Sóng Lửa rộng `88px`**.
       - **`pneumatic_press` (Búa Máy Dập Khuôn Cảm Biến):** Đặt giữa phòng/băng chuyền (`Cooldown = 4.0s`). Khi người chơi **`Dash-Kick` một vật chắn / quái vật trượt vào khung búa** (hoặc khi quái/Boss bước vào tâm cảm biến), Búa Máy dập xuống sau `0.35s` gây $\text{Dmg}_{\text{Hazard}}$ nghiền quái & phá giáp Boss (chỉ đẩy nhẹ người chơi ra mép, gây `0` sát thương lên người chơi).
       - **`slag_crucible` (Nồi Nung Xỉ Nóng Chảy):** Khi `Dash-Kick` hoặc bắn vỡ, nồi nung đổ tràn **Thảm Dung Nham dài `192px`** thiêu đốt hàng quái.

- **`Task P1C.4` — Bake Texture Procedural & VFX Cho Archetypes + Props Biome 2 & Biome 3 (`texture-baker-props.ts`, `texture-baker-surfaces.ts`, `room-entities-sync.ts`):**
  - Vẽ 3 trạng thái `'low' | 'flipped' | 'sliding'` cho `glacial_barricade` (băng pha lê vát cạnh) và `forge_blast_shield` (thép tán đinh viền đồng thau nóng đỏ).
  - Vẽ 3 cọc nhũ băng nhọn đóng xuống sàn, `sliding_ice_block`, `cryo_prism_pillar` (lăng kính phát quang cyan khúc xạ tia), `pneumatic_press` (khung búa máy công nghiệp có vòng cảm biến + piston dập xuống), `slag_crucible` (nồi gang nung xỉ đỏ rực), và đèn mũi tên cảnh báo đảo chiều `1.2s` trên `conveyor`.

- **`Task P1C.5` — Xây Dựng Cảnh Chụp & Strip 8-Frame Cho Biome 2 & Biome 3 (`visual-scene-ap2-p1.ts`):**
  - Tạo các cảnh chụp tĩnh & strip (`ap2-b2-prism-labyrinth`, `ap2-b2-glacial-kick-spikes` strip, `ap2-b2-prism-refract` strip, `ap2-b3-crossfire-conveyors`, `ap2-b3-pneumatic-press-crush` strip, `ap2-b3-blast-shield-wave` strip, `ap2-crumbling-pillar-ring` strip).
  - Đo `metrics.json` cho các phòng mới ở Biome 2 và Biome 3 để đảm bảo giữ nguyên chuẩn Golden Room (`ΔL*` vùng tâm `<= 8`, không vật thể trang trí nào gây nhầm lẫn với prop thật). **Lưu ý:** Với các cảnh có tường chắn so le hoặc búa máy/băng chuyền nằm ngay trung tâm phòng (`ap2-b2-prism-labyrinth`, `ap2-b3-crossfire-conveyors`, `ap2-b3-pneumatic-press-crush`), bắt buộc truyền `sampleRects` tùy chỉnh đặt `floor_center` vào vùng sàn đi bộ thông thoáng để không đo trùng lên tường chắn/búa máy.

- **`Task P1C.6` — Visual Gate & Phase Gate `P1C`:**
  - Chạy `pnpm shots -- --phase ap2-p1c --label after --group ap2-p1c` + `visual-metrics.ts`, chấm qua Visual Reviewer (`pro` `≥ 8.0/10`), chạy `pnpm verify` & `pnpm perf`. Tag `ap2-p1c`.

---

### PHASE P1D — Hệ Thống 26 Thẻ Nâng Cấp Cốt Lõi (16 Action Blessings + 10 Character Skill Upgrades)
> **Tham chiếu Spec Rev 4:** Phần 4 (`4.1`, `4.2` — 16 thẻ `Phase 1`, `4.3` — 10 thẻ Nâng cấp Kỹ năng Nhân vật).
> **Mục tiêu:** Thay thế hoàn toàn các buff cộng chỉ số cũ bằng **26 Thẻ Phước Lành Hành Động & Kỹ Năng Nhân Vật** biến đổi trực tiếp thao tác `Lật bàn [E] / Dash-Kick / Wall-Slam / Lướt Shift / Nạp [R] / Đạn nảy`, lưu trữ độc lập theo từng người chơi (`Per-Player`).

#### Danh sách Task con của `Phase P1D`:
- **`Task P1D.1` — Kiến Trúc Dữ Liệu Phước Lành & Nhóm 1: 4 Phước Lành Lật Chắn & Phá Địa Hình (`Barricade / Table Techs` — `Section 4.2 Group 1`):**
  - **Files:** Tạo mới `packages/shared/src/data/blessings.ts` và `packages/shared/src/sim/sim-blessings.ts`, kết nối vào `packages/shared/src/sim/sim-tactical-physics.ts`.
  - **Chi tiết thực hiện (TDD):**
    - Mọi thẻ Nhóm 1 kích hoạt cả khi **Lật Chắn `[E]` / `Dash-Kick` Chắn** lẫn khi kích hoạt **`Wall-Slam` / Đầy thanh `bossStaggerAccum`**, sát thương tính qua `scaleBlessingDamage(baseDmg, F)`:
    1. **`table_tech_rocket` (`Lửa`):** Nhấn `[E]` Lật Chắn giữ nguyên tấm chắn che đạn và phóng **2 Tên Lửa Tầm Nhiệt (`base 26 DMG Lửa/quả`)**. Khi `Dash-Kick` vào tấm chắn, nó hóa thành **Đầu Đạn Phản Lực (`620 px/s`)** phát nổ `base 60 DMG Lửa` (`r=104px`).
    2. **`table_tech_blank_nova` (`Băng`):** Khoảnh khắc Lật Chắn `[E]` (hoặc khi kích nổ `Wall-Slam` trên Tinh Anh/Boss), vòng xóa đạn mở rộng thành **`r=160px`** và **Đóng Băng `1.5s`** mọi kẻ địch trong bán kính đó.
    3. **`table_tech_prism_split` (`Sét`):** Tấm chắn do bạn lật lên tỏa hào quang xanh: mọi viên đạn (`splitGeneration === 0`) của bạn và đồng đội bắn xuyên qua tấm chắn sẽ **tách thành 2 tia (`splitGeneration = 1`, `+20% Additive DMG`, tẩm `Sét`, gắn `DYNAMIC_BOUNCE`)**.
    4. **`table_tech_billiard_master` (`Vật lý`):** Mọi tấm chắn, thùng nổ và khối băng do bạn `Dash-Kick` có vận tốc tăng `+35%`, **nảy qua tường tối đa 3 lần như bi-a** và gây thêm **`+40%` sát thương `Wall-Slam` / `bossStaggerAccum`**.

- **`Task P1D.2` — Nhóm 2 (`Dash Techs` — 4 Thẻ Core) & Nhóm 3 (`Reload, Vent & Finisher Techs` — 4 Thẻ Core) (`Section 4.2 Group 2 & 3`):**
  - **Files:** `packages/shared/src/data/blessings.ts`, `packages/shared/src/sim/sim-blessings.ts`, `packages/shared/src/sim/sim-player.ts`, `packages/shared/src/sim/sim-weapon-cadence.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **Nhóm 2 — 4 Thẻ Biến Đổi Cú Lướt (`Dash Techs`):**
       - **`dash_tidal_ram` (`Băng`):** Cú Lướt bọc sóng băng húc văng quái nhỏ/vừa trên đường lướt (`Knockback = 280`, `base 20 DMG Băng`). Nếu quái bị húc đập vào tường (`Wall-Slam`), **hồi 60% hồi chiêu Lướt** (`ICD 1.2s`).
       - **`dash_venom_wake` (`Độc`):** Lướt để lại dải Đầm Thủy Ngân Độc (`3.5s`). Nếu đường lướt cắt qua ít nhất 1 kẻ địch hoặc thực hiện `Dash-Kick`, **lập tức Nạp 50% Băng đạn / Giảm 40% Nhiệt**.
       - **`dash_flame_shackle` (`Lửa`):** Khi Lướt qua gần kẻ địch (`trong 88px`), phóng sợi xích lửa **kéo giật con quái đó đập thẳng vào bức tường hoặc Bia Chắn gần nhất (`Wall-Slam` tức thì + `base 24 DMG Lửa`)**.
       - **`dash_reload_acrobat` (`Vật lý`):** Lướt (`Dash`) trong khi đang Nạp đạn hoặc có Nhiệt `>= 50%` sẽ **tua nhanh `40%` tiến độ nạp / hạ `35%` Nhiệt** VÀ **mở rộng Khung Vàng `[R]` kế tiếp gấp rưỡi (`35%–80%`)**!
    2. **Nhóm 3 — 4 Thẻ Nạp Nhịp, Xả Áp & Đòn Kết Combo (`Reload, Vent & Finisher Techs`):**
       - *Điều kiện kích hoạt nghiêm ngặt:* Chỉ kích hoạt khi bấm trúng **`Perfect Reload [R]`**, **`Tactical Vent [R]`**, hoặc khi **Đòn Thứ 3 của `MELEE_COMBO` chém trúng ít nhất 1 kẻ địch / Parry trúng ít nhất 1 viên đạn** (tuyệt đối không kích hoạt khi chém vào không khí; `ICD = 1.5s` cho súng và `ICD = 2.0s` cho cận chiến):
       - **`reload_tediore_chuck` (`Lửa`):** Ném thẳng vỏ băng đạn / lõi nhiệt cũ về phía con trỏ chuột (`520 px/s`), nổ **`base (18 + 4 × số đạn đã bắn) DMG Lửa`**.
       - **`reload_frost_nova` (`Băng`):** Phóng vòng băng giá (`r=110px`, `base 22 DMG Băng`), áp **2 tầng Lạnh (`Chill`)** và xóa đạn địch sát người.
       - **`reload_magnet_vortex` (`Sét`):** Bắn mỏ neo từ trường về phía trước `140px`, **hút gom các quái xung quanh chụm lại** trong `0.8s`.
       - **`reload_repulsor_shock` (`Vật lý`):** Phóng sóng xung kích hình nón `140°` (`r=165px`), **hất văng kẻ địch đang dính trạng thái nguyên tố đập vào tường (`Knockback = 260`, `Wall-Slam`)**.

- **`Task P1D.3` — Nhóm 4 (`Geometry & Co-op Bullet Mods` — 4 Thẻ Core) & 10 Thẻ Nâng Cấp Kỹ Năng Nhân Vật (`Section 4.2 Group 4 & Section 4.3`):**
  - **Files:** `packages/shared/src/data/blessings.ts`, `packages/shared/src/sim/sim-blessings.ts`, `packages/shared/src/sim/sim-skills-mechanics.ts`, `packages/shared/src/sim/sim-projectiles.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **Nhóm 4 — 4 Thẻ Hình Học Đạn Đạo & Đồng Đội:**
       - **`bullet_split_bounce` (`Vật lý`):** Đạn nhận `+1 lần nảy tường`. Khi viên đạn gốc (`splitGeneration === 0`) chạm tường, cột đá hoặc Bia Chắn lần đầu tiên, tách đôi thành **2 viên đạn con (`splitGeneration = 1`, mỗi viên gây `70% DMG` gốc)** bay theo góc chữ V (gắn cờ `DYNAMIC_BOUNCE`).
       - **`bullet_ricochet_boom` (`Lửa`):** Mỗi khi đạn nảy qua tường hoặc vật chắn, tại điểm va chạm phát nổ **Xung Lửa (`base 24 DMG × procCoeff`, `r=64px`, `Knockback = 200`, `ICD = 0.20s`)** hất văng quái đứng gần tường.
       - **`bullet_heavy_pinball` (`Vật lý`):** Đạn và đòn đánh tăng **`+50%` Lực Đẩy Lùi (`Knockback`)**. Kẻ địch bị đẩy đập vào tường (`Wall-Slam`) sẽ **nảy bật ngược lại**, nếu va vào quái khác sẽ làm cả hai cùng Choáng `0.8s`.
       - **`bullet_coop_arc_relay` (`Sét`):** Khi đạn hoặc nhát chém đi ngang qua **Đồng Đội, Summon hoặc Bia Chắn Đã Lật (`trong 56px`)**, thực thể đó **phóng tia Sét (`base 20 DMG × procCoeff`, `ICD = 0.30s`)** vào kẻ địch gần nhất.
    2. **10 Thẻ Nâng Cấp Kỹ Năng Nhân Vật (`Character Skill Upgrades`):**
       - `vanguard`: `vanguard_bastion_prism` (Khiên `160°`, phản đạn địch thành đạn Lửa `base 20 DMG`, tách đôi đạn đồng minh `splitGeneration: 0 -> 1`) & `vanguard_charge` (Tái nhấn `SKILL` lao tới `130px` húc quái `Wall-Slam`).
       - `ranger`: `ranger_arrow_volley` (5 mũi tên quạt, cắm tường phát nổ & đánh dấu quái) & `ranger_prey_chain` (Nối dây xích đỏ giữa các mục tiêu bị Đánh Dấu trong `220px`, chia sẻ 35% sát thương và kéo cả đám bay theo khi 1 con bị `Knockback`).
       - `elementalist`: `elementalist_vortex` (Vùng Cầu Nguyên Tố hút quái và Thùng Nổ/Bào Tử trong `150px` vào tâm) & `elementalist_twin_orbit` (Ném 2 vùng nguyên tố cách nhau `160px` nối ở giữa bằng Tia Cắt Phản Ứng `base 24 DMG/s`).
       - `druid`: `druid_poison_roots` (Mỗi `1.8s` Cây Thiêng phóng rễ gai quật quái vào tường gần nhất `Wall-Slam`) & `druid_sacred_grove` (Trồng 2 Cây Thiêng cùng lúc; đạn cả đội bắn qua tán cây nhận `+1 Smart Bounce`).
       - `engineer`: `engineer_twin_turrets` (Đặt 2 Trụ Tesla căng Hàng Rào Laser Sét làm chậm 50%) & `engineer_self_destruct` (Tái nhấn `SKILL` hoặc hết giờ biến Trụ Tesla thành Robot Cảm Tử lao vào cụm quái nổ `base 45 DMG Lửa + Sét`, `r=130px`).
    3. Viết unit test kiểm chứng rút thẻ qua 6 tầng cho 4 người chơi: mỗi người chơi chỉ nhận thẻ nâng cấp kỹ năng của đúng Class mình đang chơi + 16 thẻ Action Blessings chung, không bao giờ lặp thẻ đã có và không bao giờ cạn bể thẻ.

- **`Task P1D.4` — Cập Nhật Giao Diện Modal Chọn Phước Lành (`Per-Player`) & VFX Cho 26 Thẻ (`hud-modals-and-debug.ts`, `combat-fx-weapons-v2.ts`, `vi.json`, `en.json`):**
  - Hiển thị rõ Nhóm Phước Lành (`[Chắn Chiến]`, `[Lướt Chiến]`, `[Nhịp Nạp]`, `[Đạn Đạo]`, `[Tuyệt Kỹ Class]`), biểu tượng nguyên tố, mô tả súc tích không tràn khung ở cả tiếng Việt và tiếng Anh, và dải icon Phước lành cá nhân trên HUD.

- **`Task P1D.5` — Xây Dựng Cảnh Chụp Modal Phước Lành & Strip 8-Frame Cho Các Phước Lành Tiêu Biểu (`visual-scene-ap2-p1.ts`):**
  - Tạo các cảnh `ap2-modal-blessing-vi`, `ap2-modal-blessing-en`, `ap2-blessing-table-rocket` (strip), `ap2-blessing-prism-split` (strip), `ap2-blessing-tediore-chuck` (strip), `ap2-skill-vanguard-prism` (strip), `ap2-skill-elementalist-twin` (strip).

- **`Task P1D.6` — Visual Gate & Phase Gate `P1D`:**
  - Chạy `pnpm shots -- --phase ap2-p1d --label after --group ap2-p1d`, chấm qua Visual Reviewer (`pro` `≥ 8.0/10`), chạy `pnpm verify` & `pnpm perf`. Tag `ap2-p1d`.

---

### PHASE P2A — Đồ Thị Phòng Động, Phòng Bí Mật Nứt Tường, Đe Rèn Cổ Đại (`6 Core Mutators`) & Kinh Tế Phân Rã Súng (`Weapon Salvage`)
> **Tham chiếu Spec Rev 4:** Phần 1 (`1.1 #4 & #5`), Phần 4 (`4.4` — 6 Core Mutators), Phần 5 (`5.2A & 5.2B`), Phần 8 (`Phase 2`).
> **Mục tiêu:** Thay thế hoàn toàn phòng bí mật cố định ở `(3,2)` và giải đố bàn đạp nam châm bằng Đồ thị phòng động theo Tầng Lẻ/Chẵn, Tường Nứt mở bằng `Dash-Kick / Wall-Slam`, Xưởng Rèn Kho Báu gắn `Weapon Mutator`, và cơ chế Giữ `[X]` `0.5s` Phân Rã Vũ Khí.

#### Danh sách Task con của `Phase P2A`:
- **`Task P2A.1` — Đại Tu Đồ Thị Phòng (`dungeon-gen.ts`) & Phòng Bí Mật Động (`Dynamic Secret Room`) (`Section 1.1 #4 & Section 5.2A`):**
  - **Files:** `packages/shared/src/sim/dungeon-gen.ts`, `packages/shared/src/sim/sim-dungeon-rooms.ts`, `packages/shared/src/sim/sim-props-spawning.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. Xóa bỏ hoàn toàn đoạn gắn cứng phòng `secret` ở tọa độ `(3,2)` phía Bắc phòng `start` và 2 thùng nổ đặt sẵn trước cửa phòng bí mật (`dungeon-gen.ts:198-212`, `sim-props-spawning.ts:25-26`).
    2. Cấu trúc lại đồ thị phòng theo **Tầng Lẻ (`localFloor === 1`: Tầng 1, 3, 5)** và **Tầng Chẵn (`localFloor === 2`: Tầng 2, 4, 6)**:
       - **Ở Tầng Lẻ (`1, 3, 5`):** Sinh `9–10 phòng` gồm `1 start`, **`1 shrine` (Tế Đàn Khế Ước nằm ở `distanceFromStart = 1`)**, `4 combat` (3 chuẩn + 1 Tinh Anh), `1 treasure` (Rương + **Đe Rèn Cổ Đại** gắn `Weapon Mutator`), `1 merchant`, `1 secret`, `1 portal`.
       - **Ở Tầng Chẵn (`2, 4, 6`):** **Không có phòng `shrine`** (thay bằng 1 phòng `combat` để duy trì áp lực trước Boss), phòng `treasure` đặt Rương + **Bàn Tinh Luyện Vũ Khí (`Weapon Upgrade Anvil`)**, và kết thúc bằng phòng `boss`.
    3. **Phòng Bí Mật Động (`Dynamic Secret Room`):** Gắn ngẫu nhiên theo `seed` vào một cạnh trống của phòng `treasure`, `merchant` hoặc `combat` cuối nhánh. Bức tường nối vào phòng `secret` hiển thị vết nứt kín đáo (**`Cracked Secret Wall`**) và có đặt 1–2 thùng nổ/vật chắn trong phòng đó để người chơi dùng **`Dash-Kick` Thùng Nổ / Vật Chắn hoặc `Wall-Slam` quái đập vào tường nứt** làm sập lối đi bí mật! Bên trong phòng `secret` đặt **1 Rương Vũ Khí Hiếm (`Rare/Epic`) + 2 Cụm Tinh Thể Vàng (`+30 Gold`)**.
    4. Viết unit test kiểm chứng `verifyDungeonConnectivity() === true` trên **1,000 seeds ngẫu nhiên** cho cả 6 tầng (`globalFloor = 1..6`), đảm bảo phòng `shrine` chỉ xuất hiện ở Tầng 1, 3, 5.

- **`Task P2A.2` — Cài Đặt Xưởng Rèn Kho Báu & 6 Bản Độ Búa Rèn Cốt Lõi (`Daedalus Weapon Mutators` — `Section 1.1 #5 & Section 4.4 #1–#6`):**
  - **Files:** Tạo mới `packages/shared/src/data/ashen-pacts.ts` và `packages/shared/src/sim/sim-ashen-pacts.ts`, cập nhật `packages/shared/src/sim/sim-dungeon-rooms.ts`, `packages/shared/src/sim/sim-weapon-cadence.ts`, `packages/shared/src/protocol/messages.ts`, `packages/shared/src/protocol/network-transport.ts`, `apps/server/src/rooms/CoopRoom.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. Xóa bỏ hoàn toàn cơ chế giải đố bàn đạp + cục đá tự hút nam châm ở phòng `treasure` (`sim-dungeon-rooms.ts:222-251`, `sim-enemies-core.ts:55-73`).
    2. Thay bằng **Xưởng Rèn Kho Báu**: Đặt 1 Rương Vũ Khí + **1 Đe Rèn Cổ Đại (`daedalus_anvil`)** ở Tầng Lẻ (mỗi người chơi tương tác `[E]` được chọn 1 trong 2 `Weapon Mutator` miễn phí tương thích với vũ khí đang cầm, tối đa 2 Mutator/khẩu súng; đồng bộ gói tin `select_mutator` qua `messages.ts`, `network-transport.ts` và `CoopRoom.ts` tra `const meta = this.playersBySession.get(client.sessionId)` để gắn đúng vào `meta.playerId`) hoặc **Bàn Tinh Luyện Vũ Khí (`upgrade_anvil`)** ở Tầng Chẵn (nâng `upgradeLevel + 1` $\to$ `+20% Base DMG`).
    3. Cài đặt đầy đủ **6 Core Weapon Mutators**:
       - **`mutator_finale_jolt`:** Tăng `+20%` tốc độ bắn. Khi bắn `Finale Shot` hoặc `Tactical Vent [R]`, súng xả chùm 3 tia (`+40% Additive DMG`) và đẩy người chơi lướt lùi nhẹ `48px` (**bắt buộc kẹp an toàn không lùi rơi xuống ô `chasm`**!).
       - **`mutator_gravity_singularity`:** `Finale Shot` hoặc phát bắn đầu sau `Perfect Reload / Vent [R]` biến kẻ địch trúng đạn thành **Mỏ Neo Trọng Lực trong `1.8s`**, hút quái và thùng nổ trong `140px` chụm vào nó.
       - **`mutator_shockwave_edge` *(Chỉ cho Cận chiến)*:** Tăng `+30%` tầm vung và mỗi đòn chém đều phóng kèm một **Lưỡi Kiếm Khí tầm ngắn `180px` (`60% DMG`)**.
       - **`mutator_chain_harpoon` *(Chỉ cho Súng tầm xa)*:** `Finale Shot` hoặc phát bắn sau `Perfect Reload` gắn dây xích **kéo giật kẻ địch trúng đạn va vào tấm Bia Chắn hoặc bức tường gần nhất (`Wall-Slam`)**.
       - **`mutator_prism_splitter`:** Giảm `20%` sát thương đơn lẻ nhưng mọi phát bắn tách thành **3 tia song song** (tuân thủ trần `MAX_PELLETS_PER_TRIGGER = 9`).
       - **`mutator_thermal_meltdown`:** Mở rộng vùng Nhiệt Cam / Khung Vàng Nạp Đạn thêm `+25%`; đạn bắn trong trạng thái cường hóa **xuyên thẳng qua khiên của quái `iron_shielder`**.

- **`Task P2A.3` — Cơ Chế Giữ Phím `DROP_WEAPON` (`0.5s`) Phân Rã Vũ Khí (`Weapon Salvage`) & Kinh Tế Thương Nhân (`Section 5.2B`):**
  - **Files:** `packages/shared/src/sim/sim-ashen-pacts.ts`, `packages/shared/src/sim/sim-player.ts`, `packages/shared/src/sim/sim-dungeon-rooms.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **Phân Rã Vũ Khí (`Weapon Salvage` — Không đụng tới phím `[R]`):**
       - Khi phòng đã sạch quái (`enemies.length === 0`), người chơi đứng gần một vũ khí rơi trên mặt đất (`dist <= 48px`, không phải vũ khí bán có giá ở Merchant) và **giữ phím `DROP_WEAPON` (`[X]`) liên tục trong `0.50s` (`30 ticks`)**:
       - Khẩu súng trên đất bị phân rã thành tia lửa vàng và cộng ngay Vàng cá nhân vào `p.gold` của người chơi đó (hoặc cộng cho mỗi người chơi trong phòng nếu là súng rơi từ rương chung chưa ai nhặt): **`Common = 10G`, `Uncommon = 15G`, `Rare = 22G`, `Epic = 30G`, `Legendary = 45G`**.
       - *(Nếu chỉ bấm nhả nhanh `DROP_WEAPON` `< 0.25s` hoặc đang đứng xa súng dưới đất: thực hiện hành động vứt vũ khí đang cầm trên tay ra đất như bình thường).*
    2. **Thưởng Dọn Phòng Không Mất Máu (`Flawless Room Bonus`):** Khi dọn sạch phòng `combat`, mọi người chơi không bị mất HP hoặc Giáp trong phòng đó nhận thưởng **`+10 Gold`** kèm popup `+10 VÀNG HOÀN HẢO!`.
    3. **Chuẩn hóa Bảng Giá Thương Nhân (`Cost = round(base * (1 + 0.10 * (globalFloor - 1)))`):**
       - Bình Huyết Dược (`+3 HP`) / Tinh Thể Giáp (`+1 MaxArmor`): `Base 32 Gold`.
       - Rương Vũ Khí Đánh Cược: `Base 55 Gold`.
       - Thẻ Phước Lành Hành Động (`Action Blessing`): `Base 68 Gold`.
       - Tinh Luyện Vũ Khí (`Upgrade Weapon Level +1` $\to$ `+20% Base DMG`): `Base 75 Gold`.

- **`Task P2A.4` — Giao Diện Modal Đe Rèn Cổ Đại, Vòng Tiến Độ Giữ `[X]` Phân Rã Súng & Bake Texture Đe Rèn / Tường Nứt (`hud-pact-and-forge-modals.ts`, `interact-prompt.ts`, `texture-baker-props.ts`):**
  - Tạo mới `apps/client/src/scenes/game-scene/hud-pact-and-forge-modals.ts` để vẽ Modal chọn `Weapon Mutator` khi tương tác với Đe Rèn Cổ Đại.
  - Trên prompt tương tác vũ khí dưới đất (ngoài giao tranh), hiển thị dòng phụ `[E] Nhặt · Giữ [X] 0.5s Phân Rã (+15G)` kèm thanh tiến độ điền đầy mượt mà khi người chơi đang giữ phím `[X]`.
  - Bake texture procedural cho **Đe Rèn Cổ Đại (`daedalus_anvil`)** có búa rèn phát quang rune vàng cam và **Tường Nứt Bí Mật (`cracked_secret_wall`)** có khe sáng lấp lánh nhẹ.

- **`Task P2A.5` — Xây Dựng Cảnh Chụp Kiểm Chứng Đe Rèn, Tường Nứt & Phân Rã Súng (`tests/e2e/helpers/visual-scene-ap2-p2.ts`):**
  - Tạo các cảnh `ap2-treasure-forge-workshop`, `ap2-modal-daedalus-mutator`, `ap2-weapon-salvage-hold` (strip 8 frame giữ `[X]` phân rã súng bung hạt vàng), `ap2-secret-wall-crack-break` (strip 8 frame `Dash-Kick` thùng nổ phá vỡ tường nứt mở phòng Bí Mật).

- **`Task P2A.6` — Visual Gate & Phase Gate `P2A`:**
  - Chạy `pnpm shots -- --phase ap2-p2a --label after --group ap2-p2a`, chấm qua Visual Reviewer (`pro` `≥ 8.0/10`), chạy `pnpm verify` & `pnpm perf`. Tag `ap2-p2a`.

---

### PHASE P2B — Hệ Thống "Khế Ước Tro Tàn" (`1 Tế Đàn / Biome — Full-Biome Trial`) & 6 Di Vật Thức Tỉnh (`Awakened Ashen Relics`)
> **Tham chiếu Spec Rev 4:** Phần 5 (`5.1` — Tế Đàn Khế Ước Tro Tàn & Bảng 6 Khế Ước / 6 Di Vật Thức Tỉnh).
> **Mục tiêu:** Cài đặt hệ thống đánh đổi sinh tử thực sự kéo dài xuyên suốt toàn bộ 2 tầng của Biome (bao gồm cả trận đánh Boss Biome) và phần thưởng thức tỉnh Di Vật Tro Tàn.

#### Danh sách Task con của `Phase P2B`:
- **`Task P2B.1` — Vòng Đời Tế Đàn Khế Ước (`1 Tế Đàn / Biome`) & Chuyển Hóa Khi Hạ Boss Biome (`Section 5.1`):**
  - **Files:** `packages/shared/src/data/ashen-pacts.ts`, `packages/shared/src/sim/sim-ashen-pacts.ts`, `packages/shared/src/sim/sim-dungeon-rooms.ts`, `packages/shared/src/sim/sim-enemies-core.ts`, `packages/shared/src/protocol/messages.ts`, `packages/shared/src/protocol/network-transport.ts`, `apps/server/src/rooms/CoopRoom.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. Tại phòng `shrine` ở Tầng 1 của mỗi Biome (`globalFloor = 1, 3, 5`), mỗi người chơi tương tác `[E]` với **Tế Đàn Khế Ước Tro Tàn** sẽ nhận 2 lựa chọn Khế Ước rút ngẫu nhiên từ bể 6 Khế Ước (loại trừ các Khế Ước người đó đã lấy ở các Biome trước) hoặc chọn "Khước Từ". Đồng bộ gói tin `select_pact` qua `messages.ts`, `network-transport.ts` và `CoopRoom.ts` (tra `const meta = this.playersBySession.get(client.sessionId)` để áp dụng `selectAshenPact` độc lập cho đúng `meta.playerId`).
    2. Ngay khi ký Khế Ước, `p.activePactId` được kích hoạt và **kéo dài xuyên suốt toàn bộ các phòng của Tầng Lẻ (`localFloor = 1`), giữ nguyên khi bước qua cổng sang Tầng Chẵn (`localFloor = 2`), và áp dụng trong suốt trận đánh Boss cuối Biome (`globalFloor = 2, 4, 6`)**!
    3. Ngay khoảnh khắc Boss cuối Biome bị tiêu diệt (`onBossDefeated`), mọi người chơi đang mang `p.activePactId !== null` được **Thanh Tẩy Khế Ước**: xóa `p.activePactId = null`, thêm Di Vật tương ứng vào `p.awakenedRelicIds`, phát banner + âm thanh thức tỉnh hào hùng!

- **`Task P2B.2` — Cài Đặt 3 Khế Ước & Di Vật Đầu Tiên: `pact_soul_chain`, `pact_shattered_glass`, `pact_searing_trigger` (`Section 5.1 #1–#3`):**
  - **Files:** `packages/shared/src/sim/sim-ashen-pacts.ts`, `packages/shared/src/sim/sim-player.ts`, `packages/shared/src/sim/sim-weapon-cadence.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **`pact_soul_chain` (Khế Ước Xiềng Xích Linh Hồn $\to$ Di Vật: Dây Cắt Huyết Thệ):**
       - *Thử thách suốt Biome:* Nối **Dây Xích Năng Lượng Mềm** giữa bạn và Đồng Đội gần nhất (hoặc nối vào **Kẻ Địch đang sống có `maxHp` cao nhất trong phòng** khi chơi Solo). Nếu đứng cách mục tiêu nối dây **quá `260px` lâu hơn `2.5s`**, cứ mỗi `2.5s` bị **rút `1 Giáp`** (không trừ vào HP).
       - *Di Vật Thức Tỉnh (`relic_blood_oath_tether`):* Xóa hình phạt rút giáp! Giữa bạn và đồng đội (hoặc kẻ địch gần nhất trong `260px` khi Solo) luôn căng một **Tia Laser Lửa-Sét (`base 22 DMG/s`)** đốt cháy mọi quái vật đi cắt ngang.
    2. **`pact_shattered_glass` (Khế Ước Thân Xác Thủy Tinh $\to$ Di Vật: Trái Tim Pha Lê Đen):**
       - *Thử thách suốt Biome:* **Giáp tối đa (`maxArmor`) giảm đi `50%` (làm tròn xuống, tối thiểu còn `1 Giáp`)**, đổi lại nhận `+20%` Tốc độ di chuyển.
       - *Di Vật Thức Tỉnh (`relic_black_crystal_heart`):* Khôi phục lại `maxArmor` gốc (nhưng thời gian chờ hồi Giáp chậm hơn `+0.8s`). Đổi lại, phát bắn đầu tiên sau mỗi lần **`Perfect Reload / Vent [R]`** (hoặc Đòn 3 Cận chiến) nhận **`+65% Additive Damage`** và xuyên khiên.
    3. **`pact_searing_trigger` (Khế Ước Cò Súng Nóng Bỏng $\to$ Di Vật: Lõi Động Cơ Vĩnh Cửu):**
       - *Thử thách suốt Biome:* Nếu bấm **`[R]` trượt ngoài Khung Vàng** hoặc để vũ khí **Quá Nhiệt chạm `100%`**, súng giật lửa làm bạn **mất `1 Giáp` và khóa cò thêm `0.4s`**.
       - *Di Vật Thức Tỉnh (`relic_perpetual_core`):* Xóa mức phạt giật giáp và khóa cò. Khung Vàng `[R]` mở rộng thêm `+25%`, và mỗi khi thực hiện **`Perfect Reload / Vent [R]`**, từ lưng bạn tự động phóng **3 Quả Tên Lửa Tro Tàn (`base 20 DMG Lửa/quả`)**.

- **`Task P2B.3` — Cài Đặt 3 Khế Ước & Di Vật Còn Lại: `pact_volatile_arsenal`, `pact_ashen_hunted`, `pact_ricochet_vow` (`Section 5.1 #4–#6`):**
  - **Files:** `packages/shared/src/sim/sim-ashen-pacts.ts`, `packages/shared/src/sim/sim-enemies-core.ts`, `packages/shared/src/sim/sim-projectiles.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **`pact_volatile_arsenal` (Khế Ước Loạn Đao Hoán Vũ $\to$ Di Vật: Ấn Rèn Bậc Thầy):**
       - *Thử thách suốt Biome:* Lưu lại `p.pactOriginalWeaponId` của súng đang cầm. Cứ mỗi khi **dọn xong 1 đợt quái (`Wave`) hoặc mỗi `20.0s` trong phòng Boss**, ô súng đó tự động biến hình ngẫu nhiên thành một vũ khí khác theo độ hiếm của Biome hiện tại (`Biome 1: Common..Rare`, `Biome 2: Uncommon..Epic`, `Biome 3: Rare..Legendary`).
       - *Di Vật Thức Tỉnh (`relic_master_forge_seal`):* Chấm dứt biến hình ngẫu nhiên, **khôi phục lại `pactOriginalWeaponId`** (hoặc giữ khẩu súng hiện tại nếu người chơi nhấn `[E]` xác nhận trong 5s), đồng thời vũ khí đó được **Nâng Cấp Bậc Tinh Luyện `Level +1` (`+20% Base DMG`) VÀ gắn miễn phí `+1 Bản Độ Búa Rèn` (`Weapon Mutator`)**.
    2. **`pact_ashen_hunted` (Khế Ước Tử Thần Truy Sát $\to$ Di Vật: Lưỡi Hái Đao Phủ):**
       - *Thử thách suốt Biome:* Trong mọi phòng giao tranh và phòng Boss của Biome này, xuất hiện **tối đa 1 Bóng Ma Đao Phủ (`ashen_executioner`, bất tử, bay xuyên địa hình)** cho cả phòng, đi bộ truy đuổi và chém sóng lửa về phía người ký (nếu nhiều người cùng ký, Đao Phủ nhận `+20%` Tốc chạy và đổi mục tiêu giữa những người đã ký mỗi `6.0s`), chỉ biến mất khi phòng được dọn sạch.
       - *Di Vật Thức Tỉnh (`relic_executioner_scythe`):* Bóng Ma Đao Phủ quy phục bạn! Mỗi khi bạn dùng **Kỹ năng Nhân vật** hoặc kích hoạt **`Wall-Slam`** (`ICD = 4.0s`), Đao Phủ hiện ra chém nhát **Lưỡi Hái Chữ Thập (`base 45 DMG`)** kết liễu ngay quái thường có máu `<= 20%`.
    3. **`pact_ricochet_vow` (Khế Ước Đạn Đạo Phản Chiếu $\to$ Di Vật: Con Mắt Hình Học Cổ Đại):**
       - *Thử thách suốt Biome:* Đạn bắn thẳng trực tiếp vào quái (`bounceCount === 0`) bị **giảm `35%` sát thương**; nhưng đạn **sau khi nảy qua tường/bia chắn (`bounceCount >= 1`)** hoặc sát thương từ **`Wall-Slam` / Đồ Chơi Phòng** nhận **`+70% Additive Damage`** và `+1 lần nảy`.
       - *Di Vật Thức Tỉnh (`relic_ancient_geometry_eye`):* Giảm mức phạt bắn thẳng xuống chỉ còn `-10%`, đồng thời mọi vũ khí nhận vĩnh viễn **`+1 lần Nảy Tường Thông Minh (`Smart Bounce`)`**, **`+55% Additive Damage` cho đạn nảy**, và **`+35%` sát thương `Wall-Slam`**.

- **`Task P2B.4` — Giao Diện Modal Tế Đàn Khế Ước, Huy Hiệu Lời Nguyền/Di Vật Trên HUD & Rig/VFX `Bóng Ma Đao Phủ` (`hud-pact-and-forge-modals.ts`, `rig-defs-biome1-boss-hub.ts`, `combat-fx-weapons-v2.ts`):**
  - Thiết kế Modal Tế Đàn Khế Ước Tro Tàn mang phong cách Hắc Ám Trang Trọng (hiển thị rõ 2 nửa trên mỗi thẻ: **Lời Nguyền Suốt Biome [Đỏ]** và **Di Vật Thức Tỉnh Sau Khi Hạ Boss [Vàng Hoàng Kim]**).
  - Vẽ Rig Cutout 2.0 cho `Bóng Ma Đao Phủ (Ashen Executioner)` cầm lưỡi hái lửa đen, dây xích linh hồn `pact_soul_chain` (chuyển sang đỏ nhấp nháy khi căng quá `260px`) và tia laser Huyết Thệ.

- **`Task P2B.5` — Xây Dựng Cảnh Chụp Kiểm Chứng Tế Đàn Khế Ước, Bóng Ma Đao Phủ & Di Vật Thức Tỉnh (`visual-scene-ap2-p2.ts`):**
  - Tạo các cảnh `ap2-shrine-ashen-altar`, `ap2-modal-ashen-pact-vi`, `ap2-modal-ashen-pact-en`, `ap2-pact-soul-chain-stretch` (strip), `ap2-pact-ashen-executioner` (strip), `ap2-relic-awakening-banner` (strip).

- **`Task P2B.6` — Visual Gate & Phase Gate `P2B`:**
  - Chạy `pnpm shots -- --phase ap2-p2b --label after --group ap2-p2b`, chấm qua Visual Reviewer (`pro` `≥ 8.0/10`), chạy `pnpm verify` & `pnpm perf`. Tag `ap2-p2b`.

---

### PHASE P3A — Đại Tu AI Quái (`Bounded Predictive Lead Aiming`) & 12 Hành Vi Quái Tương Tác Địa Hình Theo 3 Biome
> **Tham chiếu Spec Rev 4:** Phần 6 (`6.1` — Công thức ngắm đón đầu có giới hạn, `6.2` — 12 hành vi quái theo 3 Biome).
> **Mục tiêu:** Chấm dứt việc quái bắn vào vị trí cũ khiến người chơi chỉ cần đi bộ ngang là né được 100% đạn; biến cả 12 loại quái trong 3 Biome thành các tác nhân tương tác trực tiếp với Bia Chắn và Đồ Chơi trong phòng.

#### Danh sách Task con của `Phase P3A`:
- **`Task P3A.1` — Cài Đặt Công Thức Ngắm Đón Đầu Có Giới Hạn (`Bounded Predictive Lead Aiming`) & Tia Chỉ Ngắm `0.35s` (`Section 6.1`):**
  - **Files:** `packages/shared/src/sim/sim-enemies-core.ts`, `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. Viết hàm chuẩn `computePredictiveLeadAimAngle(enemy, targetPlayer, projectileSpeed, leadFactor)` trong `sim-enemies-core.ts`:
       $$\text{timeToHit} = \min\left(0.65,\ \frac{\text{dist}(e, p)}{\text{projectileSpeed}}\right), \quad \text{predPos} = p.\text{pos} + p.\text{vel} \times \text{timeToHit} \times \text{leadFactor}$$
       - Trong đó `leadFactor = 0.35` cho quái thường và `leadFactor = 0.65` cho Quái Tinh Anh / Boss.
       - Kẹp trần độ lệch góc tối đa so với góc ngắm thẳng là **`±28°` (`0.49 rad`)** để không bao giờ bắn lệch vô lý khi người chơi đổi hướng đột ngột.
    2. Trong `0.35s` cuối của Telegraph trước khi khai hỏa, đồng bộ góc ngắm đã khóa và vẽ **Đường Chỉ Ngắm Đỏ Cam (`#FF5722` lõi sáng)** rõ nét trong `telegraphs-and-overlays.ts` để người chơi kịp lật Bia Chắn `[E]` hoặc Lướt `Shift`.

- **`Task P3A.2` — Cài Đặt 4 Hành Vi Quái Tương Tác Địa Hình Biome 1 (`Rừng Cổ`) (`Section 6.2 Biome 1`):**
  - **Files:** `packages/shared/src/sim/sim-enemies-biome1.ts`, `packages/shared/src/sim/sim-tactical-physics.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **`goblin_shooter`:** Chủ động tìm điểm nấp sau `moss_table` hoặc `tall_grass`, bắn chùm 2 mũi tên thẳng + 1 mũi tên ngắm đón đầu (`leadFactor = 0.35`).
    2. **`wild_boar`:** Húc tốc độ `410 px/s`; nếu người chơi đứng trước `rotten_totem_pillar` rồi Lướt né, Lợn Rừng **tự húc gãy cột đá mục khiến cột đổ sập đè chính nó (`Dmg_Hazard` + Choáng `1.5s`)**!
    3. **`spore_bomber`:** Khi chạy lại gần và gồng tự hủy (`0.65s`), người chơi có thể dùng **`Dash-Kick` hoặc đòn Cận chiến** sút văng con `spore_bomber` bay ngược (`520 px/s`) vào giữa đội hình địch rồi nổ tung!
    4. **`goblin_shaman`:** Cắm **Cọc Totem Hộ Thể** buff giáp giảm 40% sát thương cho quái quanh đó; người chơi dùng **`Dash-Kick` sút bàn chắn tông gãy Cọc Totem** sẽ làm toàn bộ quái đang nối dây bị phản phệ Choáng `1.2s`.

- **`Task P3A.3` — Cài Đặt 4 Hành Vi Quái Tương Tác Địa Hình Biome 2 (`Hầm Băng`) (`Section 6.2 Biome 2`):**
  - **Files:** `packages/shared/src/sim/sim-enemies-biome2.ts`, `packages/shared/src/sim/sim-tactical-physics.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **`snow_spirit`:** Khi bị tiêu diệt sẽ kết tinh thành một **Khối Băng Trượt (`sliding_ice_block`)** ngay tại chỗ để người chơi `Dash-Kick` sút vào đám quái còn lại.
    2. **`baby_yeti`:** Chủ động đẩy trượt `sliding_ice_block` dọc mặt sàn (`460 px/s`) về phía người chơi; người chơi có thể dùng **`Dash-Kick` hoặc Đòn 3 Cận chiến (`Parry Deflect`)** sút bật ngược khối băng đó đập chết chính `baby_yeti`!
    3. **`ice_mage`:** Ngắm bắn tia băng vào `cryo_prism_pillar` để khúc xạ thành 3 tia quạt quét phòng; người chơi nhấn **`[E]` lật `glacial_barricade`** chặn trước Lăng Kính để cắt đường tia.
    4. **`ice_golem`:** Lớp giáp băng mặt trước giảm `75%` sát thương đạn thường, nhưng chỉ cần bị **`Dash-Kick` Khối Băng đâm trúng hoặc bị `Wall-Slam` đập vào tường** là lớp giáp băng vỡ tan ngay lập tức (nhận sát thương `Shatter`).

- **`Task P3A.4` — Cài Đặt 4 Hành Vi Quái Tương Tác Địa Hình Biome 3 (`Lò Rèn`) (`Section 6.2 Biome 3`):**
  - **Files:** `packages/shared/src/sim/sim-enemies-biome3.ts`, `packages/shared/src/sim/sim-tactical-physics.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **`coal_golem`:** Khi chết rơi ra **Bom Lò Than (`coal_bomb`)** đếm ngược `2.0s` — người chơi có thể `Dash-Kick` sút trượt quả bom bay vào đám xạ thủ địch.
    2. **`iron_shielder`:** Khiên sắt mặt trước chặn đạn thường, nhưng khi trúng đòn nguyên tố **`Sét (Shock)`** vào mặt khiên sẽ dẫn điện phóng hồ quang giật tê liệt toàn bộ quái đang nấp phía sau khiên!
    3. **`dwarf_cannon`:** Bắn đạn cối cầu vồng (`Lobbed Mortar`) vượt qua vật chắn thấp, rơi xuống vòng chỉ thị đỏ trên sàn sau `0.85s`.
    4. **`welder_drone`:** Khi bị bắn hạ sẽ rơi xuống phát nổ **xung EMP (`r=110px`)** làm choáng toàn bộ quái máy móc xung quanh trong `1.5s`.

- **`Task P3A.5` — Xây Dựng Cảnh Chụp & Strip 8-Frame Cho AI Quái Tương Tác Địa Hình (`tests/e2e/helpers/visual-scene-ap2-p3.ts`):**
  - Tạo các cảnh `ap2-ai-lead-aim-telegraph`, `ap2-ai-boar-pillar-crash` (strip), `ap2-ai-spore-bomber-kick` (strip), `ap2-ai-yeti-iceblock-counter` (strip), `ap2-ai-shielder-shock-arc` (strip), `ap2-ai-dwarf-mortar-lob` (strip).

- **`Task P3A.6` — Visual Gate & Phase Gate `P3A`:**
  - Chạy `pnpm shots -- --phase ap2-p3a --label after --group ap2-p3a`, chấm qua Visual Reviewer (`pro` `≥ 8.0/10`), chạy `pnpm verify` & `pnpm perf`. Tag `ap2-p3a`.

---

### PHASE P3B — Thiết Kế Lại 3 Boss Với Cơ Chế Phá Giáp Trực Quan (`1–2 Bước`), `Boss Supply Drop` & `bossStaggerAccum`
> **Tham chiếu Spec Rev 4:** Phần 2 (`2.2` — `Boss Supply Drop 18s` & `bossStaggerAccum`), Phần 6 (`6.3` — Thiết kế lại 3 Boss phá giáp 1–2 bước).
> **Mục tiêu:** Biến 3 trận đánh Boss thành đỉnh cao ứng dụng của vòng lặp `Lật Chắn [E] + Dash-Kick Đồ Chơi Biome + Phá Giáp 1–2 Bước`.

#### Danh sách Task con của `Phase P3B`:
- **`Task P3B.1` — Hệ Thống Tiếp Tế Phòng Boss (`Boss Supply Drop 18s`) & Thanh Chấn Động Boss (`bossStaggerAccum 0..100`) (`Section 2.2 #3`):**
  - **Files:** Tạo mới `packages/shared/src/sim/sim-boss-armor-break.ts`, kết nối vào `packages/shared/src/sim/sim-enemies-core.ts` và `apps/client/src/scenes/game-scene/hud-combat-and-coop.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **`Boss Supply Drop`:** Trong phòng `boss`, cứ mỗi **`18.0s`** (và ngay khi Boss chuyển Phase ở `66% HP` & `33% HP`), kiểm tra số lượng `Flippable Barricade` và `Biome Prop` đang còn trong phòng; nếu thiếu thì thả bổ sung từ trên cao xuống (có vòng chỉ thị vàng `0.6s`) để luôn duy trì đủ **3 Bia Chắn + 2 Đồ Chơi Biome**.
    2. **Thanh Chấn Động Boss (`bossStaggerAccum: 0..100`):**
       - Nhận đòn có `knockback > 0` cộng $\Delta\text{Stagger} = (\text{knockback} / 12) \times \text{procCoefficient}$ (bị `Dash-Kick` Bia Chắn / Đồ Chơi đập trúng cộng thẳng `+50 Stagger`).
       - Khi `bossStaggerAccum >= 100`: Reset về `0` (Cooldown tích lại `6.0s`), kích nổ hiệu ứng **`WALL-SLAM!`** ngay trên người Boss (làm Boss khựng `0.5s` và kích hoạt toàn bộ các Phước lành liên quan đến `Wall-Slam` / `Barricade Techs`).
       - Vẽ thanh **Chấn Động (`Stagger Bar`) màu Vàng Cam** nằm gọn ngay dưới thanh Máu của Boss trên HUD.

- **`Task P3B.2` — Đại Tu Boss Biome 1: `spore_king` (Mục Vương Nấm Độc — Phá Giáp 1 Bước) (`Section 6.3 #1`):**
  - **Files:** `packages/shared/src/sim/sim-boss-armor-break.ts`, `packages/shared/src/sim/sim-enemies-biome1.ts`.
  - **Chi tiết thực hiện (TDD):**
    - Khi máu chạm ngưỡng `66%` và `33% HP`, Mục Vương dựng **Vỏ Bào Tử Cường Hóa (giảm `70%` sát thương đạn thường)** và gồng lao húc.
    - **Phá Giáp Trực Quan (1 Bước):** Người chơi chỉ cần **`Dash-Kick` bất kỳ Bàn Đá (`moss_table`) hoặc Túi Bào Tử (`volatile_spore_pod`) nào đập trúng Mục Vương** (hoặc đứng trước **Trụ Đá Mục `rotten_totem_pillar`** dụ Mục Vương húc vào):
      - Vỏ Bào Tử vỡ tan tành ngay lập tức, gây **`6% MaxHP` sát thương chuẩn** ($\text{Dmg}_{\text{Hazard}}$) và làm Boss rơi vào trạng thái **Choáng Phá Giáp trong `3.5s` (`+40% EnemyVuln`, lộ điểm yếu phát sáng)**!

- **`Task P3B.3` — Đại Tu Boss Biome 2: `kryssa_ice_queen` (Băng Hậu Kryssa — Phá Giáp 1–2 Bước) (`Section 6.3 #2`):**
  - **Files:** `packages/shared/src/sim/sim-boss-armor-break.ts`, `packages/shared/src/sim/sim-enemies-biome2.ts`.
  - **Chi tiết thực hiện (TDD):**
    - Khi máu chạm ngưỡng `66%` và `33% HP`, Kryssa dựng **Khiên Băng Hàn (giảm `75%` sát thương đạn thường)** và quét tia Laser Băng Cực Hàn.
    - **Phá Giáp Trực Quan (1–2 Bước có quan hệ nhân quả rõ ràng):** Người chơi nhấn **`[E]` lật `glacial_barricade` (Phiến Băng Cổ Đại)** để chặn tia laser của ả, sau đó dùng **`Dash-Kick` sút chính Phiến Băng Cổ Đại đó (hoặc `sliding_ice_block`) tông thẳng vào người Kryssa**:
      - Khiên Băng vỡ nát, gây **`6% MaxHP` sát thương chuẩn** và làm ả bị **Đóng Băng Phá Giáp trong `3.0s` (`+40% EnemyVuln`)**!

- **`Task P3B.4` — Đại Tu Boss Biome 3: `forge_titan` (Titan Lò Rèn — Phá Giáp 1 Bước) (`Section 6.3 #3`):**
  - **Files:** `packages/shared/src/sim/sim-boss-armor-break.ts`, `packages/shared/src/sim/sim-enemies-biome3.ts`.
  - **Chi tiết thực hiện (TDD):**
    - Khi máu chạm ngưỡng `66%` và `33% HP`, Titan bật **Giáp Nhiệt Hạch (giảm `75%` sát thương đạn thường)** và thả các **Lõi Năng Lượng / Bom Lò Than** ra sàn.
    - **Phá Giáp Trực Quan (1 Bước):** Người chơi chỉ cần **`Dash-Kick` bất kỳ Tấm Chắn Thép (`forge_blast_shield`), Lõi Năng Lượng, Bom Lò Than hoặc Nồi Nung Xỉ (`slag_crucible`) nào tông trúng Titan** (hoặc kích hoạt **Búa Máy `pneumatic_press`** dập xuống khi Titan bước qua giữa phòng):
      - Giáp Nhiệt Hạch quá tải phát nổ, gây **`6% MaxHP` sát thương chuẩn** và làm Titan **Choáng Phá Giáp trong `4.0s` (`+40% EnemyVuln`)**!

- **`Task P3B.5` — Giao Diện HUD Boss (Khiên Giáp + Thanh Stagger + Gợi Ý Phá Giáp) & Cảnh Chụp Strip 8-Frame Cho 3 Boss (`visual-scene-ap2-p3.ts`):**
  - Trên thanh máu Boss, khi Boss đang bật Vỏ Bào Tử / Khiên Băng / Giáp Nhiệt Hạch, hiển thị lớp khung giáp bọc ngoài kèm dòng gợi ý chiến thuật ngắn gọn (`"SÚT BÀN ĐÁ / BÀO TỬ PHÁ GIÁP!"`, `"LẬT PHIẾN BĂNG CHẶN LASER & SÚT PHÁ KHIÊN!"`, `"SÚT KHIÊN THÉP / LÕI NĂNG LƯỢNG HOẶC DẬP BÚA MÁY!"`).
  - Tạo 4 cảnh strip 8 frame: `ap2-boss-supply-drop`, `ap2-boss1-armor-break` (strip sút túi bào tử vỡ giáp Mục Vương), `ap2-boss2-armor-break` (strip lật phiến băng chặn laser & sút vỡ khiên Kryssa), `ap2-boss3-armor-break` (strip sút tấm chắn thép / dập búa máy phá giáp Titan).

- **`Task P3B.6` — Visual Gate & Phase Gate `P3B`:**
  - Chạy `pnpm shots -- --phase ap2-p3b --label after --group ap2-p3b`, chấm qua Visual Reviewer (`pro` `≥ 8.0/10`), chạy `pnpm verify` & `pnpm perf`. Tag `ap2-p3b`.

---

### PHASE P3C — Nâng Cấp Bot AI Thực Tế (`Human-Like Bot Profile`), Cân Bằng Tự Động (`pnpm balance`) & Playtest Gate 2
> **Tham chiếu Spec Rev 4:** Phần 3 (`3.3` — Bảng Target DPS 18 vũ khí), Phần 8 (`Phase 3` — Bot AI thực tế & `pnpm balance`).
> **Mục tiêu:** Huấn luyện Bot AI sử dụng toàn bộ cơ chế mới của Ashen Pact 2.0 với xác suất giống người thật, sau đó chạy mô phỏng cân bằng không hệ số giả để tinh chỉnh thông số 18 vũ khí, 5 Class và 3 Boss đạt chuẩn.

#### Danh sách Task con của `Phase P3C`:
- **`Task P3C.1` — Nâng Cấp Bot AI (`sim-progression-bot.ts` & `tools/bot-profile.ts`) Theo Profile Người Chơi Thật (`Section 8 Phase 3`):**
  - **Files:** `packages/shared/src/sim/sim-progression-bot.ts`, `tools/bot-profile.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. Khóa cấu hình **Profile Bot Mô Phỏng Người Chơi Thật** trong `tools/bot-profile.ts`:
       - Tỷ lệ bấm trúng `Perfect Reload / Tactical Vent [R]` = **`50%`** (không bấm trúng 100% như máy).
       - Tỷ lệ chủ động lật Bia Chắn `[E]` khi có đạn địch bay tới và thực hiện `Dash-Kick` = **`40%`**.
       - Khi Boss bật trạng thái Giáp ở `66%` & `33% HP`: Bot biết di chuyển tới Bia Chắn / Đồ Chơi gần nhất (trong vòng 3–6 giây) để thực hiện `Dash-Kick` phá giáp Boss.
       - Ngoài giao tranh: Bot biết tương tác với Đe Rèn Cổ Đại gắn `Mutator`, ký Khế Ước Tro Tàn hợp lý, và giữ `DROP_WEAPON` `0.5s` để phân rã súng thừa lấy Vàng mua đồ tại Chợ Đen.
    2. Tuyệt đối không dùng `godMode = true` hay nhân máu giả trong `tools/balance-simulations.ts`.

- **`Task P3C.2` — Mở Rộng `tools/balance-harness.ts` & `tools/balance-simulations.ts` Đo Đạc Toàn Diện 18 Vũ Khí & 5 Class:**
  - Đo thực tế DPS Thường vs DPS Active `[R]` của toàn bộ 18 vũ khí (đối chiếu bảng mục tiêu ở Mục `3.3` của Spec Rev 4).
  - Chạy mô phỏng `≥ 30 runs` có seed cố định cho từng Class trong cả 5 Class (`vanguard`, `ranger`, `elementalist`, `druid`, `engineer`) ở chế độ Solo `1P`, Co-op `2P` và Co-op `4P`.

- **`Task P3C.3` — Tinh Chỉnh Thông Số Cân Bằng (`packages/shared/src/data/weapons.ts`, `enemies.ts`, `scaling.ts`) Đạt Chuẩn Nghiệm Thu:**
  - Tinh chỉnh thông số sát thương, thời gian nạp đạn, nhiệt độ và HP/sát thương quái sao cho:
    1. Độ lệch DPS giữa 5 vũ khí khởi đầu `< 5%`.
    2. Tỷ lệ thắng (`Winrate`) giữa 5 Class không lệch nhau quá `±6%`.
    3. Thời gian hạ Boss B1 / B2 / B3 nằm trong khoảng `60–120 giây` (độ lệch giữa `1P` và `4P` `<= ±20%`).
    4. Tỷ lệ thắng Boss: B1 `80–95%`, B2 `70–90%`, B3 `60–85%`, `0` trường hợp bị one-shot từ đầy máu+giáp.

- **`Task P3C.4` — Xuất Báo Cáo Cân Bằng (`docs/balance-report.md`) & Cập Nhật `docs/BALANCE.md`:**
  - Chạy `pnpm balance` xuất bảng số liệu đầy đủ vào `docs/balance-report.md` và đồng bộ tài liệu `docs/BALANCE.md`.

- **`Task P3C.5` — Phase Gate `P3C` & Báo Cáo `Playtest Gate 2`:**
  - Chạy `pnpm verify`, `pnpm balance` và `pnpm perf`. Tag `ap2-p3c` và ghi báo cáo nghiệm thu **Playtest Gate 2** vào `docs/PROGRESS.md`.

---

### PHASE P4A — Mở Rộng Chiều Sâu Đợt 1: 8 Phước Lành Hành Động Nâng Cao & 4 Bản Độ Búa Rèn Mở Rộng
> **Tham chiếu Spec Rev 4:** Phần 4 (`4.2` — 8 thẻ đánh dấu `Phase 4`: #5, #6, #11, #12, #17, #18, #23, #24; `4.4` — 4 Mutator đánh dấu `Phase 4`: #7–#10).
> **Mục tiêu:** Hoàn thiện đủ **24/24 Phước Lành Hành Động** và **10/10 Bản Độ Búa Rèn (`Daedalus Weapon Mutators`)** để tối đa hóa khả năng phối đồ (synergy) cho các lượt chơi lặp lại.

#### Danh sách Task con của `Phase P4A`:
- **`Task P4A.1` — Cài Đặt 4 Phước Lành Nâng Cao Của Nhóm 1 (`Barricade`) & Nhóm 2 (`Dash`) (`Section 4.2 #5, #6, #11, #12`):**
  - **Files:** `packages/shared/src/data/blessings.ts`, `packages/shared/src/sim/sim-blessings.ts`, `packages/shared/src/sim/sim-tactical-physics.ts`, `packages/shared/src/sim/sim-player.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **`table_tech_toxic_shrapnel` (`Độc`):** Khi một tấm chắn/đồ chơi bị vỡ hoặc khi kẻ địch bị `Wall-Slam`, bắn tung **8 Mũi Gai Độc 360° (`base 20 DMG Độc/mũi`)** và để lại đầm độc.
    2. **`table_tech_magnet_snare` (`Sét`):** Ngay khi **Lật Chắn (`[E]`)**, tấm chắn phát xung từ trường **kéo tối đa 4 kẻ địch gần nhất (`trong 180px`) gom vào mặt trước tấm chắn** và làm choáng `0.8s` để người chơi sút `Dash-Kick`.
    3. **`dash_thunder_decoy` (`Sét`):** Tại vị trí bắt đầu Lướt, để lại **Tượng Bóng Sét (`1.5s`)** thu hút quái; khi hết giờ hoặc chạm đạn địch sẽ nổ `base 36 DMG Sét` (`r=88px`) và xóa đạn địch trong vùng.
    4. **`dash_phase_blade` (`Vật lý`):** Sau mỗi cú Lướt, đòn đánh hoặc phát bắn đầu tiên trong `1.2s` phóng kèm **Lưỡi Sóng Chấn Động (`base 28 DMG`)** xóa đạn địch trước mặt.

- **`Task P4A.2` — Cài Đặt 4 Phước Lành Nâng Cao Của Nhóm 3 (`Reload/Vent`) & Nhóm 4 (`Bullet Geometry`) (`Section 4.2 #17, #18, #23, #24`):**
  - **Files:** `packages/shared/src/data/blessings.ts`, `packages/shared/src/sim/sim-blessings.ts`, `packages/shared/src/sim/sim-weapon-cadence.ts`, `packages/shared/src/sim/sim-projectiles.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **`reload_caustic_pod` (`Độc`):** Khi `Perfect Reload / Vent [R]` hoặc bắn `Finale Shot`, phóng **Quả Nang Bào Tử** lăn về phía trước `120px`; bắn trúng hoặc `Dash-Kick` vào quả nang sẽ nổ mưa axit (`base 38 DMG Độc`, giảm `25%` giáp quái — cộng vào $\delta_{\text{caustic}}$ trong `M_EnemyVuln`).
    2. **`reload_holster_surge` (`Sét`):** Khi đổi vũ khí bằng `[Q]` (`ICD = 2.0s`), phóng 1 tia sét (`base 26 DMG Sét`) xuyên qua quái trước mặt và nạp đầy ngay vũ khí vừa cất.
    3. **`bullet_wall_tether` (`Sét`):** Khi `Finale Shot` / `Overclocked Shot` chạm tường, cắm **Cọc Điện Cao Thế (`4.5s`, tối đa `2 cọc/người`, tuân thủ trần `MAX_DEPLOYABLES_PER_PLAYER = 8`)**. Hai cọc tự động căng **Dây Cắt Điện (`base 26 DMG Sét/s`)** đốt mọi kẻ địch đi qua.
    4. **`bullet_orbit_return` (`Độc`):** Đạn tầm xa (gắn `SHOT_FLAG.DYNAMIC_BOUNCE`) khi bay hết tầm sẽ **vòng ngược 180° bay trả về vị trí người chơi**, gây `45% DMG Độc` từ sau lưng quái.

- **`Task P4A.3` — Cài Đặt 4 Bản Độ Búa Rèn Mở Rộng (`Daedalus Weapon Mutators #7–#10`) (`Section 4.4 #7–#10`):**
  - **Files:** `packages/shared/src/data/ashen-pacts.ts`, `packages/shared/src/sim/sim-ashen-pacts.ts`, `packages/shared/src/sim/sim-weapon-specials.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **`mutator_holo_decoy_gun`:** Khi `Perfect Reload / Vent [R]`, để lại **Bóng Pháo Ảnh (`3.5s`, tối đa 1 bóng/người)** bắn phụ họa (`40% DMG`) về phía con trỏ chuột.
    2. **`mutator_cluster_mortar`:** Đạn bay cầu vồng vượt qua vật chắn thấp và tách thành 3 mảnh nổ phụ khi chạm đích.
    3. **`mutator_boomerang_core`:** Khi `Perfect Reload / Vent [R]`, phóng lưỡi cưa năng lượng xoay `200px` rồi thu về (`base 32 DMG`).
    4. **`mutator_elemental_infusion`:** Vũ khí đang cầm nhận thêm **Nguyên tố thứ hai từ vũ khí ở ô còn lại** mỗi khi bắn `Finale Shot` hoặc `Overclocked Shot` (giúp tự kích hoạt Phản ứng Nguyên tố bằng 1 khẩu súng!).

- **`Task P4A.4` — Procedural VFX & Cảnh Chụp Strip 8-Frame Cho `Phase P4A` (`combat-fx-weapons-v2.ts` & `visual-scene-ap2-p4.ts`):**
  - Vẽ Tượng Bóng Sét `dash_thunder_decoy`, 2 Cọc Điện Cao Thế & dây sét `bullet_wall_tether`, đạn vòng cung hồi quy `bullet_orbit_return`, và Bóng Pháo Ảnh `mutator_holo_decoy_gun`.
  - Tạo các cảnh chụp strip 8 frame: `ap2-p4a-wall-tether-pylons`, `ap2-p4a-orbit-return-bullets`, `ap2-p4a-thunder-decoy-dash`, `ap2-p4a-holo-decoy-mutator`.

- **`Task P4A.5` — Visual Gate & Phase Gate `P4A`:**
  - Chạy `pnpm shots -- --phase ap2-p4a --label after --group ap2-p4a`, chấm qua Visual Reviewer (`pro` `≥ 8.0/10`), chạy `pnpm verify` & `pnpm perf`. Tag `ap2-p4a`.

---

### PHASE P4B — Mở Rộng Chiều Sâu Đợt 2: 6 Phước Lành Giao Thoa (`Elemental Duo Boons`) & Đấu Trường Bí Mật 20 Giây
> **Tham chiếu Spec Rev 4:** Phần 4 (`4.5` — 6 Phước lành Giao thoa Nguyên tố), Phần 5 (`5.2A` — Đấu trường Kỹ năng 20 Giây trong Phòng Bí Mật).
> **Mục tiêu:** Cài đặt tầng sâu nhất của hệ thống Build (**6 Duo Boons** xuất hiện khi người chơi sở hữu cặp nguyên tố tương ứng) và thử thách kỹ năng tốc độ cao trong Phòng Bí Mật.

#### Danh sách Task con của `Phase P4B`:
- **`Task P4B.1` — Logic Mở Khóa & Cài Đặt 6 Phước Lành Giao Thoa Nguyên Tố (`Elemental Duo Boons`) (`Section 4.5`):**
  - **Files:** `packages/shared/src/data/blessings.ts`, `packages/shared/src/sim/sim-blessings.ts`, `packages/shared/src/sim/sim-combat-damage.ts`, `packages/shared/src/sim/sim-tactical-physics.ts`.
  - **Chi tiết thực hiện (TDD):**
    1. **Điều kiện xuất hiện Duo Boon:** Khi rút 3 thẻ Phước lành qua tầng, nếu người chơi đang sở hữu ít nhất 2 nguyên tố tương ứng (từ Vũ khí đang mang hoặc các Phước lành đã lấy), có `35%` cơ hội ô thẻ thứ 3 nâng cấp thành **Thẻ Giao Thoa Nguyên Tố (`Duo Boon` — viền Cầu Vồng Kim Cương)**.
    2. **6 Cơ chế Duo Boon Độc Bản:**
       - **`duo_superheated_cyclone` (*Lửa + Băng*):** Phản ứng *Hơi Nước* hóa thành **Lốc Xoáy Nước Sôi** tự động đuổi theo quái gần nhất (`140 px/s`, `base 14 DMG/s` trong `4.0s`).
       - **`duo_cryo_shatter_spires` (*Băng + Vật Lý*):** Phản ứng *Vỡ Băng (`Shatter`)* đóng **4 Cột Băng Nhọn xuống sàn (`4.0s`)** chặn đạn địch và phát nổ tiếp khi bị `Dash-Kick`.
       - **`duo_superconduct_rail` (*Băng + Sét*):** Mục tiêu đang dính *Siêu Dẫn (`Superconduct`)* tạo từ trường **hút các viên đạn bắn vào bán kính `100px` quanh nó bẻ cong lao thẳng vào người nó** (Server-authoritative homing, gắn cờ `SHOT_FLAG.DYNAMIC_BOUNCE`).
       - **`duo_napalm_chain_plague` (*Độc + Lửa*):** Phản ứng *Nổ Độc* bắn văng giọt **Nhựa Lửa-Độc** sang các quái trong `160px`, gây nổ dây chuyền tiếp theo khi mục tiêu bị hạ gục.
       - **`duo_plasma_overload_star` (*Lửa + Sét*):** Phản ứng *Quá Tải* để lại **Quả Cầu Lửa-Điện (`Plasma Star`)** nảy qua lại 3 lần giữa các bức tường (`420 px/s`).
       - **`duo_magnetic_bastion_ring` (*Sét + Vật Lý*):** Giữa các tấm Bia Chắn đã lật (`'flipped'`) trong khoảng cách `220px` tự động **giăng lưới hồ quang điện (`base 28 DMG Sét/s`)** đốt cháy mọi quái vật đi cắt ngang!

- **`Task P4B.2` — Cài Đặt Đấu Trường Kỹ Năng 20 Giây Trong Phòng Bí Mật (`Secret Skill Arena 20s`) (`Section 5.2A`):**
  - **Files:** `packages/shared/src/sim/sim-dungeon-rooms.ts`, `packages/shared/src/sim/sim-ashen-pacts.ts`.
  - **Chi tiết thực hiện (TDD):**
    - Bên trong phòng `secret` (mở sau khi phá tường nứt), ngoài Rương Hiếm (`Rare/Epic`) và 2 cụm vàng, có đặt **Đài Tinh Thể Thử Thách (`secret_challenge_crystal`)**.
    - Nếu người chơi nhấn `[E]` kích hoạt Tinh Thể: triệu hồi 1 đợt quái Tinh Anh kèm 4 Bia Chắn + 2 Thùng Nổ với đồng hồ đếm ngược **`20.0 giây`**.
    - Nếu tiêu diệt hết đợt quái trong vòng `20.0s`: Rương trong phòng Bí Mật được **Thăng Hoa lên bậc Huyền Thoại (`legendary`) chắc chắn 100% + thưởng thêm `+40 Gold`**! (Nếu hết `20.0s` chưa dọn xong: quái còn lại tan biến, người chơi vẫn mở được rương `Rare/Epic` gốc bình thường, không bị phạt chết).

- **`Task P4B.3` — Giao Diện Thẻ Duo Boon (Viền Kim Cương Đôi), Đồng Hồ Đếm Ngược 20s & VFX 6 Duo Boons (`hud-modals-and-debug.ts`, `combat-fx-weapons-v2.ts`):**
  - Vẽ khung thẻ Duo Boon đặc biệt có 2 biểu tượng nguyên tố giao nhau trên Modal chọn Phước lành.
  - Vẽ VFX cho Lốc Xoáy Nước Sôi, 4 Cột Băng Nhọn, Quả Cầu Lửa-Điện nảy tường, và Lưới Hồ Quang Điện nối giữa các tấm Bia Chắn đã lật (`duo_magnetic_bastion_ring`).

- **`Task P4B.4` — Xây Dựng Cảnh Chụp & Strip 8-Frame Cho 6 Duo Boons & Đấu Trường Bí Mật 20s (`visual-scene-ap2-p4.ts`):**
  - Tạo các cảnh: `ap2-modal-duo-boon-card`, `ap2-duo-magnetic-bastion-ring` (strip), `ap2-duo-superheated-cyclone` (strip), `ap2-duo-plasma-overload-star` (strip), `ap2-secret-arena-20s-trial` (strip).

- **`Task P4B.5` — Visual Gate & Phase Gate `P4B`:**
  - Chạy `pnpm shots -- --phase ap2-p4b --label after --group ap2-p4b`, chấm qua Visual Reviewer (`pro` `≥ 8.0/10`), chạy `pnpm verify` & `pnpm perf`. Tag `ap2-p4b`.

---

### PHASE P5 — Tổng Duyệt Hồi Quy Toàn Diện, Hiệu Năng 60Hz 4P, Đóng Gói Release `v2.0.0` & Kết Thúc Nhánh
> **Tham chiếu Spec Rev 4:** Toàn bộ Phần 1 → Phần 8.
> **Mục tiêu:** Kiểm định chéo toàn bộ hệ thống Ashen Pact 2.0 ở cấp độ sản phẩm phát hành thương mại `v2.0.0`, đảm bảo không một lỗi nhỏ nào còn sót lại trước khi trình menu hợp nhất nhánh.

#### Danh sách Task con của `Phase P5`:
- **`Task P5.1` — Chụp Toàn Bộ Danh Mục Cảnh (`v0.2.0` + `Ashen Pact 2.0`) & Tổng Duyệt Holistic Visual Gate (`Model: pro`):**
  - Chạy `pnpm shots -- --phase ap2-p5 --label final` chụp toàn bộ danh mục cảnh ở Mục `5` (bao gồm cả độ phân giải `1440p`, `2560×1080` ultrawide, `1280×1024`, chất lượng `Low`, ngôn ngữ `vi` và `en`).
  - Chạy `tools/visual-metrics.ts` trên toàn bộ các cảnh môi trường.
  - Triệu hồi **Holistic Visual Reviewer (`research`, model `pro`)** chấm tổng thể toàn bộ bộ ảnh `final`: yêu cầu **mọi tiêu chí trong Rubric 10 Tiêu Chí (Mục `6`) đều đạt `≥ 8.5 / 10`**, `0 blocker`, `0 major`. Nếu còn bất kỳ điểm nào `< 8.5` hoặc còn lỗi `minor (deferred)` trong các sổ cái ledger từ `P0A` → `P4B`, thực hiện một vòng fix dứt điểm và chụp kiểm tra lại.

- **`Task P5.2` — Kiểm Toán Cân Bằng Cuối Cùng (`pnpm balance`) & Kiểm Toán Hiệu Năng / Soak Test 60Hz 4P (`pnpm perf`):**
  - Chạy `pnpm balance` sau khi đã có đủ 24 Phước lành, 10 Mutators và 6 Duo Boons để xác nhận đường cong sức mạnh Tầng 1 → Tầng 6 không bị nổ số ở cuối game (Boss Tầng 6 vẫn sống tối thiểu `45–60s` trước build mạnh, winrate trung bình giữ đúng khung mục tiêu).
  - Chạy `pnpm perf` và bài test chịu tải 4P Co-op LAN:
    - Thời gian tick trên Server: **`p95 < 4.5ms`** ở 60Hz.
    - Tốc độ khung hình Client trên GPU thật: **`≥ 58 FPS`** trong cảnh `__GAME_STRESS_TEST__` (4 người chơi + quái đông + đạn nảy `DYNAMIC_BOUNCE` + vật chắn trượt).
    - Kiểm tra dung lượng gói tin mạng (`snapshot-codec.ts`) và bộ nhớ heap sau 200 lần chuyển phòng / phân rã súng / lật bàn không bị phình bộ nhớ.

- **`Task P5.3` — Đồng Bộ Toàn Bộ Tài Liệu Kiến Trúc & Thiết Kế (`docs/*.md` & `README.md`):**
  - Cập nhật `docs/GDD.md`: Ghi đầy đủ Tam Giác Hành Động 3 Giây, 6 Archetype phòng, Quy luật `Flip Cover [E] + Dash-Kick + Wall-Slam + Ring-Out`, 18 Vũ khí (`CLIP_RELOAD / HEAT_VENT / MELEE_COMBO`), 24 Phước lành, 10 Nâng cấp kỹ năng, 10 Mutators, 6 Duo Boons, 6 Khế ước Tro Tàn & 6 Di vật Thức tỉnh, 12 hành vi quái và cơ chế phá giáp 1–2 bước của 3 Boss.
  - Cập nhật `docs/BALANCE.md` (kết quả `pnpm balance` mới nhất), `docs/TECH.md` (kiến trúc đồng bộ đạn `deterministicId` & `Zero-Rubberband Client Hold`), `docs/ART_GUIDE.md` (thông số texture Bia Chắn, Đồ Chơi Biome & Micro-Bar), `README.md` và `RELEASE_NOTES.md` (mục **What's New in Ashen Pact v2.0.0**).

- **`Task P5.4` — Nâng Phiên Bản Lên `2.0.0` (`Version Bump`) & Kiểm Thử Đóng Gói Bản Phát Hành (`pnpm package:release`):**
  - Cập nhật version từ `0.2.1` lên **`2.0.0`** tại tất cả `package.json` (`root`, `packages/shared`, `apps/client`, `apps/server`), tiêu đề cửa sổ/launcher C# trong `tools/package-release.ts`, banner khởi động Server, và hằng số kiểm tra version trong `tests/e2e/phase8.spec.ts` (dùng lệnh grep `0.2.0` / `0.2.1` để đảm bảo không bỏ sót).
  - Chạy `pnpm package:release` để đóng gói bản `.exe` / `.zip` độc lập, và chạy pass toàn bộ `pnpm verify` (bao gồm `phase8.spec.ts` chạy trên bản release thật).

- **`Task P5.5` — Tổng Duyệt Code Toàn Nhánh (`requesting-code-review`, `Model: 'pro'`):**
  - Triệu hồi subagent Code Reviewer (`pro`) kiểm toán toàn bộ diff từ `git merge-base master HEAD` đến `HEAD`, đối chiếu với danh sách kiểm tra:
    1. Không còn bất kỳ mã chết nào của thanh `energy`, 6 vũ khí clone hay `worldSim.activeBuffIds`.
    2. Toàn bộ 100% file `.ts` trong dự án đều `< 1000 dòng`.
    3. Không có lỗi bảo mật, không lộ lệnh debug khi chạy release mặc định, không có race condition trong đồng bộ đạn mạng.
  - Nếu Reviewer phát hiện vấn đề, thực hiện 1 vòng fix gọn và chạy lại `pnpm verify`. Đánh dấu `git tag v2.0.0` trên nhánh `overhaul/v2.0`.

- **`Task P5.6` — Báo Cáo Tổng Kết Chiến Dịch & Trình Menu Kết Thúc Nhánh (`finishing-a-development-branch`):**
  - Xuất báo cáo tổng kết đầy đủ:
    - Bảng tổng hợp 14 Phase (`P0A` → `P5`) và trạng thái nghiệm thu.
    - Bảng điểm Visual Reviewer (`baseline` → `final`) cho cả 10 tiêu chí.
    - Kết quả `pnpm verify`, `pnpm balance`, `pnpm perf`.
    - Mục **"Các Ruling tôi đã tự quyết"** (toàn bộ dòng `Ruling:` trong các sổ cái ledger theo thứ tự thời gian).
    - Mục **"Cần tôi xem"** (nếu có).
  - Trình bày **Menu 3 lựa chọn của skill `finishing-a-development-branch`** (1. Merge vào `master` tại máy / 2. Push và tạo Pull Request / 3. Giữ nguyên nhánh `overhaul/v2.0` để kiểm tra thêm) và **chờ tôi lựa chọn**. Tuyệt đối không tự ý merge vào `master` khi tôi chưa chọn!

---

## 5. DANH MỤC CẢNH CHỤP TẤT ĐỊNH BẮT BUỘC (`VISUAL SCENES CATALOG`)

Ngoài các cảnh hồi quy nền tảng đã có từ `v0.2.0` (`menu`, `hub-solo`, `b1-start-room`, `b1-combat`, `b2-combat`, `b3-combat`, `b3-combat-grayscale`, `coop-4p-combat`, `stress-4p`, `ui-vi-diacritics`...), bộ cảnh chụp mới của **Ashen Pact 2.0** trong `tests/e2e/helpers/visual-scene-ap2-*.ts` phải bao phủ đầy đủ 6 nhóm sau:

1. **Nhóm Hình Học 6 Archetype Phòng & Vực Sâu `Chasm` (Chụp cả Lit và `-unlit.png` kèm `sampleRects` đo `metrics.json`):**
   - `ap2-b1-twin-bridges`, `ap2-b1-gauntlet-chokepoint`, `ap2-b1-central-bastion`
   - `ap2-b2-prism-labyrinth`, `ap2-b3-crossfire-conveyors`, `ap2-crumbling-pillar-ring`
2. **Nhóm Vật Lý Địa Hình Cốt Lõi (Chụp kèm `-strip.png` 8 khung hình):**
   - `ap2-flip-cover-microblank` (Lật bàn `[E]` `'low' -> 'flipped'` + sóng trắng `Micro-Blank` xóa đạn địch)
   - `ap2-dash-kick-wall-slam` (Lướt `Shift` sút bàn `520 px/s` đập quái vào tường hiện `ĐẬP TƯỜNG!`)
   - `ap2-chasm-ring-out` (Đẩy quái bộ binh rơi xuống vực `chasm` hiện `RING-OUT!` và bắn vọt vàng lên cầu)
   - `ap2-b2-glacial-kick-spikes` (Sút phiến băng vỡ tung đóng 3 cọc nhũ băng nhọn xuống sàn)
   - `ap2-b2-prism-refract` (Bắn đạn vào Lăng Kính Pha Lê tách 3 tia quạt)
   - `ap2-b3-pneumatic-press-crush` (Đèn cảnh báo băng chuyền đảo chiều + Búa Máy dập nghiền quái)
   - `ap2-b3-blast-shield-wave` (Sút Tấm Chắn Thép phóng kèm Cơn Sóng Lửa `88px`)
3. **Nhóm Nhịp Vũ Khí (`Micro-Bar [R]` & `MELEE_COMBO` 3 Đòn) + 18 Vũ Khí Độc Bản (Chụp kèm `-strip.png` 8 khung hình):**
   - `ap2-microbar-perfect-reload` (`rivet_gun` bấm `[R]` trong Khung Vàng `45%–70%` nổ lưới hồ quang đinh tán)
   - `ap2-heat-vent-staff` (`apprentice_staff` nhấn `[R]` vùng Nhiệt Cam `65%–95%` phóng Tia Tam Giác Nguyên Tố)
   - `ap2-melee-combo3-parry` (`knight_sword` Đòn 3 phóng Kiếm Khí `240px` + `Parry Deflect` đánh bật 3 viên đạn địch)
   - `ap2-tesla-smart-bounce` (`tesla_carbine` nảy tường thông minh tìm quái sau góc chữ L)
   - 14 strip 8 khung hình của 14 vũ khí còn lại (`ap2-wep-crossbow-rip`, `ap2-wep-thorn-pull`, `ap2-wep-shotgun-wallslam`, `ap2-wep-gale-vent`, `ap2-wep-frag-airburst`, `ap2-wep-seed-bloom`, `ap2-wep-tether-pull`, `ap2-wep-laser-railgun`, `ap2-wep-cleaver-boomerang`, `ap2-wep-void-implosion`, `ap2-wep-axe-guillotine`, `ap2-wep-solar-supernova`, `ap2-wep-magma-geysers`, `ap2-wep-hammer-thunder`).
4. **Nhóm Hệ Thống Nâng Cấp, Đe Rèn, Khế Ước Tro Tàn & Phân Rã Súng:**
   - `ap2-modal-blessing-vi`, `ap2-modal-blessing-en`, `ap2-modal-duo-boon-card`
   - `ap2-treasure-forge-workshop`, `ap2-modal-daedalus-mutator`
   - `ap2-weapon-salvage-hold` (strip giữ `[X]` `0.5s` phân rã súng thành vàng)
   - `ap2-secret-wall-crack-break` (strip phá tường nứt mở phòng Bí Mật) & `ap2-secret-arena-20s-trial`
   - `ap2-shrine-ashen-altar`, `ap2-modal-ashen-pact-vi`, `ap2-modal-ashen-pact-en`, `ap2-pact-soul-chain-stretch` (strip), `ap2-pact-ashen-executioner` (strip), `ap2-relic-awakening-banner` (strip).
5. **Nhóm AI Quái Đón Đầu & Phá Giáp 1–2 Bước Của 3 Boss (Chụp kèm `-strip.png` 8 khung hình):**
   - `ap2-ai-lead-aim-telegraph` (Đường chỉ ngắm đỏ cam `0.35s` đón đầu hướng di chuyển)
   - `ap2-ai-boar-pillar-crash`, `ap2-ai-spore-bomber-kick`, `ap2-ai-yeti-iceblock-counter`, `ap2-ai-shielder-shock-arc`
   - `ap2-boss-supply-drop` (Thả tiếp tế Bia Chắn & Đồ Chơi Biome mỗi `18s`)
   - `ap2-boss1-armor-break` (Sút Bàn Đá / Túi Bào Tử phá Vỏ Bào Tử Mục Vương + thanh `bossStaggerAccum`)
   - `ap2-boss2-armor-break` (Lật Phiến Băng chặn laser & sút vỡ Khiên Băng Kryssa)
   - `ap2-boss3-armor-break` (Sút Khiên Thép / Lõi Năng Lượng hoặc dập Búa Máy phá Giáp Nhiệt Hạch Titan).

---

## 6. RUBRIC 10 TIÊU CHÍ CHO VISUAL REVIEWER ĐỘC LẬP (`MODEL: PRO`)

Mỗi lần chạy Visual Gate, subagent **Visual Reviewer (`research`, model `pro`)** phải đọc trực tiếp các file ảnh `.png`, `-strip.png` và `metrics.json`, chấm điểm khắt khe trên thang `1–10` cho **10 tiêu chí** sau:

1. **Hình Học Phòng Chiến Thuật & Ranh Giới Vực Sâu (`Tactical Room Geometry & Chasm Clarity`):**
   - Bố cục 6 Archetype (`TWIN_BRIDGES`, `GAUNTLET_CHOKEPOINT`, `CENTRAL_BASTION`, `CROSSFIRE_CONVEYORS`, `PRISM_LABYRINTH`, `CRUMBLING_PILLAR_RING`) rõ ràng, mạch lạc; vực sâu `chasm` trong `TWIN_BRIDGES` nối khít vào tường Bắc/Nam (có nhánh chữ Y ôm sảnh cửa), nhìn biết ngay là vực không đi bộ qua được, trong khi 2 cây cầu rộng 3 ô nổi bật rõ là lối đi; vùng sàn chiến đấu vẫn giữ chuẩn Golden Room (`ΔL* <= 8` ở tâm, `<= 14` toàn sàn).
2. **Độ Rõ Trạng Thái Bia Chắn Lật `[E]` & Đồ Chơi Biome (`Barricade States & Biome Toys`):**
   - Nhìn thoáng qua trong `0.2 giây` là phân biệt được ngay Bia Chắn đang ở trạng thái `'low'` (nằm thấp, đi/bắn qua được) hay `'flipped'` (dựng đứng, có khối 3D và rim-light `-135°`, chặn đạn & chặn đường) hay `'sliding'` (đang lao đi ở `520 px/s`). Các Đồ Chơi Biome (`volatile_spore_pod`, `rotten_totem_pillar`, `sliding_ice_block`, `cryo_prism_pillar`, `pneumatic_press`, `slag_crucible`) có hình dáng đặc trưng, không bị nhầm với decor tĩnh ven tường.
3. **Thanh `Micro-Bar 32×5px` Dưới Chân Nhân Vật & Phản Hồi Nhịp `[R]` (`Active Reload / Vent Readability`):**
   - Thanh Micro-Bar đặt gọn gàng dưới chân nhân vật (không đè lên nhân vật hay chữ tên đồng đội), **Khung Vàng (`45%–70%`)** của `CLIP_RELOAD` và **Vùng Cam (`65%–95%`)** của `HEAT_VENT` nổi bật sắc nét trên mọi màu sàn Biome 1/2/3; hiệu ứng lóe sáng khi bấm trúng `[R]` rõ ràng; **tuyệt đối không hiện Micro-Bar khi cầm vũ khí cận chiến (`MELEE_COMBO`)**.
4. **Cảm Giác Lực Va Đập Vật Lý (`Dash-Kick`, `Wall-Slam`, `Chasm Ring-Out` & `Parry Deflect` Strips):**
   - Trên ảnh strip 8 khung hình, chuỗi chuyển động lật bàn xóa đạn (`Micro-Blank` `r=56px`), sút bàn trượt đi (`Dash-Kick`), quái văng đập tường (`ĐẬP TƯỜNG!`), rơi xuống vực (`RING-OUT!`), và Đòn 3 cận chiến đánh bật đạn địch (`Parry Deflect`) thể hiện rõ quỹ đạo, vệt gió, tia chấn động và popup chữ không chồng chéo.
5. **Bản Sắc Thị Giác Của 18 Vũ Khí Độc Bản (`Weapon Visual Identity & VFX`):**
   - Mỗi vũ khí trong 18 món đều có hình thái đạn và VFX tuyệt kỹ riêng biệt, đẹp mắt (đinh tán nối hồ quang, dây gai kéo quái, rút mũi tên, tia tam giác, lựu đạn nổ trên không, hố đen hút đạn, đao boomerang, 3 mặt trời xoay quanh, nham cầu phun vòi dung nham, cột sét Mjolnir...) dùng `BlendMode.ADD` trong trẻo.
6. **Thứ Tự Nổi Bật Thị Giác & Khả Năng Đọc Đạn Địch (`Combat Readability & Bullet Contrast`):**
   - Dù có thêm hiệu ứng súng, Phước lành, Duo Boons và vật thể trượt, thứ tự nổi bật vẫn bất biến: **Đạn địch (`#E84545` lõi trắng + viền `INK_DARK` `1.5u`) và Đường chỉ ngắm đón đầu `0.35s` > Nhân vật người chơi > Quái & Boss > Bia Chắn & Đồ Chơi > VFX đồng minh (alpha `0.50` cho đồng đội) > Nền sàn**. Kiểm tra cả trên ảnh chuyển xám `b3-combat-grayscale`.
7. **Giao Diện HUD Mới, Đe Rèn Cổ Đại, Tế Đàn Khế Ước & Phân Rã Súng (`HUD, Modals & Typography`):**
   - HUD hiển thị Băng đạn / Nhiệt độ / Nhịp Combo thay cho thanh Energy cũ một cách hiện đại, cùng tông màu `ENV`; Modal **Tế Đàn Khế Ước Tro Tàn**, Modal **Đe Rèn Cổ Đại**, Modal **Phước Lành / Duo Boons**, và vòng giữ `[X] 0.5s Phân Rã` cân đối, chữ tiếng Việt (`Ở`, `Ữ`, `Ặ`, `Ễ`) không mất dấu, không tràn khung, cỡ chữ `>= 13px` tại `1080p`.
8. **Tính Trực Quan Của AI Quái & Cơ Chế Phá Giáp 1–2 Bước Của 3 Boss (`Boss Armor Break & Stagger Clarity`):**
   - Trạng thái bật Vỏ Bào Tử / Khiên Băng / Giáp Nhiệt Hạch của 3 Boss, thanh `bossStaggerAccum` dưới thanh máu Boss, vòng thả tiếp tế `Boss Supply Drop` và khoảnh khắc Đồ Chơi Biome tông vỡ giáp Boss (`CHOÁNG PHÁ GIÁP!`) được thể hiện cực kỳ rõ ràng, người chơi nhìn vào biết ngay phải làm gì mà không cần đọc tài liệu bên ngoài.
9. **Ánh Sáng Toàn Màn Hình Trong Trẻo (`Full-Screen Clear Visibility Preservation`):**
   - Giữ vững chuẩn `v0.2.0`: không sương mù mù mịt, không fog-of-war hay vignette đen làm tối góc màn hình (`cornerRetentionRatio >= 0.82`), vũng sáng chậu lửa ấm áp (`ΔL* >= +8`), bóng đổ nhất quán về hướng Đông–Nam (`+45°`).
10. **Tổng Thể Cảm Giác Sản Phẩm (`Holistic Polish & Game Feel`):**
    - Trò chơi có mang lại cảm giác của một tựa game Action Roguelite chiến thuật đỉnh cao (*Enter the Gungeon × Hades × Nuclear Throne*) sắc sảo, đồng bộ và hoàn thiện ở cấp độ thương mại `v2.0.0` không?

---

## 7. NHỮNG ĐIỀU CẤM TUYỆT ĐỐI (`HARD PROHIBITIONS`)

- ❌ **Cấm đánh giá giao diện, hình học phòng, VFX hay HUD qua đọc code** mà không chụp ảnh thực tế (`pnpm shots`) + ghép strip 8 frame (`-strip.png`) + chấm điểm qua **Visual Reviewer độc lập (`model: pro`)**.
- ❌ **Cấm giữ lại bất kỳ tàn dư nào của Thanh Năng Lượng (`energy`), 6 vũ khí clone, 6 thẻ cộng chỉ số phẳng, hay mảng buff toàn cục `worldSim.activeBuffIds`.**
- ❌ **Cấm dùng Chuột Trái để kích hoạt `Perfect Reload`** hoặc gán hành động Phân Rã Vũ Khí vào phím `[R]`. Phím `[R]` chỉ làm đúng 1 việc là `Perfect Reload / Tactical Vent`; Phân rã súng bắt buộc là giữ phím `DROP_WEAPON` (`[X]`) `0.5s` ngoài giao tranh.
- ❌ **Cấm hiển thị thanh Micro-Bar trên vũ khí cận chiến (`MELEE_COMBO`)** hoặc cho Đòn 1, Đòn 2 cận chiến xóa/phản đạn địch (chỉ có **Đòn thứ 3** mới có `Parry Deflect` trong `0.18s`).
- ❌ **Cấm cho phép nhấn `[E]` lần thứ hai làm sập/hủy tấm Bia Chắn đã lật (`'flipped'`)**, hoặc làm khựng vị trí người chơi khi lướt `Dash-Kick` xuyên qua vật chắn.
- ❌ **Cấm để quái vật hoặc người chơi đi vòng qua mép tường Bắc/Nam trong phòng `TWIN_BRIDGES`** mà không đi qua 2 cây cầu.
- ❌ **Cấm cho các Phước lành Nhóm 3 (`Reload, Vent & Finisher Techs`) kích hoạt khi vung vũ khí cận chiến vào không khí** hoặc cho `seed_gun` bung sương hồi máu khi không nở hoa trúng quái đang sống.
- ❌ **Cấm để đạn `splitGeneration === 1` tách thêm tia đạn mới** hoặc vượt trần `MAX_PELLETS_PER_TRIGGER = 9`, hoặc bỏ qua `Soft Cap (2.80x) / Hard Cap (3.80x)` của `3-Bucket Damage Pipeline`.
- ❌ **Cấm cho phòng `shrine` (Tế Đàn Khế Ước) xuất hiện ở Tầng Chẵn (`2, 4, 6`)**, hoặc kết thúc thử thách Khế Ước sau vài phòng trước khi hạ Boss cuối Biome!
- ❌ **Cấm để Client tự ý tính góc nảy `Smart Bounce` / `Split Bounce` / `Homing`** gây hiện tượng giật lùi đạn (rubberbanding) — bắt buộc dùng `deterministicId` + `SHOT_FLAG.DYNAMIC_BOUNCE` + `Zero-Rubberband Client Hold`.
- ❌ **Cấm tạo hoặc sửa bất kỳ file `.ts` nào vượt quá `1000 dòng`** (phải tách module theo bảng ở Mục `0.5`).
- ❌ **Cấm nạp file ảnh tĩnh bên ngoài (PNG/spritesheet) vào game** — 100% đồ họa phải được bake bằng code procedural / shader GLSL.
- ❌ **Cấm dùng hệ số nhân máu giả hoặc `godMode = true` trong `pnpm balance`.**
- ❌ **Cấm commit thẳng lên nhánh `master`** hoặc tự ý merge khi chưa trình menu `finishing-a-development-branch` ở cuối `Phase P5`.

---

## 8. BẮT ĐẦU CHIẾN DỊCH NGAY BÂY GIỜ

1. Gọi ngay skill `using-superpowers`, đọc `references/antigravity-tools.md` và thông báo ngắn gọn: *"Đang kích hoạt quy trình Superpowers để thực thi chiến dịch Đại Tu Toàn Diện Ashen Pact 2.0 (Phase P0A → P5)"*.
2. Thực hiện trọn vẹn phần **Khởi động `0.1`**: đọc tài liệu đặc tả `docs/superpowers/specs/2026-10-26-ashen-pact-2.0-overhaul-design.md`, thiết lập worktree/nhánh `overhaul/v2.0`, chạy baseline `pnpm verify` & `pnpm perf`, cập nhật `docs/PHASES.md`, `docs/PROGRESS.md` và khởi tạo **Task Artifact (`task.md`)** chứa đầy đủ 14 Phase & 82 Task con.
3. Chạy tuần tự từng Phase từ **`Phase P0A` đến `Phase P5`** theo đúng vòng lặp khép kín ở Mục `0.2`:
   `writing-plans` $\to$ `subagent-driven-development` (TDD) $\to$ **Visual Gate (`pnpm shots` + `visual-metrics` + Visual Reviewer `pro`)** $\to$ **Phase Gate (`verification-before-completion`: `pnpm verify` + `pnpm perf`)** $\to$ Commit & `git tag ap2-<phase>`.
4. Sau mỗi Phase, in báo cáo tổng kết ngắn gọn, rõ ràng (đường dẫn plan, các task con đã hoàn tất, output mới chạy của `pnpm verify` & `pnpm perf`, đường dẫn cặp ảnh `before → after` & `-strip.png`, bảng điểm 10 tiêu chí của Visual Reviewer, các `Ruling:` đã ra) rồi **lập tức chuyển sang Phase tiếp theo**.
5. Kết thúc ở cuối `Phase P5` bằng tổng duyệt toàn nhánh (`requesting-code-review`, model `pro`) và trình menu 3 lựa chọn của `finishing-a-development-branch`.
