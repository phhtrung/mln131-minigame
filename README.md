# Gia đình Việt Nam · Đoán nét, nhớ ý

MVP web game tương tác dùng ở phần cuối bài thuyết trình MLN131. Đây là minigame độc lập, **không phải SPST**.

## Chạy local

```bash
npm install
npm run dev
```

- Người chơi: http://localhost:5173/
- Host điều phối: http://localhost:5173/?host=1
- Màn hình máy chiếu: http://localhost:5173/?projector=1

Nếu muốn chạy giống production:

```bash
npm run build
npm start
```

Sau đó mở http://localhost:3000/.

## Luật MVP

- Mỗi vòng chọn ngẫu nhiên một họa sĩ; vai trò không lặp lại cho tới khi mọi người đã vẽ.
- Họa sĩ chọn một trong ba từ khóa và có 45 giây để vẽ.
- Người chơi gửi đáp án riêng tư; đáp án đúng đầu tiên nhận 500 điểm.
- Người đoán đầu tiên trả lời câu hỏi ABCD: đúng +400, sai −200, hết giờ −100.
- Sau mỗi vòng có Educational Reveal: đáp án, giải thích ngắn và ý chính liên hệ chủ đề.
- Reactions được phép; không có open chat để giữ nhịp và giảm spam.

## Triển khai Render

1. Tạo repository và đẩy **nội dung thư mục `web-game`** lên GitHub.
2. Trong Render chọn **New → Blueprint** (nếu giữ `render.yaml`) hoặc **New → Web Service**.
3. Dùng các lệnh:
   - Build: `npm ci && npm run build`
   - Start: `npm start`
   - Health check: `/healthz`
4. Sau khi deploy, kiểm tra `https://<ten-service>.onrender.com/healthz` trả về `{"ok":true}`.
5. Gửi link gốc cho người chơi, thêm `?host=1` cho máy host và `?projector=1` cho máy chiếu.

> Free Render service phù hợp để thử nghiệm nhưng có thể sleep khi không có traffic. Trước giờ thuyết trình nên mở link, chạy thử một vòng và cân nhắc nâng lên instance nhỏ trả phí để tránh cold start.

## Kiểm thử nhanh

```bash
npm run typecheck
npm run build
```

Mục tiêu tiếp theo trước khi dùng thật: test với ít nhất 10–15 trình duyệt, kiểm tra mạng Wi‑Fi lớp học và chuẩn bị một bộ từ khóa dự phòng trên giấy.
