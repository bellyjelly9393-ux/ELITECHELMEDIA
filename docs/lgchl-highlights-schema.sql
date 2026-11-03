create table public.lgchl_game_highlights (
 id bigint generated always as identity primary key,
 lg_game_id bigint not null references public.lgchl_games(lg_game_id),
 title text not null check (char_length(title) between 1 and 180),
 video_path text not null unique check (video_path ~ '^[A-Za-z0-9][A-Za-z0-9/_-]*[.]mp4$' and video_path !~ '(^|/)[.][.]?(/|$)'),
 poster_path text check (poster_path ~ '^[A-Za-z0-9][A-Za-z0-9/_-]*[.](jpg|webp)$'),
 lg_user_ids bigint[] not null default '{}',
 period smallint check (period between 1 and 10),
 clock_label text check (char_length(clock_label)<=16),
 source_url text not null check (source_url like 'https://%'),
 verified_at timestamptz,
 published_at timestamptz,
 created_at timestamptz not null default now(),
 check (published_at is null or verified_at is not null)
);
alter table public.lgchl_game_highlights enable row level security;
revoke all on public.lgchl_game_highlights from anon,authenticated;
grant select on public.lgchl_game_highlights to anon,authenticated;
create policy "Read verified published highlights" on public.lgchl_game_highlights for select to anon,authenticated using (verified_at is not null and published_at is not null and published_at <= now());
create index lgchl_game_highlights_game_idx on public.lgchl_game_highlights(lg_game_id,published_at);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('lgchl-public-highlights','lgchl-public-highlights',true,52428800,array['video/mp4','image/jpeg','image/webp']);
comment on table public.lgchl_game_highlights is 'Public editorial highlights only. Never sign or publish private War Room assets here. Upload reviewed media to the dedicated bucket before publishing its registry row.';
