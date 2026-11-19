# Cò Quay Sinh Tử — WebSocket relay deployment

## Deploy
1. Upload this whole folder/repository to GitHub (do not upload only `index.html`).
2. In Netlify, import the repository and set the base directory to the project root.
3. Enable **Netlify Server** for the site/account (Early Access feature, if available on the plan).
4. Deploy. Static files come from `public/`; the long-lived server in `netlify/server/index.mjs` handles `wss://YOUR-SITE.netlify.app/ws`.
5. Open the HTTPS site on the laptop, open the Quiz HSK lobby and use the single QR code. Test with two phones, including one on mobile data.

## Important limits
- This is a real WebSocket relay, not WebRTC; clients do not need a direct peer connection or TURN server.
- Room/participant state is currently held in the Netlify Server instance's memory. Netlify Server is currently Early Access and instance count/availability depends on plan. Keep this as a single-instance deployment for one live game room; do not enable multiple instances unless shared room state/pub-sub is added.
- Browser reload of the host still creates a new game session. A dropped phone connection can reconnect for up to 45 seconds; the host room is retained for up to 2 minutes after a host socket interruption, while the process remains alive.
- The app itself has no fixed quiz participant cap, but capacity depends on the Netlify Server plan, instance limits, network, and device performance. Test the expected audience before the event.


## Luật chơi hiện tại
- Mỗi người chơi bắt đầu với đúng **1 trái tim**; trúng đạn thật sẽ bị loại ngay.
- Không có vật phẩm, túi đồ hoặc phần tiếp tế vật phẩm.
- Mỗi băng có đúng **6 viên**. Mỗi lần nạp ngẫu nhiên **1, 2 hoặc 3 viên đạn thật**; số còn lại là đạn giả. Thứ tự đạn được xáo trộn.
- Khi hết 6 viên, trò chơi tự nạp băng mới.
- Đến lượt của mình, người chơi có thể chọn bất kỳ người còn sống nào làm mục tiêu; vẫn có thể tự bắn mình. Bắn đạn giả vào chính mình thì giữ lượt như luật cũ.
- Giao diện sử dụng font hệ thống dễ đọc, có fallback cho tiếng Việt và chữ Trung.
