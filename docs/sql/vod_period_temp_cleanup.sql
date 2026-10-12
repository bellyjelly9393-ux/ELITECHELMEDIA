-- VOD period save: qualify only the temporary-table cleanup.
-- Preserves authentication, permissions, approved evidence and persistent data.
CREATE OR REPLACE FUNCTION public.set_vod_period_windows(target_review uuid, expected_updated_at timestamp with time zone, window_start integer, window_end integer, periods jsonb, skip_ranges jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare r public.vod_review_sessions; blocked text; bad text; kept integer; added integer; removed integer; ots integer;
begin
select * into r from public.vod_review_sessions where id=target_review for update;
if r.id is null or auth.uid() is null or not private.vvhl_can_manage_team(auth.uid(),r.team_id) then
raise exception 'Management access is required' using errcode='42501'; end if;
if expected_updated_at is not null and r.updated_at is distinct from expected_updated_at then
raise exception 'Game changed elsewhere. Refresh first.'; end if;
if window_start is null or window_end is null or window_start<0 or window_end<=window_start then
raise exception 'Enter a valid game start and game end.'; end if;
if jsonb_typeof(periods) is distinct from 'array' or jsonb_typeof(coalesce(skip_ranges,'[]'::jsonb)) is distinct from 'array' then
raise exception 'Invalid period list.'; end if;
create temporary table if not exists pg_temp.vd(t text, i integer, label text, a integer, b integer) on commit drop;
delete from pg_temp.vd where true;
insert into pg_temp.vd select d.segment_type,d.segment_index,d.label,d.start_seconds,d.end_seconds
from jsonb_to_recordset(periods) as d(segment_type text, segment_index integer, label text, start_seconds integer, end_seconds integer);
if exists(select 1 from pg_temp.vd where t not in ('period','overtime') or i is null or i<1
or coalesce(btrim(label),'')='' or a is null or b is null or b<=a
or a<window_start or b>window_end) then
raise exception 'Every period needs a start before its end, inside the game window.'; end if;
if (select count(distinct i) from pg_temp.vd where t='period' and i between 1 and 3)<>3 then
raise exception 'Enter the start of Period 1, Period 2 and Period 3.'; end if;
if exists(select 1 from pg_temp.vd group by t,i having count(*)>1)
or exists(select 1 from pg_temp.vd x join pg_temp.vd y on (x.t,x.i)<>(y.t,y.i)
and x.a<y.b and y.a<x.b) then
raise exception 'Periods overlap or repeat.'; end if;
select string_agg(x,', ') into bad from (select 'skip '||coalesce(e->>'start','?')||'-'||coalesce(e->>'end','?') x
from jsonb_array_elements(coalesce(skip_ranges,'[]'::jsonb)) e
where jsonb_typeof(e->'start')<>'number' or jsonb_typeof(e->'end')<>'number'
or (e->>'end')::numeric<=(e->>'start')::numeric or (e->>'start')::numeric<window_start or (e->>'end')::numeric>window_end) q;
if bad is not null then raise exception 'Invalid skipped section: %', bad; end if;
select string_agg(s.label,', ' order by s.start_seconds) into blocked from public.vod_review_segments s
where s.review_id=r.id and s.archived_at is null and s.segment_type in ('period','overtime') and s.status='complete'
and not exists(select 1 from pg_temp.vd d where (d.t,d.i,d.a,d.b)=(s.segment_type,s.segment_index,s.start_seconds,s.end_seconds));
if blocked is not null then
raise exception 'Reopen % before changing their times. Approved periods are protected.', blocked; end if;
update public.vod_review_segments s set archived_at=now(),archived_by=auth.uid(),updated_at=now()
where s.review_id=r.id and s.archived_at is null and s.segment_type in ('period','overtime')
and not exists(select 1 from pg_temp.vd d where (d.t,d.i,d.a,d.b)=(s.segment_type,s.segment_index,s.start_seconds,s.end_seconds));
get diagnostics removed=row_count;
update public.vod_review_segments s set label=d.label,updated_at=now() from pg_temp.vd d
where s.review_id=r.id and s.archived_at is null and (d.t,d.i,d.a,d.b)=(s.segment_type,s.segment_index,s.start_seconds,s.end_seconds)
and s.label is distinct from d.label;
insert into public.vod_review_segments(review_id,team_id,segment_type,segment_index,label,start_seconds,end_seconds,status,confidence)
select r.id,r.team_id,d.t,d.i,d.label,d.a,d.b,'queued','preliminary' from pg_temp.vd d
where not exists(select 1 from public.vod_review_segments s where s.review_id=r.id and s.archived_at is null
and (d.t,d.i,d.a,d.b)=(s.segment_type,s.segment_index,s.start_seconds,s.end_seconds));
get diagnostics added=row_count;
select count(*) into kept from pg_temp.vd; kept:=kept-added;
select count(*) into ots from pg_temp.vd where t='overtime';
update public.vod_review_sessions set source_start_seconds=window_start,source_end_seconds=window_end,
duration_seconds=window_end-window_start,skip_ranges=coalesce(set_vod_period_windows.skip_ranges,'[]'::jsonb),
overtime_count=ots,status=case when status in ('complete','archived') then status else 'reviewing' end,updated_at=now()
where id=r.id;
return jsonb_build_object('review_id',r.id,'kept',kept,'added',added,'archived',removed);
end $function$
;

