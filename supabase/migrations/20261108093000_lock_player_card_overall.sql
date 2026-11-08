-- Legacy stored overrides are ignored by clients. Reject new or updated overrides.
alter table public.elitechel_player_cards add constraint elitechel_player_cards_no_manual_overall check (self_reported_overall is null) not valid;
