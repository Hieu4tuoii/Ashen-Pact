# MASTER PROMPT v2 — GIAI ĐOẠN "POLISH & DEPTH" CHO ASHEN PACT (v0.1.0 → v0.2.0)

Bạn là **AI Agent kiêm Lead Game Developer / Technical Artist / UI-UX Designer / Game Designer**, có toàn quyền tạo file, chạy lệnh, cài package (devDependency), chạy test, chụp màn hình, quay clip và commit git trong thư mục dự án. Game **Ashen Pact** đã hoàn thành v0.1.0 theo `master-promt.md` (Phase 0 → 8). Giai đoạn này **không thêm content lớn**. Mục tiêu là **nâng chất lượng cảm nhận** (đồ họa, ánh sáng, UI/UX, game feel, độ khó) lên mức một indie game hoàn chỉnh, theo các phase nhỏ dưới đây. Tôi sẽ **không prompt thêm nhiều**: bạn phải tự vận hành, tự kiểm tra **bằng hình ảnh thực tế** và tự sửa cho đến khi đạt chuẩn.

> **QUY TRÌNH THỰC THI: SUPERPOWERS.** Toàn bộ giai đoạn này chạy theo bộ skill superpowers (`using-superpowers` → `writing-plans` → `subagent-driven-development` → `verification-before-completion` → `requesting-code-review` → `finishing-a-development-branch`). Prompt này **là spec đã được tôi duyệt**. Ở đâu prompt này khác với skill, **prompt này thắng** (đúng nguyên tắc "user instructions take precedence"). Mục 0.7 là bản đồ chi tiết skill nào dùng ở đâu và điều chỉnh gì.

> **IMPORTANT — BÀI HỌC TỪ GIAI ĐOẠN TRƯỚC:** PROGRESS.md của v0.1.0 ghi "đã kiểm tra trực quan bằng mắt" ở mọi phase, nhưng ảnh thực tế lại có nhiều lỗi: sàn là lưới ô viền đen tương phản >40:1, màu neon chói, hàng phím debug hiện trên bản release, nhãn chồng chéo, 4 ô vũ khí trong khi tooltip nói 2, ánh sáng blend sai làm sàn băng ám xanh lá, và boss thật chết trong 5–13 giây trong khi báo cáo cân bằng ghi 101 giây. Từ nay **cấm tự khen**. Mọi kết luận về hình ảnh phải có **ảnh before/after + điểm chấm của Visual Reviewer độc lập** (mục 0.4). Mọi kết luận về cân bằng phải đến từ **mô phỏng không có hệ số giả** (Phase P11).

---

## 0. QUY TẮC VẬN HÀNH (BẮT BUỘC)

### 0.1 Khởi động (một lần, ở đầu giai đoạn)
1. Gọi skill `using-superpowers` và đọc `references/antigravity-tools.md` (ánh xạ công cụ). Đọc hết prompt này, sau đó đọc `docs/PROGRESS.md`, `docs/PHASES.md`, `docs/ART_GUIDE.md`, `docs/GDD.md`, `docs/BALANCE.md`, `docs/TECH.md`. Toàn bộ chuẩn thẩm mỹ của giai đoạn này được khóa chặt bằng **Đặc tả Kiến trúc Vector Hybrid ở mục 3.5 & `docs/ART_GUIDE.md`**, **bộ chỉ số đo tự động `metrics.json`** và **Rubric 9 tiêu chí chấm trực tiếp trên ảnh chụp game thật `1920×1080` (mục 6)** — không phụ thuộc vào ảnh pixel-art hay bản phác thảo bên ngoài để tránh hiệu ứng neo thị giác (visual anchoring).
2. **Spec:** chép prompt này thành `docs/superpowers/specs/2026-10-20-polish-v0.2.0-design.md` rồi commit. **Bỏ qua `brainstorming`**: thiết kế đã được thảo luận và tôi đã duyệt (quyết định ở 0.6); cổng HARD-GATE coi như đã qua. Chỉ quay lại brainstorming nếu phát hiện yêu cầu mâu thuẫn mà spec không trả lời được (khi đó ghi Ruling theo 0.7, không dừng).
3. **Workspace cách ly** (skill `using-git-worktrees`, tôi **đồng ý trước**, không cần hỏi lại):
   - Tạo worktree `.worktrees/polish-v0.2.0` trên nhánh mới `polish/v0.2.0` từ `master` (kiểm tra `.worktrees` đã nằm trong `.gitignore`; chưa có thì thêm và commit).
   - **Mang tài liệu chưa commit sang nhánh:** lúc viết prompt, `docs/ART_GUIDE.md` và `docs/GDD.md` đang sửa dở (chưa commit), còn `master-promt-v2.md` chưa được track trên `master`. Worktree tạo từ `master` sẽ **không có** chúng. Ngay sau khi tạo worktree: copy 3 file này từ thư mục gốc sang worktree, kiểm tra bằng `git diff --stat` là đúng bản mới, rồi commit thành commit đầu tiên của nhánh (`docs: add v0.2.0 polish spec and art direction`). Không commit lên `master`.
   - Nếu `docs/ART_GUIDE.md` mâu thuẫn với prompt này (ambient, palette ENV, rãnh B3, bán kính Astrolabe, hướng bóng đổ…), **prompt thắng**. Đồng bộ lại ART_GUIDE ngay trong P0 và ghi lý do vào commit. **Ngoại lệ duy nhất:** giá trị số đã được chỉnh qua Visual Gate và **khóa** trong ART_GUIDE mục "Phòng chuẩn" (P4 bước A) hoặc ghi trong report của phase đã tag thì thắng số xuất phát của prompt (xem 0.7, "Giá trị số cho art").
   - Chạy `pnpm install` và `pnpm verify` trong worktree để có baseline sạch. Nếu baseline đỏ: ghi lỗi vào PROGRESS, sửa theo `systematic-debugging` như một task của P0, rồi mới làm tiếp.
   - Nếu worktree gây lỗi không khắc phục được (đường dẫn, quyền, Playwright): tạo nhánh `polish/v0.2.0` ngay trong thư mục hiện tại. **Không bao giờ commit thẳng lên `master`.**
4. Thêm vào `docs/PHASES.md` mục **"Giai đoạn Polish v0.2.0"** (copy bảng phase ở mục 4) và vào `docs/PROGRESS.md` mục **"Polish v0.2.0"** (kế hoạch, giả định, quyết định, danh sách "Cần tôi xem").
5. Tạo **task artifact** (theo `antigravity-tools.md`) liệt kê 13 phase và cập nhật khi xong từng phase.
6. Mọi tham chiếu `file:line` trong prompt được cập nhật theo cấu trúc codebase đã tách module (< 1000 dòng/file) tại commit `201f56c` (HEAD `master` lúc viết prompt; chuỗi commit tách module là `638cea5` → `201f56c`). **Phải mở file kiểm chứng trước khi sửa**, vì dòng có thể dịch chuyển sau các phase trước.

**Tiếp tục sau khi mất context (compaction/phiên mới):** đọc theo thứ tự task artifact → `docs/PROGRESS.md` → plan của phase hiện tại trong `docs/superpowers/plans/` → ledger của plan đó (`.superpowers/sdd/<plan>/progress.md`) → `git log`. **Tin ledger và git hơn trí nhớ**; task đã có dòng `Task N: complete` thì không làm lại.

### 0.2 Quy trình mỗi phase (vòng lặp superpowers)
1. **Viết plan (skill `writing-plans`)** ngay trước khi bắt đầu phase (không viết trước tất cả phase, vì phase sau phụ thuộc kết quả phase trước):
   - Lưu tại `docs/superpowers/plans/YYYY-MM-DD-polish-pN-<slug>.md`, đúng header của skill.
   - `Spec:` trỏ tới file spec ở 0.1.2 và ghi rõ mục của spec mà phase này thực hiện.
   - `Global Constraints`: chép nguyên văn các ràng buộc từ 0.3, 0.6 và mục 7.
   - `Review Focus`: 5 tình huống dễ hỏng nhất, mỗi dòng gắn test vào task sở hữu.
   - Task đầu tiên của mọi phase có thay đổi hình ảnh là **chụp BEFORE** (`pnpm shots --label before`). Task cuối cùng luôn là **Visual Gate** (0.4) và **Phase Gate** (0.3).
   - Tự review plan theo checklist của skill, sửa tại chỗ.
   - **Không chờ tôi duyệt plan.** Phương thức thực thi đã chốt: **Subagent-driven**. Ghi đường dẫn plan vào PROGRESS rồi chạy luôn.
2. **Thực thi (skill `subagent-driven-development`):** pre-flight scan xung đột, ghi vào ledger → mỗi task một implementer mới → task reviewer (spec + chất lượng code) → fix loop tối đa 5 vòng → ghi `Task N: complete` vào ledger. Chạy liên tục, không hỏi "có tiếp tục không".
3. **Visual Gate (0.4)** sau khi mọi task code của phase xong: chụp AFTER → Visual Reviewer → các lỗi hình ảnh được giao cho implementer sửa thành **fix round** (controller không tự sửa) → chụp lại → review lại, tối đa 4 vòng.
4. **Phase Gate (skill `verification-before-completion`):** **chạy lại ngay lúc đó** `pnpm verify`, đo FPS, kiểm tra từng dòng DoD riêng của phase. Chỉ được ghi "xong" khi có output mới chứng minh. Báo cáo của subagent không phải là bằng chứng.
5. Cập nhật PROGRESS/PHASES/task artifact → commit (Conventional Commits) → `git tag polish-pN` trên nhánh `polish/v0.2.0` → chuyển phase tiếp theo.

### 0.3 Quality Gate cứng (DoD chung cho MỌI phase)
- `pnpm verify` xanh: typecheck, lint, test, build, e2e. Không được skip hay xóa test để "cho pass". Nếu test cũ mâu thuẫn với yêu cầu mới thì sửa test **có lý do ghi trong commit**. Bộ chụp ảnh `@visual` **không** nằm trong `pnpm verify` (tách ở P0) để gate không chậm hay flaky.
- 0 error/warning console trong E2E.
- **Hiệu năng:** đo ở chế độ **headed với GPU thật**. Ghi model GPU vào PROGRESS, lấy bằng `WEBGL_debug_renderer_info` (`UNMASKED_RENDERER_WEBGL`) ngay trong trang; nếu ra SwiftShader/ANGLE software thì kết quả không hợp lệ. Vì Phaser chạy theo `requestAnimationFrame` nên FPS bị khóa ở tần số màn hình: số đo so sánh là **frame time p50/p95 (ms)**, chạy Chromium với `--disable-gpu-vsync --disable-frame-rate-limit`, khởi động ấm 5s rồi đo 20s. Ngưỡng:
  - Stress test (`__GAME_STRESS_TEST__`, 4P + 80 quái + 600 đạn) ở 1080p High: **≥ 58 FPS trung bình khi bật vsync bình thường**, và **frame time p95 không tăng quá 15% so với baseline P0** trên cùng máy (đây là ngân sách **cộng dồn cho cả giai đoạn**; mỗi phase ghi frame time vào PROGRESS để thấy phase nào tiêu nhiều).
  - Cảnh chơi thường ≥ 60 FPS (vsync bật).
  - Không tăng heap liên tục.
- Co-op không vỡ: test phase4 (4 client qua IP LAN) vẫn pass. Mọi thay đổi chỉ mang tính hình ảnh phải **nằm ở client**, không đụng `packages/shared` sim. Thay đổi sim phải giữ tất định (seed) và có unit test.
- Ảnh before/after đã lưu, Visual Review đạt ngưỡng (0.4), `metrics.json` đạt ngưỡng của phase (nếu có).
- i18n: mọi chuỗi mới có ở cả `vi.json` và `en.json` (unit test đồng bộ khóa vẫn pass).
- Gặp bug hoặc test fail không rõ nguyên nhân: dùng skill `systematic-debugging` (tìm nguyên nhân gốc trước khi sửa). Sau 3 lần sửa hỏng cùng một lỗi thì xem lại cách thiết kế, không vá tiếp. Khi nào được dừng hỏi tôi: xem 0.7.

### 0.4 Giao thức kiểm chứng bằng hình ảnh (TRỌNG TÂM)
**Nguyên tắc:** không đoán bằng cách đọc code. Mọi thay đổi hình ảnh hoặc UI phải được **chụp từ game đang chạy thật** rồi xem bằng công cụ đọc ảnh.

1. **Hạ tầng (xây ở Phase P0):**
   - `tests/e2e/helpers/visual-scenes.ts`: danh mục **cảnh tất định**. Mỗi cảnh là một hàm dựng trạng thái qua `window.__GAME_TRANSPORT__.getSim()` (teleport, spawn, mở phòng, đặt biome, seed). Danh mục tối thiểu ở mục 5.
   - `tests/e2e/visual.spec.ts` (tag `@visual`) cùng script `pnpm shots -- --phase pN --label before|after [--scenes a,b]`. Ảnh lưu tại `docs/screenshots/polish-pN/<label>/<scene>.png`.
   - Thêm `?seed=<n>` để cố định seed và `?debug=0|1` / `?testHooks=1` (xem 3.1). Ảnh dành cho **người chơi** chụp ở `?debug=0&testHooks=1`: giao diện đúng như bản release, nhưng vẫn còn hook để dựng cảnh.
   - Thêm `?freeze=1`: seed mọi RNG phía client (particle, flicker, ambient), dùng thời gian giả cố định 1/60s mỗi frame, tắt flicker ngẫu nhiên. Mục đích là chụp lại cho ra cùng một ảnh.
   - Trước khi chụp, chờ cảnh ổn định: ít nhất 45 frame sau khi dựng và `__GAME_DEBUG__.scene` đúng.
   - **Chuyển động:** với các phase về animation, portal, FX, chụp **chuỗi khung hình** (8 frame cách nhau 80–100ms) ghép thành một ảnh strip `<scene>-strip.png`. Nếu công cụ đọc file xem được video thì thêm clip `.webm` 4–6 giây qua Playwright `recordVideo`. Phải kiểm chứng là thực sự xem được clip trước khi dựa vào nó.
   - `tools/visual-metrics.ts` (được thêm devDependency `pngjs`): đọc ảnh, lấy mẫu các vùng chữ nhật khai báo theo cảnh (tránh entity, tránh tâm vũng đèn), xuất `metrics.json`. Định nghĩa bắt buộc:
     - **Độ sáng = CIE L\* (0–100)**, tính từ sRGB.
     - **Tương phản sàn = ΔL\* (p95 − p5)**.
     - **Saturation = HSL S** (0–1).
     - Mỗi cảnh môi trường được đo hai lần: một lần với `?lighting=0` (chỉ texture, không có lightmap/PostFX) và một lần có lighting đầy đủ.
   - Thêm công cụ **pixel-diff** (ví dụ `pixelmatch`) để so sánh hai lần chụp cùng cảnh.
2. **Visual Reviewer độc lập (subagent, model `pro`):**
   - Mỗi lần review, tạo **subagent mới** (context sạch, chỉ đọc; nếu công cụ không có loại `research` thì dùng bất kỳ subagent chỉ đọc nào). Đưa cho nó **dưới dạng đường dẫn file** (không dán nội dung vào prompt): mục tiêu của phase, đặc tả kỹ thuật tương ứng trong spec & `docs/ART_GUIDE.md`, rubric ở mục 6, `metrics.json`, và ảnh của hai phiên bản **được copy sang tên ngẫu nhiên A/B** (không ghi before/after, để tránh thiên vị). Với phase môi trường sau khi phòng chuẩn B1 đã khóa (P4 bước A), đưa thêm ảnh phòng chuẩn, ghi rõ là "ảnh tham chiếu phong cách", không phải A hay B. Bảng ánh xạ A/B do bạn giữ. **Không đưa code, không đưa lời tự đánh giá của bạn, không dặn trước "đừng bắt lỗi X".**
   - Reviewer trả về điểm 1–10 cho từng tiêu chí của từng phiên bản, danh sách lỗi (vị trí ước lượng trên ảnh, mức độ: blocker/major/minor) và đề xuất sửa.
   - **Ngưỡng đạt:** không có blocker, không có major. Tiêu chí liên quan tới phase đạt ≥ 8/10. Các tiêu chí khác **không giảm quá 1 điểm** so với BEFORE (chấp nhận điểm LLM dao động ±1).
   - **Sửa lỗi hình ảnh:** gom toàn bộ lỗi blocker/major của một vòng thành **một** fix dispatch cho implementer (vòng 1–3 gửi tiếp cho implementer cũ nếu còn, vòng 4 dùng implementer mới với model cao hơn). Controller không tự sửa code. Lỗi minor ghi vào ledger dạng `Visual: minor (deferred): …` để review cuối P12 phân loại.
   - **Tối đa 4 vòng review mỗi phase.** Sau vòng 4, xử lý từng lỗi còn mở theo luật breaker của SDD:
     - Lỗi thật nhưng không phase nào sau phụ thuộc: **park** với dòng `Ruling:` trong ledger, thêm vào danh sách **"Cần tôi xem"** trong PROGRESS (kèm ảnh), rồi **làm tiếp**.
     - **Phase thất bại thật** (từ 2 tiêu chí của phase trở lên vẫn < 7, hoặc còn blocker): **dừng và hỏi tôi**, kèm ảnh A/B, điểm và 2–3 phương án.
   - Không được cãi Reviewer để qua phase. Chỉ được bác bỏ một nhận xét khi có bằng chứng ảnh, và phải ghi `Ruling:` vào ledger.
   - Lưu kết quả vào `docs/screenshots/polish-pN/review-<iteration>.md`.
