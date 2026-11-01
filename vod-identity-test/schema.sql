create role authenticated;create role anon;create schema auth;create schema private;
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function private.vvhl_can_manage_team(uid uuid,team uuid) returns boolean language sql as $$select uid='a0000000-0000-4000-8000-000000000001'::uuid and team='a0000000-0000-4000-8000-000000000002'::uuid$$;
   create table auth.users(id uuid primary key);insert into auth.users values('a0000000-0000-4000-8000-000000000001');
   create table public.teams(id uuid primary key);insert into public.teams values('a0000000-0000-4000-8000-000000000002');
   create table public.hitmen_schedule_games(id uuid primary key,team_id uuid,season int);
   create table public.team_player_lockers(id uuid primary key,team_id uuid,season int,lg_user_id bigint,gamertag text,position text);
   create table public.vod_review_sessions(id uuid primary key,team_id uuid,schedule_game_id uuid,updated_at timestamptz,status text,review_document jsonb,full_game_summary text,tactical_report text,player_report text,game_date date,opponent_label text,vod_url text,source_start_seconds int,source_end_seconds int,duration_seconds int);
   create table public.vod_review_segments(id uuid default gen_random_uuid(),review_id uuid,team_id uuid,segment_type text,segment_index int,start_seconds int,end_seconds int,status text,analysis_summary text,archived_at timestamptz);
   create table public.vod_review_markers(id uuid,segment_id uuid,timestamp_seconds int);
   create table public.vod_game_publications(review_id uuid primary key,team_id uuid,report jsonb,published_by uuid,active boolean default true,published_at timestamptz default now());
   create table public.team_player_game_reports(id uuid default gen_random_uuid(),team_id uuid,season int,locker_id uuid,schedule_game_id uuid,game_date date,opponent_name text,position_played text,ai_review_id uuid,stats jsonb,visibility text,created_by uuid,strengths text,improvements text,tactical_notes text,coach_summary text,updated_at timestamptz,evidence jsonb);
   create unique index report_review_locker on public.team_player_game_reports(ai_review_id,locker_id) where ai_review_id is not null;
   grant usage on schema public,auth,private to authenticated;
   grant select on all tables in schema public to authenticated;
   grant insert,update on public.vod_review_sessions,public.vod_game_publications,public.team_player_game_reports to authenticated;
   grant update on public.hitmen_schedule_games to authenticated;
   