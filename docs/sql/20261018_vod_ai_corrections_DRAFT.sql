-- DRAFT - NOT APPLIED. Needs Seth's approval before anyone runs it.
-- Structured store for human corrections of AI VOD reviews (feeds few-shot examples).
-- The existing schema has no such place: vod_evidence_history keeps whole-row snapshots only.
create table if not exists public.vod_ai_corrections (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id),
  review_id uuid,
  at_seconds numeric,
  kind text not null check (kind in ('goal','penalty','power_play','player','period','zone','other')),
  wrong text not null default '',
  "right" text not null default '',
  note text not null default '',
  recorded_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.vod_ai_corrections enable row level security;
revoke all on public.vod_ai_corrections from anon, authenticated;
grant select, insert on public.vod_ai_corrections to authenticated;
create policy vod_ai_corrections_read on public.vod_ai_corrections for select to authenticated
  using (private.vvhl_can_manage_team(auth.uid(), team_id));
create policy vod_ai_corrections_insert on public.vod_ai_corrections for insert to authenticated
  with check (recorded_by = auth.uid() and private.vvhl_can_manage_team(auth.uid(), team_id));
create index if not exists vod_ai_corrections_team_time on public.vod_ai_corrections(team_id, created_at desc);
