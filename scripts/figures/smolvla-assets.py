"""Prepare compact, silent article media and public dataset summaries.

Run with the existing LeRobot Python environment (Pillow, pandas, numpy).
Inputs stay outside the repository; the output excludes machine paths.
"""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.request

import numpy as np
import pandas as pd
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--attachments', type=Path, required=True)
parser.add_argument('--dataset', type=Path, required=True)
parser.add_argument('--evaluation', type=Path, required=True)
args = parser.parse_args()
out = Path('content/images/smolvla')
out.mkdir(parents=True, exist_ok=True)
clips = {
    'success-left': '9de669de1604c933d0822716d564554f',
    'success-center': 'ced948987c368a6acda4a330cd793ab0',
    'success-right': '8055fefe49b049230add478dbf21dfef',
    'failure-grasp': 'e095f23aa3eafa15168eda46bf3dedcb',
    'failure-base': 'a617a8093ad63c2b3fa02182e980a980',
    'initial-pose-a': '308638cf7291fe2a0f51ff4698a02510',
    'initial-pose-b': '9f905a014674f5718aa2c513bc63aa1a',
    'continued-missed-grasp': 'ce880698f9361c4dfe414e08d09b832d',
    'continued-retreat': '31c00e038524576f695dfa4662d8516d',
    'continued-success': '034996589714449c02a1d65d49e457ef',
    'pi05-rollout': '25a4fbec59b03033bbbe9223fdfa8b09',
    'two-toys-a': 'c7b190b08db6d7612b35c4d4f7d49c47',
    'two-toys-b': 'ee0ef24a478bbbd88b8e725351e208a0',
}

def encode(item):
    name, source = item
    src = args.attachments / (source + '.mp4')
    probe = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(src)]))
    duration = float(probe['format']['duration'])
    dst = out / (name + '.mp4')
    subprocess.run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', str(src),
                    '-map', '0:v:0', '-an', '-vf', "scale='min(720,iw)':-2,fps=20",
                    '-c:v', 'libx264', '-threads', '2', '-preset', 'medium', '-crf', '28',
                    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(dst)], check=True)
    subprocess.run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-ss', str(min(2, duration / 10)),
                    '-i', str(dst), '-frames:v', '1', str(out / (name + '.webp'))], check=True)
    return {'id': name, 'durationSeconds': round(duration, 3), 'playbackSpeed': 1,
            'sourceSha256': hashlib.sha256(src.read_bytes()).hexdigest(), 'bytes': dst.stat().st_size}

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    media = list(pool.map(encode, clips.items()))
(out / 'media.json').write_text(json.dumps(media, indent=2) + '\n')

figures = {
    'smolvla-paper.webp': 'https://arxiv.org/html/2506.01844v1/SmolVLA.png',
    'smolvlm-paper.webp': 'https://arxiv.org/html/2504.05299v1/smolvlm_architecture.png',
    'pi05-paper.webp': 'https://arxiv.org/html/2504.16054v1/Figure_3.png',
    'pi05-mask.webp': 'https://arxiv.org/html/2504.16054v1/figures/attention_mask.png',
}
for name, url in figures.items():
    import io
    im = Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=45).read())).convert('RGB')
    im.thumbnail((2000, 1600))
    im.save(out / name, quality=92)
for name in ['arm_right', 'arm_left', 'other']:
    Image.open(args.evaluation / 'plots' / (name + '.png')).convert('RGB').save(out / ('evaluation-' + name + '.webp'), quality=92)
for i, stamp in enumerate(['1793260739012', '1793260749527', '1793260766506']):
    im = Image.open(args.attachments / ('SmolVLA & 数值类型-' + stamp + '.webp'))
    im.thumbnail((700, 700))
    im.save(out / ('two-toys-layout-' + str(i+1) + '.webp'), quality=88)

info = json.loads((args.dataset / 'meta/info.json').read_text())
episodes = pd.concat([pd.read_parquet(f) for f in (args.dataset / 'meta/episodes').rglob('*.parquet')])
episodes = episodes.sort_values('episode_index')
lengths = episodes['length'].astype(int).tolist()
row = episodes.iloc[0]
views = ['forward', 'chest', 'wrist_left', 'wrist_right']
for view in views:
    key = 'videos/observation.images.' + view
    chunk, file = int(row[key + '/chunk_index']), int(row[key + '/file_index'])
    start = float(row[key + '/from_timestamp'])
    video = args.dataset / info['video_path'].format(video_key='observation.images.' + view, chunk_index=chunk, file_index=file)
    subprocess.run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-ss', str(start+2), '-i', str(video),
                    '-frames:v', '1', str(out / ('dataset-' + view + '.webp'))], check=True)
summary = {
    'episodes': len(lengths), 'frames': info['total_frames'], 'fps': info['fps'],
    'seconds': sum(lengths)/info['fps'], 'lengthFrames': lengths,
    'minEpisodeSeconds': min(lengths)/info['fps'], 'medianEpisodeSeconds': float(np.median(lengths))/info['fps'],
    'maxEpisodeSeconds': max(lengths)/info['fps'], 'cameras': views,
    'stateDimensions': 18, 'actionDimensions': 18,
    'validationSplitDeclared': False,
    'task': 'Pick up all the plush toys from the floor and place them into the box held by the left arm.'}
(out / 'dataset-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps({'mediaMB': sum(m['bytes'] for m in media)/1e6, 'dataset': summary}, ensure_ascii=False))
