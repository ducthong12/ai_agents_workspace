# Cài TN Workspace trên máy khác

Source: https://github.com/ducthong12/ai_agents_workspace

## 1. Cài và đăng nhập trên từng máy

- Node.js 22 trở lên; bản này được kiểm tra với Node.js 24. Không cần cài thư viện npm.
- Git, Claude Desktop có tab Code, Codex Desktop và Claude Code/Codex CLI.
- Đăng nhập Claude và Codex riêng trên máy đó. Không chép file credential/token từ máy khác.
- Kiểm tra `claude --version`, `codex --version`. Trên Windows, bridge cần đường dẫn executable `.exe`; nếu không tìm thấy qua PATH thì đặt `TN_CLAUDE_BIN` và `TN_CODEX_BIN` bên dưới.
- Cài/bật plugin Codex app tools trên Codex Desktop để có MCP `codex_app`. Các chức năng mở chat Codex và đọc hạn mức cần Desktop đang chạy cùng tài khoản.

```powershell
git clone https://github.com/ducthong12/ai_agents_workspace.git
cd ai_agents_workspace
node configure-login.mjs
```

Lệnh cấu hình hỏi username và mật khẩu trong terminal tương tác, chỉ lưu salt/hash trong `data/auth.json`. Chạy bước này trước lần mở server đầu tiên. Không có mật khẩu tài khoản của máy thứ nhất trong Git.

## 2. Đường dẫn cần đổi trên máy mới

Mở PowerShell trong thư mục vừa clone:

```powershell
$env:TN_WORK_ROOT = 'D:\Work'
$env:TN_AI_DOCS_ROOT = 'D:\Work\docs\AI'
$env:PORT = '4317'
node server.mjs
```

Truy cập http://127.0.0.1:4317 và đăng nhập bằng tài khoản vừa tạo. Server chỉ lắng nghe loopback. Để lưu cấu hình khởi động, đặt các dòng trên trong một script local ngoài Git, hoặc cấu hình biến môi trường người dùng của Windows rồi mở terminal mới. Ứng dụng **không tự đọc `.env`**.

| Biến | Khi nào cần đặt | Mặc định |
|---|---|---|
| `TN_WORK_ROOT` | Nơi chứa các repo local | Workspace đã lưu hoặc `G:\Work` |
| `TN_AI_DOCS_ROOT` | Thư mục gom tài liệu nhãn hàng | `<TN_WORK_ROOT>\docs\AI` |
| `PORT` | Cổng website | `4317` |
| `TN_CODEX_BIN` | Codex executable không có trong PATH | Tìm qua PATH |
| `TN_CLAUDE_BIN` | Claude executable không có trong PATH | Tìm qua PATH |
| `CODEX_HOME` | Profile/log Codex được đặt ở chỗ khác | `%USERPROFILE%\.codex` |
| `CLAUDE_CONFIG_DIR` | Thư mục Claude Code/profile/log khác mặc định | `%USERPROFILE%\.claude` |
| `TN_CLAUDE_DESKTOP_ROOT` | Metadata Code của Claude Desktop ở vị trí khác | `%LOCALAPPDATA%\Claude-Data\claude_pzs8sxrjxfjjc\claude-code-sessions` |

Ví dụ override executable: `$env:TN_CODEX_BIN = 'D:\Tools\codex.exe'`. Dùng đường dẫn cài thực tế của máy, không chép đường dẫn WindowsApps có version/user từ máy thứ nhất.

## 3. Quét repo và tài liệu nhãn hàng

Trong **Làm việc với AI**, mở “Dự án cho session mới”, nhập workspace đúng máy và bấm **Quét repo**. Danh sách repo được lưu riêng trong `data/workspace.json`. Quét tối đa hai cấp, không đi vào node_modules hay các symlink.

Website tự gom Markdown từ README/AGENTS/CLAUDE và các thư mục `docs`, `.claude`, `.planning`, `.stitch` của repo nhãn hàng vào:

```text
<TN_AI_DOCS_ROOT>/
  Castrol/<tên-repo>/docs/...
  GSK/<tên-repo>/docs/...
  NAN/<tên-repo>/docs/...
  ...
```

Nguồn trong repo giữ nguyên. Bản copy chưa sửa được cập nhật khi nguồn đổi; bản copy đã sửa riêng được giữ lại và tính vào số xung đột. `.tn-brand-index.json` lưu dấu vết đồng bộ trên máy. Không xoá bản copy khi một repo biến mất. Mapping nhãn hàng nằm trong `brand-docs.mjs`; dự án hạ tầng/base được để ở nhóm Chung qua các nguồn tài liệu đã kết nối, không gán thương hiệu theo nội dung suy đoán.

Trang Tài liệu có thống kê, bộ lọc nhãn hàng và tải 50 thẻ/lần. Nội dung chỉ tải khi chọn tài liệu. Những nguồn đã nối trên máy thứ nhất cần thêm lại trong **Cài đặt tài liệu** nếu muốn đọc thêm tài liệu dùng chung. Với repo code cần tự ghi chú, chọn thư mục tài liệu và cài local instruction tại đó; không sửa AGENTS.md/CLAUDE.md dùng chung cho đường dẫn cá nhân.

## 4. MCP và AB Task

Cấu hình MCP theo tài khoản/máy trong Claude/Codex, không chép credential vào repo này:

| Kết nối | Dùng cho | Kiểm tra |
|---|---|---|
| `ab_task` | Inbox, nhận việc, lease, cập nhật task | `codex mcp get ab_task --json` |
| `plane` | Assignee và State Plane | `codex mcp get plane --json` |
| `codex_app` | Mở/đọc chat Desktop và hạn mức Codex | `codex mcp get codex_app --json` |
| `figma_context` | Figma cho Codex UI | Kiểm tra trong MCP inventory |
| `playwright_llm` | QC UI/local/staging | Profile và URL của máy này |
| `mqlens` | Backend/QC dữ liệu local | Kết nối DB đúng local/staging |

