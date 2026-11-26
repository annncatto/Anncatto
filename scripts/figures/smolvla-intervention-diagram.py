"""Draw SmolVLA's clean visual weight-update layout, 32D/18D strips, and whole-module swap bars.

Uses the native Anncatto palette (#273b43 ink, #556b73 mixed, #237ab2 FP32, #4b9c80 FP32-120k, #b55d4c alert).
"""
from html import escape
from pathlib import Path
import json

R = Path(__file__).resolve().parents[2]
out = R / 'content/images/smolvla'
s = json.loads((out / 'precision-summary.json').read_text())

BLUE, BLUE_BG, BLUE_STROKE = '#237ab2', '#edf5f8', '#b8d4e2'
GREEN, GREEN_BG, GREEN_STROKE = '#4b9c80', '#eef6f1', '#bfd9cc'
CORAL, CORAL_BG, CORAL_STROKE = '#b55d4c', '#faf1ef', '#dfb8b0'
SLATE, SLATE_BG, SLATE_STROKE = '#556b73', '#eff4f4', '#c5d4d7'
GRAY, GRAY_BG, GRAY_STROKE = '#61747b', '#f5f8f7', '#d2e0e0'
INK, MUTED, LINE = '#273b43', '#61747b', '#dce9e9'


def draw(language=None):
    a = []
    interactive = language is None

    def text(x, y, zh, en=None, size=15, color=INK, weight=400, anchor='middle'):
        pairs = [('zh-CN', zh), ('en', en or zh)] if interactive else [(language, zh if language == 'zh-CN' else (en or zh))]
        for lang, val in pairs:
            a.append(
                f'<text lang="{lang}" x="{x}" y="{y}" font-size="{size}" fill="{color}" '
                f'font-weight="{weight}" text-anchor="{anchor}">{escape(val)}</text>'
            )

    def rect(x, y, w, h, fill, stroke='none', rx=8, sw=1.4, dash=''):
        extra = f' stroke-dasharray="{dash}"' if dash else ''
        stroke_attr = f' stroke="{stroke}" stroke-width="{sw}"' if stroke != 'none' else ''
        a.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"{stroke_attr}{extra}/>')

    def arrow(points, color=SLATE, sw=1.9, dash=''):
        d = 'M' + ' L'.join(f'{x} {y}' for x, y in points)
        extra = f' stroke-dasharray="{dash}"' if dash else ''
        a.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{sw}"{extra} marker-end="url(#smol-arrow-{color[1:]})"/>')

    def open_tip(zh_tip, en_tip):
        if interactive:
            a.append(f'<g class="sv-svg-tip" tabindex="0" data-tip-zh="{escape(zh_tip)}" data-tip-en="{escape(en_tip)}">')
        else:
            a.append('<g>')

    def close_tip():
        a.append('</g>')

    a.append(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 885" role="img" '
        'data-smol-intervention="true" aria-labelledby="smol-swap-title smol-swap-desc" '
        'style="display:block;width:100%;height:auto;font-family:\'IBM Plex Sans\',\'Noto Sans SC\',\'Noto Sans CJK JP\',sans-serif">'
    )
    a.append(
        '<title id="smol-swap-title">SmolVLA weight updates, 32D/18D pathway, and module swaps</title>'
        '<desc id="smol-swap-desc">Three panels: relative L2 weight change across four parameter groups, '
        '18:14 proportional strips for state and action projections, and flow-loss bars for whole-module swaps.</desc>'
        '<style>.figure-viewer-content>svg[data-smol-intervention]{min-width:1100px}</style><defs>'
    )
    for color in [BLUE, CORAL, SLATE, GRAY, GREEN]:
        a.append(
            f'<marker id="smol-arrow-{color[1:]}" viewBox="0 0 10 10" refX="9" refY="5" '
            f'markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="{color}"/></marker>'
        )
    a.append('</defs><rect width="1200" height="885" fill="white"/>')

    # Clean unified legend bar
    rect(28, 22, 14, 14, SLATE, 'none', rx=3)
    text(49, 34, '混合 100k', 'Mixed 100k', 13, INK, 600, 'start')
    rect(164, 22, 14, 14, BLUE, 'none', rx=3)
    text(185, 34, 'FP32 100k', 'FP32 100k', 13, INK, 600, 'start')
    rect(300, 22, 14, 14, CORAL, 'none', rx=3)
    text(321, 34, '跨组合升高 / 全维噪声', 'Crossed swap / noisy dims', 13, CORAL, 600, 'start')
    if interactive:
        rect(968, 17, 204, 24, BLUE_BG, BLUE_STROKE, rx=12, sw=1)
        text(1070, 33, '悬停色块查看精确值', 'Hover blocks for details', 12, BLUE, 500)

    # ================= PANEL 1: 4 PARAMETER GROUPS =================
    text(28, 72, '① 相对 L2 变化（0–20% 统一标尺）', '1. Relative L2 weight change (0–20% scale)', 16, INK, 650, 'start')

    open_tip(
        '冻结 VLM：345 个张量 / 350,165,184 元素（视觉编码器与 SmolVLM2 前 16 层），训练期间 0% 更新，两个模型逐元素一致。',
        'Frozen VLM: 345 tensors / 350,165,184 elements (vision encoder + first 16 SmolVLM2 layers); 0% updated, identical across runs.',
    )
    rect(28, 90, 194, 232, GRAY_BG, GRAY_STROKE, rx=10, sw=1.4, dash='5 3')
    text(125, 124, '冻结 VLM', 'Frozen VLM', 15.2, INK, 650)
    text(125, 146, '350M · BF16', '350M · BF16', 12.2, MUTED)
    rect(62, 182, 126, 34, 'white', GRAY_STROKE, rx=6, sw=1.1)
    text(125, 204, '0% 变化', '0% change', 14, MUTED, 650)
    rect(48, 282, 154, 26, '#eaf0f0', 'none', rx=5)
    text(125, 299, '缓存 16 层 K,V', 'Cached 16L K,V', 11.8, SLATE, 600)
    close_tip()

    arrow([(222, 206), (248, 206)], BLUE, sw=1.9)

    def draw_group_card(x, w, title_zh, title_en, sub_zh, sub_en, a_val, b_val, badge_zh, badge_en,
                        card_bg, card_stroke, badge_bg, badge_color, tip_zh, tip_en):
        open_tip(tip_zh, tip_en)
        rect(x, 90, w, 232, card_bg, card_stroke, rx=10, sw=1.4)
        cx = x + w / 2
        text(cx, 122, title_zh, title_en, 15.0, INK, 650)
        text(cx, 144, sub_zh, sub_en, 12.0, MUTED)

        bx = x + 56
        bw = w - 118
        max_pct = 20.0
        for pct in (0, 10, 20):
            tx = bx + bw * (pct / max_pct)
            a.append(f'<line x1="{tx:.1f}" y1="164" x2="{tx:.1f}" y2="250" stroke="{LINE}" stroke-width="1"/>')
            text(tx, 265, f'{pct}%', f'{pct}%', 10.5, MUTED)

        a_w = max(4.0, bw * (a_val / max_pct))
        text(x + 48, 190, '混合', 'Mixed', 12, SLATE, 650, 'end')
        rect(bx, 176, bw, 20, '#edf2f2', 'none', rx=4)
        rect(bx, 176, a_w, 20, SLATE, 'none', rx=4)
        text(bx + bw + 8, 191, f'{a_val:.1f}%', f'{a_val:.1f}%', 12.8, SLATE, 700, 'start')

        b_w = max(4.0, bw * (b_val / max_pct))
        text(x + 48, 228, 'FP32', 'FP32', 12, BLUE, 650, 'end')
        rect(bx, 214, bw, 20, '#e8f2f7', 'none', rx=4)
        rect(bx, 214, b_w, 20, BLUE, 'none', rx=4)
        text(bx + bw + 8, 229, f'{b_val:.1f}%', f'{b_val:.1f}%', 12.8, BLUE, 700, 'start')

        rect(x + 16, 282, w - 32, 26, badge_bg, 'none', rx=6)
        text(cx, 299, badge_zh, badge_en, 12.0, badge_color, 650)
        close_tip()

    draw_group_card(
        252, 284,
        '奇数 CA 层 K,V', 'Odd CA K,V',
        '1.6M · FP32', '1.6M · FP32',
        17.31, 7.03,
        '混合 2.5×（L15 25%）', 'Mixed 2.5× (L15 25%)',
        '#f8fbfc', BLUE_STROKE, CORAL_BG, CORAL,
        '奇数 CA 层 K,V：16 个张量 / 1,638,400 元素（L01–L15）；相对 L2 变化：混合 17.31% vs FP32 7.03%（2.46×）。L01 v_proj: 14.64% vs 5.74%；L15 k/v: 22.16%/24.63% vs 8.78%/7.81%。',
        'Odd CA K,V: 16 tensors / 1,638,400 elements (L01–L15); relative L2 change: Mixed 17.31% vs FP32 7.03% (2.46×). L01 v_proj: 14.64% vs 5.74%; L15 k/v: 22.16%/24.63% vs 8.78%/7.81%.',
    )
    arrow([(536, 206), (562, 206)], SLATE, sw=1.9)

    draw_group_card(
        566, 292,
        '16 层专家主体', '16-layer expert body',
        '96.6M · BF16 / FP32', '96.6M · BF16 / FP32',
        4.46, 13.71,
        'FP32 3.1× · 混合末 5k 仅 0.08%', 'FP32 3.1× · Mixed final-5k 0.08%',
        '#fbf7f6', CORAL_STROKE, BLUE_BG, BLUE,
        '动作专家主体：97 个主张量（96,584,400 元素，相对 L2 变化：混合 4.46% vs FP32 13.71%，3.07×）+ 32 个 RMSNorm（23,040 元素，混合 0.00% vs FP32 0.49%）。95k→100k 元素变化率：混合 0.08267% vs FP32 99.99785%。',
        'Expert body: 97 main tensors (96,584,400 elements, L2 change: Mixed 4.46% vs FP32 13.71%, 3.07×) + 32 RMSNorms (23,040 elements, 0.00% vs 0.49%). Final-5k changed: Mixed 0.08267% vs FP32 99.99785%.',
    )
    arrow([(858, 206), (884, 206)], SLATE, sw=1.9)

    draw_group_card(
        888, 284,
        '外部投影', 'External projections',
        '1.6M · FP32', '1.6M · FP32',
        7.88, 4.81,
        '混合 1.6×（时间 MLP 12%）', 'Mixed 1.6× (time MLP 12%)',
        '#f8fbfc', BLUE_STROKE, CORAL_BG, CORAL,
        '外部投影：10 个张量 / 1,635,152 元素（state_proj、action_in_proj、action_time_mlp、action_out_proj）；相对 L2 变化：混合 7.88% vs FP32 4.81%（1.64×），其中 action_time_mlp_out 为 12.12% vs 6.08%。',
        'External projections: 10 tensors / 1,635,152 elements (state_proj, action_in_proj, action_time_mlp, action_out_proj); L2 change: Mixed 7.88% vs FP32 4.81% (1.64×); action_time_mlp_out 12.12% vs 6.08%.',
    )

    a.append(f'<line x1="28" y1="348" x2="1172" y2="348" stroke="{LINE}" stroke-width="1.3"/>')

    # ================= PANEL 2: 32D vs 18D PROPORTIONAL STRIPS =================
    text(28, 380, '② 32 / 18 维通路（按 18:14 比例）', '2. 32D / 18D pathway (18:14 scale)', 16, INK, 650, 'start')

    strip_x, w18, w14 = 248, 252, 196
    strip_rows = [
        (
            402, 'state_proj', 'state_proj',
            '18 维状态', '18D state', BLUE_BG, BLUE_STROKE, BLUE,
            '14 维补零', '14D zero', GRAY_BG, GRAY_STROKE, MUTED, True,
            '更新 56%（18/32）', '56% updated (18/32)',
            '#f6f9f9', GRAY_STROKE, INK,
            'state_proj.weight 在两个模型中均恰好有 56.25%（= 18/32）的元素发生变化；后 14 维输入恒为 0，梯度恒为零。',
            'state_proj.weight changes on exactly 56.25% (= 18/32) of elements in both runs; the 14 zero-padded inputs carry zero gradient.',
        ),
        (
            456, 'action_in_proj', 'action_in_proj',
            '18 维加噪动作', '18D noisy action', BLUE_BG, BLUE_STROKE, BLUE,
            '14 维噪声', '14D noise', CORAL_BG, CORAL_STROKE, CORAL, False,
            '更新 100% · 10 步全维回传', '100% updated · 10-step 32D feedback',
            CORAL_BG, CORAL_STROKE, CORAL,
            'action_in_proj.weight 在两个模型中均 100% 更新：流匹配向全部 32 维注入高斯噪声，推理时 10 步无界 Euler 积分每步也将全部 32 维送回输入投影。',
            'action_in_proj.weight updates on 100% of elements: flow matching adds Gaussian noise to all 32 dims, and 10 Euler steps feed all 32 coords back at inference.',
        ),
        (
            510, 'action_out_proj', 'action_out_proj',
            '18 维计 loss', '18D loss', BLUE_BG, BLUE_STROKE, BLUE,
            '14 维零梯度', '14D zero grad', GRAY_BG, GRAY_STROKE, MUTED, True,
            '更新 56% → 裁 18 维 → 限幅', '56% updated → crop 18D → clamp',
            '#f6f9f9', GRAY_STROKE, INK,
            'action_out_proj.weight 恰好更新 56.25%（18/32）；推理只裁取前 18 维并做仿射还原 a = μ + σz（无界）。右臂 shoulder_lift 真机请求曾低至 −119.6287，由 Host 截断至 −100。',
            'action_out_proj.weight updates on 56.25% (18/32); inference crops 18D and applies unbounded affine scaling a = μ + σz. Live right shoulder_lift reached −119.6287 before Host clamped to −100.',
        ),
    ]

    for (y, l_zh, l_en, s1_zh, s1_en, bg1, st1, c1, s2_zh, s2_en, bg2, st2, c2, dash2,
         r_zh, r_en, rbg, rst, rcol, tip_zh, tip_en) in strip_rows:
        open_tip(tip_zh, tip_en)
        rect(28, y, 1144, 42, 'transparent', 'none', rx=6)
        text(28, y + 26, l_zh, l_en, 14.2, INK, 650, 'start')
        rect(strip_x, y + 4, w18, 34, bg1, st1, rx=5, sw=1.2)
        text(strip_x + w18 / 2, y + 26, s1_zh, s1_en, 12.5, c1, 600)
        rect(strip_x + w18 + 4, y + 4, w14, 34, bg2, st2, rx=5, sw=1.2, dash='4 3' if dash2 else '')
        text(strip_x + w18 + 4 + w14 / 2, y + 26, s2_zh, s2_en, 12.5, c2, 600)
        arrow([(strip_x + w18 + w14 + 10, y + 21), (722, y + 21)], SLATE, sw=1.8)
        rect(726, y + 4, 446, 34, rbg, rst, rx=6, sw=1.2)
        text(949, y + 26, r_zh, r_en, 12.8, rcol, 600)
        close_tip()

    a.append(f'<line x1="28" y1="576" x2="1172" y2="576" stroke="{LINE}" stroke-width="1.3"/>')

    # ================= PANEL 3: WHOLE-MODULE SWAPS =================
    text(28, 608, '③ 整组替换（统一 FP32 回放 loss）', '3. Whole-module swaps (uniform FP32 flow loss)', 16, INK, 650, 'start')

    text(28, 638, '组合', 'Pairing', 13, MUTED, 600, 'start')
    text(392, 638, 'P_in → E（16 层）→ P_out', 'P_in → E (16L) → P_out', 13, MUTED, 600)
    text(628, 638, '配对 flow loss', 'Matched flow loss', 13, MUTED, 600, 'start')

    loss_A = s['uniform_fp32_flow_loss']['A']
    loss_B = s['uniform_fp32_flow_loss']['B']
    loss_AB = next(v['mean_loss'] for v in s['module_swaps'] if v['base'] == 'A' and v['swapped'] == 'expert')
    loss_BA = next(v['mean_loss'] for v in s['module_swaps'] if v['base'] == 'A' and v['swapped'] == 'projections')

    bar_x, bar_max_w, max_loss = 628, 374, 0.08
    ref_x = bar_x + bar_max_w * (loss_A / max_loss)
    a.append(f'<line x1="{ref_x:.1f}" y1="648" x2="{ref_x:.1f}" y2="852" stroke="#99adb2" stroke-width="1.2" stroke-dasharray="4 3"/>')

    swap_rows = [
        (
            '混合原配', 'Mixed native', 'M', 'M', loss_A, SLATE, '0.027', '0.027',
            f'混合 100k 原配统一 FP32 回放 loss = {loss_A:.6f}（基线）。',
            f'Mixed 100k native uniform FP32 replay loss = {loss_A:.6f} (baseline).',
        ),
        (
            'FP32 原配', 'FP32 native', 'F', 'F', loss_B, BLUE, '0.013（−52%）', '0.013 (−52%)',
            f'FP32 100k 原配统一 FP32 回放 loss = {loss_B:.6f}，比混合 100k 低 52.3%。',
            f'FP32 100k native uniform FP32 replay loss = {loss_B:.6f} (−52.3% vs Mixed).',
        ),
        (
            '混合 P + FP32 E', 'Mixed P + FP32 E', 'M', 'F', loss_AB, CORAL, '0.073（+174%）', '0.073 (+174%)',
            f'混合 100k 外部投影 + FP32 100k 动作专家：loss = {loss_AB:.6f}，较混合基线升高 174%、较 FP32 基线升高 474%。',
            f'Mixed external projections + FP32 16-layer expert: loss = {loss_AB:.6f} (+174% vs Mixed, +474% vs FP32).',
        ),
        (
            'FP32 P + 混合 E', 'FP32 P + Mixed E', 'F', 'M', loss_BA, CORAL, '0.061（+127%）', '0.061 (+127%)',
            f'FP32 100k 外部投影 + 混合 100k 动作专家：loss = {loss_BA:.6f}，较混合基线升高 127%、较 FP32 基线升高 375%。',
            f'FP32 external projections + Mixed 16-layer expert: loss = {loss_BA:.6f} (+127% vs Mixed, +375% vs FP32).',
        ),
    ]

    for idx, (zh, en, p_own, e_own, loss, bcol, lbl_zh, lbl_en, tip_zh, tip_en) in enumerate(swap_rows):
        y = 656 + idx * 48
        open_tip(tip_zh, tip_en)
        rect(28, y, 1144, 38, 'transparent', 'none', rx=6)
        text(28, y + 24, zh, en, 13.8, INK, 600, 'start')

        p_bg, p_st, p_tx = (SLATE_BG, SLATE_STROKE, SLATE) if p_own == 'M' else (BLUE_BG, BLUE_STROKE, BLUE)
        e_bg, e_st, e_tx = (SLATE_BG, SLATE_STROKE, SLATE) if e_own == 'M' else (BLUE_BG, BLUE_STROKE, BLUE)
        p_tag_zh, p_tag_en = ('混合', 'Mixed') if p_own == 'M' else ('FP32', 'FP32')
        e_tag_zh, e_tag_en = ('混合', 'Mixed') if e_own == 'M' else ('FP32', 'FP32')

        rect(206, y + 4, 92, 30, p_bg, p_st, rx=6, sw=1.3)
        text(252, y + 24, f'P_in·{p_tag_zh}', f'P_in·{p_tag_en}', 12.2, p_tx, 650)
        arrow([(298, y + 19), (320, y + 19)], SLATE, sw=1.6)

        rect(324, y + 4, 136, 30, e_bg, e_st, rx=6, sw=1.3)
        text(392, y + 24, f'E·{e_tag_zh}', f'E·{e_tag_en}', 12.5, e_tx, 650)
        arrow([(460, y + 19), (482, y + 19)], SLATE, sw=1.6)

        rect(486, y + 4, 102, 30, p_bg, p_st, rx=6, sw=1.3)
        text(537, y + 24, f'P_out·{p_tag_zh}', f'P_out·{p_tag_en}', 12.2, p_tx, 650)

        rect(bar_x, y + 7, bar_max_w, 24, '#f1f6f6', 'none', rx=5)
        bw = bar_max_w * (loss / max_loss)
        rect(bar_x, y + 7, bw, 24, bcol, 'none', rx=5)
        text(bar_x + bar_max_w + 12, y + 24, lbl_zh, lbl_en, 13.8, bcol if bcol != SLATE else INK, 700, 'start')
        close_tip()

    a.append('</svg>')
    return '\n'.join(a)


for language, suffix in [('en', ''), ('zh-CN', '-zh')]:
    (out / f'precision-network{suffix}.svg').write_text(draw(language) + '\n')

caption = (
    '<figcaption><span class="figure-title">'
    '<span lang="en">Weight-update distribution, 32D/18D pathway, and module swaps</span>'
    '<span lang="zh-CN">参数更新分布、32/18 维通路与整组替换</span></span>'
    '<span class="figure-description">'
    '<span lang="en">Top: relative L2 weight change across four parameter groups on a shared 0–20% scale. Middle: 18:14 proportional strips showing active dimensions across projections. Bottom: matched flow loss for native and crossed module pairings (hover any block for exact values).</span>'
    '<span lang="zh-CN">上：四类参数相对初始化的 L2 变化率（统一 0–20% 标尺）。中：按 18:14 实际比例绘制的 32 维通路更新范围。下：原配与跨模型整组替换的配对 flow loss 对比（悬停色块查看精确值）。</span>'
    '</span></figcaption>'
)
(R / 'content/smolvla/09-intervention-diagram.html').write_text(
    '<figure class="sv-eval-figure" id="smol-network-figure" data-enlarge-svg="true">' + draw() + caption + '</figure>\n'
)
print('Generated decluttered bilingual network and swap diagram.')
