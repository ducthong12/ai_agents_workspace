# TN Workspace — hướng dẫn sử dụng

**Cài trên máy khác:** xem [SETUP.md](SETUP.md) để cấu hình đường dẫn, đăng nhập và MCP theo từng máy.

Website cục bộ: http://127.0.0.1:4317. Ứng dụng chạy local trên Windows; dữ liệu riêng được lưu trên từng máy.

## Đăng nhập và khởi động

Tạo tài khoản local bằng `node configure-login.mjs` trước lần chạy đầu tiên. Mật khẩu được lưu bằng scrypt hash trong data/auth.json; session cookie HttpOnly, SameSite=Strict, hết hạn sau 12 giờ và mất khi restart server. API token, MCP và task đều yêu cầu đăng nhập. Origin ngoài website bị chặn.

Node.js 22+; không cần npm install. Trên máy đã thiết lập, chạy npm start hoặc start.cmd trong thư mục ai-workspace. Trên máy mới hoặc để đổi mật khẩu, dừng server rồi chạy node configure-login.mjs trong terminal tương tác, nhập username/password, sau đó npm start. Source ZIP không chứa data hay credential.

Chạy web bằng Docker Desktop: `docker compose up -d --build`. Xem phần **Chạy bằng Docker Desktop** trong [SETUP.md](SETUP.md) về dữ liệu dùng lại, đường dẫn Linux và giới hạn tích hợp Desktop/MCP.

## Làm việc với AI

- Giao diện session sidebar như Codex: Codex Desktop và các phiên Code của Claude Desktop được đọc từ máy. Chọn phiên để xem và tiếp tục. Chat thường của Claude dùng nút Nhập chat Claude (.json), tối đa 20 MB; chưa tự đồng bộ chat cloud. Chỉ hiển thị text, không nhập tool/thinking/credential metadata hoặc file đính kèm.
- Gửi vào phiên Codex được chọn sẽ tiếp tục đúng phiên đó. Session mới/nguồn Claude mở bản nháp Claude Code Desktop, giữ ngữ cảnh gần đây; người dùng xác nhận thư mục và gửi trong Claude.
- Tải 25 session/lần, tìm kiếm và lọc nguồn trước khi phân trang. Chỉ đọc 20 tin của phiên đang chọn; kéo lên tải tin cũ, kéo cuối sidebar tải thêm session. Chỉ poll nội dung khi trang Studio đang hiển thị; không đọc nội dung tất cả session. Chat log đọc theo đoạn cuối và cursor byte, tối đa 4 MB/đợt; Trace đọc tối đa 512 KB cuối và metadata đầu log.
- Dự án mới là tùy chọn. Quét repo chỉ ở Studio, mặc định G:\Work, tối đa hai tầng; không đọc code hoặc .env để phát hiện repo. Phiên hiện có giữ cwd gốc. Claude lên kế hoạch/backend/dữ liệu; Codex UI/Figma/Playwright LLM, cùng flow AB Task.
- Các tác vụ CLI cũ được giữ trong phần thu gọn; không còn là giao diện soạn yêu cầu chính. Phiên desktop ghi tài liệu feature theo instruction AI-Hub; tài liệu cần review cùng code.

## Cài đặt tài liệu

Không cần thiết lập nguồn để code. Làm việc với AI tiếp tục session; AB Task bấm Code để tự tìm repo. Đây là trang thiết lập nguồn để theo dõi tài liệu repo, khai báo kho AI-Hub và tuỳ chọn cài hướng dẫn local cho AI. Không cần mở trang này trước mỗi lần code. Hiện có 4 nguồn đã kết nối và 45 repo quét trong G:\Work; repo trùng đường dẫn được gộp nên có 47 nguồn riêng biệt. Danh sách tải 20 mục/lần, nối thêm khi cuộn; có tìm kiếm và lọc Đang theo dõi / Chưa theo dõi. Thiết lập theo dõi chỉ điền sẵn form để người dùng xem lại và bấm kết nối; không tự cài instruction toàn bộ repo đã quét. Nút Quét folder cập nhật danh sách repo.

