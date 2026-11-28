const {createHmac,randomBytes,randomUUID,scrypt,timingSafeEqual}=require('node:crypto');
const {promisify}=require('node:util');
const derive=promisify(scrypt);
const origins=new Set(['https://hq-index.vercel.app','https://hyeopkwae-wiki.pentagram1031.chatgpt.site']);
const blob=()=>require('@vercel/blob');
const options=()=>({access:'private',addRandomSuffix:false,contentType:'application/json',cacheControlMaxAge:60});
const fail=(status,message)=>Object.assign(new Error(message),{status});
function day(){return new Date(Date.now()+9*3600000).toISOString().slice(0,10);}
function identity(req,scope){return createHmac('sha256',process.env.BLOB_READ_WRITE_TOKEN).update(scope+'|'+(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0]+'|'+String(req.headers['user-agent']||'').slice(0,300)).digest('hex').slice(0,32);}
async function read(path){const file=await blob().get(path,{access:'private',useCache:false});return file?.statusCode===200?new Response(file.stream).json():null;}
function exists(error){return /already exists/i.test(error.message)||error.name==='BlobAlreadyExistsError';}
async function reserve(req,scope,period,slots){
 const key=identity(req,scope),bucket=Math.floor(Date.now()/period);
 for(let i=0;i<slots;i++)try{await blob().put(`limits/${scope}/${bucket}-${key}-${i}.json`,'{}',{...options(),ttlDays:1});return;}catch(error){if(!exists(error))throw error;}
 throw fail(429,'요청이 많습니다. 잠시 후 다시 시도해 주세요.');
}
function input(req){
 if(Number(req.headers['content-length']||0)>16000)throw fail(413,'내용이 너무 깁니다.');
 if(!String(req.headers['content-type']||'').startsWith('application/json'))throw fail(415,'JSON 형식으로 요청해 주세요.');
 let data=req.body;if(typeof data==='string'){if(Buffer.byteLength(data)>16000)throw fail(413,'내용이 너무 깁니다.');try{data=JSON.parse(data);}catch{throw fail(400,'요청 내용을 확인해 주세요.');}}
 if(!data||typeof data!=='object'||Array.isArray(data))throw fail(400,'요청 내용을 확인해 주세요.');return data;
}
function password(value){if(typeof value!=='string'||value.length<6||value.length>100)throw fail(400,'비밀번호는 6~100자로 입력해 주세요.');return value;}
function publicPost(item){return {id:item.id,name:item.name,text:item.isPrivate?'':item.text,isPrivate:item.isPrivate===true,createdAt:item.createdAt};}
async function guestbook(req,res,params){
 if(req.method==='GET'){
  const cursor=params.get('cursor')||undefined;if(cursor&&cursor.length>1000)throw fail(400,'목록 주소를 확인해 주세요.');
  const result=await blob().list({prefix:'guestbook/posts/',limit:20,cursor});
  const items=await Promise.all(result.blobs.map(file=>read(file.pathname)));
  return res.status(200).json({items:items.filter(Boolean).map(publicPost),cursor:result.hasMore?result.cursor:null});
 }
 const data=input(req);
 if(req.method==='POST'&&data.action!=='read'){
  if(data.action!==undefined)throw fail(400,'요청 내용을 확인해 주세요.');
  if(data.isPrivate!==undefined&&typeof data.isPrivate!=='boolean')throw fail(400,'공개 여부를 확인해 주세요.');
  if(data.website)throw fail(400,'등록할 수 없습니다.');
  const name=typeof data.name==='string'?data.name.trim():'',text=typeof data.text==='string'?data.text.trim():'';
  if(name.length>30||!text||text.length>3000)throw fail(400,'이름은 30자, 문의 내용은 1~3,000자로 입력해 주세요.');
  const pass=password(data.password);await reserve(req,'post',60000,1);
  const salt=randomBytes(16).toString('hex'),hash=(await derive(pass,salt,64)).toString('hex');
  const id=String(9999999999999-Date.now()).padStart(13,'0')+'-'+randomUUID();
  const post={id,name:name||'익명',text,isPrivate:data.isPrivate===true,createdAt:new Date().toISOString(),salt,hash};
  await blob().put('guestbook/posts/'+id+'.json',JSON.stringify(post),options());
  return res.status(201).json({item:publicPost(post)});
 }
 if(req.method==='DELETE'||(req.method==='POST'&&data.action==='read')){
  if(typeof data.id!=='string'||!/^\d{13}-[a-f0-9-]{36}$/.test(data.id))throw fail(400,'글 주소를 확인해 주세요.');
  const pass=password(data.password);await reserve(req,'post-access',300000,5);
  const path='guestbook/posts/'+data.id+'.json',post=await read(path);
  if(!post)throw fail(404,'이미 삭제되었거나 없는 글입니다.');
  const actual=await derive(pass,post.salt,64),expected=Buffer.from(post.hash,'hex');
  if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw fail(403,'비밀번호가 맞지 않습니다.');
  if(req.method==='POST')return res.status(200).json({item:{...publicPost(post),text:post.text}});
  await blob().del(path);return res.status(200).json({deleted:true});
 }
 throw fail(405,'지원하지 않는 요청입니다.');
}
function contentPath(value){
 if(typeof value!=='string'||value.length>500)return false;
 try{return /^#\/(video|record|source|radio|web|performance)\/[^/?#]+$/.test(decodeURIComponent(value));}catch{return false;}
}
function checkedPage(data){
 if(!contentPath(data.path))throw fail(400,'콘텐츠 상세 페이지만 집계합니다.');
 if(typeof data.title!=='string'||!data.title.trim()||data.title.length>200)throw fail(400,'콘텐츠 제목을 확인해 주세요.');
 return {path:data.path,title:data.title.trim()};
}
// Popularity snapshots are shared by concurrent requests in this Function instance.
// The public CDN shares them across instances; writes never force a fresh scan.
const rankingTtl=3*60*60*1000;
let rankingCache=null,rankingPending=null;
function cacheSeconds(now=Date.now()){
 const nextMidnight=Math.floor((now+9*3600000)/86400000)*86400000+86400000-9*3600000;
 return Math.max(1,Math.floor(Math.min(rankingTtl,nextMidnight-now)/1000));
}
async function scanPopularity(){
 const counts=new Map();let partial=false,cursor;
 const today=day(),firstDay=new Date(Date.now()+9*3600000-6*86400000).toISOString().slice(0,10);
 // All recent dates share one listing instead of seven separate daily listings.
 for(let page=0;page<20;page++){
  const result=await blob().list({prefix:'views/',limit:1000,cursor});
  for(const file of result.blobs){
   const parts=file.pathname.split('/'),date=parts[1],encoded=parts[2];
   if(!date||date<firstDay||date>today||!encoded)continue;
   const path=Buffer.from(encoded,'base64url').toString('utf8');
   if(!contentPath(path))continue;
   const entry=counts.get(encoded)||{count:0,file:file.pathname};entry.count++;counts.set(encoded,entry);
  }
  if(!result.hasMore)break;cursor=result.cursor;if(page===19)partial=true;
 }
 const top=[...counts.entries()].sort((a,b)=>b[1].count-a[1].count||a[0].localeCompare(b[0])).slice(0,10);
 const items=(await Promise.all(top.map(async([,entry])=>{const page=await read(entry.file);if(!page)return null;return {...checkedPage(page),views:entry.count};}))).filter(Boolean);
 return {items,period:'7일',partial};
}
async function popularitySnapshot(){
 const now=Date.now(),today=day();
 if(rankingCache?.day===today&&rankingCache.until>now)return rankingCache;
 if(rankingPending?.day===today)return rankingPending.promise;
 const pending={day:today};
 pending.promise=scanPopularity().then(data=>{
  // Cache only successful, complete responses; failed reads can be retried.
  const snapshot={data,day:today,until:now+cacheSeconds(now)*1000};
  if(!data.partial)rankingCache=snapshot;
  return snapshot;
 }).finally(()=>{if(rankingPending===pending)rankingPending=null;});
 rankingPending=pending;return pending.promise;
}
async function popular(req,res){
 if(req.method==='POST'){
  const page=checkedPage(input(req)),date=day(),visitor=identity(req,date),encoded=Buffer.from(page.path).toString('base64url');
  try{await blob().put(`views/${date}/${encoded}/${visitor}.json`,JSON.stringify(page),{...options(),ttlDays:8});}catch(error){if(!exists(error))throw error;}
  return res.status(200).json({counted:true});
 }
 if(req.method!=='GET')throw fail(405,'지원하지 않는 요청입니다.');
 const snapshot=await popularitySnapshot();
 const seconds=Math.max(1,Math.floor((snapshot.until-Date.now())/1000));
 if(!snapshot.data.partial){
  // Ranking data is public. A stable URL and origin-independent response let
  // both wiki domains reuse one CDN entry without sharing guestbook responses.
  res.setHeader('Access-Control-Allow-Origin','*');res.removeHeader?.('Vary');
  res.setHeader('Cache-Control',`public, max-age=${Math.min(300,seconds)}, s-maxage=${seconds}`);
  res.setHeader('Vercel-CDN-Cache-Control',`public, s-maxage=${seconds}`);
 }
 return res.status(200).json(snapshot.data);
}

module.exports=async function community(req,res,kind){
 const origin=req.headers.origin;
 if(origin&&origins.has(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
 res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(origin&&!origins.has(origin))return res.status(403).json({error:'허용되지 않은 요청입니다.'});
 if(req.method==='OPTIONS')return res.status(204).end();
 if(!process.env.BLOB_READ_WRITE_TOKEN)return res.status(503).json({error:'잠시 후 다시 이용해 주세요.'});
 try{const params=new URL(req.url,'https://hq-index.vercel.app').searchParams;return kind==='guestbook'?await guestbook(req,res,params):await popular(req,res);}
 catch(error){if(!error.status)console.error('Community request failed',error.name);return res.status(error.status||503).json({error:error.status?error.message:'잠시 후 다시 시도해 주세요.'});}
};
