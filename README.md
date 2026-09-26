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

- Mỗi vòng chọn ngẫu nhiên một họa sĩ trong số người trực tuyến; vai trò không lặp lại cho tới khi mọi người đã vẽ.
- Họa sĩ chọn một trong ba từ khóa (8 giây, quá giờ server tự chọn), sau đó có đếm ngược 3·2·1 và 45 giây để vẽ.
- Nét vẽ được stream trực tiếp tới mọi người; họa sĩ có bảng màu 12 màu, tẩy, hoàn tác và xóa bảng.
- Người chơi gửi đáp án riêng tư (không cần gõ dấu); đoán sai được phản hồi riêng, đoán đúng được công bố điểm.
- Từ khóa hiển thị dạng che với mọi người; sau 30 giây và 15 giây cuối, hệ thống mở dần một phần chữ cái.
- Điểm người đoán tăng theo thời gian vẽ còn lại khi đáp án đúng (nhanh nhất tối đa 500, sàn 50) kèm thưởng thứ tự cho ba người đoán đầu; họa sĩ được điểm theo tỉ lệ người đoán đúng so với số người trực tuyến (tối đa 500, không ai đoán đúng thì không được điểm).
- Người đoán đầu tiên trả lời câu hỏi ABCD (thứ tự đáp án xáo trộn mỗi ván): đúng +400, sai −200, hết giờ −100.
- Sau mỗi vòng có Educational Reveal: đáp án, giải thích ngắn và ý chính liên hệ chủ đề; hết game có trang tổng kết cả 7 chủ đề, podium top 3 và xuất bảng xếp hạng (ảnh PNG/chép văn bản).
- Từ khóa không lặp lại trong một ván chơi; host bấm "Chơi lại" sau khi kết thúc để quay về sảnh với điểm số về 0.
- Mất kết nối (kể cả refresh trang) vào lại bằng đúng danh tính cũ và giữ nguyên điểm số; họa sĩ rời phòng quá 3 giây sẽ có người thay ngay.
- Reactions được phép (giới hạn 3 giây/lần); không có open chat để giữ nhịp và giảm spam; có âm thanh và nút tắt tiếng trên thanh trên.

## Kiểm thử nhanh

```bash
npm run typecheck
npm run build
npm run test:smoke
```

`test:smoke` tự dựng server thử nghiệm (port 4123, tăng tốc timer) và mô phỏng host + 5 người chơi qua đủ 7 vòng: đoán, quiz, gợi ý chữ, reconnect, thay họa sĩ, chơi lại — 77 kiểm thử. Muốn chạy production giống thật: `npm run build && npm start` rồi mở http://localhost:3000/.

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

Mục tiêu tiếp theo trước khi dùng thật: test với ít nhất 10–15 trình duyệt, kiểm tra mạng Wi‑Fi lớp học và chuẩn bị một bộ từ khóa dự phòng trên giấy.
