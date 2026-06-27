create table if not exists public.hq_app_tab_config (
  tab_key text primary key,
  label text not null,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.hq_app_tab_config (tab_key, label, sort_order, is_visible)
values
  ('home', '홈', 10, true),
  ('calendar', '캘린더', 20, true),
  ('recommended', '추천', 30, true),
  ('postype', '포타', 40, true)
on conflict (tab_key) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table public.hq_app_tab_config enable row level security;

drop policy if exists "Public can read app tab config" on public.hq_app_tab_config;
create policy "Public can read app tab config"
on public.hq_app_tab_config
for select
to anon, authenticated
using (true);