Mũi tên combobox dùng cùng một chevron, căn giữa dọc và cách mép phải 12 px; chừa 36 px cho chữ, giữ màu State theo theme.

## Lời mời AB Task

Chỉ thống kê/hiển thị task có assignee khớp ID tài khoản Plane đã xác minh. Không dùng người giữ lease AB Task để suy ra assignee. Khi Plane lỗi, giữ cache assign đã xác minh, ẩn task chưa xác minh; đổi tài khoản thì không giữ task của tài khoản cũ. Nguồn là task_inbox qua MCP; không quét repo để tìm lời mời. Có lọc ABCORE/ABCOMERCIA, State Plane và trạng thái code. Quét mới không tự nhận việc. Nhãn New xuất hiện cho ID mới và giữ đến khi đánh dấu đã xem, đổi trạng thái hoặc bấm Code; các lời mời đã có lúc thiết lập không được đánh dấu giả là mới.

Không còn cột Repo desktop. Bấm Code hiển thị popup luồng AI. Bấm Bắt đầu mở bản nháp Claude Code Desktop; xác nhận thư mục và gửi trong Claude để triển khai. Claude lập kế hoạch, backend, QC/nhập dữ liệu; Codex code/fix UI từ Figma, kiểm tra qua Playwright LLM. Không còn chọn AI đơn lẻ cho AB Task. Chat tự xác định repo từ ticket trong G:\Work (đổi bằng TN_WORK_ROOT). Không tự submit, merge, deploy hoặc Done. Cần Codex Desktop đang chạy, CLI đăng nhập và các MCP đã cấu hình trên máy. Không mở chat hoặc nhận task thật chỉ để kiểm thử.

Có List và Board; Board nhóm theo Chưa code / Coding / Review / Done hoặc State Plane. List tải 20 task/lần, Board 8 card/nhóm rồi tải thêm khi cuộn. Bộ lọc/thống kê đều chỉ tính task assign cho bạn. State có màu ở combobox và header Board; không cảnh báo riêng ticket không tìm thấy State.

Chỉ State thuộc backlog/unstarted trước In Dev có Code status và nút Code. In Dev/Đang phát triển, Testing, QC, UAT, Released, Cancelled hoặc State chưa xác minh không có hai điều khiển này. Backend cũng chặn thao tác ngoài phạm vi; trước khi nhận việc/mở chat sẽ đọc lại State và assignee hiện tại. Trace/Mở desktop vẫn dùng để theo dõi phiên đã có. Board theo code đưa các task ở giai đoạn sau vào cột Theo dõi trên Plane. Các ô thống kê code chỉ tính task đủ điều kiện này.

Bắt đầu trả HTTP 202 sau khi ghi trạng thái chuẩn bị, rồi chạy mở phiên ở nền. Task hiện từng bước xác minh Plane/đọc đề bài/nhận việc/mở chat cùng thời gian chờ; trang task cập nhật mỗi 3 giây khi có phiên chuẩn bị/Coding. Native Desktop có timeout 60 giây cho mỗi tool call; lỗi dừng trạng thái chuẩn bị và hiển thị rõ, không tự lặp mở chat. Kết quả chưa chắc đã mở phải giữ bảo vệ chống trùng. PID máy chủ giúp bỏ trạng thái chuẩn bị mồ côi sau restart; không xoá bảo vệ khi chưa biết Desktop đã tạo hay chưa. Parser MCP giữ JSON ID ngay cả khi kết quả kèm block text thông tin riêng.

State Plane và trạng thái code là hai trường riêng. Đổi combobox sẽ hiện popup xác nhận trước khi ghi; Huỷ giữ nguyên. Plane được đọc lại để xác nhận sau khi cập nhật. Trạng thái code: Chưa code → Coding → Review → Done. Hoàn thành chat được đưa về Review; Done do bạn xác nhận thủ công và không tự task_submit lên AB Task. Nếu mở chat bị timeout không rõ kết quả, nút Code bị chặn để tránh mở trùng; kiểm tra desktop rồi đổi trạng thái thủ công khi cần khôi phục.

