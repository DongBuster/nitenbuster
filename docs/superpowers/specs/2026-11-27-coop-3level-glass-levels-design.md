# PAWS Duo Co-op 3D — 3-Level Structure (`Action → Map → 5 Levels`) & 3 Glass Carry Maps (15 Levels) Design Spec

> Ngày: 2026-11-27.
> Chốt với người dùng: **phân cấp 3 tầng `Kiểu hành động (4 kiểu) → Map (bối cảnh + cơ chế biến tấu) → 5 Màn tăng dần độ khó (Dễ → Siêu Khó)`**; **mở khóa tuần tự theo tiến độ Chủ phòng (qua Màn N mở Màn N+1 trong từng Map)**; đợt này hoàn thiện trọn bộ **3 Map cho Bê Kính Pha Lê (15 Màn)**:
> 1. **Map 1 (`cabin_bridge`) — Cầu Gỗ Cabin Tuyết (5 Màn)**
> 2. **Map 2 (`sky_scaffold`) — Công Trường Cao Ốc (5 Màn)** *(thêm thang nâng `axis: 'y'`, sàn ván rụng `fragile`, cần cẩu dầm thép xoay tầm cao)*
> 3. **Map 3 (`candy_factory`) — Xưởng Kẹo Băng Chuyền (5 Màn)** *(thêm băng chuyền `conveyorVx/Vz`, piston kẹo `moveAxis: 'y'`, và khe chéo nghiêng kính `Q + E`)*
> Cùng khung 3 tầng sẵn sàng cho 3 kiểu hành động còn lại (`Chèo Phao`, `Dây Thừng`, `Xe Goòng` — mỗi kiểu giữ sẵn Map 1 · Màn 1, Màn 2–5 đánh dấu *Sắp ra mắt*).

---

## 1. Kiến trúc Phân cấp 3 Tầng & Dữ liệu

### 1.1 Khóa định danh chuẩn (`CoopStageKey`)
- **Cấp 1 — 4 Kiểu Hành Động (`CoopActionId` = alias `CoopMapId`):**
  - `glass_carry` — **Bê Kính Pha Lê** (`3 Map × 5 Màn = 15 màn phát hành → 45★`)
  - `raft_rapids` — **Chèo Phao Vượt Thác** (`Map 1: glacier_river`, `Màn 1` phát hành, `Màn 2–5` *Sắp ra mắt* `→ 3★`)
  - `rope_tether` — **Dây Thừng Buộc Chung** (`Map 1: lantern_peaks`, `Màn 1` phát hành, `Màn 2–5` *Sắp ra mắt* `→ 3★`)
  - `minecart_rails` — **Xe Goòng Đường Ray** (`Map 1: frost_mine`, `Màn 1` phát hành, `Màn 2–5` *Sắp ra mắt* `→ 3★`)
- **Tổng số màn phát hành đợt này:** `15 + 3 = 18 màn` → **`MAX_COOP_STARS = 54★`** (tự động tính từ registry, không hardcode).
- **Khóa lưu trữ mỗi màn:** `"${actionId}:${mapPackId}:${level}"` (vd: `"glass_carry:sky_scaffold:3"`).

### 1.2 Quy tắc Mở khóa Tuần tự & Đồng bộ
- **Màn 1** của mọi Map đã phát hành luôn mở sẵn (cả 3 Map của Bê Kính đều mở sẵn Màn 1 để người chơi có thể thử ngay bối cảnh yêu thích rồi leo dần Màn 1 → 5 trong từng Map!).
- **Màn `N` (`2 ≤ N ≤ 5`)** mở khóa khi Màn `N - 1` của cùng Map đã đạt `bestStars >= 1`.
- Trong phòng Online 2 người, **Chủ phòng (`P1`)** đồng bộ bản đồ mức mở khóa `hostUnlockedByPack: Record<string, number>` (key `"${actionId}:${mapPackId}"`, value `1..5`) qua Presence, và tự động cập nhật ngay lập tức qua `useEffect` mỗi khi `coopLevelRecords` của Host thay đổi (vừa phá đảo Màn `N` là mở ngay Màn `N+1` không cần thoát phòng!).
- Khi hoàn thành chung Màn `N`, **hồ sơ cả 2 người chơi** đều được ghi nhận sao `1–3★` & thưởng Cookies (`3★: +50`, `2★: +30`, `1★: +15`, idempotent theo `matchId`).
- Nút **Tiếp Theo** ở `GlassResultModal`: nếu Màn `N+1` trong cùng Map khả dụng → chuyển ngay sang Màn `N+1`; nếu đã xong Màn 5 của Map → chuyển sang Màn 1 của Map tiếp theo trong cùng Kiểu hành động (hoặc Kiểu hành động kế tiếp).

