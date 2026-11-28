// Archive originals are read-only; this module applies wiki-specific curation.
window.WIKI_STORE=(()=>{
  let records=[],aliases=[],excluded=new Set(),reviewed=new Map(),refreshing=null,lastRefresh=0;
  const sourceReady=fetch('./reviewed-sources.json').then(response=>{
    if(!response.ok)throw new Error('출처를 불러오지 못했습니다.');
    return response.json();
  });
  let coupleLive={videoIds:[],records:{}};
  const coupleReady=fetch('./couple-live.json').then(response=>{if(!response.ok)throw new Error('커플라이브 목록을 불러오지 못했습니다.');return response.json();}).then(data=>{coupleLive=data;});
  let sourceData={records:{},sources:[],videos:[]};
  let sourceIndex=new Map();
  let performances=new Map();
  let performancesByDay=new Map();
  let performancesByRelatedRecord=new Map();
  const performanceReady=fetch('./performances.json').then(response=>{
    if(!response.ok)throw new Error('공연 일정을 불러오지 못했습니다.');
    return response.json();
  });
  let radioSchedules=new Map(),radioByRecord=new Map();
  const radioReady=fetch('./radio-schedules.json').then(response=>{if(!response.ok)throw new Error('라디오 일정을 불러오지 못했습니다.');return response.json();});
  let webEpisodes=new Map(),webByRecord=new Map();
  const webReady=fetch('./web-episodes.json').then(response=>{if(!response.ok)throw new Error('웹예능 회차를 불러오지 못했습니다.');return response.json();});
  let tweetPreviews={},dateCorrections={};
  const dateReady=fetch('./wiki-date-corrections.json').then(response=>response.json()).then(data=>{dateCorrections=data.records||{};});
  const previewReady=fetch('./tweet-previews.json').then(response=>response.ok?response.json():{}).then(data=>{tweetPreviews=data;}).catch(()=>{});
  function sourceReview(row){
    const review=sourceData.records[row.id];
    if(!review||review.title!==row.title||review.date!==row.occurred_on||review.main!==row.main_category||review.sub!==row.sub_category)return null;
    if(review.url===row.source_url)return review;
    const status=url=>String(url||'').match(/^https:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/i)?.[1];
    return status(review.url)&&status(review.url)===status(row.source_url)?review:null;
  }
  const trusted=rule=>['user_confirmed','spelling_clear'].includes(rule.confidence);
  const compact=value=>String(value||'').toLowerCase().replace(/[\s:：·.?!()\[\]_-]/g,'');
  const quoteRegex=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  function matchesRule(text,form,rule){
    if(['연상','연하'].includes(form))return new RegExp('(?<![가-힣ㄱ-ㅎㅏ-ㅣ])'+form+'(?=(?:가|이|은|는|을|를|의|도|에게|한테|랑|와|과|께서|님|씨)?(?:[^가-힣ㄱ-ㅎㅏ-ㅣ]|$))','u').test(text);
    return rule.matchMode==='token'?new RegExp('(?<![가-힣ㄱ-ㅎㅏ-ㅣ])'+quoteRegex(form)+'(?![가-힣ㄱ-ㅎㅏ-ㅣ])','u').test(text):text.includes(form);
  }
  function normalized(text){
    let output=String(text||'');
    const rules=aliases.flatMap(rule=>rule.forms.map(form=>({form,rule}))).sort((a,b)=>b.form.length-a.form.length);
    for(const {form,rule} of rules){
      if(!rule.replace||!matchesRule(output,form,rule))continue;
      const pattern=rule.matchMode==='token'?'(?<![가-힣ㄱ-ㅎㅏ-ㅣ])'+quoteRegex(form)+'(?![가-힣ㄱ-ㅎㅏ-ㅣ])':quoteRegex(form);
      output=output.replace(new RegExp(pattern,'gu'),rule.canonical);
    }
    return output;
  }
  function derive(row){
    const text=String(row.title||''),tags=[`연도:${row.occurred_on.slice(0,4)}`],people=[];
    if(row.sub_category&&!['미분류','기타','백업'].includes(row.sub_category))tags.push('유형:'+row.sub_category);
    for(const rule of aliases){
      if(!trusted(rule)||!rule.forms.some(form=>matchesRule(text,form,rule)))continue;
      if(rule.kind==='인물')people.push(rule.entity||rule.canonical);
      if(['콘텐츠','공연','방송'].includes(rule.kind))tags.push('활동:'+rule.canonical);
      if(rule.categoryPath)tags.push('분류:'+rule.categoryPath[0]);
      if(rule.activityType)tags.push('유형:'+rule.activityType);
    }
    return {tags:[...new Set(tags)],people:[...new Set(people)]};
  }
  const signature=row=>JSON.stringify([row.title,row.occurred_on,row.main_category,row.sub_category]);
  function include(row){
    if(excluded.has(Number(row.id))||!/^\d{4}-\d{2}-\d{2}$/.test(row.occurred_on||''))return false;
    const review=reviewed.get(Number(row.id));
    if(review&&review.signature===signature(row))return true;
    const prefix=String(row.title||'').match(/^\s*(\d{2})(\d{2})(\d{2})(?!\d)/);
    return !prefix||`20${prefix[1]}-${prefix[2]}-${prefix[3]}`===row.occurred_on;
  }
  function performanceFor(row,source,tags){
    if(row.main_category!=='무대영상')return null;
    const related=(performancesByRelatedRecord.get(String(row.id))||[]).filter(event=>event.subs.includes(row.sub_category)&&event.relatedDates[row.id]===row.occurred_on);
    if(related.length===1)return related[0];
    const candidates=(performancesByDay.get(row.occurred_on)||[]).filter(event=>event.subs.includes(row.sub_category));
    const reviewed=candidates.filter(event=>event.recordIds.includes(row.id));
    if(reviewed.length===1)return reviewed[0];
    const named=candidates.filter(event=>(event.matchTerms||[]).some(term=>String(row.title).includes(term)));
    if(named.length===1)return named[0];
    const activity=compact(source?.activity);
    const matches=candidates.filter(event=>{
      const title=compact(event.title);
      return (activity&&title.includes(activity))||tags.some(tag=>tag.startsWith('활동:')&&title.includes(compact(tag.slice(3))));
    });
    if(matches.length===1)return matches[0];
    if(candidates.length>1){const types=candidates.filter(event=>event.officialSubs?.includes(row.sub_category));if(types.length===1)return types[0];}
    return candidates.length===1?candidates[0]:null;
  }
  function hydrate(row){
    const originalSignature=signature(row),source=sourceReview(row);
    if(source?.categoryOverride)row={...row,main_category:source.categoryOverride.main,sub_category:source.categoryOverride.sub};
    const review=reviewed.get(Number(row.id));
    const curation=review&&Array.isArray(review.tags)&&Array.isArray(review.people)&&review.signature===signature(row)?{tags:review.tags,people:review.people}:derive(row);
    const categoryTags=curation.tags.filter(tag=>!tag.startsWith('유형:')&&!tag.startsWith('분류:'));
    if(row.sub_category&&!['미분류','기타','백업'].includes(row.sub_category))categoryTags.push('유형:'+row.sub_category);
    let tags=source?.activity?[...new Set([...categoryTags,'활동:'+source.activity])]:categoryTags;
    const coupleReview=coupleLive.records[row.id];
    if(coupleReview?.signature===originalSignature)tags=[...new Set([...tags,coupleLive.tag])];
    const title=normalized(row.title);
    const correction=dateCorrections[row.id];
    const corrected=correction&&correction.signature===signature(row)?correction:null;
    const radioReview=radioByRecord.get(String(row.id));
    const radioSchedule=row.main_category==='미디어'&&row.sub_category==='라디오'&&radioReview?.signature===signature(row)?radioSchedules.get(radioReview.scheduleId):null;
    const webReview=webByRecord.get(String(row.id));
    const webEpisode=row.main_category==='미디어'&&row.sub_category==='웹예능/웹컨텐츠'&&webReview?.signature===signature(row)?webEpisodes.get(webReview.episodeId):null;
    const performance=performanceFor(row,source,tags);
    if(performance)tags=[...new Set([...tags,...(performance.tags||[]).map(label=>'활동:'+label)])];
    return {...row,archiveSignature:originalSignature,archiveOccurredOn:row.occurred_on,occurred_on:corrected?corrected.date:row.occurred_on,dateCorrection:corrected||null,wikiTags:tags,people:curation.people,displayTitle:title,performance,radioSchedule,webEpisode,
      reviewedVideoId:source?.videoId,sources:(source?.sources||[]).map(id=>sourceIndex.get(id)).filter(Boolean),
      searchText:compact([row.title,title,row.account,performance?.title,performance?.venue,radioSchedule?.title,radioSchedule?.station,webEpisode?.title,webEpisode?.channel,...(row.keywords||[]),row.main_category,row.sub_category,row.occurred_on,...tags,...curation.people].join(' '))};
  }
  function chronological(a,b){
    const day=String(a.occurred_on).localeCompare(String(b.occurred_on));
    if(day)return day;
    const post=row=>String(row.source_url||'').match(/\/(?:status|statuses)\/(\d+)/)?.[1];
    const first=post(a),second=post(b);
    return String(first||a.id).padStart(24,'0').localeCompare(String(second||b.id).padStart(24,'0'))||Number(a.id)-Number(b.id);
  }
  function sort(rows){return rows.sort(chronological);}
  const snapshotReady=Promise.all([fetch('./archive-data.json').then(response=>{if(!response.ok)throw new Error('기록을 불러오지 못했습니다.');return response.json();}),fetch('./archive-additions.json').then(response=>{if(!response.ok)throw new Error('추가 기록을 불러오지 못했습니다.');return response.json();})]).then(([data,additions])=>({...data,records:[...new Map([...additions.records,...data.records].map(row=>[Number(row.id),row])).values()]}));
  const ready=Promise.all([snapshotReady,sourceReady,performanceReady,previewReady,dateReady,radioReady,webReady,coupleReady]).then(([data,sources,events,_previews,_dates,radio,web])=>{
    webEpisodes=new Map(web.episodes.map(item=>[item.id,item]));
    webByRecord=new Map(Object.entries(web.records));
    radioSchedules=new Map(radio.schedules.map(item=>[item.id,item]));
    radioByRecord=new Map(Object.entries(radio.records));
    sourceData=sources;sourceIndex=new Map(sources.sources.map(item=>[item.id,item]));
    performances=new Map(events.map(event=>[event.id,event]));
    performancesByDay=Map.groupBy(events,event=>event.date);
    performancesByRelatedRecord=new Map();
    for(const event of events)for(const id of Object.keys(event.relatedDates)){
      if(!performancesByRelatedRecord.has(id))performancesByRelatedRecord.set(id,[]);
      performancesByRelatedRecord.get(id).push(event);
    }
    aliases=data.aliases;excluded=new Set(data.excludedIds.map(Number));
    reviewed=new Map(data.records.map(row=>[Number(row.id),{signature:signature(row),tags:row.wikiTags,people:row.people}]));
    records=sort(data.records.filter(include).map(hydrate));
  });
  async function query(predicate=()=>true,{offset=0,limit=60}={}){
    await ready;const found=records.filter(predicate);return {rows:found.slice(offset,offset+limit),total:found.length,hasMore:offset+limit<found.length};
  }
  const searchQueryCache=new Map();
  function searchTerms(query){
    const key=String(query||'').trim();
    if(!searchQueryCache.has(key)){
      const terms=key.split(/\s+/u).filter(Boolean).map(term=>[...new Set([compact(term),compact(normalized(term))])].filter(Boolean)).filter(forms=>forms.length);
      if(searchQueryCache.size>=64)searchQueryCache.delete(searchQueryCache.keys().next().value);
      searchQueryCache.set(key,terms);
    }
    return searchQueryCache.get(key);
  }
  function includesTerms(text,query){return searchTerms(query).every(forms=>forms.some(term=>text.includes(term)));}
  function contains(text,query){return includesTerms(compact(text)+'\n'+compact(normalized(text)),query);}
  function searchMatches(row,query){return includesTerms(row.searchText,query);}
  function categoryMatches(row,node){
    if(node.mains&&!node.mains.includes(row.main_category))return false;
    if(node.series)return row.performance?.series.includes(node.series)||false;
    if(node.tag)return row.wikiTags.includes(node.tag);
    if(node.album)return row.wikiTags.includes('앨범:'+node.title);
    if(node.subs){
      return node.subs.some(sub=>sub===row.sub_category||(sub==='팬싸인회'&&row.sub_category==='팬사인회'));
    }
    return node.terms?.some(term=>searchMatches(row,term))||false;
  }
  async function refresh(config){
    await ready;
    if(refreshing)return refreshing;
    if(Date.now()-lastRefresh<120000)return;
    refreshing=(async()=>{
      const get=async offset=>{
        const params=new URLSearchParams({select:'id,title,occurred_on,main_category,sub_category,keywords,source_url,account',order:'id.asc',offset:String(offset),limit:'1000'});
        const response=await fetch(config.url+'?'+params,{headers:{...config.headers,Prefer:'count=exact'},signal:AbortSignal.timeout(15000)});
        if(!response.ok)throw new Error('Archive refresh failed');
        return {rows:await response.json(),total:Number((response.headers.get('content-range')||'').split('/')[1])};
      };
      const first=await get(0);if(!Number.isFinite(first.total)||first.total<first.rows.length)throw new Error('Invalid archive count');
      const all=[...first.rows];
      for(let offset=1000;offset<first.total;offset+=3000){
        const offsets=[offset,offset+1000,offset+2000].filter(value=>value<first.total);
        const pages=await Promise.all(offsets.map(get));
        if(pages.some(page=>page.total!==first.total))throw new Error('Archive changed during refresh');
        all.push(...pages.flatMap(page=>page.rows));
      }
      if(all.length!==first.total||new Set(all.map(row=>row.id)).size!==first.total)throw new Error('Incomplete refresh');
      records=sort(all.filter(include).map(hydrate));lastRefresh=Date.now();
    })().finally(()=>{refreshing=null;});
    return refreshing;
  }
  return {ready,sourceReady,collection:id=>id==='couple-live'?coupleLive:null,query,normalized,contains,searchMatches,categoryMatches,refresh,chronological,
    sources:()=>sourceData.sources,source:id=>sourceIndex.get(id),performance:id=>performances.get(id),radioSchedule:id=>radioSchedules.get(id),webEpisode:id=>webEpisodes.get(id),tweetPreview:id=>Object.hasOwn(tweetPreviews,id)?tweetPreviews[id]:null};
})();
