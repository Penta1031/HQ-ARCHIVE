create table if not exists public.recommended_video_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null check (length(trim(name)) > 0),
  sort_order integer not null default 9999,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.recommended_video_categories (name, sort_order)
values
  ('연말결산', 1),
  ('라이브', 2),
  ('레코딩로그', 3),
  ('승협캠프', 4),
  ('그 외 자컨', 5),
  ('웹/예능', 6)
on conflict (name) do nothing;

drop trigger if exists recommended_video_categories_updated_at on public.recommended_video_categories;
create trigger recommended_video_categories_updated_at
before update on public.recommended_video_categories
for each row execute function public.hq_set_updated_at();

alter table public.recommended_video_categories enable row level security;

drop policy if exists recommended_video_categories_public_read on public.recommended_video_categories;
create policy recommended_video_categories_public_read
on public.recommended_video_categories
for select
to anon, authenticated
using (true);

grant select on public.recommended_video_categories to anon, authenticated;
revoke insert, update, delete on public.recommended_video_categories from anon, authenticated;

create or replace function public.hq_rename_recommended_video_category(p_id uuid, p_name text)
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
  if clean_name = '' then
    raise exception '카테고리 이름을 입력해주세요.';
  end if;

  select name into old_name
  from public.recommended_video_categories
  where id = p_id
  for update;

  if old_name is null then
    raise exception '수정할 카테고리를 찾을 수 없습니다.';
  end if;

  update public.recommended_video_categories
  set name = clean_name
  where id = p_id
  returning * into saved;

  update public.recommended_videos as video
  set categories = (
    select coalesce(array_agg(category_name order by first_position), '{}'::text[])
    from (
      select category_name, min(position) as first_position
      from unnest(array_replace(video.categories, old_name, clean_name)) with ordinality as item(category_name, position)
      group by category_name
    ) as unique_categories
  )
  where video.categories @> array[old_name]::text[];

  return saved;
end;
$$;

create or replace function public.hq_delete_recommended_video_category(p_id uuid)
returns public.recommended_video_categories
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted public.recommended_video_categories;
begin
  delete from public.recommended_video_categories
  where id = p_id
  returning * into deleted;

  if deleted.id is null then
    raise exception '삭제할 카테고리를 찾을 수 없습니다.';
  end if;

  update public.recommended_videos
  set categories = array_remove(categories, deleted.name)
  where categories @> array[deleted.name]::text[];

  return deleted;
end;
$$;

revoke all on function public.hq_rename_recommended_video_category(uuid, text) from public, anon, authenticated;
revoke all on function public.hq_delete_recommended_video_category(uuid) from public, anon, authenticated;
grant execute on function public.hq_rename_recommended_video_category(uuid, text) to service_role;
grant execute on function public.hq_delete_recommended_video_category(uuid) to service_role;