3. **Ghi chép:** PROGRESS của mỗi phase phải liệt kê cặp ảnh before → after và điểm review cuối cùng. Câu kiểu "đã kiểm tra bằng mắt, đẹp" mà không có đường dẫn ảnh và điểm review sẽ bị coi là **chưa làm**.

### 0.5 Điều phối nhiều agent (theo `subagent-driven-development`)
- **Controller (bạn):** viết plan, dispatch, quản lý ledger, chạy gate, ra Ruling. **Không tự sửa code trong phiên controller**, kể cả fix nhỏ: mọi sửa đổi đi qua implementer và được review.
- **Implementer:** subagent `self`, **một subagent mới cho mỗi task**, dispatch bằng file brief (`task-brief`) kèm đường dẫn file report. Implementer theo TDD (0.7) và **không được tự tạo subagent** (kể cả reviewer).
- **Task reviewer:** subagent mới sau mỗi task, nhận brief, report và review package (diff); trả về hai kết luận: spec compliance và chất lượng code.
- **Visual Reviewer:** subagent `research`, model `pro`, tạo mới mỗi lần review (0.4).
- **Balance Analyst:** subagent chạy harness và phân tích số liệu ở Phase P11 (chỉ đọc kết quả, không sửa code).
- **Chỉ một implementer chạy tại một thời điểm** (cấm implementer song song). Được chạy song song các việc **chỉ đọc**: nghiên cứu, Visual Reviewer, phân tích số liệu (skill `dispatching-parallel-agents`).
- **Chọn model rõ ràng mỗi lần dispatch** (không để mặc định):

| Vai trò | Model |
|---|---|
| Implementer task cơ học (1–2 file, spec đầy đủ: hằng số, i18n, test) | `flash` |
| Implementer tích hợp nhiều file, sim/co-op, shader, art | `inherit` |
| Implementer fix vòng 4–5, task thiết kế khó | `pro` |
| Task reviewer | `flash` cho diff nhỏ; `inherit` cho diff sim/co-op/render |
| Visual Reviewer, review toàn nhánh cuối P12 | `pro` |

- Gom các thay đổi nhỏ cùng kiểu (ví dụ đổi i18n ở nhiều file) thành **một** dispatch.
- **Giữ kỷ luật kiến trúc module hóa (< 1000 dòng/file):** Codebase đã được tách thành các module chuyên biệt trong `apps/client/src/scenes/game-scene/`, `packages/shared/src/sim/`, `apps/client/src/art/` và `apps/client/src/fx/`. Code mới đặt trong module con phù hợp hoặc tạo module mới (`apps/client/src/ui/…`, `fx/…`, `world/…`), chỉ móc gọn vào `GameScene.ts` (707 dòng) và `world-sim.ts` (464 dòng). Không tạo lại file > 1000 dòng và không refactor lớn ngoài phạm vi phase. Khi plan có task chạm vào file nào, ghi rõ đường dẫn module con và khoảng dòng trong mục `Files:` của task.

### 0.6 Quyết định đã chốt với tôi (không hỏi lại)
| Chủ đề | Quyết định |
|---|---|
| Palette | **Được mở rộng**: thêm nhóm màu `ENV` trầm (saturation ≤ 35%) vào `palette.ts`, cập nhật `ART_GUIDE.md` (ghi rõ là thay đổi convention). |
| Tầm nhìn & Sương mù | **Full-Screen Clear Visibility (Bỏ sương mù mặc định & bỏ fog-of-war):** Xóa hoàn toàn hạt sương mù `fx_ambient_mist`, bỏ giới hạn vòng tròn tầm nhìn tối quanh người chơi (`mainPlayerVisionRadius`, `allyVisionRadius`) và tắt vignette đen ở viền màn hình theo mặc định (`vignetteStrength = 0.0`). Không vùng nào bị che tối. **`ambientColor` ~0.84–0.90** (trung bình kênh; không lên 0.92+ và không xuống dưới 0.84): lightmap blend MULTIPLY bị kẹp ở 1.0, nên phải chừa 10–16% dư địa để vũng sáng đuốc/cổng/rương **nhìn thấy được**. Không thấp hơn 0.84 vì MULTIPLY nhân trên giá trị sRGB nên L\* giảm nhanh hơn tỉ lệ ambient (ambient 0.82 trên sàn B1 chỉ giữ ~83% L\*, trượt ngưỡng góc màn hình ở 3.5). Sắc ấm/lạnh của đèn được vẽ bổ sung ở lớp glow ADD phía trên lightmap (3.2). |
| Bão tuyết Boss 2 (`blizzardVeil`) | Đây là **cơ chế phase 3 của Boss 2 Kryssa** (`sim-enemies-core.ts:639`), không phải sương mù trang trí. **Giữ trạng thái nhưng bỏ phần làm tối** (ambient `0x3e5672`, vignette 0.38). Thay bằng: tuyết dày gấp 3 thổi xiên theo gió, color grade lạnh nhẹ (L\* trung bình giảm ≤ 5%), viền sương giá mỏng ở mép màn hình (alpha ≤ 0.12, không đen), kèm banner/âm thanh lúc bắt đầu. |
| Hướng sáng | **Một key light toàn cục từ góc trên-trái.** Trong prompt này, `-135°` luôn chỉ **vị trí nguồn sáng** (tọa độ màn hình, y hướng xuống). Rim-light nằm ở cạnh trên-trái; mọi bóng đổ bake (tường, cột, trụ, decor) đổ về **dưới-phải (+45°, Đông–Nam)**. Đuốc/chậu lửa/cổng chỉ tạo vũng sáng, **không tạo bóng đổ**. |
| Ngữ nghĩa hình ảnh | **Hình ảnh = ngữ nghĩa sim.** Thứ trông như hazard (dung nham, độc, băng trơn) phải là surface thật trong sim. Thứ trông như vật cản (cột, bệ, đe, bánh răng lớn) phải nằm trên ô `wall`/`pillar` của sim hoặc gắn vào mặt tường. Decor chỉ có ở client mà nằm trên ô đi được thì phải **phẳng**: không viền INK, không đổ bóng, ΔL\* ≤ 10. |
| Quy trình art | **Vertical slice trước, nhân rộng sau:** P4 dựng hoàn chỉnh **1 "phòng chuẩn"** (B1 combat) đạt Visual Gate rồi khóa làm chuẩn phong cách, sau đó mới áp dụng cho biome khác (xem P4/P5). |
| Kiến trúc Map & Nhân vật | **Hybrid Map Architecture ("Chi tiết ven tường, Tĩnh lặng giữa tâm" — P4 + Style A + Bản sắc Biome P1/P2/P3)** kết hợp **Cutout Rig 2.0** (shading 2 lớp + highlight vật liệu + rim-light `-135°`, quái full rig) và **Surface / Phản ứng Nguyên Tố kiến trúc**. |
| Camera | **Giữ vùng nhìn cơ sở 960×540.** Phải sửa lỗi zoom không đồng đều (xem P3). |
| Độ khó | **Khó vừa kiểu Soul Knight:** boss 60–120 giây, thỉnh thoảng bị gục nhưng solo vẫn qua được, có đợt quái chồng nhau, boss có giai đoạn nổi điên. |
| Debug | Dev luôn bật. Bản `.exe` bật qua `?debug=1`, cờ `--debug` hoặc **Ctrl+Shift+D** (lưu localStorage). Server khóa lệnh debug khi không ở chế độ debug. |
| Vũ khí | **2 ô.** Nhặt vũ khí khi đầy thì vũ khí đang cầm **rơi ra đất**. |
| Superpowers | Bỏ brainstorming (spec đã duyệt); worktree `.worktrees/polish-v0.2.0` nhánh `polish/v0.2.0`; thực thi **Subagent-driven**; không chờ duyệt plan từng phase. |

### 0.7 Bản đồ skill Superpowers cho giai đoạn này
| Thời điểm | Skill | Điều chỉnh riêng cho dự án |
|---|---|---|
| Bắt đầu mọi phiên | `using-superpowers` | Đọc `references/antigravity-tools.md`. |
| Đầu giai đoạn | `brainstorming` | **Bỏ qua**: prompt này là spec đã duyệt (0.1.2). |
| Đầu giai đoạn | `using-git-worktrees` | Đã có đồng ý trước (0.1.3). |
| Đầu mỗi phase | `writing-plans` | Một plan cho mỗi phase, viết ngay trước phase (0.2.1). Task art dùng "test hình ảnh" (dưới). |
| Thực thi phase | `subagent-driven-development` | Thêm Visual Gate cấp phase (0.4). |
| Mọi task logic | `test-driven-development` | Bắt buộc RED → GREEN → REFACTOR. |
| Bug / test fail | `systematic-debugging` | Tìm nguyên nhân gốc trước khi sửa. |
| Đọc số liệu song song | `dispatching-parallel-agents` | Chỉ cho việc chỉ đọc. |
| Trước khi nói "xong" | `verification-before-completion` | Phase Gate (0.2.4). |
| Nhận review | `receiving-code-review` | Kiểm chứng kỹ thuật trước khi làm theo, không đồng ý cho có. |
| Cuối P12 | `requesting-code-review` + `finishing-a-development-branch` | Review toàn nhánh bằng `pro`, rồi đưa tôi menu 3 lựa chọn và chờ. |

**TDD cho từng loại task:**
- **Logic** (`packages/shared`, server, debug flag, `findInteractTarget`, vũ khí, harness, scaling, input, i18n): TDD nghiêm ngặt, test viết trước và phải thấy fail đúng lý do.
- **Render/art/shader/UI layout:** tôi **cho phép ngoại lệ TDD** theo cách sau. "Test" là cảnh chụp tất định cộng ngưỡng đo được. RED = chạy `pnpm shots` + `visual-metrics` trên code cũ và thấy fail ngưỡng (ví dụ ΔL\* sàn > 14). GREEN = cùng lệnh đó đạt ngưỡng. Phần không đo bằng số được thì test là **e2e assert hành vi** (object tồn tại, label ẩn/hiện theo khoảng cách, không có chữ debug khi `?debug=0`) cộng Visual Gate.
- Giá trị số cho art trong spec (màu, bán kính, alpha) là **điểm xuất phát**. Plan ghi đúng các giá trị đó; implementer được chỉnh trong lúc lặp Visual Gate, và ghi giá trị cuối cùng vào report.
- **Thứ tự ưu tiên giá trị art (chống trôi ngược):** giá trị đã khóa trong `docs/ART_GUIDE.md` mục "Phòng chuẩn" > giá trị cuối trong report của phase đã tag > số xuất phát trong spec. Khi viết plan cho phase sau, controller lấy giá trị từ ART_GUIDE/report trước, **không chép lại số xuất phát của spec** cho thứ đã khóa. Muốn đổi giá trị đã khóa thì phải có `Ruling:` kèm ảnh chứng minh, và cập nhật lại ART_GUIDE trong cùng commit.

**Script của SDD trên Windows:**
- Chạy bằng Git Bash: `& "C:\Program Files\Git\bin\bash.exe" <thư-mục-skill>/scripts/<script> <tham số>`. **Không dùng** `C:\Windows\system32\bash.exe` (đó là WSL, lỗi đường dẫn Windows).
- Nếu script vẫn lỗi, dùng phương án thủ công của skill: brief là đoạn task chép ra file; review package là `git log --oneline`, `git diff --stat` và `git diff -U10` của khoảng BASE..HEAD ghi vào một file.

**Khi nào dừng hỏi tôi** (ngoài những lúc này thì ra `Ruling: <quyết định> — <lý do> — <cái giá nếu sai>` trong ledger và làm tiếp):
1. Thao tác không đảo ngược được hoặc phá hủy dữ liệu (xóa nhánh, force-push, xóa file ngoài phạm vi).
2. Thao tác liên quan bảo mật.
3. Merge vào `master`, push, publish.
4. Plan hỏng tới mức mọi hướng đi đều là đoán.
5. **Phase thất bại về hình ảnh** sau 4 vòng (0.4).
6. Thay đổi phạm vi lớn so với spec (ví dụ phải bỏ hẳn một yêu cầu của tôi).
7. **Điểm dừng duyệt phong cách sau P4 bước A** (phòng chuẩn B1 đã qua Visual Gate, trước khi khóa và nhân rộng): xem P4. Đây là điểm dừng duy nhất được lên kế hoạch trước.

**Báo cáo cuối giai đoạn** phải có mục **"Các Ruling tôi đã tự quyết"**: toàn bộ dòng `Ruling:` trong mọi ledger theo thứ tự thời gian, mỗi dòng kèm cái giá nếu sai.

---

## 1. HIỆN TRẠNG ĐÃ NGHIÊN CỨU (tại commit `201f56c`, phải kiểm chứng lại)

**Kiến trúc chung (đã tách thành các module < 1000 dòng)**
- `apps/client/src/scenes/GameScene.ts` (707 dòng) + 10 file subsystem trong `apps/client/src/scenes/game-scene/`:
  - `arena-tiles.ts` (711 dòng): render tile, camera zoom (`:523-530`, `:630`), fallback icon vũ khí khi resize (`:573-577`), gắn/dọn `window.__GAME_*` hook (`:140-165`, `:211-218`).
  - `entity-sync.ts` (536 dòng): đồng bộ rig người chơi/đồng đội/quái (`syncSimulatedPlayersImpl`, `syncEnemyRigsImpl`), nameplate trên đầu (`:19-93`, `:160-187`), `useFastComposite` (`:246`).
  - `hud-combat-and-coop.ts` (750 dòng): `updateVectorHudImpl`, `hudContainer.setPosition` (`:62-63`), cập nhật 4 ô vũ khí & fallback vũ khí ma (`:255-300`), thanh HP/giáp/NL, HUD co-op, HUD boss.
  - `hud-hub-and-cards.ts` (538 dòng): bảng mời Hub, thẻ so sánh vũ khí `updateWeaponComparisonCardImpl` (`:412-537`).
  - `hud-modals-and-debug.ts` (552 dòng): modal thắng/thua/chọn buff, text debug overlay.
  - `hud-setup-and-pause.ts` (583 dòng): `hudContainer` depth 900 (`:16-18`), gợi ý F1-F7 (`:73`, `:417-418`), nút `[Art Gallery]` (`:121`), tạo 4 ô vũ khí (`:157-216`), modal tạm dừng.
  - `input-and-network.ts` (581 dòng): xung đột phím số 1–4 đổi vũ khí + bắn emote (`:132-180`), phím debug F2–F9, R, G (`:182-265`).
  - `room-entities-sync.ts` (529 dòng): `syncRoomEntitiesImpl` (`:15-528`), cửa (`:221-294`), rương (`:297-321`), vật phẩm/merchant (`:324-424`), portal pulse/xoay (`:489-527`).
  - `sim-events.ts` (476 dòng): SFX, hit-stop, popup phản ứng nguyên tố (`:382-418`).
  - `telegraphs-and-overlays.ts` (705 dòng): telegraph, cột sáng độ hiếm (`:57-80`), hitbox debug (`:647-704`).
