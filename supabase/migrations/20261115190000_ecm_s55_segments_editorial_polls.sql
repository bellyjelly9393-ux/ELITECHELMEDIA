-- STAGED ONLY: do not apply until owner approves publication and staff grants.
-- Season 55 segment editor and fan polls. Independent from predictor and private Elite Labs.
-- Explicit role grants, never trust client-editable profiles.role or team membership roles.
create table if not exists public.ecm_s55_segment_editors (
 user_id uuid primary key references auth.users(id) on delete cascade,
 granted_at timestamptz not null default now(),
 granted_by uuid
);
alter table public.ecm_s55_segment_editors enable row level security;
revoke all on public.ecm_s55_segment_editors from anon,authenticated;
grant select on public.ecm_s55_segment_editors to authenticated;
create policy "Assigned editor reads own assignment" on public.ecm_s55_segment_editors
 for select to authenticated using (user_id=(select auth.uid()));
-- Staff provisioning is deliberately not accessible to the website.
-- Owner provisions/removes by privileged admin SQL after explicit approval.

create table if not exists public.ecm_s55_segment_editorial (
 id uuid primary key default gen_random_uuid(),
 season integer not null default 55 check(season=55),
 kind text not null check(kind in ('pressure','rivalry','road')),
 target_id integer not null check(target_id>0),
 label text check(label is null or label in ('RED HOT','FEELING THE HEAT','ON THE BRINK','ICE COLD','BUILT DIFFERENT')),
 previous_label text,
 reason text not null default '' check(length(reason)<=500),
 body text not null default '' check(length(body)<=7000),
 players jsonb not null default '[]'::jsonb check(jsonb_typeof(players)='array'),
 moment jsonb not null default '{}'::jsonb check(jsonb_typeof(moment)='object'),
 featured boolean not null default false,
 published boolean not null default false,
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 unique(season,kind,target_id),
 constraint ecm_s55_pressure_only_label check(kind='pressure' or label is null),
 constraint ecm_s55_pressure_needs_reason check(not (kind='pressure' and published) or (label is not null and length(btrim(reason))>=8))
);
create index if not exists ecm_s55_editorial_public_idx on public.ecm_s55_segment_editorial(kind,featured,updated_at desc) where published;
alter table public.ecm_s55_segment_editorial enable row level security;
revoke all on public.ecm_s55_segment_editorial from anon,authenticated;
grant select on public.ecm_s55_segment_editorial to anon,authenticated;
grant insert,update,delete on public.ecm_s55_segment_editorial to authenticated;
create policy "View published editorials" on public.ecm_s55_segment_editorial
 for select to anon,authenticated using(published=true and season=55);
create policy "Editors view drafts" on public.ecm_s55_segment_editorial
 for select to authenticated using(exists(select 1 from public.ecm_s55_segment_editors e where e.user_id=(select auth.uid())));
create policy "Editors create editorials" on public.ecm_s55_segment_editorial
 for insert to authenticated with check(exists(select 1 from public.ecm_s55_segment_editors e where e.user_id=(select auth.uid())));
create policy "Editors update editorials" on public.ecm_s55_segment_editorial
 for update to authenticated using(exists(select 1 from public.ecm_s55_segment_editors e where e.user_id=(select auth.uid())))
 with check(exists(select 1 from public.ecm_s55_segment_editors e where e.user_id=(select auth.uid())));
create policy "Editors delete editorials" on public.ecm_s55_segment_editorial
 for delete to authenticated using(exists(select 1 from public.ecm_s55_segment_editors e where e.user_id=(select auth.uid())));
create or replace function public.ecm_s55_editorial_track_change()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and new.label is distinct from old.label then
  new.previous_label:=old.label;
 elsif tg_op='INSERT' then new.previous_label:=null;
 else new.previous_label:=old.previous_label;end if;
 new.updated_by:=auth.uid();
 new.updated_at:=now();
 return new;
end;$$;
create trigger ecm_s55_editorial_changes before insert or update on public.ecm_s55_segment_editorial
 for each row execute function public.ecm_s55_editorial_track_change();

