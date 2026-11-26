-- Game links people add on the Live Hub "All Games" channel.
-- Signed-in people submit; Elitechel Media staff approve before anything is public.
-- Approved links show for 7 days after approval.
create table public.live_hub_game_links (
  id uuid primary key default gen_random_uuid(),
  url text not null check (url ~ '^https://www\.(twitch\.tv/[a-z0-9_]{3,25}|youtube\.com/watch\?v=[A-Za-z0-9_-]{11})$'),
  league text not null default 'other' check (league in ('lgchl','lg3s','wjhc','other')),
  home_name text not null check (char_length(btrim(home_name)) between 1 and 40),
  away_name text not null check (char_length(btrim(away_name)) between 1 and 40),
  note text check (note is null or char_length(note) <= 80),
  starts_at timestamptz,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_by uuid default auth.uid() references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
create index live_hub_game_links_public_idx on public.live_hub_game_links (status, expires_at);
create index live_hub_game_links_submitter_idx on public.live_hub_game_links (submitted_by, created_at);

-- Elitechel Media reviewers: admins, commissioners, and owner/GM/AGM of the Elitechel Media team.
create or replace function private.ecm_can_review_live_hub(check_user uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select check_user is not null and (
    private.vvhl_can_manage_team(check_user, '5f36117c-7a51-4514-bf70-d4c672b41e48'::uuid)
    or exists (select 1 from public.profiles p where p.id = check_user and p.role = 'commissioner')
  );
$$;
revoke all on function private.ecm_can_review_live_hub(uuid) from public, anon;
grant execute on function private.ecm_can_review_live_hub(uuid) to authenticated;

create or replace function public.ecm_live_hub_can_review()
returns boolean language sql stable security definer set search_path to '' as $$
  select private.ecm_can_review_live_hub((select auth.uid()));
$$;
revoke all on function public.ecm_live_hub_can_review() from public, anon;
grant execute on function public.ecm_live_hub_can_review() to authenticated;

-- Submissions always start pending and owned by the person adding them; reviews are stamped.
create or replace function private.live_hub_game_links_guard()
returns trigger language plpgsql security definer set search_path to '' as $$
declare uid uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if uid is null then raise exception 'Sign in to add a game.'; end if;
    new.submitted_by := uid;
    new.home_name := btrim(new.home_name);
    new.away_name := btrim(new.away_name);
    new.note := nullif(btrim(coalesce(new.note, '')), '');
    new.created_at := now();
    new.expires_at := now() + interval '7 days';
    if private.ecm_can_review_live_hub(uid) and new.status = 'approved' then
      -- Staff can add a game straight to the site.
      new.reviewed_by := uid;
      new.reviewed_at := now();
    else
      new.status := 'pending';
      new.reviewed_by := null;
      new.reviewed_at := null;
      if not private.ecm_can_review_live_hub(uid)
         and (select count(*) from public.live_hub_game_links l
               where l.submitted_by = uid and l.created_at > now() - interval '24 hours') >= 5 then
        raise exception 'You can add up to 5 games a day.';
      end if;
    end if;
    if exists (select 1 from public.live_hub_game_links l
                where l.url = new.url and l.status in ('pending', 'approved') and l.expires_at > now()) then
      raise exception 'That stream is already listed or waiting for review.';
    end if;
  elsif tg_op = 'UPDATE' then
    new.submitted_by := old.submitted_by;
    new.created_at := old.created_at;
    if new.status is distinct from old.status then
      new.reviewed_by := uid;
      new.reviewed_at := now();
      if new.status = 'approved' then new.expires_at := now() + interval '7 days'; end if;
    else
      new.reviewed_by := old.reviewed_by;
      new.reviewed_at := old.reviewed_at;
    end if;
  end if;
  return new;
end;
$$;
create trigger live_hub_game_links_guard before insert or update on public.live_hub_game_links
  for each row execute function private.live_hub_game_links_guard();

alter table public.live_hub_game_links enable row level security;

create policy "public reads approved game links" on public.live_hub_game_links
  for select to anon, authenticated using (status = 'approved' and expires_at > now());
create policy "submitters read their own game links" on public.live_hub_game_links
  for select to authenticated using (submitted_by = (select auth.uid()));
create policy "reviewers read all game links" on public.live_hub_game_links
  for select to authenticated using (private.ecm_can_review_live_hub((select auth.uid())));
create policy "signed-in people add game links" on public.live_hub_game_links
  for insert to authenticated with check ((select auth.uid()) is not null);
create policy "reviewers update game links" on public.live_hub_game_links
  for update to authenticated using (private.ecm_can_review_live_hub((select auth.uid())))
  with check (private.ecm_can_review_live_hub((select auth.uid())));
create policy "reviewers and submitters delete game links" on public.live_hub_game_links
  for delete to authenticated using (
    private.ecm_can_review_live_hub((select auth.uid()))
    or (submitted_by = (select auth.uid()) and status = 'pending'));

-- Nobody reads who submitted or reviewed a link through the API; reviewers can only change the status.
revoke all on public.live_hub_game_links from anon, authenticated;
grant select (id, url, league, home_name, away_name, note, starts_at, status, created_at, expires_at)
  on public.live_hub_game_links to anon, authenticated;
grant insert (url, league, home_name, away_name, note, starts_at, status)
  on public.live_hub_game_links to authenticated;
grant update (status) on public.live_hub_game_links to authenticated;
grant delete on public.live_hub_game_links to authenticated;
