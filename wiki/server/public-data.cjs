// Only the two existing public read views are exposed; credentials stay server-side.
const views={
  archive:{table:'hq_archive_public',columns:['id','title','occurred_on','main_category','sub_category','keywords','source_url','account']},
  videos:{table:'recommended_videos',columns:['id','youtube_id','youtube_url','title','published_at','thumbnail_url','categories','channel_title','is_active']}
};
module.exports=async function publicData(req,res,feed){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Prefer');
  res.setHeader('Access-Control-Expose-Headers','Content-Range');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD, OPTIONS');return res.status(405).json({error:'Read only'});}
  const key=process.env.WIKI_SUPABASE_ANON_KEY;
  if(!key)return res.status(503).json({error:'Data unavailable'});
  const view=views[feed],params=new URL(req.url,'https://hq-index.vercel.app').searchParams;
  // Vercel's authenticated fetch may append deployment-access metadata.
  params.delete('x-vercel-protection-bypass');params.delete('x-vercel-set-bypass-cookie');
  const selected=(params.get('select')||view.columns.filter(c=>c!=='is_active').join(',')).split(',');
  if(selected.some(c=>!view.columns.includes(c)))return res.status(400).json({error:'Invalid fields'});
  const allowed=new Set(['select','order','offset','limit',...view.columns]);
  for(const name of [...params.keys()])if(!allowed.has(name))params.delete(name);
  const limit=params.get('limit')||'1000',offset=params.get('offset')||'0';
  if(!/^\d+$/.test(limit)||Number(limit)<1||Number(limit)>1000||!/^\d+$/.test(offset)||Number(offset)>1000000)return res.status(400).json({error:'Invalid range'});
  params.set('limit',limit);params.set('offset',offset);params.set('select',selected.join(','));
  if(params.has('order')&&params.get('order').split(',').some(term=>!view.columns.includes(term.split('.')[0])||!/^\w+\.(asc|desc)(\.nulls(first|last))?$/.test(term)))return res.status(400).json({error:'Invalid order'});
  if(feed==='videos')params.set('is_active','eq.true');
  try{
    const upstream=await fetch('https://aiuwbwtknaceghkzporx.supabase.co/rest/v1/'+view.table+'?'+params,{method:req.method,headers:{apikey:key,Authorization:'Bearer '+key,Prefer:'count=exact'},signal:AbortSignal.timeout(12000)});
    if(!upstream.ok){console.error('Public data upstream status',upstream.status);return res.status(502).json({error:'Data unavailable'});}
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=300');
    const count=upstream.headers.get('content-range');if(count)res.setHeader('Content-Range',count);
    return res.status(upstream.status).send(req.method==='HEAD'?'':await upstream.text());
  }catch(error){console.error('Public data request failed',error.name);return res.status(502).json({error:'Data unavailable'});}
};
