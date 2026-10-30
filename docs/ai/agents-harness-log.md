# AI Agents, Harness, giao việc LLM và Nhật ký

## Yêu cầu
1. Tab cấu hình AI Agents theo IP hoặc local máy.
2. Tab cấu hình harness (các bước workflow); Trace bỏ qua, không hiển thị bước không đi qua.
3. Tab log hiển thị lịch sử với tag success / error / warning.
4. Giao việc cho AI Agent, hỗ trợ LLM local Zalo (OpenAI-compatible); dùng cấu hình Zalo AI LLM để đọc link / snapshot.
5. Claude và LLM local cần VPN: khi lỗi thì fallback sang ChatGPT (agent LLM) và Codex Desktop (task).

## Hành vi
- **AI Agents** (`#agents`): thêm/xoá agent gồm tên, loại và vị trí. Claude/Codex: `local` hoặc `remote` (IP/hostname + port tùy chọn). Lưu trong `data/workspace.json` (`store.agents`).
- **Agent có sẵn**: `GET /api/config` trả thêm `builtinAgents` = Claude Code và Codex (ChatGPT) tìm thấy trên máy (đường dẫn CLI). Trạng thái Claude dựa vào probe Anthropic (cache 60 giây): Sẵn sàng / Mất kết nối (task sẽ fallback sang Codex) / Chưa cài. Hai dòng này hiện đầu bảng, không xoá được; số agent tính cả hai. Đã xem trên web: 3 agent (Claude Code, Codex, Zalo AI LLM), Claude và Codex đều Sẵn sàng.
- **Agent LLM local** (`llm-agent.mjs`): loại `LLM` gồm base URL (`http(s)://IP:port/v1`), model và API key tùy chọn. Key chỉ lưu trong `data/workspace.json`; API trả `hasKey` thay vì key. Vị trí local/remote suy ra từ host. Nút **Kiểm tra** gọi `/v1/models` và xác nhận model tồn tại.
- **Giao việc** (form trong tab AI Agents): chọn agent LLM, loại việc (nháp kế hoạch, test case, tóm tắt, tự nhập), task AB (chỉ task assign cho bạn) và/hoặc yêu cầu thêm. `POST /api/agents/assign` trả 202 ngay, gọi `/v1/chat/completions` ở nền (timeout 5 phút, bỏ khối `<think>`), lưu kết quả thành tài liệu nguồn "LLM agent" trong Tài liệu AI và ghi Nhật ký success/error. Danh sách việc tự làm mới mỗi 5 giây khi có việc đang chạy.
- **Nhập Zalo AI LLM**: nút "Nhập Zalo AI LLM" (`POST /api/agents/import-zalo`) đọc đúng 3 khóa `LITELLM_BASE_URL`, `LITELLM_MODEL`, `LITELLM_AUTH_TOKEN` từ `.env` của playwright-llm (mặc định `<work root>/vng/.env`, đổi bằng `TN_ZALO_ENV`) và tạo/cập nhật agent `zalo-ai-llm` (base URL thêm `/v1`). Gateway LiteLLM của Zalo dùng CA nội bộ: `start.cmd` đặt `NODE_EXTRA_CA_CERTS=C:\cert\za-ecc-root-ca.pem` nếu file tồn tại.
- **Đọc link / Snapshot** (loại việc `link`): server mở MCP `vision-proxy` (định nghĩa lấy từ `~/.claude.json`, nếu không có thì qua `codex mcp get`), gọi `vision_analyze` chế độ `artifact` để mở URL bằng Playwright và lưu ảnh chụp, lấy thêm `browser_snapshot` (cắt 15.000 ký tự). Ảnh (data URI) + snapshot được gửi tới model của agent qua `/v1/chat/completions`. Kết quả kèm đường dẫn ảnh chụp, lưu vào Tài liệu AI. Không dùng chế độ phân tích sẵn của vision-proxy vì khi model lỗi hoặc confidence thấp nó trả `success:false` mà không nêu lý do.
- **Fallback ChatGPT** (việc giao cho agent LLM, cả đọc link): khi gọi model lỗi (mất VPN, lỗi chứng chỉ, HTTP lỗi, không có nội dung), server chạy lại cùng prompt bằng `codex exec` (đăng nhập ChatGPT trên máy) trong thư mục tạm rỗng, sandbox `read-only`, `--ephemeral`; đọc link gửi kèm ảnh chụp qua `--image`. Nhật ký ghi warning kèm lý do, việc hiện tag "ChatGPT fallback", tài liệu ghi rõ nguồn ChatGPT. Lỗi kết nối nêu host + mã lỗi + gợi ý kiểm tra VPN. `discoverCLIs` tìm thêm `codex.exe` mới nhất trong `%LOCALAPPDATA%\OpenAI\Codex\bin\*` khi không có trong PATH.
- **Fallback task Claude → Codex Desktop**: khi bấm Code, server thử `GET https://api.anthropic.com/v1/messages` (5 giây). Có phản hồi HTTP (bình thường 405) là kết nối được; lỗi mạng, hết thời gian hoặc HTTP 403/451 là không có VPN (`claude.ai` không dùng vì Cloudflare luôn trả 403). Khi không kết nối được: không mở bản nháp Claude, task đi theo nhánh Codex Desktop có sẵn (nhận AB Task, `create_thread`), tiêu đề `… · Codex Desktop · fallback Claude`, prompt mở đầu bằng lý do fallback và `workflowInstructions({claudeUnavailable:true})` thêm đoạn "CHẾ ĐỘ FALLBACK": Codex làm cả các bước owner Claude, bỏ bàn giao codex-ui.json, ghi rõ fallback trong handoff/TN_TRACE. Task lưu `claudeFallback {reason, at}`; Trace hiện dòng "Fallback", Nhật ký ghi warning.
- **Harness** (`#harness`): mỗi bước của `WORKFLOW_STEPS` bật/tắt và gán agent Claude/Codex cùng owner. Lưu tại `store.harness.steps`. Bước tắt bị bỏ khỏi prompt (`workflowInstructions`) và AI được yêu cầu báo `TN_TRACE status skipped`; bước có agent ghi `Agent: tên · IP:port | local máy này`. Popup "Xem flow" chỉ liệt kê bước đang bật. Agent LLM không gán vào harness vì các bước chạy bên trong phiên Claude Desktop, website không chen bước riêng được.
- **Trace**: `parseTraceLog` gom các bước AI báo `skipped` (xoá khỏi danh sách nếu sau đó bước đó báo trạng thái khác). Server gộp thêm bước tắt trong harness; `traceChart` lọc các bước này, nhãn công cụ đi theo bước.
- **Nhật ký** (`#logs`): `GET /api/logs` gồm thao tác POST trên website (success/error, lỗi đã che credential), lỗi đồng bộ (error), cảnh báo đọc dữ liệu mới (warning), lịch sử mở task (success/error), bàn giao Codex UI bị chặn (warning), kết quả giao việc LLM. Lọc theo tag; nav hiện số lỗi. Lưu tối đa 500 sự kiện tại `data/activity-log.json`.
- Sửa lỗi: regex ID agent mất dấu `\` khiến mỗi lần lưu agent bị cấp ID mới và gán agent trong harness bị xoá.

## File
server.mjs, tasks.mjs, llm-agent.mjs, mcp-client.mjs, runner.mjs, start.cmd, .gitignore, trace.mjs, public/workflow.js, public/trace-chart.js, public/trace-view.js, public/agents-config.js, public/activity-log.js, public/app.js, public/index.html, public/style.css, test/trace.test.mjs, test/llm-agent.test.mjs, test/workspace.test.mjs.

## Kiểm tra đã chạy
- `npm test`: 80/80 pass, thêm test: Claude không kết nối được → không mở bản nháp Claude, tạo phiên Codex với prompt/tiêu đề fallback, ghi launch event và Trace "Fallback"; Claude kết nối được → giữ luồng bản nháp, không có prompt fallback. Probe thật trên máy (đang có VPN): `api.anthropic.com` trả 405 = kết nối được. Chưa thử khi tắt VPN thật.
- Trước đó: 78/78 pass, thêm test fallback (lỗi kết nối nêu VPN, fallback chạy đúng một lần, lỗi của ChatGPT được báo lại).
- Fallback thật: agent trỏ tới `127.0.0.1:9` (giả lập mất VPN) → `codex exec` trả lời đúng sau khoảng 23 giây.
- Trước đó: 77/77 pass, thêm test nhập `.env` (chỉ đọc khóa gateway) và đọc link với MCP giả + mock server (gửi ảnh, snapshot, đóng MCP, từ chối link không phải http).
- Chạy thật với gateway Zalo (token đọc từ `.env`, không in ra): `/v1/models` trả `Gemma4-26B-A4B`, `Qwen3.6-35B-A3B`; chat trả lời đúng; đọc link `https://example.com` qua vision-proxy + Gemma4 thành công trong khoảng 10 giây.
- Trước đó: 75/75 pass. Test mới: bước skipped/tắt bị ẩn khỏi chart và prompt, agent IP ghi trong prompt; LLM agent với mock server OpenAI-compatible (models, Bearer key, nội dung task, bỏ `<think>`, lỗi HTTP), kiểm tra base URL.
- `node --check` các file client; server khởi động trên port 4398, API trả 401 khi chưa đăng nhập.
- Kiểm tra trên web (đã đăng nhập, port 4317, có CA cert): 3 tab mới hiển thị, không lỗi JS; Nhập Zalo AI LLM tạo agent có API key; Kiểm tra trả 2 model; Đọc link https://example.com chạy xong ~24 giây và lưu Tài liệu AI; Nhật ký ghi success. Sửa thêm: nhãn "1 agent" và bảng cuộn ngang trên màn hình hẹp. Chưa bấm thử luồng fallback trên web (cần tắt VPN).

