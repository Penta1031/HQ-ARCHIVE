// A route is a document identity; display titles may change without changing links.
window.WIKI_PAGE_CATALOG=(()=>{
 const showPopularPosts=false;
 const types={wiki:'일반 문서',category:'분류',video:'영상',performance:'공연',radio:'라디오',web:'웹예능',source:'출처',record:'개별 기록',tag:'태그',system:'안내 화면'};
 function key(path){let a=2166136261,b=3339675911,c=2654435761,d=2246822519;for(const ch of path){const n=ch.codePointAt(0);a=Math.imul(a^n,16777619);b=Math.imul(b^n,2246822519);c=Math.imul(c^n,3266489917);d=Math.imul(d^n,668265263);}return '@page:'+ [a,b,c,d].map(n=>(n>>>0).toString(16).padStart(8,'0')).join('');}
 const path=(type,id)=>'/'+type+'/'+encodeURIComponent(id);
 function generated(type,id,title,{day='',facts=[],lead='',sections=[],hidden=false,searchText=''}={}){const route=type==='system'?'/'+id:path(type,id);return {key:key(route),path:route,type,title,day,hidden,searchText,draft:()=>({route,pageType:type,title,category:types[type],lead,sections:sections.length?JSON.parse(JSON.stringify(sections)):[{title:'본문',paragraphs:[]}],facts:JSON.parse(JSON.stringify(facts)),refs:[]})};}
 async function build({documents,taxonomy,store,videoStore}){
  await Promise.all([store.ready,videoStore.ready]);
  const {rows}=await store.query(()=>true,{limit:Infinity}),list=[],byPath=new Map();
  const add=item=>{if(byPath.has(item.path))return;list.push(item);byPath.set(item.path,item);};
  const hidden=new Set(taxonomy.find(x=>x.id==='trivia')?.documents||[]);
  for(const [name,doc] of Object.entries(documents))add({key:name,path:name==='혚쾌'?'/':path('wiki',name),type:'wiki',title:name,hidden:hidden.has(name),day:'',draft:()=>JSON.parse(JSON.stringify(doc))});
  function visit(nodes,parentHidden=false){for(const node of nodes){const isHidden=parentHidden||node.id==='trivia';add(generated('category',node.id,node.title,{hidden:isHidden}));if(node.children)visit(node.children,isHidden);}}
  visit(taxonomy);
  const videoIds=new Set();for(const row of rows){const id=videoStore.forRecord(row);if(id)videoIds.add(id);}
  for(const id of store.collection('couple-live')?.videoIds||[])videoIds.add(id);
  for(const id of videoIds){const v=videoStore.get(id);if(!v)continue;const day=videoStore.broadcastDate(id)||videoStore.dateKst(v.published_at);add(generated('video',id,v.title,{day,facts:[['원방송일',day],['공개일',videoStore.dateKst(v.published_at)],['채널',v.channel_title||''],['원본','YouTube','https://www.youtube.com/watch?v='+id]],lead:window.WIKI_VIDEO_NOTES?.[id]?.summary||''}));}
  const tags=new Set();
  for(const row of rows){
   add(generated('record',row.id,row.displayTitle||row.title,{day:row.occurred_on,lead:row.displayTitle||row.title,searchText:[row.account,...(row.keywords||[])].join(' '),facts:[['날짜',row.occurred_on],['분류',[row.main_category,row.sub_category].filter(Boolean).join(' › ')],['계정',row.account||''],['원문','원문 보기',row.source_url||'']]}));
   for(const tag of row.wikiTags||[])tags.add(tag);
   for(const [type,entity,extra] of [['performance',row.performance,'venue'],['radio',row.radioSchedule,'station'],['web',row.webEpisode,'channel']]){
    if(!entity)continue;add(generated(type,entity.id,entity.title,{day:entity.date,facts:[['날짜',entity.date],[(type==='performance'?'장소':type==='radio'?'방송사':'채널'),entity[extra]||''],['출처','원본 보기',entity.url||'']]}));
   }
  }
  for(const source of store.sources()){if(!source.records?.length)continue;add(generated('source',source.id,source.title,{day:source.published||'',facts:[['유형',source.kind||''],['출처','원본 보기',source.url||'']]}));}
  for(const tag of tags)add(generated('tag',tag,tag.split(':').slice(1).join(':')||tag));
  for(const [id,title] of [['documents','문서 목록'],['tags','태그 전체 보기'],['sources','원본·출처'],['updates','최근 업데이트'],['recent','최근 기록'],['popular','인기글'],['guestbook','문의']])add(generated('system',id,title,{hidden:id==='popular'&&!showPopularPosts}));
  const keys=new Map();for(const item of list){if(keys.has(item.key)&&keys.get(item.key)!==item.path)throw Error('문서 식별자가 중복되었습니다.');keys.set(item.key,item.path);}
  return list;
 }
 function filter(entries,{query='',type='all'}={}){const terms=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);return entries.filter(item=>(type==='all'||item.type===type)&&terms.every(term=>[item.title,item.day,item.path,item.key,item.searchText,item.hidden?'숨김':''].join(' ').toLocaleLowerCase().includes(term)));}
 return {key,build,types,filter,showPopularPosts};
})();
