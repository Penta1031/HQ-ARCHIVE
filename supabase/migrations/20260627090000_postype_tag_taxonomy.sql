-- Update only the remotely managed Postype genre and keyword vocabulary.
-- Existing rows in postype_archive are intentionally left unchanged.

insert into public.postype_filter_config (group_name, options)
values
  (
    '장르',
    '["현대물","학원물","캠게","노란장판","리얼물","판타지","오메가버스","가이드버스","회귀물","힐링물","시대물","연예계물","스포츠물","군부물","피폐물","일상물","수인물","종교물","느와르","청게","네임버스","조직물"]'
  ),
  (
    '키워드',
    '["계약","재회","첫사랑","짝사랑","동거","오해","구원","집착","후회","비밀연애","신분차이","소꿉친구","친구에서연인","정략결혼","임신","육아","상처","질투","쌍방구원","쌍방짝사랑","혐관","달달물","코믹","잔잔물","궁중물","사고","죽음","상실","사내연애","원나잇","기억상실","좀비아포칼립스","스폰서","프로게이머","게헤","헤게","알파베타","알파오메가","센티넬x가이드","가이드x센티넬","뱀파이어","아저씨","F1","짭근","찐근"]'
  )
on conflict (group_name) do update
set options = excluded.options;
