import {access,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

const base=path.dirname(fileURLToPath(import.meta.url)),file=path.join(base,'compose.override.yaml');
let existing;try{existing=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('compose.override.yaml đã tồn tại; giữ lại cấu hình riêng trước khi thiết lập nguồn session.');}
if(existing&&!existing['x-tn-host-sessions'])throw Error('Không ghi đè compose.override.yaml của người dùng.');
const home=os.homedir(),codex=process.env.CODEX_HOME||path.join(home,'.codex'),claude=process.env.CLAUDE_CONFIG_DIR||path.join(home,'.claude');
const candidates=[
 [path.join(codex,'sessions'),'/host-ai/codex/sessions'],
 [path.join(codex,'archived_sessions'),'/host-ai/codex/archived_sessions'],
 [path.join(claude,'projects'),'/host-ai/claude/projects'],
 [process.env.TN_CLAUDE_DESKTOP_ROOT||path.join(process.env.LOCALAPPDATA||home,'Claude-Data','claude_pzs8sxrjxfjjc','claude-code-sessions'),'/host-ai/claude-desktop'],
];
const volumes=[];
for(const [source,target] of candidates){try{await access(source);volumes.push({type:'bind',source,target,read_only:true,bind:{create_host_path:false}});}catch(e){if(e.code!=='ENOENT')throw e;}}
if(!volumes.length)throw Error('Không tìm thấy thư mục session AI trên máy này.');
const config={'x-tn-host-sessions':true,services:{web:{environment:{CODEX_HOME:'/host-ai/codex',CLAUDE_CONFIG_DIR:'/host-ai/claude',TN_CLAUDE_DESKTOP_ROOT:'/host-ai/claude-desktop'},volumes}}};
await writeFile(file,JSON.stringify(config,null,2)+'\n');
console.log(`Đã nối ${volumes.length} thư mục lịch sử ở chế độ chỉ đọc. Chạy docker compose up -d --build để áp dụng.`);
