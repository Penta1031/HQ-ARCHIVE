begin;

drop function if exists public.hq_admin_view_content(date, date, text, integer, integer);

create function public.hq_admin_view_content(
  p_from date, p_to date, p_query text default '', p_offset integer default 0, p_limit integer default 30
)
returns table (
  content_type text, content_id text, content_title text, content_url text, tab_key text,
  sub_category text, views bigint, last_viewed_at timestamptz, total_count bigint
)
language sql stable security definer set search_path = public as $$
  with filtered as (
    select event.*, subcategory.name sub_category
    from public.hq_view_events event
    left join public.hq_archive_contents archive
      on event.content_type = 'hq_archive' and archive.id::text = event.content_id
    left join public.hq_archive_subcategories subcategory on subcategory.id = archive.subcategory_id
    where event.event_type = 'content'
      and event.content_type in ('hq_archive', 'recommended_video')
      and event.viewed_on between p_from and p_to
      and (coalesce(trim(p_query), '') = '' or event.content_title ilike '%' || trim(p_query) || '%'
        or event.content_url ilike '%' || trim(p_query) || '%' or event.content_id ilike '%' || trim(p_query) || '%'
        or event.tab_key ilike '%' || trim(p_query) || '%' or event.content_type ilike '%' || trim(p_query) || '%'
        or subcategory.name ilike '%' || trim(p_query) || '%')
  ), grouped as (
    select filtered.content_type, filtered.content_id,
      coalesce(max(nullif(filtered.content_title, '')), '(제목 없음)') content_title,
      max(nullif(filtered.content_url, '')) content_url, filtered.tab_key,
      max(filtered.sub_category) sub_category,
      count(*)::bigint views, max(filtered.viewed_at) last_viewed_at
    from filtered group by filtered.content_type, filtered.content_id, filtered.tab_key
  )
  select grouped.*, count(*) over()::bigint total_count from grouped
  order by grouped.views desc, grouped.last_viewed_at desc
  offset greatest(p_offset, 0) limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.hq_admin_view_content(date, date, text, integer, integer) from public, anon, authenticated;
grant execute on function public.hq_admin_view_content(date, date, text, integer, integer) to service_role;

commit;
