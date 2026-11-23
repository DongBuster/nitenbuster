# Hướng Dẫn Bật Chơi Online 3D (Supabase Free Realtime)

Chế độ **Chơi Online (Mã Phòng)** của **PAWS 3D** sử dụng **Supabase Realtime Broadcast & Presence** (miễn phí 100%, **không cần tạo bảng SQL**, **không cần cấu hình Auth**).

## Chỉ cần 3 bước (mất ~2 phút):

### Bước 1: Tạo Project Supabase miễn phí
1. Truy cập [https://supabase.com](https://supabase.com) và đăng nhập.
2. Nhấn **New Project**, chọn tên bất kỳ (ví dụ `paws-3d-online`) và khu vực gần bạn (Singapore).

### Bước 2: Lấy Project URL & Anon Key
1. Trong bảng điều khiển Supabase, vào **Project Settings → API** (hoặc **Connect → App Frameworks**).
2. Copy 2 giá trị:
   - **Project URL** (`https://xxxxx.supabase.co`)
   - **Anon / Publishable Key** (`eyJ...` hoặc `sb_publishable_...`)

### Bước 3: Tạo file `.env.local` và khởi động lại
1. Tạo file `d:\Codes\LandingPageFunny\paws-game\.env.local` (copy từ `.env.example`):
   ```env
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
2. Khởi động lại dev server:
   ```bash
   npm run dev
   ```
3. Mở **🌐 Chơi Online (Mã Phòng)** trên 2 tab trình duyệt (hoặc gửi mã phòng 5 ký tự cho bạn bè) và chiến thôi!