Task New nằm trên cùng, mới nhất trước; khi đánh dấu đã xem sẽ trở về thứ tự theo State. Tiếp theo, task có State In Dev hoặc Đang phát triển được ưu tiên, có badge Chú ý màu cam; các lựa chọn State này cũng đứng đầu combobox. Ready for Dev không được coi là In Dev. Task chưa tìm được State nằm cuối và combobox Plane bị vô hiệu; không bịa State.

Đã tạo lịch Codex quét AB Task mỗi giờ trong chat này. Lịch chạy khi Codex và máy hoạt động; giữ im lặng khi không có thay đổi đáng chú ý. Nút Quét AB Task làm mới ngay. Script refresh-tasks.mjs cập nhật file dữ liệu để website đọc lại sau tối đa 30 giây, kể cả khi không mở trang task. Mỗi lần chạy chỉ đọc inbox/Plane; không tự nhận việc hoặc code.

## Token và MCP

Token lấy từ log Claude Code/Codex tại máy này, gộp trùng phiên, tách input/cache/output, không cộng lặp cache đọc hoặc reasoning của Codex. Không phải phần trăm hạn mức thuê bao hay hoá đơn. Chưa tổng hợp token từ hai máy.

Trang MCP đọc cấu hình user/local/project và dùng CLI kiểm tra. Phân biệt đang bật, chưa kiểm tra, kết nối được, cần xác thực, lỗi và bị tắt. Kết quả có thời điểm và được lưu lại, không đại diện kết nối đang sống trong mọi chat. Tool count là trang đầu tools/list. Không hiển thị token/header/env/args; chỉ hiện host hoặc tên chương trình. Không tự đăng nhập, đổi quyền hay gọi tool nghiệp vụ để kiểm tra.

## Tài liệu và AGENTS.md

Kho chính G:\Work\docs\AI-Hub chứa 529 file nhập ban đầu (375 Markdown), giữ nguyên nguồn và đã đối chiếu hash. reference giữ bản tra cứu, features nhận tài liệu mới. Làm mới reference bằng node G:\Work\docs\AI-Hub\tools\sync-library.mjs; website đọc thay đổi tại hub mỗi 30 giây.

Các instruction tracked trong adtimabox-cshub và 2026-cshub-miniapp-base-v3 đã được khôi phục; không có diff AGENTS.md/CLAUDE.md do thiết lập cá nhân. Dùng AGENTS.override.md và CLAUDE.local.md, được Git bỏ qua qua .git/info/exclude. Override vẫn yêu cầu đọc các quy định chung; Claude local import @AGENTS.md. Không dùng skip-worktree hoặc assume-unchanged. Bản cũ được lưu trong AI-Hub/backups/2026-10-29-local-migration.

## Dùng hai máy

1. Dùng Git remote riêng tư cho code và AI-Hub; chỉ đưa tài liệu cần chia sẻ vào repo hub, bỏ qua backups chứa đường dẫn máy và nội dung nhạy cảm trước khi push. Pull trước khi làm, push khi kết thúc; mỗi máy một branch nếu làm đồng thời. Không sửa cùng file ở hai máy trên cùng branch.
2. Clone repo/hub trên máy thứ hai. Đăng nhập Claude/Codex và cấu hình MCP riêng trên mỗi máy; không đồng bộ toàn bộ .codex/.claude, session cookie, token/API key hoặc log hội thoại qua Git/OneDrive.
3. Dùng setup-ai-local.mjs để tái tạo thiết lập cá nhân theo đường dẫn thật trên máy đó, ví dụ:

~~~powershell
node setup-ai-local.mjs --hub "D:\Work\docs\AI-Hub" --repo "D:\Work\adtimabox-cshub" --repo "D:\Work\2026-cshub-miniapp-base-v3"
~~~

