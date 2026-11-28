const topic = (id, title, subs) => ({id,title,subs});
const youtube = (id, title, subs) => ({...topic(id,title,subs),mains:['유튜브']});
const album = (title, released, terms) => ({id:`album-${released}`,title,released,terms,album:true});
const series = (id,title,series) => ({id,title,series});
const eventSeries = parent => window.WIKI_EVENT_SERIES.catalog.filter(item=>item.parent===parent&&window.WIKI_EVENT_SERIES.activeIds.includes(item.id)).map(item=>series(item.id,item.title,item.id));
window.WIKI_TAXONOMY = [
  {id:'official',title:'공식채널',children:[
    {id:'official-youtube',title:'유튜브',children:[
      youtube('mv','뮤직비디오',['뮤직비디오']),youtube('making','메이킹',['메이킹']),youtube('behind','비하인드',['비하인드']),youtube('recording','레코딩로그',['레코딩로그']),youtube('seungcam','승캠',['승캠']),youtube('practice','합주일지',['합주일지']),youtube('covers','커버곡',['커버곡']),youtube('special-clips','스페셜클립',['스페셜클립']),youtube('shorts','쇼츠',['쇼츠']),youtube('enkit-list','엔킷리스트',['엔킷리스트']),youtube('bucket-list','버킷리스트',['버킷리스트']),youtube('cold-hot','냉탕과온탕사이',['냉탕과온탕사이']),youtube('ssul-debate','만년썰전',['만년썰전']),topic('our-talk','우리 얘기 좀 합시다',['우리 얘기 좀 합시다']),youtube('summer-camp','여름승협캠프',['승캠'])
    ]},
    {id:'official-sns',title:'SNS',children:[topic('official-twitter','트위터',['공식 트위터']),topic('official-instagram','인스타그램',['공식 인스타그램']),topic('official-weibo','웨이보',['공식 웨이보'])]},
    topic('official-cafe','공식카페',['공식 카페']),topic('official-blog','공식블로그',['공식 블로그'])
  ]},
  {id:'members',title:'멤버',children:[
    {id:'personal-sns',title:'개인 SNS',children:[topic('personal-instagram','인스타그램',['개인 인스타그램']),topic('personal-weibo','웨이보',['개인 웨이보'])]},
    {id:'personal-youtube',title:'개인 유튜브',children:[topic('seunghyub','승협이',['승협이','승협이 라이브']),youtube('seunghyub-instagram-vlog','승협 인스타그램 브이로그',['승협_인스타그램 브이로그']),topic('day-end','하루의 마무리',['하루의 마무리'])]},
    {id:'member-lives',title:'라이브',children:[
      {id:'couple-live',title:'커플 라이브',tag:'활동:커플 라이브',collection:'couple-live',featured:true},
      {...topic('group-live','단체 라이브',['단체 라이브']),mains:['라이브']},
      {...topic('individual-live','개인 라이브',['개인 라이브']),mains:['라이브']},
      {...topic('instagram-live','인스타그램 라이브',['인스타그램 라이브']),mains:['라이브']},
      {...topic('seunghyub-live','승협이 라이브',['승협이 라이브']),mains:['라이브']},
      {...topic('hwe-seung-live','하루의 마무리',['하루의 마무리']),mains:['라이브']},
      {...topic('seungguri-live','승구리당당',['승구리당당']),mains:['라이브']},
      {...topic('our-talk-live','우리 얘기 좀 합시다',['우리 얘기 좀 합시다']),mains:['라이브']},
      {...topic('other-live','기타 라이브',['기타 라이브']),mains:['라이브']}
    ]},
    {id:'personal-messages',title:'개인 메시지',children:[topic('bubble','버블',['버블']),topic('fromm','프롬',['프롬'])]}
  ]},
  {id:'activities',title:'활동',children:[
    {id:'events',title:'공연 및 행사',children:[
      {...topic('concerts','콘서트',['콘서트','해외투어','킹덤']),children:[
        {id:'andcon',title:'&CON (엔콘)',series:'andcon',children:[
          series('con1','&CON1','con1'),series('con2','&CON2','con2'),series('con3','&CON3','con3'),
          series('con4','&CON4 : FULL CIRCLE','con4'),series('con5','&CON5 : into REM','con5')
        ]},
        series('meet-talk','우리 만나서 이야기 좀 합시다 (우만합)','meet-talk'),
        series('small-talk','우.사.합 : 우리 사소한 얘기 좀 합시다','small-talk'),
        topic('overseas','해외투어',['해외투어']),...eventSeries('concerts')
      ]},
      {...topic('festivals','페스티벌',['페스티벌']),children:eventSeries('festivals')},
      {...topic('kingdom','FNC 킹덤',['킹덤']),children:eventSeries('kingdom')},
      topic('university','대학 축제',['대학축제']),topic('fanmeetings','팬미팅',['팬미팅']),
      topic('fansigns','팬사인회',['팬싸인회']),{...topic('busking','버스킹',['버스킹']),children:eventSeries('busking')},{...topic('musicals','뮤지컬',['뮤지컬']),children:eventSeries('musicals')},topic('showcases','쇼케이스',['쇼케이스']),topic('fancams','직캠',['직캠']),topic('commute','출퇴근길',['공항/퇴근길'])
    ]}
  ]},
  {id:'external',title:'외부채널',children:[topic('radio','라디오',['라디오']),topic('web-shows','웹예능',['웹예능/웹컨텐츠']),topic('broadcast','방송',['방송/예능','음악방송'])]},
  topic('interviews','인터뷰',['인터뷰','잡지/화보']),
  {id:'trivia',title:'여담',documents:['친지마','커플폰','커피차','이마키스','붕어빵','러닝']}
];
window.WIKI_ALBUM_SOURCE = 'https://nflying-official.jp/discography/kind/4/';
