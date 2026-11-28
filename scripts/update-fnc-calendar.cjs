// Scrape N.Flying's official FNC schedule into wiki/dist/calendar-schedules.json,
// the single source both the wiki calendar and the archive calendar read.
// Usage: node scripts/update-fnc-calendar.cjs [YYYY-MM ...]
//   With no months, checks the previous month through three months ahead and
//   stops adding future months once an empty month is reached.
const fs=require('node:fs'),path=require('node:path');
const FILE=path.resolve(__dirname,'../wiki/dist/calendar-schedules.json');
const BASE='https://www.fncent.com/?m=bbs&bid=schedule&mod=list&r=NFLYING';
const decode=text=>text.replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(n)).replace(/&quot;/g,'"').replace(/&#039;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const pad=n=>String(n).padStart(2,'0');
async function day(y,m,d){
 const response=await fetch(`${BASE}&year=${y}&month=${m}&day=${pad(d)}`,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(`FNC ${y}-${m}-${d}: HTTP ${response.status}`);
 const html=await response.text(),detail=html.split('class="schedule_detail"')[1];
 if(!detail)throw new Error(`FNC ${y}-${m}-${d}: no schedule detail`);
 const shown=detail.match(/cFont02">([\d.]+)</)?.[1];
 if((shown||'').split('.').map(Number).join('-')!==`${y}-${m}-${d}`)throw new Error(`FNC ${y}-${m}-${d}: page shows ${shown}`);
 const list=detail.split('</ul>')[0];
 return [...list.matchAll(/schedule_icon(\d+)_2\.gif[\s\S]*?<p>([\s\S]*?)<\/p>/g)].map(([,icon,title])=>({title:decode(title.replace(/<[^>]+>/g,'')).replace(/\s+/g,' ').trim(),icon}));
}
async function month(y,m){
 const days=[];
 for(let d=1;d<=new Date(y,m,0).getDate();d++)days.push({date:`${y}-${pad(m)}-${pad(d)}`,url:`${BASE}&year=${y}&month=${m}&day=${d}`,events:await day(y,m,d)});
 return days;
}
(async()=>{
 const data=JSON.parse(fs.readFileSync(FILE,'utf8')),byDate=new Map(data.days.map(entry=>[entry.date,entry]));
 const now=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Seoul'}));
 const explicit=process.argv.slice(2);
 const months=explicit.length?explicit:Array.from({length:5},(_,i)=>{const t=new Date(now.getFullYear(),now.getMonth()-1+i,1);return `${t.getFullYear()}-${pad(t.getMonth()+1)}`;});
 const checkedAt=new Date().toISOString();
 for(const key of months){
  const [y,m]=key.split('-').map(Number),days=await month(y,m),count=days.reduce((n,entry)=>n+entry.events.length,0);
  if(!explicit.length&&!count&&key>`${now.getFullYear()}-${pad(now.getMonth()+1)}`){console.log(`${key}: no schedules yet`);break;}
  for(const entry of days)byDate.set(entry.date,entry);
  data.completeMonths[key]=checkedAt;
  console.log(`${key}: ${count} schedules`);
 }
 data.days=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
 data.completeMonths=Object.fromEntries(Object.entries(data.completeMonths).sort(([a],[b])=>a.localeCompare(b)));
 data.fetchedAt=checkedAt;
 fs.writeFileSync(FILE,JSON.stringify(data));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
