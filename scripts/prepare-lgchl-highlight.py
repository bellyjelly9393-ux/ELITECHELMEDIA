#!/usr/bin/env python3
"""Cut a reviewed local source into a web MP4. Never publishes or reads private stores."""
import argparse,json,math,subprocess
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--source',type=Path,required=True)
p.add_argument('--game-id',type=int,required=True)
p.add_argument('--start',type=float,required=True,help='Seconds into source recording')
p.add_argument('--duration',type=float,default=20)
p.add_argument('--title',required=True)
p.add_argument('--source-url',required=True)
p.add_argument('--output',type=Path,required=True)
a=p.parse_args()
if not a.source.is_file() or a.game_id<=0 or not math.isfinite(a.start) or a.start<0 or not math.isfinite(a.duration) or not 1<=a.duration<=60 or not 1<=len(a.title)<=180 or not a.source_url.startswith('https://'):
 p.error('Use an existing recording, positive game ID, finite timestamp, 1–60 second duration, title and HTTPS source URL.')
a.output.mkdir(parents=True,exist_ok=True)
name=f'goal-{round(a.start*1000)}'
video=a.output/(name+'.mp4');poster=a.output/(name+'.jpg');record=a.output/(name+'.json')
if any(f.exists() for f in (video,poster,record)):p.error('Output exists; choose another output directory.')
subprocess.run(['ffmpeg','-nostdin','-n','-ss',str(a.start),'-i',str(a.source.resolve()),'-t',str(a.duration),'-map','0:v:0','-map','0:a:0?','-vf','scale=w=min(1280\\,iw):h=-2','-c:v','libx264','-preset','medium','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',str(video)],check=True)
subprocess.run(['ffmpeg','-nostdin','-n','-i',str(video),'-frames:v','1','-update','1',str(poster)],check=True)
row={'lg_game_id':a.game_id,'title':a.title,'video_path':f'season-55/{a.game_id}/{video.name}','poster_path':f'season-55/{a.game_id}/{poster.name}','source_url':a.source_url,'lg_user_ids':[],'verified_at':None,'published_at':None}
record.write_text(json.dumps(row,indent=2)+'\n')
print('Prepared MP4, poster and unpublished record. Review game identity and goal before public upload:',record)
