// The source video's upload date and an explicitly dated archived broadcast
// are distinct. Matching never changes either date.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.WIKI_VIDEO_MATCHER=factory();})(globalThis,()=>{
  const compact=value=>String(value||'').toLowerCase().replace(/[^가-힣a-z0-9]/g,'');
  const kst=value=>value?new Date(value).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}):'';
  function titleDate(value){
    const text=String(value||'');
    const match=text.match(/^\s*(?:\[[^\]]+\]\s*)?(?:(20\d{2})[-./]?(\d{2})[-./]?(\d{2})|(\d{2})(\d{2})(\d{2}))(?=[\s\[({]|$)/);
    if(!match)return null;
    const date=match[1]?`${match[1]}-${match[2]}-${match[3]}`:`20${match[4]}-${match[5]}-${match[6]}`;
    return !Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date?date:null;
  }
  function canonical(value){
    const key=compact(value);
    const aliases={'하루의마무리쇼츠':'하루의마무리쇼츠','승구리당당수다당':'승구리당당','인스타라이브':'인스타그램라이브','웹예능':'웹예능웹컨텐츠','웹예능웹컨텐츠':'웹예능웹컨텐츠','커버':'커버곡'};
    return aliases[key]||key;
  }
  function nonVideoHeader(row){return /^\s*\d{6}\s*(?:🦊|🐰)?\s*(?:인스타그램(?!\s*(?:라이브|라방))|트위터|인별\s*(?:스토리|게시글)|버블|프롬|공카|공식\s*카페)/i.test(String(row.title||'').split('\n')[0]);}
  function inferredCategories(video){
    const text=String(video.title||''),key=compact(text);
    if(key.includes('우리얘기좀합시다'))return ['우리 얘기 좀 합시다'];
    if(key.includes('하루의마무리'))return ['하루의마무리'];
    if(key.includes('승구리당당'))return ['승구리당당수다당'];
    if(/김[.\s]*보[.\s]*라|김[.\s]*라|김재현의.*(?:라디오|라이브)/.test(text))return ['김재현의 라디오'];
    if(/recording\s*log|레코딩\s*로그/i.test(text))return ['레코딩로그'];
    if(/\bbehind\b|비하인드/i.test(text)&&!/\bmaking\b|메이킹/i.test(text))return ['비하인드'];
    if(/\bmaking\b|메이킹/i.test(text)&&!/\bbehind\b|비하인드/i.test(text))return ['메이킹'];
    if(/(?:\bMV\b|M\/V|뮤직비디오).*TEASER|MV\s*티저/i.test(text))return ['티저'];
    if(/\bMV\b|M\/V|뮤직비디오/i.test(text))return ['뮤직비디오'];
    if(/special\s*clip|스페셜\s*클립/i.test(text))return ['스페셜클립'];
    if(/합주일지/.test(text))return ['합주일지'];
    if(/#shorts\b/i.test(text))return ['쇼츠'];
    return [];
  }
  function create(videos){
    const byId=new Map(),byDate=new Map(),byLiveDate=new Map(),titles=[];
    for(const video of videos){
      const uploadDate=kst(video.published_at);
      const datedDayEnd=video.channel_title==='유회승 Yoo Hwe Seung'&&/하루의\s*마무리/.test(video.title)&&String(video.title).match(/(20\d{2})[.]([01]\d)[.]([0-3]\d)\s*하루의\s*마무리/);
      const embeddedArchivedDate=String(video.channel_title||'').includes('V Live')&&String(video.title).match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
      const verifiedBroadcastDate=/^20\d{2}-\d{2}-\d{2}$/.test(video.broadcast_date||'')?video.broadcast_date:null;
      const broadcastDate=verifiedBroadcastDate||(datedDayEnd?`${datedDayEnd[1]}-${datedDayEnd[2]}-${datedDayEnd[3]}`:titleDate(video.title)||(embeddedArchivedDate?`${embeddedArchivedDate[1]}-${embeddedArchivedDate[2]}-${embeddedArchivedDate[3]}`:null));
      const archived=String(video.channel_title||'').includes('V Live')||Boolean(datedDayEnd)||Boolean(verifiedBroadcastDate);
      const effectiveDate=archived&&broadcastDate?broadcastDate:uploadDate;
      const meta={video,broadcastDate:archived?broadcastDate:null,uploadDate,date:effectiveDate,tags:new Set([...(video.categories||[]),...inferredCategories(video)].map(canonical))};
      // Live completion just after midnight can belong to the previous evening.
      const utcDay=String(video.published_at||'').slice(0,10);
      const hour=video.published_at?new Date(video.published_at).getUTCHours():-1;
      if(!archived&&video.channel_title==='N.Flying (엔플라잉)'&&meta.tags.has(canonical('우리 얘기 좀 합시다'))&&utcDay!==uploadDate&&hour>=15&&hour<21){
        if(!byLiveDate.has(utcDay))byLiveDate.set(utcDay,[]);byLiveDate.get(utcDay).push(meta);
      }
      byId.set(video.youtube_id,meta);
      // Reviewed external episodes must never claim unrelated same-day archive rows.
      if(video.manual_only)continue;
      if(!byDate.has(effectiveDate))byDate.set(effectiveDate,[]);byDate.get(effectiveDate).push(meta);
      const title=compact(String(video.title||'').replace(/^\s*\d{6,8}\s*/,''));
      if(title.length>=8)titles.push({title,meta});
    }
    function compatible(row,meta){
      const header=String(row.title||'').split('\n')[0],name=String(meta.video.title||'');
      const intro=header.replace(/^\s*\d{6,8}\s*/, '');
      const declared=!/^[🦊🐰🐶🐱🐭💬👤]/u.test(intro)&&(/여슩캠|여름승협캠프|여슩컘/.test(intro)?'승캠':/김[.\s]*보[.\s]*라|김[.\s]*라|김[.\s]*ㄹ[.\s]*ㅏ/.test(intro)?'김재현의 라디오':null);
      if(meta.video.channel_title==='엔플라잉V Live'&&declared&&!meta.tags.has(canonical(declared)))return false;
      if(row.main_category==='유튜브'){
        if(/티저|teaser/i.test(header)&&!/TEASER|PREVIEW|티저/i.test(name))return false;
        if(/메들리|하라메|하이라이트/i.test(header)&&!/MEDLEY|메들리|HIGHLIGHT|하이라이트/i.test(name))return false;
        if(/뮤비|뮤직비디오|\bMV\b/i.test(header)&&!/MV|M\/V|MUSIC VIDEO|뮤직비디오/i.test(name))return false;
      }
      const sub=canonical(row.sub_category),video=meta.video;
      if(sub&&meta.tags.has(sub))return true;
      if(row.main_category==='라이브'&&['단체 라이브','개인 라이브','기타 라이브'].includes(row.sub_category)&&video.channel_title==='엔플라잉V Live'&&!meta.tags.has(canonical('메이킹'))&&!meta.tags.has(canonical('커버곡')))return true;
      if(row.main_category==='라이브'&&row.sub_category==='단체 라이브'&&video.channel_title==='N.Flying (엔플라잉)'&&video.official_metadata?.isLiveContent)return true;
      if(row.main_category==='유튜브'&&row.sub_category==='뮤직비디오'&&/MV|M\/V|MUSIC VIDEO|HIGHLIGHT MEDLEY|TRACK VIDEO/i.test(video.title)&&!/MAKING|BEHIND|COMMENTARY/i.test(video.title))return true;
      if(row.main_category==='유튜브'&&row.sub_category==='스페셜클립'&&/HIGHLIGHT MEDLEY|하이라이트\s*메들리/i.test(video.title))return true;
      if(row.sub_category==='비하인드'&&video.channel_title==='N.Flying (엔플라잉)'&&/let's roll.*우리 만나서|FOREST OF 2RAVELERS.*Episode/i.test(video.title))return true;
      if(row.sub_category==='스페셜클립'&&meta.tags.has('라이브클립')&&!meta.tags.has('쇼츠'))return true;
      if(row.main_category==='라이브'&&row.sub_category==='단체 라이브'&&(meta.tags.has(canonical('우리 얘기 좀 합시다'))||meta.tags.has('단체라이브')))return true;
      if(row.main_category==='라이브'&&row.sub_category==='개인 라이브'&&String(video.channel_title).includes('V Live')&&/내 마음이 들리니/.test(video.title))return true;
      if(row.sub_category==='승협이'&&video.channel_title==='승협이')return true;
      if(row.sub_category==='승협_인스타그램 브이로그'&&video.channel_title==='승협이'&&meta.tags.has('인스타브이로그'))return true;
      if(row.sub_category==='승협이 라이브'&&video.channel_title==='승협이'&&meta.tags.has('라이브'))return true;
      if(row.sub_category==='개인 라이브'&&meta.tags.has('개인라이브'))return true;
      return false;
    }
    function eligible(row){return ['유튜브','라이브','미디어'].includes(row.main_category);}
    function accepts(row,meta){
      if(!meta||!eligible(row))return false;
      if(row.main_category==='미디어')return true;
      if(row.main_category==='유튜브')return !['우리 얘기 좀 합시다','하루의 마무리','승구리당당'].some(name=>meta.tags.has(canonical(name)))||compatible(row,meta);
      if(compatible(row,meta))return true;
      if(['단체 라이브','개인 라이브','기타 라이브'].includes(row.sub_category)&&String(meta.video.channel_title||'').includes('V Live'))return true;
      return false;
    }
    function match(row){
      if(!eligible(row))return null;
      const text=[row.source_url,row.title].join(' ');
      const ids=[...text.matchAll(/(?:youtu\.be\/|youtube\.com\/(?:watch\?[^\s]*?v=|shorts\/|live\/|embed\/))([-\w]{11})(?![-\w])/g)].map(m=>m[1]).filter(id=>accepts(row,byId.get(id)));
      const direct=[...new Set(ids)];
      if(direct.length===1)return {videoId:direct[0],basis:'direct_youtube_url'};
      if(direct.length>1)return {candidates:direct,basis:'multiple_explicit_videos'};
      const unclassified=(!row.main_category||row.main_category==='기타')&&(!row.sub_category||['미분류','기타','백업'].includes(row.sub_category));
      if(unclassified&&nonVideoHeader(row))return null;
      if(!unclassified&&!['유튜브','라이브','미디어'].includes(row.main_category))return null;
      const liveHeader=String(row.title||'').split('\n')[0];
      if(row.sub_category==='승협이 라이브'){
        const namedLive=[...byId.values()].filter(meta=>meta.video.channel_title==='승협이'&&meta.tags.has('라이브')&&compact(meta.video.title).length>=4&&compact(liveHeader).includes(compact(meta.video.title))&&[meta.uploadDate,String(meta.video.published_at||'').slice(0,10)].includes(row.occurred_on));
        if(namedLive.length===1)return {videoId:namedLive[0].video.youtube_id,basis:'explicit_live_title_and_publication_day'};
      }
      const onDate=[...new Map([...(byDate.get(row.occurred_on)||[]),...(row.main_category==='라이브'?(byLiveDate.get(row.occurred_on)||[]):[])].map(meta=>[meta.video.youtube_id,meta])).values()];
      const normalized=compact(row.displayTitle||row.title);
      const named=titles.filter(item=>normalized.includes(item.title)&&item.meta.date===row.occurred_on&&compatible(row,item.meta));
      if(named.length===1)return {videoId:named[0].meta.video.youtube_id,basis:'explicit_video_title_and_date'};
      const header=String(row.title||'').split('\n')[0].slice(0,120);
      const hints=[[/녹음\s*로그|레코딩\s*로그|recording\s*log/i,'레코딩로그'],[/승캠|승협캠프|여슩캠|여슩컘/,'승캠'],[/우리\s*얘기\s*좀\s*합시다|ㅜㅒ합|우얘합|ㅇㅇㅎ/,'우리 얘기 좀 합시다'],[/하루의\s*마무리/,'하루의마무리'],[/승구리당당|수다당/,'승구리당당수다당'],[/합주일지/,'합주일지'],[/만년썰전/,'만년썰전'],[/냉탕과온탕사이/,'냉탕과온탕사이']].filter(([pattern])=>pattern.test(header));
      if(hints.length===1){const hinted=onDate.filter(meta=>meta.tags.has(canonical(hints[0][1]))&&compatible(row,meta));if(hinted.length===1)return {videoId:hinted[0].video.youtube_id,basis:'explicit_program_header_and_date'};}
      if(unclassified)return {candidates:[],basis:'unclassified_without_explicit_video_evidence'};
      let candidates=onDate.filter(meta=>compatible(row,meta));
      if(!candidates.length&&row.main_category==='라이브'&&row.sub_category==='단체 라이브')candidates=onDate.filter(meta=>String(meta.video.channel_title||'').includes('V Live')&&!(meta.video.categories||[]).length&&!inferredCategories(meta.video).length);
      if(!candidates.length&&['유튜브','라이브'].includes(row.main_category)){
        candidates=[...byId.values()].filter(meta=>!meta.video.manual_only&&['N.Flying (엔플라잉)','FNCEnt'].includes(meta.video.channel_title)&&compatible(row,meta)&&!(row.sub_category==='단체 라이브'&&meta.tags.has(canonical('우리 얘기 좀 합시다')))&&Math.abs(Date.parse(meta.date)-Date.parse(row.occurred_on))===86400000);
      }
      // Full episodes and promotional shorts may share a series and upload day.
      if(row.sub_category!=='쇼츠'&&candidates.some(meta=>!meta.tags.has('쇼츠')))candidates=candidates.filter(meta=>!meta.tags.has('쇼츠'));
      const episode=header.match(/#\s*(\d+(?:-\d+)?)(?![\d-])/);
      if(episode&&candidates.length>1){const exact=candidates.filter(meta=>meta.video.title.match(/#\s*(\d+(?:-\d+)?)(?![\d-])/)?.[1]===episode[1]);if(exact.length===1)candidates=exact;}
      if(candidates.length===1){const meta=candidates[0];return {videoId:meta.video.youtube_id,basis:meta.date!==row.occurred_on?'adjacent_day_same_archive_category':meta.broadcastDate&&meta.date!==meta.uploadDate?'explicit_broadcast_date_and_category':'unique_category_and_publication_date'};}
      return {candidates:candidates.map(meta=>meta.video.youtube_id),basis:candidates.length?'ambiguous_video':'no_matching_video'};
    }
    return {match,byId,byDate,compatible,eligible,accepts};
  }
  return {create,canonical,titleDate,inferredCategories,nonVideoHeader};
});
