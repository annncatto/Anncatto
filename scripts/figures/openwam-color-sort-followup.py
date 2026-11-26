"""Build the 6-run color-sorting follow-up figures (EN/ZH) in native Anncatto palette.

Usage:
  python scripts/figures/openwam-color-sort-followup.py REPORT_DIR [--site-output DIR] [--note-output DIR]
"""
import argparse
import hashlib
import json
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Native Anncatto palette
INK = '#273b43'
MUTED = '#61747b'
LINE = '#dce9e9'
FT = '#556b73'
RESTART = '#237ab2'
PI05 = '#4b9c80'
ALERT = '#b55d4c'

BADGE_STYLES = {
    'ok': ('#eef6f1', '#bfd9cc', '#2f755d'),
    'warn': ('#eff4f4', '#c5d4d7', '#4a5f67'),
    'err': ('#faf1ef', '#dfb8b0', '#9b4a3c'),
}

# All 6 verified November 26 live episodes with diagnostic keyframes
CASES = (
    (
        'openwam-success',
        'Restarted 10k · 51.2 s',
        '重训 10k · 51.2 s',
        'Clean success',
        '正确清空',
        'ok',
        (0.0, 45.6, 51.1),
        ('Start (cross-side green)', 'Green → green basket', 'Tabletop cleared'),
        ('起点（蓝侧绿块）', '绿块送入绿篮', '桌面清空无误投'),
    ),
    (
        'openwam-failure',
        'Restarted 10k · 59.6 s',
        '重训 10k · 59.6 s',
        'Wrong basket',
        '绿入蓝篮',
        'err',
        (0.0, 13.7, 59.5),
        ('Start (3 blocks)', 'Green in blue basket', 'Green still in blue'),
        ('起点（三块）', '绿块落入蓝篮', '重摆后仍混绿'),
    ),
    (
        'openwam-finetuned',
        'Fine-tuned 10k · 59.7 s',
        '微调 10k · 59.7 s',
        'Wrong basket',
        '绿入蓝篮',
        'err',
        (0.0, 20.0, 59.6),
        ('Start (same 3-block)', 'Cross-side green → blue', 'Again in blue after reset'),
        ('起点（同三块布局）', '蓝侧绿块入蓝篮', '重摆后再入蓝篮'),
    ),
    (
        'pi05-short',
        'π0.5 21k · 29.9 s',
        'π0.5 21k · 29.9 s',
        'Clean success',
        '正确清空',
        'ok',
        (0.0, 18.0, 29.8),
        ('Start (same 3-block)', 'Cross-side green → green', 'Cleared, no reset'),
        ('起点（同三块布局）', '跨侧绿块入绿篮', '无介入清空'),
    ),
    (
        'pi05-success',
        'π0.5 21k · 59.9 s',
        'π0.5 21k · 59.9 s',
        'Reset + late success',
        '重摆后末段入绿',
        'warn',
        (0.0, 13.3, 59.8),
        ('Start (double-crossed)', 'Early error + reset', 'Late green → green basket'),
        ('起点（双色交叉）', '前段误投 + 人工重摆', '末段绿块入绿篮'),
    ),
    (
        'pi05-failure',
        'π0.5 21k · 47.8 s',
        'π0.5 21k · 47.8 s',
        'Wrong basket',
        '双色误投',
        'err',
        (0.0, 5.3, 10.6),
        ('Start (double-crossed)', 'Blue over green basket', 'Green in blue + reset'),
        ('起点（双色交叉）', '蓝块送至绿篮上', '绿入蓝篮 + 重摆'),
    ),
)


