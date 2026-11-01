# Giao diện màn hình lớn và nguồn lịch sử AI trong Studio

## Yêu cầu

Tận dụng màn hình desktop lớn hơn, làm rõ lý do Studio không có thông tin AI sau khi chạy Docker và chỉnh lại form thêm agent theo phản hồi giao diện.

## Hành vi và lý do

- `public/style.css`: bỏ giới hạn main 1800 px. Từ 1440 px, tăng cỡ chữ/nút/bảng, căn sidebar và padding theo chiều rộng. Studio bỏ trần 960 px và dùng chiều cao viewport; cột session rộng hơn. Nội dung chat giữ chiều dài dòng hợp lý. Tài liệu, project grid, Board và dialog tận dụng thêm diện tích.
- `session-catalog.mjs`: danh mục metadata từ log Codex/Claude, cache theo kích thước và mtime, đọc tối đa 64 KB đầu/file. Chỉ trả trường metadata được chọn; không trả nội dung chat, đường dẫn file log, tool hoặc thinking. Loại agent/subagent, gộp ID trùng, lấy model nếu metadata có ghi nhận. Tiêu đề dựa vào title/slug hoặc repo và ID, không lấy prompt.
- `studio.mjs`: bổ sung danh mục log khi bật `TN_STUDIO_LOG_CATALOG`, gộp metadata Desktop theo CLI session ID. Trả số phiên mỗi nguồn và khả năng gửi/mở. `TN_STUDIO_READ_ONLY` chặn gửi/mở và bàn giao UI tự động trong Studio.
- `configure-docker-host.mjs`, `.gitignore`, `compose.yaml`: tạo override local chỉ mount các thư mục session tồn tại, bật chế độ lịch sử trong container. Không mount credential hoặc MCP config; không sửa log nguồn. Windows đã có lịch sử nhưng container ban đầu không có CLI hay nguồn log, nên Studio trước đó trống.
- `public/studio.js`: hai ô nguồn AI có số phiên và chế độ lịch sử, tên nguồn đúng loại, metadata model khi có. Ẩn các nút gửi/tạo/mở Desktop khi không được hỗ trợ; vẫn đọc session và Trace. `server.mjs` chặn hành động Studio/Desktop tương ứng và dùng workRoot đã cấu hình cho session mới trên runtime hỗ trợ gửi.
- Form agent: chi tiết tại `agents-harness-log.md`; giữ nguyên API cấu hình và thay đổi cách nhập/hiển thị.

## Kiểm tra đã chạy

- Build image và `docker compose up -d --build --wait --wait-timeout 90`: healthy.
- Danh mục nguồn thực trong container đọc được cả Codex và Claude. Số lượng thay đổi khi Desktop tạo/cập nhật log; lúc kiểm tra có hơn 40 phiên sau khi loại log phụ. Kiểm tra HTTP có đăng nhập: lọc từng provider, phân trang Claude, đọc tối đa 20 tin được chọn, chỉ role user/assistant và session có readOnly. Không ghi nội dung hội thoại vào tài liệu này.
- `docker inspect`: các mount workspace và ba thư mục session đều writable=false; app data writable=true.
- 84/84 test Node trên Windows và image Linux, gồm 4 test mới về metadata/model/cache, giới hạn prefix, lọc subagent, gộp ID và backend chế độ chỉ xem không gọi Desktop.
- Chromium headless qua Playwright: 72 tổ hợp trang/viewport ở 390×844, 768×1024, 1024×768, 1440×900, 1920×1080, 2560×1440, 3440×1440 và 3840×2160 không tràn ngang, không lỗi JavaScript. Trên QHD/ultrawide, main không còn khoảng trống bên phải do max-width; Studio cao 1308 px ở viewport cao 1440 px, so với 960 px trước thay đổi.
- Form agent: 21 tổ hợp provider/viewport, dark/light và ba payload lưu qua route mock đạt; không tạo agent thật.
- `node --check` cho script cấu hình host và Studio frontend; `git diff --check` đạt.

## Giới hạn

- Nguồn lịch sử không xác nhận AI đang chạy, phiên đã hoàn thành, CLI đã đăng nhập hay MCP kết nối. Container vẫn chưa điều khiển Claude/Codex Desktop; muốn gửi từ web cần cầu nối host riêng.
- Model/title không có trong metadata prefix thì không suy đoán. Nội dung được tải theo lựa chọn và cursor như trước.
- Không tự chuyển đường dẫn Windows trong log thành đường dẫn repo Linux có thể sửa. Workspace mount chỉ đọc.
- Kiểm tra giao diện dùng Playwright local trong Chromium, không phải MCP Playwright LLM (không có tool tương ứng trong phiên này); chưa kiểm tra Safari/Firefox, khả năng gửi AI thật hay endpoint Zalo thật.

## Xác minh trước khi commit và push

- Theo yêu cầu đưa các thay đổi hiện tại lên Git, chạy lại npm test: 84/84 test đạt trên Windows.
- git diff --check: đạt. Các kiểm tra Docker và giao diện ở trên là kết quả đã ghi nhận trước đó, không chạy lại trong bước commit/push.