create table if not exists public.ecm_s55_rivalry_polls(
 id uuid primary key default gen_random_uuid(),
 season integer not null default 55 check(season=55),
 series_id integer not null check(series_id>0),
 question text not null check(length(btrim(question)) between 8 and 220),
 options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 5),
 status text not null default 'closed' check(status in ('open','closed')),
 published boolean not null default false,
 created_by uuid references auth.users(id),
 updated_at timestamptz not null default now()
);
create index if not exists ecm_s55_rivalry_polls_series_idx on public.ecm_s55_rivalry_polls(series_id,published,status);
alter table public.ecm_s55_rivalry_polls enable row level security;
revoke all on public.ecm_s55_rivalry_polls from anon,authenticated;
grant select on public.ecm_s55_rivalry_polls to anon,authenticated;
grant insert,update,delete on public.ecm_s55_rivalry_polls to authenticated;
create policy "Published rivalry polls visible" on public.ecm_s55_rivalry_polls
 for select to anon,authenticated using(published and season=55);
create policy "Assigned editors view poll drafts" on public.ecm_s55_rivalry_polls
 for select to authenticated using(exists(select 1 from public.ecm_s55_segment_editors e where e.user_id=(select auth.uid())));
create policy "Assigned editors create polls" on public.ecm_s55_rivalry_polls
 for insert to authenticated with check(exists(select 1 from public.ecm_s55_segment_editors e where e.user_id=(select auth.uid())));
create policy "Assigned editors edit polls" on public.ecm_s55_rivalry_polls
 for update to authenticated using(exists(select 1 from public.ecm_s55_segment_editors e where e.user_id=(select auth.uid())))
 with check(exists(select 1 from public.ecm_s55_segment_editors e where e.user_id=(select auth.uid())));
create policy "Assigned editors delete polls" on public.ecm_s55_rivalry_polls
 for delete to authenticated using(exists(select 1 from public.ecm_s55_segment_editors e where e.user_id=(select auth.uid())));

create table if not exists public.ecm_s55_rivalry_votes(
 poll_id uuid not null references public.ecm_s55_rivalry_polls(id) on delete cascade,
 voter_id uuid not null references auth.users(id) on delete cascade,
 choice smallint not null check(choice between 0 and 4),
 voted_at timestamptz not null default now(),
 primary key(poll_id,voter_id)
);
create index if not exists ecm_s55_votes_poll_idx on public.ecm_s55_rivalry_votes(poll_id,choice);
alter table public.ecm_s55_rivalry_votes enable row level security;
revoke all on public.ecm_s55_rivalry_votes from anon,authenticated;
grant select,insert on public.ecm_s55_rivalry_votes to authenticated;
create policy "Fans view only their own vote" on public.ecm_s55_rivalry_votes
 for select to authenticated using(voter_id=(select auth.uid()));
create policy "One signed-in fan vote per published open poll" on public.ecm_s55_rivalry_votes
 for insert to authenticated with check(
  voter_id=(select auth.uid()) and exists(
   select 1 from public.ecm_s55_rivalry_polls p
   where p.id=poll_id and p.published and p.status='open'
    and p.season=55 and choice<jsonb_array_length(p.options)
  )
 );
-- No UPDATE or DELETE grants or policies: a fan cannot revise an existing vote.
-- Controlled read-only aggregation for public percentages. Never returns voter identities.
create or replace function public.ecm_s55_poll_results(p_poll_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_options jsonb;v_total integer;v_counts jsonb;
begin
 select p.options into v_options from public.ecm_s55_rivalry_polls p
 where p.id=p_poll_id and p.published and p.season=55;
 if not found then return null;end if;
 select count(*) into v_total from public.ecm_s55_rivalry_votes v where v.poll_id=p_poll_id;
 select coalesce(jsonb_agg((select count(*) from public.ecm_s55_rivalry_votes v
   where v.poll_id=p_poll_id and v.choice=i)::integer order by i),'[]'::jsonb)
 into v_counts from generate_series(0,jsonb_array_length(v_options)-1) i;
 return jsonb_build_object('total',v_total,'counts',v_counts);
end;$$;
revoke all on function public.ecm_s55_poll_results(uuid) from public;
grant execute on function public.ecm_s55_poll_results(uuid) to anon,authenticated;
-- Auditing, rate limiting and authentication abuse monitoring are release gates.