- `packages/shared/src/sim/world-sim.ts` (464 dòng) + 14 module trong `packages/shared/src/sim/`:
  - `world-sim-types.ts` (519 dòng): `PHASE1_SAMPLE_WEAPONS` 4 vũ khí (`:7-12`).
  - `world-sim-events.ts` (340 dòng): event `weapon_swapped` thiếu `playerId` (`:111`).
  - `sim-coop-hub.ts` (766 dòng): loadout khởi đầu 4 vũ khí (`:18-24`, `:352-358`), `dropActiveWeaponImpl` (`:672-698`).
  - `sim-dungeon-rooms.ts` (774 dòng): kiểm tra `weaponSlots.length < 4` & ghi đè vũ khí cũ (`:755-769`), `item.pickedUp = true` không xóa khỏi mảng (`:727`), phát `weapon_swapped` (`:765-768`).
  - `sim-progression-bot.ts` (801 dòng): `interactWithNearestImpl` (`:214-335`, ưu tiên cố định `interactRange = 64`), vòng lặp bot autoplay nhặt đồ miễn phí (`:500-523`).
  - `sim-player.ts` (776 dòng): đi bộ chạm cửa tự chuyển phòng (`:340-360`).
  - `sim-enemies-core.ts` (660 dòng) + `sim-enemies-biome1/2/3.ts`: lỗi tốc bắn co-op bị áp 2 lần (`getCoopEnemyCooldownScaleImpl` ở `sim-enemies-core.ts:245-250`, nhân khi giảm cooldown mỗi tick `:263`, và nhân lần nữa khi gán cooldown ở `sim-enemies-biome1.ts:53-56` v.v.).
  - `sim-props-spawning.ts` (805 dòng): stress test 4 ô vũ khí (`:150`, `:158-163`), `weapon_swapped` (`:247-250`), `spawnEnemyImpl` (`:327-418`).
- `apps/client/src/fx/lighting-pipeline.ts` (526 dòng): lightmap và PostFX.
- `apps/client/src/art/texture-baker.ts` (425 dòng) + 5 sub-bakers trong `apps/client/src/art/`: `texture-baker-canvas.ts` (36 dòng), `texture-baker-tiles.ts` (532 dòng), `texture-baker-props.ts` (548 dòng), `texture-baker-surfaces.ts` (575 dòng), `texture-baker-fx.ts` (495 dòng).
- `apps/client/src/art/cutout-rig.ts` + `rig-defs.ts` (161 dòng) + `rig-types.ts` + 14 file định nghĩa rig (`rig-defs-heroes-1/2.ts`, `rig-defs-biome1/2/3-*.ts`, `rig-defs-weapons-1/2.ts`).
- `apps/client/src/scenes/ArtGalleryScene.ts` (418 dòng, `setZoom` tại `:394-396`) + `art-gallery-pages.ts` (831 dòng).
- `apps/client/src/fx/combat-fx.ts` (833 dòng, cập nhật ambient `:87-123`, chữ sát thương/phản ứng `:430-524`) + `combat-fx-pools.ts` (498 dòng, pool sương mù `mist` tại `:142-161`).
- `tools/balance-harness.ts` (399 dòng) + `tools/balance-simulations.ts` (696 dòng).

**Lighting & Sương mù (`lighting-pipeline.ts`, `combat-fx-pools.ts`, `combat-fx.ts`)**
- Lightmap là RenderTexture 0.25 res, blend MULTIPLY, depth 34. Danh sách đèn được dựng lại mỗi frame trong `update()` (`lighting-pipeline.ts:274-515`).
- **Lỗi 1:** `brushSprite` (`lighting-pipeline.ts:159`) không đặt `BlendMode.ADD`, nên đèn chồng nhau ghi đè thay vì cộng (gây vệt xanh lá ở biome băng).
- **Lỗi 2 (Sương mù & giới hạn tầm nhìn làm mờ màn hình):**
  - Trong `combat-fx-pools.ts:142-161` và `combat-fx.ts:87-123`, hệ thống tạo 8 đám mây sương mù lớn `fx_ambient_mist` (`scale * 1.8`, `alpha 0.35`) trôi ngang màn hình, gây đục nền và mỏi mắt.
  - Trong `lighting-pipeline.ts`, nền `BIOME_AMBIENT_COLORS` tối (`0x72918b`, `0x6c89ab`, `0x90695e` tại `:118-122`, hoặc `0x3e5672` khi `blizzardVeil` tại `:347`) kết hợp vẽ vòng tròn tầm nhìn `mainPlayerVisionRadius = 310` (`:381-383`) và `vignetteStrength = 0.18 / 0.38` (`:327`), làm vùng ngoài bán kính 310u và 4 góc màn hình bị tối mờ như sương mù che khuất.
  - `blizzardVeil` được bật bởi sim (`blizzardVeilActive`, `sim-enemies-core.ts:639`) ở phase 3 của Boss 2 Kryssa, cùng lúc với `applyBossPhase3BlizzardBorder()`. Đây là **dấu hiệu của cơ chế boss**: chỉ bỏ phần làm tối, phải giữ hiệu ứng nhận biết (0.6).
- **Giới hạn của lightmap MULTIPLY:** giá trị lightmap bị kẹp ở 1.0. Ambient càng gần 1.0 thì đèn càng ít dư địa để sáng hơn nền, nên vũng sáng đuốc sẽ biến mất. Ngược lại, MULTIPLY nhân trên giá trị sRGB (Phaser không có linear workflow) nên L\* sàn tối giảm mạnh hơn tỉ lệ ambient: với sàn ENV, ambient đồng đều 0.80 / 0.84 / 0.88 giữ lại ~79% / ~84% / ~88% L\*. Đây là lý do ambient chốt ở ~0.84–0.90 (0.6), và vũng sáng `+8` dựa chủ yếu vào lớp glow ADD phía trên lightmap (3.2).
- Sàn hiện tại và palette ENV bản nháp rất tối: B3 `#3A2B27` có L\* ≈ 19, B1 `#2E4038` có L\* ≈ 25, trong khi viền nhân vật `INK_DARK #141019` có L\* ≈ 5. Viền đen chìm vào sàn, silhouette chỉ còn trông vào rim-light.
- Max đèn 48/28/12 theo quality. Đèn bị cắt theo thứ tự vẽ.
- Chỉ có prop (torch/mushroom/crystal/mechanism/barrel) và surface phát sáng. **Rương, cổng dịch chuyển, cửa, vũ khí/vật phẩm dưới đất, pickup, merchant, shrine, tượng ở Hub đều KHÔNG phát sáng.**
- Sprite tương tác nằm dưới lightmap (depth 16–27) nên bị tối. Label (depth 45/46) luôn sáng.
- PostFX `BiomePostFxPipeline` (`lighting-pipeline.ts:16-105`): contrast 1.04, bloom 2-tap gây bóng ma, vignette 0.18. **HUD là `hudContainer` depth 900 nằm trong main camera** (`hud-setup-and-pause.ts:16-18`), được dời theo camera mỗi frame (`hud-combat-and-coop.ts:62-63`). Vì vậy PostFX **chắc chắn** áp lên HUD và HUD cũng bị méo theo zoom không đều. Lightmap (depth 34) thì không áp lên HUD.

**Prompt tương tác**
- `interactWithNearestImpl` (`sim-progression-bot.ts:214-335`): `interactRange = 64` là hằng **cục bộ**. Hàm chọn **phần tử đầu tiên khớp** theo ưu tiên cố định (statue → mechanism → chest → worldItem → shrine → portal → door), **không phải** phần tử gần nhất.
- Không có NPC merchant để tương tác: hàng bán là `worldItem` có `offerId`/`costGold`.
- Client không có helper "đối tượng tương tác gần nhất". Mọi label tạo trong `syncRoomEntitiesImpl` (`room-entities-sync.ts:15-528`) và **luôn hiển thị**. Rương (`:297-321`) không có label. Cửa cũng tự chuyển phòng khi đi vào (`sim-player.ts:340-360`).

**Portal / cửa**
- Texture tĩnh ở `texture-baker-props.ts`: `door_open`/`door_locked` (`:433-485`) là ô vuông xanh/đỏ; `portal_active` (`:487-545`) là vòng tím + lõi cyan.
- Portal chỉ có pulse scale và xoay (`room-entities-sync.ts:489-527`). Cửa (`:221-294`) **không có animation**, chỉ đổi texture.
- Chỉ có một shader PostFX camera, chưa có shader per-object.

**Vũ khí**
- Giới hạn `weaponSlots.length < 4` duy nhất ở `sim-dungeon-rooms.ts:755`. Loadout khởi đầu 4 vũ khí (`world-sim-types.ts:7-12`, `sim-coop-hub.ts:18-24`, `:352-358`, stress test `sim-props-spawning.ts:150`, `:158-163`).
- Khi đầy, vũ khí cũ **biến mất** (`sim-dungeon-rooms.ts:755-769`). Đã có sẵn `dropActiveWeaponImpl` (`sim-coop-hub.ts:672-698`) dùng `resolveCircleCollision`.
- HUD lặp `PHASE1_SAMPLE_WEAPONS.forEach` thành 4 ô (`hud-setup-and-pause.ts:157-216`, `hud-combat-and-coop.ts:255-300`), có fallback "vũ khí ma" (`arena-tiles.ts:573-577`, `hud-combat-and-coop.ts:268`).
- Phím 1–4 vừa chọn ô vũ khí vừa bắn emote trong co-op (`input-and-network.ts:132-180`). i18n ghi "[G/X]" sai phím.
- Bot autoplay nhặt mọi item free trong 56u (`sim-progression-bot.ts:500-523`), nên **sẽ lặp vô hạn** nếu vũ khí rơi ra rồi lại được nhặt.
- `worldItems` chỉ gán `item.pickedUp = true` chứ không bao giờ xóa (`sim-dungeon-rooms.ts:727`), nên snapshot phình dần.
- Event `weapon_swapped` không có `playerId` (`world-sim-events.ts:111`, `sim-dungeon-rooms.ts:765-768`, `sim-props-spawning.ts:247-250`).

**Debug**
- Không có cơ chế ẩn: không dùng `import.meta.env`, không có `?debug`. `initGlobalDebugState()` (`ui/debug-overlay.ts`) luôn chạy.
- HUD luôn hiện hàng "WASD… F1-F7: Debug" (`hud-setup-and-pause.ts:73`, `:417-418`), nút `[Art Gallery]` (`:121`), `[G] Đồ Họa`, `[R] Ng.Tố`, chỉ số DPS.
- Menu có "Bộ Sưu Tập", "Đổi Hoạt Ảnh", footer chuỗi test dấu và gợi ý F1 (`MenuScene.ts:452-579`).
- Phím F2–F9, R và G (`input-and-network.ts:182-265`). Các hook `window.__GAME_*` (`GameScene.ts:58-65`, `arena-tiles.ts:140-165`, cleanup `:211-218`).
- **Server nhận `debug_cmd`/`set_god_mode`/`skip_waves`/`set_bot_autoplay` từ bất kỳ client nào** (`CoopRoom.ts:204-300`).
- Launcher C# (`tools/package-release.ts:206-232`): khi có tham số thì **bỏ `--host`**.
- E2E phase8 chạy bản release thật và dùng các hook này. `hello_welcome` gửi từ `apps/server/src/rooms/HelloRoom.ts:54`. Phiên bản `v0.1.0` hardcode ở `tests/e2e/phase8.spec.ts:8-10`, launcher và banner server.

**Đồ họa**
- Sàn (`bakeBiomeTile` tại `texture-baker-tiles.ts:17-107`): mỗi ô có viền INK 1.4u, ellipse shade hình "C", bevel sáng, chấm glow/nứt ở ~1/4 số ô.
- Palette biome (`palette.ts:89-117`) quá bão hòa. Biome 2 dùng COBALT #1D4ED8 và bevel CYAN.
- Tường (`bakeWallTile` tại `texture-baker-tiles.ts:113-267`) có `cliffH = 7` (`:142`) và mặt đứng gần đen, chấm glow trên mọi ô tường (`:200-203`), `bakePillarTile` (`:269-432`), `bakeWallAoOverlay` (`:493-531`). Surface (`texture-baker-surfaces.ts`: lava/độc/băng/băng chuyền) bão hòa tối đa.
- Ambient lightmap tối 45–55%.
- **Surface động phủ dải ven tường:** phase 3 của cả 3 boss (`arena-map.ts:256-300`: `applyBossPhase3ToxicBorder` / `BlizzardBorder` / `LavaBorder`) biến vòng ngoài (`tx <= 3`, `ty <= 2` tính từ mép) thành `poison_swamp`/`ice`/lava giữa trận. Đây trùng với dải ven tường `distToWall <= 2` nơi đặt decor (3.5). Ngoài ra còn surface sinh ra trong trận (Cầu Nguyên Tố, Golem Than để lại sàn cháy…).
- Camera `setZoom(width/960, height/540)` **không đồng đều**, gây méo hình ở màn hình khác 16:9 (`arena-tiles.ts:523-530`, `:630`, `MenuScene.ts:785`, `ArtGalleryScene.ts:394-396`).

**Rig nhân vật (`cutout-rig.ts`, `rig-defs.ts`, `entity-sync.ts`)**
- 8 bộ phận, chỉ có idle/run dạng sin. Đổi state bị giật (snap).
- Không có pose attack/hurt/cast, không chớp mắt, thân không nghiêng theo hướng chạy (trái với ART_GUIDE), vũ khí chỉ xoay `aim*0.65`.
- Quái dùng `useFastComposite` (`entity-sync.ts:246`) là một sprite nhún.

**FX (`combat-fx.ts`, `combat-fx-pools.ts`, `sim-events.ts`, `telegraphs-and-overlays.ts`)**
- Không dùng `BlendModes.ADD` ở đâu. Tuyết là mảnh băng sắc trôi thẳng, nằm dưới lightmap. Sương mù `fx_ambient_mist` (`combat-fx-pools.ts:142-161`) làm đục màn hình.
- Hạt ambient B3 hiện dùng texture `fx_spark` (`combat-fx-pools.ts:241`): đây là ứng viên số 1 bị nhầm với đạn địch, phải thay theo 3.9.
- Popup chữ chồng nhau ("HƠI NƯỚC! +12" ×2, "8!5!" tại `combat-fx.ts:430-524`, `sim-events.ts:382-418`).

**Cân bằng (`balance-harness.ts`, `balance-simulations.ts`, `sim-enemies-core.ts`)**
- `tools/balance-simulations.ts` **nhân HP giả**: boss ×13–45 (`encounterScale` `:518-545`), phòng ×2.8–5.7 (`roomFactor` `:357-360`), bot `godMode = true` (`:249`, `:333`), boss tự hồi máu. Mục "+25%/biome" chỉ là hằng số.
- Runtime: boss 420/520/620 HP chết trong 5–13 giây. Chỉ có 3 phòng combat mỗi tầng, đợt sau chờ đợt trước chết hết. Đạn địch 245–315 u/s.
- Boss bị đóng băng/choáng không có kháng. Vàng dư thừa.
- **Lỗi:** tốc bắn co-op bị nhân 2 lần (`getCoopEnemyCooldownScaleImpl` ở `sim-enemies-core.ts:245-250`, vừa áp ở tick `:263` vừa áp khi gán cooldown ở `sim-enemies-biome1.ts:53-56` và biome 2/3).
- Docs lệch code (BALANCE.md ghi boss 380/450/520).

---

## 2. MỤC TIÊU CHẤT LƯỢNG (TÓM TẮT)
1. **Tầm nhìn toàn màn hình trong trẻo 100% (Full-Screen Clear Visibility) & Kiến trúc Map Hybrid có chiều sâu:**
   - **Bỏ hoàn toàn sương mù mặc định (`fx_ambient_mist`) và bỏ giới hạn vòng tròn tầm nhìn tối (`mainPlayerVisionRadius`, phần làm tối của `blizzardVeil`, `vignetteStrength = 0.0`):** Người chơi nhìn rõ toàn bộ căn phòng từ tâm ra 4 góc màn hình mà không bị che mờ. Chiều sâu đến từ vũng sáng đuốc nhìn thấy được (ambient ~0.84–0.90) và bóng đổ nhất quán một hướng, không đến từ bóng tối.
   - **Triết lý Map "Chi tiết ven tường, Tĩnh lặng giữa tâm" (Hybrid P4 + Style A + Bản sắc Biome P1/P2/P3):** Vùng chiến đấu giữa phòng phẳng mịn tương phản cực thấp (`ΔL* ≤ 6–8`, mạch gạch mờ dần vào tâm), ven tường đón ánh đuốc ấm từ các chậu lửa (số lượng theo loại phòng) kèm lưới thoát nước sắt lõm và bóng đổ về dưới-phải (nguồn sáng `-135°`), tường 3D 3 lớp rõ mặt trên/mặt đứng, và mỗi Biome mang dấu ấn kiến trúc riêng, **nhìn 1 giây là biết biome nào** (B1 rễ cây cổ thụ Bezier tràn tường & đá bước chân đầm độc, B2 đá teal dịu + vòng cổ ngữ băng Astrolabe khắc chìm & luồng sáng God-rays, B3 đá bazan + bánh răng cơ khí đồng thau & rãnh nhiệt có nắp lưới sắt ven tường).
   - **Hình ảnh không được nói dối gameplay:** decor không được trông như hazard/vật cản mà sim không có (0.6).
