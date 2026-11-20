begin;
alter table public.hq_twitter_search_usage
  drop constraint if exists hq_twitter_search_usage_request_count_check;
alter table public.hq_twitter_search_usage
  add constraint hq_twitter_search_usage_request_count_check check (request_count >= 0);

-- Keep only the shared two-second cooldown. There is no daily request cap.
create or replace function public.hq_reserve_twitter_search()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  day_key date := (clock_timestamp() at time zone 'Asia/Seoul')::date;
  usage_row public.hq_twitter_search_usage%rowtype;
  current_time_value timestamptz;
begin
  insert into public.hq_twitter_search_usage(usage_date) values(day_key) on conflict do nothing;
  select * into usage_row from public.hq_twitter_search_usage where usage_date = day_key for update;
  current_time_value := clock_timestamp();
  if usage_row.last_requested_at > current_time_value - interval '2 seconds' then
    return jsonb_build_object('allowed', false, 'reason', 'cooldown');
  end if;
  update public.hq_twitter_search_usage
    set request_count = request_count + 1, last_requested_at = current_time_value
    where usage_date = day_key;
  return jsonb_build_object('allowed', true);
end;
$$;
revoke all on function public.hq_reserve_twitter_search() from public, anon, authenticated;
grant execute on function public.hq_reserve_twitter_search() to service_role;
commit;