def read_rows(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def stitch(original, resumed, boundary, final_step):
    rows = [row for row in original if row['step'] <= boundary]
    rows.extend(row for row in resumed if boundary < row['step'] <= final_step)
    return rows


def style_rc(lang):
    fonts = ['Noto Sans CJK JP', 'DejaVu Sans'] if lang == 'zh' else ['DejaVu Sans']
    plt.rcParams.update({
        'font.family': fonts,
        'font.size': 10.5,
        'axes.titlesize': 12,
        'axes.titleweight': 'semibold',
        'axes.labelsize': 10,
        'axes.spines.top': False,
        'axes.spines.right': False,
        'axes.edgecolor': '#b9cccf',
        'text.color': INK,
        'axes.labelcolor': INK,
        'xtick.color': MUTED,
        'ytick.color': MUTED,
        'axes.unicode_minus': False,
        'svg.fonttype': 'none',
        'svg.hashsalt': f'color-sort-{lang}',
        'savefig.facecolor': 'white',
        'figure.facecolor': 'white',
    })


def training_curve(root, outputs, note_output):
    ow = root / 'openwam'
    ow_ft = root / 'openwam-finetuned'
    pi = root / 'pi05'
    pi_resume = 'from-20000-1795096563349587876.jsonl'
    sources = {
        'openwam': (ow / 'metrics.jsonl', ow / 'validation-metrics.jsonl'),
        'openwam-finetuned': (ow_ft / 'metrics.jsonl', ow_ft / 'validation-metrics.jsonl'),
        'pi05': (
            pi / 'metrics.jsonl',
            pi / 'validation-metrics.jsonl',
            pi / ('metrics-' + pi_resume),
            pi / ('validation-metrics-' + pi_resume),
        ),
    }
    ow_train, ow_val = map(read_rows, sources['openwam'])
    ft_train, ft_val = map(read_rows, sources['openwam-finetuned'])
    pi_train, pi_val, pi_restart, pi_val_restart = map(read_rows, sources['pi05'])

    data_groups = (
        ('openwam', 'loss_action', ow_train, ow_val, 10000),
        ('openwam-finetuned', 'loss_action', ft_train, ft_val, 10000),
        ('pi05', 'loss_flow', stitch(pi_train, pi_restart, 20000, 21000),
         stitch(pi_val, pi_val_restart, 20000, 21000), 21000),
    )

    result = {}
    parsed = {}
    for method, field, train, val, step in data_groups:
        assert [row['step'] for row in train] == list(range(1, step + 1))
        values = np.array([row['metrics'][field] for row in train])
        block = values.reshape(-1, 200)
        bin_ends = np.arange(1, len(block) + 1) * 200
        centers = bin_ends - 99.5
        means = block.mean(axis=1)
        val_x = np.array([row['step'] for row in val])
        val_y = np.array([row['metrics'][field] for row in val])
        parsed[method] = (centers / 1000, means, val_x / 1000, val_y, step)
        result[method] = {
            'objective': field,
            'checkpoint_step': step,
            'training_bin_steps': 200,
            'training_bins': [[int(x), float(y)] for x, y in zip(bin_ends, means, strict=True)],
            'validation': {int(x): float(y) for x, y in zip(val_x, val_y, strict=True)},
            'source_sha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sources[method]},
        }

    for lang in ('en', 'zh'):
        style_rc(lang)
        zh = (lang == 'zh')
        fig, axes = plt.subplots(1, 2, figsize=(11.0, 4.35), layout='constrained')

        # Left: OpenWAM Restarted 10k & Fine-tuned 10k
        for method, col, name in [
            ('openwam', RESTART, '重训 10k' if zh else 'Restarted 10k'),
            ('openwam-finetuned', FT, '微调 10k' if zh else 'Fine-tuned 10k'),
        ]:
            cx, my, vx, vy, _ = parsed[method]
            axes[0].plot(cx, my, color=col, lw=2.0, label=f'{name} {"训练" if zh else "train"}')
            axes[0].plot(vx, vy, 'o--', color=col, ms=4.5, lw=1.6, label=f'{name} {"旧验证" if zh else "old val"}')

        axes[0].axvline(10.0, color=MUTED, ls=':', lw=1.3)
        axes[0].text(9.85, 0.48, '实机 10k' if zh else 'Robot 10k', ha='right', va='top', fontsize=8.5, color=MUTED)
        axes[0].annotate(
            '重训 6k 最低 0.016' if zh else 'Restarted 6k min 0.016',
            xy=(6.0, 0.01579), xytext=(4.2, 0.055),
            fontsize=8.4, color=RESTART, fontweight='semibold',
            arrowprops=dict(arrowstyle='->', color=RESTART, lw=1.0),
        )
        axes[0].set(
            title='OpenWAM · 动作 flow loss' if zh else 'OpenWAM · action flow loss',
            xlabel='优化器更新步数（k）' if zh else 'Optimizer updates (k)',
            ylabel='记录目标值（对数）' if zh else 'Logged objective (log)',
            yscale='log',
            xlim=(0, 10.6),
            ylim=(0.0045, 1.8),
        )
        axes[0].grid(axis='y', which='major', color=LINE, lw=0.85)
        axes[0].legend(loc='upper right', bbox_to_anchor=(0.94, 1.0), frameon=False, fontsize=8.3)

        # Right: pi0.5 21k
        cx, my, vx, vy, _ = parsed['pi05']
        axes[1].plot(cx, my, color=PI05, lw=2.1, label='π0.5 训练（200 步均值）' if zh else 'π0.5 train (200-step mean)')
        axes[1].plot(vx, vy, 'o--', color=ALERT, ms=4.2, lw=1.8, label='共同旧验证（6 条示教）' if zh else 'Shared old val (6 demos)')
        axes[1].axvline(21.0, color=MUTED, ls=':', lw=1.3)
        axes[1].text(20.65, 0.012, '实机 21k' if zh else 'Robot 21k', ha='right', va='center', fontsize=8.5, color=MUTED)
        axes[1].annotate(
            '旧验证 0.025 → 0.059（2.4×）' if zh else 'Old val 0.025 → 0.059 (2.4×)',
            xy=(21.0, 0.05945), xytext=(7.2, 0.088),
            fontsize=8.6, color=ALERT, fontweight='semibold',
            arrowprops=dict(arrowstyle='->', color=ALERT, lw=1.05, connectionstyle='arc3,rad=-0.08'),
        )
        axes[1].set(
            title='π0.5 · flow loss（训练下降、旧验证持续上升）' if zh else 'π0.5 · flow loss (train drops, old val rises)',
            xlabel='优化器更新步数（k）' if zh else 'Optimizer updates (k)',
            ylabel='记录目标值（对数）' if zh else 'Logged objective (log)',
            yscale='log',
            xlim=(0, 22.0),
            ylim=(0.0022, 0.16),
        )
        axes[1].grid(axis='y', which='major', color=LINE, lw=0.85)
        axes[1].legend(loc='lower left', frameon=False, fontsize=8.5)

        suffix = '-zh' if lang == 'zh' else ''
        for dest in outputs:
            svg = dest / f'color-sort-followup-training{suffix}.svg'
            fig.savefig(svg, metadata={'Date': None}, facecolor='white')
            svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines()) + '\n')
        if lang == 'zh' and note_output:
            fig.savefig(note_output / 'OpenWAM-155真机训练曲线.png', dpi=180, facecolor='white')
        plt.close(fig)

    return result