2. **Thứ tự nổi bật thị giác** (luôn đúng): đạn địch và telegraph > nhân vật người chơi (Cutout 2.0 có rim-light `-135°`) > quái (full rig) > vật phẩm tương tác (có glow) > hiệu ứng nguyên tố > môi trường. Đạn địch phải phân biệt được **bằng hình dạng**, không chỉ bằng màu, kể cả ở B3 nơi nền có nhiều cam/đỏ (3.9).
3. **Giao diện gọn:** khi đứng xa không có chữ, chỉ có ánh sáng gợi ý. Khi lại gần mới hiện `[E] Tên`. HUD hiện đại, nhất quán, không còn thứ gì của debug.
4. **Mượt và chi tiết:** animation Cutout 2.0 có crossfade, secondary motion dạng spring, FX và bề mặt nguyên tố dùng `BlendMode.ADD` đúng cách, portal và cửa trông "ma thuật".
5. **Kịch tính:** áp lực đợt quái chồng nhau, boss có phase transition và enrage, số liệu được đo thật.

---

## 3. ĐẶC TẢ CHI TIẾT THEO HẠNG MỤC

### 3.1 Chế độ Debug
- Tạo `apps/client/src/core/debug-flag.ts` với **hai cờ tách biệt**:
  - `debugUi` (UI, phím, lệnh debug) = `import.meta.env.DEV` (thêm `/// <reference types="vite/client" />`) **OR** `?debug=1` **OR** `localStorage['ashen_pact_debug']==='1'`. `?debug=0` **ép tắt** kể cả khi ở dev, để chụp ảnh giao diện người chơi.
  - `testHooks` (các hook `window.__GAME_*` cho e2e và dựng cảnh chụp) = `debugUi` **OR** (`import.meta.env.DEV` và `?testHooks=1`) **OR** server báo đang chạy `--debug`. Trong bản release chạy mặc định (không `--debug`), `testHooks` **luôn tắt**.
- **Ctrl+Shift+D** bật/tắt `debugUi` và lưu vào localStorage. Phải `preventDefault`, vì tổ hợp này trùng phím "Bookmark all tabs" của Chrome/Edge. Khi bật có toast "Debug ON/OFF".
- Khi `debugUi` tắt thì ẩn hoặc vô hiệu hóa:
  - Phím F1–F9 (giữ F11 fullscreen nếu có), phím G (chất lượng đồ họa vẫn chỉnh trong Settings).
  - Panel `DebugOverlay`.
  - Hàng gợi ý "F1-F7: Debug", nút `[Art Gallery]`, `[G]`, chỉ số DPS trên HUD.
  - "Bộ Sưu Tập", "Đổi Hoạt Ảnh", chuỗi test dấu và gợi ý F1 ở Menu.
  - Toàn bộ ArtGalleryScene và các URL `?biome=`/`?hub=`/`?scene=gallery`/`?gallery=1`.
- Khi `testHooks` tắt thì không expose `window.__GAME_*`. Riêng `__GAME_DEBUG__` luôn tồn tại ở dạng **chỉ đọc**, vì auto-quality cần FPS và e2e cần chờ trạng thái. Phải giữ **mọi field mà e2e đang đọc** (`scene`, `fps`, `serverConnected`, `inHub`, `coopPlayerCount`, `errors`, …). Liệt kê bằng cách grep `__GAME_DEBUG__` trong `tests/e2e` trước khi sửa.
- `[R] Ng.Tố`: tra GDD. Nếu đổi nguyên tố thủ công không phải cơ chế gameplay thì coi là debug.
- **Server:** cờ CLI `--debug` hoặc env `ASHEN_PACT_DEBUG=1`. Khi tắt, server bỏ qua `debug_cmd`/`set_god_mode`/`skip_waves`/`set_bot_autoplay` và log cảnh báo. Thông báo `debugAllowed` cho client trong `hello_welcome` (HelloRoom.ts:54); UI debug ở co-op chỉ hiện khi cả client lẫn server đều bật. Khi có `--debug` và `--host`, server mở trình duyệt với `&debug=1`.
- **Launcher:** sửa để **luôn giữ `--host`** khi forward tham số. Thêm `start-host-debug.bat`. README có mục "Bật chế độ debug".
- **Test:**
  - e2e phase0–7 chạy trên dev nên tự có debug.
  - Phase8 (bản release) phải thêm `&debug=1` vào URL, spawn exe với `--debug` **và đặt env `ASHEN_PACT_NO_OPEN_BROWSER=1`** (vì launcher giờ luôn giữ `--host` nên sẽ tự mở trình duyệt).
  - Thêm test mới: release **không** có `--debug` → không có hook, không có chữ debug (assert + screenshot), lệnh `debug_cmd` bị từ chối.

### 3.2 Ánh sáng trong trẻo toàn màn hình (Full-Screen Clear Visibility) & glow cho vật thể tương tác
- **Sửa nền tảng ánh sáng & xóa bỏ sương mù/bóng tối che màn hình trước** (P3 — `lighting-pipeline.ts` & `combat-fx-pools.ts`):
  - `brushSprite` (`lighting-pipeline.ts:159`) bắt buộc đặt `BlendMode.ADD` để các nguồn sáng cộng hưởng tự nhiên, không ghi đè làm sai màu sàn.
  - Falloff của `fx_light_radial` (`texture-baker-fx.ts`) mềm hơn (stop 0/.35/.7/1 → 1/.6/.2/0).
  - **Toàn màn hình luôn sáng rõ từ tâm ra tận 4 góc (No Fog-of-War), nhưng vẫn còn dư địa cho ánh sáng:**
    - Nâng `ambientColor` của `lightmapRt` lên **`~0.84–0.90`** (trung bình kênh, giữ sắc ấm/lạnh theo biome; điểm xuất phát: B1 `0xD9E3DD`, B2 `0xD2E0E8`, B3 `0xEBDBD1`, Hub `0xD6DCE8`, đã tính để giữ ≥ 86% L\* sàn ENV). Không vùng nào bị tối mù hay che mờ, và vẫn chừa 10–16% dư địa để đèn ADD trong lightmap sáng hơn nền.
    - **Lớp glow ấm phía trên lightmap:** vũng sáng của đuốc/chậu lửa được vẽ thêm bằng sprite `fx_light_radial` blend ADD ở depth trên lightmap (alpha 0.10–0.18, màu `#F59E42`, không cấp phát mỗi frame). Mục đích: vũng sáng ấm luôn thấy được trên sàn tối, kể cả khi lightmap đã gần 1.0.
    - **Bỏ hoàn toàn giới hạn vòng tròn tầm nhìn quanh người chơi (`mainPlayerVisionRadius = 310` tại `lighting-pipeline.ts:381-383` và `allyVisionRadius` tại `:397-400`).** Người chơi đứng ở đâu cũng nhìn rõ toàn bộ căn phòng, quái, đạn và vật phẩm ở khắp màn hình. Hào quang dưới chân người chơi chỉ là điểm nhấn ánh sáng dịu (`radius ~145–180`, `alpha ~0.20–0.28`), không phải đèn pin soi sương mù.
    - **Bão tuyết Boss 2 (`blizzardVeil`, `:327`, `:347`):** bỏ ambient tối `0x3e5672` và vignette 0.38. Giữ dấu hiệu nhận biết theo 0.6: tuyết dày ×3 thổi xiên, color grade lạnh nhẹ (L\* trung bình giảm ≤ 5% so với lúc chưa có bão), viền sương giá mỏng ở mép màn hình (alpha ≤ 0.12, màu `#CFE8EE`, không đen), banner + SFX lúc kích hoạt. Thêm cảnh chụp `boss-b2-blizzard` (mục 5).
    - **Tắt hẳn Vignette đen ở viền màn hình theo mặc định (`vignetteStrength = 0.0` tại `lighting-pipeline.ts:78, :327`):** Chỉ dùng viền nhịp tim đỏ (`lowHpPulse`) khi máu nguy kịch (`HP <= 2`).
    - **Xóa bỏ hoàn toàn sương mù trôi che màn hình (`fx_ambient_mist`):** Trong `combat-fx-pools.ts:142-161` và `combat-fx.ts:87-123`, gỡ bỏ hẳn loại particle `mist` (8 đám mây mờ kích thước lớn `scale * 1.8`, `alpha 0.35`).
  - Contrast PostFX 0.96–1.0. Bloom thật (downsample + blur) hoặc giảm xuống 0.12–0.15 để không tạo bóng ma.
  - **HUD chuyển sang scene overlay `HudScene`**, không chịu PostFX/lightmap/zoom thế giới.
- **Nguồn sáng mới** (client-only): truyền một mảng scratch không cấp phát bộ nhớ (zero-alloc) `interactableLights` vào `LightingPipeline.update`. Vẽ ngay sau người chơi/prop, với **quota dành riêng** (High 16 / Medium 10 / Low 6) để không bị cắt.

| Đối tượng | Màu | Bán kính | Hiệu ứng |
|---|---|---|---|
| Đuốc/chậu lửa ven tường (số lượng theo loại phòng, 3.5) | ấm `#F59E42` + lõi `#FFD27A` | 150–190 + lõi 60 | flicker hiện có + **than hồng bay lên** + hạt bụi sáng li ti trong vũng sáng + glow ADD trên lightmap (3.2) |
| Rương chưa mở | theo độ hiếm | 70–90 | pulse chậm 2s; rương hiếm+ có hạt lấp lánh |
| Vũ khí/vật phẩm dưới đất | theo độ hiếm | 50–70 | bob + glow sprite ADD dưới chân; **Tím/Cam có cột sáng mảnh** kiểu Soul Knight |
| Pickup (xu/năng lượng/hạt) | vàng/xanh/lục | 24–32 | chỉ ở High |
| Cổng dịch chuyển | tím–cyan | 140–180 | pulse + xoáy (3.4) |
| Cửa | khóa: đỏ thẫm nhỏ; mở: dịu theo màu biome | 60–80 | chuyển màu khi đổi trạng thái |
| Merchant / shrine / tượng Hub | vàng / cyan / màu nhân vật | 70–100 | shrine tắt sau khi dùng |
- Ngoài đèn trong lightmap, mỗi vật tương tác có **glow sprite ADD phía trên lightmap** (alpha 0.25–0.4) để nổi bật và thu hút ánh nhìn ngay cả khi đứng ở góc xa của màn hình. Khi là mục tiêu `[E]` hiện tại thì thêm **viền sáng (outline highlight)**.
- Không prop biome 1 nào (ví dụ `glow_mushroom` màu lime) được xuất hiện ở biome 2/3. Đèn màu có alpha ≤ 0.35.
- **Ràng buộc:** glow không bao giờ sáng hơn đạn địch. Chụp cảnh có đạn địch để chứng minh.

### 3.3 Nhãn theo khoảng cách & prompt `[E]`
- Export từ shared: `INTERACT_RANGE = 64`, các offset theo loại và thứ tự ưu tiên. Viết `findInteractTarget(sim, playerId)` trong shared và **dùng chung một hàm** cho sim (`interactWithNearest` gọi lại hàm này) lẫn client (chọn đối tượng hiển thị prompt), để hai bên không bao giờ lệch nhau.
  - **Thay đổi hành vi có chủ đích (ghi vào GDD):** chọn **đối tượng gần nhất trong nhóm ưu tiên cao nhất có ứng viên**, thay cho "phần tử đầu tiên khớp" như hiện tại. Phải giữ đúng lọc instanced theo `ownerPlayerId` và điều kiện engineer cho mechanism.
  - **Unit test hành vi** (không phải test hàm với chính nó): với nhiều bố cục ngẫu nhiên có seed, lấy X = `findInteractTarget`, sau đó cho sim xử lý một lần nhấn E. Kiểm tra trạng thái/event cho thấy **đúng X** được tác động (rương X mở, item X được nhặt…).
- **Trạng thái hiển thị (chốt):**
  - **Ngoài tầm tương tác: không có chữ.** Vật thể chỉ được nhận biết qua glow/ánh sáng (3.2). Ngoại lệ: biển hướng dẫn Hub và nhãn cửa (xem dưới).
  - Trong tầm: **một prompt duy nhất** cho mục tiêu hiện tại, dạng pill bo góc nền tối mờ gồm chip phím `E` + tên (màu độ hiếm) + giá (icon xu) nếu có, và outline trên vật thể. Các vật thể khác trong tầm nhưng không phải mục tiêu chỉ có glow, không có chữ.
  - Fade 120–150ms, không nhấp nháy khi đứng ở mép tầm (hysteresis ~8u).
- Áp dụng cho rương (thêm label mới), vũ khí, vật phẩm, hàng của merchant (worldItem có giá), shrine, portal, tượng Hub, kệ vũ khí Hub.
- Biển hướng dẫn Hub chỉ hiện trong ~200u.
- Cửa: bỏ nhãn tên phòng luôn hiện. Chỉ hiện icon khóa nhỏ khi khóa và tên phòng khi lại gần ~120u.
- Gộp với thẻ so sánh vũ khí hiện có (`hud-hub-and-cards.ts:412-537`): khi thẻ hiện thì prompt nằm trong thẻ, không trùng lặp.
- **Nameplate người chơi (`entity-sync.ts:19-93`, `:160-187`):** ẩn tên của chính mình. Đồng đội dùng chữ nhỏ (11–12px tại 1080p), alpha 0.75, màu slot, đặt phía trên đầu và không đè lên đầu nhân vật.

### 3.4 Cổng dịch chuyển & cổng qua phòng
- **Cổng dịch chuyển tầng** (thay sprite `portal_active`). Nhiều lớp:
  - Đế đá có rune khắc (bake).
  - **Xoáy năng lượng bằng shader GLSL per-object** (Phaser `PostFXPipeline`/`PreFX` trên sprite hoặc `Shader` game object): noise xoáy cực tọa độ, lõi sáng, viền phát quang, cường độ "thở".
  - Hạt xoắn ốc hút vào tâm và vài tia sáng bay lên.
  - Đèn pulse (3.2).
- **Trạng thái:**
  - Chưa kích hoạt: tối, xoáy chậm, xám tím.
  - Kích hoạt (sau khi dọn phòng): animation **burst** 0.6–0.8s (vòng sóng xung kích + flash + âm thanh), sau đó sáng ổn định.
  - Người chơi bước vào: nhân vật tan biến/kéo dãn vào tâm 0.3s + flash, rồi mới đến iris.
- **Cổng khởi hành ở Hub:** cùng họ hình ảnh nhưng màu vàng ấm khi tất cả đã "Sẵn sàng", xám xanh khi đang chờ.
- **Cổng qua giữa các phòng (cửa):** thay ô vuông bằng **khung cổng đá/vòm** theo biome, kèm **màn chắn năng lượng**:
  - Khóa: màn đỏ thẫm bán trong suốt, có hoa văn lục giác/rune cuộn chậm, hạt bụi sáng và đèn đỏ nhỏ.
  - Mở: màn **tan biến** (dissolve shader hoặc mask, 300–450ms, kèm tia lửa), để lại khung vòm phát sáng dịu.
  - Khi vào phòng combat: màn **dựng lên** 250ms kèm âm "khóa".
  - Hướng E/W và N/S phải có hình khác nhau hợp lý (không chỉ xoay 90° làm méo phối cảnh).
- **Fallback Low quality** (hoặc khi shader lỗi): xoay sprite bake nhiều lớp, không shader. Phải chụp ảnh ở chế độ Low để chứng minh vẫn đẹp.

### 3.5 Kiến trúc Map Hybrid ("Chi tiết ven tường, Tĩnh lặng giữa tâm") & Môi trường
- **Triết lý Map chủ đạo — Hybrid P4 + Style A + Bản sắc Biome P1/P2/P3:**
  - **Vùng chiến đấu trung tâm (Center Arena):** Mặt sàn phẳng mịn liền khối, độ tương phản nội vùng cực thấp (`ΔL* ≤ 6–8`), mạch gạch mờ dần (radial/edge fade-out) khi đi vào giữa phòng để xóa bỏ hoàn toàn cảm giác "giấy kẻ ô" và giúp đạn địch (`#E84545`), vòng telegraph và nhân vật nổi bật tuyệt đối.
  - **Vùng ven tường (Perimeter):** Ở dải `1.5–2` ô sát tường, bố trí gạch đá nguyên khối đan xen gạch chia nhỏ (`1×1` và `2×2` theo cụm noise), vết nứt mảnh, sỏi nhỏ và **lưới thoát nước sắt lõm** (khung vuông âm sàn có các thanh song sắt dọc tối màu). Đây là nơi đón ánh sáng ấm từ các chậu lửa ven tường.