4. Chạy dashboard trên từng máy để xem số liệu cục bộ. Mới có bộ cài instruction portable, chưa triển khai server trung tâm/collector hai máy. Lịch quét đã tạo thuộc máy/chat hiện tại, không tự sao chép sang máy thứ hai.

## Kiểm chứng và giới hạn

61 kiểm tra tự động đạt, gồm parser/pagination session, nối phiên chống trùng, Claude handoff/import, tracing/redaction, assignment khi Plane lỗi, Board/màu State và các kiểm tra cũ: bộ đếm token, CLI arguments, MCP handshake/redaction, auth/session/throttling, local instruction, phát hiện repo, New, đổi State, mở chat chống trùng và In Dev priority. Đã kiểm tra HTTP thật: API riêng tư trả 401 trước đăng nhập, trang chính chuyển về login, Origin ngoài bị 403. Đăng nhập admin thành công trên trình duyệt; popup Huỷ không lưu State và không đổi trạng thái code.

Trong lúc Plane 502, dữ liệu assign đã xác minh được giữ lại. Lịch quét sau đó đã đọc lại Plane thành công, cache hiện có 10 task assign cho tài khoản hiện tại. Đã kiểm tra UI session thật, tải dần, popup huỷ, Board/code-State, Trace và HTTP thật chặn Code/Code status cho In Dev. Chưa tạo thêm chat hoặc nhận ticket sản phẩm để QC; luồng Desktop chậm/lỗi, chống trùng và phục hồi sau restart kiểm tra bằng mock. Chat thường chưa có bản xuất thật để kiểm tra nhập trên UI.

Logo TN và prompt thiết kế: xem tn-logo.png và tn-logo-design.md trong thư mục outputs. Màu chủ đạo xanh lime trên nền than, có dark/light theme.

Giao diện đã gỡ headline quảng bá và dòng giới thiệu lặp lại. Tên trang hiển thị nhỏ trên thanh trên cùng; hướng dẫn dài của AB Task được thu gọn trong Cách hoạt động, giữ chỗ cho bảng dữ liệu và các nút thao tác.

Trang đăng nhập đã bỏ headline, eyebrow và dòng giới thiệu; giữ logo, form và nhãn cục bộ. Đã bỏ phần tử grid rỗng khiến cả khung nằm thấp; đo tại 1913×919: tâm khung 459,5 px, đúng tâm màn hình.

## Tracing task/session

Task Coding hoặc đã liên kết desktop có nút Trace; session Code trong Studio cũng có nút Trace. Khi mở, đọc log local và cập nhật mỗi 5 giây; đóng popup dừng poll. Hiển thị bước flow, AI phụ trách, thư mục, branch ghi nhận, file/tool gần nhất, thời điểm hoạt động và tóm tắt. Phiên mới được hướng dẫn báo mốc TN_TRACE trước/sau bàn giao; completed chỉ chứa bước có evidence. Phiên cũ thiếu mốc chỉ hiển thị dấu vết quan sát được, không đoán bước hay phần trăm. Không có session liên kết thì nói rõ. Không hiển thị command, code thô, query, reasoning hay credential từ tool log. Branch đọc từ metadata hoặc mốc AI báo cáo; không tự chạy Git trong repo. File gần nhất có thể là file vừa đọc hoặc sửa.

## Phân vai AB Task cập nhật

Phân vai AB Task bắt buộc (claude-desktop-lead-v2):
1. Claude: Kế hoạch chi tiết. Phạm vi, repo, API contract, dữ liệu và tiêu chí nghiệm thu.
2. Claude: Code backend. API, nghiệp vụ, migration và kiểm thử backend trên local.
3. Codex: Code & sửa UI. Đọc Figma; triển khai UI và kiểm tra bằng Playwright LLM.
4. Claude: QC & nhập dữ liệu. Local / staging qua MQLens local và Playwright LLM trên cshub-stg.
5. Codex: Kiểm thử UI tích hợp. Playwright LLM: luồng người dùng, responsive và dữ liệu thực tế.
6. Bạn: Review → Done. Xem diff, kết quả test và tài liệu; xác nhận hoàn tất.

