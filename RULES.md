# Luật Chơi Chính Thức — PAWS 3D

Tài liệu này là **nguồn sự thật (Source of Truth)** cho toàn bộ logic game trong `src/engine/` và bộ kiểm thử tự động (`src/engine/__tests__/engine.test.ts`).

---

## 1. Mục tiêu & Chia bài

- **Số người chơi:** 2 đến 8 người (1 người chơi + 1–7 Bot AI).
- **Khởi đầu:** Mỗi người được chia **7 lá bài**.
- **Chồng bài đánh (Discard Pile):** Lật 1 lá bài có màu (ưu tiên lá số `Basic`) đặt giữa bàn để xác định màu bắt đầu.
- **Mục tiêu:** Ai đánh hết toàn bộ bài trên tay trước sẽ **CHIẾN THẮNG** ngay lập tức!

---

## 2. Hệ thống 4 màu & Hỗ trợ mù màu

Mỗi màu đi kèm 1 hình khối cố định ở góc lá bài để người chơi mù màu vẫn phân biệt 100% chính xác:

| Màu | Tên tiếng Việt | Biểu tượng |
|---|---|---|
| `pink` | Hồng | `●` (Hình tròn) |
| `blue` | Xanh dương | `■` (Hình vuông) |
| `green` | Xanh lá | `▲` (Tam giác) |
| `yellow` | Vàng | `★` (Ngôi sao) |

---

## 3. Luật đi lượt cơ bản

1. Đến lượt bạn, bạn được đánh 1 lá bài hợp lệ nếu:
   - Lá bài có **cùng màu** với màu hiện tại trên bàn (`currentColor`), **HOẶC**
   - Lá bài có **cùng số** (với lá `Basic`) hoặc **cùng loại hành động** với lá trên cùng của chồng bỏ, **HOẶC**
   - Là **lá Wild** (đánh lên bất kỳ lá nào khi không bị phạt Xẻng Tuyết).
2. Nếu không có lá hợp lệ (hoặc muốn giữ bài), nhấn **Rút Bài** (`Space`) để rút 1 lá từ chồng rút rồi qua lượt.
3. Khi chồng rút cạn, hệ thống tự động giữ lại lá trên cùng của chồng bỏ và xáo toàn bộ phần còn lại làm chồng rút mới.
4. **Quy tắc Hô "PAWS!":** Khi trên tay còn **1–2 lá bài**, nhấn nút **🐾 Hô PAWS!** để báo hiệu sắp về đích.

---

## 4. Thành phần bộ bài

- **Chế độ MVP (112 lá):**
  - Mỗi màu (×4): `Basic` số `0` (×1), số `1–9` (×2 mỗi số), `Kem Đá / Freeze` (×2), `Vòng Xoay / Boomerang` (×2), `Xẻng Tuyết / Shovel` (×2), `Mũi Tên / Arrow` (×1) → 26 × 4 = **104 lá màu**.
  - Lá Wild: `Vỏ Chuối / Banana` (×4), `Tia Chớp / Taser` (×4) → **8 lá Wild**.
- **Chế độ Đầy đủ — Full (122 lá):**
  - Toàn bộ 112 lá MVP + `Nỏ Thần / Crossbow` (×1 mỗi màu = 4 lá) + Wild: `Trứng Bất Ngờ / Egg` (×2), `Bom Kẹo / Bomb` (×2), `Thuốc Tàng Hình / Potion` (×2) → **+10 lá**.

---

## 5. Hiệu ứng 11 loại lá bài

| Mã (`CardType`) | Tên tiếng Việt | Loại | Hiệu ứng chi tiết |
|---|---|---|---|
| `basic` | Số (0–9) | Màu | Đánh ghép theo màu hoặc số. |
| `arrow` | Mũi Tên | Màu | Lá thường ghép theo màu hoặc ký hiệu Mũi Tên. |
| `freeze` | Kem Đá | Màu | Đóng băng người kế tiếp, khiến họ mất lượt (`skip = 1`). |
| `boomerang` | Vòng Xoay | Màu | Đảo chiều bàn chơi (`1 ↔ -1`). Với ván 2 người, hoạt động như mất lượt để bạn được đánh tiếp. |
| `shovel` | Xẻng Tuyết | Màu | Cộng dồn phạt rút `+2` lá cho người kế. Người kế chỉ được đánh tiếp `Xẻng Tuyết` để cộng dồn (+4, +6...), dùng `Thuốc Tàng Hình` để đẩy sang người tiếp theo, hoặc chịu rút toàn bộ. |
| `crossbow` | Nỏ Thần | Màu | Chọn 1 đối thủ bất kỳ trên bàn để chuyển 1 lá từ chồng rút vào tay họ. |
| `taser` | Tia Chớp | Wild | Chọn màu mới. Người kế tiếp phải rút bài liên tục cho đến khi rút trúng lá cùng màu vừa chọn hoặc 1 lá Wild. |
| `banana` | Vỏ Chuối | Wild | Chọn màu mới. Chính lá Vỏ Chuối được gài bẫy (`trapped`) và nhét ngẫu nhiên lại vào **chồng rút**. Ai rút trúng sẽ trượt vỏ chuối và phải rút thêm **3 lá phạt**! |
| `bomb` | Bom Kẹo | Wild | Chọn màu mới và kích hoạt bộ đếm ngược (`fuse = số người chơi`). Sau mỗi lượt bộ đếm giảm 1; khi về `0` trước mặt ai, người đó bị nổ và rút **+4 lá**. |
| `egg` | Trứng Bất Ngờ | Wild | Chọn màu mới, sau đó nở ngẫu nhiên thành 1 trong 5 hiệu ứng (`freeze`, `boomerang`, `shovel`, `taser`, `basic`) và áp dụng ngay. |
| `potion` | Thuốc Tàng Hình | Wild | Chọn màu mới. Nếu đang bị phạt cộng dồn `Xẻng Tuyết`, Thuốc Tàng Hình giúp bạn **phản đòn**, chuyển nguyên số lá phạt sang người kế tiếp! |

---

## 6. Bất biến hệ thống (Engine Invariants)

1. **Bảo toàn tổng số lá bài:** Sau mọi hành động (`dealGame`, `playCard`, `drawTurnAction`, `reshuffleIfNeeded`, `callPaws`), tổng `drawPile.length + discardPile.length + Σ player.hand.length` **luôn không đổi** (112 với `mvp`, 122 với `full`).
2. **Thắng ngay trên lá cuối:** Nếu lá cuối cùng trên tay là lá hành động (như `Kem Đá`, `Xẻng Tuyết`), người đánh vẫn chiến thắng ngay lập tức (`winnerId` được gán).
3. **Immutable State:** Mọi hàm engine trả về `GameState` mới hoàn toàn, hỗ trợ kiểm thử lặp lại với `seed`.
