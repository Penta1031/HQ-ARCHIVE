// Navigation helpers share the main renderer's public document state.
const wikiPositions=new Map();let wikiRouteKey=location.hash||'#/',wikiNavigating=false;
try{for(const [key,value] of JSON.parse(sessionStorage.getItem('wiki-scroll')||'[]'))wikiPositions.set(key,value);}catch{}
if('scrollRestoration' in history)history.scrollRestoration='manual';
function saveWikiPosition(){if(wikiNavigating)return;wikiPositions.set(wikiRouteKey,window.scrollY);if(wikiPositions.size>60)wikiPositions.delete(wikiPositions.keys().next().value);}
window.addEventListener('pagehide',()=>{saveWikiPosition();try{sessionStorage.setItem('wiki-scroll',JSON.stringify([...wikiPositions]));}catch{}});
async function route(){
  saveWikiPosition();const key=location.hash||'#/',position=wikiPositions.get(key);wikiRouteKey=key;wikiNavigating=true;
  try{await renderRoute();}finally{if(wikiRouteKey===key){window.WIKI_EDITOR?.decorate(key.replace(/^#/,'').split('?')[0]||'/');requestAnimationFrame(()=>{trackWikiView();if(!document.title.startsWith('숨긴 문서'))window.WIKI_ANALYTICS?.page(key.replace(/^#/,'').split('?')[0]||'/');window.scrollTo({top:position||0,behavior:'instant'});wikiNavigating=false;});}}
}
function guideDemoHtml(kind){
 if(kind!=='navigation')return '';
 return '<figure class="guide-demo" aria-label="검색과 태그 사용 예시"><div class="guide-demo-title">화면 예시 · 찾기와 이동</div><div class="guide-demo-search"><b>① 검색</b> 콘텐츠명 · 키워드 · 날짜</div><div class="guide-demo-tags"><b>② 태그</b><span class="guide-demo-featured">커플 라이브</span><span>단체 라이브</span><span>개인 라이브</span></div><div class="guide-demo-year">▾ 2026년 <small>연도를 눌러 접거나 펼치기</small></div></figure>';
}
function updatesPage(){
 content.innerHTML=pageHeader('최근 업데이트','WIKI')+`<p class="update-note">위키의 문서·분류·기능 변경 내역입니다. 콘텐츠가 발생한 날짜는 각 기록에서 확인할 수 있습니다.</p><p><a href="#/recent">날짜별 최근 기록 보기 →</a></p><ul class="update-list">${(window.WIKI_UPDATES||[]).filter(item=>!hiddenWikiHref(item.href)).map(item=>`<li><div class="update-meta"><time datetime="${e(item.date)}">${date(item.date)}</time><span>${e(item.type)}</span></div><a href="${e(item.href)}">${e(item.title)}</a><p>${e(item.detail)}</p></li>`).join('')}</ul>`;
 document.title='최근 업데이트 - 혚쾌위키';active('updates');
}
window.addEventListener('scroll',()=>{
 saveWikiPosition();const button=document.querySelector('#backToTop');if(button)button.hidden=window.scrollY<500;

},{passive:true});
document.querySelector('#backToTop').onclick=()=>{window.scrollTo({top:0,behavior:'smooth'});};