- **Ba nguyên tắc bắt buộc cho mọi chi tiết môi trường** (chốt ở 0.6):
  1. **Hướng sáng:** một key light toàn cục từ trên-trái (`-135°` = vị trí nguồn sáng). Rim-light ở cạnh trên-trái, mọi bóng đổ bake về dưới-phải (Đông–Nam). Chậu lửa/đuốc không tạo bóng.
  2. **Hình ảnh = ngữ nghĩa sim:** vật có khối (bệ, cột, đe, bánh răng lớn, ống) chỉ đặt trên ô `wall`/`pillar` hoặc gắn vào mặt tường. Trên ô đi được chỉ có decal phẳng (không viền INK, không đổ bóng, ΔL\* ≤ 10). Thứ phát sáng kiểu hazard (dung nham lộ thiên, độc, băng) chỉ xuất hiện ở surface thật của sim.
     - **Surface động (boss phase 3, kỹ năng, quái để lại sàn):** surface luôn render **trên** mọi decal sàn. Decal sàn ở ô vừa thành surface phải ẩn đi (fade ≤ 200ms), không được lộ ra giữa vùng gây sát thương. Phòng boss **không đặt decal sàn có ý nghĩa "lối đi"** (đá bước chân, lưới sắt, rãnh nhiệt) trong 3 ô ngoài cùng; chậu lửa/decor gắn tường vẫn giữ.
  3. **Ngân sách mật độ (mỗi phòng):** ≤ 8 decor lớn (tính cả chậu lửa); ≤ 1 decor nhỏ trên 3 ô ven tường; **≥ 40% ô ven tường để trống** (chỉ có sàn); 0 decor nổi trong Center Arena. Mỗi phòng chọn theo seed **2 trong 3 motif ven tường** của biome, để các phòng không giống hệt nhau.
- **Số chậu lửa theo loại phòng** (thay cho "4 góc mọi phòng"): phòng start 2 (hai bên cửa vào); combat 4 (góc phòng, có thể bỏ 1 theo seed); rương 2 (hai bên rương); merchant/shrine 2; boss 6–8 bố trí đối xứng; phòng nhỏ ≤ 2.
- **Palette `ENV`** (thêm vào `palette.ts`, cập nhật `ART_GUIDE.md`). Điểm xuất phát, chỉnh theo ảnh. Các giá trị đã được nâng L\* sàn lên ~30–32 (B2 ~44) và tính lại theo đúng quan hệ seam −7 / var +3.5 / wall top +15 / wall front −10 ΔL\* so với sàn, giữ nguyên sắc độ (a\*/b\*):

| Biome / Khu vực | floor | seam | var | wall top | wall front | Bản sắc kiến trúc & ghi chú |
|---|---|---|---|---|---|---|
| Hub (Khu Đá Cổ — `P4 + Style A`) | #414B61 | #343B4C | #47546C | #64708B | #2D3547 | shadow #151A24, chậu lửa ven tường #F59E42, lưới thoát nước sắt lõm |
| B1 Rừng Cổ (pha `P1 Sa Bàn Tự Nhiên`) | #3D4F47 | #303E38 | #43584E | #627468 | #2B3731 | rêu tối, đá ấm, **rễ cây cổ thụ bò tràn qua mép tường** |
| B2 Hầm Băng (pha `P2 Đài Cổ Vực Thẳm`) | #446E78 | #3B5C64 | #4A7881 | #6F949E | #345462 | rim #CFE8EE, **vòng cổ ngữ Astrolabe khắc chìm giữa tâm** + God-rays |
| B3 Lò Rèn (pha `P3 Đấu Trường Cơ Khí`) | #53433F | #413431 | #5D4B44 | #7F6559 | #3B2D29 | gờ đồng thau, bánh răng gắn tường, **rãnh nhiệt có nắp lưới sắt** ven tường |
- **Sàn (viết lại `bakeBiomeTile` trong `texture-baker-tiles.ts:17-107` kết hợp chọn variant theo khoảng cách tới tường trong `arena-tiles.ts`):**
  - Bỏ viền INK từng ô, bỏ ellipse "C", bỏ bevel sáng.
  - **Tách 2 nhóm variant theo khoảng cách tới tường (`distToWall` tính từ ô `wall`/`pillar` gần nhất trong `arena-tiles.ts`):**
    - **Nhóm Ven Tường (`distToWall <= 2`, `variant 0..3`):** Có khe nối gạch đá `1u` (tối hơn base `ΔL* 6–8`, alpha ~0.5), đan xen mẫu gạch nguyên khối `1×1` và gạch chia nhỏ `2×2`, kèm chi tiết ven tường (vết nứt mảnh, **lưới thoát nước sắt lõm**, sỏi nhỏ, rêu/tuyết đọng nhẹ với `ΔL* ≤ 8`, không viền đen).
    - **Nhóm Trung Tâm (`distToWall > 2`, `variant 4..7` — Center Arena):** Mặt sàn phẳng mịn liền khối, khe gạch mờ hẳn (`alpha ≤ 0.12`, `ΔL* ≤ 6`), không có lưới thoát nước hay chi tiết vụn, chỉ có biến thiên độ sáng tần số thấp (chu kỳ 3–5 ô theo seed, `±3–4%`) để vùng chiến đấu chính hoàn toàn tĩnh lặng.
  - Chấm phát quang ≤ 2% số ô (chỉ ở ven tường), alpha ≤ 0.5.
  - **Đo bằng `metrics.json` trên vùng sàn trống, ảnh `?lighting=0`:** `ΔL*` (p95 − p5) toàn sàn ≤ 14 (riêng vùng Center Arena `ΔL* ≤ 8`); HSL saturation trung bình ≤ 0.35 (B2 ≤ 0.40); `L*` trung bình của sàn **28–40 (B2 40–50)**; **`L*` sàn − `L*` của `INK_DARK` ≥ 22** (để viền nhân vật không chìm vào nền). Với ảnh có lighting (Full-Screen Clear Visibility): độ sáng `L*` ở **4 góc màn hình** đạt **≥ 82% `L*` của cùng vùng trên ảnh `?lighting=0`** (chứng minh không có fog-of-war hay vignette làm tối góc màn hình; vùng đo 4 góc khai báo trong `visual-scenes.ts`, là sàn trống cách mọi nguồn sáng — chậu lửa, rương, cổng, người chơi — **≥ 200u**, để đèn ở góc phòng không che mất lỗi tối góc), không vùng sàn nào có `L* < 15`, và **tâm vũng sáng chậu lửa sáng hơn vùng sàn trống cùng ảnh ít nhất `ΔL* +8`** (chứng minh vũng sáng nhìn thấy được, không bị ambient nuốt mất).
- **Tường 3D 3 lớp & Đổ bóng sâu (`bakeWallTile`, `bakePillarTile`, `bakeWallAoOverlay` trong `texture-baker-tiles.ts:113-531`):**
  - `Top Cap` sáng hơn sàn `ΔL* +12–18` kèm viền ngoài `INK_DARK` `2–2.5u` & gờ rim-light sắc nét ở cạnh Bắc/Tây (đón sáng `-135°`).
  - `South Cliff Face` cao `cliffH = 12–14u`, tối hơn sàn `ΔL* −8–12` và có 2 hàng mạch gạch ngang/dọc trầm tĩnh. Bỏ hoàn toàn chấm glow lặp lại trên mọi ô tường (`texture-baker-tiles.ts:200-203`).
  - `AO Shadow & Cast Shadow`: Bóng đổ mềm dưới chân tường `6–8u` (`alpha ~0.35`) kết hợp vệt bóng đổ chéo về **dưới-phải** (`12–16u`, `alpha ~0.22`, nguồn sáng `-135°`) từ góc tường và các trụ đá đổ xuống sàn (đúng chất `P4 Phế Tích Hắc Ám`). Mọi bóng trong phòng phải cùng một hướng.
- **Surface / Bề mặt nguyên tố kiến trúc (`texture-baker-surfaces.ts`: lava/độc/băng/dầu/nước/băng chuyền):**
  - Giảm saturation ~30%, pattern bên trong `ΔL* ≤ 10`. Dựa vào `surfaceMask` (autotile 4 cạnh), vẽ **bờ viền kiến trúc ăn nhập với sàn** thay vì mảng màu phẳng cắt vuông:
    - **Rãnh/kênh đá âm sàn (`P3`)** cho dung nham, dầu và băng chuyền ở B3/Hub (có gờ đá vát bao quanh rãnh; lava sáng nhờ đèn `BlendMode.ADD` chứ không nhờ fill đỏ kín; băng chuyền dùng mũi tên đồng thau dịu có animation cuộn).
    - **Hồ tự nhiên bo viền cong mềm (`P1`)** cho nước, đầm độc và băng ở B1/B2 (mép nước/độc uốn lượn có bọt/đá bước chân nhỏ, mặt băng có vệt phản quang chéo dịu).
- **Đặc tả hình học cho 4 lớp kiến trúc Biome (`apps/client/src/world/biome-architecture.ts`, chỉ render phía client, giữ nguyên hitbox `32×32` của sim, đặt theo seed, tránh lối đi và vùng combat chính, tuân thủ 3 nguyên tắc ở đầu 3.5).** Các con số dưới đây là **gợi ý xuất phát**. Mục tiêu thật là bố cục đẹp, nhận ra biome ngay và không rối. Implementer được bỏ hoặc thay một chi tiết nếu Visual Gate cho thấy nó gây rối, nhưng phải ghi `Ruling:`.
  1. **Kiến trúc Phế Tích Chung & Chậu lửa ven tường (`P4 Dark Storybook Ruin` — áp dụng cho Hub & khung viền mọi phòng):**
     - **Bệ đá & Chậu lửa treo (`Hanging Braziers`):** số lượng và vị trí theo loại phòng (đầu 3.5). Bệ trụ đá giật cấp (`stepped stone pedestal` có mặt trên vát 4 cạnh) **đặt trên ô tường/góc tường**, giá đỡ sắt rèn vươn chéo `45°` ra phía trên sàn (vẽ ở depth trên nhân vật, không có hitbox) treo chậu lửa/lồng sắt cháy rực (`#F59E42` + lõi `#FFD27A`, hạt than hồng bay lên).
     - **Trụ cột đá rãnh & Bóng đổ dài (`Fluted Columns & Long Cast Shadows`):** cột đá tròn có rãnh hoặc trụ đá gãy **chỉ đặt trên ô `pillar` của sim hoặc dạng nửa cột gắn vào mặt tường** (pilaster). Mỗi cột đổ một vệt **bóng về dưới-phải dài `40–64u`** (`alpha 0.32 → 0` mờ dần về phía Đông–Nam) vắt qua mặt sàn ven tường.
     - **Gờ tường đá vỡ & Hàng rào sắt rèn (`Wrought-Iron Fencing`):** Trên mép tường xen kẽ các đoạn gờ đá cổ bị mẻ với đoạn hàng rào song sắt rèn mũi nhọn (`#241F2E` / highlight `#565E75`) và dây xích treo. Chỉ nằm trên ô tường.
  2. **Biome 1 — Rừng Cổ Mục Nát (`P1 Illustrated Organic Diorama`):**
     - **Rễ cây cổ thụ uốn lượn (`Bezier S-Curve Roots`):** Từ chân tường đá và các góc phòng, vẽ các nhánh rễ cây cổ thụ bằng đường cong Bezier hình chữ S vươn dài `28–56u`. **Phần gốc dày (`10–12u`, viền `INK_DARK` `2.5u`, cel-shade gỗ ấm `#7D4B32` / `#4E2F21`, đốm rêu `#499F54`) nằm trên tường/mặt đứng.** Phần tràn xuống sàn đi được thì thuôn về `2u`, **phẳng như decal** (không viền INK, không đổ bóng, ΔL\* ≤ 10) để không bị đọc thành vật cản.
     - **Cụm nấm phát quang & Dây leo:** Ở góc tường và chân cột có cụm 3 mũ nấm phát quang (`#84CC16` / `#A7F3D0`, glow nhẹ `alpha ≤ 0.30`) cùng dây leo rủ qua mặt đứng `South Cliff Face`.
     - **Đầm độc tự nhiên & Đá bước chân (`Stepping Stones`):** Các vùng surface độc/nước ở B1 có viền bờ đất/rêu uốn lượn tự nhiên (2 lớp viền đồng tâm) và điểm xuyết **4–6 phiến đá bước chân hình elip bất đối xứng** (`#627468`, viền `1.5u`) nằm dọc mép đầm, **chỉ trên ô khô ngoài surface**. Không đặt đá trong vùng độc, vì sẽ bị hiểu là lối đi an toàn trong khi sim vẫn gây sát thương.
  3. **Biome 2 — Hầm Băng Vĩnh Cửu (`P2 Floating Abyss Sanctuary`):**
     - **Vòng cổ ngữ băng khắc chìm giữa phòng (`Sunken 3-Ring Ice Astrolabe`):** Chính giữa tâm phòng vẽ decal kiến trúc khắc chìm gồm **3 vòng tròn đồng tâm**. Bán kính gợi ý `70u / 120u / 165u` (phòng chuẩn 36×22 ô = 1152×704, Center Arena khoảng 30×16 ô ≈ 960×512 nên vừa). Ràng buộc cứng: vòng ngoài ≤ `0.45 × min(rộng, cao)` của Center Arena thực tế và không tràn vào dải ven tường; phòng nhỏ hơn thì thu nhỏ theo tỉ lệ. Chia thành **8 cung bằng các trục mảnh `1.5u`**, bên trong lồng **vòng bán nguyệt lệch tâm (`crescent inlay`)** và ký tự rune nhỏ tại các giao điểm. Toàn bộ Astrolabe chỉ chênh độ sáng `ΔL* 5–7` (`alpha 0.16–0.24`) so với màu sàn `#446E78`. Đây là chi tiết **thấy được khi để ý, không nổi bật**: Reviewer không được yêu cầu tăng tương phản cho nó (6), và vùng tâm vẫn phải đạt `ΔL* ≤ 8`.
     - **Tường Đền Băng & Hốc Thác Băng phía Bắc:** Tường Bắc điểm xuyết các hốc vòm đá băng (`arched alcoves`) có dải băng/nước đóng băng đổ dọc xuống và cụm tinh thể pha lê vát cạnh (`#22D3EE` / `#CFFAFE`) kèm bờ tuyết mềm ở góc phòng.
     - **Luồng sáng God-rays:** Phủ 2–3 dải tứ giác ánh sáng song song chiếu xiên từ hướng nguồn sáng `-135°` (tường Bắc–Tây) xuống sàn (`rộng 60–100u`, gradient tuyến tính `alpha 0.06 → 0`), tạo cảm giác thánh đường băng cổ kính mà vẫn trong trẻo. Tắt ở Low.
  4. **Biome 3 — Lò Rèn Dung Nham (`P3 Octagonal Elemental Conduit`):**
     - **Rãnh nhiệt có nắp lưới sắt ven tường (`Grated Heat Channels`):** thay cho rãnh dung nham lộ thiên + cầu bắc ngang (bản cũ có lỗi: rãnh chỉ có ở client trông như hazard nhưng sim không gây sát thương). Dọc dải ven tường và từ lò nhiệt/chậu lửa, vẽ các **máng đá âm sàn rộng `24–28u`** (gờ đá bazan vát cạnh `4u` màu `#7F6559` + viền trong `#3B2D29`), **phủ kín bằng lưới sắt rèn** (song sắt tối `#241F2E`, khoảng hở `4–6u`). Ánh dung nham chỉ lộ qua khe lưới (`#F97316` + lõi `#FFD27A`, ADD, alpha ≤ 0.35, nhịp thở chậm). Người chơi đọc được ngay là "sàn sắt đi được, bên dưới có nhiệt". Không cần cầu. Rãnh không được chạy xuyên Center Arena.
     - **Dung nham thật (surface `lava` của sim)** dùng bờ rãnh đá vát theo mục Surface ở trên. Đây là chỗ duy nhất có dung nham lộ thiên sáng mạnh.
     - **Cơ khí Lò Rèn gắn tường (`Brass Gears & Steam Pipes`):** **Trên mặt tường và ô tường góc phòng** gắn các **bánh răng đồng thau nhiều răng (`8–12 răng`, `#D97706` / `#92400E`) quay chậm**, đường ống dẫn hơi nước có mặt bích tán đinh (`flanged steam pipes`) chạy dọc mặt đứng, xích sắt. Đe rèn chỉ đặt trên ô `pillar`. Bánh răng đứng yên ở Low.
  - Giữ toàn bộ chi tiết nổi ở dải ven tường (`distToWall <= 2`) hoặc khắc chìm phẳng ở tâm (`ΔL* ≤ 6–8`), tuân thủ ngân sách mật độ ở đầu 3.5. Có unit test đếm decor mỗi phòng theo ngân sách và kiểm tra decor có khối chỉ nằm trên ô `wall`/`pillar`.
  - **Quality Low:** giữ phần bake tĩnh (sàn, tường, decor tĩnh, rãnh lưới). Tắt animation decor (bánh răng, nhịp thở dung nham), God-rays, than hồng, bụi sáng; giảm còn ≤ 2 glow ADD chậu lửa trong khung nhìn.
