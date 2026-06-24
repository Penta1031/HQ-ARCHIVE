create table if not exists public.recommended_video_main_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null check (length(trim(name)) > 0),
  sort_order integer not null default 9999,
  is_fallback boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recommended_video_main_categories
add column if not exists is_fallback boolean not null default false;

drop trigger if exists recommended_video_main_categories_updated_at on public.recommended_video_main_categories;
create trigger recommended_video_main_categories_updated_at
before update on public.recommended_video_main_categories
for each row execute function public.hq_set_updated_at();

insert into public.recommended_video_main_categories (name, sort_order)
values
  ('엔플라잉', 1),
  ('승협이', 2),
  ('유회승', 3),
  ('라이브', 4),
  ('에딧', 5),
  ('미분류', 9999)
on conflict (name) do update set sort_order = excluded.sort_order;

update public.recommended_video_main_categories
set is_fallback = (name = '미분류');

create unique index if not exists recommended_video_main_categories_single_fallback_idx
on public.recommended_video_main_categories (is_fallback)
where is_fallback;

alter table public.recommended_video_categories
add column if not exists main_category_id uuid references public.recommended_video_main_categories(id) on delete restrict;

-- Preserve category names that may exist only on video rows.
insert into public.recommended_video_categories (name, sort_order)
select distinct trim(category_name), 9999
from public.recommended_videos as video
cross join lateral unnest(coalesce(video.categories, '{}'::text[])) as category_name
where trim(category_name) <> ''
on conflict (name) do nothing;

-- Merge the old label into the requested child-content name without losing links.
update public.recommended_videos as video
set categories = (
  select coalesce(array_agg(value order by first_position), '{}'::text[])
  from (
    select value, min(position) as first_position
    from unnest(array_replace(video.categories, '승협캠프', '승캠')) with ordinality as item(value, position)
    group by value
  ) as unique_values
)
where video.categories @> array['승협캠프']::text[];

delete from public.recommended_video_categories
where name = '승협캠프';

with configured(main_name, child_name, child_order) as (
  values
    ('엔플라잉', '메이킹', 1),
    ('엔플라잉', '비하인드', 2),
    ('엔플라잉', '레코딩로그', 3),
    ('엔플라잉', '승캠', 4),
    ('엔플라잉', '합주일지', 5),
    ('엔플라잉', '엔킷리스트', 6),
    ('엔플라잉', '버킷리스트', 7),
    ('엔플라잉', '냉탕과온탕사이', 8),
    ('승협이', '라이브', 9),
    ('승협이', '기록', 10),
    ('승협이', '하기', 11),
    ('유회승', '소작실', 12),
    ('유회승', '하루의마무리', 13),
    ('유회승', '승구리당당수다당', 14),
    ('라이브', '우리 얘기 좀 합시다', 15),
    ('에딧', '연말결산', 16),
    ('에딧', '모음집', 17)
)
insert into public.recommended_video_categories (name, main_category_id, sort_order)
select configured.child_name, main.id, configured.child_order
from configured
join public.recommended_video_main_categories as main on main.name = configured.main_name
on conflict (name) do update
set main_category_id = excluded.main_category_id,
    sort_order = excluded.sort_order;

with unclassified as (
  select id from public.recommended_video_main_categories where name = '미분류'
), ranked as (
  select category.id, (999 + row_number() over (order by category.created_at, category.name))::integer as fallback_order
  from public.recommended_video_categories as category
  where category.main_category_id is null
)
update public.recommended_video_categories as category
set main_category_id = unclassified.id,
    sort_order = ranked.fallback_order
from unclassified, ranked
where category.id = ranked.id;

alter table public.recommended_video_categories
alter column main_category_id set not null;

create index if not exists recommended_video_categories_main_order_idx
on public.recommended_video_categories (main_category_id, sort_order, created_at);

alter table public.recommended_video_main_categories enable row level security;

drop policy if exists recommended_video_main_categories_public_read on public.recommended_video_main_categories;
create policy recommended_video_main_categories_public_read
on public.recommended_video_main_categories
for select to anon, authenticated
using (true);

