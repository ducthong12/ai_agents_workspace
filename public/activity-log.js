const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>s?new Date(s).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'Chưa ghi nhận thời điểm';
export function initActivityLog(){
 let logs=[],level='';
 function render(){for(const k of ['success','error','warning'])$('log-'+k).textContent=logs.filter(l=>l.level===k).length;$('log-all').textContent=logs.length;$('log-nav-count').textContent=logs.filter(l=>l.level==='error').length||'—';document.querySelectorAll('[data-log-level]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.logLevel===level));const rows=logs.filter(l=>!level||l.level===level);$('log-list').innerHTML=rows.length?rows.map(l=>'<tr><td>'+esc(date(l.at))+'</td><td><span class="tag '+esc(l.level)+'">'+esc(l.level)+'</span></td><td>'+esc(l.source)+'</td><td>'+esc(l.message)+'</td></tr>').join(''):'<tr><td colspan="4" class="muted">Chưa có sự kiện.</td></tr>';}
 async function load(){try{const r=await fetch('/api/logs');if(r.ok){logs=(await r.json()).logs;render();}}catch{}}
 document.querySelectorAll('[data-log-level]').forEach(b=>b.onclick=()=>{level=b.dataset.logLevel;render();});$('log-refresh').onclick=load;
 return {load};
}
