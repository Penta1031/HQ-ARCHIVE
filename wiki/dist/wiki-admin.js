// Authentication is checked by the server on every write. Never persist the password or session.
window.WIKI_EDITOR=(()=>{
 const endpoint='https://aiuwbwtknaceghkzporx.supabase.co/functions/v1/hq-wiki-admin';
 let token='',expiresAt=0,items=[],loadError='',dirty=false,catalog=[];
 const pageCatalog=window.WIKI_PAGE_CATALOG;
 let listQuery='',listType='all',listPage=0,viewGeneration=0;
 const isPage=name=>name.startsWith('@page:');
 let byName=new Map();
 const reindex=()=>{byName=new Map(items.map(item=>[item.name,item]));};
 const itemForPath=path=>byName.get(pageCatalog.key(path));
 const originalCategoryTitles=new Map();
 async function request(action,data={}){
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'x-hq-wiki-session':token}:{})},body:JSON.stringify({action,...data}),signal:AbortSignal.timeout(20000)});
  const result=await response.json();if(!response.ok){if(response.status===401&&action!=='login'){token='';expiresAt=0;}throw new Error(result.error||'잠시 후 다시 시도해 주세요.');}return result;
 }
 async function listAll(action){const all=[];for(let offset=0;;offset+=1000){const result=await request(action,{offset});all.push(...result.items);if(!result.hasMore)return all;}}
 async function load(){try{items=await listAll('public');loadError='';return true;}catch(error){loadError=error.message;return false;}}
 const ready=load();
 function apply(){
  reindex();
  for(const name of Object.keys(docs))delete docs[name];
  for(const [name,doc] of Object.entries(window.WIKI_DOCUMENTS))if(!hiddenDocuments.has(name))docs[name]=doc;
  for(const item of items.filter(item=>!isPage(item.name))){if(item.deleted)delete docs[item.name];else if(!hiddenDocuments.has(item.name))docs[item.name]=item.content;}
  for(const node of categoryNodes.values()){if(!originalCategoryTitles.has(node.id))originalCategoryTitles.set(node.id,node.title);node.title=itemForPath('/category/'+encodeURIComponent(node.id))?.content?.title||originalCategoryTitles.get(node.id);}
  renderNav();
 }
 const custom=()=>Object.keys(docs).filter(name=>!Object.hasOwn(window.WIKI_DOCUMENTS,name));
 function links(){return custom().length?'<div class="managed-doc-links"><p class="nav-label">문서</p>'+custom().map(name=>docLink(name)).join('')+'</div>':'';}
 function publicNote(){return loadError?'<p class="editor-load-error" role="status">최신 문서를 불러오지 못했습니다. <button type="button" id="reloadManaged">다시 불러오기</button></p>':'';}
 function bindNote(){const b=document.querySelector('#reloadManaged');if(b)b.onclick=async()=>{b.disabled=true;await load();apply();route();};}
 function status(message){const host=document.querySelector('#adminStatus');if(host)host.textContent=message;}
 function shell(title,body){viewGeneration++;content.innerHTML=pageHeader(title,'관리자')+'<article class="wiki-article admin-article">'+body+'<p id="adminStatus" role="status" aria-live="polite"></p></article>';document.title=title+' - 혚쾌위키';active('');return viewGeneration;}
 function loggedIn(){if(token&&expiresAt>Date.now())return true;token='';return false;}
 function logout(){token='';expiresAt=0;dirty=false;adminPage();}
 async function adminPage(){
  dirty=false;
  if(!loggedIn()){
   shell('관리자 로그인','<div class="admin-login"><span class="admin-lock" aria-hidden="true">🔒</span><h2>혚쾌위키 관리</h2><p>아카이브 관리자 비밀번호를 입력해 주세요.</p><form id="adminLogin"><label>비밀번호<input name="password" type="password" required maxlength="200" autocomplete="current-password" autofocus></label><button type="submit">로그인</button></form><a href="#/">대문으로 돌아가기</a></div>');
   const form=document.querySelector('#adminLogin');form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;status('확인 중…');let password=form.elements.password.value;try{const result=await request('login',{password});token=result.token;expiresAt=result.expiresAt;form.reset();if(new URLSearchParams(location.hash.split('?')[1]||'').get('tab')==='stats')await statsPage();else await dashboard();}catch(error){form.reset();status(error.message);}finally{password='';button.disabled=false;}};return;
  }
  return new URLSearchParams(location.hash.split('?')[1]||'').get('tab')==='stats'?statsPage():dashboard();
 }
 async function dashboard(){
  const view=shell('모든 문서 관리','<p>전체 문서를 불러오는 중…</p>');
  try{
   const fresh=await listAll('list');if(view!==viewGeneration)return;items=fresh;apply();
   await Promise.all([archive.ready,videos.ready]);
   await refreshArchive();
   catalog=await pageCatalog.build({documents:window.WIKI_DOCUMENTS,taxonomy:window.WIKI_TAXONOMY,store:archive,videoStore:videos});
  }catch(error){if(!loggedIn())return adminPage();shell('문서 목록을 불러오지 못했습니다.','<button id="retryCatalog" type="button">다시 불러오기</button>');status(error.message);document.querySelector('#retryCatalog').onclick=dashboard;return;}
  if(view===viewGeneration)renderDashboard();
 }
 function allEntries(){
  const entries=new Map(catalog.map(x=>[x.key,x]));
  for(const item of items){
   if(entries.has(item.name))continue;
   const page=isPage(item.name);const doc=item.content;
   if(page&&!doc?.route)continue;
   entries.set(item.name,{key:item.name,path:page?doc.route:'/wiki/'+encodeURIComponent(item.name),type:page?doc.pageType:'wiki',title:page?doc.title:item.name,day:'',draft:()=>structuredClone(doc)});
  }
  return [...entries.values()].map(entry=>{const current=byName.get(entry.key);return {...entry,title:current?.content?.title||entry.title,current};});
 }
 function renderDashboard(){
  const entries=allEntries();
  shell('모든 문서 관리',`<div class="admin-toolbar"><button id="showStats" type="button">방문·클릭 통계</button><button id="newDocument" type="button">＋ 새 문서</button><button id="refreshDocuments" type="button">새로고침</button><button id="adminLogout" type="button">로그아웃</button></div><p class="admin-help">일반 문서·분류·영상·공연·라디오·웹예능·출처·개별 기록을 모두 수정할 수 있습니다.</p><div class="admin-catalog-filters"><label>문서 찾기<input id="adminFilter" type="search" placeholder="제목 / 키워드 / 날짜 / 문서 주소" value="${e(listQuery)}"></label><label>문서 종류<select id="adminType"><option value="all">전체 (${entries.length.toLocaleString('ko-KR')})</option>${Object.entries(pageCatalog.types).map(([id,label])=>`<option value="${id}"${id===listType?' selected':''}>${label} (${entries.filter(x=>x.type===id).length.toLocaleString('ko-KR')})</option>`).join('')}</select></label></div><p id="adminResultCount" role="status"></p><ul id="adminDocumentList" class="admin-document-list"></ul><nav class="admin-pagination" aria-label="문서 목록 페이지"><button id="adminPrevious" type="button">이전</button><span id="adminPageCount"></span><button id="adminNext" type="button">다음</button></nav><p class="admin-help">삭제한 문서는 복구할 수 있습니다. 숨김 문서도 여기서 수정할 수 있으며 공개 숨김 상태는 유지됩니다.</p>`);
  document.querySelector('#showStats').onclick=()=>{location.hash='#/admin?tab=stats';};document.querySelector('#newDocument').onclick=()=>editDocument();document.querySelector('#refreshDocuments').onclick=dashboard;document.querySelector('#adminLogout').onclick=logout;
  function rows(){
   const found=pageCatalog.filter(entries,{query:listQuery,type:listType}),pages=Math.max(1,Math.ceil(found.length/50));listPage=Math.min(listPage,pages-1);
   document.querySelector('#adminResultCount').textContent=`전체 ${entries.length.toLocaleString('ko-KR')}개 문서 · 검색 결과 ${found.length.toLocaleString('ko-KR')}개`;
   const list=document.querySelector('#adminDocumentList');list.innerHTML=found.slice(listPage*50,listPage*50+50).map(entry=>`<li data-document-name="${e(entry.key)}"><div><strong>${e(entry.title)}</strong><small>${e(pageCatalog.types[entry.type]||'문서')}${entry.day?' · '+e(entry.day):''}${entry.hidden?' · 숨김':''}${entry.current?.deleted?' · 삭제됨':''}</small><small class="admin-document-path">#${e(entry.path)}</small></div><div>${entry.current?.deleted?`<button type="button" data-restore="${e(entry.key)}">복구</button>`:`<a href="#${e(entry.path)}">보기</a><button type="button" data-edit="${e(entry.key)}">수정</button>${entry.path==='/'?'':`<button class="admin-danger" type="button" data-remove="${e(entry.key)}">삭제</button>`}`}</div></li>`).join('')||'<li>조건에 맞는 문서가 없습니다.</li>';
   document.querySelector('#adminPageCount').textContent=`${listPage+1} / ${pages}`;document.querySelector('#adminPrevious').disabled=listPage===0;document.querySelector('#adminNext').disabled=listPage===pages-1;
   list.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editDocument(b.dataset.edit));
   list.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{const entry=entries.find(x=>x.key===b.dataset.remove);if(!confirm('「'+entry.title+'」 문서를 삭제할까요? 관리자 화면에서 복구할 수 있어요.'))return;b.disabled=true;try{const result=await request('delete',{name:entry.key,revision:entry.current?.revision||0,content:entry.current?.content||entry.draft()});items=items.filter(x=>x.name!==entry.key).concat(result.item);apply();renderDashboard();status('문서를 삭제했어요.');}catch(error){status(error.message);b.disabled=false;}});
   list.querySelectorAll('[data-restore]').forEach(b=>b.onclick=async()=>{const entry=entries.find(x=>x.key===b.dataset.restore);b.disabled=true;try{const result=await request('restore',{name:entry.key,revision:entry.current.revision});items=items.filter(x=>x.name!==entry.key).concat(result.item);apply();renderDashboard();status('문서를 복구했어요.');}catch(error){status(error.message);b.disabled=false;}});
  }
  document.querySelector('#adminFilter').oninput=event=>{listQuery=event.target.value;listPage=0;rows();};document.querySelector('#adminType').onchange=event=>{listType=event.target.value;listPage=0;rows();};
  document.querySelector('#adminPrevious').onclick=()=>{listPage--;rows();};document.querySelector('#adminNext').onclick=()=>{listPage++;rows();};rows();
 }
 async function statsPage(){
  if(!loggedIn())return adminPage();
  const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10),first=new Date(Date.parse(today)-6*86400000).toISOString().slice(0,10);
  const view=shell('방문·클릭 통계',`<div class="admin-toolbar"><button id="statsDocuments" type="button">문서 관리</button><button id="statsLogout" type="button">로그아웃</button></div><form id="statsRange" class="stats-range"><label>시작일<input type="date" name="start" value="${first}" max="${today}" required></label><label>종료일<input type="date" name="end" value="${today}" max="${today}" required></label><button type="submit">조회</button></form><div class="stats-presets"><button type="button" data-stats-days="7">최근 7일</button><button type="button" data-stats-days="30">최근 30일</button><button type="button" data-stats-days="90">최근 90일</button></div><div id="statsResults" aria-live="polite">불러오는 중…</div><details class="stats-definitions"><summary>집계 기준</summary><ul><li>방문 수: 같은 브라우저에서 30분 이내 이어진 이용은 한 번의 방문으로 집계합니다.</li><li>방문자 수: 날짜별 익명 브라우저 기준입니다. 기기·브라우저가 다르면 따로 집계됩니다.</li><li>페이지 조회: 대문과 문서 등 위키 화면을 연 횟수입니다.</li><li>콘텐츠 클릭: 문서·분류·원문 링크 클릭과 개별 떡밥 펼치기를 집계합니다.</li><li>관리자 화면은 제외합니다. 모든 날짜는 한국시간(KST) 기준입니다.</li></ul></details>`);
  document.querySelector('#statsDocuments').onclick=()=>{location.hash='#/admin';};document.querySelector('#statsLogout').onclick=logout;
  const form=document.querySelector('#statsRange');let requestId=0;
  async function loadStats(){
   const generation=++requestId,host=document.querySelector('#statsResults'),button=form.querySelector('button');button.disabled=true;host.textContent='불러오는 중…';
   const start=form.elements.start.value,end=form.elements.end.value;
   try{
    const result=await request('analytics-stats',{start,end});if(view!==viewGeneration||generation!==requestId)return;
    const started=new Date(Date.parse(result.startedAt)+9*3600000).toISOString().slice(0,10),byDay=new Map(result.items.map(item=>[item.day,item])),rows=[];
    for(let t=Date.parse(end);t>=Date.parse(start);t-=86400000){const day=new Date(t).toISOString().slice(0,10);rows.push({day,started:day>=started,visits:0,visitors:0,pageviews:0,clicks:0,...byDay.get(day)});}
    const total=key=>rows.filter(x=>x.started).reduce((sum,row)=>sum+Number(row[key]||0),0),num=value=>Number(value||0).toLocaleString('ko-KR');
    const chart=rows.filter(x=>x.started).slice().reverse(),max=Math.max(1,...chart.flatMap(row=>[Number(row.visits),Number(row.clicks)]));
    host.innerHTML=`<p class="admin-help">집계 시작: ${e(new Date(result.startedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))} (KST) · 집계 시작 전 날짜는 —로 표시됩니다.</p><div class="stats-cards">${[['방문 수','visits'],['일별 방문자 합계','visitors'],['페이지 조회','pageviews'],['콘텐츠 클릭','clicks']].map(([label,key])=>`<div><span>${label}</span><strong>${num(total(key))}</strong></div>`).join('')}</div><section class="stats-chart" aria-label="날짜별 방문과 콘텐츠 클릭"><div class="stats-chart-legend"><span>● 방문 수</span><span>● 콘텐츠 클릭</span></div><div class="stats-chart-bars">${chart.map(row=>`<div class="stats-chart-day" title="${e(row.day)} 방문 ${row.visits} / 클릭 ${row.clicks}"><div><i style="height:${Number(row.visits)/max*100}%"></i><b style="height:${Number(row.clicks)/max*100}%"></b></div><span>${row.day.slice(5).replace('-','/')}</span></div>`).join('')||'<p>선택한 기간에 집계된 날짜가 없습니다.</p>'}</div></section><div class="stats-table-wrap"><table class="stats-table"><thead><tr><th scope="col">날짜 (KST)</th><th scope="col">방문 수</th><th scope="col">방문자 수</th><th scope="col">페이지 조회</th><th scope="col">콘텐츠 클릭</th></tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${row.day.replaceAll('-','.')}</th>${['visits','visitors','pageviews','clicks'].map(key=>`<td>${row.started?num(row[key]):'—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
   }catch(error){if(view===viewGeneration&&generation===requestId)host.textContent=error.message;}finally{button.disabled=false;}
  }
  form.onsubmit=event=>{event.preventDefault();loadStats();};content.querySelectorAll('[data-stats-days]').forEach(button=>button.onclick=()=>{form.elements.end.value=today;form.elements.start.value=new Date(Date.parse(today)-(Number(button.dataset.statsDays)-1)*86400000).toISOString().slice(0,10);loadStats();});await loadStats();
 }
 function editDocument(name){
  const entry=name?allEntries().find(x=>x.key===name):null;
  const current=items.find(x=>x.name===name),original=name?(current?.content||entry?.draft()||window.WIKI_DOCUMENTS[name]):{category:'문서',guide:true,lead:'',sections:[{title:'소개',paragraphs:['']}],facts:[],refs:[]};
  let draft=JSON.parse(JSON.stringify(original)),revision=current?.revision||0;
  const bindings=[];
  function textField(label,parent,key,{multiline=false,array=false}={}){
   const id='adminField'+bindings.length;bindings.push({parent,key,id,array});const value=array?(parent[key]||[]).join('\n\n'):parent[key]||'';
   return `<label>${e(label)}${multiline?`<textarea id="${id}" rows="${Math.min(12,Math.max(3,value.split('\n').length+1))}">${e(value)}</textarea>`:`<input id="${id}" value="${e(value)}">`}</label>`;
  }
  function sectionFields(section,path){
   return `<fieldset class="admin-section"><legend>항목 ${path}</legend>${path!=='1'?`<button type="button" class="admin-danger" data-remove-section="${path}">항목 삭제</button>`:''}${textField('항목 제목',section,'title')}${['callout','paragraphs','paragraphsAfter','notice'].filter(k=>section[k]!==undefined||k==='paragraphs').map(key=>textField(({callout:'강조 문구',paragraphs:'본문 (문단 사이는 빈 줄)',paragraphsAfter:'추가 본문 (문단 사이는 빈 줄)',notice:'안내 문구'})[key],section,key,{multiline:true,array:['paragraphs','paragraphsAfter'].includes(key)})).join('')}${(section.children||[]).map((child,i)=>sectionFields(child,path+'.'+(i+1))).join('')}</fieldset>`;
  }
  function collect(){for(const {parent,key,id,array} of bindings){const value=document.getElementById(id).value;parent[key]=array?value.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean):value;}return draft;}
  function draw(){
   bindings.length=0;
   shell(name?'문서 수정':'새 문서',`<form id="documentEditor"><div class="admin-toolbar"><button type="submit">저장</button><button id="previewDocument" type="button">미리보기</button><button id="cancelEditor" type="button">목록으로</button></div><label>문서 이름<input id="documentName" value="${e(entry?.title||name||draft.name||'')}" ${name?'readonly':''} required maxlength="100" placeholder="문서 제목"></label>${draft.route?`<p class="admin-help">문서 주소: #${e(draft.route)}</p>${textField('표시 제목',draft,'title')}`:textField('분류',draft,'category')}${textField(draft.pageType==='record'?'기록 본문':'소개글',draft,'lead',{multiline:true})}${draft.facts?.length?`<fieldset class="admin-section"><legend>정보표</legend>${draft.facts.map((pair,i)=>`<div class="admin-pair">${textField('항목 '+(i+1),pair,0)}${textField('내용',pair,1,{multiline:true})}${pair.length>2?textField('링크 URL',pair,2):''}</div>`).join('')}</fieldset>`:''}<div id="adminSections">${draft.sections.map((s,i)=>sectionFields(s,String(i+1))).join('')}</div><button id="addSection" type="button">＋ 본문 항목 추가</button>${draft.refs?.length?`<fieldset class="admin-section"><legend>각주</legend>${draft.refs.map((pair,i)=>`<div class="admin-pair">${textField('각주 '+(i+1),pair,0)}${textField('출처 URL',pair,1)}</div>`).join('')}</fieldset>`:''}<button id="addReference" type="button">＋ 각주 추가</button><p class="admin-help">저장하면 위키 표시 내용이 바뀝니다. 영상과 관련 기록 연결은 유지됩니다. 본문에 HTML은 적용되지 않습니다.</p><div class="admin-toolbar"><button type="submit">저장</button></div><div id="adminPreview" hidden></div></form>`);
   const form=document.querySelector('#documentEditor');form.oninput=()=>{dirty=true;};
   const keepName=()=>{if(!name)draft.name=document.querySelector('#documentName').value;};
   document.querySelector('#addSection').onclick=()=>{keepName();collect();draft.sections.push({title:'새 항목',paragraphs:['']});dirty=true;draw();};
   document.querySelector('#addReference').onclick=()=>{keepName();collect();draft.refs||=[];draft.refs.push(['','']);dirty=true;draw();};
   form.querySelectorAll('[data-remove-section]').forEach(button=>button.onclick=()=>{keepName();collect();const path=button.dataset.removeSection.split('.').map(Number);let sections=draft.sections;for(const i of path.slice(0,-1))sections=sections[i-1].children;sections.splice(path.at(-1)-1,1);dirty=true;draw();});
   document.querySelector('#cancelEditor').onclick=()=>{if(!dirty||confirm('저장하지 않은 변경을 버리고 목록으로 돌아갈까요?')){dirty=false;renderDashboard();}};
   document.querySelector('#previewDocument').onclick=()=>{
    collect();const host=document.querySelector('#adminPreview');host.hidden=false;host.innerHTML=`<h2>미리보기</h2><div class="wiki-article"><h1>${e(draft.title||document.querySelector('#documentName').value)}</h1><p>${e(draft.lead)}</p>${draft.facts?.length?factsTable(draft):''}${draft.sections.map((s,i)=>sectionHtml(s,[i+1])).join('')}</div>`;host.scrollIntoView({behavior:'smooth'});
   };
   form.onsubmit=async event=>{
    event.preventDefault();collect();const documentName=name||document.querySelector('#documentName').value.trim();
    if(!name&&(documentName==='문의'||Object.hasOwn(window.WIKI_DOCUMENTS,documentName)||items.some(x=>x.name===documentName))){status('같은 이름의 문서가 있습니다. 다른 이름을 입력해 주세요.');return;}
    const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);status('저장 중…');
    const saved={...draft};delete saved.name;
    try{const result=await request('save',{name:documentName,revision,content:saved});items=items.filter(x=>x.name!==documentName).concat(result.item);apply();dirty=false;renderDashboard();status('「'+(draft.title||entry?.title||documentName)+'」 문서를 저장했어요.');}catch(error){status(error.message);buttons.forEach(b=>b.disabled=false);}
   };
  }
  draw();
 }
 document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(dirty&&link&&!link.hasAttribute('data-anchor')&&!confirm('저장하지 않은 변경을 버리고 이동할까요?'))event.preventDefault();else if(dirty&&link)dirty=false;},true);
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 function titleFor(path,fallback){return itemForPath(path)?.content?.title||fallback;}
 function recordBody(row){return itemForPath('/record/'+encodeURIComponent(row.id))?.content?.lead??row.displayTitle??row.title;}
 function searchPages(query){return items.filter(item=>isPage(item.name)&&!item.deleted&&item.content?.route&&archive.contains([item.content.title,item.content.lead,JSON.stringify(item.content.sections||[])].join(' '),query)).map(item=>({path:item.content.route,title:item.content.title}));}
 function decorate(path){
  const item=itemForPath(path);if(!item)return;
  if(item.deleted){content.innerHTML=pageHeader('삭제된 문서','문서')+'<p>이 문서는 삭제되었습니다.</p>';document.title='삭제된 문서 - 혚쾌위키';return;}
  const doc=item.content,heading=content.querySelector('h1'),article=content.querySelector('article');if(!heading||!article)return;
  if(doc.title){heading.textContent=doc.title;document.title=doc.title+' - 혚쾌위키';}
  if(doc.pageType==='record'){const raw=article.querySelector('.record-raw');if(raw)raw.textContent=doc.lead||'';}
  article.querySelector('.video-introduction')?.remove();
  if(doc.facts?.length){const meta=article.querySelector('.record-detail-meta');const html='<div class="managed-page-facts">'+factsTable(doc)+'</div>';if(meta)meta.outerHTML=html;else article.insertAdjacentHTML('afterbegin',html);}
  const html=`<section class="managed-page-prose">${doc.pageType!=='record'&&doc.lead?`<p class="document-lead">${e(doc.lead)}</p>`:''}${doc.sections.filter(s=>s.paragraphs?.length||s.children?.length||s.callout||s.notice||s.videoId).map((section,i)=>sectionHtml(section,[i+1])).join('')}${doc.refs?.length?footnotes(doc):''}</section>`;
  article.insertAdjacentHTML('afterbegin',html);
 }
 return {ready,apply,load,links,decorate,titleFor,recordBody,searchPages,publicNote,bindNote,adminPage,hasOverride:name=>items.some(x=>x.name===name&&!x.deleted),isDeleted:name=>items.some(x=>x.name===name&&x.deleted),updatedAt:()=>items.reduce((last,x)=>x.updated_at>last?x.updated_at:last,''),get dirty(){return dirty;},clearDirty:()=>{dirty=false;}};
})();
