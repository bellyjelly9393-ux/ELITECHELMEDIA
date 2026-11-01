-- EliteChel player card beta: private account-owned card collection.
-- Records only player references and cosmetic selections. Character portraits remain device-local.
create table if not exists public.elitechel_player_cards (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  league text not null check (league in ('lgchl','lg3s')),
  lg_user_id bigint not null check (lg_user_id > 0),
  player_kind text not null check (player_kind in ('skater','goalie')),
  gamertag_snapshot text not null check (char_length(gamertag_snapshot) between 1 and 80),
  finish text not null default 'crimson' check (finish in ('crimson','gold','ice')),
  self_reported_overall smallint check (self_reported_overall between 1 and 99),
  jersey_number smallint check (jersey_number between 0 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id,league,lg_user_id,player_kind)
);
create index if not exists elitechel_player_cards_owner_created_idx
  on public.elitechel_player_cards(user_id,created_at desc);
alter table public.elitechel_player_cards enable row level security;
revoke all on public.elitechel_player_cards from anon,authenticated;
grant select, insert, update, delete on public.elitechel_player_cards to authenticated;
grant usage, select on sequence public.elitechel_player_cards_id_seq to authenticated;
create policy elitechel_cards_select on public.elitechel_player_cards
 for select to authenticated using ((select auth.uid()) = user_id);
create policy elitechel_cards_insert on public.elitechel_player_cards
 for insert to authenticated with check ((select auth.uid()) = user_id);
create policy elitechel_cards_update on public.elitechel_player_cards
 for update to authenticated using ((select auth.uid()) = user_id)
 with check ((select auth.uid()) = user_id);
create policy elitechel_cards_delete on public.elitechel_player_cards
 for delete to authenticated using ((select auth.uid()) = user_id);
comment on table public.elitechel_player_cards is
 'Beta private card collection: references verified public player feeds. User artwork is NOT uploaded here and self_reported_overall is NOT official league data.';
