const DATA_API_ORIGIN=location.hostname.endsWith('.vercel.app')?'':'https://hq-index.vercel.app';
const API=DATA_API_ORIGIN+'/api/archive';
const HEADERS={};
const archive = window.WIKI_STORE;
const videos = window.WIKI_VIDEOS;
// Keep temporarily hidden editorials in source for later restoration.
const hiddenDocuments = new Set(window.WIKI_TAXONOMY.find(node=>node.id==='trivia')?.documents||[]);
const docs = Object.fromEntries(Object.entries(window.WIKI_DOCUMENTS).filter(([name])=>!hiddenDocuments.has(name)));
const {showPopularPosts} = window.WIKI_PAGE_CATALOG ?? {};
const taxonomy = window.WIKI_TAXONOMY.filter(node=>node.id!=='trivia');
const hiddenWikiHref = href => (!showPopularPosts&&href==='#/popular')||href==='#/category/trivia'||(href.startsWith('#/wiki/')&&hiddenDocuments.has(decodeURIComponent(href.slice(7))));
const categoryNodes = new Map();
function indexTaxonomy(nodes, parents=[]) {
  nodes.forEach(node=>{node.parents=parents;categoryNodes.set(node.id,node);if(node.children)indexTaxonomy(node.children,[...parents,node]);});
}
indexTaxonomy(taxonomy);
const categoryUrl = node => '#/category/'+encodeURIComponent(typeof node==='string'?node:node.id);
const categoryLink = node => `<a${node.featured?' class="featured-category"':''} href="${categoryUrl(node)}">${e(node.title)}</a>`;
const content = document.querySelector('#content');
const searchInput = document.querySelector('#searchInput');
const sidebar = document.querySelector('#sidebar');
const scrim = document.querySelector('#scrim');
const menuButton = document.querySelector('#menuButton');
const state = {latest:[], topics:[], categoryMap:new Map(), cache:new Map(), generation:0, indexReady:false};
const e = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wikiUrl = name => '#/wiki/'+encodeURIComponent(name);
const docLink = name => {
  if(name==='문의')return '<a href="#/guestbook">문의</a>';
  if(hiddenDocuments.has(name))return e(name);
  const node=(!docs[name]||(name==='레코딩로그'&&!window.WIKI_EDITOR?.hasOverride(name)))?[...categoryNodes.values()].find(item=>item.title===name||item.subs?.includes(name)):null;
  return `<a href="${node?categoryUrl(node):wikiUrl(name)}">${e(name)}</a>`;
};
const date = value => value ? e(value.replaceAll('-','.'))+'.' : '날짜 미상';
const cleanText = (value, limit=180) => {
  const text=String(value||'').replace(/https?:\/\/\S+/g,'').replace(/#[^\s#]+/g,'').replace(/\s+/g,' ').trim();
  return text.length>limit?text.slice(0,limit)+'…':text;
};
function safeUrl(value) {
  try {const url=new URL(value); return ['https:','http:'].includes(url.protocol)?e(url.href):'';} catch {return '';}
}
async function api(params, count=false) {
  const response=await fetch(`${API}?${params}`,{headers:{...HEADERS,...(count?{Prefer:'count=exact'}:{})}});
  if(!response.ok) throw new Error(`기록을 불러오지 못했습니다. (${response.status})`);
  const rows=await response.json();
  const countText=(response.headers.get('content-range')||'').split('/')[1];
  return {rows,total:countText && countText!=='*'?Number(countText):null};
}
function rowParams(limit=60) {
  return new URLSearchParams({select:'id,title,occurred_on,main_category,sub_category,keywords,source_url,account',order:'occurred_on.desc.nullslast,id.desc',limit:String(limit)});
}
function buildIndex(rows) {
  const topics=new Map();
  state.categoryMap.clear();
  rows.forEach(row=>{
    const main=row.main_category||'기타', name=row.sub_category||main;
    if(!state.categoryMap.has(main)) state.categoryMap.set(main,new Set());
    state.categoryMap.get(main).add(name);
    if(!topics.has(name)) topics.set(name,{name,main,count:0});
    topics.get(name).count++;
  });
  state.topics=[...topics.values()].sort((a,b)=>a.main.localeCompare(b.main,'ko')||a.name.localeCompare(b.name,'ko'));
  renderNav();
}
async function loadIndex(total) {
  if(total===null) return;
  const tasks=[];
  for(let offset=0;offset<total;offset+=1000) tasks.push(api(new URLSearchParams({select:'main_category,sub_category',order:'id.asc',offset:String(offset),limit:'1000'})));
  const results=await Promise.all(tasks);
  buildIndex(results.flatMap(result=>result.rows));
  state.indexReady=true;
  if(location.hash.startsWith('#/documents')) directory();
}
function renderNav() {
  const branch=node=>node.children?.length?`<details open><summary>${categoryLink(node)}</summary><div class="nav-children">${node.children.map(child=>categoryLink(child)).join('')}</div></details>`:categoryLink(node);
  document.querySelector('#categoryNav').innerHTML=taxonomy.map(branch).join('')+(window.WIKI_EDITOR?.links()||'');
}
function active(key) {document.querySelectorAll('[data-nav]').forEach(node=>node.classList.toggle('active',node.dataset.nav===key));}
function pageHeader(name, category) {
  const path=Array.isArray(category)?category.map(categoryLink).join(' <span aria-hidden="true">›</span> '):e(category);
  return `<div class="wiki-heading"><h1>${e(name)}</h1></div><div class="category-line">분류 ${path}</div>`;
}
let referenceIds = new Set();
function citedText(text) {return e(text).replace(/\[(\d+)\]/g,(_,number)=>{const id=referenceIds.has(number)?'':` id="ref-${number}"`;referenceIds.add(number);return `<sup><a href="#fn-${number}" data-anchor="fn-${number}"${id}>[${number}]</a></sup>`;});}
function externalLink(label,url) {
  const href=safeUrl(url);
  return href?`<a class="external-link" href="${href}" target="_blank" rel="noopener">${e(label)} <span aria-hidden="true">↗</span></a>`:'';
}
function sectionHtml(section, numbers, showPosts=false, collapsible=false) {
  const id='s-'+numbers.join('-');
  const heading=numbers.length===1?'h2':'h3';
  const title=section.category?categoryLink(categoryNodes.get(section.category)):e(section.title);
  const paragraphs=section.paragraphs||[];
  const fold=collapsible&&Boolean(section.videoId||paragraphs.length||section.links?.length||section.children?.length||categoryNodes.get(section.tagTree)?.children?.length);
  const container=fold?'details':'section';
  const refs=[...new Set(paragraphs.flatMap(p=>[...p.matchAll(/\[(\d+)\]/g)].map(m=>m[1])))];
  const links=[...(section.categories||[]).map(id=>categoryLink(categoryNodes.get(id))),...(section.links||[]).map(docLink),...(section.external||[]).map(([label,url])=>externalLink(label,url))];
  return `<${container} class="wiki-section${fold?' home-fold':''}" id="${id}"${fold?' open':''}>${fold?`<summary><${heading}><span class="section-number">${numbers.join('.')}.</span> ${e(section.title)}</${heading}>${section.category?`<a class="home-fold-link" href="${categoryUrl(section.category)}" aria-label="${e(section.title)} 전체 보기">전체 보기</a>`:''}</summary><div class="home-fold-body">`:`<${heading}><a class="section-number" href="#${id}" data-anchor="${id}">${numbers.join('.')}.</a> ${title}</${heading}>`}
    ${section.videoId&&/^[-\w]{11}$/.test(section.videoId)?`<div class="video-player intro-video"><iframe src="https://www.youtube-nocookie.com/embed/${e(section.videoId)}" title="혚쾌 소개 영상" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><p class="intro-video-source">${externalLink('YouTube에서 보기','https://www.youtube.com/watch?v='+section.videoId)}</p>`:''}
    ${section.demo?guideDemoHtml(section.demo):''}
    ${section.callout?`<blockquote class="intro-callout">${e(section.callout)}</blockquote>`:''}
    ${paragraphs.map(p=>`<p>${citedText(p)}</p>`).join('')}
    ${(section.paragraphsAfter||[]).map(p=>`<p>${citedText(p)}</p>`).join('')}
    ${section.notice?`<p class="intro-notice">${e(section.notice)}${section.noticeDoc?`<br>이용 전 ${docLink(section.noticeDoc)} 문서를 참고해 주세요.`:''}</p>`:''}
    ${section.references?`<details class="intro-notes"><summary>소개 각주</summary><ol>${section.references.map(([label,url],i)=>`<li id="fn-${i+1}"><a href="#ref-${i+1}" data-anchor="ref-${i+1}">[${i+1}]</a> ${externalLink(label,url)}</li>`).join('')}</ol></details>`:''}
    ${links.length?`<ul class="home-links">${links.map(link=>`<li>${link}</li>`).join('')}</ul>`:''}
    ${section.tagTree?homeTagTree(categoryNodes.get(section.tagTree)):''}
    ${section.channels?`<ul class="channel-links">${section.channels.map(([id,url])=>`<li>${categoryLink(categoryNodes.get(id))} ${externalLink('공식 계정',url)}</li>`).join('')}</ul>`:''}
    ${showPosts&&refs.length?`<div class="section-posts" data-refs="${refs.join(',')}"></div>`:''}
    ${(section.children||[]).map((child,i)=>sectionHtml(child,[...numbers,i+1],showPosts,collapsible)).join('')}${fold?'</div>':''}</${container}>`;
}
function tocHtml(sections, hasReferences=true, offset=0) {
  return `<nav class="wiki-toc" aria-label="목차"><strong>목차</strong><ol>${sections.map((section,index)=>{const i=index+offset;return `<li><a href="#s-${i+1}" data-anchor="s-${i+1}">${i+1}. ${e(section.title)}</a>${section.children?.length?`<ol>${section.children.map((child,j)=>`<li><a href="#s-${i+1}-${j+1}" data-anchor="s-${i+1}-${j+1}">${i+1}.${j+1}. ${e(child.title)}</a></li>`).join('')}</ol>`:''}</li>`;}).join('')}${hasReferences?'<li><a href="#references" data-anchor="references">각주</a></li>':''}</ol></nav>`;
}
function editorial(name) {
  referenceIds = new Set();
  const doc=docs[name];
  if(name==='혚쾌')return homeEditorial(doc);
  if(doc.guide){
    content.innerHTML=pageHeader(name,Object.hasOwn(window.WIKI_DOCUMENTS,name)?'WIKI':doc.category||'문서')+`<article class="wiki-article guide-article">${tocHtml(doc.sections,false)}<p class="document-lead">${e(doc.lead)}</p>${doc.sections.map((section,i)=>sectionHtml(section,[i+1])).join('')}${doc.refs?.length?footnotes(doc):''}</article>`;
    document.title=`${name} - 혚쾌위키`;active('');return;
  }
  const category=[...categoryNodes.values()].find(node=>node.title===doc.category);
  content.innerHTML=pageHeader(name,category?[category]:doc.category)+`<article class="wiki-article"><aside class="profile-box"><h2>${e(name)}</h2>${factsTable(doc)}</aside>${doc.reviewedOn?`<p class="document-updated">내용 확인 ${date(doc.reviewedOn)}</p>`:''}${tocHtml(doc.sections)}<p class="document-lead">${e(doc.lead)}</p>${doc.sections.map((section,i)=>sectionHtml(section,[i+1],true)).join('')}${footnotes(doc)}<section class="live-records"><h2>관련 기록</h2><div id="relatedRecords" aria-live="polite">불러오는 중</div></section></article>`;
  document.title=`${name} - 혚쾌위키`;
  active('');
  attachSectionPosts(doc).catch(()=>{});
  attachRelated(name);
}
function factsTable(doc){
  return `<table><tbody>${doc.facts.map(([label,value,url])=>`<tr><th scope="row">${e(label)}</th><td>${url?externalLink(value,url):citedText(value).replace(/\n/g,'<br>')}</td></tr>`).join('')}</tbody></table>`;
}
function footnotes(doc){
  return `<section class="references" id="references"><h2>각주</h2><ol>${doc.refs.map(([label,url],i)=>`<li id="fn-${i+1}"><a href="#ref-${i+1}" data-anchor="ref-${i+1}">[${i+1}]</a> ${externalLink(label,url)}</li>`).join('')}</ol></section>`;
}
function homeTagTree(node){
  if(!node)return '';
  const leaves=(node.children||[]).filter(child=>!child.children?.length);
  const list=leaves.length?`<ul class="home-subcategories" aria-label="${e(node.title)} 하위 분류">${leaves.map(child=>`<li${child.featured?' class="home-subcategory-featured"':''}>${categoryLink(child)}</li>`).join('')}</ul>`:'';
  return list+(node.children||[]).filter(child=>child.children?.length).map(child=>`<details class="home-tag-group home-fold" open><summary><h4>${e(child.title)}</h4><a class="home-fold-link" href="${categoryUrl(child)}" aria-label="${e(child.title)} 전체 보기">전체 보기</a></summary><div class="home-fold-body">${homeTagTree(child)}</div></details>`).join('');
}
function homeSections(doc){
  return [...doc.sections,...taxonomy.map(node=>({
    title:node.title,category:node.id,links:node.documents,
    children:(node.children||[]).map(child=>({title:child.title,category:child.id,tagTree:child.id}))
  }))];
}
function homeEditorial(doc){
  const sections=homeSections(doc);
  const sourceUpdatedAt=document.querySelector('meta[name="wiki-updated-at"]')?.content;
  const managedUpdatedAt=window.WIKI_EDITOR?.updatedAt();
  const updatedAt=[sourceUpdatedAt,managedUpdatedAt]
    .map(value=>Date.parse(value))
    .filter(Number.isFinite)
    .sort((a,b)=>b-a)
    .map(value=>new Date(value).toISOString())[0];
  const updatedTime=updatedAt?`<p class="home-updated">최근 업데이트: <time datetime="${e(updatedAt)}">${e(new Date(updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}))}</time> <span>(KST)</span></p>`:'';
  const introduction=sectionHtml(sections[0],[1],false,true).replace('<h2>','<h1>').replace('</h2>','</h1>');
  content.innerHTML=`<article class="wiki-article home-article"><div class="home-body"><header class="home-title"><h1>혚쾌</h1>${updatedTime}</header><nav class="home-tools document-tools" aria-label="대문 도구"><a href="#/tags">태그</a><a href="#/guestbook">문의</a></nav>${showPopularPosts?'<aside class="popular-strip" aria-label="인기글" id="homePopular">인기글 집계 중</aside>':''}<div class="home-overview"><aside class="home-profile" aria-label="혚쾌 인물 정보"><h2>혚쾌</h2><img class="home-photo" src="./assets/hyeopkwae.jpg" alt="이승협과 유회승이 나란히 있는 사진" width="1205" height="1280" fetchpriority="high">${factsTable(doc)}</aside>${tocHtml(sections,false)}</div>
    ${introduction}
    ${sections.slice(1).map((section,i)=>sectionHtml(section,[i+2],false,true)).join('')}${Object.keys(docs).some(name=>!Object.hasOwn(window.WIKI_DOCUMENTS,name))?`<section class="wiki-section home-managed-docs"><h2>문서</h2><ul>${Object.keys(docs).filter(name=>!Object.hasOwn(window.WIKI_DOCUMENTS,name)).map(name=>`<li>${docLink(name)}</li>`).join('')}</ul></section>`:''}${window.WIKI_EDITOR.publicNote()}<footer class="admin-entry"><a href="#/admin" aria-label="관리자 모드" title="관리자 모드"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg></a></footer></div></article>`;
  document.title='혚쾌위키';active('home');if(showPopularPosts)loadHomePopular();window.WIKI_EDITOR.bindNote();
}
async function attachSectionPosts(doc){
  const generation=state.generation;
  const ids=new Set(doc.refs.map(([,url])=>tweetId(url)).filter(Boolean));
  const {rows}=await archive.query(row=>ids.has(tweetId(row.source_url)),{limit:Infinity});
  if(generation!==state.generation)return;
  const matched=new Map(rows.map(row=>[tweetId(row.source_url),row]));
  document.querySelectorAll('.section-posts').forEach(host=>{
    const items=host.dataset.refs.split(',').flatMap(index=>{
      const [label,url]=doc.refs[Number(index)-1]||[];
      const id=tweetId(url);
      if(!id)return [];
      return [{...(matched.get(id)||{source_url:url}),label}];
    }).sort((a,b)=>a.occurred_on&&b.occurred_on?archive.chronological(a,b):Number(!a.occurred_on)-Number(!b.occurred_on));
    host.innerHTML=items.length?recordList(items):'';
  });
}
async function attachRelated(name) {
  const generation=state.generation;
  try {
    const data=await loadTopic(name);
    if(generation!==state.generation)return;
    const target=document.querySelector('#relatedRecords');
    if(target){target.innerHTML=data.rows.length?recordsList(data.rows):'<p>관련 기록이 없습니다.</p>'; if(data.hasMore) target.insertAdjacentHTML('afterend',`<button class="more-button" id="loadMore">기록 더 보기</button>`); bindMore(name,data);}
  }catch {if(generation===state.generation){const target=document.querySelector('#relatedRecords');if(target)target.innerHTML='<p>관련 기록을 불러오지 못했습니다.</p>';}}
}
function topicFilter(name,params) {
  if(docs[name]?.query)params.set('title',`ilike.*${docs[name].query}*`);
  else params.set('sub_category',`eq.${name}`);
  return params;
}
function matchesDocument(row,doc){
  if(!doc)return false;
  const id=Number(row.id);
  if(doc.reviewedRecordIds?.includes(id))return true;
  if(doc.excludedRecordIds?.includes(id))return false;
  return (doc.queries||[doc.query]).some(query=>query&&archive.searchMatches(row,query));
}
async function loadTopic(name, more=false) {
  const previous=state.cache.get(name);
  if(previous&&!previous.stale&&!more)return previous;
  const result=await archive.query(row=>docs[name]?.query?matchesDocument(row,docs[name]):row.sub_category===name,{offset:more?previous.rows.length:0,limit:60});
  const data={rows:[...(more?previous.rows:[]),...result.rows],total:result.total,hasMore:result.rows.length===60&&(result.total===null|| (more?previous.rows.length:0)+result.rows.length<result.total)};
  state.cache.set(name,data);
  return data;
}
const categoryDescriptions={
  '유튜브':'유튜브에 공개된 영상의 혚쾌 관련 내용이다.',
  '라이브':'라이브 방송에서 두 사람이 함께 대화하거나 서로를 언급한 내용이다.',
  '무대영상':'공연 무대에서 함께한 퍼포먼스와 대화에 관한 기록이다.',
  'SNS':'SNS에 게시된 사진, 영상과 글에 관한 기록이다.',
  '메시지':'메시지를 통해 전해진 혚쾌 관련 발언이다.'
};
async function archiveArticle(name) {
  const generation=state.generation;
  content.innerHTML=pageHeader(name,'콘텐츠')+'<p>불러오는 중</p>';
  try {
    const data=await loadTopic(name);
    if(generation!==state.generation)return;
    if(!data.rows.length){content.innerHTML=pageHeader(name,'문서 없음')+'<p>해당 문서가 없습니다.</p>';return;}
    const main=data.rows[0].main_category||'기타';
    const years=[...new Set(data.rows.map(row=>row.occurred_on?.slice(0,4)).filter(Boolean))];
    content.innerHTML=pageHeader(name,main)+`<article class="wiki-article"><nav class="wiki-toc" aria-label="목차"><strong>목차</strong><ol><li><a href="#overview" data-anchor="overview">1. 개요</a></li><li><a href="#records" data-anchor="records">2. ${e(name)}</a><ol>${years.map(year=>`<li><a href="#year-${year}" data-anchor="year-${year}">${year}년</a></li>`).join('')}</ol></li></ol></nav><section class="wiki-section" id="overview"><h2><a href="#overview" data-anchor="overview">1.</a> 개요</h2><p>${e(categoryDescriptions[main]||'혚쾌 관련 콘텐츠와 발언을 다룬다.')}</p><p>상위 문서: ${docLink('혚쾌')}</p></section><section class="wiki-section" id="records"><h2><a href="#records" data-anchor="records">2.</a> ${e(name)}</h2><div id="relatedRecords">${recordsList(data.rows,true)}</div>${data.hasMore?'<button class="more-button" id="loadMore">기록 더 보기</button>':''}</section></article>`;
    bindMore(name,data,true);
    active('');document.title=`${name} - 혚쾌위키`;
  }catch(error){if(generation===state.generation)renderError(error);}
}
function recordsList(rows,yearHeadings=false) {
  return yearHeadings?yearGroups(rows,row=>row.occurred_on,recordList,'year'):recordList(rows);
}
function yearGroups(items,dayOf,render,idPrefix='',newest=false){
  const groups=Map.groupBy(items,item=>dayOf(item)?.slice(0,4)||'');
  const years=[...groups.keys()].filter(Boolean).sort();
  if(newest)years.reverse();
  if(groups.has(''))years.push('');
  return years.map(year=>{
    const group=groups.get(year);
    const id=idPrefix&&year?` id="${idPrefix}-${e(year)}"`:'';
    return `<details class="year-group"${id} open><summary>${year?e(year)+'년':'날짜 미상'}</summary>${render(group)}</details>`;
  }).join('');
}
function tweetId(value){
  try{const url=new URL(value);return /^(?:(?:www|mobile)\.)?(?:twitter\.com|x\.com)$/.test(url.hostname)?url.pathname.match(/\/(?:status|statuses)\/(\d+)(?:\/|$)/)?.[1]||null:null;}catch{return null;}
}
function tweetThumbnail(id){
  const path=id&&archive.tweetPreview(id);
  return path?`https://pbs.twimg.com/${path}?name=small`:'';
}
function youtubeThumbnail(id,video){
  return video?.thumbnail_url||`https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}
function thumbnail(url){
  const src=safeUrl(url);
  return src?`<img class="entry-thumb" src="${src}" alt="" width="120" height="78" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:'';
}
function timeLabel(day,short=false){
  return day?`<time datetime="${e(day)}">${short?e(day.replaceAll('-','').slice(2)):date(day)}</time>`:'';
}
function entryText({title,day,shortDate=false,meta}){
  return `<span class="entry-text">${timeLabel(day,shortDate)}<span class="entry-title">${e(title)}</span>${meta?`<span class="entry-meta">${e(meta)}</span>`:''}</span>`;
}
function entryLink({href,image,...text}){
  text.title=window.WIKI_EDITOR?.titleFor(href.replace(/^#/,''),text.title)||text.title;
  return `<a class="entry-link" href="${href}">${thumbnail(image)}${entryText(text)}</a>`;
}
function recordTitle(row){
  const original=cleanText(row.displayTitle||row.title,260).replace(/^\d{6}(?:\s+|$)/,'').trim()||row.sub_category||'기록';
  return window.WIKI_EDITOR?.titleFor('/record/'+encodeURIComponent(row.id),original)||original;
}
function recordList(rows,variant=''){
  return `<ul class="record-list ${variant}">${rows.map(row=>`<li${row.id?` data-record-id="${e(row.id)}"`:''}>${recordDisclosure(row)}${recordTags(row)}</li>`).join('')}</ul>`;
}
function recordTags(row){return `<div class="record-tags">${(row.wikiTags||[]).filter(tag=>!tag.startsWith('분류:')&&!tag.startsWith('유형:')).map(tag=>`<a class="record-tag" href="#/tag/${encodeURIComponent(tag)}">${e(tag.slice(tag.indexOf(':')+1))}</a>`).join('')}</div>`;}
function recordDisclosure(row,open=false){
  const id=tweetId(row.source_url);
  return `<details class="record-disclosure"${id?` data-tweet-id="${e(id)}"`:''}${open?' open':''}>
    <summary>${thumbnail(tweetThumbnail(id))}${entryText({title:row.label||recordTitle(row),day:row.occurred_on,meta:row.sub_category})}</summary>
    <div class="record-expanded">${row.title?`<p class="record-raw">${e(window.WIKI_EDITOR?.recordBody(row)??row.displayTitle??row.title)}</p>`:''}
    ${id?'<div class="tweet-embed" aria-live="polite"></div>':''}
    ${row.sources?.length?`<ul class="inline-sources">${row.sources.map(source=>`<li>${source.videoId&&source.videoId!==mediaVideoId(row)?externalLink(source.title,source.url):sourceLink(source)} <small>${e(source.kind)}</small></li>`).join('')}</ul>`:''}</div>
  </details>`;
}
async function recordPage(id){
  const generation=state.generation;
  content.innerHTML='<p>불러오는 중</p>';
  const {rows:[row]}=await archive.query(item=>String(item.id)===id,{limit:1});
  if(generation!==state.generation)return;
  if(!row){content.innerHTML=pageHeader('기록 없음','기록');return;}
  const node=[...categoryNodes.values()].find(item=>item.subs?.includes(row.sub_category));
  content.innerHTML=pageHeader(recordTitle(row),node?[...node.parents,node]:row.sub_category||'기록')+`<article class="wiki-article record-detail">
    ${recordTags(row)}${recordDisclosure(row,true)}</article>`;
  const disclosure=content.querySelector('.record-disclosure');
  if(disclosure?.dataset.tweetId)showTweet(disclosure);
  document.title=`${recordTitle(row)} - 혚쾌위키`;active('');
}
document.addEventListener('error',event=>{if(event.target.matches?.('img.entry-thumb'))event.target.hidden=true;},true);
let twitterWidgetsPromise;
function twitterWidgets(){
  if(window.twttr?.widgets)return Promise.resolve(window.twttr.widgets);
  if(twitterWidgetsPromise)return twitterWidgetsPromise;
  twitterWidgetsPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    const timer=setTimeout(()=>{script.remove();reject(new Error('Twitter widget timeout'));},15000);
    script.src='https://platform.twitter.com/widgets.js';script.async=true;
    script.onload=()=>{clearTimeout(timer);window.twttr?.widgets?resolve(window.twttr.widgets):reject(new Error('Twitter widget unavailable'));};
    script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('Twitter widget unavailable'));};
    document.head.appendChild(script);
  }).catch(error=>{twitterWidgetsPromise=null;throw error;});
  return twitterWidgetsPromise;
}
async function showTweet(details){
  if(!details.open||!details.dataset.tweetId||details.dataset.embedState==='loaded'||details.dataset.embedState==='loading')return;
  const target=details.querySelector('.tweet-embed');
  const generation=details.dataset.embedGeneration;
  details.dataset.embedState='loading';target.textContent='원문 불러오는 중';
  try{
    const widgets=await twitterWidgets();if(generation!==details.dataset.embedGeneration)return;target.textContent='';
    const frame=await widgets.createTweet(details.dataset.tweetId,target,{lang:'ko',dnt:true,conversation:'none',align:'center',theme:document.documentElement?.dataset.theme||'light'});
    if(generation!==details.dataset.embedGeneration)return;
    if(!frame)throw new Error('Tweet unavailable');
    details.dataset.embedState='loaded';
  }catch{if(generation!==details.dataset.embedGeneration)return;target.textContent='원문을 불러올 수 없습니다.';details.dataset.embedState='error';}
}