def load_fonts(zh):
    if zh:
        # NotoSansCJK TTC index 2 = SC
        for path in ('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
                     '/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc'):
            if Path(path).exists():
                return (
                    ImageFont.truetype(path, 22, index=2),
                    ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc', 16, index=2),
                    ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc', 15, index=2),
                )
    return (
        ImageFont.truetype('DejaVuSans-Bold.ttf', 21),
        ImageFont.truetype('DejaVuSans.ttf', 16),
        ImageFont.truetype('DejaVuSans.ttf', 15),
    )


def rollout_figures(root, outputs, note_output):
    width, height, pad, row_height = 340, 200, 16, 266
    canvas_w = 3 * width + 4 * pad
    canvas_h = row_height * len(CASES) + pad
    rollouts = {}

    for lang in ('en', 'zh'):
        zh = (lang == 'zh')
        f_title, f_badge, f_sub = load_fonts(zh)
        canvas = Image.new('RGB', (canvas_w, canvas_h), '#ffffff')
        draw = ImageDraw.Draw(canvas)

        for index, (case, en_lbl, zh_lbl, en_badge, zh_badge, btype, times, en_caps, zh_caps) in enumerate(CASES):
            folder = root / case
            summary = json.loads((folder / 'summary.json').read_text())
            frames = {
                frame['requested_time_s']: frame for frame in summary['keyframes']
                if frame['run'] == 'evaluation' and frame['camera'] == 'forward'
            }
            y = index * row_height + pad
            if index > 0:
                draw.line([(pad, y - 8), (canvas_w - pad, y - 8)], fill=LINE, width=1)

            title_txt = zh_lbl if zh else en_lbl
            badge_txt = zh_badge if zh else en_badge
            draw.text((pad, y), title_txt, font=f_title, fill=INK)

            # Pill badge vertically centered to title
            tb = draw.textbbox((pad, y), title_txt, font=f_title)
            bb = draw.textbbox((0, 0), badge_txt, font=f_badge)
            tw, th = bb[2] - bb[0], bb[3] - bb[1]
            bw, bh = tw + 18, th + 10
            bx = tb[2] + 12
            by = round((tb[1] + tb[3] - bh) / 2)
            bfill, bstroke, bcolor = BADGE_STYLES[btype]
            draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=12, fill=bfill, outline=bstroke, width=1)
            draw.text((bx + 9 - bb[0], by + 5 - bb[1]), badge_txt, font=f_badge, fill=bcolor)

            chosen = []
            caps = zh_caps if zh else en_caps
            for column, (query, cap) in enumerate(zip(times, caps, strict=True)):
                frame = frames[query]
                x = pad + column * (width + pad)
                with Image.open(folder / frame['path']) as source:
                    photo = source.convert('RGB')
                photo = photo.crop((0, round(photo.height * 0.14), photo.width, round(photo.height * 0.95)))
                photo.thumbnail((width, height), Image.Resampling.LANCZOS)
                px = x + (width - photo.width) // 2
                py = y + 34
                canvas.paste(photo, (px, py))
                draw.rectangle([px, py, px + photo.width - 1, py + photo.height - 1], outline='#d2e0e0', width=1)
                draw.text((px + 2, py + photo.height + 5), f'{frame["time_s"]:.1f} s · {cap}', font=f_sub, fill=MUTED)
                chosen.append({'time_s': frame['time_s'], 'frame': frame['frame_index']})

            if lang == 'en':
                rollouts[case] = {
                    'episode': summary['episode'],
                    'rows': summary['selected_rows'],
                    'duration_s': summary['duration_s'],
                    'time_basis': summary['time_basis'],
                    'recorded_frame_hz': summary['recorded_frame_hz'],
                    'command_hz_estimate': summary['command_hz_estimate'],
                    'fixed_targets': summary['fixed_dimensions']['targets'],
                    'policy_cameras': 3 if case.startswith('openwam') else 4,
                    'keyframes': chosen,
                    'weights_sha256': summary['model_context']['checkpoint']['weights_sha256'],
                }

        suffix = '-zh' if zh else ''
        for dest in outputs:
            canvas.save(dest / f'color-sort-followup-keyframes{suffix}.webp', quality=90, method=6)
        if zh and note_output:
            canvas.save(note_output / 'OpenWAM-155真机关键帧.webp', quality=90, method=6)

    return rollouts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('report', type=Path)
    parser.add_argument('--site-output', type=Path, default=Path(__file__).resolve().parents[2] / 'content/images/openwam-slots')
    parser.add_argument('--note-output', type=Path)
    args = parser.parse_args()

    outputs = [args.report]
    if args.site_output and args.site_output.resolve() != args.report.resolve():
        args.site_output.mkdir(parents=True, exist_ok=True)
        outputs.append(args.site_output)
    if args.note_output:
        args.note_output.mkdir(parents=True, exist_ok=True)

    result = {
        'date': '2026-11-26',
        'training': training_curve(args.report / 'training', outputs, args.note_output),
        'rollouts': rollout_figures(args.report / 'episodes', outputs, args.note_output),
    }
    payload = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    assert not any(s in payload for s in ['/home/', '192.168.', '183.230.', 'Gpu@', 'password'])
    for dest in outputs:
        (dest / 'color-sort-followup-summary.json').write_text(payload)
    print(f'Exported 6-run bilingual keyframes, training curves, and summary JSON ({len(result["rollouts"])} rollouts).')


if __name__ == '__main__':
    main()
