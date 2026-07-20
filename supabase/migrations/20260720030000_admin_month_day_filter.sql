begin;

create or replace function public.hq_admin_archive_month_day(
  p_month_day text,
  p_status text default 'published',
  p_query text default '',
  p_category_id bigint default null,
  p_subcategory_id bigint default null,
  p_offset integer default 0,
  p_limit integer default 100
)
returns jsonb language sql stable security definer set search_path = public as $$
  with filtered as (
    select content.*, category.name main_category, subcategory.name sub_category
    from public.hq_archive_contents content
    left join public.hq_archive_categories category on category.id = content.category_id
    left join public.hq_archive_subcategories subcategory on subcategory.id = content.subcategory_id
    where to_char(content.occurred_on, 'MM-DD') = p_month_day
      and (coalesce(p_status, '') = '' or content.status = p_status)
      and (p_category_id is null or content.category_id = p_category_id)
      and (p_subcategory_id is null or content.subcategory_id = p_subcategory_id)
      and (coalesce(trim(p_query), '') = '' or content.title ilike '%' || trim(p_query) || '%'
        or content.account ilike '%' || trim(p_query) || '%' or content.source_url ilike '%' || trim(p_query) || '%')
  ), paged as (
    select * from filtered order by occurred_on desc nulls last, id desc
    offset greatest(p_offset, 0) limit least(greatest(p_limit, 1), 100)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'title', title, 'date', occurred_on, 'link', coalesce(source_url, ''),
      'account', coalesce(account, ''), 'mainCategory', coalesce(main_category, ''),
      'subCategory', coalesce(sub_category, ''), 'keywords', coalesce(keywords, '{}'),
      'rawKeywords', array_to_string(coalesce(keywords, '{}'), ', '),
      'thumbnailUrl', coalesce(thumbnail_url, ''), 'status', status
    ) order by occurred_on desc nulls last, id desc) from paged), '[]'::jsonb)
  );
$$;

revoke all on function public.hq_admin_archive_month_day(text, text, text, bigint, bigint, integer, integer) from public, anon, authenticated;
grant execute on function public.hq_admin_archive_month_day(text, text, text, bigint, bigint, integer, integer) to service_role;

commit;
