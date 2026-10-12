CREATE OR REPLACE FUNCTION public.route_vod_player_reports()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  game_season integer;
  game_week integer;
  entry record;
  target_locker uuid;
  matches integer;
  current_seasons integer;
begin
  if new.worker_status <> 'ready_for_review' or new.created_by is null then return new; end if;
  -- Structured period reports use the approved publication workflow; do not route drafts.
  if jsonb_typeof(new.worker_result->'period_reports')='array' then
    if jsonb_array_length(new.worker_result->'period_reports')>=3 then return new; end if;
  end if;
  if jsonb_typeof(new.worker_result->'chunks') is distinct from 'array' then return new; end if;

  if new.schedule_game_id is not null then
    select season,week into game_season,game_week
    from public.hitmen_schedule_games
    where id=new.schedule_game_id and team_id=new.team_id;
    if game_season is null then return new; end if;
  else
    select count(distinct season),min(season) into current_seasons,game_season
    from public.team_player_lockers where team_id=new.team_id;
    if current_seasons <> 1 then return new; end if;
  end if;

  for entry in
    select
      lower(btrim(p->>'player')) as player_key,
      regexp_replace(lower(btrim(p->>'player')), '[^a-z0-9]+', ' ', 'g') as player_norm,
      string_agg(distinct nullif(p->>'strengths',''), E'\n') as strengths,
      string_agg(distinct nullif(p->>'concerns',''), E'\n') as improvements,
      string_agg(distinct nullif(p->>'habits',''), E'\n') as tactical_notes,
      string_agg(distinct nullif(p->>'coach_note',''), E'\n') as coach_summary,
      jsonb_agg(distinct jsonb_build_object(
        'period',c->>'label','start',c->'start','end',c->'end',
        'player',p->>'player','confidence',p->>'confidence',
        'timestamps',p->'evidence_timestamps'
      )) as evidence
    from jsonb_array_elements(new.worker_result->'chunks') c
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(c#>'{review,player_evaluations}')='array'
        then c#>'{review,player_evaluations}' else '[]'::jsonb end
    ) p
    where nullif(btrim(p->>'player'),'') is not null
      and jsonb_typeof(p->'evidence_timestamps')='array'
      and jsonb_array_length(p->'evidence_timestamps')>0
      and exists (
        select 1
        from jsonb_array_elements(
          case when jsonb_typeof(c#>'{review,observations}')='array'
            then c#>'{review,observations}' else '[]'::jsonb end
        ) o
        where lower(btrim(o->>'player'))=lower(btrim(p->>'player'))
          and o->>'source'='gameplay'
      )
    group by lower(btrim(p->>'player')),
             regexp_replace(lower(btrim(p->>'player')), '[^a-z0-9]+', ' ', 'g')
    order by lower(btrim(p->>'player'))
  loop
    select count(distinct candidate_locker),(array_agg(distinct candidate_locker))[1]
      into matches,target_locker
    from (
      select l.id as candidate_locker
      from public.team_player_lockers l
      left join public.hitmen_discord_player_links d
        on d.locker_id=l.id and d.season=l.season
      where l.team_id=new.team_id
        and l.season=game_season
        and (
          regexp_replace(lower(btrim(l.gamertag)), '[^a-z0-9]+', ' ', 'g')=entry.player_norm
          or (
            d.roster_alias is not null
            and (
              regexp_replace(lower(btrim(d.roster_alias)), '[^a-z0-9]+', ' ', 'g')=entry.player_norm
              or (
                length(regexp_replace(lower(btrim(d.roster_alias)), '[^a-z0-9]+', ' ', 'g'))>=3
                and (
                  entry.player_norm like '% ' || regexp_replace(lower(btrim(d.roster_alias)), '[^a-z0-9]+', ' ', 'g')
                  or entry.player_norm like regexp_replace(lower(btrim(d.roster_alias)), '[^a-z0-9]+', ' ', 'g') || ' %'
                )
              )
            )
          )
        )
      union
      select va.locker_id
      from private.vod_player_aliases va
      where va.team_id=new.team_id
        and va.season=game_season
        and regexp_replace(lower(btrim(va.source_alias)), '[^a-z0-9]+', ' ', 'g')=entry.player_norm
    ) candidates;

    if matches <> 1 then continue; end if;

    insert into public.team_player_game_reports
      (team_id,season,locker_id,ai_review_id,schedule_game_id,week,game_date,opponent_name,
       strengths,improvements,tactical_notes,coach_summary,evidence,visibility,created_by)
    values (
      new.team_id,game_season,target_locker,new.id,new.schedule_game_id,game_week,
      new.game_date,new.opponent_label,entry.strengths,entry.improvements,entry.tactical_notes,
      '[AI draft — needs management review]' || E'\n' || coalesce(entry.coach_summary,''),
      jsonb_build_object(
        'source','vod_ai','review_id',new.id,'vod_url',new.vod_url,
        'source_offset_seconds',new.source_start_seconds,'verification','needs_review',
        'source_player_label',entry.player_key,'chunks',entry.evidence
      ),
      'management',new.created_by
    )
    on conflict (ai_review_id,locker_id) where ai_review_id is not null do nothing;
  end loop;

  return new;
end
$function$
;