Claude Code Desktop là đầu mối lập kế hoạch, backend và QC dữ liệu. Codex Desktop nhận phần UI/Figma/Playwright LLM qua file bàn giao. Giữ phiên Codex ABCORE-281 hiện có; các lần mở mới dùng Claude.

Bắt đầu mở bản nháp tab Code trong Claude Desktop. Cần xác nhận thư mục và gửi trong ứng dụng; website hiển thị Chờ gửi trong Claude đến khi thấy mã TN_LAUNCH trong log phiên thật. Không tự nhận task chỉ vì mở bản nháp, không tự chuyển sang CLI/Codex. Claude kiểm tra lease và nhận task trước triển khai.

Codex sở hữu toàn bộ code UI, cập nhật UI và fix UI. Đọc dữ liệu Figma bằng figma_context/get_figma_data theo fileKey và nodeId từ ticket/tài liệu; lấy asset khi cần. Nếu không có link hoặc không đọc được Figma, nêu rõ, không bịa thiết kế hoặc node. Dùng playwright-llm/browser_task để kiểm tra UI và lưu evidence, console/network errors, responsive và kết quả theo acceptance criteria. Đây là trình duyệt Playwright LLM đã cấu hình, không tự thay bằng công cụ khác mà không báo.

Claude sở hữu backend, QC dữ liệu và nhập dữ liệu nếu ticket có yêu cầu. Chỉ thao tác dữ liệu trên local và staging. MQLens là MCP local đã cấu hình (mqlens); kiểm tra metadata/connection và đúng database trước khi query. Playwright LLM dùng đích cshub-stg cho staging: lấy URL/profile thực từ cấu hình hoặc tài liệu repo, không đoán hostname và không truy cập production. Kiểm tra môi trường trước mỗi lần ghi; chạy kiểm tra/preview trước, chỉ ghi trong phạm vi dữ liệu của ticket, đối chiếu số lượng và nội dung sau khi ghi, ghi evidence đã che dữ liệu nhạy cảm. Không bypass approval của tool hoặc thực hiện thao tác phá huỷ ngoài yêu cầu. Không đọc .env, không đưa credential hay dữ liệu cá nhân vào plan/tài liệu. Nếu môi trường hoặc dữ liệu đích chưa rõ, dừng bước ghi và hỏi lại.

Sau QC của Claude, Codex chạy lại các luồng UI bị ảnh hưởng với backend/dữ liệu đã bàn giao. Cập nhật milestone AB Task theo bước thực tế bằng task_update và tài liệu handoff.md / evidence.md. Chỉ đưa về Review khi các bước áp dụng đã đủ evidence; lỗi hoặc thiếu quyền phải ghi rõ, không báo hoàn thành giả. Không tự task_submit, Done, merge hoặc deploy; người dùng review và xác nhận.

Tracing bắt buộc: trước/sau mỗi bước và khi đổi file hoặc bị chặn, gửi một dòng commentary theo định dạng TN_TRACE: {"stage":"plan","status":"running","repo":"đường dẫn repo thực","branch":"branch thực","file":"file đang xử lý","summary":"mô tả ngắn việc thực tế","completed":[]}. stage chỉ dùng plan/backend/ui/data-qc/ui-qc/review; status dùng running/blocked/review/done/skipped. Completed chỉ liệt kê bước đã làm xong có evidence; không suy đoán tiến độ. Claude báo mốc trước/sau khi bàn giao Codex UI và ghi repo/file thực tế. Không đưa code, command thô, query dữ liệu, credential hay dữ liệu cá nhân vào tracing. Không ghi đường dẫn/branch giả nếu chưa xác định.

Popup Code là flow dự kiến; Trace là dấu vết local/mốc AI báo cáo. Huỷ popup không nhận task. MQLens local chưa bắt tay được ở lần kiểm tra trước; QC/nhập dữ liệu cần xác minh kết nối trước khi ghi.

