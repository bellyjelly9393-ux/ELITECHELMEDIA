import { findRestartGroup, rawGoals } from './lib/opponent-refresh.mjs';
const c=(score,raw,dnf='0')=>({score:String(score),gfraw:String(raw),winnerByDnf:dnf});
const part1={matchId:'2284067020446',timestamp:1791769922,clubs:{'10290':c(3,1,'1'),'9495':c(0,2)}};
const part2={matchId:'2282343910189',timestamp:1791770915,clubs:{'10290':c(5,5,'1'),'9495':c(2,2)}};
const sas={matchId:'x',timestamp:1791768475,clubs:{'14873':c(3,3),'9495':c(1,1)}};
const sched=Date.parse('2026-10-11T21:35:00-04:00');
const g=findRestartGroup([sas,part2,part1],'10290','9495',6,4,sched);
console.log(g && g.parts.map(m=>m.matchId));
const ok = g && g.parts.map(m=>m.matchId).join()==='2284067020446,2282343910189';
// wrong final must not match; non-DNF first part must not match; used ids excluded
const no1=findRestartGroup([part1,part2],'10290','9495',5,4,sched);
const p1clean={...part1,clubs:{'10290':c(1,1),'9495':c(2,2)}};
const no2=findRestartGroup([p1clean,part2],'10290','9495',6,4,sched);
const no3=findRestartGroup([part1,part2],'10290','9495',6,4,sched,new Set(['2282343910189']));
console.log({ok, no1, no2, no3, raw:rawGoals({score:'0',gfraw:'2'})});
process.exit(ok&&!no1&&!no2&&!no3?0:1);