- **Camera (`arena-tiles.ts:523-530`, `:630`, `MenuScene.ts:785`, `ArtGalleryScene.ts:394-396`):** sửa zoom đồng đều `zoom = min(w/960, h/540)`, mở rộng vùng nhìn theo chiều dư, **không méo**. HUD neo theo mép màn hình (`HudScene`). Kiểm chứng ở 1920×1080, 2560×1440, 2560×1080 (ultrawide) và 1280×1024.

### 3.6 Vũ khí 2 ô & rơi vũ khí
- Trong `packages/shared/src/data`: `MAX_WEAPON_SLOTS = 2`.
- Loadout khởi đầu: `[starterWeaponId, 'rusty_pistol']`. Thiết Vệ dùng `[knight_sword, rusty_pistol]`. Ghi vào GDD.
- Thay mọi hardcode 4 (`sim-dungeon-rooms.ts:755-769`, `world-sim-types.ts:7-12`, `sim-coop-hub.ts:18-24`, `:352-358`, stress test `sim-props-spawning.ts:150`, `:158-163`).
- **Nhặt hoặc mua khi đầy:** vũ khí đang cầm được spawn thành worldItem **shared** (`costGold 0`) **tại vị trí của món vừa nhặt** (đã chắc chắn hợp lệ, không trong tường), rồi thay vào ô đang cầm. Dùng chung một helper `spawnDroppedWeapon` với `dropActiveWeaponImpl` (`sim-coop-hub.ts:672-698`). Phát event `weapon_dropped` và `weapon_swapped` có `playerId` (`world-sim-events.ts:111`, `sim-dungeon-rooms.ts:765-768`, `sim-props-spawning.ts:247-250`); SFX chỉ phát cho chính người đó hoặc phát theo vị trí.
- Client: vũ khí rơi có animation **văng nảy nhẹ** (cung 0.25s) rồi bob, kèm glow theo độ hiếm (3.2).
- Nhặt lại phải cần một lần nhấn E mới (đã là edge-trigger). Thêm khóa ngắn 0.3s để tránh đổi qua đổi lại do giữ phím.
- Item `pickedUp` không có `offerId` (`sim-dungeon-rooms.ts:727`) được **xóa khỏi `worldItems`** để snapshot không phình. Cập nhật `roomItemsByRoomId` cho đồ rơi. Đồ rơi ở phòng start (id 0) cũng phải được giữ lại.
- **Bot autoplay (`sim-progression-bot.ts:500-523`):** không nhặt vũ khí do chính mình vừa thả (`droppedByPlayerId` + cooldown), chỉ nhặt khi DPS ước tính cao hơn. Test `phase3-sim` autoplay vẫn phải đạt victory.
- Kệ vũ khí Hub **tự bổ sung** sau khi được nhặt (kệ không bao giờ trống). Vũ khí rơi ở Hub bị xóa khi bắt đầu run.
- **Phím (`input-and-network.ts:132-180`):** 1/2 chọn ô, Q/lăn chuột đổi ô, X thả vũ khí, E nhặt. **Emote tách khỏi phím số:** giữ `T` mở **vòng emote** (4 lựa chọn, chọn bằng chuột hoặc 1–4 khi đang giữ T). Phím 1–3 chọn buff chỉ hoạt động trong modal buff. Sửa i18n (`swapWeapon`, `[G/X]` → `[X]`, emote, controls modal).
- **HUD 2 ô (`hud-setup-and-pause.ts:157-216`, `hud-combat-and-coop.ts:255-300`, `arena-tiles.ts:573-577`):** render theo `MAX_WEAPON_SLOTS`, bỏ fallback "vũ khí ma", ô trống hiển thị dạng trống.
- **Test:** unit test (đầy → nhặt → còn 2 ô + có 1 worldItem shared mang id vũ khí cũ ở đúng vị trí; mua ở merchant khi đầy; co-op instanced loot; không lặp với bot). Sửa `phase1-sim`, `phase2-sim`, `phase4-coop` và e2e `phase1.spec.ts` (Digit1..4).

### 3.7 UI/UX hiện đại
- **Design system** `apps/client/src/ui/theme.ts` + `ui/components/`:
  - Token: màu nền panel slate tối alpha 0.72–0.85, viền 1px sáng mờ, bo góc 6–10, spacing 4/8/12/16/24. **Màu nền và viền panel lấy từ nhóm `ENV`** (ví dụ nền gần `#2D3547`, viền gần `#64708B`), để HUD và map cùng tông, không còn panel neon tách rời khỏi thế giới.
  - Cỡ chữ tại 1080p: 12 / 14 / 16 / 20 / 28 / 40. **Chữ HUD tối thiểu 13px.**
  - **Tiếng Việt:** line-height ≥ 1.3 và padding trên đủ cho dấu chồng (ví dụ "Ở", "Ữ", "Ặ"). Thêm cảnh chụp kiểm tra chuỗi nhiều dấu ở mọi cỡ chữ: không được cắt mất dấu ở đầu dòng (ảnh v0.1.0 có "HƠI NƯỚC" bị cắt phía trên). Dùng Be Vietnam Pro với các weight đã có trong `ART_GUIDE.md` mục 6 (Regular 400 / SemiBold 600 / ExtraBold 800).
  - **Độ nét:** text và icon trong `HudScene` render theo `devicePixelRatio` (resolution của Text = DPR × UI scale), vì không còn được zoom theo camera thế giới. Chụp ảnh 1440p để chứng minh chữ không mờ.
  - Màu trạng thái: HP đỏ ấm, giáp xám bạc, năng lượng xanh, vàng cho tiền, độ hiếm.
  - Component: `Button` (primary/secondary/ghost/danger, hover/press/disabled, focus), `Panel`, `SegmentedBar`, `KeyChip`, `Tooltip`, `Toast`, `IconLabel`. Icon vẽ bằng code.
  - Toàn bộ UI vẽ ở **`HudScene`** với **UI scale** (80–130%, trong Settings).
- **HUD trong game:**
  - Trên trái: thẻ người chơi (chân dung mini + thanh HP/giáp/năng lượng dạng segment có icon và số).
  - Trên phải: minimap (nền đặc alpha ~0.85, bo góc, icon phòng rõ), dưới đó là "Tầng 1-2 · Biome".
  - Dưới phải: **2 thẻ vũ khí** (ô đang cầm nổi bật, ô kia thu nhỏ; icon + tên + tiêu hao NL) và **kỹ năng/dash dạng vòng tròn hồi chiêu** có chip phím.
  - Giữa dưới: vùng prompt ngữ cảnh. Giữa trên: thanh máu boss / banner đợt quái.
  - Trái: thẻ đồng đội gọn. Xu có icon.
  - **Bỏ hàng phím, bỏ DPS, bỏ nút trên HUD.** Phím tắt chỉ xem trong Pause → Điều khiển, và hiện gợi ý theo ngữ cảnh lần đầu.
- **Popup chiến đấu:** gộp phản ứng nguyên tố cùng loại trong 0.4s ("HƠI NƯỚC ×3"). Tối đa 3 popup trên mỗi vùng 120px, xếp chồng có offset. Số sát thương thường nhỏ, crit to hơn, có scale-pop (easeOutBack) rồi fade. Chữ combo lớn ở vị trí cố định gần trên giữa, không đè lên người chơi.
- **Menu chính:**
  - Bỏ nút debug và chuỗi test.
  - Phân cấp rõ: 1 nút chính "Chơi", các nút phụ Co-op Host / Join, hàng icon Cài đặt / Hướng dẫn / Credits / Ngôn ngữ.
  - Ô nhập Tên/IP dùng **HTML input overlay** (có caret, paste, chọn chữ, Enter để xác nhận).
  - Nền Hub động với ánh sáng mới.
- **Hub:**
  - Bảng mời co-op **thu gọn mặc định** thành chip "Mời bạn [I]" cho Host, bấm để mở.
  - Sửa chữ bị nút "Đuổi" che. Danh sách người chơi gọn.
- **Modal chọn buff:** thẻ có icon, viền độ hiếm, mô tả ngắn, hover nổi lên, chip phím 1/2/3. Khi tất cả đã chọn thì hiện đếm ngược.
- **Kết quả:** phân cấp (Thắng/Thua lớn → thống kê → MVP), nút chính "Chơi lại" và phụ "Về Hub/Menu". Bỏ nút "Đóng bảng" vô nghĩa.
- **Pause:** "Về Menu" phải có hộp thoại xác nhận. Settings chia tab (Âm thanh / Hình ảnh / Gameplay / Điều khiển), tiêu đề một ngôn ngữ, có UI scale và bật/tắt gợi ý phím.
- **Chỉ báo mới (QoL):** mũi tên chỉ hướng quái ngoài màn hình khi phòng chỉ còn ≤ 3 quái, chỉ báo hướng bị trúng đòn (vòng cung đỏ mờ quanh nhân vật), banner "Đợt 2/3" và "Phòng đã dọn sạch".

### 3.8 Nhân vật Cutout 2.0, Quái Full Rig & Animation (`cutout-rig.ts`, `rig-defs-*.ts`, `entity-sync.ts`)
- Rig & Animation (`cutout-rig.ts`):
  - **Crossfade state** 0.10–0.15s.
  - Thêm pose: attack (thân hướng theo đòn), hurt (giật lùi + nghiêng), dash (kéo dãn + nghiêng), cast (tay giơ + vòng sáng), downed/revive mượt.
  - Thân nghiêng theo `moveDirX` (đúng ART_GUIDE).
  - **Chớp mắt** ngẫu nhiên 3–5s, mắt/đầu dõi theo hướng ngắm.
  - **Secondary motion** dạng spring cho áo choàng/tóc/phụ kiện sau lưng.
  - Vũ khí **chĩa hẳn về con trỏ** (pivot ở tay), recoil có hồi spring.
- Shading 2 lớp & Đồng bộ ánh sáng Map (`rig-defs-heroes-1/2.ts`, `rig-defs-biome1/2/3-*.ts`, `rig-defs-weapons-1/2.ts`):
  - Giữ nét viền `INK_DARK` `2.5u` sắc nét (`3.5u` cho Boss).
  - Tô bóng 2 lớp (cel-shade + soft gradient), highlight đặc trưng theo vật liệu (kim loại có vệt phản quang sắc, vải/da mờ tự nhiên, pha lê/năng lượng có lõi sáng).
  - **Rim-light góc trên-trái (`-135°`)** đồng bộ với hướng sáng của Map để tách silhouette nhân vật và quái khỏi mặt sàn.
- Quái ở High/Medium dùng **full rig** (`entity-sync.ts:246` tắt `useFastComposite` ở High/Medium), có idle riêng, telegraph rõ, chết vỡ mảnh đẹp. Low được phép giữ composite.
- Bụi chân khi chạy, vòng slot dưới chân mềm hơn, bóng elip có blur nhẹ.
- Kiểm chứng: chụp strip 8 frame cho idle/run/attack/dash/hurt của 5 nhân vật + 3 quái tiêu biểu, ở `ArtGalleryScene` và trong game.

### 3.9 FX, Phản Ứng Nguyên Tố & Juice (`combat-fx.ts`, `combat-fx-pools.ts`, `texture-baker-fx.ts`, `sim-events.ts`)
- Mọi tia lửa, glow, flash, muzzle, đạn sáng và vụ nổ nguyên tố dùng **`BlendMode.ADD`**. Particle phát sáng đặt **trên** lightmap.
- Hit spark có trail ngắn + vòng va chạm `easeOutCubic`. Muzzle flash nhiều lớp. Vỏ đạn có bóng.
- **Hiệu ứng Phản Ứng Nguyên Tố (Elemental Combo FX):** Khi kích hoạt Combo Nguyên Tố (*Hơi Nước, Vỡ Băng, Siêu Dẫn, Nổ Độc, Tê Liệt, Quá Tải*), sinh vòng sóng xung kích lan nhanh + hạt nguyên tố `BlendMode.ADD` + chữ combo gộp hiện đại (`sim-events.ts:382-418`, `combat-fx.ts:430-524`, ví dụ `"HƠI NƯỚC ×3"` trong cửa sổ 0.4s).
- **Ambient theo biome (Không Sương Mù — xóa bỏ `fx_ambient_mist` tại `combat-fx-pools.ts:142-161`):**
  - Tuyệt đối không dùng các đám mây sương mù lớn trôi ngang làm mờ màn hình.
  - Thay bằng các hạt môi trường nhỏ, sắc nét, trong trẻo và không che tầm nhìn: đom đóm/lá nhỏ ở B1; bông tuyết tròn mềm 2–4px (60–80 hạt, lắc lư sin, parallax 2 lớp) ở B2; tàn lửa (embers) nhỏ bay lên ở B3; và hạt bụi sáng li ti chỉ lơ lửng trong vũng sáng đuốc.
- Rương mở: nắp bật, cột sáng màu độ hiếm, đồ văng ra theo cung.
- Quái spawn: vòng ma pháp có rune xoay + cột sáng ngắn.
- Chuyển cảnh iris mượt. Slow-mo + flash khi hạ boss.
- **Ràng buộc:** hiệu ứng của đồng đội vẫn theo `teammateFxOpacity`. Không FX nào che đạn địch hay làm đục màn hình.
- **Đạn địch dễ nhận biết bằng hình dạng (bắt buộc, chuyển lên từ 3.11):** mọi đạn địch có **lõi sáng gần trắng + thân màu `#E84545` + viền tối `INK_DARK` 1.5u**, giữ nguyên ở mọi biome. Không FX/decor/ambient nào (than hồng, tàn lửa, chậu lửa, khe dung nham, pha lê) được dùng cùng tổ hợp "lõi trắng + viền tối" ở cỡ 6–14px. Tàn lửa B3 phải nhỏ hơn (≤ 4px), không viền, và bay lên. Kiểm chứng: cảnh `b3-combat` và `b3-combat-grayscale` (ảnh chuyển xám): đạn địch vẫn tách được khỏi nền và FX.

### 3.10 Độ khó & kịch tính
**Bước 1 — sửa thước đo trước khi tune (`tools/balance-harness.ts` & `tools/balance-simulations.ts`):**
- Bỏ `encounterScale` (`balance-simulations.ts:518-545`), `roomFactor` (`:357-360`), `godMode = true` (`:249`, `:333`) và hồi máu giả trong harness.
- Thêm **bot "người chơi trung bình"**: độ chính xác ngắm ~65–75%, phản xạ 200–300ms, dash né telegraph với xác suất 60–70%, không god mode.
- **Chống "chỉnh bot cho pass":** tham số bot được commit và **khóa** (`tools/bot-profile.ts`) **trước** khi bắt đầu Bước 2. Mọi thay đổi bot sau đó phải ghi lý do vào PROGRESS và chạy lại toàn bộ báo cáo. Mỗi cấu hình chạy **≥ 30 run** với seed được ghi lại; báo cáo trung vị và p10/p90.
- Metric mới: thời gian boss/phòng, **HP mất mỗi phòng**, **tỉ lệ bị gục**, tỉ lệ thắng boss theo biome, 1P vs 2P/4P.
- Cập nhật mục tiêu mới vào `BALANCE.md`.

**Mục tiêu (bot trung bình, solo trừ khi ghi khác):**

| Metric | Mục tiêu |
|---|---|
| Quái thường chết (vũ khí khởi đầu, B1) | 0.6–1.5s |
| Phòng combat | 35–70s |
| Boss B1 / B2 / B3 | 60–120s; lệch 1P↔4P ≤ ±20% |
| HP+giáp mất mỗi phòng (B1) | 25–50% tổng |
| Tỉ lệ thắng boss | B1 80–95%, B2 70–90%, B3 60–85%; không có one-shot |
| Biome sau so với biome trước | khó hơn ~20–25% (đo thật) |

