// Apply the calendar component to a verified existing static export when the
// production export contains changes absent from the repository. Build first.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const swc=require('next/dist/build/swc'),acorn=require('next/dist/compiled/acorn');
const root=path.resolve(process.argv[2]);
const oldName='page-ed0dc605f77bb0b4.js',oldPath=path.join(root,'_next/static/chunks/app',oldName);
const old=fs.readFileSync(oldPath,'utf8');
if(crypto.createHash('sha1').update(old).digest('hex')!=='c43affffad6ef9ea0e642300d1af9bec058eb1b1')throw Error('Production base changed; review before patching');
let target;
function walk(node){if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'&&node.id?.name==='ev'){if(target)throw Error('Ambiguous calendar');target=node;}for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
walk(acorn.parse(old,{ecmaVersion:'latest'}));if(!target)throw Error('Calendar not found');
const source=fs.readFileSync('app/page.js','utf8');
const component=source.slice(source.indexOf('function CalendarView()'),source.indexOf('\nconst shuffle =')).replace('function CalendarView() {',`function ev() {\nconst useState=n.useState,useEffect=n.useEffect,useKstToday=V,getKstDate=H,pad=K,cn=Y,archiveService=A.UF,ChevronLeft=w.Z,ChevronRight=N.Z,ArchiveSkeleton=eR,LoadError=eq,ArchiveGrid=eg;\nconst displayKstDate=value=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)).replaceAll('-','.');`);
const compiled=swc.transformSync(component,{jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2020',transform:{react:{runtime:'classic',pragma:'n.createElement',pragmaFrag:'n.Fragment'}}}}).code;
const updated=old.slice(0,target.start)+compiled+old.slice(target.end);acorn.parse(updated,{ecmaVersion:'latest'});
const name='page-calendar-'+crypto.createHash('sha256').update(updated).digest('hex').slice(0,12)+'.js';
fs.writeFileSync(path.join(path.dirname(oldPath),name),updated);
for(const file of ['index.html','index.txt']){const p=path.join(root,file);let data=fs.readFileSync(p,'utf8');if(!data.includes(oldName))throw Error('Missing page reference: '+file);data=data.replaceAll(oldName,name);if(file.endsWith('.html'))data=data.replace('</head>','<link rel="stylesheet" href="/official-calendar.css"></head>');fs.writeFileSync(p,data);}
const cssDir='out/_next/static/css';const css=fs.readdirSync(cssDir).filter(f=>f.endsWith('.css')).map(f=>fs.readFileSync(path.join(cssDir,f),'utf8')).join('\n');fs.writeFileSync(path.join(root,'official-calendar.css'),css);
fs.copyFileSync('public/official-calendar.json',path.join(root,'official-calendar.json'));
console.log(JSON.stringify({chunk:name,verifiedUnchangedOutsideCalendar:true}));
