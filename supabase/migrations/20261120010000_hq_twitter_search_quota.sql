begin;

create table if not exists public.hq_twitter_search_usage (
  usage_date date primary key,
  request_count integer not null default 0 check (request_count between 0 and 10),
  last_requested_at timestamptz
);
alter table public.hq_twitter_search_usage enable row level security;
revoke all on public.hq_twitter_search_usage from public, anon, authenticated;

-- Row locking makes the daily cap apply across tabs, sessions and edge instances.
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
  if usage_row.request_count >= 10 then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'reason', 'daily');
  end if;
  if usage_row.last_requested_at > current_time_value - interval '2 seconds' then
    return jsonb_build_object('allowed', false, 'remaining', 10 - usage_row.request_count, 'reason', 'cooldown');
  end if;
  update public.hq_twitter_search_usage
    set request_count = request_count + 1, last_requested_at = current_time_value
    where usage_date = day_key;
  return jsonb_build_object('allowed', true, 'remaining', 9 - usage_row.request_count);
end;
$$;
revoke all on function public.hq_reserve_twitter_search() from public, anon, authenticated;
grant execute on function public.hq_reserve_twitter_search() to service_role;

commit;
