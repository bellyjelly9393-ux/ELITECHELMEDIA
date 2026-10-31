-- Threes Desk: expose published Roster Wire and Pick Your 3 (prices) alongside Daily Three and Duo Index.
-- Same rules as before: published, not superseded, structured output only.
create or replace view public.lg3s_public_threes with (security_invoker = false) as
select id, article_type as feature, period_key, game_night_date, week, title, output_json, reviewed_at
from public.lg3s_editorial_posts
where article_type in ('daily_three', 'duo_index', 'roster_wire', 'pick3_preview')
  and status = 'published' and superseded_by is null and output_json is not null;
grant select on public.lg3s_public_threes to anon, authenticated;
