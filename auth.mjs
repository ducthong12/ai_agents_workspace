import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {scrypt as scryptCallback,randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import path from 'node:path';
const scrypt=promisify(scryptCallback),ttl=12*60*60*1000;
export async function setPassword(directory,username,password){
  if(!username||typeof password!=='string'||password.length<8)throw Error('Tên đăng nhập hoặc mật khẩu không hợp lệ');
  const salt=randomBytes(24).toString('hex'),hash=(await scrypt(password,salt,64)).toString('hex');
  await mkdir(directory,{recursive:true});await writeFile(path.join(directory,'auth.json'),JSON.stringify({username,salt,hash})+'\n',{mode:0o600});
}
export async function createAuth(directory){
  const credentials=JSON.parse(await readFile(path.join(directory,'auth.json'),'utf8')),sessions=new Map(),attempts=new Map();
  const tokenFrom=req=>String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('tn_session='))?.slice(11)||'';
  const digest=s=>createHash('sha256').update(s).digest('hex');
  function authenticated(req){const key=digest(tokenFrom(req)),expires=sessions.get(key);if(!expires)return false;if(expires<Date.now()){sessions.delete(key);return false;}return true;}
  async function login(req,username,password){
    const ip=req.socket?.remoteAddress||'local',now=Date.now();let rate=attempts.get(ip);if(!rate||rate.until<now)rate={count:0,until:now+15*60*1000};
    if(rate.count>=5)return {status:429,error:'Đã thử quá nhiều lần. Hãy thử lại sau 15 phút.'};
    if(typeof username!=='string'||typeof password!=='string'||password.length>1000)return {status:400,error:'Thông tin đăng nhập không hợp lệ'};
    const candidate=await scrypt(password,credentials.salt,64),expected=Buffer.from(credentials.hash,'hex');
    if(username!==credentials.username||candidate.length!==expected.length||!timingSafeEqual(candidate,expected)){rate.count++;attempts.set(ip,rate);return {status:401,error:'Tên đăng nhập hoặc mật khẩu không đúng'};}
    attempts.delete(ip);for(const [key,expires] of sessions)if(expires<now)sessions.delete(key);
    const token=randomBytes(32).toString('base64url');sessions.set(digest(token),now+ttl);
    return {status:200,cookie:`tn_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ttl/1000}`};
  }
  function logout(req){sessions.delete(digest(tokenFrom(req)));return 'tn_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0';}
  return {authenticated,login,logout,username:credentials.username};
}
