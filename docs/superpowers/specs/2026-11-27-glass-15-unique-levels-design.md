# Thiết Kế Đại Tu 15 Màn Độc Bản cho Bê Kính Pha Lê (PAWS Duo Co-op 3D)

## 1. Vấn Đề Cần Giải Quyết
Bộ 15 màn Bê Kính hiện tại (`3 Map × 5 Màn`) bị cảm giác "na ná nhau, thay đổi ít" vì 3 nguyên nhân gốc trong cấu trúc màn chơi và renderer:
1. **Khung đường đơn điệu:** Cả 15 màn đều đi thẳng dọc trục `+Z` trong dải hẹp `x ∈ [-4.6, 4.6]`.
2. **Thiếu biến hóa thị giác giữa Màn 1→5 trong cùng Map:** 5 màn của mỗi Map dùng chung 1 object `GlassMapTheme`, khiến bầu trời, sương mù, ánh sáng và sàn giống hệt nhau.
3. **Chưa khai thác hết các cơ chế engine sẵn có:** `physics.ts` và `course.ts` đã hỗ trợ `MovingPlatformDef.axis: 'z'` (phà chạy dọc), `BarrierDef.moveAxis: 'x'` (cửa trượt ngang), `tiltGate`, `fragile`, cầu tách đôi hai bên vực hở ở giữa, và rẽ ngang 90° (`X`), nhưng renderer (`GlassCourseMesh.tsx`, `GlassCamera.tsx`) còn gắn cứng cổng checkpoint/đích và hàng cây tại `x = 0`, hạn chế sự sáng tạo địa hình.

## 2. Mục Tiêu Kiến Trúc (Phương án 1)
Giữ nguyên 100% luật chơi cốt lõi, `physics.ts` determinism và Supabase Realtime protocol hiện tại, đồng thời mở rộng 3 lớp:
1. **15 Theme Bầu Không Khí Riêng (`GLASS_LEVEL_THEMES`):** Mỗi màn có `GlassMapTheme` riêng (thể hiện khung giờ/thời tiết: Bình minh, Trưa sáng, Hoàng hôn, Đêm đèn lồng/đèn pha, Bão cực quang/Neon), tách biệt `biome: 'cabin_bridge' | 'sky_scaffold' | 'candy_factory'` khỏi `id` để giữ đúng kiến trúc gỗ tuyết / công trường thép / xưởng kẹo mà màu sắc & ánh sáng thay đổi rõ rệt qua từng màn.
2. **Camera Bám Cua Ngang & Tách Làn (`GlassCamera.tsx`):** Tăng hệ số bám `X` (`midX * 0.88`, lookAt `midX * 0.94`) và nới zoom mượt khi hai người tách cầu rộng hoặc rẽ đường chữ S/L (`x = -11..+11`).
3. **Render Bám Hình Dạng Đường Đua (`GlassCourseMesh.tsx`):**
   - Cổng Checkpoint và Cổng Đích căn tự động theo tâm `X` và bề rộng cụm sàn bên dưới `triggerZ` / `finishZ`.
   - Chân trụ `Pendulum`, `Spinner` và dải cảnh báo `BarrierVisual` (`lowGap`, `highWall`, `moveAxis: 'y'`) tự neo vào `topY` mặt sàn bên dưới thay vì mặc định `y = 0`.
   - Hỗ trợ thanh chắn quay 90° (`d > w`) trên các nhánh cầu rẽ ngang `+X`/`-X`.
   - Vật trang trí bên hông (thông tuyết, tháp cẩu, kẹo mút khổng lồ) né động ngoài biên `[trackMinX(z) - 6.0, trackMaxX(z) + 6.0]` để ôm theo đường cua S/L không cắt vào cầu.

## 3. Thiết Kế 15 Màn Độc Bản (Signature Layouts)

### Map 1: Cầu Gỗ Cabin Tuyết (`cabin_bridge`)
1. **Màn 1 — Khởi Động Sương Sớm (`finishZ: 68`, 2 chặng):** Trời sương bình minh xanh dịu (`#152842`), đường thẳng rộng hơi lượn nhẹ sang phải ở chặng 2, giới thiệu `E`/`Q`, cổng hẹp và 1 búa lắc đơn.
2. **Màn 2 — Hẻm Vực Hai Cầu Băng (`finishZ: 92`, 3 chặng):** Trưa nắng băng tuyết sáng (`#1d4268`), nổi bật đoạn **Twin-Rail Parallel Bridges** (`x ∈ [-3.2, -0.9]` và `x ∈ [0.9, 3.2]` cách nhau `1.8m` vực thẳm ở giữa!), chuyển sang sàn băng đôi kết hợp gió tạt.
3. **Màn 3 — Khúc Cua Rừng Thông (`finishZ: 112`, 3 chặng):** Hoàng hôn tím cam (`#361e3c`), **đường cua Chữ S rộng (`x: 0 → +7.0 → -7.0 → 0`)** với đoạn rẽ ngang có thanh chắn xoay 90° (`sideLowGap`/`sideHighWall`), phà ngang nối cua và cụm búa lắc đối xứng.
4. **Màn 4 — Cầu Treo Đêm Lồng Đèn (`finishZ: 132`, 4 chặng):** Đêm tối sâu ấm ánh lồng đèn (`#08111f`), leo thang nâng lên `+1.8m` qua cầu hẹp trên cao, rồi **cưỡi Phà Dọc `axis: 'z'` (`z: 66→88`)** chui dưới thanh xà thấp, sau đó nhảy bậc hạ xuống tầng thấp về đích.
5. **Màn 5 — Đỉnh Bão Tuyết Cực Quang (`finishZ: 152`, 5 chặng):** Đêm Cực Quang ngọc lục bảo (`#071e24`), tổng hợp 5 chặng: cầu tách đôi hẹp kèm trụ xoay giữa khe vực → cua vuông góc sang phải (`x = +7.5`) né rào di động → cầu nâng tầng `+1.8m` với 3 búa lắc so le → nước rút mặt băng gió bão.

