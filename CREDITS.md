# GHI NHẬN BẢN QUYỀN & TÀI NGUYÊN (CREDITS.md) — ASHEN PACT (`v0.2.0`)

## 1. Đồ Họa Vector & Âm Thanh Thủ Tục (100% Procedural Code)
- **Đồ họa 2D Vector & Cutout Rig (`100% Procedural Vector Art`):**
  - Toàn bộ **5 nhân vật**, **16 loại quái thường + biến thể Tinh Anh (Elite)**, **3 Boss cuối màn**, **24 vũ khí**, **3 bộ gạch nền/tường/trụ autotile theo Biome**, **đồ vật tương tác**, **biểu tượng UI** và **hạt hiệu ứng (Particles/Decals)** đều được vẽ hoàn toàn bằng mã nguồn TypeScript (`apps/client/src/art/`) thông qua pipeline `outlined()` và `TextureBaker` theo độ phân giải thực (`DPR Supersampling`).
  - Không sử dụng bất kỳ tệp hình ảnh bên ngoài nào (`.png`, `.jpg`, `.svg`, sprite sheet có sẵn).
- **Âm thanh & Nhạc nền (`100% Procedural Web Audio Synthesis`):**
  - Toàn bộ **47 hiệu ứng âm thanh (SFX)** có định vị không gian 2D (`stereo pan` + suy giảm theo khoảng cách) và **7 bản nhạc nền động 2 lớp (`Khám Phá / Chiến Đấu`)** đều được tổng hợp thời gian thực bằng bộ tổng hợp sóng âm Web Audio API (`apps/client/src/audio/zzfx.ts` & `apps/client/src/audio/music-synth.ts`).
  - Không sử dụng bất kỳ tệp âm thanh thu sẵn nào (`.mp3`, `.wav`, `.ogg`).

---

## 2. Font Chữ (Giấy Phép SIL Open Font License 1.1)
- **Be Vietnam Pro**
  - **Tác giả:** BeGroup, Gabriel Lam, Tony Le, Vietanh Nguyen.
  - **Giấy phép:** SIL Open Font License, Version 1.1 (`OFL-1.1`).
  - **Đóng gói nội bộ (Offline Local Bundle):** `apps/client/public/fonts/` (đủ 12 tệp `.woff2` cho các tập ký tự `vietnamese`, `latin-ext`, `latin` ở các độ đậm `400`, `600`, `700`, `800`) kèm toàn văn giấy phép tại `apps/client/public/fonts/OFL.txt` và gói `@fontsource/be-vietnam-pro` (MIT / OFL-1.1).

---

## 3. Thư Viện Mã Nguồn Mở Sử Dụng (Open-Source Software Notices)

| Thư viện / Công cụ | Vai trò trong dự án | Giấy phép (License) | Tác giả / Tổ chức |
|---|---|---|---|
| **Phaser 3** (`phaser ^3.87.0`) | Engine hiển thị WebGL 2D, Scene, Camera, PostFX Pipeline | **MIT License** | Photon Storm Ltd. (Richard Davey) |
| **Colyseus** (`@colyseus/core`, `@colyseus/schema`, `@colyseus/ws-transport`, `colyseus.js`) | Khung máy chủ & trình khách phòng chơi thời gian thực qua WebSocket | **MIT License** | Endel Dreyer & Colyseus Contributors |
| **Express** (`express ^4.21.1`) & **CORS** (`cors ^2.8.5`) | Phục vụ bản dựng tĩnh Client và API thông tin mạng LAN (`/api/host-info`) | **MIT License** | OpenJS Foundation |
| **@fontsource/be-vietnam-pro** (`^5.1.0`) | Đóng gói offline font chữ tiếng Việt `Be Vietnam Pro` | **MIT / OFL-1.1** | Fontsource Project & BeGroup |
| **Vite** (`vite ^5.4.11`) | Công cụ đóng gói & máy chủ phát triển giao diện Client | **MIT License** | Evan You & Vite Contributors |
| **Vitest** (`vitest ^2.1.5`) | Khung kiểm thử đơn vị (Unit Test) & Soak Test cho `packages/shared` | **MIT License** | Anthony Fu, Matias Capeletto & Contributors |
| **Playwright** (`@playwright/test ^1.49.0`) | Khung kiểm thử tự động đa trình duyệt E2E & chụp ảnh nghiệm thu | **Apache-2.0 License** | Microsoft Corporation |
| **TypeScript** (`typescript ^5.6.3`) | Ngôn ngữ lập trình kiểu tĩnh nghiêm ngặt (`strict: true`) | **Apache-2.0 License** | Microsoft Corporation |
| **ESLint 9** & **Prettier 3** | Kiểm tra quy tắc mã nguồn và định dạng chuẩn hóa | **MIT License** | OpenJS Foundation & Prettier Contributors |
| **tsx** (`tsx ^4.19.2`) & **Concurrently** (`^9.1.0`) | Thực thi tập lệnh TypeScript (`balance-harness`, `package-release`) | **MIT License** | Hiroki Osame & Concurrently Contributors |

---

## 4. Cảm Ơn Đặc Biệt (Inspirations)
- Lấy cảm hứng về nhịp độ hành động và cơ chế vượt ải co-op từ **Soul Knight** (*ChillyRoom*).
- Thiết kế, kiến trúc simulation 60Hz, đồ họa procedural vector, âm nhạc tổng hợp và kiểm định tự động được thực hiện trọn vẹn cho dự án **Ashen Pact (`v0.2.0`)**.
