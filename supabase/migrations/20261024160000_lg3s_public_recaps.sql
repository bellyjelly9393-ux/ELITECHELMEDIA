-- Public read of approved LG3S game recaps only. Drafts, prompts and review notes stay private.
-- Night grouping stays on lg3s_public_games.game_night_date (Eastern time, minus 6 hours,
-- so a game after midnight remains on the previous night). No new game_day column.

drop policy if exists lg3s_editorial_approved_recap_read on public.lg3s_editorial_posts;
create policy lg3s_editorial_approved_recap_read
  on public.lg3s_editorial_posts
  for select
  to anon, authenticated
  using (
    article_type = 'recap'
    and status in ('approved', 'published')
    and lg_game_id is not null
  );

grant select (id, lg_game_id, game_night_date, title, body_md, article_type, status)
  on public.lg3s_editorial_posts to anon, authenticated;

create or replace view public.lg3s_public_recaps
  with (security_invoker = true) as
select id, lg_game_id, game_night_date, title, body_md
from public.lg3s_editorial_posts
where article_type = 'recap'
  and status in ('approved', 'published')
  and lg_game_id is not null;

grant select on public.lg3s_public_recaps to anon, authenticated;