**Bước 2 — các đòn bẩy (data-driven, trong `packages/shared/src/data` & `packages/shared/src/sim/`):**
- HP boss thật nâng theo DPS đo được: bắt đầu thử ×5–7, rồi để harness quyết định.
- Thêm `BIOME_SCALING` (HP, tốc bắn, elite bonus) áp dụng trong `spawnEnemyImpl` (`sim-props-spawning.ts:327-418`).
- **Sửa lỗi tốc bắn co-op bị nhân đôi (`getCoopEnemyCooldownScaleImpl` ở `sim-enemies-core.ts:245-263` và `sim-enemies-biome1/2/3.ts`).**
- Đợt chồng nhau: đợt sau spawn khi còn ≤ 25% quái của đợt trước hoặc sau 12s, có vòng triệu hồi cảnh báo 0.8s.
- Quái mỗi đợt `min(6, 4+…)`. Mỗi tầng có 4 phòng combat. Elite solo 22% / 32%.
- Thêm 1–2 modifier elite: `volley` (+2 viên mỗi lượt bắn), `vengeful` (chết thì bắn vòng 8 viên chậm có telegraph).
- Tốc đạn địch +12–15% (vẫn chậm hơn đạn người chơi và vẫn dash né được). Cooldown tấn công −10–15%. **Giữ nguyên thời gian telegraph (≥ 0.4s).**
- Hồi giáp chậm hơn 0.5s. Dọn phòng hồi sinh với 35% HP. Giá cửa hàng tăng (potion 25, vũ khí 40/60, giáp 45) hoặc giảm vàng/kill.
- Chỉ tăng sát thương có chọn lọc: elite và một đòn boss có telegraph dài nhất. Không tăng sát thương quái thường.
- Boss:
  - **Kháng CC:** đóng băng tối đa 0.6s, giảm dần hiệu lực trong 8s; Tê Liệt không ngắt telegraph P3.
  - **Chuyển phase:** bất tử 1.2s + gầm + rung + dọn đạn + combo mở màn.
  - **Enrage mềm** sau 90s: mỗi 15s cooldown ×0.93 (tối đa ×0.75), viền đỏ và nhạc dồn dập hơn.
- Kịch tính trình bày: banner đợt quái, nhạc combat tăng lớp khi còn ít HP hoặc khi boss enrage, đếm ngược quái còn lại, rung và hit-stop có chủ đích. Tùy chọn: phòng **Thử Thách** (3 đợt chồng nhau, mỗi đợt có elite, thưởng rương cao hơn 1 bậc).
- **Không thêm chế độ chọn độ khó** ở giai đoạn này.

### 3.11 Đề xuất bổ sung (làm nếu còn trong phạm vi phase tương ứng)
- Sửa event `weapon_swapped` thiếu `playerId` (SFX của người khác phát ở máy mình).
- Đồng bộ BALANCE.md với code. Sửa lỗi ghi chú trong ART_GUIDE (GOBLIN_GREEN).
- Thông báo toast khi bật/tắt fullscreen và khi đổi chất lượng tự động.
- Kiểm tra lại độ tương phản cho người mù màu: đã chuyển thành **bắt buộc** ở 3.9 (đạn địch phân biệt bằng hình dạng).

---

## 4. CÁC PHASE (TUẦN TỰ, MỖI PHASE MỘT TAG `polish-pN`)

> Thứ tự đã tính đến phụ thuộc: hạ tầng ảnh → debug → **gameplay vũ khí (đụng sim/co-op/test nên làm sớm để lộ rủi ro sớm)** → nền ánh sáng/HUD/camera → môi trường → vật thể tương tác → UI → nhân vật/FX → độ khó → phát hành. Mỗi phase có DoD riêng, **cộng thêm DoD chung ở 0.3**.

| Phase | Nội dung | Yêu cầu gốc |
|---|---|---|
| P0 | Hạ tầng chụp ảnh/metrics/reviewer + baseline | Kiểm chứng bằng hình ảnh |
| P1 | Chế độ debug, dọn UI debug | Ẩn debug trong .exe |
| P2 | Vũ khí 2 ô + rơi vũ khí | 2 vũ khí, đổi thì rơi |
| P3 | Nền ánh sáng, PostFX, `HudScene`, camera không méo | Map dễ nhìn, ánh sáng |
| P4 | **Phòng chuẩn B1** (vertical slice) → Palette ENV, sàn, tường, surface cho mọi biome | Map đẹp, giảm tương phản |
| P5 | Trang trí biome còn lại, chậu lửa | Map đẹp, nguồn sáng đuốc |
| P6 | Đèn/glow vật thể tương tác | Nguồn sáng cho rương/đuốc/cổng/vật phẩm |
| P7 | Nhãn theo khoảng cách, prompt [E] | Gần mới hiện [E] tên |
| P8 | Cổng dịch chuyển & cổng qua phòng | Cổng đẹp, sáng ảo diệu |
| P9a/b | Design system, HUD, menu, modal | UI/UX hiện đại |
| P10a/b | Nhân vật/quái, FX | Chi tiết, mượt, đẹp |
| P11 | Harness thật + độ khó + kịch tính | Khó và kịch tính hơn |
| P12 | Hồi quy, hiệu năng, release v0.2.0 | Chất lượng sản phẩm |

### Phase P0 — Hạ tầng kiểm chứng hình ảnh & Baseline
- Làm xong phần khởi động 0.1 trước (spec, worktree, baseline `pnpm verify`), rồi mới viết plan P0.
- Xây `visual-scenes.ts`, `visual.spec.ts`, `pnpm shots`, `tools/visual-metrics.ts`, pixel-diff, `?seed=`, `?freeze=1`, `?lighting=0`, `?testHooks=1`, strip khung hình (và clip nếu kiểm chứng được là xem được). `visual-metrics.ts` là logic nên làm theo TDD (test với ảnh PNG nhỏ tự sinh có L\*/saturation đã biết).
- Tách `pnpm e2e` khỏi `@visual`: đổi script `e2e` thành `playwright test --grep-invert @visual`, bộ chụp ảnh chạy riêng bằng `pnpm shots` (0.3).
- Đo **hiệu năng baseline** theo 0.3 (headed, GPU thật, frame time p50/p95 khi bỏ khóa vsync + FPS khi bật vsync) cho cảnh thường và stress, ghi model GPU vào PROGRESS. Viết thành script lặp lại được (ví dụ `pnpm perf`) để mọi phase đo cùng một cách.
- Chụp **baseline** toàn bộ danh mục cảnh (mục 5) vào `docs/screenshots/polish-p0/baseline/`. Chạy Visual Reviewer lần đầu (chỉ một phiên bản, không A/B) để có **điểm baseline** cho từng tiêu chí ở mục 6.
- Viết `docs/POLISH_BASELINE.md`: tóm tắt baseline, top 15 vấn đề hình ảnh theo mức độ (dẫn ảnh). Đây là tài liệu phát hiện, không phải plan; các plan nằm trong `docs/superpowers/plans/`.
- **DoD:** 2 lần chạy `pnpm shots` liên tiếp với `?freeze=1` cho pixel-diff < 0.5% trên mọi cảnh (được mask vùng động như ping/FPS); metrics.json có số đo sàn của 3 biome (cả `?lighting=0` và có lighting); review baseline đã lưu.

### Phase P1 — Chế độ Debug & dọn giao diện debug
- Làm toàn bộ 3.1 (hai cờ `debugUi`/`testHooks`, Ctrl+Shift+D, server gate, launcher, bat debug, README, sửa test phase8, test release không debug).
- **DoD:** ảnh `?debug=0&testHooks=1` của menu, Hub, HUD **không còn bất kỳ chữ hay nút debug nào**; ảnh `?debug=1` vẫn đủ công cụ. Bản release chạy mặc định thì không có debug và không có hook; có `--debug` thì có cả hai (chụp cả hai). Lệnh debug bị server từ chối khi tắt (có test). Toàn bộ e2e cũ vẫn pass.

### Phase P2 — Vũ khí 2 ô & rơi vũ khí
- Toàn bộ 3.6 (sim, network, bot, Hub rack, phím, vòng emote, HUD hiện tại chỉnh thành 2 ô ở mức tối thiểu, test). HUD đẹp sẽ làm ở P9a.
- **DoD:** unit test và e2e mới pass; e2e co-op 2 client: P1 nhặt khi đầy → P2 thấy vũ khí rơi và nhặt được; kích thước snapshot không tăng sau 200 lần nhặt/thả (đo byte); strip khung hình vũ khí rơi văng ra; bot autoplay vẫn thắng; test phase4 (4 client) vẫn pass.

### Phase P3 — Nền tảng ánh sáng trong trẻo (Bỏ sương mù & fog-of-war), PostFX, tách HUD & camera không méo
- Sửa `brushSprite` sang `BlendMode.ADD`, falloff mềm, nâng `ambientColor` lên `~0.84–0.90` (sáng rõ nhưng còn dư địa cho đèn) kèm lớp glow ấm ADD trên lightmap, **bỏ giới hạn vòng tầm nhìn `mainPlayerVisionRadius` / `allyVisionRadius`, bỏ phần làm tối của `blizzardVeil` (thay bằng hiệu ứng bão tuyết không tối, 0.6), tắt vignette đen mặc định (`vignetteStrength = 0.0`) và xóa hẳn particle sương mù `fx_ambient_mist`** (3.2 phần nền tảng).
- **Tách HUD sang scene overlay riêng `HudScene`** chạy song song với GameScene. Không dùng nhiều camera kèm `ignore()`, vì dễ render đôi và tốn hiệu năng. Ở phase này chỉ **di chuyển nguyên trạng** HUD và các label màn hình; thiết kế lại để ở P9a. Label gắn với thế giới (prompt `[E]`, nameplate) vẫn ở GameScene nhưng đặt depth trên lightmap và không chịu PostFX nếu kiểm chứng được là cần.
- Zoom đồng đều và neo HUD theo mép màn hình (3.5 camera).
- **DoD:** ảnh before/after 3 biome và Hub cho thấy **toàn màn hình sáng rõ từ tâm ra 4 góc (không còn sương mù mù mịt hay viền tối fog-of-war)**, vũng sáng đuốc ấm áp **đo được** (`ΔL* +8` theo 3.5) và không còn ám màu sai (B2 không còn vệt xanh lá); cảnh `boss-b2-blizzard` nhận ra ngay là đang có bão tuyết nhưng không tối (L\* trung bình giảm ≤ 5%); HUD không bị vignette/bloom và không méo (so sánh ảnh); 4 độ phân giải trong 3.5 không méo, HUD đúng góc; mọi e2e đọc HUD/click nút vẫn pass; FPS đạt (0.3).

### Phase P4 — Kiến trúc Map Hybrid: Phòng chuẩn B1, Palette ENV, sàn "Tĩnh lặng giữa tâm", tường 3D 3 lớp & surface kiến trúc
- **Bước A — Phòng chuẩn (vertical slice, làm trước):** dựng hoàn chỉnh **một phòng combat B1** gồm palette ENV B1, sàn, tường 3 lớp, surface độc/nước, chậu lửa của phòng combat và **bộ decor B1 tối thiểu** (rễ cây, nấm, đá bước chân; lấy trước một phần của P5 chỉ cho B1). Chạy Visual Gate riêng cho phòng này (cảnh `b1-combat`, `b1-start-room`, `b1-combat-low`) đến khi tiêu chí 1, 2, 3 ≥ 8 và các metrics 3.5 đạt. **ĐIỂM DỪNG DUYỆT PHONG CÁCH (bắt buộc, chờ tôi):** ngay khi phòng đạt Visual Gate và **trước khi khóa**, dừng lại và trình tôi: ảnh `b1-combat`, `b1-start-room`, `b1-combat-low` (cả `?lighting=0`), ảnh before ↔ after, điểm Reviewer, `metrics.json`, và 2–3 điểm thẩm mỹ bạn còn phân vân (ví dụ độ tương phản mạch gạch, màu sàn, mật độ rễ/nấm). Tôi sẽ trả lời **duyệt** hoặc danh sách chỉnh sửa; nếu có chỉnh sửa thì làm một fix round có phạm vi rồi trình lại (tối đa 2 lần). Không bắt đầu bước B khi chưa có \"duyệt\" của tôi. Sau khi tôi duyệt thì **khóa**: lưu `docs/screenshots/polish-p4/golden-room/*.png`, ghi giá trị màu/alpha/kích thước cuối cùng vào `ART_GUIDE.md` mục "Phòng chuẩn" (từ đây các giá trị này thắng số xuất phát của spec, theo 0.7). Từ đây mọi Visual Reviewer cho môi trường (P4 bước B, P5) nhận thêm ảnh phòng chuẩn để chấm **độ nhất quán phong cách** (đây là ảnh nội bộ do chính dự án tạo ra, không phải tham chiếu bên ngoài).
- **Bước B — Nhân rộng:** áp dụng palette `ENV` cho Hub/B2/B3. Viết lại sàn (`bakeBiomeTile` + `arena-tiles.ts`: mạch gạch mờ dần vào giữa phòng, gạch chia nhỏ `1×1`/`2×2` và lưới thoát nước sắt lõm ở dải ven tường `distToWall <= 2`), tường 3D 3 lớp (`Top Cap` + `South Cliff Face 12–14u` + `AO Shadow` + bóng đổ về dưới-phải), và surface nguyên tố có bờ viền/rãnh kiến trúc (3.5).
- **DoD:** phòng chuẩn B1 đã khóa (ảnh + giá trị trong ART_GUIDE). `metrics.json` sàn của cả 3 biome và Hub đạt ngưỡng ở 3.5 (L\* sàn, ΔL\* tâm ≤ 8, toàn sàn ≤ 14, tương phản với `INK_DARK` ≥ 22, vũng sáng `+8`). Reviewer chấm theo rubric mục 6: tiêu chí "Môi trường" ≥ 8 và không bị đánh giá "lệch phong cách" so với phòng chuẩn. Nhân vật, quái, đạn **nổi rõ hơn** baseline (tiêu chí "Độ dễ đọc" tăng). Ảnh chụp cả quality Low.

### Phase P5 — Bản sắc kiến trúc Biome (P1/P2/P3/P4) & Chậu lửa ven tường
- Hoàn thiện `apps/client/src/world/biome-architecture.ts` theo 4 đặc tả hình học và **3 nguyên tắc** ở mục 3.5 (hướng sáng, hình ảnh = ngữ nghĩa sim, ngân sách mật độ), bám phong cách phòng chuẩn B1 đã khóa ở P4:
  - **P4 Chung & Hub:** bệ đá trên ô tường + giá sắt `45°` treo chậu lửa (số lượng theo loại phòng), cột đá rãnh trên ô `pillar`/nửa cột gắn tường đổ bóng dài về dưới-phải (`40–64u`), gờ đá vỡ xen hàng rào sắt rèn mũi nhọn trên mép tường.
  - **B1 (`P1`):** hoàn thiện phần còn lại sau phòng chuẩn (biến thể theo loại phòng, motif ven tường theo seed).
  - **B2 (`P2`):** Sunken Astrolabe 3 vòng đồng tâm (`70u/120u/165u`, vòng ngoài ≤ 0.45 × cạnh ngắn của Center Arena, 8 cung, bán nguyệt lệch tâm, `ΔL* 5–7`) giữa phòng, hốc thác băng tường Bắc, pha lê vát cạnh và 2–3 dải God-rays (`alpha 0.06 → 0`).
  - **B3 (`P3`):** rãnh nhiệt có nắp lưới sắt rộng `24–28u` ven tường (ánh dung nham chỉ lộ qua khe lưới), bánh răng đồng thau `8–12 răng` quay chậm và ống hơi nước tán đinh gắn trên mặt tường.
  - Kết hợp hạt than hồng và bụi sáng li ti trong vũng sáng đuốc (3.2 đuốc).
- **DoD:** ảnh phòng start, combat, rương và boss của 3 biome và Hub cho thấy **nhìn 1 giây là biết biome nào**, kèm vũng sáng ấm đo được ở vị trí chậu lửa. Unit test: (1) ô trang trí không chặn đường đi giữa các cửa; (2) decor có khối chỉ nằm trên ô `wall`/`pillar`; (3) số decor mỗi phòng nằm trong ngân sách và ≥ 40% ô ven tường để trống; (4) không có decor phát sáng kiểu hazard ngoài surface thật của sim; (5) sau khi gọi `applyBossPhase3*Border()` không còn decal sàn nào hiển thị trên ô có surface (cảnh `boss-b1-phase3`, `boss-b3-phase3`). `ΔL*` vùng tâm vẫn ≤ 8. Reviewer không đánh giá "rối mắt" hay "gây hiểu nhầm gameplay", không đánh giá "lệch phong cách" so với phòng chuẩn, và chấm "Môi trường" ≥ 8.5.

