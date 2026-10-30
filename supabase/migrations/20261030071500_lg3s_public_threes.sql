-- Public read of PUBLISHED Threes Desk segments (Daily Three, Duo Index) for the LG3s page cards.
-- Only status='published' (editor sign-off for public); 'approved' bot candidates stay private.
-- Same shape as lg3s_public_power_rankings (filtered, column-limited view).
create or replace view public.lg3s_public_threes with (security_invoker = false) as
select id, article_type as feature, period_key, game_night_date, week, title, output_json, reviewed_at
from public.lg3s_editorial_posts
where article_type in ('daily_three', 'duo_index')
  and status = 'published'
  and superseded_by is null
  and output_json is not null;

grant select on public.lg3s_public_threes to anon, authenticated;
