# Source độc lập trong G:\Work

## Yêu cầu và thay đổi

Tách TN Workspace khỏi thư mục đầu ra Codex sang `G:\Work\ai_agents_workspace`. Sao chép source, lịch sử Git, cấu hình đăng nhập và dữ liệu local hiện có, giữ bản cũ để khôi phục. Không đổi thư mục tài liệu AI `G:\Work\docs\AI`.

Lịch quét AB Task hiện tại dùng `node G:/Work/ai_agents_workspace/refresh-tasks.mjs`. Không tạo thêm lịch trùng. `SETUP.md` hướng dẫn chạy source mới bằng `start.cmd` hoặc `node server.mjs`.

## Kiểm tra

- Chạy `node --test` trong source mới: 72/72 test đạt.
- Giữ Git remote `https://github.com/ducthong12/ai_agents_workspace.git`.
- Server chạy từ source mới, lắng nghe `127.0.0.1:4317`; `/login` trả HTTP 200. Các file gốc (trừ tài liệu cài đặt vừa cập nhật) và hash cấu hình đăng nhập khớp bản cũ. Không có lỗi trong log server khi kiểm tra khởi động.

## Giới hạn

Bản dự phòng không tự đồng bộ với source mới. Không chạy hai bản cùng lúc. Không chuyển thông tin đăng nhập Claude/Codex sang máy khác; các ứng dụng vẫn dùng cấu hình của người dùng Windows hiện tại.
