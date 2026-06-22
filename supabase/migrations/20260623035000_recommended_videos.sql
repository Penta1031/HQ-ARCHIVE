create table if not exists public.recommended_videos (
  id uuid primary key default gen_random_uuid(),
  youtube_id text unique not null,
  youtube_url text not null,
  title text,
  published_at timestamptz,
  thumbnail_url text,
  categories text[] default '{}'::text[],
  admin_comment text,
  sort_order integer default 9999,
  featured_order integer default 9999,
  is_featured boolean default false,
  is_active boolean default false,
  source text default 'manual',
  channel_id text,
  channel_title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists recommended_videos_updated_at on public.recommended_videos;
create trigger recommended_videos_updated_at
before update on public.recommended_videos
for each row execute function public.hq_set_updated_at();