---

## 2. Mở rộng Engine Vật lý & Theme 3D cho 3 Map Bê Kính

### 2.1 Mở rộng `src/glass/sim/types.ts`, `course.ts`, `physics.ts` (Zero breaking change cho 36 test cũ)
- **`GlassMapTheme`** (optional trên `CourseDef`, mặc định Winter Cabin):
  - `id: 'cabin_bridge' | 'sky_scaffold' | 'candy_factory'`
  - `skyHex`, `fogHex`, `abyssHex`, `deckPrimaryHex`, `deckStripeHex`, `curbHex`, `hazardPrimaryHex`, `hazardStripeHex`, `lanternCoolHex`, `lanternWarmHex`, `ambientLightHex`, `sunLightHex`.
- **Nâng cấp `PlatformDef` (optional fields):**
  - `conveyorVx?: number; conveyorVz?: number` — vận tốc băng chuyền cộng thêm đều lên nhân vật đứng trên sàn (`Xưởng Kẹo`).
  - `fragile?: { fallDelaySec: number; respawnDelaySec: number }` — sàn ván yếu (`Công Trường`): theo dõi `fragileTimers: Record<string, { state: 'solid' | 'shaking' | 'gone'; timer: number }>` trong `GlassSimState`! Khi có ít nhất 1 người đứng lên sàn `'solid'`, chuyển sang `'shaking'` (`timer = fallDelaySec`, mặc định `1.5s`), hết `1.5s` chuyển sang `'gone'` (`timer = respawnDelaySec`, mặc định `3.0s`, không còn đỡ chân → rơi nếu vẫn đứng!), hết `3.0s` mọc lại `'solid'`. Khi hồi sinh Checkpoint, toàn bộ sàn yếu reset về `'solid'`.
- **Nâng cấp `MovingPlatformDef`:**
  - `axis: 'x' | 'y' | 'z'` (bổ sung `'y'` cho **thang nâng giàn giáo** trong `Công Trường`, trả thêm `vy` trong `EvaluatedPlatform` và cộng `vy * dt` cho người đứng trên!).
- **Nâng cấp `BarrierDef`:**
  - `moveAxis?: 'x' | 'y' | 'z'` (bổ sung `'y'` cho **piston kẹo dập lên/xuống** trong `Xưởng Kẹo`).
- **Khe Chéo Nghiêng Kính (`diagonalGap`):**
  - Dựng trực tiếp từ cặp `BarrierDef` tiêu chuẩn (không cần thêm loại vật cản phức tạp!): nửa bên trái `+X` là `lowGap` (`y ∈ [0.95, 2.60]`), nửa bên phải `-X` là `highWall` (`y ∈ [0, 1.25]`) với lối đi hai bên lề cho người chơi. P1 giữ `Q` (`handY = 0.40m`), P2 giữ `E` (`handY = 1.80m`) → `|ΔhandY| = 1.40m < MAX_HAND_DY (1.80m)` → kính nghiêng 22° lọt êm mà không tăng stress!
- **Snapshot 15Hz:** `GlassSnapshotPayload` thêm optional `fragileStates?: Record<string, { s: 0 | 1 | 2; t: number }>` (chỉ gửi khi map có sàn yếu, cực gọn < 40 bytes) để Guest thấy đúng sàn nào đang rung/đã rụng!

---

## 3. Thiết kế 15 Màn Bê Kính Pha Lê (`src/glass/sim/levels.ts`)

