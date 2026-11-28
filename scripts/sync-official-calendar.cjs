// Build the archive calendar snapshot from the wiki's reviewed official schedule links.
// Usage: node scripts/sync-official-calendar.cjs [wikiDistDir] [--live]
//   --live  refresh archive records from https://hq-index.vercel.app/api/archive first,
//           so records added after the wiki snapshot are linked too.
// Months already in public/official-calendar.json that were checked more recently than
// the wiki's calendar-schedules.json are kept, so a newer FNC scrape is never lost.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const args=process.argv.slice(2),live=args.includes('--live');
const wiki=path.resolve(args.find(arg=>!arg.startsWith('--'))||'../hq-wiki/.sites-checkout/dist');
const LIVE_API='https://hq-index.vercel.app/api/archive';
const localFetch=async file=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(wiki,file),'utf8'))});
const context=vm.createContext({window:{},Map,Set,URL,URLSearchParams,AbortSignal,Date,fetch:(url,options)=>/^https?:/.test(url)?fetch(url,options):localFetch(url)});
vm.runInContext(fs.readFileSync(path.join(wiki,'wiki-data.js'),'utf8'),context);
(async()=>{
 const store=context.window.WIKI_STORE;
 if(live)await store.refresh({url:LIVE_API,headers:{}});
 const {rows}=await store.query(()=>true,{limit:Infinity});
 const links=new Map();
 for(const row of rows)for(const [kind,item]of [['performance',row.performance],['radio',row.radioSchedule],['web',row.webEpisode]])if(item){
  const key=kind+'/'+item.id;if(!links.has(key))links.set(key,{kind,item,recordIds:[]});links.get(key).recordIds.push(Number(row.id));
 }
 const normalize=value=>String(value||'').normalize('NFKC').replace(/^\s*\[[^\]]+\]\s*/,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 const data=JSON.parse(fs.readFileSync(path.join(wiki,'calendar-schedules.json'),'utf8'));
 const out='public/official-calendar.json';
 const current=fs.existsSync(out)?JSON.parse(fs.readFileSync(out,'utf8')):{completeMonths:{},days:[]};
 const completeMonths={...data.completeMonths},byDate=new Map(data.days.map(day=>[day.date,day]));
 for(const [month,checked]of Object.entries(current.completeMonths||{}))if(!completeMonths[month]||checked>completeMonths[month]){
  completeMonths[month]=checked;
  for(const key of [...byDate.keys()])if(key.startsWith(month))byDate.delete(key);
  for(const day of current.days)if(day.date.startsWith(month))byDate.set(day.date,day);
 }
 const fetchedAt=[data.fetchedAt,current.fetchedAt].filter(Boolean).sort().pop();
 const days=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(day=>({...day,events:day.events.filter(event=>!/kwang[\s._-]*jin|광진/i.test(event.title)).map(({recordIds,...event})=>{
  const title=normalize(event.title);
  const matches=[...links.values()].filter(({item})=>item.date===day.date&&((item.officialTitle&&title===normalize(item.officialTitle))||(normalize(item.title).length>=4&&title.includes(normalize(item.title)))));
  const match=matches.length===1?matches[0]:null;
  return {...event,recordIds:match?[...new Set(match.recordIds)]:[]};
 })}));
 fs.writeFileSync(out,JSON.stringify({fetchedAt,completeMonths,days})+'\n');
 console.log(`Official calendar: ${days.length} dates, ${days.flatMap(d=>d.events).filter(e=>e.recordIds.length).length} linked schedules, ${rows.length} archive records${live?' (live)':''}`);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