## Giới hạn
- Endpoint cần hỗ trợ `/v1/chat/completions` không stream; đọc link cần model nhận ảnh (Gemma4 trên gateway Zalo đã thử). Server phải chạy với `NODE_EXTRA_CA_CERTS` (dùng `start.cmd`), nếu không gọi gateway sẽ lỗi chứng chỉ.
- Đọc link dùng phiên trình duyệt của vision-proxy: trang cần đăng nhập phụ thuộc phiên đó; mỗi lần đọc mở MCP mới (khoảng 10 giây). Ảnh chụp lưu tại thư mục artifact của vision-proxy, không tự xoá.
- LLM chỉ nhận/trả văn bản, không đọc repo hay sửa file. Danh sách việc giao nằm trong bộ nhớ, mất khi khởi động lại server; kết quả vẫn còn trong Tài liệu AI.
- Nội dung task được gửi tới endpoint đã cấu hình; chỉ dùng endpoint trong mạng tin cậy.
- Fallback task chỉ kiểm tra lúc bấm Code: nếu Claude mất kết nối giữa chừng, phiên Claude đang chạy không tự chuyển. Phiên "Làm việc với AI" (studio) và bàn giao Codex UI chưa có fallback. Bước kế hoạch/backend do Codex làm vẫn hiện owner Claude trên sơ đồ Trace. Fallback ChatGPT cho agent LLM chậm hơn (~20 giây) và tính vào hạn mức ChatGPT; chưa thử fallback cho đọc link (ảnh) bằng Codex thật. Nếu vision-proxy không chụp được trang thì không fallback.
- `.playwright-mcp/` (output Playwright khi đọc link) được thêm vào `.gitignore`.
- Agent Claude/Codex theo IP chỉ là cấu hình ghi vào prompt; website chưa điều phối phiên tới máy khác.
- Harness áp dụng cho phiên mới. GET, đăng nhập và đồng bộ thành công không ghi log.
