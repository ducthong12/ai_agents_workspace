# Triển khai Orbit AI Workspace

## Yêu cầu và kết quả

Quản lý token Claude Code / Codex, danh sách tài liệu AI tự cập nhật sau khi code; bổ sung thống kê lời mời công việc và nhập yêu cầu thao tác với cả hai AI ngay trên website.

Đã xây website Node.js không dependency, giao diện responsive tiếng Việt với 5 màn hình: Tổng quan, Làm việc với AI, Tài liệu AI, Lời mời công việc, Dự án & kết nối.

## Thành phần chính

- usage.mjs: quét JSONL, trích metadata/usage, gộp streaming Claude, chuyển bộ đếm cộng dồn Codex thành chênh lệch, cache file chưa đổi và loại bản sao lưu trữ.
- server.mjs: máy chủ loopback, kiểm tra origin cho POST, cấu hình dự án, thư viện lưu bền, lập chỉ mục Markdown và Git status journal mỗi 30 giây. Gộp usage theo ngày / phiên / model trước khi gửi trình duyệt để giảm dung lượng.
- runner.mjs: tìm binary Claude/Codex đã cài; spawn trực tiếp không shell, prompt qua stdin, parse sự kiện đầu ra, giới hạn một tác vụ / 15 phút và hỗ trợ dừng cây tiến trình Windows.
- public/: dashboard, bộ lọc, CSV, thư viện tìm kiếm, gửi prompt và xem trạng thái tác vụ.
- invitations.json: ảnh chụp AB Task gồm 10 lời mời và 1 task pending. Ba lời mời không có phụ thuộc; bảy lời mời có phụ thuộc; cộng task pending là tám công việc có phụ thuộc.

## Kiểm tra thực tế

- 5 bài kiểm tra node --test đều đạt: token Codex cộng dồn, streaming Claude, cache và reasoning không cộng trùng, ngày Việt Nam, bản sao archive / JSON dở / cache file thay đổi, lựa chọn quyền và parser đầu ra CLI.
- node --check đạt cho server.mjs, usage.mjs, runner.mjs và public/app.js.
- Đã gửi yêu cầu qua giao diện web, Claude trả ORBIT_CLAUDE_OK và Codex trả ORBIT_CODEX_OK; cả hai trạng thái done. Đây là kiểm tra gọi model thực ở chế độ đọc, không kiểm chứng khả năng sửa một dự án sản phẩm.
- Codex có cảnh báo một MCP cục bộ mqlens không khởi động được và PowerShell chưa hỗ trợ shell snapshot. Tác vụ vẫn hoàn thành. Giữ diagnostics trong UI để người dùng kiểm tra cấu hình CLI của họ.
- Đã kết nối chính thư mục ai-workspace, thêm hướng dẫn tài liệu vào AGENTS.md và CLAUDE.md, xác nhận README / docs được lập chỉ mục.

## Giới hạn có chủ đích

Lời mời chưa có API runtime AB Task; cập nhật bằng connector trong chat rồi thay snapshot. Tác vụ mới chưa nối hội thoại trước. Auto-doc gồm lưu kết quả tác vụ và hướng dẫn AI viết Markdown; không bảo đảm AI luôn giải thích đầy đủ. Git journal chỉ theo dõi danh sách/status file. Số token là số liệu log, không phải hóa đơn hay quota. Website dành cho một máy cá nhân; không mở ra internet.