### Map 1: Cầu Gỗ Cabin Tuyết (`cabin_bridge`) — *Gỗ thông ấm · Tuyết xanh · Đèn lồng vàng*
| Màn | Độ khó | Tên | Dài & Chặng | Điểm nhấn | 3★ / 2★ |
|---|---|---|---|---|---|
| **1** | Dễ | Khởi Động Cổng Gỗ | `65m` · 2 chặng | Đường rộng `9.2m`, 2 `lowGap`, 2 `highWall`, 1 khe `2.6m` | `75s (≤1)` / `125s (≤4)` |
| **2** | Trung Bình | Sàn Băng & Gió Đông | `90m` · 3 chặng | Khe `2.3m` + sàn băng + 2 quạt gió `±8.0` + cọc mép | `105s (≤2)` / `170s (≤5)` |
| **3** | Khá Khó | Xưởng Búa & Bệ Bay | `110m` · 3 chặng | 2 búa lắc (`1.6`) + trụ xoay (`1.05`) + 2 bệ di chuyển | `135s (≤2)` / `215s (≤6)` |
| **4** | Khó | Cầu Hẹp & Rào Di Động | `130m` · 4 chặng | Gió `±10.5` + 2 rào di động + khe `2.2m` + cầu ngoằn ngoèo + 3 bệ | `165s (≤2)` / `265s (≤6)` |
| **5** | Siêu Khó | Đỉnh Bão Tuyết Cabin | `145m` · 5 chặng | Khe `2.15m`, gió `±11.0`, 3 búa nhanh (`2.0`), trụ xoay (`1.35`), 3 bệ + nước rút | `195s (≤2)` / `310s (≤6)` |

### Map 2: Công Trường Cao Ốc (`sky_scaffold`) — *Giàn giáo vàng-đen · Hoàng hôn cam-tím*
| Màn | Độ khó | Tên | Dài & Chặng | Điểm nhấn | 3★ / 2★ |
|---|---|---|---|---|---|
| **1** | Dễ | Giàn Giáo Tầng 1 | `70m` · 2 chặng | Làm quen **2 sàn ván yếu** (`fallDelay: 2.0s`) + **1 thang nâng `Y`** (`+1.6m`) + rào thép cao/thấp | `80s (≤1)` / `130s (≤4)` |
| **2** | Trung Bình | Cần Cẩu Hoàng Hôn | `95m` · 3 chặng | **Dầm cần cẩu xoay tầm cao (`y = 1.65`)** buộc cúi `Q` hoặc canh nhịp + chuỗi 3 sàn ván yếu (`1.7s`) | `110s (≤2)` / `180s (≤5)` |
| **3** | Khá Khó | Tháp Thang Nâng | `115m` · 3 chặng | 2 **thang nâng `Y`** lệch nhịp nối tầng cao dần + gió tầng cao (`±8.5`) + khe giàn giáo `2.25m` | `140s (≤2)` / `225s (≤6)` |
| **4** | Khó | Dầm Thép Chênh Vênh | `135m` · 4 chặng | 4 sàn ván yếu liên tiếp (`1.5s`) xen bệ di chuyển ngang + 2 cần cẩu tầm cao + búa bao cát | `170s (≤2)` / `275s (≤6)` |
| **5** | Siêu Khó | Nóc Nhà Chọc Trời | `150m` · 5 chặng | Chuỗi leo tầng thang nâng + sàn yếu `1.35s` + gió mạnh `±11.0` + đôi cần cẩu ngược chiều về đỉnh! | `205s (≤2)` / `325s (≤6)` |

### Map 3: Xưởng Kẹo Băng Chuyền (`candy_factory`) — *Kẹo pastel hồng-tím · Đèn neon bạc hà*
| Màn | Độ khó | Tên | Dài & Chặng | Điểm nhấn | 3★ / 2★ |
|---|---|---|---|---|---|
| **1** | Dễ | Dây Chuyền Kẹo Dẻo | `70m` · 2 chặng | Làm quen **băng chuyền đẩy tiến/ngang nhẹ** (`±2.2 m/s`) + **1 piston kẹo** dập chậm (`moveAxis: 'y'`) | `80s (≤1)` / `130s (≤4)` |
| **2** | Trung Bình | Cổng Chéo Kẹo Bạc Hà | `95m` · 3 chặng | Giới thiệu **2 Khe Chéo** (1 người `Q`, 1 người `E` nghiêng kính 22°!) + băng chuyền đẩy ngược (`-2.0 m/s`) | `110s (≤2)` / `180s (≤5)` |
| **3** | Khá Khó | Dập Piston Kẹo Cứng | `115m` · 3 chặng | Chuỗi 3 **piston kẹo** so le nhịp + băng chuyền đảo chiều ngang + trụ kẹo mút xoay | `140s (≤2)` / `225s (≤6)` |
| **4** | Khó | Mê Cung Đóng Gói | `135m` · 4 chặng | Băng chuyền tốc độ cao (`±3.4 m/s`) dẫn thẳng vào **Khe Chéo** & khe hẹp `2.2m` + bệ nhảy băng chuyền | `170s (≤2)` / `275s (≤6)` |
| **5** | Siêu Khó | Đại Tiệc Xưởng Kẹo | `150m` · 5 chặng | Tổ hợp đỉnh cao: băng chuyền ngược/ngang + đôi Khe Chéo đối xứng (`Q/E` rồi đảo `E/Q`!) + 3 piston nhanh + búa kẹo về đích! | `205s (≤2)` / `325s (≤6)` |

