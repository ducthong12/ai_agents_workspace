# Cơ sở thiết kế và nguồn tham khảo

Nghiên cứu ngày 29/10/2026.

## Lựa chọn kiến trúc

Node.js HTTP server và giao diện HTML/CSS/JavaScript, không có dependency bổ sung. Máy chủ cục bộ cần thiết vì trình duyệt trên hosting không thể tự đọc thư mục log hoặc chạy CLI trên Windows. Dùng subscription/đăng nhập CLI hiện có thay vì tự phát sinh tích hợp API trả phí mới.

## Nguồn chính thức

- Claude Code monitoring: https://code.claude.com/docs/en/monitoring-usage — hỗ trợ OpenTelemetry, thích hợp khi mở rộng lên dashboard tập trung cho đội nhóm. Bản này đọc log sẵn có để không yêu cầu bật collector.
- Claude Code CLI reference: https://code.claude.com/docs/en/cli-reference — chế độ print, stream-json, permission-mode. Bản cài trên máy cũng đã được kiểm tra qua claude --help.
- Claude Code hooks: https://code.claude.com/docs/en/hooks — có thể bổ sung hook kiểm tra tài liệu về sau. Bản hiện tại dùng hướng dẫn dự án và đồng bộ Markdown, không cài hook shell toàn máy.
- OpenAI Codex non-interactive: https://learn.chatgpt.com/docs/non-interactive-mode — chạy tác vụ bằng codex exec, có đầu ra JSON. Cờ chính xác được đối chiếu codex exec --help của binary đã cài.
- OpenAI Codex Prompting Guide: https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide — cách AGENTS.md được nạp theo thư mục.

## Kiểm chứng log trên máy

Đã kiểm tra cấu trúc trường metadata và usage trong mẫu log cục bộ của hai công cụ, không trích nội dung hội thoại. Codex có event_msg/token_count với total_token_usage và last_token_usage. Claude có message.usage và bản ghi lặp của cùng phản hồi. Đây là quan sát định dạng log nội bộ, không phải cam kết API ổn định từ nhà cung cấp.

Không áp giá USD cố định vì subscription không tương đương hóa đơn token theo API; model và giá có thể thay đổi. Không xem số token cache như số token mới được sinh.