Tên tool có thể có prefix namespace; bridge chọn theo tên/suffix. Địa chỉ staging, profile trình duyệt và database phải cấu hình theo môi trường thật; không đoán host, không dùng production. Không chia sẻ đầu ra `mcp get` nếu chứa credentials.

Nút **Quét AB Task** chỉ đọc inbox/Plane và giữ task assign cho tài khoản hiện tại. Chạy tay cũng được:

```powershell
node refresh-tasks.mjs
```

Automation hàng giờ không nằm trong Git. Nếu muốn đặt trên máy thứ hai, tạo lịch riêng với đường dẫn checkout mới; chỉ nên có một máy làm đầu mối nhận việc. Script quét không nhận task, không mở chat và không chạy code. Không copy file `tasks.json` đang hoạt động để chạy lại một task trên hai máy.

## 5. Luồng AI, Trace và ngân sách 20%

- Mở mới: Claude Code Desktop lập kế hoạch/backend/QC dữ liệu. Deep link chỉ điền sẵn prompt và thư mục: xác nhận thư mục rồi nhấn gửi trong Claude. Không có cơ chế giả lập auto-send.
- Claude bàn giao UI bằng `codex-ui.json`; website kiểm tra ngân sách rồi mới tạo một chat Codex UI. Codex ghi `ui-result.md`. Không tự đổi AI để né ngưỡng.
- Phiên đã chọn của Codex tiếp tục tại chỗ. Phiên Code AgentWork được tìm bằng ticket trong title và đối chiếu `sessionId`/`cliSessionId`; phiên nhiều ticket được đánh dấu là phiên chung. Chỉ đọc log, không tự gửi tin nhắn hay đổi phase vì thấy title.
- Trace phân biệt lượt đã phản hồi, hoạt động mới, chờ người dùng/công cụ và hơn 5 phút chưa có tiến triển. Log cũ không đủ để kết luận tiến trình bị treo. Thinking, tool payload, query và credential không được đưa vào nội dung Trace.
- Mỗi lần website chuẩn bị bàn giao kiểm tra hạn mức gói AI đích, context phiên đích nếu tiếp tục phiên có sẵn, và context phiên nguồn nếu có. Một tỷ lệ **dưới 20%** sẽ chặn; đúng 20% được phép. Phiên mới chưa có context không được gán số 100% giả.
- Codex: hạn mức được đọc qua Desktop; context từ token_count gần nhất và model context window thực tế trong log, không lấy tổng token tích luỹ.
- Claude Desktop hiện chưa có đường đọc tỷ lệ tự động được xác minh trong bản tích hợp này. Mở Trace → Bảo vệ bàn giao AI → Cập nhật số liệu từ Desktop. Nhập **phần trăm còn lại**, lấy mức thấp nhất giữa hạn mức 5 giờ/tuần và context đúng phiên. Số liệu quá 5 phút hoặc chưa có sẽ tạm dừng. Không coi số liệu thiếu là còn 100%.
- Guard áp dụng cho các lượt do website tạo/gửi; không thể ngăn người dùng tự gửi trong ứng dụng Desktop hoặc dừng công việc đang chạy ngoài website.

Tham khảo chính thức: [Claude Desktop deep links](https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link), [context và rate limits trong status line Claude Code](https://code.claude.com/docs/en/statusline). Không lấy phần trăm context bằng cách đoán giới hạn model.

## 6. Git và hai máy

Sau khi cập nhật source: `git pull --ff-only`, rồi khởi động lại server. Restart làm hết phiên đăng nhập website; không dừng phiên AI trong Desktop.

Không commit/copy `data/`, `.env*`, invitations thật, log phiên, local instruction hoặc credential. `.gitignore` đã loại các mục này. Tài liệu nhãn hàng ở ngoài checkout: nếu muốn cùng nội dung trên hai máy, dùng thư mục đồng bộ/tài liệu riêng của bạn và đặt `TN_AI_DOCS_ROOT` về bản local tương ứng. Source website qua GitHub không tự đồng bộ tài liệu khách hàng hoặc log token hai máy.

## 7. Xử lý nhanh

| Hiện tượng | Cách kiểm tra |
|---|---|
| Thiếu auth.json khi mở server | Chạy `node configure-login.mjs` trong terminal tương tác |
| Không thấy repo/nhãn hàng | Kiểm tra work root, quét repo lại, kiểm tra tên repo có mapping brand |
| Không thấy AgentWork | Kiểm tra `TN_CLAUDE_DESKTOP_ROOT`, profile và title có đúng mã ticket |
| Có title nhưng chưa có log | Kiểm tra CLI session ID và thư mục projects của Claude; không tự coi là Coding |
| Bàn giao bị chặn | Xem tỷ lệ/nguồn/thời điểm trong Trace; cập nhật số liệu còn thiếu, không tạo chat khác để bỏ qua guard |
| MCP không hoạt động | Mở Desktop, đăng nhập đúng profile; kiểm tra MCP trên chính máy này |
| Cổng đã dùng | Đặt `PORT` khác và truy cập đúng cổng đó |

Chạy kiểm tra: `node --test`.

Sau khi đổi workspace qua giao diện, khởi động lại server để các monitor dùng root mới; biến TN_WORK_ROOT được ưu tiên hơn giá trị lưu trong giao diện. Giữ cấu hình executable/path trong script local, không commit thông tin riêng của máy.
