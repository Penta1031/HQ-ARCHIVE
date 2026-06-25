alter table public.recommended_videos
add column if not exists is_hyeopkwae_pick boolean not null default false;

create index if not exists recommended_videos_hyeopkwae_pick_idx
on public.recommended_videos (is_active, is_hyeopkwae_pick, published_at desc);
