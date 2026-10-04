# Gia đình Việt Nam · Đoán nét, nhớ ý

MVP web game tương tác dùng ở phần cuối bài thuyết trình MLN131. Đây là minigame độc lập, **không phải SPST**.

## Chạy local

```powershell
npm install
$env:PROJECTOR_PASSWORD = "replace-this-with-a-random-secret-of-32-characters"
npm run dev
```

Thay giá trị mẫu bằng chuỗi ngẫu nhiên của bạn. `PROJECTOR_PASSWORD` là bí mật chỉ đặt trên máy chủ; không dùng lại mật khẩu cá nhân. Máy chủ từ chối khởi động nếu biến này chưa được đặt hoặc ngắn hơn 16 ký tự.

- Người chơi: http://localhost:5173/
- Màn hình máy chiếu: http://localhost:5173/?projector=1 — màn hình hỏi `PROJECTOR_PASSWORD`; máy chủ cũng từ chối kết nối sai mật khẩu, nên máy chiếu chưa xác thực sẽ không thấy quiz/reveal và không bấm được "Bắt đầu"/"Mở đáp án".
- Phòng chứa tối đa 60 người. Người mất kết nối giữ chỗ để vào lại trong 60 giây, sau đó tự bị xóa khỏi phòng; máy chiếu có thể loại người chơi ở sảnh hoặc trong ván.
- Mỗi người chơi gửi tối đa một phản ứng mỗi giây.

Nếu muốn chạy giống production:

```bash
npm run build
npm start
```

Sau đó mở http://localhost:3000/.

## Luật MVP

- Mỗi vòng chọn ngẫu nhiên một họa sĩ trong số người trực tuyến; vai trò không lặp lại cho tới khi mọi người đã vẽ.
- Họa sĩ chọn một trong ba từ khóa (8 giây, quá giờ server tự chọn), sau đó có đếm ngược 3·2·1 và 45 giây để vẽ và đoán.
- Nét vẽ được stream trực tiếp tới mọi người; họa sĩ có bảng màu, chọn màu riêng, bút chỉnh cỡ, tẩy, tô vùng kín, hoàn tác và xóa bảng.
- Người chơi gửi đáp án riêng tư (không cần gõ dấu); đoán sai được phản hồi riêng, đoán đúng được công bố điểm.
- Từ khóa hiển thị dạng gạch dưới theo độ dài; chữ cái luôn được che trong suốt lượt vẽ.
- Điểm người đoán tăng theo thời gian vẽ còn lại khi đáp án đúng (nhanh nhất tối đa 500, sàn 50) kèm thưởng thứ tự cho ba người đoán đầu; họa sĩ được điểm theo tỉ lệ người đoán đúng so với số người trực tuyến (tối đa 500, không ai đoán đúng thì không được điểm).
- Người đoán đầu tiên trả lời câu hỏi ABCD (thứ tự đáp án xáo trộn mỗi ván, không giới hạn thời gian; câu hỏi hiển thị trên máy chiếu để cả lớp cùng theo dõi): chốt đáp án rồi máy chiếu bấm "Mở đáp án" — đúng +400, sai −200, chưa trả lời thì không bị trừ điểm.
- Mỗi ván có 10 vòng, chọn từ ngân hàng 36 từ về gia đình; người đoán đúng đầu tiên trả lời câu hỏi ABCD gắn với từ đó. Sau mỗi vòng có Educational Reveal: đáp án, giải thích ngắn và ý chính liên hệ chủ đề; reveal đứng yên chờ máy chiếu bấm "Vòng tiếp theo" (không tự nhảy giờ); hết game có trang tổng kết cả 10 chủ đề, podium top 3 và xuất bảng xếp hạng (ảnh PNG/chép văn bản).
- Từ khóa không lặp lại trong một ván chơi; máy chiếu bấm "Chơi lại" sau khi kết thúc để quay về sảnh với điểm số về 0. Máy chiếu bấm "Bắt đầu trò chơi", "Mở đáp án" và "Vòng tiếp theo".
- Mất kết nối (kể cả refresh trang) vào lại bằng đúng danh tính cũ và giữ nguyên điểm số; họa sĩ rời phòng quá 3 giây sẽ có người thay ngay.
- Reactions dùng tám emoji Twemoji nhất quán như khóc, hoa héo, dấu hỏi, đầu lâu, thở dài, chắp tay, lạnh cóng và toát mồ hôi; emoji bay lên từ đáy màn hình và hiện thông báo cạnh bảng vẽ (kể cả trên máy chiếu); không có open chat để giữ nhịp; có âm thanh và nút tắt tiếng trên thanh trên.

Emoji artwork: Twemoji v14.0.2, licensed under CC-BY 4.0 by Twitter, Inc.

## Kiểm thử nhanh

```bash
npm run typecheck
npm run build
npm run test:smoke
```

`test:smoke` tự dựng server thử nghiệm (port 4123, tăng tốc timer) và mô phỏng projector + 5 người chơi qua đủ 10 vòng: đoán, quiz, từ khóa che cố định, reconnect, thay họa sĩ, chơi lại. Muốn chạy production giống thật: `npm run build && npm start` rồi mở http://localhost:3000/.

## Triển khai Render

1. Tạo repository và đẩy **nội dung thư mục `web-game`** lên GitHub.
2. Trong Render chọn **New → Blueprint** (nếu giữ `render.yaml`) hoặc **New → Web Service**.
3. Dùng các lệnh:
   - Build: `npm ci && npm run build`
   - Start: `npm start`
   - Health check: `/healthz`
4. Sau khi deploy, kiểm tra `https://<ten-service>.onrender.com/healthz` trả về `{"ok":true}`.
5. Trong Render đặt `PROJECTOR_PASSWORD` thành một chuỗi ngẫu nhiên ít nhất 16 ký tự. `render.yaml` đánh dấu biến này là bí mật và Render sẽ yêu cầu bạn nhập khi tạo dịch vụ.
6. Gửi link gốc cho người chơi và thêm `?projector=1` cho máy chiếu (nhớ mật khẩu máy chiếu để mở màn hình).

> Free Render service phù hợp để thử nghiệm nhưng có thể sleep khi không có traffic. Trước giờ thuyết trình nên mở link, chạy thử một vòng và cân nhắc nâng lên instance nhỏ trả phí để tránh cold start.

Mục tiêu tiếp theo trước khi dùng thật: test với ít nhất 10–15 trình duyệt, kiểm tra mạng Wi‑Fi lớp học và chuẩn bị một bộ từ khóa dự phòng trên giấy.