## Tham khảo nguồn session

- [Claude Desktop](https://code.claude.com/docs/en/desktop)
- [Xuất chat Claude](https://support.claude.com/en/articles/9450526-export-your-claude-data)

### Trace khi mở Desktop lỗi

Nếu không có ID phiên, Trace hiển thị trạng thái khởi động, thời điểm nhận AB Task, State Plane, lỗi và lịch sử bước đã ghi nhận; ẩn flow/code metadata chưa tồn tại. Không coi In Dev là bằng chứng AI đang chạy. Lần mở cũ như ABCORE-281 chỉ có dữ liệu nhận việc và lỗi, không bịa thời điểm lỗi hoặc gán phiên đã lưu trữ. Lần chạy mới lưu tối đa 30 mốc khởi động thật, đánh dấu bước thành công/thất bại và tên thư mục mở Desktop để điều tra. Không mở lại chat hoặc nhận thêm việc khi xem Trace.

### Retry mở Desktop

Nút Retry có ở dòng task và trong Trace khi lần mở trước lỗi, chưa có phiên liên kết và chưa Coding/Review/Done. Popup yêu cầu người dùng kiểm tra Desktop trước khi xác nhận. Backend xác minh assignee và State, dò tối đa 50 phiên gần đây; dùng lại phiên khớp thư mục lần mở trước hoặc đúng task/mốc thời gian. Lỗi kiểm tra phiên thì dừng, không tạo mới. Nếu không tìm thấy, mở một phiên mới và giữ bảo vệ chống trùng trong lúc chạy; không nhận trùng khi còn giữ task; nếu lease đã hết và task về open thì nhận lại cùng task trước khi mở phiên. Retry cho phép khôi phục lần mở lỗi đã nhận task ở In Dev/Đang phát triển; không mở lại task đã sang Testing/UAT/Released. Nút Code và Code status thông thường vẫn chỉ ở State trước In Dev. Đã QC Retry bằng mock và popup Huỷ trên UI; chưa thực thi Retry ticket thật.


### Claude Desktop và canvas Trace

Mở mới dùng deep link chính thức claude://code/new (chỉ điền sẵn prompt/thư mục, không tự gửi). Website chỉ liên kết khi có mã launch trong log text của phiên thật. Sau kế hoạch/backend, Claude ghi codex-ui.json; website tạo một chat Codex UI, chống trùng qua poll/restart. Codex ghi ui-result.md để Claude đọc tiếp. Áp dụng cả AB Task và Studio. Dispatch chưa xác nhận thì dừng tự retry để tránh tạo trùng.

Trace dùng canvas nền chấm, node/icon theo owner, cổng và nhánh công cụ theo flow. Mũi tên chuyển động ở bước đang chạy/chờ; hoàn tất xanh, blocked cam, chưa ghi nhận xám. Tiến độ lấy từ log thực tế; không suy đoán phần trăm. Hỗ trợ reduced-motion và cuộn ngang trên màn hình nhỏ. 61 test tự động đạt; chưa gửi task mới thật để tránh chạy trùng.


## AgentWork, ngân sách và tài liệu nhãn hàng

Trace tự nhận diện AgentWork theo ticket và session ID; phân biệt đã phản hồi, hoạt động mới, chờ công cụ và lâu chưa có tiến triển. Các lần bàn giao do website thực hiện bị chặn nếu hạn mức/context còn dưới 20% hoặc thiếu số liệu mới. Claude Desktop hiện cần cập nhật tỷ lệ tại Trace; Codex lấy quota từ Desktop và context từ log. Giữ nguyên phiên đang chạy ngoài website.

Tài liệu nhãn hàng được gom vào TN_AI_DOCS_ROOT (mặc định G:\Work\docs\AI), có bộ lọc/thống kê và tải nội dung theo lựa chọn. Xem [chi tiết thay đổi](docs/ai/control-center.md) và [hướng dẫn hai máy](SETUP.md).
