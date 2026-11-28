window.WIKI_VIDEOS=(()=>{
  let videos=[],curated=[],official={metadata:{},videos:[]},vlive={metadata:{},videos:[]},external={videos:[]},links={},dateCache=new Map(),recordCache=new Map(),lastRefresh=0,index;
  const compact=value=>String(value||'').toLowerCase().replace(/[\s:：·.?!()\[\]_-]/g,'');
  const dateKst=value=>{if(!value)return '';if(!dateCache.has(value))dateCache.set(value,new Date(value).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}));return dateCache.get(value);};
  function setVideos(rows){
    const combined=new Map([...curated,...official.videos,...vlive.videos,...external.videos].map(video=>[video.youtube_id,video]));
    for(const video of rows)combined.set(video.youtube_id,video);
    for(const video of external.videos)combined.set(video.youtube_id,{...combined.get(video.youtube_id),...video});
    videos=[...combined.values()].map(video=>{const meta=official.metadata[video.youtube_id]||vlive.metadata[video.youtube_id];return meta?{...video,published_at:meta.publishedAt,official_metadata:meta,categories:[...new Set([...(video.categories||[]),...(meta.isShort?['쇼츠']:[])])]}:video;});index=window.WIKI_VIDEO_MATCHER.create(videos);
    recordCache.clear();
  }
  const ready=Promise.all([fetch('./videos.json').then(r=>{if(!r.ok)throw new Error('영상 목록을 불러오지 못했습니다.');return r.json();}),fetch('./video-links.json').then(r=>{if(!r.ok)throw new Error('영상 연결을 불러오지 못했습니다.');return r.json();}),window.WIKI_STORE.sourceReady,fetch('./official-video-evidence.json').then(r=>r.ok?r.json():{metadata:{},videos:[]}),fetch('./vlive-video-evidence.json').then(r=>r.ok?r.json():{metadata:{},videos:[]}),fetch('./external-video-evidence.json').then(r=>r.ok?r.json():{videos:[]})]).then(([data,mapping,review,evidence,vliveEvidence,externalEvidence])=>{official=evidence;vlive=vliveEvidence;external=externalEvidence;curated=review.videos;links={...mapping.links,...external.userConfirmedLinks};setVideos(data.videos);});
  function byCategory(node){
    if(node.collection){const ids=new Set(window.WIKI_STORE.collection(node.collection)?.videoIds||[]);return videos.filter(video=>ids.has(video.youtube_id));}
    const requested=[node.title,...(node.subs||[])].map(compact);
    const synonyms={recording:['레코딩로그'],seunghyub:['승협이','하기','소작실'], 'day-end':['하루의마무리','하루의마무리쇼츠'],practice:['합주일지'],mv:['뮤직비디오'],shorts:['쇼츠'],making:['메이킹','코멘터리필름'], 'summer-camp':['승캠'], 'our-talk':['우리얘기좀합시다']};
    const terms=[...requested,...(synonyms[node.id]||[])];
    if(node.id==='official-youtube')return videos.filter(video=>video.channel_title==='N.Flying (엔플라잉)');
    if(node.id==='seunghyub')return videos.filter(video=>video.channel_title==='승협이');
    return videos.filter(video=>(video.categories||[]).some(tag=>terms.includes(compact(tag))));
  }
  function forRecord(row){
    if(!index)return null;
    const signatureNow=row.archiveSignature||JSON.stringify([row.title,row.occurred_on,row.main_category,row.sub_category]);
    // A user-confirmed episode applies only to these exact archived records.
    // It links the original category without reclassifying the source record.
    const confirmed=links[row.id];
    if(confirmed?.basis==='user_confirmed_broadcast'&&confirmed.signature===signatureNow&&index.byId.has(confirmed.videoId))return confirmed.videoId;
    if(!index.eligible(row))return null;
    const blocked=new Set([official.blocks?.[row.id],vlive.blocks?.[row.id]].filter(block=>block&&(!block.signature||block.signature===signatureNow)).flatMap(block=>block.videoIds));
    const accepted=id=>!blocked.has(id)&&index.accepts(row,index.byId.get(id));
    if(row.reviewedVideoId&&accepted(row.reviewedVideoId))return row.reviewedVideoId;
    const mapped=links[row.id];
    if(mapped&&accepted(mapped.videoId)&&(!mapped.signature||mapped.signature===(row.archiveSignature||JSON.stringify([row.title,row.occurred_on,row.main_category,row.sub_category]))))return mapped.videoId;
    const signature=[row.id,row.title,row.source_url,row.occurred_on,row.sub_category,row.main_category].join('|');
    if(recordCache.has(signature))return recordCache.get(signature);
    const automatic=index.match(row)?.videoId;
    const result=(accepted(automatic)?automatic:null)||row.sources?.find(source=>source.videoId&&accepted(source.videoId))?.videoId||null;
    recordCache.set(signature,result);return result;
  }
  async function refresh(config){
    await ready;
    if(Date.now()-lastRefresh<120000)return;
    lastRefresh=Date.now();
    const fresh=[];
    for(let offset=0;;offset+=1000){
      const params=new URLSearchParams({select:'id,youtube_id,youtube_url,title,published_at,thumbnail_url,categories,channel_title',is_active:'eq.true',order:'published_at.desc.nullslast,id.asc',offset:String(offset),limit:'1000'});
      const response=await fetch(config.url+'?'+params,{headers:config.headers,signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error('Video refresh failed');
      const page=await response.json();fresh.push(...page);if(page.length<1000)break;
    }
    setVideos(fresh);
  }
  return {ready,byCategory,forRecord,dateKst,broadcastDate:id=>index?.byId.get(id)?.broadcastDate||null,get:id=>videos.find(video=>video.youtube_id===id),all:()=>videos,refresh};
})();
