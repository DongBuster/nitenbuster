# Kế hoạch Kiến trúc & Phát triển — PAWS 3D Web Game

Tài liệu tổng hợp kiến trúc hiện tại và lộ trình phát triển của **PAWS 3D** — game đấu bài động vật thú bông 3D chạy trực tiếp trên trình duyệt (WebGL + React Three Fiber).

---

## 1. Ngăn xếp công nghệ (Tech Stack)

| Lớp | Công nghệ | Vai trò |
|---|---|---|
| Core UI | React 19 + TypeScript 5 + Vite 6 | Giao diện nhanh, an toàn kiểu dữ liệu |
| 3D WebGL | Three.js + `@react-three/fiber` v9 + `@react-three/drei` v10 | Bàn chơi Winter Cabin 3D, 8 thú bông Velvet Plush, lá bài 3D vật lý |
| Animation 2D | Framer Motion | Tay bài xếp quạt, modal, chuyển cảnh mượt mà (hỗ trợ `prefers-reduced-motion`) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) | Hệ thống màu pastel ấm áp, responsive desktop & mobile |
| Âm thanh | Web Audio API (`src/audio/soundEngine.ts`) | Hiệu ứng âm thanh procedural cho 11 lá bài + nhạc nền hộp nhạc Winter Cabin |
| Lưu trữ | `localStorage` (`src/store/profileStore.ts`) | Tiền tệ Cookies, thống kê thắng/thua, cửa hàng phụ kiện, cài đặt |
| Kiểm thử | Node 24 native `node:test` + `node:assert/strict` | Unit test luật chơi, bot AI và bất biến bảo toàn số lá bài |

---

## 2. Cấu trúc thư mục

```text
paws-game/
├─ RULES.md                     # Luật chơi chính thức (Source of Truth)
├─ PLAN_3D.md                   # Kế hoạch kiến trúc 3D
├─ MODEL_GUIDE.md               # Hướng dẫn tạo & nạp file .glb 3D
├─ public/models/               # Thư mục nạp file .glb tùy chọn (dog.glb .. bunny.glb)
├─ assets-source/characters/    # 8 ảnh tham chiếu đã cắt sẵn (256×341 PNG)
└─ src/
   ├─ engine/                   # Logic thuần TypeScript (chạy độc lập trên Node & Browser)
   │  ├─ types.ts               # AnimalId, CardData, GameState, Player, BombState...
   │  ├─ deck.ts                # Seeded RNG, createDeck (112/122), shuffleDeck, invariant helper
   │  ├─ rules.ts               # isPlayable, getPlayableCards, needsColorChoice, needsTargetChoice
   │  ├─ game.ts                # dealGame, playCard (11 lá), drawTurnAction, callPaws, reshuffle
   │  ├─ bot.ts                 # AI 3 cấp độ (easy/medium/hard) + câu thoại theo tính cách
   │  └─ __tests__/             # Bộ test tự động 12 kịch bản + mô phỏng 50 lượt bot-vs-bot
   ├─ scene3d/                  # Toàn bộ thế giới 3D WebGL
   │  ├─ plushMaterial.ts       # MeshPhysicalMaterial velvet sheen + procedural bump + LatheGeometry
   │  ├─ CharacterRig3D.tsx     # Procedural motion rig (5 cảm xúc) + Face3D + TurnRing3D
   │  ├─ GLBCharacter3D.tsx     # Hybrid loader (.glb auto-normalize + dual animation + ErrorBoundary)
   │  ├─ Character3D.tsx        # Bộ điều phối Hybrid GLB / Procedural 3D
   │  ├─ animals/               # 8 thú bông 3D (Dog, Cat, Duck, Shark, Dino, Panda, Chicken, Bunny)
   │  ├─ cardTextures.ts        # High-DPI CanvasTexture (512×720) có cache cho 11 lá + mặt sau
   │  ├─ Card3D.tsx             # Lá bài 3D vật lý có lật 180°, nhấc hover, ánh sáng chọn
   │  ├─ CardFan3D.tsx          # Quạt bài 3D cong
   │  ├─ WinterCabinStage.tsx   # Bàn gỗ bọc nỉ xanh, bệ xoay, ánh sáng 3 điểm + offline Environment
   │  └─ GameTableScene3D.tsx   # Sân khấu trận đấu 3D trực tiếp với 4–8 nhân vật + chồng bài
   ├─ audio/soundEngine.ts      # Bộ tổng hợp âm thanh Web Audio API (không cần tải file MP3)
   ├─ store/profileStore.ts     # Quản lý Cookies, thống kê, phụ kiện & cài đặt người chơi
   ├─ components/
   │  ├─ Card/                  # Hệ thống lá bài 2D + màu sắc hỗ trợ mù màu
   │  ├─ Character/             # Avatar 2D SVG chibi + Framer Motion
   │  └─ Modals/                # ColorPicker, TargetPicker, Result, Rules, CookieShop
   └─ screens/
      ├─ MainMenuScreen.tsx     # Màn hình chính 3D Winter Cabin Hero + chọn thú & thiết lập trận
      ├─ Game3DScreen.tsx       # Màn hình thi đấu 3D hoàn chỉnh + HUD + vòng lặp Bot
      ├─ Showcase3D.tsx         # 3D Studio soi nhân vật, bàn chơi, lá bài & kéo-thả .glb
      └─ AssetShowcase.tsx      # 2D Reference kiểm tra biểu cảm & chế độ giả lập mù màu
```

---

## 3. Bộ 8 nhân vật thú bông 3D (Hybrid GLB + Procedural Plush)

| ID | Tên | Đặc điểm nổi bật |
|---|---|---|
| `dog` | Chó Corgi | Lông cam-trắng, vòng cổ đỏ + thẻ xương vàng 3D |
| `cat` | Mèo Xám | Mèo Anh lông ngắn xám-trắng, mắt híp kiêu kỳ, vòng cổ xanh + chuông vàng |
| `duck` | Vịt Trắng | Thân quả lê kem mũm mĩm, mỏ cam bản rộng, chân màng cam |
| `shark` | Cá Mập | Xanh lam pastel, vây lưng, miệng cười lộ răng bông trắng |
| `dino` | Khủng Long | Xanh bơ, hàng gai lưng vàng tròn mềm, đuôi béo dễ thương |
| `panda` | Panda | Kem trắng + mảng mắt nâu than nghiêng, tay ôm trước ngực |
| `chicken` | Gà Trắng | Trắng kem tròn trĩnh, mào cam 3 múi, mỏ cam |
| `bunny` | Thỏ Trắng | Tai thỏ dựng dài lót hồng pastel, đuôi bông tròn |

Hệ thống hỗ trợ **nạp file `.glb` trực tiếp** (tự động từ `public/models/<id>.glb` hoặc kéo-thả trong 3D Studio) với chuẩn hóa kích thước tự động (`Box3`) và fallback mượt về thú bông 3D procedural nếu chưa có file.

---

## 4. Lộ trình giai đoạn tiếp theo (v2.0+)

- **Multiplayer Online:** Đồng bộ `GameState` qua WebSocket / Colyseus theo mã phòng mời (tối đa 8 người).
- **Phụ kiện 3D gắn trực tiếp lên đầu nhân vật:** Hiển thị mũ vương miện, khăn len, kính râm ngay trên bàn chơi 3D.
- **Hiệu ứng hạt 3D theo lá bài:** Tuyết rơi khi đánh Kem Đá, tia sét khi đánh Tia Chớp, pháo giấy 3D khi thắng.