### Map 2: Công Trường Cao Ốc (`sky_scaffold`)
1. **Màn 1 — Giàn Giáo Bình Minh (`finishZ: 72`, 2 chặng):** Bình minh xanh thép mát (`#182c42`), lên thang nâng tầng 2 (`y = +1.8m`) từ rất sớm và vượt 2 nhịp sàn ván giòn nối dầm cao.
2. **Màn 2 — Sân Cần Cẩu Hoàng Hôn (`finishZ: 98`, 3 chặng):** Hoàng hôn đỏ cam gắt (`#3b1822`), sân thép rộng (`x ∈ [-5.6, +5.6]`) với **cửa thép trượt ngang `moveAxis: 'x'`**, 2 cụm đảo nhảy so le và cặp cần cẩu xoay tầm kính (`centerY = 1.65`).
3. **Màn 3 — Tháp Thang Máy Lệch Tầng (`finishZ: 118`, 3 chặng):** Đêm Đèn Pha công trường (`#090f1c`), **cặp thang nâng tách đôi lệch pha (`0.75 rad`, `ΔY <= 0.75m < 1.8m`)** leo qua 3 tầng (`y: 0 → +1.8m → +3.4m`) xen các đoạn cầu tách đôi ván giòn và cần cẩu cao tầng.
4. **Màn 4 — Dầm Chữ L & Gió Cao Tầng (`finishZ: 136`, 4 chặng):** Trưa mù mây xám bạc (`#24303e`), **khúc cua vuông góc 90° (`x: 0 → +9.2 → 0`)** trên dầm thép mảnh (`2.4m`) chịu gió mạnh và rào xoay ngang 90°, nhảy chuỗi đảo ván siêu giòn để quay về trục Z.
5. **Màn 5 — Bão Sét Nóc Chọc Trời (`finishZ: 156`, 5 chặng):** Bão tím điện từ (`#1b1033`), thang nâng đôi lên `+2.2m` → mê cung cửa trượt ngang `moveAxis: 'x'` trên đảo ván giòn → leo `+4.0m` vào cặp ray thép tách đôi đỉnh tháp + phà dọc `axis: 'z'` qua 2 cần cẩu ngược chiều → dầm hẹp bãi đáp trực thăng.

### Map 3: Xưởng Kẹo Băng Chuyền (`candy_factory`)
1. **Màn 1 — Dây Chuyền Kẹo Dẻo (`finishZ: 72`, 2 chặng):** Xưởng kem dâu hồng pastel (`#361938`), 2 băng chuyền lùa chữ Z (`+Z` nối sang `+X`) và piston dập kẹo chậm.
2. **Màn 2 — Đường Trượt Bạc Hà (`finishZ: 98`, 3 chặng):** Phòng lạnh bạc hà xanh mint (`#0e303a`), **2 làn băng chuyền tách đôi chạy ngược chiều nhau (`P1: +2.0 m/s`, `P2: -1.9 m/s`)** qua khe vực, sau đó hội tụ vào **Cặp Cổng Chéo `Q+E`**.
3. **Màn 3 — Lò Dập Socola Đêm (`finishZ: 118`, 3 chặng):** Xưởng Socola ca cao tối (`#24130d`), **đường đua zic-zắc 3 nhịp (`x: -5.5 ↔ +5.5`)**, băng chuyền đẩy ngang dưới chuỗi piston dập nhịp lệch pha và kẹo mút xoay.
4. **Màn 4 — Mê Cung Đóng Gói Neon (`finishZ: 138`, 4 chặng):** Phân xưởng nho Neon (`#180c36`), băng chuyền tốc độ cao (`3.4 m/s`) phóng sang phà dọc `axis: 'z'` + **cửa trượt ngang `moveAxis: 'x'`** + 2 cổng chéo ngược dấu liên tiếp (`Q+E` rồi `E+Q`).
5. **Màn 5 — Đại Tiệc Kẹo Cầu Vồng (`finishZ: 158`, 5 chặng):** Lễ hội cầu vồng rực rỡ (`#231144`), hội tụ đầy đủ: 2 làn băng chuyền ngược chiều → cua S băng chuyền ngang `3.5 m/s` qua cửa trượt → lên thang nâng `+2.0m` dãy 3 piston kẹo + cổng chéo kép → cầu tách đôi nước rút qua 2 búa kẹo về đích.

## 4. Đồng Bộ Metadata & Tiêu Chí Kiểm Chứng
- Cập nhật tiêu đề, `finishZ`, `stageCount` và mốc `starThresholds` cho 15 màn trong [registry.ts](file:///d:/Codes/LandingPageFunny/paws-game/src/coop/maps/registry.ts).
- Bổ sung kiểm thử tự động trong [levels.test.ts](file:///d:/Codes/LandingPageFunny/paws-game/src/glass/sim/__tests__/levels.test.ts): xác nhận 15 bảng màu không trùng lặp, tồn tại đầy đủ biến thể địa hình (tách 2 cầu, cua S/L `|x| > 5.5`, đa tầng `maxY >= 3.4`, `axis: 'z'`, `moveAxis: 'x'`, băng chuyền ngược chiều), checkpoint spawn chuẩn xác trên nền sàn, và bước mô phỏng ổn định trên cả 15 màn.
