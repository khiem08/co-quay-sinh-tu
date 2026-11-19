# Cò Quay Sinh Tử — WebSocket Relay

## Triển khai
1. Đưa toàn bộ nội dung thư mục này lên GitHub (không chỉ tải riêng `index.html`).
2. Trên Netlify, import repository và giữ thư mục gốc làm Base directory.
3. Bật Netlify Server cho site/tài khoản nếu gói được hỗ trợ.
4. Deploy. Tệp tĩnh nằm trong `public/`; máy chủ ở `netlify/server/index.mjs` xử lý WebSocket tại `/ws`.
5. Mở trang HTTPS trên Laptop, mở phòng Quiz HSK và dùng QR chung. Thử ít nhất một điện thoại Wi-Fi và một điện thoại 4G/5G.

## Luật Cò Quay Sinh Tử hiện tại
- Mỗi người chơi bắt đầu với 1 tim. Trúng đạn thật sẽ mất tim và bị loại; đạn giả không gây sát thương.
- Không còn vật phẩm.
- Mỗi băng có 6 viên; ngẫu nhiên 1, 2 hoặc 3 viên đạn thật, còn lại là đạn giả. Thứ tự được xáo trộn và giữ bí mật.
- Mỗi người còn sống chỉ được bắn đúng 1 lần trong một vòng. Sau phát bắn, lượt chuyển sang người còn sống tiếp theo, kể cả khi vừa bắn đạn giả hoặc tự bắn.
- Khi tất cả người còn sống đã bắn xong, các điện thoại hiển thị một câu hỏi HSK nhanh. Mỗi người còn sống có một lần trả lời. Người trả lời đúng đầu tiên được xem riêng trạng thái viên đạn kế tiếp (đạn thật hay đạn giả). Thông tin này chỉ hiển thị trên điện thoại của người thắng và bị xóa sau phát bắn kế tiếp.
- Sau câu hỏi, bắt đầu vòng bắn mới với những người còn sống.

## Giới hạn triển khai
- Kết nối điện thoại dùng WebSocket relay tại `/ws`, không dùng WebRTC và không cần TURN.
- Trạng thái phòng/người chơi được lưu trong bộ nhớ của một Netlify Server instance. Giữ một instance cho một phòng chơi; không bật nhiều instance nếu chưa bổ sung cơ chế đồng bộ trạng thái.
- Khả năng kết nối đồng thời phụ thuộc vào gói Netlify Server, giới hạn instance, mạng và thiết bị. Cần thử nghiệm với quy mô dự kiến trước khi tổ chức thật.