### Phase P6 — Ánh sáng & glow cho vật thể tương tác
- Quota đèn, glow sprite, cột sáng độ hiếm, pickup glow (3.2 bảng).
- **DoD:** cảnh `b1-dark-interactables` (các vật thể tương tác đặt ở góc xa ngoài vùng đuốc): rương, vũ khí, portal, hàng của merchant, shrine **nhận ra được ngay nhờ glow/ánh sáng** (không có chữ). Cảnh có đạn địch: đạn vẫn nổi bật nhất. FPS đạt khi có 30+ vật thể phát sáng.

### Phase P7 — Nhãn theo khoảng cách & prompt [E]
- `findInteractTarget` dùng chung, prompt duy nhất, fade + hysteresis, label rương, cửa, biển Hub, nameplate (3.3).
- **DoD:** unit test hành vi ở 3.3 pass. Ảnh Hub, merchant và phòng rương ở 3 khoảng cách (xa / gần ngoài tầm / trong tầm) đúng đặc tả. Ảnh Hub không còn mảng nhãn `[E]` dày đặc như baseline.

### Phase P8 — Cổng dịch chuyển & cổng qua phòng
- Shader xoáy, trạng thái và animation kích hoạt/bước vào, cổng Hub, màn chắn cửa khóa/mở/dựng lên, fallback Low (3.4).
- **DoD:** strip khung hình cho: portal idle, kích hoạt, người chơi bước vào; cửa khóa → mở; cửa dựng lên khi vào phòng combat. Reviewer chấm "Portal/cửa" ≥ 8 và mô tả được là "phát sáng ma thuật". Ảnh Low quality vẫn đẹp. Không có lỗi shader trong console.
### Phase P9a — UI/UX: design system & HUD trong game
- `theme.ts`, components, HUD mới, popup gộp, chỉ báo QoL, UI scale (3.7 phần HUD).
- **DoD:** ảnh HUD trong combat B1/B2/B3, co-op 4P, boss fight, UI scale 80% và 130%, 1440p và ultrawide. Không chữ nào < 13px tại 1080p, không chồng lấp (Reviewer kiểm), không cắt mất dấu tiếng Việt (cảnh `ui-vi-diacritics`), chữ không mờ ở 1440p, màu panel cùng tông `ENV` với map, tiêu chí "UI/HUD" ≥ 8.

### Phase P9b — UI/UX: Menu, Hub, modal, Pause, Settings, kết quả
- Phần còn lại của 3.7 (HTML input, bảng mời thu gọn, modal buff, kết quả, xác nhận thoát, tab Settings).
- **DoD:** ảnh mọi màn hình UI ở cả `vi` và `en`; mọi luồng đi được bằng chuột và bằng phím không bị kẹt (e2e); paste được IP vào ô nhập (e2e); Reviewer "UI/HUD" ≥ 8 cho tất cả màn hình.

### Phase P10a — Nhân vật Cutout 2.0 & Quái Full Rig: animation, shading 2 lớp & rim-light
- Toàn bộ 3.8 (`cutout-rig.ts`, `rig-defs-*.ts`, `entity-sync.ts`).
- **DoD:** strip 8 frame idle/run/attack/dash/hurt cho 5 nhân vật + 3 quái tiêu biểu, chụp ở Gallery và trong game; Reviewer "Nhân vật" ≥ 8, có shading 2 lớp + rim-light `-135°` nổi bật trên nền sàn mới, chuyển state không giật (xem strip lúc đổi state); FPS stress đạt khi quái dùng full rig ở High (nếu không đạt thì giảm LOD theo khoảng cách và ghi lại).

### Phase P10b — FX, Phản Ứng Nguyên Tố & Hạt Môi Trường Trong Trẻo
- Toàn bộ 3.9 (`combat-fx.ts`, `combat-fx-pools.ts`, `texture-baker-fx.ts`, `sim-events.ts`).
- **DoD:** strip khung hình bắn/trúng/nổ/combo nguyên tố/mở rương/spawn quái/hạt môi trường (đom đóm B1, tuyết tròn B2, tàn lửa B3, không có sương mù che màn hình); Reviewer "FX" ≥ 8; đạn địch vẫn dễ đọc nhất trong cảnh hỗn loạn 4P (ảnh stress) và trong `b3-combat` / `b3-combat-grayscale` (đạn địch tách được khỏi tàn lửa, chậu lửa, khe dung nham bằng hình dạng).

### Phase P11 — Độ khó & kịch tính
- Bước 1 (harness thật) → thống nhất mục tiêu trong BALANCE.md → Bước 2 (đòn bẩy) → lặp harness đến khi đạt bảng mục tiêu 3.10. Phần trình bày kịch tính (banner, nhạc, enrage, chuyển phase).
- **DoD:** `pnpm balance` xuất `docs/balance-report.md` **không có hệ số giả**, đạt mọi mục tiêu 3.10 hoặc giải thích lệch có chủ đích; unit test cho biome scaling, đợt chồng, kháng CC, enrage, lỗi tốc bắn co-op; e2e bot vẫn đi qua tầng; strip khung hình chuyển phase boss và enrage. Ghi vào PROGRESS **checklist test tay** để tôi tự cảm nhận độ khó.

### Phase P12 — Hồi quy toàn diện, hiệu năng & phát hành v0.2.0
- Chụp lại **toàn bộ danh mục cảnh** → review tổng (mọi tiêu chí ≥ 8, không thấp hơn baseline ở bất kỳ tiêu chí nào).
- Soak test 20 phút. Kiểm tra Chrome và Edge. Chạy lại QA_CHECKLIST.
- `pnpm package:release` → chạy bản release từ thư mục zip sạch: mặc định không debug, `start-host-debug.bat` có debug, 2 client qua IP LAN chơi qua 1 tầng.
- Cập nhật README (phím mới, debug, mô tả Bão Tuyết phase 3 Kryssa ở `README.md:119` không còn "thu hẹp tầm nhìn"), `RELEASE_NOTES.md` v0.2.0, `docs/screenshots/polish-p12/` có ảnh so sánh baseline ↔ final.
- **Bump version lên 0.2.0** ở mọi nơi: `package.json` các package, tên thư mục/zip release, tiêu đề launcher, banner server, đường dẫn hardcode trong `tests/e2e/phase8.spec.ts`. Grep `0.1.0` để không sót. Tag `v0.2.0` trên nhánh `polish/v0.2.0`.
- **Review toàn nhánh** (skill `requesting-code-review`, model `pro`): review package `git merge-base master HEAD`..`HEAD`, kèm danh sách mọi dòng `minor (deferred)` và `parked` trong các ledger để reviewer phân loại cái nào phải sửa trước khi merge. Lỗi tìm được thì gom thành **một** fix dispatch, rồi một lần re-review có phạm vi.
- **Kết thúc nhánh** (skill `finishing-a-development-branch`): chạy lại full suite, sau đó đưa tôi **menu 3 lựa chọn** (merge vào `master` tại máy / push và tạo PR / giữ nguyên nhánh) và **chờ tôi chọn**. Không tự merge.
- **DoD:** tất cả các điều trên pass. Báo cáo cuối có: bảng điểm Reviewer baseline → final theo từng tiêu chí, danh sách **"Cần tôi xem"**, và mục **"Các Ruling tôi đã tự quyết"** (0.7).

---

## 5. DANH MỤC CẢNH CHỤP TẤT ĐỊNH (tối thiểu)
1. `menu`, `menu-settings`, `menu-join-input`
2. `hub-solo`, `hub-coop-2p` (bảng mời thu gọn/mở), `hub-near-statue`, `hub-near-rack`
3. `b1-start-room` (chậu lửa hai bên cửa vào), `b1-combat` (6 quái + elite + đạn địch), `b1-chest-closed-far`, `b1-chest-near`, `b1-weapon-ground-far/mid/near`, `b1-merchant`, `b1-shrine`, `b1-door-locked`, `b1-door-open`, `b1-portal-inactive`, `b1-portal-active`, `b1-dark-interactables` (vật thể ở góc xa ngoài vùng sáng chậu lửa, đứng xa), `b1-poison-swamp` (đầm độc + đá bước chân)
4. `b2-combat`, `b2-start-room`, `b3-combat` (có đạn địch gần chậu lửa và rãnh nhiệt), `b3-combat-grayscale` (cùng cảnh, ảnh chuyển xám để kiểm tra hình dạng đạn), `b3-start-room`, `b3-lava-surface` (surface dung nham thật của sim cạnh rãnh lưới)
5. `boss-b1`, `boss-b2`, `boss-b3` (kèm cảnh chuyển phase), `boss-b1-phase3` (độc phủ vòng ngoài, kiểm tra không lộ đá bước chân/decal trong vùng độc), `boss-b2-blizzard` (phase 3 Kryssa có bão tuyết), `boss-b3-phase3` (lava phủ vòng ngoài, kiểm tra không lộ lưới sắt/rãnh nhiệt)
6. `coop-4p-combat`, `stress-4p`
7. `modal-buff`, `modal-victory`, `modal-defeat`, `pause`, `pause-confirm-exit`, `ui-vi-diacritics` (chuỗi tiếng Việt nhiều dấu chồng ở mọi cỡ chữ của theme)
8. `gallery-characters`, `gallery-enemies`
9. Biến thể: 1440p, 2560×1080, 1280×1024 cho `b1-combat` và `hub-solo`; quality Low cho `b1-combat`, `b3-combat`, `b1-portal-active`; `en` cho các màn hình UI.

Mỗi cảnh khai báo vùng đo metrics (ví dụ: vùng sàn trống) trong `visual-scenes.ts`.

---

## 6. RUBRIC CHO VISUAL REVIEWER (điểm 1–10 mỗi tiêu chí)
1. **Môi trường:** chấm **thẩm mỹ và chức năng**, không chấm đếm chi tiết. Gồm: bố cục rõ hai vùng (ven tường giàu chi tiết, giữa phòng phẳng dịu, không giống "giấy kẻ ô"); nhịp và mật độ decor hợp lý (không rối, không lặp y hệt giữa các phòng); chiều sâu tường 3D và bóng đổ **nhất quán một hướng**; **nhìn 1 giây là biết biome nào**; phong cách khớp với phòng chuẩn B1 (nếu đã có); **decor không gây hiểu nhầm gameplay** (trông như hazard/vật cản mà không phải, ghi là major). Thiếu một chi tiết hình học cụ thể trong 3.5 **không phải lỗi** nếu tổng thể đạt; chỉ ghi lỗi khi thiếu bản sắc biome.
2. **Ánh sáng & Tầm nhìn trong trẻo:** **toàn màn hình sáng rõ từ tâm ra 4 góc (không có sương mù mù mịt hay viền tối fog-of-war/vignette che khuất)**, đồng thời **vũng sáng chậu lửa nhìn thấy rõ**, ấm và mềm (không phẳng lì, không cháy sáng), không ám màu sai, hướng sáng nhất quán (rim trên-trái, bóng dưới-phải).
3. **Độ dễ đọc:** thứ tự nổi bật đúng (đạn địch > người chơi > quái > tương tác > FX > nền); silhouette nhân vật (viền tối + rim-light `-135°`) tách biệt rõ khỏi sàn; đạn địch phân biệt được bằng hình dạng, kể cả ở B3 và trên ảnh chuyển xám.
4. **Vật thể tương tác:** nhận ra được từ xa nhờ ánh sáng/glow; prompt gọn, đúng một mục tiêu.
5. **Portal/cửa:** phát sáng ma thuật, có lớp, có chuyển động (xem strip).
6. **UI/HUD:** hiện đại, nhất quán, phân cấp rõ, không chồng chữ, không rối, không có thứ của debug.
7. **Nhân vật & animation:** Cutout 2.0 chi tiết (shading 2 lớp + highlight vật liệu), mượt, có cá tính, quái dùng full rig, chuyển state không giật.
8. **FX & Phản ứng nguyên tố:** đẹp, đúng `BlendMode.ADD`, hạt môi trường trong trẻo, combo nguyên tố có sóng xung kích + chữ gộp gọn, không che gameplay.
9. **Tổng thể "cảm giác sản phẩm":** có giống một indie game hoàn thiện không?

Với mỗi tiêu chí: điểm, 1–3 lý do, lỗi kèm vị trí trên ảnh và mức độ (blocker/major/minor), đề xuất sửa cụ thể. Reviewer phải **khắt khe**, đối chiếu với **mục tiêu và 3 nguyên tắc** của mục 3.5 / `docs/ART_GUIDE.md`, bảng số đo `metrics.json`, ảnh phòng chuẩn (nếu có) và ảnh BEFORE. Các con số hình học trong 3.5 là gợi ý: **không yêu cầu tăng độ nổi của chi tiết được thiết kế để kín đáo** (ví dụ Astrolabe B2) nếu điều đó vi phạm ngưỡng ΔL\* vùng tâm.

---

## 7. NHỮNG ĐIỀU CẤM
- ❌ Kết luận "đẹp/đạt" mà không có ảnh thực tế + điểm Reviewer độc lập. Đánh giá giao diện qua đọc code.
- ❌ Dùng file ảnh có sẵn cho game (sprite sheet, tileset, PNG). Mọi hình ảnh vẫn phải **vẽ bằng code**; shader GLSL là code nên được phép. Tuyệt đối **không nạp bất kỳ file ảnh bên ngoài nào vào game**.
- ❌ Thêm hệ số giả hoặc god mode vào harness để "cho pass" mục tiêu cân bằng.
- ❌ Decor chỉ có ở client mà **trông như hazard hoặc vật cản** không có trong sim (dung nham/độc lộ thiên giả, cột/bệ nằm trên ô đi được), hoặc đá/cầu gợi ý "lối an toàn" xuyên qua surface gây sát thương. Bóng đổ ngược hướng key light.
- ❌ Telegraph < 0.4s, one-shot, hiệu ứng che đạn địch, glow sáng hơn đạn địch, **hoặc dùng sương mù (`fx_ambient_mist`) / fog-of-war / vignette tối làm mờ bất kỳ vùng nào của màn hình**.
- ❌ Đặt logic hình ảnh vào `packages/shared` sim. Phá tính tất định hoặc co-op. Tạo lại file > 1000 dòng (phải giữ cấu trúc module hóa).
- ❌ Cấp phát bộ nhớ trong vòng lặp nóng (đèn, label, particle phải dùng pool hoặc scratch). Vẽ lại `Graphics` mỗi frame cho entity số lượng lớn.
- ❌ Chạy song song nhiều implementer. Controller tự sửa code. Implementer tự tạo subagent. Bỏ qua task review hoặc Visual Gate. Refactor lớn ngoài phạm vi phase.
- ❌ Commit thẳng lên `master`. Tự merge/push khi chưa được tôi chọn ở bước kết thúc nhánh.
- ❌ Viết code logic trước khi có test fail (TDD). Ghi "xong/pass" khi chưa chạy lại lệnh kiểm chứng ngay lúc đó.
- ❌ Bỏ một phát hiện của reviewer mà không ghi `Ruling:` vào ledger.
- ❌ Để lộ công cụ debug hoặc lệnh debug server trong bản release khi không bật debug.
- ❌ Thêm tính năng lớn ngoài phạm vi (nhân vật mới, biome mới, chơi qua Internet, chọn độ khó, meta progression).
- ❌ Phụ thuộc Internet.

---

## 8. BẮT ĐẦU
1. Gọi `using-superpowers`, nói ngắn gọn "Đang dùng superpowers để thực thi Polish v0.2.0".
2. Làm phần khởi động 0.1: spec, worktree, baseline, PHASES/PROGRESS, task artifact.
3. Với từng phase từ **P0** đến **P12**: `writing-plans` → `subagent-driven-development` → Visual Gate → Phase Gate → tag (0.2). Không dừng giữa các phase, trừ các trường hợp ở 0.7 (kể cả điểm dừng duyệt phong cách sau P4 bước A).
4. Sau mỗi phase, in báo cáo ngắn gồm: đường dẫn plan, đã làm gì, kết quả test/FPS (output mới chạy), **cặp ảnh before → after**, điểm Reviewer, metrics, các Ruling mới, mục park vào "Cần tôi xem". Sau đó tiếp tục phase kế tiếp.
5. Kết thúc bằng review toàn nhánh và menu `finishing-a-development-branch` (P12).
