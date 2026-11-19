// Build the archive calendar snapshot from the wiki's reviewed official schedule links.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const wiki=path.resolve(process.argv[2]||'../hq-wiki/.sites-checkout/dist');
const context=vm.createContext({window:{},Map,Set,URL,URLSearchParams,AbortSignal,Date,fetch:async file=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(wiki,file),'utf8'))})});
vm.runInContext(fs.readFileSync(path.join(wiki,'wiki-data.js'),'utf8'),context);
(async()=>{
 const {rows}=await context.window.WIKI_STORE.query(()=>true,{limit:Infinity});
 const links=new Map();
 for(const row of rows)for(const [kind,item]of [['performance',row.performance],['radio',row.radioSchedule],['web',row.webEpisode]])if(item){
  const key=kind+'/'+item.id;if(!links.has(key))links.set(key,{kind,item,recordIds:[]});links.get(key).recordIds.push(Number(row.id));
 }
 const normalize=value=>String(value||'').normalize('NFKC').replace(/^\s*\[[^\]]+\]\s*/,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 const data=JSON.parse(fs.readFileSync(path.join(wiki,'calendar-schedules.json'),'utf8'));
 const days=data.days.map(day=>({...day,events:day.events.filter(event=>!/kwang[\s._-]*jin|광진/i.test(event.title)).map(event=>{
  const title=normalize(event.title);
  const matches=[...links.values()].filter(({item})=>item.date===day.date&&((item.officialTitle&&title===normalize(item.officialTitle))||(normalize(item.title).length>=4&&title.includes(normalize(item.title)))));
  const match=matches.length===1?matches[0]:null;
  return {...event,recordIds:match?[...new Set(match.recordIds)]:[]};
 })}));
 fs.writeFileSync('public/official-calendar.json',JSON.stringify({fetchedAt:data.fetchedAt,completeMonths:data.completeMonths,days})+'\n');
 console.log(`Official calendar: ${days.length} dates, ${days.flatMap(d=>d.events).filter(e=>e.recordIds.length).length} linked schedules`);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
