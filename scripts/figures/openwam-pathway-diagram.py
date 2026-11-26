"""Draw the grouped video-to-action attention intervention in native Anncatto palette.

No model is loaded. The diagram matches Trace.mixed in the archived probe:
mask[..., 360:, :360] = False only within the selected five-layer group.
The inline web version adds interactive step-through controls (.sv-step-bar),
clickable SVG layer groups, synchronized velocity-deviation bars (.sv-live-bars),
and hover tooltips (.sv-svg-tip), while preserving static EN/ZH SVG exports.
"""
from html import escape
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'content/images/openwam-slots'
SUMMARY = json.loads((OUT / 'correction-network-summary.json').read_text())
FONT = "'IBM Plex Sans','Noto Sans SC','Noto Sans CJK JP',sans-serif"

INK = '#273b43'
MUTED = '#61747b'
SLATE = '#556b73'
ORIG = '#95a8ae'
SLATE_BG, SLATE_STROKE = '#eff4f4', '#c5d4d7'
BLUE, BLUE_BG, BLUE_STROKE = '#237ab2', '#edf5f8', '#b8d4e2'
GREEN, GREEN_BG, GREEN_STROKE = '#4b9c80', '#eef6f1', '#bfd9cc'
ALERT, ALERT_BG, ALERT_STROKE = '#b55d4c', '#faf1ef', '#dfb8b0'
SOFT_BG, LINE = '#f8fbfa', '#dce9e9'

GROUP_META = [
    ('0–4', '浅层入口 · 后续 25 层可部分补偿', 'Early entry · 25 later layers partly compensate'),
    ('5–9', '前段低谷 · 全网视觉依赖最低', 'Early-mid lull · lowest visual reliance'),
    ('10–14', '中段主融合前半 · 动作开始集中读视频', 'Mid-network band I · actions start heavy visual read'),
    ('15–19', '中段主融合后半 · 重训 10k 达中段次峰值', 'Mid-network band II · secondary peak for Restarted'),
    ('20–24', '中后段低谷 · 跨模态敏感度回落至 ~8%', 'Late-mid dip · sensitivity drops back to ~8%'),
    ('25–29', '末段输出前峰值 · 紧邻动作读出，冲击最大', 'Pre-readout peak · directly precedes velocity head'),
]


def group_values(idx: int):
    g_key = f'bridge_{idx*5:02d}_{idx*5+4:02d}'
    return (
        SUMMARY['models']['old']['bridge_groups'][g_key]['mean'] * 100,
        SUMMARY['models']['ft']['bridge_groups'][g_key]['mean'] * 100,
        SUMMARY['models']['base']['bridge_groups'][g_key]['mean'] * 100,
    )


