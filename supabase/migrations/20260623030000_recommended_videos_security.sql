alter table public.recommended_videos enable row level security;

drop policy if exists recommended_videos_public_read on public.recommended_videos;
create policy recommended_videos_public_read
on public.recommended_videos
for select
to anon, authenticated
using (is_active = true);

revoke insert, update, delete on public.recommended_videos from anon, authenticated;
grant select on public.recommended_videos to anon, authenticated;