---

## 4. UI 3 Tầng & Tương thích

- **`GlassLobby.tsx`:**
  - Hàng 1: **4 Kiểu Hành Động Hợp Tác** (`Kiểu 1–4`, tổng sao từng kiểu `X / 45★` hoặc `X / 3★`).
  - Hàng 2: **Chọn Map** (3 thẻ Map cho Bê Kính: *Cầu Gỗ Cabin*, *Công Trường Cao Ốc*, *Xưởng Kẹo Băng Chuyền* kèm tổng sao `X / 15★` mỗi Map; 1 thẻ cho 3 kiểu kia).
  - Hàng 3: **Chọn Màn (5 Màn: Dễ → Siêu Khó)** — hiển thị tên màn, badge độ khó, sao `0–3★`, ổ khóa `🔒` (cho màn chưa mở theo Chủ phòng) hoặc *Sắp ra mắt* (cho Màn 2–5 của 3 kiểu kia).
- **`GlassHud.tsx`:** Hiển thị `Bê Kính · Màn X`, thanh tiến trình chặng tự co giãn theo `hud.totalStages` (`2..5` chặng).
- **`GlassResultModal.tsx`:** Hiện rõ Kiểu + Map + Màn, huy hiệu **"Đã Mở Khóa Màn X+1!"**, nút chính **Màn Tiếp Theo**.
- **`ModeSelectScreen.tsx`:** Thẻ thứ 4 hiển thị **`4 Kiểu Hợp Tác · 18 Màn`** và tổng sao **`X / 54★`**.
- **`EventRoomScreen.tsx` / `GlassScene.tsx`:** `course` là optional (mặc định `GLASS_COURSE`) nên Event Cup không bị ảnh hưởng.

---

## 5. Kế hoạch Kiểm chứng

1. **Unit Tests (`node --test --experimental-strip-types`):**
   - `registry.test.ts`: 4 Kiểu → Map Packs → 5 Màn, `MAX_COOP_STARS = 54`, `isCoopLevelUnlocked`, `getNextPlayableCoopStage`, `countTotalCoopLevelStars`.
   - `levels.test.ts`: Kiểm tra toàn bộ **15 đường đua Bê Kính** (`3 Maps × 5 Levels`) — mọi checkpoint spawn đứng trên sàn ở `3.2m`, clearances `lowGap` / `highWall` / Khe Chéo chuẩn, độ khó tăng dần.
   - `physics.test.ts`: Bổ sung test cho 4 cơ chế mới: **băng chuyền (`conveyorVx/Vz`)**, **sàn yếu (`fragile` rung `1.5s` → biến mất `3.0s` → hồi phục)**, **thang nâng `axis: 'y'`**, **piston `moveAxis: 'y'`**, và **Khe Chéo nghiêng kính (`Q` + `E` lọt êm với `hp === 3`, giữ ngang bị nứt!)**.
   - `profileStore.test.ts`: Lưu `coopLevelRecords`, migration ngược từ `coopRecords`/`glassBest*`, mở khóa tuần tự Màn 2 sau khi xong Màn 1.
   - Giữ xanh toàn bộ 97 unit test hiện có.
2. **Typecheck & Build:** `npm run build` (`tsc --noEmit && vite build`) exit 0.
3. **Browser Smoke Check:** Kiểm tra sảnh chờ 3 tầng (`4 Kiểu Hành Động` → `3 Map Bê Kính` → `5 Màn Dễ→Siêu Khó` với Màn 1 mở và Màn 2–5 khóa `🔒`), bấm qua lại giữa 3 Map Bê Kính và 3 Kiểu hành động còn lại, 0 lỗi console.
