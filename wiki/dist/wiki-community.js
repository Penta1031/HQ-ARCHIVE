const COMMUNITY_API=location.hostname.endsWith('.vercel.app')?'':'https://hq-index.vercel.app';
async function communityRequest(path,options={}){
 // Stable cache key: visits share a ranking snapshot. A KST date boundary
 // selects a fresh cache entry so the seven-day window never includes day eight.
 if(path==='popular'&&(!options.method||options.method==='GET'))path+='?v=4&day='+new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 const response=await fetch(COMMUNITY_API+'/api/'+path,{...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'잠시 후 다시 시도해 주세요.');return data;
}
function guestbookDate(value){return new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});}
function guestbookItem(item){
 const locked=item.isPrivate?`<div class="guestbook-private"><p class="guestbook-lock">🔒 비밀글입니다.</p><form data-unlock="${e(item.id)}"><label>글 비밀번호<input type="password" name="password" required minlength="6" maxlength="100" autocomplete="off" placeholder="작성 시 설정한 비밀번호"></label><button type="submit">내용 보기</button><p role="status" aria-live="polite"></p></form></div>`:`<p class="guestbook-text">${e(item.text)}</p>`;
 return `<li class="guestbook-entry" data-entry="${e(item.id)}"><div class="guestbook-entry-heading"><strong>${e(item.name)}</strong><details class="guestbook-delete"><summary>삭제</summary><form data-delete="${e(item.id)}"><label>삭제 비밀번호<input type="password" name="password" required minlength="6" maxlength="100" autocomplete="off"></label><button type="submit">삭제하기</button><p role="status"></p></form></details></div>${locked}<time datetime="${e(item.createdAt)}">${e(guestbookDate(item.createdAt))}</time></li>`;
}
async function guestbookPage(params=new URLSearchParams()){
 const generation=state.generation;
 const from=params.get('page')||'',title=params.get('title')||'';
 const draft=from.startsWith('#/')?`문서: ${title}\n주소: https://hq-index.vercel.app/${from}\n\n`:'';
 content.innerHTML=pageHeader('문의','WIKI')+`<article class="wiki-article guestbook-article"><form id="guestbookForm" class="guestbook-form"><div class="guestbook-fields"><label>이름<input name="name" maxlength="30" placeholder="익명" autocomplete="nickname"></label><label>글 비밀번호<input name="password" type="password" required minlength="6" maxlength="100" placeholder="6자 이상" autocomplete="new-password"></label></div><label for="guestbookText" class="sr-only">문의 내용</label><textarea id="guestbookText" name="text" required maxlength="3000" rows="5" placeholder="문의사항을 남겨 주세요.">${e(draft)}</textarea><label class="guestbook-trap" aria-hidden="true">웹사이트<input name="website" tabindex="-1" autocomplete="off"></label><label class="guestbook-privacy"><input type="checkbox" name="isPrivate">비밀글로 작성</label><p class="guestbook-privacy-note" id="guestbookPrivacyNote">공개글로 등록됩니다. 비밀번호는 글을 삭제할 때 필요해요.</p><div class="guestbook-submit"><button type="submit">등록</button></div><p id="guestbookStatus" role="status" aria-live="polite"></p></form><section class="guestbook-posts" aria-label="문의 목록"><ul id="guestbookList" class="guestbook-list"></ul><p id="guestbookListStatus" role="status">불러오는 중…</p><button id="guestbookMore" class="more-button" hidden>더 보기</button></section></article>`;
 document.title='문의 - 혚쾌위키';active('guestbook');
 const form=document.querySelector('#guestbookForm'),list=document.querySelector('#guestbookList'),listStatus=document.querySelector('#guestbookListStatus'),more=document.querySelector('#guestbookMore');let cursor=null;
 async function load(append=false){
  more.disabled=true;listStatus.textContent='불러오는 중…';
  try{const result=await communityRequest('guestbook'+(append&&cursor?'?cursor='+encodeURIComponent(cursor):''));if(generation!==state.generation)return;
   if(!append)list.innerHTML='';list.insertAdjacentHTML('beforeend',result.items.map(guestbookItem).join(''));cursor=result.cursor;more.hidden=!cursor;listStatus.textContent=list.children.length?'':'아직 남겨진 문의가 없습니다.';
  }catch(error){if(generation!==state.generation)return;listStatus.textContent=error.message;more.hidden=false;more.textContent='다시 불러오기';}finally{more.disabled=false;}
 }
 const privacy=form.elements.isPrivate,privacyNote=document.querySelector('#guestbookPrivacyNote');
 const updatePrivacy=()=>{privacyNote.textContent=privacy.checked?'비밀글은 작성 시 설정한 비밀번호로 내용을 열람하고 삭제할 수 있어요.':'공개글로 등록됩니다. 비밀번호는 글을 삭제할 때 필요해요.';};
 privacy.onchange=updatePrivacy;
 more.onclick=()=>load(Boolean(cursor));
 form.onsubmit=async event=>{
  event.preventDefault();const button=form.querySelector('button[type="submit"]'),status=document.querySelector('#guestbookStatus');button.disabled=true;status.textContent='등록 중…';
  const fields=new FormData(form);const data={...Object.fromEntries(['name','password','text','website'].map(key=>[key,fields.get(key)])),isPrivate:fields.get('isPrivate')==='on'};
  try{await communityRequest('guestbook',{method:'POST',body:JSON.stringify(data)});if(generation!==state.generation)return;form.reset();updatePrivacy();status.textContent=data.isPrivate?'비밀글로 등록했어요.':'등록했어요.';await load();}catch(error){if(generation===state.generation)status.textContent=error.message;}finally{button.disabled=false;}
 };
 list.onsubmit=async event=>{
  const unlock=event.target.closest('[data-unlock]');
  if(unlock){
   event.preventDefault();const button=unlock.querySelector('button'),status=unlock.querySelector('[role="status"]');button.disabled=true;status.textContent='확인 중…';
   try{
    const result=await communityRequest('guestbook',{method:'POST',body:JSON.stringify({action:'read',id:unlock.dataset.unlock,password:new FormData(unlock).get('password')})});
    if(generation!==state.generation)return;
    const box=unlock.closest('.guestbook-private');box.innerHTML='<p class="guestbook-lock">🔓 비밀글</p><p class="guestbook-text"></p><button class="guestbook-relock" type="button">다시 잠그기</button>';
    box.querySelector('.guestbook-text').textContent=result.item.text;
    box.querySelector('.guestbook-relock').onclick=()=>{const entry=box.closest('.guestbook-entry');entry.outerHTML=guestbookItem({...result.item,text:'',isPrivate:true});};
   }catch(error){if(generation===state.generation){unlock.reset();status.textContent=error.message;}}finally{button.disabled=false;}
   return;
  }
  const deletion=event.target.closest('[data-delete]');if(!deletion)return;event.preventDefault();const button=deletion.querySelector('button'),status=deletion.querySelector('[role="status"]');button.disabled=true;status.textContent='확인 중…';
  try{await communityRequest('guestbook',{method:'DELETE',body:JSON.stringify({id:deletion.dataset.delete,password:new FormData(deletion).get('password')})});if(generation!==state.generation)return;deletion.closest('.guestbook-entry').remove();document.querySelector('#guestbookStatus').textContent='글을 삭제했어요.';if(!list.children.length)await load();}catch(error){status.textContent=error.message;}finally{button.disabled=false;}
 };
 await load();
}
function popularItems(items){return `<ol class="popular-list">${items.map(item=>`<li><a href="${e(item.path)}">${e(item.title)}</a><span>${item.views.toLocaleString('ko-KR')}회</span></li>`).join('')}</ol>`;}
async function popularPage(){
 const generation=state.generation;content.innerHTML=pageHeader('인기글','WIKI')+'<article class="wiki-article"><p class="popular-period">최근 7일 · 순위는 최대 3시간 간격으로 갱신됩니다. 같은 방문자의 같은 콘텐츠는 하루 한 번 집계합니다.</p><div id="popularResults" aria-live="polite">불러오는 중…</div></article>';document.title='인기글 - 혚쾌위키';active('popular');
 try{const result=await communityRequest('popular');if(generation!==state.generation)return;document.querySelector('#popularResults').innerHTML=(result.items.length?popularItems(result.items):'<p>조회수를 집계하고 있어요. 문서를 읽으면 순위에 반영됩니다.</p>')+(result.partial?'<p>집계량이 많아 일부 조회수만 표시됩니다.</p>':'');}catch(error){if(generation===state.generation)document.querySelector('#popularResults').textContent=error.message;}
}
async function loadHomePopular(){
 const host=document.querySelector('#homePopular');if(!host)return;
 try{const result=await communityRequest('popular');if(!host.isConnected)return;host.innerHTML=result.items.length?`<span>인기글</span><a href="${e(result.items[0].path)}">${e(result.items[0].title)}</a><a class="popular-all" href="#/popular">전체 순위</a>`:'<a href="#/popular">인기글</a><span>조회수 집계 중</span>';}catch{host.innerHTML='<a href="#/popular">인기글 순위 보기</a>';}
}
function trackWikiView(){
 const path=location.hash.split('?')[0],heading=document.querySelector('#content h1');
 if(!heading||!/^#\/(video|record|source|radio|web|performance)\//.test(path)||document.title.startsWith('숨긴 문서'))return;
 const key='wiki-view:'+new Date(Date.now()+9*3600000).toISOString().slice(0,10)+':'+path;
 try{if(sessionStorage.getItem(key))return;}catch{}
 communityRequest('popular',{method:'POST',body:JSON.stringify({path,title:heading.textContent.trim()})}).then(()=>{try{sessionStorage.setItem(key,'1');}catch{}}).catch(()=>{});
}
