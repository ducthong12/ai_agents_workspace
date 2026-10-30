export const WORKFLOW_ID='claude-desktop-lead-v2';
export const WORKFLOW_STEPS=[
  {id:'plan',owner:'Claude',title:'Kế hoạch chi tiết',detail:'Phạm vi, repo, API contract, dữ liệu và tiêu chí nghiệm thu.'},
  {id:'backend',owner:'Claude',title:'Code backend',detail:'API, nghiệp vụ, migration và kiểm thử backend trên local.'},
  {id:'ui',owner:'Codex',title:'Code & sửa UI',detail:'Đọc Figma; triển khai UI và kiểm tra bằng Playwright LLM.'},
  {id:'data-qc',owner:'Claude',title:'QC & nhập dữ liệu',detail:'Local / staging qua MQLens local và Playwright LLM trên cshub-stg.'},
  {id:'ui-qc',owner:'Codex',title:'Kiểm thử UI tích hợp',detail:'Playwright LLM: luồng người dùng, responsive và dữ liệu thực tế.'},
  {id:'review',owner:'Bạn',title:'Review → Done',detail:'Xem diff, kết quả test và tài liệu; xác nhận hoàn tất.'}
];
// Harness config (server: data/workspace.json, browser: /api/config). Module-level so every prompt builder sees the same setup.
let harness={steps:{},agents:[]};
export function configureHarness(h){harness={steps:h?.steps||{},agents:h?.agents||[]};}
export const activeSteps=()=>WORKFLOW_STEPS.filter(s=>harness.steps[s.id]?.enabled!==false);
export const disabledStepIds=()=>WORKFLOW_STEPS.filter(s=>harness.steps[s.id]?.enabled===false).map(s=>s.id);
export const agentLabel=a=>a.name+' · '+(a.location==='remote'?a.host+(a.port?':'+a.port:''):'local máy này');
const stepAgent=id=>harness.agents.find(a=>a.id===harness.steps[id]?.agentId);
export function workflowInstructions({abTask=true,claudeUnavailable=false}={}){const off=WORKFLOW_STEPS.filter(s=>disabledStepIds().includes(s.id));return `${abTask?'Phân vai AB Task bắt buộc':'Luồng phối hợp Claude và Codex'} (${WORKFLOW_ID}):
${activeSteps().map((s,i)=>`${i+1}. ${s.owner}: ${s.title}. ${s.detail}${stepAgent(s.id)?` Agent: ${agentLabel(stepAgent(s.id))}.`:''}`).join('\n')}
${claudeUnavailable?'CHẾ ĐỘ FALLBACK (website quyết định vì Claude không kết nối được): Codex Desktop là đầu mối và tự làm cả các bước ghi owner Claude (kế hoạch, backend, QC & nhập dữ liệu) theo đúng quy tắc của từng bước. Bỏ qua phần bàn giao qua codex-ui.json/ui-result.md. Ghi rõ "fallback từ Claude" trong handoff.md và summary TN_TRACE. Không tự mở lại Claude hay gọi AI khác.\n':''}${off.length?`Harness đã tắt: ${off.map(s=>s.id+' ('+s.title+')').join(', ')}. Không thực hiện các bước này; báo TN_TRACE status skipped một lần.\n`:''}
Claude Code Desktop là đầu mối mặc định. Claude tự lập kế hoạch chi tiết, lưu plan.md trong thư mục feature tài liệu đã cấu hình của dự án trước khi triển khai. Thư mục tài liệu nhãn hàng được chỉ rõ trong file yêu cầu của phiên. Kế hoạch phải có acceptance criteria, danh sách file theo owner, API contract, test và mục dữ liệu cần QC/nhập. Thực hiện lần lượt các bước có liên quan; task chỉ UI hoặc chỉ backend thì ghi rõ bước không áp dụng và lý do, không tự tạo thêm việc. Không chạy hai AI sửa cùng file đồng thời. Mỗi lần bàn giao ghi file đã đổi, contract, kiểm tra đã chạy, việc còn lại và vấn đề chặn.

Claude làm việc trực tiếp trong tab Code của Claude Desktop, giữ cơ chế quyền đang cấu hình trong ứng dụng. Không tự chuyển đầu mối sang Claude Code CLI hoặc Codex Desktop. Claude bàn giao UI qua file codex-ui.json theo đường dẫn trong yêu cầu; website tạo phiên Codex UI riêng, Codex ghi kết quả vào ui-result.md để Claude tiếp tục QC. Trước mỗi bàn giao, website kiểm tra hạn mức gói và context theo phiên; dưới 20% hoặc thiếu số liệu mới thì báo blocked, không tự tạo phiên thay thế hay gọi AI ngoài luồng để né kiểm tra. Giữ tài liệu/kết quả hiện có để tiếp tục khi đủ ngân sách. Thiếu MQLens, Playwright LLM hoặc quyền thì báo blocked; không bypass permissions.

Codex sở hữu toàn bộ code UI, cập nhật UI và fix UI. Đọc dữ liệu Figma bằng figma_context/get_figma_data theo fileKey và nodeId từ ticket/tài liệu; lấy asset khi cần. Nếu không có link hoặc không đọc được Figma, nêu rõ, không bịa thiết kế hoặc node. Dùng playwright-llm/browser_task để kiểm tra UI và lưu evidence, console/network errors, responsive và kết quả theo acceptance criteria. Đây là trình duyệt Playwright LLM đã cấu hình, không tự thay bằng công cụ khác mà không báo.

Claude sở hữu backend, QC dữ liệu và nhập dữ liệu nếu ticket có yêu cầu. Chỉ thao tác dữ liệu trên local và staging. MQLens là MCP local đã cấu hình (mqlens); kiểm tra metadata/connection và đúng database trước khi query. Playwright LLM dùng đích cshub-stg cho staging: lấy URL/profile thực từ cấu hình hoặc tài liệu repo, không đoán hostname và không truy cập production. Kiểm tra môi trường trước mỗi lần ghi; chạy kiểm tra/preview trước, chỉ ghi trong phạm vi dữ liệu của ticket, đối chiếu số lượng và nội dung sau khi ghi, ghi evidence đã che dữ liệu nhạy cảm. Không bypass approval của tool hoặc thực hiện thao tác phá huỷ ngoài yêu cầu. Không đọc .env, không đưa credential hay dữ liệu cá nhân vào plan/tài liệu. Nếu môi trường hoặc dữ liệu đích chưa rõ, dừng bước ghi và hỏi lại.

Sau QC của Claude, Codex chạy lại các luồng UI bị ảnh hưởng với backend/dữ liệu đã bàn giao. ${abTask?'Cập nhật milestone AB Task theo bước thực tế bằng task_update và tài liệu handoff.md / evidence.md.':'Cập nhật tiến độ theo bước thực tế trong tài liệu handoff.md / evidence.md. Không nhận hoặc cập nhật AB Task nếu người dùng chưa giao task cụ thể.'} Chỉ đưa về Review khi các bước áp dụng đã đủ evidence; lỗi hoặc thiếu quyền phải ghi rõ, không báo hoàn thành giả. Không tự task_submit, Done, merge hoặc deploy; người dùng review và xác nhận.

Tracing bắt buộc: trước/sau mỗi bước và khi đổi file hoặc bị chặn, gửi một dòng commentary theo định dạng TN_TRACE: {"stage":"plan","status":"running","repo":"đường dẫn repo thực","branch":"branch thực","file":"file đang xử lý","summary":"mô tả ngắn việc thực tế","completed":[]}. stage chỉ dùng plan/backend/ui/data-qc/ui-qc/review; status dùng running/blocked/review/done/skipped. Completed chỉ liệt kê bước đã làm xong có evidence; không suy đoán tiến độ. Claude báo mốc trước/sau khi bàn giao Codex và ghi repo/file thực tế. Không đưa code, command thô, query dữ liệu, credential hay dữ liệu cá nhân vào tracing. Không ghi đường dẫn/branch giả nếu chưa xác định.`;}

// Handoff budget checks are enforced by the website before creating a destination session.
