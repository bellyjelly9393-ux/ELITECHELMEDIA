-- Public read of approved/published LG3S matchup previews only (additive). Drafts stay private.
drop policy if exists lg3s_editorial_approved_preview_read on public.lg3s_editorial_posts;
create policy lg3s_editorial_approved_preview_read
  on public.lg3s_editorial_posts for select to anon, authenticated
  using (article_type = 'preview' and status in ('approved','published') and lg_game_id is not null);

grant select (id, lg_game_id, game_night_date, title, body_md, article_type, status)
  on public.lg3s_editorial_posts to anon, authenticated;

create or replace view public.lg3s_public_previews with (security_invoker = true) as
select id, lg_game_id, game_night_date, title, body_md
from public.lg3s_editorial_posts
where article_type = 'preview' and status in ('approved','published') and lg_game_id is not null;

grant select on public.lg3s_public_previews to anon, authenticated;
