// Only daily anonymous browser/session identifiers and numeric counts are sent.
window.WIKI_ANALYTICS=(()=>{
 const endpoint='https://aiuwbwtknaceghkzporx.supabase.co/functions/v1/hq-wiki-admin';
 const sessionKey='hq-wiki-analytics-session',visitorKey='hq-wiki-analytics-visitor';
 let pages=0,clicks=0,timer=null,pending=null,sending=false,retryDelay=8000,lastPage='',memoryVisitor=null,memorySession=null;
 const day=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 function stored(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return fallback;}}
 function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
 function identity(){
  const today=day(),now=Date.now();let visitor=stored(visitorKey,memoryVisitor),session=stored(sessionKey,memorySession);
  if(!visitor||visitor.day!==today)visitor={day:today,id:crypto.randomUUID()};
  if(!session||session.day!==today||now-session.lastActivity>30*60000)session={day:today,id:crypto.randomUUID(),lastActivity:now};
  session.lastActivity=now;memoryVisitor=visitor;memorySession=session;save(visitorKey,visitor);save(sessionKey,session);return {visitor:visitor.id,session:session.id};
 }
 function schedule(){if(!timer)timer=setTimeout(()=>{timer=null;flush();},retryDelay);}
 function queue(kind){if(location.hash.startsWith('#/admin'))return;identity();if(kind==='page')pages++;else clicks++;schedule();}
 async function flush(){
  if(sending)return;if(!pending&&!pages&&!clicks)return;
  if(!pending){const counts={pageviews:Math.min(pages,50),clicks:Math.min(clicks,50)};pages-=counts.pageviews;clicks-=counts.clicks;pending={action:'analytics-track',batch:crypto.randomUUID(),...identity(),...counts};}
  sending=true;
  try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending),keepalive:true,signal:AbortSignal.timeout(10000)});if(response.ok){pending=null;retryDelay=8000;}else if(response.status>=400&&response.status<500&&response.status!==429){pending=null;retryDelay=8000;}else retryDelay=Math.min(60000,retryDelay*2);}
  catch{retryDelay=Math.min(60000,retryDelay*2);}finally{sending=false;if(pending||pages||clicks)schedule();}
 }
 function page(path){if(path.startsWith('/admin')){lastPage='';return;}if(lastPage===path)return;lastPage=path;queue('page');}
 document.addEventListener('click',event=>{
  if(!event.isTrusted||location.hash.startsWith('#/admin'))return;
  const link=event.target.closest('a[href]');
  if(link){const href=link.getAttribute('href')||'';if(/^#\/(wiki|category|video|record|performance|radio|web|source|tag)\//.test(href)||(/^https?:/.test(href)&&link.closest('#content')))queue('click');return;}
  if(event.target.closest('#randomButton,#sideRandom')){queue('click');return;}
  const summary=event.target.closest('details.record-disclosure>summary');if(summary&&!summary.parentElement.open)queue('click');
 },true);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush();});window.addEventListener('pagehide',flush);
 return {page};
})();
