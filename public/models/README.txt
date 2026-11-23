PAWS 3D Character Models (.glb)
================================

Đặt các file mô hình 3D `.glb` vào thư mục này (`public/models/`) để game tự động
nạp và thay thế nhân vật 3D tạm (procedural fallback).

Danh sách 8 tên file chuẩn:
1. dog.glb      — Chó Corgi
2. cat.glb      — Mèo Xám
3. duck.glb     — Vịt Trắng
4. shark.glb    — Cá Mập
5. dino.glb     — Khủng Long
6. panda.glb    — Panda
7. chicken.glb  — Gà Trắng
8. bunny.glb    — Thỏ Trắng

Lưu ý:
- Hệ thống tự động chuẩn hóa chiều cao (1.65 units), căn giữa X/Z và đặt chân chạm mặt bàn (y = 0).
- Nếu file `.glb` có sẵn skeletal animations (idle, happy/jump/wave, sad, shock/hit, win/cheer),
  game sẽ tự cross-fade. Nếu là `.glb` tĩnh, hệ thống tự thêm hiệu ứng nhún/lắc/nhảy plush 3D.
- Nếu thiếu file hoặc file lỗi, game tự động quay về nhân vật 3D tạm mà không crash.