grant select on public.recommended_video_main_categories to anon, authenticated;
revoke insert, update, delete on public.recommended_video_main_categories from anon, authenticated;

create or replace function public.hq_update_recommended_video_category(
  p_id uuid,
  p_name text,
  p_main_category_id uuid,
  p_sort_order integer
)
returns public.recommended_video_categories
language plpgsql
security definer
set search_path = public
as $$
declare
  old_name text;
  clean_name text := trim(p_name);
  saved public.recommended_video_categories;
begin
  if clean_name = '' then raise exception '하위 콘텐츠 이름을 입력해주세요.'; end if;
  if p_main_category_id is null then raise exception '메인 카테고리를 선택해주세요.'; end if;
  if p_sort_order is null then raise exception '노출 순서를 입력해주세요.'; end if;
  if not exists (select 1 from public.recommended_video_main_categories where id = p_main_category_id) then
    raise exception '연결할 메인 카테고리를 찾을 수 없습니다.';
  end if;

  select name into old_name
  from public.recommended_video_categories
  where id = p_id
  for update;
  if old_name is null then raise exception '수정할 하위 콘텐츠를 찾을 수 없습니다.'; end if;

  update public.recommended_video_categories
  set name = clean_name,
      main_category_id = p_main_category_id,
      sort_order = p_sort_order
  where id = p_id
  returning * into saved;

  if old_name <> clean_name then
    update public.recommended_videos as video
    set categories = (
      select coalesce(array_agg(value order by first_position), '{}'::text[])
      from (
        select value, min(position) as first_position
        from unnest(array_replace(video.categories, old_name, clean_name)) with ordinality as item(value, position)
        group by value
      ) as unique_values
    )
    where video.categories @> array[old_name]::text[];
  end if;

  return saved;
end;
$$;

create or replace function public.hq_rename_recommended_video_main_category(p_id uuid, p_name text, p_sort_order integer)
returns public.recommended_video_main_categories
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text := trim(p_name);
  saved public.recommended_video_main_categories;
begin
  if clean_name = '' then raise exception '메인 카테고리 이름을 입력해주세요.'; end if;
  if p_sort_order is null then raise exception '메인 카테고리 순서를 입력해주세요.'; end if;
  update public.recommended_video_main_categories
  set name = clean_name, sort_order = p_sort_order
  where id = p_id
  returning * into saved;
  if saved.id is null then raise exception '수정할 메인 카테고리를 찾을 수 없습니다.'; end if;
  return saved;
end;
$$;

create or replace function public.hq_delete_recommended_video_main_category(p_id uuid)
returns public.recommended_video_main_categories
language plpgsql
security definer
set search_path = public
as $$
declare
  fallback_id uuid;
  deleted public.recommended_video_main_categories;
begin
  select id into fallback_id from public.recommended_video_main_categories where is_fallback;
  if fallback_id is null then raise exception '미분류 메인 카테고리를 찾을 수 없습니다.'; end if;
  if p_id = fallback_id then raise exception '미분류 메인 카테고리는 삭제할 수 없습니다.'; end if;

  update public.recommended_video_categories
  set main_category_id = fallback_id
  where main_category_id = p_id;

  delete from public.recommended_video_main_categories
  where id = p_id
  returning * into deleted;
  if deleted.id is null then raise exception '삭제할 메인 카테고리를 찾을 수 없습니다.'; end if;
  return deleted;
end;
$$;

revoke all on function public.hq_update_recommended_video_category(uuid, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.hq_rename_recommended_video_main_category(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.hq_delete_recommended_video_main_category(uuid) from public, anon, authenticated;
grant execute on function public.hq_update_recommended_video_category(uuid, text, uuid, integer) to service_role;
grant execute on function public.hq_rename_recommended_video_main_category(uuid, text, integer) to service_role;
grant execute on function public.hq_delete_recommended_video_main_category(uuid) to service_role;
