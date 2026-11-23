# Hướng Dẫn Tạo Mô Hình 3D `.glb` Chất Lượng Studio Cho PAWS

Tài liệu này hướng dẫn từng bước chuyển đổi **8 ảnh nguồn nhân vật** (đã cắt sẵn trong `assets-source/characters/`) thành các file **3D `.glb`** sắc nét đạt 95–100% chất lượng studio để đưa thẳng vào game **PAWS 3D**.

---

## 1. Ảnh nguồn đã cắt sẵn

Toàn bộ 8 nhân vật từ ảnh tham khảo 4×2 đã được tách thành ảnh PNG độ phân giải gốc tại thư mục:

```text
paws-game/assets-source/characters/
├── dog.png       (Chó Corgi)
├── cat.png       (Mèo Xám)
├── duck.png      (Vịt Trắng)
├── shark.png     (Cá Mập)
├── dino.png      (Khủng Long)
├── panda.png     (Panda)
├── chicken.png   (Gà Trắng)
└── bunny.png     (Thỏ Trắng)
```

---

## 2. Công cụ Image-to-3D khuyên dùng

Bạn chỉ cần tải từng file `.png` ở trên lên một trong các nền tảng AI Image-to-3D hàng đầu sau để sinh mô hình `.glb`:

| Công cụ | Điểm mạnh | Khuyên dùng khi |
|---|---|---|
| **Tripo3D** (`https://www.tripo3d.ai`) | Tốc độ rất nhanh, bề mặt thú bông/chibi mượt, hỗ trợ Auto-Rig & export `.glb` chuẩn | Muốn làm nhanh trọn bộ 8 con trong 10–15 phút |
| **Meshy.ai** (`https://www.meshy.ai`) | Giao diện trực quan, chất liệu PBR đẹp, có sẵn thư viện animation + remesh game-ready | Muốn tinh chỉnh texture PBR & xuất kèm chuyển động |
| **Hyper3D Rodin** (`https://hyper3d.ai`) | Độ chi tiết hình khối và bám sát ảnh gốc cực cao (đạt ~95–100%) | Ưu tiên độ đẹp tối đa cho nhân vật chính |
| **Tencent Hunyuan3D 2.0** | Mã nguồn mở / chạy miễn phí qua HuggingFace hoặc local GPU, topology sạch | Muốn tạo miễn phí không giới hạn lượt |

---

## 3. Thiết lập tối ưu để đạt chất lượng Game-Ready

Khi tạo và xuất file `.glb`, hãy chọn các thông số sau để nhân vật vừa đẹp chuẩn plush/vinyl-toy vừa chạy mượt 60 FPS trên trình duyệt:

1. **Bật PBR Textures**:
   - Giữ vật liệu dạng **matte / vải bông mịn** (Roughness cao khoảng `0.65 – 0.85`, Metalness thấp `0.0 – 0.05`) để tránh cảm giác bóng nhựa giả.
   - Đảm bảo texture nhúng sẵn bên trong file `.glb` (Embedded Textures).
2. **Độ phân giải lưới (Polycount)**:
   - Mục tiêu: **15.000 – 30.000 triangles** (game-ready).
   - Dung lượng lý tưởng mỗi file `.glb`: **1 MB – 5 MB** (nếu quá nặng có thể nén nhanh bằng Draco/meshopt hoặc giảm texture xuống 1024×1024).
3. **Hướng mặt & Tỷ lệ**:
   - Engine `GLBCharacter3D` của PAWS **tự động chuẩn hóa kích thước** (chiều cao = `1.65`, căn giữa trục X/Z, đặt bàn chân chạm đúng mặt sàn `y = 0`), nên bạn không cần lo lệch scale.
   - Nếu công cụ cho chỉnh hướng, hãy để mặt nhân vật quay về phía trước (`+Z`).
4. **Auto-Rig & Animation (Tùy chọn)**:
   - Bạn có thể bật **Auto-Rig** trên Tripo3D / Meshy.ai hoặc gắn xương qua **Mixamo** với các tên clip như `idle`, `happy`/`jump`/`wave`, `sad`, `shock`/`hit`, `win`/`cheer` — engine sẽ tự động nhận diện và cross-fade mượt mà.
   - **Không bắt buộc phải rig!** Ngay cả khi bạn xuất file `.glb` **tĩnh (unrigged)**, engine PAWS vẫn tự động áp dụng hệ thống chuyển động **squash-and-stretch 5 cảm xúc** (`idle`, `happy`, `sad`, `shock`, `win`) kèm vòng sáng lượt chơi (`TurnRing3D`) cực kỳ sinh động.

---

## 4. Đặt tên file & Nạp vào dự án

Sau khi tải về, đổi tên chính xác 8 file và chép vào thư mục `paws-game/public/models/`:

```text
paws-game/public/models/
├── dog.glb
├── cat.glb
├── duck.glb
├── shark.glb
├── dino.glb
├── panda.glb
├── chicken.glb
└── bunny.glb
```

> **Cơ chế Hybrid thông minh:** Bạn có thể thêm từng con một (ví dụ mới tạo xong `dog.glb` và `shark.glb`). Nhân vật nào đã có file `.glb` trong `public/models/` sẽ tự động hiển thị bằng mô hình 3D `.glb`, các nhân vật còn lại vẫn tự động dùng mô hình 3D procedural dự phòng mà không hề báo lỗi.

---

## 5. Xem thử tức thì bằng Kéo-Thả (Drag & Drop)

Không cần chép file hay khởi động lại server! Khi mở **3D Studio** trên trình duyệt:

1. Chọn nhân vật bạn muốn xem thử (hoặc mở tab **Soi Nhân Vật 3D**).
2. **Kéo và thả (Drag & Drop)** trực tiếp file `.glb` từ máy tính vào cửa sổ **3D Studio**.
3. Mô hình sẽ lập tức xuất hiện trên bàn xoay 3D để bạn xoay 360°, kiểm tra ánh sáng, bóng đổ và test ngay cả 5 biểu cảm (`idle`, `happy`, `sad`, `shock`, `win`) trước khi quyết định lưu vào `public/models/`.
