begin;

create or replace function public.hq_admin_search_stats(p_from date, p_to date, p_limit integer default 20)
returns jsonb language sql stable security definer set search_path = public as $$
  with filtered as (
    select * from public.hq_search_events
    where searched_on between least(p_from, p_to) and greatest(p_from, p_to)
  ), normalized as (
    select *, lower(trim(query_text)) normalized_query
    from filtered
    where trim(query_text) <> ''
  ), top_queries as (
    select max(query_text) query_text, count(*)::bigint searches,
      count(distinct session_id)::bigint visitors,
      count(*) filter (where result_count = 0)::bigint zero_results,
      max(searched_at) last_searched_at
    from normalized
    group by normalized_query
    order by searches desc, last_searched_at desc
    limit least(greatest(p_limit, 1), 100)
  ), recent as (
    select searched_at, searched_on, query_kind, query_text, result_count, tab_key
    from filtered order by searched_at desc limit 100
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'searches', (select count(*) from filtered),
      'visitors', (select count(distinct session_id) from filtered),
      'zeroResults', (select count(*) from filtered where result_count = 0)
    ),
    'top', coalesce((select jsonb_agg(to_jsonb(top_queries) order by searches desc, last_searched_at desc) from top_queries), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(to_jsonb(recent) order by searched_at desc) from recent), '[]'::jsonb)
  );
$$;

revoke all on function public.hq_admin_search_stats(date, date, integer) from public, anon, authenticated;
grant execute on function public.hq_admin_search_stats(date, date, integer) to service_role;

commit;