def draw(language=None):
    items = []
    interactive = language is None

    def add(s):
        items.append(s)

    def text(x, y, zh, en=None, size=17, color=INK, weight=400, anchor='middle', extra=''):
        en = en or zh
        values = [('zh-CN', zh), ('en', en)] if interactive else [(language, zh if language == 'zh-CN' else en)]
        attr = f' {extra}' if extra else ''
        for lang, value in values:
            add(f'<text lang="{lang}" x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{weight}" text-anchor="{anchor}"{attr}>{escape(value)}</text>')

    def rect(x, y, w, h, fill='white', stroke=LINE, rx=8, sw=1.4, cls=''):
        c = f' class="{cls}"' if cls else ''
        add(f'<rect{c} x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')

    def line(x1, y1, x2, y2, color=SLATE, width=2, dashed=False, arrow=False, cls=''):
        dash = ' stroke-dasharray="6 5"' if dashed else ''
        marker = f' marker-end="url(#mask-arrow-{color[1:]})"' if arrow else ''
        c = f' class="{cls}"' if cls else ''
        add(f'<path{c} d="M{x1} {y1} L{x2} {y2}" fill="none" stroke="{color}" stroke-width="{width}"{dash}{marker}/>')

    def open_tip(zh_tip, en_tip, extra=''):
        attr = f' {extra}' if extra else ''
        if interactive:
            add(f'<g class="sv-svg-tip{(" " + extra) if extra and not "=" in extra else ""}" tabindex="0" data-tip-zh="{escape(zh_tip)}" data-tip-en="{escape(en_tip)}"{attr if "=" in extra else ""}>')
        else:
            add('<g>')

    def close_tip():
        add('</g>')

    add(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 940" role="img" data-pathway-mask="true" aria-labelledby="pathway-mask-title pathway-mask-desc" style="font-family:{FONT};display:block;width:100%;height:auto">')
    add('<title id="pathway-mask-title">Grouped video-to-action attention intervention</title>')
    add('<desc id="pathway-mask-desc">Thirty paired video and action layers. Only action-query to video-key entries are masked within one selected group of five layers. All other connections retain their original masks.</desc>')
    add('<style>.figure-viewer-content>svg[data-pathway-mask]{min-width:1100px}</style>')
    add('<defs>')
    for color in [INK, BLUE, GREEN, SLATE, ALERT]:
        add(f'<marker id="mask-arrow-{color[1:]}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="{color}"/></marker>')
    add('</defs><rect width="1200" height="940" fill="white"/>')

    # Header
    text(36, 38, '五层组视频 → 动作注意力屏蔽示意', 'Grouped five-layer video → action attention mask', 23, INK, 650, 'start')
    if interactive:
        add(f'<text lang="zh-CN" data-mask-sub-zh="true" x="36" y="66" font-size="14.5" fill="{MUTED}" font-weight="400" text-anchor="start">当前选中：仅屏蔽第 25–29 层；每次恢复基线再测试下一组（全部 30 层继续运行）</text>')
        add(f'<text lang="en" data-mask-sub-en="true" x="36" y="66" font-size="14.5" fill="{MUTED}" font-weight="400" text-anchor="start">Active cut: mask layers 25–29 only; reset to baseline before each group (all 30 layers run)</text>')
        rect(900, 22, 266, 26, BLUE_BG, BLUE_STROKE, rx=13, sw=1)
        text(1033, 39, '点击层组或播放按钮巡检 6 组实测', 'Click groups or Play to inspect all 6 bands', 12.2, BLUE, 550)
    else:
        text(36, 66, '示例：仅屏蔽第 25–29 层；每次恢复基线再测试下一组（全部 30 层继续运行）', 'Example: mask layers 25–29 only; reset to baseline before each group (all 30 layers still run)', 14.5, MUTED, 400, 'start')

    # Panel 1: 30 paired layers
    text(36, 112, '① 完整网络：30 层全部运行，每次只切断一组视频 K/V → 动作 Q', '1. Full network: all 30 layers execute; cut video K/V → action Q in one five-layer group', 18.5, INK, 650, 'start')

    open_tip('视频序列共 360 个 token（当前观测 120 + 未来预测 240），残差宽度 3072；经投影进入 24 头 × 128 维联合注意力。',
             '360 video tokens (120 observed + 240 future), residual width 3072, projected into shared 24×128 joint attention.')
    rect(30, 152, 166, 62, BLUE_BG, BLUE_STROKE)
    text(113, 177, '视频 token', 'Video tokens', 17, INK, 550)
    text(113, 200, '360 × 3072', size=14.5, color=MUTED)
    close_tip()

    open_tip('动作序列共 32 个 token（32 步动作块），残差宽度 1024；经投影进入同一 24 头 × 128 维联合注意力空间。',
             '32 action tokens (32-step chunk), residual width 1024, projected into the same 24×128 joint attention space.')
    rect(30, 270, 166, 62, GREEN_BG, GREEN_STROKE)
    text(113, 295, '动作 token', 'Action tokens', 17, INK, 550)
    text(113, 318, '32 × 1024', size=14.5, color=MUTED)
    close_tip()

    line(196, 183, 236, 183, BLUE, arrow=True)
    line(196, 301, 236, 301, GREEN, arrow=True)

    for i in range(6):
        x = 240 + 150 * i
        selected = (i == 5)
        old_v, ft_v, base_v = group_values(i)
        zh_tip = f'仅屏蔽第 {i*5}–{i*5+4} 层视频→动作后，最终速度场相对 L2 变化：原 115ep {old_v:.2f}% · 微调 10k {ft_v:.2f}% · 重训 10k {base_v:.2f}%'
        en_tip = f'Masking video→action at layers {i*5}–{i*5+4} changes final velocity L2 by: Orig 115ep {old_v:.2f}% · Fine-tuned 10k {ft_v:.2f}% · Restarted 10k {base_v:.2f}%'
        if interactive:
            add(f'<g class="sv-svg-tip ow-mask-group{" is-active" if selected else ""}" data-mask-group="{i}" tabindex="0" role="button" aria-label="Layers {i*5}-{i*5+4}" data-tip-zh="{escape(zh_tip)}" data-tip-en="{escape(en_tip)}">')
        else:
            add('<g>')
        rect(x - 10, 128, 140, 238, ALERT_BG if selected else 'white', ALERT_STROKE if selected else 'transparent', 10, sw=1.4, cls='ow-mg-bg')
        text(x + 60, 148, f'{i*5}–{i*5+4}', size=15.5, color=ALERT if selected else MUTED, weight=650, extra='class="ow-mg-label"')
        rect(x, 158, 120, 50, BLUE_BG, BLUE_STROKE)
        rect(x, 276, 120, 50, GREEN_BG, GREEN_STROKE)
        text(x + 60, 188, '视频 ×5', 'Video ×5', 16.5)
        text(x + 60, 306, '动作 ×5', 'Action ×5', 16.5)
        val_txt = f'{ft_v:.1f}% / {base_v:.1f}%'
        text(x + 60, 351, val_txt, size=12.4, color=ALERT if selected else SLATE, weight=600 if selected else 500, extra='class="ow-mg-val"')
        line(x + 42, 209, x + 42, 274, ALERT if selected else SLATE, dashed=selected, arrow=True, cls='ow-mg-cut-arrow')
        line(x + 78, 274, x + 78, 209, GREEN if selected else SLATE, arrow=True, cls='ow-mg-ret-arrow')
        # Red X cross on every group (visible only on active group in interactive mode, or static on i==5)
        if interactive or selected:
            op = '1' if selected else '0'
            add(f'<g class="ow-mg-cross" opacity="{op}">')
            add(f'<path d="M{x+42-6} {240-6} L{x+42+6} {240+6} M{x+42-6} {240+6} L{x+42+6} {240-6}" fill="none" stroke="{ALERT}" stroke-width="2.8" stroke-linecap="round"/>')
            add('</g>')
        add('</g>')
        if i < 5:
            line(x + 120, 183, x + 146, 183, BLUE, arrow=True)
            line(x + 120, 301, x + 146, 301, GREEN, arrow=True)

    text(36, 392, '各组下方数字 = 仅屏蔽该五层后的最终速度场相对 L2 变化（微调 10k / 重训 10k）；其余层与文本/状态条件均保持运行。',
         'Numbers below groups = final action-velocity relative L2 change (Fine-tuned 10k / Restarted 10k); all other layers & text/state cross-attention stay active.', 13.5, MUTED, 400, 'start')

    # Divider
    line(36, 418, 1164, 418, LINE, width=1.2)

    # Panel 2: Inside selected layer (left) & 3x3 mask block matrix (right)
    text(36, 456, '② 选定层内部：仅修改联合注意力掩码 M', '2. Inside a selected layer: edit only joint-attention mask M', 18.5, INK, 650, 'start')

    rect(46, 488, 204, 60, BLUE_BG, BLUE_STROKE)
    rect(316, 488, 204, 60, GREEN_BG, GREEN_STROKE)
    text(148, 513, '视频分支', 'Video stream', 17, INK, 550)
    text(148, 536, 'Qᵥ, Kᵥ, Vᵥ', size=15.5, color=SLATE)
    text(418, 513, '动作分支', 'Action stream', 17, INK, 550)
    text(418, 536, 'Qₐ, Kₐ, Vₐ', size=15.5, color=SLATE)
    line(148, 548, 148, 586, BLUE, arrow=True)
    line(418, 548, 418, 586, GREEN, arrow=True)

    open_tip('仅将选定五层中 keep[..., 360:392, :360] 置为 False（对应 M = −∞），被屏蔽位置概率归零，其余允许位置重新归一化。',
             'Sets keep[..., 360:392, :360] = False (M = −∞) in the selected 5 layers; masked probabilities become 0 and remaining allowed positions renormalize.')
    rect(64, 590, 438, 102, SOFT_BG, SLATE_STROKE)
    text(283, 618, '联合注意力（24 头 × 128 维）', 'Joint attention (24 heads × 128d)', 17.5, INK, 650)
    text(283, 647, 'P = softmax(QKᵀ / √d + M)', size=19, color=INK, weight=500)
    text(283, 676, '仅 M[动作 Q, 视频 K] 设为 −∞', 'Only M[action Q, video K] = −∞', 15, ALERT, 550)
    close_tip()

    line(148, 692, 148, 728, BLUE, arrow=True)
    line(418, 692, 418, 728, GREEN, arrow=True)

    rect(46, 732, 204, 56, BLUE_BG, BLUE_STROKE)
    rect(316, 732, 204, 56, GREEN_BG, GREEN_STROKE)
    text(148, 755, '视频层后处理', 'Video block suffix', 16, INK, 550)
    text(418, 755, '动作层后处理', 'Action block suffix', 16, INK, 550)
    text(148, 777, '残差 · Cross-attn · FFN', 'Residual · X-attn · FFN', 12.5, MUTED)
    text(418, 777, '残差 · Cross-attn · FFN', 'Residual · X-attn · FFN', 12.5, MUTED)

    open_tip('文本（umT5，512 位置）与状态 token（1×4096）经独立交叉注意力输入，不经过 392×392 联合注意力掩码。',
             'Text (umT5, 512 positions) and the single state token (1×4096) enter via separate cross-attention, outside the 392×392 joint mask.')
    rect(64, 814, 438, 42, SLATE_BG, SLATE_STROKE)
    text(283, 840, '文本 + 状态 token（独立条件注意力，保持不变）', 'Text + state token (separate cross-attention, unchanged)', 14.8, INK)
    close_tip()
    line(148, 814, 148, 790, SLATE, arrow=True)
    line(418, 814, 418, 790, SLATE, arrow=True)

    # Right side: 3x3 Mask Matrix
    text(918, 492, '392 × 392 掩码分块：行 = Q，列 = K/V', '392 × 392 mask blocks: Q rows, K/V columns', 17.5, INK, 650)
    x0, y0, cw, ch = 748, 556, 114, 74
    col_zh = ['当前视频', '未来视频', '动作']
    col_en = ['Observed', 'Future', 'Action']
    row_zh = ['当前视频 Q', '未来视频 Q', '动作 Q']
    row_en = ['Observed Q', 'Future Q', 'Action Q']
    counts = [120, 240, 32]
    for c, count in enumerate(counts):
        text(x0 + c * cw + cw / 2, 526, col_zh[c], col_en[c], 15, INK, 550)
        text(x0 + c * cw + cw / 2, 546, f'{count} tok', size=13.5, color=MUTED)
    cell_tips = {
        (0, 0): ('当前观测视频内部自注意力（120×120）：保留原掩码。', 'Observed-video self-attention (120×120): retained.'),
        (0, 1): ('原有因果限制：当前观测帧原本就不能读取未来视频（120×240）。', 'Existing causal mask: observed frames never read future video (120×240).'),
        (0, 2): ('原有因果限制：当前观测帧原本就不能读取动作 token（120×32）。', 'Existing causal mask: observed frames never read action tokens (120×32).'),
        (1, 0): ('未来视频读取当前观测（240×120）：保留原掩码。', 'Future video reading observed frames (240×120): retained.'),
        (1, 1): ('未来视频内部自注意力（240×240）：保留原掩码。', 'Future-video self-attention (240×240): retained.'),
        (1, 2): ('反向通路：未来视频读取动作 K/V（240×32）保留原掩码。', 'Reverse path: future video reading action K/V (240×32) is retained.'),
        (2, 0): ('新增屏蔽（32×120）：选定五层中切断动作 Q 对当前观测视频的读取。', 'Newly masked (32×120): blocks action Q from reading observed video in the selected 5 layers.'),
        (2, 1): ('新增屏蔽（32×240）：选定五层中切断动作 Q 对未来视频的读取（单步基线该块约占 42% 注意力质量）。', 'Newly masked (32×240): blocks action Q from reading future video (~42% of baseline joint attention mass).'),
        (2, 2): ('动作内部自注意力（32×32，基线约占 23% 质量）：保留原掩码。', 'Action self-attention (32×32, ~23% of baseline mass): retained.'),
    }
    for r in range(3):
        text(x0 - 14, y0 + r * ch + 42, row_zh[r], row_en[r], 15, INK, 500, anchor='end')
        for c in range(3):
            mode = 'new' if r == 2 and c < 2 else 'original' if r == 0 and c > 0 else 'keep'
            fill, stroke = {
                'keep': (GREEN_BG, GREEN_STROKE),
                'original': (SLATE_BG, SLATE_STROKE),
                'new': (ALERT_BG, ALERT_STROKE),
            }[mode]
            open_tip(*cell_tips[(r, c)])
            rect(x0 + c * cw + 2, y0 + r * ch + 2, cw - 4, ch - 4, fill, stroke, 5)
            text(x0 + c * cw + cw / 2, y0 + r * ch + 43,
                 {'keep': '保留', 'original': '原有屏蔽', 'new': '新增屏蔽'}[mode],
                 {'keep': 'Keep', 'original': 'Existing', 'new': 'Masked'}[mode],
                 15.5, color=ALERT if mode == 'new' else MUTED if mode == 'original' else GREEN, weight=600 if mode == 'new' else 500)
            close_tip()

    text(918, 808, '新增屏蔽：32×360 子块（动作 Q 看不到任何视频 K/V）', 'New mask: 32×360 block (action Q cannot read 360 video K/V tokens)', 14, ALERT, 550)
    text(918, 833, '其余位置保留原掩码；方格未按 token 数量缩放', 'All other entries keep original masks; blocks are not to scale', 13, MUTED)

    # Compact footer bar
    rect(36, 872, 1128, 48, SOFT_BG, LINE, 8, sw=1.2)
    text(58, 901, '探针协议：权重固定 · 4 诊断窗口 · t = 500（示范与 seed 7 噪声各 50%）· 完整跑完 30 层比较 32×14 归一化速度场相对 L2',
         'Probe setup: fixed weights · 4 windows · t = 500 (50% demo + 50% seed-7 noise) · run all 30 layers, compare 32×14 velocity relative L2', 13.8, SLATE, 500, 'start')

    add('</svg>')
    return '\n'.join(items)


def build_interactive_shell():
    old_5, ft_5, base_5 = group_values(5)
    pills = []
    for i, (rng, _, _) in enumerate(GROUP_META):
        pressed = 'true' if i == 5 else 'false'
        pills.append(
            f'<button type="button" data-mask-step="{i}" aria-pressed="{pressed}">'
            f'<span lang="zh-CN">{rng} 层</span><span lang="en">L{rng}</span></button>'
        )
    controls = (
        '<div class="sv-step-bar" role="group" aria-label="Layer group selector">\n'
        '  <button type="button" data-step-play aria-pressed="false">'
        '<span lang="zh-CN">▶ 动画巡检</span><span lang="en">▶ Play sweep</span></button>\n'
        '  ' + '\n  '.join(pills) + '\n'
        '</div>\n'
    )
    readout = (
        '<div class="sv-live-bars" data-mask-readout>\n'
        '  <div class="sv-live-head">\n'
        '    <strong><span lang="zh-CN" data-mask-title-zh>切断第 25–29 层视频→动作</span>'
        '<span lang="en" data-mask-title-en>Cut video→action at layers 25–29</span></strong>\n'
        f'    <span><span lang="zh-CN" data-mask-note-zh>{escape(GROUP_META[5][1])}</span>'
        f'<span lang="en" data-mask-note-en>{escape(GROUP_META[5][2])}</span></span>\n'
        '  </div>\n'
        '  <div class="sv-live-grid">\n'
        f'    <div class="sv-live-item"><div class="sv-live-item-top"><span><span lang="zh-CN">原 115ep</span><span lang="en">Orig 115ep</span></span><b data-mask-val="old">{old_5:.1f}%</b></div><div class="sv-live-track"><div class="sv-live-fill" data-mask-bar="old" style="width:{min(100, old_5/40*100):.1f}%;background:{ORIG}"></div></div></div>\n'
        f'    <div class="sv-live-item"><div class="sv-live-item-top"><span><span lang="zh-CN">微调 10k</span><span lang="en">Fine-tuned 10k</span></span><b data-mask-val="ft">{ft_5:.1f}%</b></div><div class="sv-live-track"><div class="sv-live-fill" data-mask-bar="ft" style="width:{min(100, ft_5/40*100):.1f}%;background:{SLATE}"></div></div></div>\n'
        f'    <div class="sv-live-item"><div class="sv-live-item-top"><span><span lang="zh-CN">重训 10k</span><span lang="en">Restarted 10k</span></span><b data-mask-val="base">{base_5:.1f}%</b></div><div class="sv-live-track"><div class="sv-live-fill" data-mask-bar="base" style="width:{min(100, base_5/40*100):.1f}%;background:{BLUE}"></div></div></div>\n'
        '  </div>\n'
        '</div>\n'
    )
    caption = (
        '<figcaption><span class="figure-title"><span lang="zh-CN">五层组屏蔽在网络中的位置（可点击层组或播放巡检）</span>'
        '<span lang="en">Where five-layer masking acts in the network (click any group or Play)</span></span>'
        '<span class="figure-description"><span lang="zh-CN">每次仅切断一组内动作 Q 读取视频 K/V 的 32×360 子块，跑完完整 30 层比较末端动作速度场偏离；底部条形实时显示三份权重的实测变化。</span>'
        '<span lang="en">Each probe blocks only the 32×360 action-Q → video-K/V sub-block in one five-layer group, runs all 30 layers, and compares final action-velocity deviation; the live bars show measured shifts across all three checkpoints.</span></span></figcaption>'
    )
    return (
        '<figure class="sv-eval-figure" id="pathway-mask-figure" data-enlarge-svg="true" data-pathway-mask-interactive="true">\n'
        + controls
        + draw() + '\n'
        + readout
        + caption + '\n</figure>\n'
    )


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for language, suffix in [('en', ''), ('zh-CN', '-zh')]:
        (OUT / f'correction-attention-mask{suffix}.svg').write_text(draw(language) + '\n')
    (ROOT / 'content/openwam-slots/12-masking-diagram.html').write_text(build_interactive_shell())
    print('Generated interactive bilingual masking diagram and standalone EN/ZH SVGs.')


if __name__ == '__main__':
    main()
