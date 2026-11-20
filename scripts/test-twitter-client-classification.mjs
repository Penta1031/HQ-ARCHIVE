import fs from 'node:fs';
import assert from 'node:assert/strict';
import {inferTwitterCategory, classifyTwitterPage} from '../lib/twitter-classification.mjs';
const examples = [["220618 ㅇㅁㅎㄱ ㅇㄷㅎㄱ 스페셜 커튼콜","/"],["감상문입니다\n220206 엔콘1 Day 2","/"],["250524 공카 엔콘4 비하인드","SNS/공식 카페"],["250608 인ㄱ 컴백인터뷰","미디어/인터뷰"],["260620 쇼ㅊ 비하인드","/"],["200106 ㅇㅇㅎ #40","라이브/우리 얘기 좀 합시다"],["190408 ㅜㅒ합 🦊 대화","라이브/우리 얘기 좀 합시다"],["220801 ㅎㄹㅇㅁㅁㄹ #69","라이브/하루의 마무리"],["221212 ㅂㄱㅇㄱㅇ 티저 #혚쾌","미디어/방송/예능"],["250510 ㅇㅋ4 2일차","무대영상/콘서트"],["260802 엕콘5 서울 Day 3","무대영상/콘서트"],["241013 ㅇㅆㅅㅌㅇㅈ #혚쾌","무대영상/페스티벌"],["240607 하이드ㅇㅇ 1일차","무대영상/콘서트"],["240524 하이드ㅇㅇ 비하인드필름","유튜브/비하인드"],["250501 엕콘4 포스터&엠디 비하인드 필름","유튜브/비하인드"],["261117 ㄹㅋㄷㄹㄱ","유튜브/레코딩로그"],["250613 뮤ㅂ 직캠","무대영상/직캠"],["250613 뮤ㅂ","무대영상/음악방송"],["260320 우사ㅎ MD 비하인드 네이버 블로그","/"],["220206 ㄷㅇㄹㅅㅌ","/"],["오늘 ㅇㅇㅎ 얘기했다","/"],["220206\nㅇㅇㅎ #40","라이브/우리 얘기 좀 합시다"],["220206 알 수 없는 일정\n본문에 ㅇㅇㅎ 언급","/"],["220206 ㅇㅇㅎ #혚쾌\n예전 비하인드 이야기","라이브/우리 얘기 좀 합시다"]];
for (const [title, expected] of examples) { const r=inferTwitterCategory(title); assert.equal(r.mainCategory+'/'+r.subCategory,expected,title); }
const allowed = new Set(['무대영상/콘서트']);
const item=(id,root,title)=>({link:'https://x.com/Penta_1031/status/'+id,twitterConversationId:root,title,mainCategory:'',subCategory:''});
let reads=0;
const deps={loadPairs:async()=>allowed,loadRoot:async id=>{reads++;return id==='100'?item('100','100','220206 엔콘1 Day 2'):null;}};
let result=await classifyTwitterPage({items:[item('101','100','답글'),item('102','100','또 답글'),item('103','103','날짜 없는 글')]},deps);
assert.equal(result.autoClassified,2); assert.equal(reads,1); assert.equal(result.items[2].mainCategory,'');
result=await classifyTwitterPage(result,{loadPairs:()=>{throw Error('must not retry');}}); assert.equal(result.autoClassified,2);
const batch=await classifyTwitterPage({items:[item('201','200','답글'),item('200','200','220206 엔콘1')]}, {loadPairs:async()=>allowed,loadRoot:()=>{throw Error('unexpected archive read');}});
assert.equal(batch.autoClassified,2);
const missing=await classifyTwitterPage({items:[item('301','300','220206 엔콘1')]},{loadPairs:async()=>allowed,loadRoot:async()=>null}); assert.equal(missing.autoClassified,0);
const manually={...item('400','400','220206 엔콘1'),mainCategory:'수동',subCategory:'지정'};
const preserved=await classifyTwitterPage({items:[manually]},deps); assert.equal(preserved.items[0].mainCategory,'수동');
const unavailable=await classifyTwitterPage({items:[item('500','500','220206 엔콘1')]},{loadPairs:async()=>new Set(),loadRoot:async()=>null}); assert.equal(unavailable.autoClassified,0);
const failure=await classifyTwitterPage({items:[item('600','600','220206 엔콘1')]},{loadPairs:async()=>{throw Error('offline');}}); assert.equal(failure.items.length,1); assert.ok(failure.warning);
// Exercise the actual import/save service with a mocked network, including save retry.
let code=fs.readFileSync(new URL('../lib/archive-supabase.js',import.meta.url),'utf8');
code=code.replace('"./twitter-classification.mjs"',JSON.stringify(new URL('../lib/twitter-classification.mjs',import.meta.url).href));
const {archiveService}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const realFetch=globalThis.fetch;let searches=0,saves=0,shouldFail=true;
globalThis.fetch=async(url,options={})=>{
 if(String(url).includes('/rest/v1/hq_archive_categories?'))return Response.json([{id:1,name:'무대영상'}]);
 if(String(url).includes('/rest/v1/hq_archive_subcategories?'))return Response.json([{category_id:1,name:'콘서트'}]);
 const body=JSON.parse(options.body||'{}');
 if(body.action==='twitter-search'){searches++;return Response.json({ok:true,items:[item('700','700','220206 엔콘1')],fetched:1});}
 if(body.action==='archive-save-drafts'){saves++;assert.equal(body.items[0].subCategory,'콘서트');if(shouldFail){shouldFail=false;return Response.json({error:'temporary save error'},{status:500});}return Response.json({ok:true,inserted:1,skipped:0});}
 throw Error('Unexpected network request');
};
try{let pending;try{await archiveService.fetchTwitter({twitterId:'Penta_1031'});}catch(error){pending=error.pendingTwitterPage;}
 assert.ok(pending);const saved=await archiveService.fetchTwitter({pendingPage:pending});assert.equal(saved.autoClassified,1);assert.equal(searches,1);assert.equal(saves,2);
}finally{globalThis.fetch=realFetch;}
console.log('PASS: 24 schedule examples, root inheritance, missing/disabled categories, manual preservation, failure recovery and no paid requery on save retry');
