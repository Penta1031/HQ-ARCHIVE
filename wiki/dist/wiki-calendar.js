/* Official schedules and wiki records share a date, while reviewed content links stay explicit. */
window.WIKI_CALENDAR=(()=>{
  let loading;
  const officialUrl=day=>{const [y,m,d]=day.split('-');return `https://www.fncent.com/?m=bbs&bid=schedule&mod=list&r=NFLYING&year=${y}&month=${m}&day=${d}`;};
  const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const validDay=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  const shift=(month,delta)=>{const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7);};
  async function render(params){
    document.title='캘린더 - 혚쾌위키';active('calendar');
    const generation=state.generation;
    content.innerHTML=pageHeader('캘린더','WIKI')+'<p role="status">일정과 기록을 불러오는 중</p>';
    loading??=fetch('./calendar-schedules.json').then(r=>{if(!r.ok)throw Error('공식 일정을 불러오지 못했습니다.');return r.json();}).catch(error=>{loading=null;throw error;});
    try{
      const [data,result]=await Promise.all([loading,archive.query(()=>true,{limit:Number.MAX_SAFE_INTEGER})]);
      if(generation!==state.generation)return;
      const now=today();const selected=validDay(params.get('date'))?params.get('date'):now;
      const month=selected.slice(0,7),[year,mon]=month.split('-').map(Number);
      const filter=['all','official','records'].includes(params.get('show'))?params.get('show'):'all';
      const schedules=new Map(data.days.map(day=>[day.date,day]));
      const byDate=Map.groupBy(result.rows,row=>row.occurred_on);
      const href=day=>'#/calendar?date='+day+(filter==='all'?'':'&show='+filter);
      const daysInMonth=new Date(Date.UTC(year,mon,0)).getUTCDate();
      const offset=new Date(Date.UTC(year,mon-1,1)).getUTCDay();
      const weekday=['일','월','화','수','목','금','토'];
      const cells=Array.from({length:offset},()=>'<div class="calendar-blank" aria-hidden="true"></div>');
      for(let day=1;day<=daysInMonth;day++){
        const iso=month+'-'+String(day).padStart(2,'0');const entries=schedules.get(iso)?.events||[],rows=byDate.get(iso)||[];
        const showOfficial=filter!=='records'&&entries.length,showRecords=filter!=='official'&&rows.length;
        cells.push(`<a class="calendar-day${iso===selected?' selected':''}${iso===now?' today':''}" href="${href(iso)}" ${iso===selected?'aria-current="date"':''} aria-label="${iso}, 공식 일정 ${entries.length}건, 위키 기록 ${rows.length}건"><span class="calendar-number">${day}</span><span class="calendar-indicators" aria-hidden="true">${showOfficial?'<span class="calendar-dot official"></span>':''}${showRecords?'<span class="calendar-dot records"></span>':''}</span></a>`);
      }
      while(cells.length%7)cells.push('<div class="calendar-blank" aria-hidden="true"></div>');
      const day=schedules.get(selected),rows=byDate.get(selected)||[];
      // These relationships come from the existing reviewed mappings, never date matching alone.
      const linked=new Map();
      for(const row of rows)for(const [kind,item]of [['performance',row.performance],['radio',row.radioSchedule],['web',row.webEpisode]])if(item)linked.set(kind+'/'+item.id,{kind,item});
      const scheduleLinks=new Map();
      for(const row of result.rows)for(const [kind,item]of [['performance',row.performance],['radio',row.radioSchedule],['web',row.webEpisode]]){
        if(item?.date===selected)scheduleLinks.set(kind+'/'+item.id,{kind,item});
      }
      const normalize=value=>String(value||'').normalize('NFKC').replace(/^\s*\[[^\]]+\]\s*/,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
      const scheduleEntry=event=>{
        const title=normalize(event.title);
        const matches=[...scheduleLinks.values()].filter(({item})=>{
          const official=normalize(item.officialTitle),name=normalize(item.title);
          return (official&&title===official)||(name.length>=4&&(title===name||title.includes(name)));
        });
        // A day alone cannot establish an event relationship; require a unique title match.
        const target=matches.length===1?matches[0]:null;
        return target?`<a class="calendar-linked-event" href="#/${target.kind}/${encodeURIComponent(target.item.id)}">${e(event.title)}</a>`:`<span class="calendar-unlinked-event">${e(event.title)}</span>`;
      };
      const checked=data.completeMonths?.[month];
      content.innerHTML=pageHeader('캘린더','WIKI')+`<article class="wiki-article calendar-page"><div class="calendar-card"><div class="calendar-toolbar"><a class="calendar-month-step" href="${href(shift(month,-1)+'-01')}" aria-label="이전 달">‹</a><div class="calendar-selects"><label><span class="calendar-sr-only">연도</span><select id="calendarYear">${Array.from({length:Math.max(2028,year+1)-2017+1},(_,i)=>2017+i).map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}</select></label><label><span class="calendar-sr-only">월</span><select id="calendarMonth">${Array.from({length:12},(_,i)=>i+1).map(m=>`<option value="${m}" ${m===mon?'selected':''}>${String(m).padStart(2,'0')}</option>`).join('')}</select></label></div><a class="calendar-month-step" href="${href(shift(month,1)+'-01')}" aria-label="다음 달">›</a></div><div class="calendar-weekdays" aria-hidden="true">${weekday.map(d=>`<span>${d}</span>`).join('')}</div><div class="calendar-grid" aria-label="${year}년 ${mon}월 날짜">${cells.join('')}</div></div><div class="calendar-underbar"><div class="calendar-legend"><span><i class="calendar-dot official"></i> 공식 일정</span><span><i class="calendar-dot records"></i> 위키 기록</span></div><a href="${href(now)}">오늘</a></div><nav class="calendar-filters" aria-label="캘린더 표시">${[['all','전체'],['official','공식 일정'],['records','위키 기록']].map(([id,label])=>`<a href="#/calendar?date=${selected}&show=${id}" ${id===filter?'aria-current="true"':''}>${label}</a>`).join('')}</nav><p class="calendar-coverage">${checked?`공식 일정 확인: ${new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium'}).format(new Date(checked))}`:'이 달은 기존에 확인한 공식 일정만 표시합니다.'} · ${externalLink('FNC 원문',officialUrl(selected))}</p><section class="calendar-detail" aria-labelledby="calendarDate"><h2 id="calendarDate">${selected.replaceAll('-','.')}.</h2><h3>공식 일정</h3>${day?.events.length?`<ul class="calendar-events">${day.events.map(event=>`<li>${scheduleEntry(event)}</li>`).join('')}</ul>`:`<p>${day||checked?'확인한 공식 일정이 없습니다.':'이 날짜의 공식 일정은 아직 수록되지 않았습니다.'}</p>`}${linked.size?`<h3>연결된 콘텐츠</h3><ul>${[...linked.values()].map(({kind,item})=>`<li><a href="#/${kind}/${encodeURIComponent(item.id)}">${e(item.title)}</a></li>`).join('')}</ul>`:''}<h3>같은 날의 위키 기록 <small>(${rows.length})</small></h3>${rows.length?recordsList(rows):'<p>이 날짜에 등록된 위키 기록이 없습니다.</p>'}</section></article>`;
      const changeMonth=()=>{const y=document.querySelector('#calendarYear').value,m=String(document.querySelector('#calendarMonth').value).padStart(2,'0');location.hash=href(`${y}-${m}-01`);};
      document.querySelector('#calendarYear').addEventListener('change',changeMonth);
      document.querySelector('#calendarMonth').addEventListener('change',changeMonth);
    }catch(error){if(generation===state.generation)renderError(error);}
  }
  return {render};
})();