window.addEventListener('wiki-theme-change',()=>{
  document.querySelectorAll('.record-disclosure[data-tweet-id]').forEach(details=>{
    const target=details.querySelector('.tweet-embed');if(!target)return;
    details.dataset.embedGeneration=String(Number(details.dataset.embedGeneration||0)+1);
    details.dataset.embedState='idle';target.replaceWith(target.cloneNode(false));
    if(details.open)showTweet(details);
  });
});
document.addEventListener('toggle',event=>{if(event.target.matches?.('.record-disclosure[data-tweet-id]'))showTweet(event.target);},true);
function bindMore(name,data,yearHeadings=false) {
  const button=document.querySelector('#loadMore');
  button?.addEventListener('click',async()=>{
    button.disabled=true;button.textContent='불러오는 중';
    const generation=state.generation;
    try {const next=await loadTopic(name,true);if(generation!==state.generation)return;document.querySelector('#relatedRecords').innerHTML=recordsList(next.rows,yearHeadings);if(!next.hasMore)button.remove();else {button.disabled=false;button.textContent='기록 더 보기';}}
    catch{button.disabled=false;button.textContent='다시 시도';}
  });
}
function directory() {
  content.innerHTML=pageHeader('모든 문서','문서 목록')+`<article class="wiki-article"><p>${docLink('혚쾌')} · ${docLink('이용 안내')}</p><section class="wiki-section"><h2>주제별 문서</h2><ul class="search-docs">${Object.entries(docs).filter(([name,doc])=>name!=='혚쾌'&&!doc.guide).map(([name,doc])=>`<li>${docLink(name)}<p>${e(doc.lead)}</p></li>`).join('')}</ul></section>${taxonomy.map(node=>`<section class="wiki-section"><h2>${categoryLink(node)}</h2>${categoryContents(node)}</section>`).join('')}</article>`;
  active('documents');document.title='모든 문서 - 혚쾌위키';
}
function categoryContents(node) {
  const labels={andcon:'엔콘','meet-talk':'우만합','small-talk':'우사합',overseas:'해외투어'};
  return `${node.children?.length?`<nav class="category-tags" aria-label="태그 목록">${node.children.map(child=>`<a class="record-tag${child.featured?' record-tag-featured':''}" href="${categoryUrl(child)}">${e(labels[child.id]||child.title)}</a>`).join('')}</nav>`:''}${node.documents?.length?`<ul class="document-links">${node.documents.map(name=>`<li>${docLink(name)}</li>`).join('')}</ul>`:''}`;
}
function hasCategoryRecords(node){
  return Boolean(node.subs||node.terms||node.tag||node.series||node.children?.some(hasCategoryRecords));
}
function matchesCategory(row,node){
  if(node.subs||node.series)return archive.categoryMatches(row,node);
  return archive.categoryMatches(row,node)||Boolean(node.children?.some(child=>matchesCategory(row,child)));
}
function sourceLink(source,label=source.title){
  return `<a href="${sourceHref(source)}">${e(window.WIKI_EDITOR?.titleFor(sourceHref(source).replace(/^#/,''),label)||label)}</a>`;
}
function sourceHref(source){
  return source.videoId&&videos.get(source.videoId)?'#/video/'+encodeURIComponent(source.videoId):'#/source/'+encodeURIComponent(source.id);
}
function sourceDate(source){
  if(source.published)return source.published;
  if(source.videoId)return videos.broadcastDate(source.videoId)||videos.dateKst(videos.get(source.videoId)?.published_at);
  if(source.kind==='공식 일정'){
    const url=new URL(source.url);
    const y=url.searchParams.get('year'),m=url.searchParams.get('month'),d=url.searchParams.get('day');
    if(y&&m&&d&&/^\d{4}$/.test(y)&&/^\d{1,2}$/.test(m)&&/^\d{1,2}$/.test(d))return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return '';
}
function mediaVideoId(row){
  return videos.forRecord(row);
}
function sourceEntry(row){
  if(row.performance){
    const {id,title,date,venue}=row.performance;
    return {href:'#/performance/'+id,title,day:date,yearDay:date,image:'',kind:venue||'',performance:true};
  }
  const id=mediaVideoId(row);
  const video=id&&videos.get(id);
  if(video){
    const day=videos.broadcastDate(id)||videos.dateKst(video.published_at);
    return {href:'#/video/'+id,title:video.title,day,yearDay:day,image:youtubeThumbnail(id,video)};
  }
  if(row.radioSchedule){
    const schedule=row.radioSchedule;
    return {href:'#/radio/'+schedule.id,title:schedule.title,day:schedule.date,yearDay:schedule.date,image:'',kind:schedule.station};
  }
  if(row.webEpisode){
    const episode=row.webEpisode;
    return {href:'#/web/'+episode.id,title:episode.title,day:episode.date,yearDay:episode.date,image:'',kind:episode.channel};
  }
  const source=row.sources?.find(item=>!item.videoId&&['기사','웹 출처','공식 공지','공식 포스트 보존본','공식 일정','공연 안내','음원','인스타그램 게시글'].includes(item.kind))
    ||row.sources?.find(item=>item.kind==='X 원문'&&/^https:\/\/x\.com\/(?:NFlyingofficial|FNC_ENT)\//i.test(item.url));
  if(!source)return null;
  const day=sourceDate(source);
  return {href:sourceHref(source),title:source.title,day,yearDay:day||row.occurred_on,image:tweetThumbnail(tweetId(source.url)),kind:source.kind};
}
function groupContent(rows){
  const groups=new Map(),remaining=[];
  for(const row of rows){
    const entry=sourceEntry(row);
    if(!entry){remaining.push(row);continue;}
    if(!groups.has(entry.href))groups.set(entry.href,{...entry,count:0});
    const group=groups.get(entry.href);
    group.count++;
    if(!group.image)group.image=tweetThumbnail(tweetId(row.source_url));
  }
  const entries=[...groups.values()].sort((a,b)=>(b.yearDay||'').localeCompare(a.yearDay||'')||a.title.localeCompare(b.title,'ko'));
  return {entries,remaining};
}
function contentEntries(items){
  return `<ul class="entry-list">${items.map(item=>`<li>${entryLink({...item,meta:[item.kind,`떡밥 ${item.count}건`].filter(Boolean).join(' · ')})}</li>`).join('')}</ul>`;
}
function combinedContent(entries,remaining){
  const items=[...entries.map(entry=>({entry,day:entry.yearDay||entry.day})),...remaining.map(row=>({row,day:row.occurred_on}))];
  return yearGroups(items,item=>item.day,group=>{
    const originals=group.filter(item=>item.entry).map(item=>item.entry).sort((a,b)=>Number(b.href.startsWith('#/video/'))-Number(a.href.startsWith('#/video/'))||(b.yearDay||b.day||'').localeCompare(a.yearDay||a.day||''));
    const rows=group.filter(item=>item.row).map(item=>item.row).sort(archive.chronological);
    return `${originals.length?contentEntries(originals):''}${rows.length?recordList(rows):''}`;
  },'content-year',true);
}
function sourceList(items){
  const entries=items.map(source=>({source,day:sourceDate(source)})).sort((a,b)=>(a.day||'9999').localeCompare(b.day||'9999'));
  return `<ul class="entry-list">${entries.map(({source,day})=>{
    const video=source.videoId&&videos.get(source.videoId);
    const image=video?youtubeThumbnail(source.videoId,video):tweetThumbnail(tweetId(source.url));
    return `<li>${entryLink({href:sourceHref(source),title:source.title,day,image,meta:source.kind})}</li>`;
  }).join('')}</ul>`;
}
async function sourcesPage(){
  const generation=state.generation;
  content.innerHTML=pageHeader('원본·출처','문서 목록')+'<p>불러오는 중</p>';
  await Promise.all([archive.ready,videos.ready]);
  if(generation!==state.generation)return;
  const groups=Map.groupBy(archive.sources().filter(source=>source.records.length),source=>source.kind);
  content.innerHTML=pageHeader('원본·출처','문서 목록')+`<article class="wiki-article">${[...groups].sort(([a],[b])=>a.localeCompare(b,'ko')).map(([kind,items])=>`<details class="wiki-section source-group"><summary>${e(kind)} <small>${items.length}건</small></summary>${sourceList(items)}</details>`).join('')}</article>`;
  active('sources');document.title='원본·출처 - 혚쾌위키';
}
async function sourcePage(id){
  const generation=state.generation;
  content.innerHTML='<p>불러오는 중</p>';
  await Promise.all([archive.ready,videos.ready]);
  if(generation!==state.generation)return;
  const source=archive.source(id);
  if(!source?.records.length){content.innerHTML=pageHeader('문서 없음','출처');return;}
  const idOfTweet=tweetId(source.url);
  const day=sourceDate(source);
  content.innerHTML=pageHeader(source.title,source.kind)+`<article class="wiki-article">
    <div class="record-detail-meta">${timeLabel(day)}${idOfTweet?'':externalLink(source.kind==='영상'?'YouTube 원본':new URL(source.url).hostname,source.url)}</div>
    ${idOfTweet?recordDisclosure({source_url:source.url,label:source.title},true):''}
    <section class="wiki-section"><h2>관련 기록</h2><div id="sourceRecords"></div></section></article>`;
  document.title=`${source.title} - 혚쾌위키`;active('');
  await collection('#sourceRecords',row=>row.sources?.some(item=>item.id===id),true);
}
async function radioPage(id){
  const generation=state.generation;
  content.innerHTML='<p>불러오는 중</p>';
  const [{rows}]=await Promise.all([archive.query(row=>row.radioSchedule?.id===id,{limit:Infinity}),videos.ready]);
  if(generation!==state.generation)return;
  const schedule=archive.radioSchedule(id),node=categoryNodes.get('radio');
  if(!schedule||!rows.length){content.innerHTML=pageHeader('문서 없음','라디오');return;}
  const originals=[...new Set(rows.map(mediaVideoId).filter(Boolean))].map(videoId=>{
    const video=videos.get(videoId);return {href:'#/video/'+videoId,title:video.title,day:videos.broadcastDate(videoId)||videos.dateKst(video.published_at),image:youtubeThumbnail(videoId,video),count:rows.filter(row=>mediaVideoId(row)===videoId).length};
  });
  content.innerHTML=pageHeader(schedule.title,node?[...node.parents,node]:'라디오')+`<article class="wiki-article">
    <div class="record-detail-meta">${timeLabel(schedule.date)}${schedule.time?`<span>${e(schedule.time)}</span>`:''}<span>${e(schedule.station)}</span>${schedule.url?externalLink('방송 일정',schedule.url):''}</div>
    ${originals.length?`<section class="wiki-section"><h2>원본 영상</h2>${contentEntries(originals)}</section>`:''}
    <section class="wiki-section"><h2>떡밥 <small>(${rows.length})</small></h2>${recordsList(rows,true)}</section></article>`;
  document.title=`${schedule.title} - 혚쾌위키`;active('');
}
async function webEpisodePage(id){
  const generation=state.generation;
  content.innerHTML='<p>불러오는 중</p>';
  const [{rows}]=await Promise.all([archive.query(row=>row.webEpisode?.id===id,{limit:Infinity}),videos.ready]);
  if(generation!==state.generation)return;
  const episode=archive.webEpisode(id),node=categoryNodes.get('web-shows');
  if(!episode||!rows.length){content.innerHTML=pageHeader('문서 없음','웹예능');return;}
  const originals=(episode.videoIds||[]).filter(id=>/^[\w-]{11}$/.test(id)&&videos.get(id)).map(id=>`<div class="video-player"><iframe src="https://www.youtube-nocookie.com/embed/${e(id)}" title="${e(videos.get(id).title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`).join('');
  content.innerHTML=pageHeader(episode.title,[...node.parents,node])+`<article class="wiki-article"><div class="record-detail-meta">${timeLabel(episode.date)}<span>${e(episode.channel)}</span>${episode.url?externalLink('방송 정보',episode.url):''}</div>${originals}<section class="wiki-section"><h2>떡밥 <small>(${rows.length})</small></h2>${recordsList(rows,true)}</section></article>`;
  document.title=`${episode.title} - 혚쾌위키`;active('');
}
async function performancePage(id){
  const generation=state.generation;
  content.innerHTML='<p>불러오는 중</p>';
  const [{rows}]=await Promise.all([archive.query(row=>row.performance?.id===id,{limit:Infinity}),videos.ready]);
  if(generation!==state.generation)return;
  const event=archive.performance(id);
  if(!event||!rows.length){content.innerHTML=pageHeader('문서 없음','공연 및 행사');return;}
  const node=[...categoryNodes.values()].find(item=>item.series&&event.series.includes(item.series)&&item.series!=='andcon')
    ||[...categoryNodes.values()].find(item=>item.id!=='concerts'&&item.subs?.includes(event.subs[0]))
    ||categoryNodes.get('concerts');
  const eventTags=event.series.map(key=>categoryNodes.get(key)).filter(Boolean);
  content.innerHTML=pageHeader(event.title,[...node.parents,node])+`<article class="wiki-article">
    <div class="record-detail-meta">${timeLabel(event.date)}${event.venue?`<span>${e(event.venue)}</span>`:''}${externalLink(event.userConfirmed?'원문 기록':'공연 일정·안내',event.url)}</div>
    ${categoryContents({children:eventTags})}
    ${(event.videoIds||[]).filter(videoId=>/^[\w-]{11}$/.test(videoId)&&videos.get(videoId)).map(videoId=>`<div class="video-player"><iframe src="https://www.youtube-nocookie.com/embed/${e(videoId)}" title="${e(videos.get(videoId).title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`).join('')}
    <section class="wiki-section"><h2>떡밥 <small>(${rows.length})</small></h2>${recordsList(rows,true)}</section></article>`;
  document.title=`${event.title} - 혚쾌위키`;active('');
}
async function categoryPage(id) {
  const node=categoryNodes.get(id);
  if(!node){content.innerHTML=pageHeader('문서 없음','분류');return;}
  if(node.collection||['official-youtube','personal-youtube'].includes(id)||node.parents.some(parent=>['official-youtube','personal-youtube'].includes(parent.id)))return videoCategoryPage(node);
  const generation=state.generation;
  const path=[...node.parents,node];
  const hasRecords=hasCategoryRecords(node);
  content.innerHTML=pageHeader(node.title,path)+`<article class="wiki-article">${node.album?`<div class="record-detail-meta"><span>발매일 ${timeLabel(node.released)}</span>${externalLink('앨범 정보',node.source||window.WIKI_ALBUM_SOURCE)}</div>`:''}${categoryContents(node)}${hasRecords?'<div id="categoryRecords">불러오는 중</div>':''}</article>`;
  active('');document.title=`${node.title} - 혚쾌위키`;
  if(!hasRecords)return;
  try{
    const [{rows}]=await Promise.all([archive.query(row=>matchesCategory(row,node),{limit:Infinity}),videos.ready]);
    if(generation!==state.generation)return;
    const {entries,remaining}=groupContent(rows);
    const heading=node.id==='events'||node.parents.some(parent=>parent.id==='events')?'공연 및 행사 목록':'콘텐츠 목록';
    document.querySelector('#categoryRecords').innerHTML=rows.length?`
      <section class="wiki-section"><h2>${heading}</h2>${combinedContent(entries,remaining)}</section>`:'<p>등록된 기록이 없습니다.</p>';
  }catch(error){if(generation===state.generation)renderError(error);}
}
async function search(query) {
  const generation=state.generation;
  searchInput.value=query;
  let matches=[],categoryMatches=[];
  content.innerHTML=pageHeader('검색','검색')+`<p>‘${e(query)}’</p><div id="searchResults">불러오는 중</div>`;
  try {
    await Promise.all([archive.ready,videos.ready]);
    if(generation!==state.generation)return;
    matches=Object.keys(docs).filter(name=>archive.contains([name,docs[name]?.lead,JSON.stringify(docs[name]?.sections||[])].join(' '),query));
    categoryMatches=[...categoryNodes.values()].filter(node=>archive.contains([node.title,...(node.subs||[])].join(' '),query));
    document.querySelector('#searchResults').innerHTML=`<h2>문서</h2>${matches.length||categoryMatches.length?`<ul class="search-docs">${matches.map(name=>`<li>${docLink(name)}<p>${e(docs[name].lead)}</p></li>`).join('')}${categoryMatches.map(node=>`<li>${categoryLink(node)}<p>${e([...node.parents.map(parent=>parent.title),node.title].join(' › '))}</p></li>`).join('')}</ul>`:'<p>일치하는 문서가 없습니다.</p>'}<h2>기록</h2><div id="searchRecords"></div>`;
    const edited=window.WIKI_EDITOR.searchPages(query).filter(item=>!hiddenWikiHref('#'+item.path));if(edited.length)document.querySelector('#searchResults').insertAdjacentHTML('afterbegin',`<h2>수정한 문서</h2><ul class="search-docs">${edited.map(item=>`<li><a href="#${e(item.path)}">${e(item.title)}</a></li>`).join('')}</ul>`);
    await collection('#searchRecords',row=>archive.searchMatches(row,query));
    if(generation!==state.generation)return;
    const candidates=await archive.query(row=>Boolean(row.performance||row.radioSchedule||row.webEpisode||mediaVideoId(row)||row.sources?.length),{limit:Infinity});
    if(generation!==state.generation)return;
    const {entries}=groupContent(candidates.rows);
    const contentMatches=entries.filter(item=>archive.contains([item.title,item.kind].join(' '),query));
    if(contentMatches.length)document.querySelector('#searchResults').insertAdjacentHTML('afterbegin',`<h2>콘텐츠 문서</h2>${yearGroups(contentMatches,item=>item.yearDay,contentEntries,'',true)}`);
  }catch(error){if(generation===state.generation)document.querySelector('#searchResults').innerHTML=`<ul>${matches.map(name=>`<li>${docLink(name)}</li>`).join('')}</ul><p>${e(error.message)}</p>`;}
  active('');document.title=`${query} 검색 - 혚쾌위키`;
}
async function recent() {
  const generation=state.generation;
  content.innerHTML=pageHeader('최근 기록','아카이브')+'<p>기록 날짜가 최신인 순서입니다. <a href="#/updates">위키 업데이트 보기 →</a></p><div id="recentRecords">불러오는 중</div>';
  active('recent');document.title='최근 기록 - 혚쾌위키';
  try{const {rows}=await archive.query(()=>true,{limit:Infinity});if(generation!==state.generation)return;rows.sort((a,b)=>archive.chronological(b,a));let visible=60;
    const render=()=>{document.querySelector('#recentRecords').innerHTML=yearGroups(rows.slice(0,visible),row=>row.occurred_on,items=>recordList(items),'recent-year',true)+(visible<rows.length?'<button class="more-button" id="moreRecent">더 보기</button>':'');document.querySelector('#moreRecent')?.addEventListener('click',()=>{visible+=60;render();});};render();
  }catch(error){if(generation===state.generation)renderError(error);}
}
async function collection(selector,predicate,yearHeadings=true){
  const generation=state.generation;
  let loaded=[];
  const host=document.querySelector(selector);
  host.innerHTML='<p class="collection-count"></p><div class="collection-rows">불러오는 중</div><button class="more-button" hidden>더 보기</button>';
  const button=host.querySelector('button');
  const load=async()=>{
    button.disabled=true;
    try{
      const result=await archive.query(predicate,{offset:loaded.length,limit:60});
      if(generation!==state.generation)return;
      loaded.push(...result.rows);
      host.querySelector('.collection-count').textContent=`${result.total.toLocaleString('ko-KR')}건`;
      host.querySelector('.collection-rows').innerHTML=loaded.length?recordsList(loaded,yearHeadings):'<p>해당 기록이 없습니다.</p>';
      button.hidden=!result.hasMore;button.disabled=false;button.textContent='더 보기';
    }catch(error){if(generation===state.generation){host.querySelector('.collection-rows').innerHTML=`<p>${e(error.message)}</p>`;button.hidden=false;button.disabled=false;button.textContent='다시 시도';}}
  };
  button.onclick=load;
  await load();
}
async function tagPage(tag){
  content.innerHTML=pageHeader(tag.slice(tag.indexOf(':')+1),'태그 › '+tag.split(':')[0])+`<p><a href="#/tags">태그 목록</a></p><div id="tagRecords"></div>`;
  document.title=`${tag} - 혚쾌위키`;active('tags');
  await collection('#tagRecords',row=>row.wikiTags.includes(tag),true);
}
async function tagsPage(){
  const generation=state.generation;
  content.innerHTML=pageHeader('태그 전체 보기','문서 목록')+'<label class="tag-search-label" for="tagSearch">태그 찾기</label><input id="tagSearch" class="tag-search" type="search" placeholder="연도, 콘텐츠, 주제 검색" autocomplete="off"><p id="tagSearchStatus" role="status" aria-live="polite"></p><div id="tagDirectory">불러오는 중</div>';
  active('tags');document.title='태그 전체 보기 - 혚쾌위키';
  try{
    const result=await archive.query(()=>true,{limit:Infinity});
    if(generation!==state.generation)return;
    const counts=new Map();result.rows.forEach(row=>row.wikiTags.forEach(tag=>counts.set(tag,(counts.get(tag)||0)+1)));
    const groups=[['연도','연도'],['활동','주제·활동'],['유형','콘텐츠 종류']];
    try{document.querySelector('#tagSearch').value=sessionStorage.getItem('wiki-tag-query')||'';}catch{}
    const render=()=>{
      const query=document.querySelector('#tagSearch').value.trim();try{sessionStorage.setItem('wiki-tag-query',query);}catch{}let total=0;
      document.querySelector('#tagDirectory').innerHTML=groups.map(([prefix,label])=>{
        const items=[...counts].filter(([tag])=>tag.startsWith(prefix+':')&&archive.contains(tag.slice(prefix.length+1),query)).sort(([a],[b])=>prefix==='연도'?b.localeCompare(a):a.localeCompare(b,'ko'));total+=items.length;
        return items.length?`<section class="wiki-section"><h2>${label}</h2><ul class="tag-directory">${items.map(([tag,count])=>{const node=[...categoryNodes.values()].find(n=>n.tag===tag);return `<li><a href="${node?categoryUrl(node):'#/tag/'+encodeURIComponent(tag)}">${e(tag.slice(prefix.length+1))}</a><span>${count.toLocaleString('ko-KR')}건</span></li>`;}).join('')}</ul></section>`:'';
      }).join('');
      document.querySelector('#tagSearchStatus').textContent=total?`${total}개 태그`:'일치하는 태그가 없습니다.';
    };document.querySelector('#tagSearch').addEventListener('input',render);render();
  }catch(error){if(generation===state.generation)renderError(error);}
}
async function videoCategoryPage(node){
  const generation=state.generation;
  content.innerHTML=pageHeader(node.title,[...node.parents,node])+`<article class="wiki-article">${categoryContents(node)}<section class="wiki-section"><h2>콘텐츠 목록</h2><div id="videoList">불러오는 중</div></section></article>`;
  active('');document.title=`${node.title} - 혚쾌위키`;
  try{
    await Promise.all([videos.ready,archive.ready]);
    if(generation!==state.generation)return;
    const allRecords=await archive.query(()=>true,{limit:Infinity});
    if(generation!==state.generation)return;
    const categoryRows=allRecords.rows.filter(row=>matchesCategory(row,node));
    const counts=new Map();categoryRows.forEach(row=>{const id=mediaVideoId(row);if(id)counts.set(id,(counts.get(id)||0)+1);});
    const items=node.collection?videos.byCategory(node):[...counts.keys()].map(id=>videos.get(id)).filter(Boolean);
    const category=[...node.parents,node].map(item=>item.title).join(' / ');
    const entries=items.map(video=>{
      const id=video.youtube_id;
      const day=videos.broadcastDate(id)||videos.dateKst(video.published_at);
      return {href:'#/video/'+encodeURIComponent(id),image:youtubeThumbnail(id,video),title:video.title,day,shortDate:true,kind:category,count:counts.get(id)||0};
    }).sort((a,b)=>(b.day||'').localeCompare(a.day||''));
    const ids=new Set(items.map(video=>video.youtube_id));
    const rows=categoryRows.filter(row=>!ids.has(mediaVideoId(row)));
    const fallback=groupContent(rows);
    document.querySelector('#videoList').innerHTML=entries.length||rows.length?combinedContent([...entries,...fallback.entries],fallback.remaining):'<p>등록된 기록이 없습니다.</p>';
  }catch(error){if(generation===state.generation)renderError(error);}
}
async function videoPage(id){
  const generation=state.generation;
  content.innerHTML='<p>불러오는 중</p>';
  try{
    await Promise.all([videos.ready,archive.ready]);
    if(generation!==state.generation)return;
    const video=videos.get(id);
    if(!video||!/^[-\w]{11}$/.test(id)){content.innerHTML=pageHeader('문서 없음','영상');return;}
    const result=await archive.query(row=>mediaVideoId(row)===id,{limit:Infinity});
    if(generation!==state.generation)return;
    const rows=result.rows.sort(archive.chronological);
    const collections=[...categoryNodes.values()].filter(node=>node.collection&&archive.collection(node.collection)?.videoIds.includes(id));
    if(!rows.length&&!collections.length){content.innerHTML=pageHeader('문서 없음','영상');return;}
    const broadcast=videos.broadcastDate(id);
    const categories=[...categoryNodes.values()];
    const parents=categories.filter(node=>node.subs?.length&&rows.some(row=>archive.categoryMatches(row,node)));
    if(!parents.length)parents.push(...categories.filter(node=>node.subs?.length&&rows.some(row=>archive.categoryMatches(row,node))));
    parents.push(...collections);
    const published=videos.dateKst(video.published_at);
    const primary=parents[0];
    const note=window.WIKI_VIDEO_NOTES?.[id];
    const reviewedNote=note&&note.recordIds.every(recordId=>rows.some(row=>Number(row.id)===recordId))?note:null;
    const relatedTopics=Object.entries(docs).filter(([name,doc])=>!doc.guide&&name!=='혚쾌'&&(reviewedNote?.topics.includes(name)||(doc.query&&rows.some(row=>matchesDocument(row,doc))))).map(([name])=>name);
    const articles=[...new Map(rows.flatMap(row=>row.sources||[]).filter(source=>source.kind==='기사').map(source=>[source.id,source])).values()];
    content.innerHTML=pageHeader(video.title,primary?[...primary.parents,primary]:'유튜브')+`<article class="wiki-article">
      <div class="record-detail-meta">${broadcast&&broadcast!==published?`<span>원방송일 ${timeLabel(broadcast)}</span>`:''}${published?`<span>공개일 ${timeLabel(published)}</span>`:''}${e(video.channel_title)}${video.content_format?`<span>${e(video.content_format)}</span>`:''}${externalLink('YouTube 원본','https://www.youtube.com/watch?v='+id)}</div>
      <div class="video-player"><iframe src="https://www.youtube-nocookie.com/embed/${e(id)}" title="${e(video.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>
      ${reviewedNote?`<section class="wiki-section video-introduction"><h2>주요 내용</h2><p>${e(reviewedNote.summary)}</p><p class="document-updated">연결 기록 기준 · 내용 확인 ${date(reviewedNote.reviewedOn)}</p></section>`:''}
      ${relatedTopics.length?`<section class="wiki-section related-topics"><h2>함께 보기</h2><ul class="home-links">${relatedTopics.map(name=>`<li>${docLink(name)}</li>`).join('')}</ul></section>`:''}
      ${articles.length?`<ul class="inline-sources">${articles.map(source=>`<li>${externalLink(source.title,source.url)}</li>`).join('')}</ul>`:''}
      ${parents.length>1?`<p>${parents.slice(1).map(categoryLink).join(' · ')}</p>`:''}
      <section class="wiki-section"><h2>떡밥 <small>(${rows.length})</small></h2>${yearGroups(rows,row=>row.occurred_on,items=>recordList(items,'video-records'),'year')}</section></article>`;
    document.title=`${video.title} - 혚쾌위키`;active('');
  }catch(error){if(generation===state.generation)renderError(error);}
}
function renderError(error){content.innerHTML=`<p>${e(error.message)}</p><button class="more-button" id="retry">다시 시도</button>`;document.querySelector('#retry').onclick=route;}
let menuPreviousOverflow='';
function closeMenu(){
  const wasOpen=sidebar.classList.contains('open');
  sidebar.classList.remove('open');sidebar.inert=true;sidebar.removeAttribute('aria-modal');sidebar.removeAttribute('role');scrim.classList.remove('show');
  menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','메뉴 열기');
  if(wasOpen){document.body.style.overflow=menuPreviousOverflow;menuButton.focus();}
}
function openMenu(){
  menuPreviousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  sidebar.inert=false;sidebar.classList.add('open');sidebar.setAttribute('role','dialog');sidebar.setAttribute('aria-modal','true');scrim.classList.add('show');
  menuButton.setAttribute('aria-expanded','true');menuButton.setAttribute('aria-label','메뉴 닫기');document.querySelector('#menuClose').focus();
}
let randomPending=false;
async function randomRecord(){
  if(randomPending)return;
  randomPending=true;
  const buttons=['#randomButton','#sideRandom'].map(selector=>document.querySelector(selector));
  buttons.forEach(button=>{button.disabled=true;button.setAttribute('aria-busy','true');});
  try{
    const {rows}=await archive.query(()=>true,{limit:Infinity});
    if(!rows.length)throw new Error('떡밥이 없습니다.');
    const row=rows[Math.floor(Math.random()*rows.length)];
    location.hash='#/record/'+encodeURIComponent(row.id);
  }catch(error){
    const toast=document.querySelector('#toast');
    toast.textContent=error.message;toast.classList.add('show');
    setTimeout(()=>toast.classList.remove('show'),4000);
  }finally{
    randomPending=false;
    buttons.forEach(button=>{button.disabled=false;button.setAttribute('aria-busy','false');});
  }
}
async function renderRoute(){
  await window.WIKI_EDITOR.ready;
  window.WIKI_EDITOR.apply();
  state.generation++;
  closeMenu();window.scrollTo({top:0,behavior:'instant'});
  const raw=location.hash.replace(/^#/,'')||'/', separator=raw.indexOf('?');
  const path=separator<0?raw:raw.slice(0,separator),query=separator<0?'':raw.slice(separator+1);
  let name;
  try{name=decodeURIComponent(path.replace(/^\/wiki\//,''));}catch{name='';}
  if((path==='/popular'&&!showPopularPosts)||path==='/category/trivia'||(path.startsWith('/wiki/')&&hiddenDocuments.has(name))){
    content.innerHTML=pageHeader('숨긴 문서','WIKI')+'<p>이 문서는 현재 숨김 처리되어 있습니다.</p><p><a href="#/">대문으로 돌아가기</a></p>';
    document.title='숨긴 문서 - 혚쾌위키';active('');return;
  }
  if(path==='/admin')return window.WIKI_EDITOR.adminPage();
  if(path==='/')return editorial('혚쾌');
  if(path==='/documents')return directory();
  if(path==='/sources')return sourcesPage().catch(renderError);
  if(path==='/updates')return updatesPage();
  if(path==='/feedback'||path==='/guestbook')return guestbookPage(new URLSearchParams(query));
  if(path==='/calendar')return window.WIKI_CALENDAR.render(new URLSearchParams(query));
  if(path==='/popular')return popularPage();
  if(path==='/recent')return recent();
  if(path==='/tags')return tagsPage();
  if(path.startsWith('/video/'))return videoPage(decodeURIComponent(path.slice('/video/'.length)));
  if(path.startsWith('/source/'))return sourcePage(decodeURIComponent(path.slice('/source/'.length))).catch(renderError);
  if(path.startsWith('/radio/'))return radioPage(decodeURIComponent(path.slice('/radio/'.length))).catch(renderError);
  if(path.startsWith('/web/'))return webEpisodePage(decodeURIComponent(path.slice('/web/'.length))).catch(renderError);
  if(path.startsWith('/performance/'))return performancePage(decodeURIComponent(path.slice('/performance/'.length))).catch(renderError);
  if(path.startsWith('/record/'))return recordPage(decodeURIComponent(path.slice('/record/'.length))).catch(renderError);
  if(path.startsWith('/tag/'))return tagPage(decodeURIComponent(path.slice('/tag/'.length)));
  if(path.startsWith('/category/'))return categoryPage(decodeURIComponent(path.slice('/category/'.length)));
  if(path==='/search'){const term=new URLSearchParams(query).get('q')?.trim();return term?search(term):directory();}
  if(path.startsWith('/wiki/')){
    if(name==='레코딩로그'&&!window.WIKI_EDITOR.hasOverride(name)&&!window.WIKI_EDITOR.isDeleted(name))return categoryPage('recording');
    if(window.WIKI_EDITOR.isDeleted(name)){content.innerHTML=pageHeader('삭제된 문서','문서')+'<p>이 문서는 삭제되었습니다.</p><p><a href="#/">대문으로 돌아가기</a></p>';document.title='삭제된 문서 - 혚쾌위키';return;}
    if(docs[name])return editorial(name);
    const node=[...categoryNodes.values()].find(item=>item.title===name||item.subs?.includes(name));
    return node?categoryPage(node.id):archiveArticle(name);
  }
  content.innerHTML=pageHeader('문서 없음','문서')+'<p>해당 문서가 없습니다.</p>';
}
document.addEventListener('click',event=>{
  const anchor=event.target.closest('[data-anchor]');
  if(!anchor)return;
  event.preventDefault();
  const target=document.getElementById(anchor.dataset.anchor);
  if(target){let ancestor=target;while(ancestor&&ancestor!==content){if(ancestor.matches('details.home-fold,details.year-group'))ancestor.open=true;ancestor=ancestor.parentElement;}}
  target?.scrollIntoView({behavior:'smooth',block:'start'});
  if(target){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}
});
document.querySelector('#searchForm').addEventListener('submit',event=>{event.preventDefault();if(searchInput.value.trim())location.hash='#/search?q='+encodeURIComponent(searchInput.value.trim());});
document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();content.focus();});
document.querySelector('#randomButton').addEventListener('click',randomRecord);
document.querySelector('#sideRandom').addEventListener('click',randomRecord);
menuButton.addEventListener('click',()=>sidebar.classList.contains('open')?closeMenu():openMenu());
document.querySelector('#menuClose').addEventListener('click',closeMenu);
sidebar.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeMenu();return;}
  if(event.key!=='Tab')return;
  const items=[...sidebar.querySelectorAll('a,button,summary,input,[tabindex="0"]')].filter(item=>item.getClientRects().length&&!item.disabled);
  const first=items[0],last=items[items.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
});
scrim.addEventListener('click',closeMenu);
window.addEventListener('hashchange',route);
function refreshArchive(){return archive.refresh({url:API,headers:HEADERS}).then(()=>{state.cache.clear();}).catch(()=>{});}
window.addEventListener('focus',refreshArchive);
renderNav();route();
archive.ready.then(refreshArchive).catch(()=>{});
videos.ready.then(()=>videos.refresh({url:DATA_API_ORIGIN+'/api/videos',headers:HEADERS})).catch(()=>{});
