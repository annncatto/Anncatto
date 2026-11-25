"""Draw SmolVLA's mixed-storage layout, 32D/18D dataflow, and wrapping parameter-swap topology."""
from html import escape
from pathlib import Path
import json

R = Path(__file__).resolve().parents[2]
out = R / 'content/images/smolvla'
s = json.loads((out / 'precision-summary.json').read_text())

BLUE, BLUE_BG, BLUE_STROKE = '#3263d9', '#edf3ff', '#7aa0e8'
CORAL, CORAL_BG, CORAL_STROKE = '#b9544f', '#fff4f2', '#d99a94'
SLATE, SLATE_BG, SLATE_STROKE = '#475569', '#eef2f6', '#7b8c9d'
GRAY, GRAY_BG, GRAY_STROKE = '#64748b', '#f4f6f8', '#c8d5df'
INK, MUTED = '#19364b', '#6b7d8f'


def draw(language=None):
    a = []

    def text(x, y, zh, en=None, size=16, color=INK, weight=400, anchor='middle'):
        pairs = [('zh-CN', zh), ('en', en or zh)] if language is None else [(language, zh if language == 'zh-CN' else (en or zh))]
        for lang, val in pairs:
            a.append(
                f'<text lang="{lang}" x="{x}" y="{y}" font-size="{size}" fill="{color}" '
                f'font-weight="{weight}" text-anchor="{anchor}">{escape(val)}</text>'
            )

    def rect(x, y, w, h, fill, stroke, rx=8, sw=1.5, dash=''):
        extra = f' stroke-dasharray="{dash}"' if dash else ''
        a.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{extra}/>')

    def arrow(points, color=GRAY, sw=2, dash=''):
        d = 'M' + ' L'.join(f'{x} {y}' for x, y in points)
        extra = f' stroke-dasharray="{dash}"' if dash else ''
        a.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{sw}"{extra} marker-end="url(#smol-arrow-{color[1:]})"/>')

    def line(points, color=GRAY, sw=2, dash=''):
        d = 'M' + ' L'.join(f'{x} {y}' for x, y in points)
        extra = f' stroke-dasharray="{dash}"' if dash else ''
        a.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{sw}"{extra}/>')

    a.append(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1190" role="img" '
        'data-smol-intervention="true" aria-labelledby="smol-swap-title smol-swap-desc" '
        'style="display:block;width:100%;height:auto;font-family:\'IBM Plex Sans\',\'Noto Sans SC\',\'Noto Sans CJK JP\',sans-serif">'
    )
    a.append(
        '<title id="smol-swap-title">SmolVLA mixed-storage layout, 32D/18D pathway, and parameter swaps</title>'
        '<desc id="smol-swap-desc">Frozen 350.17M VLM, 96.61M BF16 expert body stalled in A vs FP32 in B, '
        '3.27M FP32 external and odd-layer cross-attention KV projections with larger relative L2 weight change in A, '
        '18D supervised vs 32D Euler-integrated action path, and wrapping parameter-swap loss results.</desc>'
        '<style>.figure-viewer-content>svg[data-smol-intervention]{min-width:1100px}</style><defs>'
    )
    for color in [BLUE, CORAL, SLATE, GRAY]:
        a.append(
            f'<marker id="smol-arrow-{color[1:]}" viewBox="0 0 10 10" refX="9" refY="5" '
            f'markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="{color}"/></marker>'
        )
    a.append('</defs><rect width="1200" height="1190" fill="white"/>')

    # Header & unified legend
    text(28, 38, 'SmolVLA：混合存储分布、32/18 维通路与参数交换', 'SmolVLA: mixed-storage layout, 32D/18D pathway, and parameter swaps', 24, INK, 650, 'start')

    rect(28, 56, 15, 15, GRAY_BG, GRAY_STROKE, rx=3, sw=1.4, dash='3 2')
    text(50, 69, '冻结 VLM（350.17M · 0% 变）', 'Frozen VLM (350.17M · 0%)', 13.5, MUTED, 500, 'start')
    rect(275, 56, 15, 15, CORAL_BG, CORAL_STROKE, rx=3, sw=1.4)
    text(297, 69, 'A 中 BF16 主体（96.61M · L2 4.46%｜B 全 FP32：13.71%）', 'BF16 in A (96.61M · 4.46% | FP32 in B: 13.71%)', 13.5, CORAL, 500, 'start')
    rect(735, 56, 15, 15, BLUE_BG, BLUE, rx=3, sw=1.4)
    text(757, 69, 'A/B 均 FP32（3.27M · A 变化为 B 的 1.6–2.5×）', 'FP32 in A & B (3.27M · 1.6–2.5× larger L2 change in A)', 13.5, BLUE, 500, 'start')

    # ================= SECTION 1 =================
    text(28, 110, '① 存储类型分布与 32/18 维数据流（百分比为相对共同初始化的 L2 变化率）',
         '1. Storage-dtype layout and 32D/18D flow (percentages show relative L2 change from init)', 17.5, INK, 650, 'start')

    # Row 1: Frozen VLM prefix
    rect(28, 138, 166, 70, GRAY_BG, GRAY_STROKE, dash='4 3')
    text(111, 168, '四路图像 + 指令', '4 images + text', 15.5, INK, 500)
    text(111, 192, '512×512 · 4×64 + 48', '512×512 · 4×64 + 48', 12.5, MUTED)
    arrow([(194, 173), (222, 173)], GRAY)

    rect(226, 138, 198, 70, GRAY_BG, GRAY_STROKE, dash='4 3')
    text(325, 168, '视觉 / 语言嵌入', 'Vision / text embed', 15.5, INK, 500)
    text(325, 192, 'pixel shuffle → 960d', 'pixel shuffle → 960d', 12.5, MUTED)
    arrow([(424, 173), (464, 173)], GRAY)

    rect(468, 132, 488, 82, GRAY_BG, GRAY_STROKE, dash='5 3')
    text(712, 163, '冻结 SmolVLM2 前缀（前 16 层 · 350.17M）', 'Frozen SmolVLM2 prefix (16 layers · 350.17M)', 17, INK, 600)
    text(712, 189, '前缀 P = 305；输出各层 K/V 缓存（A 与 B 逐元素一致）', 'Prefix P = 305; cached layer K/V (identical in A & B)', 13.5, MUTED)

    # Row 2: State 18 -> 32 -> state_proj (FP32)
    rect(28, 240, 166, 76, GRAY_BG, GRAY_STROKE)
    text(111, 266, '状态 18 维 → 补零 32', 'State 18D → pad 32D', 14.5, INK, 500)
    rect(40, 280, 79, 24, '#dce6f7', BLUE_STROKE, rx=4, sw=1)
    text(79.5, 297, '18 真实', '18 real', 11.5, BLUE, 600)
    rect(121, 280, 61, 24, '#e6ecf1', GRAY_STROKE, rx=4, sw=1)
    text(151.5, 297, '14 补零', '14 zero', 11.5, MUTED, 500)
    arrow([(194, 278), (222, 278)], GRAY)

    rect(226, 238, 198, 80, BLUE_BG, BLUE)
    text(325, 262, 'state_proj（FP32）', 'state_proj (FP32)', 15, BLUE, 600)
    text(325, 284, '仅 56.25% (=18/32) 更新', '56.25% (=18/32) active', 12.5, INK)
    text(325, 304, 'L2：A 3.9% vs B 2.2%', 'L2: A 3.9% vs B 2.2%', 12.5, BLUE, 600)
    arrow([(424, 278), (446, 278), (446, 192), (464, 192)], BLUE)
    rect(429, 224, 36, 18, 'white', 'none', rx=3, sw=0)
    text(447, 237, '1 tok', '1 tok', 11.5, BLUE, 600)

    # Row 3 left: Noisy action + time -> action_in_proj + time_mlp (FP32)
    rect(28, 386, 166, 86, GRAY_BG, GRAY_STROKE)
    text(111, 413, '加噪动作 xₜ + 时间 t', 'Noisy xₜ + flow time t', 14.5, INK, 500)
    rect(40, 430, 79, 26, '#dce6f7', BLUE_STROKE, rx=4, sw=1)
    text(79.5, 448, '18 监督', '18 real', 11.5, BLUE, 600)
    rect(121, 430, 61, 26, '#fcebe8', CORAL_STROKE, rx=4, sw=1)
    text(151.5, 448, '14 噪声', '14 noise', 11.5, CORAL, 600)
    arrow([(194, 429), (222, 429)], GRAY)

    rect(226, 362, 198, 140, BLUE_BG, BLUE)
    text(325, 385, '输入与时间投影（FP32）', 'Input & time proj (FP32)', 14.5, BLUE, 650)
    rect(236, 397, 178, 44, 'white', BLUE_STROKE, rx=5, sw=1.2)
    text(325, 416, 'action_in_proj：100% 变', 'action_in_proj: 100% active', 12, INK, 600)
    text(325, 434, '32 维均含高斯噪声', 'all 32D carry Gaussian noise', 11, CORAL)
    rect(236, 449, 178, 43, 'white', BLUE_STROKE, rx=5, sw=1.2)
    text(325, 468, 'action_time_mlp（1.56M）', 'action_time_mlp (1.56M)', 12, INK, 600)
    text(325, 485, 'L2：A 12.1% vs B 6.1%', 'L2: A 12.1% vs B 6.1%', 11.5, BLUE, 600)
    arrow([(424, 432), (464, 432)], BLUE)

    # Row 3 center: 16-layer alternating SA/CA Expert container
    rect(468, 296, 488, 264, '#fafbfd', SLATE_STROKE, rx=10, sw=1.5)
    # Left-aligned title inside Expert (occupies x=482..835, leaving x=904 completely clear for Prefix K/V trunk!)
    text(484, 324, '动作专家 E（16 层交替 SA / CA · 98.25M）', 'Action expert E (16 alternating SA/CA · 98.25M)', 16, INK, 650, 'start')

    # Clean non-overlapping Prefix K/V trunk: VLM(x=904, y=214) -> straight down past title to horizontal bus (y=346) -> 3 drop arrows into CA columns!
    line([(904, 214), (904, 346)], BLUE, sw=2)
    rect(504, 240, 384, 28, 'white', BLUE_STROKE, rx=5, sw=1.1)
    text(696, 259, 'Prefix K/V → 8 个奇数 CA 层的 FP32 K,V（1.64M）', 'Prefix K/V → 8 odd CA layers’ FP32 K,V (1.64M)', 12.8, BLUE, 600)
    line([(888, 254), (904, 254)], BLUE, sw=1.6)
    # Horizontal distribution bus inside Expert (below title!)
    line([(616, 346), (904, 346)], BLUE, sw=2)
    arrow([(616, 346), (616, 368)], BLUE, sw=2)
    arrow([(727, 346), (727, 368)], BLUE, sw=1.7, dash='4 3')
    arrow([(904, 346), (904, 368)], BLUE, sw=2)

    # 5 Layer columns inside Expert (y=372..508)
    # Col 1: L00 SA (x=482..552, w=70)
    rect(482, 372, 70, 134, CORAL_BG, CORAL_STROKE, rx=6, sw=1.3)
    text(517, 394, 'L00', 'L00', 14, CORAL, 700)
    text(517, 414, 'SA · 偶', 'SA · even', 12, INK, 500)
    text(517, 439, '全 BF16', 'All BF16', 11.5, CORAL, 600)
    text(517, 463, 'A 3.8%', 'A 3.8%', 12, CORAL)
    text(517, 483, 'B 8.1%', 'B 8.1%', 12, BLUE, 600)

    # Col 2: L01 CA (x=562..670, w=108)
    rect(562, 372, 108, 56, BLUE_BG, BLUE, rx=6, sw=1.4)
    text(616, 392, 'L01 · CA K,V', 'L01 · CA K,V', 12.5, BLUE, 700)
    text(616, 412, 'A 11–15%｜B 6%', 'A 11–15% | B 6%', 11, BLUE, 600)
    rect(562, 432, 108, 74, CORAL_BG, CORAL_STROKE, rx=6, sw=1.3)
    text(616, 453, 'Q / O / MLP', 'Q / O / MLP', 12, INK, 500)
    text(616, 473, 'A 3.5% (BF16)', 'A 3.5% (BF16)', 11.5, CORAL)
    text(616, 492, 'B 11.0% (FP32)', 'B 11.0% (FP32)', 11.5, BLUE, 600)

    # Col 3: L02-L13 middle summary (x=680..774, w=94)
    rect(680, 372, 94, 134, '#f3f6fa', GRAY_STROKE, rx=6, sw=1.2, dash='4 3')
    text(727, 395, 'L02 – L13', 'L02 – L13', 13, INK, 650)
    text(727, 415, '6 SA + 6 CA', '6 SA + 6 CA', 11.5, MUTED)
    text(727, 439, 'CA K,V: FP32', 'CA K,V: FP32', 11.5, BLUE, 600)
    text(727, 458, 'A 13–23%', 'A 13–23%', 11.5, BLUE)
    text(727, 480, '主体 A 3.6%', 'Body A 3.6%', 11.5, CORAL)
    text(727, 497, '主体 B 11.3%', 'Body B 11.3%', 11.5, BLUE)

    # Col 4: L14 SA (x=784..850, w=66)
    rect(784, 372, 66, 134, CORAL_BG, CORAL_STROKE, rx=6, sw=1.3)
    text(817, 394, 'L14', 'L14', 14, CORAL, 700)
    text(817, 414, 'SA · 偶', 'SA · even', 11.5, INK, 500)
    text(817, 439, '全 BF16', 'All BF16', 11, CORAL, 600)
    text(817, 463, 'A 3.7%', 'A 3.7%', 12, CORAL)
    text(817, 483, 'B 11.5%', 'B 11.5%', 12, BLUE, 600)

    # Col 5: L15 CA (x=860..946, w=86)
    rect(860, 372, 86, 56, BLUE_BG, BLUE, rx=6, sw=1.4)
    text(903, 392, 'L15 · CA', 'L15 · CA', 12.5, BLUE, 700)
    text(903, 412, 'A 22–25%', 'A 22–25%', 11.5, BLUE, 700)
    rect(860, 432, 86, 74, CORAL_BG, CORAL_STROKE, rx=6, sw=1.3)
    text(903, 453, 'Q / O / MLP', 'Q / O / MLP', 11, INK, 500)
    text(903, 473, 'A 4.5%', 'A 4.5%', 11.5, CORAL)
    text(903, 492, 'B 14.3%', 'B 14.3%', 11.5, BLUE, 600)

    # Two-line Expert footer cleanly inside container (w=488)
    text(712, 529, 'A：96.58M BF16 主体相对 L2 变化 4.46%（32 个 RMSNorm 为 0.00%）',
         'A: 96.58M BF16 body L2 change 4.46% (32 RMSNorms: 0.00%)', 12.3, CORAL, 600)
    text(712, 548, 'A 的 16 个 CA K,V 变化 17.31%（B 为 7.03%，B 主体达 13.71%）',
         'A’s 16 CA K,V change 17.31% (B: 7.03%, B body: 13.71%)', 12.3, BLUE, 600)

    # Row 3 right: action_out_proj (FP32) + Training loss upward branch
    arrow([(956, 432), (982, 432)], BLUE)
    rect(986, 376, 186, 114, BLUE_BG, BLUE)
    text(1079, 400, 'action_out_proj（FP32）', 'action_out_proj (FP32)', 14, BLUE, 650)
    text(1079, 422, '线性输出 vₜ [50, 32]', 'Linear head vₜ [50, 32]', 13, INK)
    text(1079, 444, '仅 56.25% (=18/32) 更新', '56.25% (=18/32) active', 12, INK)
    text(1079, 466, 'L2：A 9.6% vs B 5.3%', 'L2: A 9.6% vs B 5.3%', 12.5, BLUE, 600)

    # Training branch (upward)
    arrow([(1079, 376), (1079, 318)], GRAY)
    rect(986, 236, 186, 78, GRAY_BG, GRAY_STROKE)
    text(1079, 262, '训练 loss：仅监督前 18 维', 'Train loss: first 18D only', 13.5, INK, 600)
    text(1079, 284, '后 14 维补零区零梯度', '14 pad dims get zero grad', 12, MUTED)
    text(1079, 302, '（训练分支）', '(Training path)', 11, MUTED)

    # Row 4: Inference output path (right to left)
    arrow([(1079, 490), (1079, 594)], GRAY)
    rect(898, 598, 274, 76, GRAY_BG, GRAY_STROKE)
    text(1035, 626, '推理：10 步 Euler 积分全部 32 维', 'Inference: 10 Euler steps on all 32D', 14.2, INK, 600)
    text(1035, 650, '无界线性积分；14 个无监督维仍每步回传', 'Unbounded ODE; 14 pad dims re-enter xₜ', 12.2, CORAL)

    arrow([(898, 636), (858, 636)], GRAY)
    rect(572, 598, 282, 76, GRAY_BG, GRAY_STROKE)
    text(713, 626, '裁取前 18 维 · 仿射还原 a = μ + σz', 'Crop 18D · affine a = μ + σz', 14.2, INK, 600)
    text(713, 650, '只做尺度还原，不执行关节边界限幅', 'Rescales linearly; enforces no joint bounds', 12.2, MUTED)

    arrow([(572, 636), (532, 636)], GRAY)
    rect(214, 598, 314, 76, CORAL_BG, CORAL_STROKE)
    text(371, 626, 'Host 按字段限幅（shoulder_lift ≥ −100）', 'Host field clamp (shoulder_lift ≥ −100)', 14.2, CORAL, 600)
    text(371, 650, '真机请求曾达 −119.6，Host 截断至 −100', 'Live requests reach −119.6; clipped to −100', 12.2, INK)

    # Divider
    a.append('<line x1="28" y1="706" x2="1172" y2="706" stroke="#dde5ec" stroke-width="1.5"/>')

    # ================= SECTION 2 =================
    text(28, 744, '② 整组参数交换（同一 16 窗口 × 2 抽样，统一 FP32 计算）：外部投影包裹专家，跨模型组合后 loss 显著升高',
         '2. Whole-module swaps (16 windows × 2 draws, uniform FP32): crossing P and E raises loss', 17.5, INK, 650, 'start')

    # Column headers (shifted slightly left so Interpretation has w=258!)
    text(28, 784, '模型组合', 'Pairing', 14, MUTED, 600, 'start')
    text(260, 784, '输入 / 状态 / 时间 P_in', 'Input / state / time P_in', 14, MUTED, 600)
    text(496, 784, '16 层动作专家 E（含 CA K,V）', '16-layer expert E (incl. CA K,V)', 14, MUTED, 600)
    text(710, 784, '输出头 P_out', 'Output P_out', 14, MUTED, 600)
    text(840, 784, 'Flow loss', 'Flow loss', 14, MUTED, 600)
    text(1042, 784, '参数组合说明', 'Combination', 14, MUTED, 600)

    loss_A = s['uniform_fp32_flow_loss']['A']
    loss_B = s['uniform_fp32_flow_loss']['B']
    loss_AB = next(v['mean_loss'] for v in s['module_swaps'] if v['base'] == 'A' and v['swapped'] == 'expert')
    loss_BA = next(v['mean_loss'] for v in s['module_swaps'] if v['base'] == 'A' and v['swapped'] == 'projections')

    rows = [
        ('A 原配', 'A native', 'A', 'A', loss_A, INK, '基线', 'baseline', '原配：大变化接口 + 小变化主体', 'Native: large P + small E'),
        ('B 原配', 'B native', 'B', 'B', loss_B, BLUE, '−52.3%', '−52.3%', '原配：小变化接口 + 大变化主体', 'Native: small P + large E'),
        ('A 投影 + B 专家', 'A proj + B expert', 'A', 'B', loss_AB, CORAL, '+174% vs A', '+174% vs A', '跨组合：A 外部投影接 B 专家', 'Crossed: A’s P with B’s E'),
        ('B 投影 + A 专家', 'B proj + A expert', 'B', 'A', loss_BA, CORAL, '+127% vs A', '+127% vs A', '跨组合：B 外部投影接 A 专家', 'Crossed: B’s P with A’s E'),
    ]

    for idx, (zh, en, p_own, e_own, loss, lcol, delta_zh, delta_en, why_zh, why_en) in enumerate(rows):
        y = 804 + idx * 78
        text(28, y + 32, zh, en, 15, INK, 600, 'start')
        p_bg, p_st, p_tx = (SLATE_BG, SLATE_STROKE, SLATE) if p_own == 'A' else (BLUE_BG, BLUE, BLUE)
        e_bg, e_st, e_tx = (SLATE_BG, SLATE_STROKE, SLATE) if e_own == 'A' else (BLUE_BG, BLUE, BLUE)
        rect(176, y + 4, 168, 46, p_bg, p_st, rx=7, sw=1.5)
        text(260, y + 33, f'P_in · {p_own}', f'P_in · {p_own}', 15.5, p_tx, 650)
        arrow([(344, y + 27), (376, y + 27)], GRAY)

        rect(380, y + 4, 232, 46, e_bg, e_st, rx=7, sw=1.5)
        text(496, y + 33, f'E · {e_own}（16 层）', f'E · {e_own} (16 layers)', 15.5, e_tx, 650)
        arrow([(612, y + 27), (644, y + 27)], GRAY)

        rect(648, y + 4, 124, 46, p_bg, p_st, rx=7, sw=1.5)
        text(710, y + 33, f'P_out · {p_own}', f'P_out · {p_own}', 15.5, p_tx, 650)

        text(840, y + 25, f'{loss:.6f}', f'{loss:.6f}', 16, lcol, 700)
        text(840, y + 45, delta_zh, delta_en, 12, lcol, 600)

        rect(912, y + 6, 260, 42, '#f8fafc' if lcol != CORAL else '#fff8f7', '#dce4ec' if lcol != CORAL else CORAL_STROKE, rx=6, sw=1.1)
        text(1042, y + 32, why_zh, why_en, 12.5, INK if lcol != CORAL else CORAL, 500)

    text(28, 1152,
         '注：外部投影 P（1.64M）含 state_proj、action_in_proj、action_time_mlp、action_out_proj；专家 E（98.25M）含 16 层及其奇数 CA 层 K/V 投影。四组共用冻结 VLM（350.17M）。',
         'Note: External P (1.64M) = state_proj, action_in_proj, action_time_mlp, action_out_proj; Expert E (98.25M) spans all 16 layers including odd-layer CA K/V. All share the frozen VLM (350.17M).',
         12.5, MUTED, 400, 'start')

    a.append('</svg>')
    return '\n'.join(a)


for language, suffix in [('en', ''), ('zh-CN', '-zh')]:
    (out / f'precision-network{suffix}.svg').write_text(draw(language) + '\n')

caption = (
    '<figcaption><span class="figure-title">'
    '<span lang="en">Mixed-storage layout, 32D/18D pathway, and module swaps</span>'
    '<span lang="zh-CN">更新范围、存储类型分布与参数交换</span></span>'
    '<span class="figure-description">'
    '<span lang="en">Top: frozen VLM, A’s 96.61M BF16 expert body with small weight change versus its 26 FP32 tensors (external projections plus odd-layer CA K/V, whose relative L2 change is 1.6–2.5× larger than in B), and the 18D-supervised versus 32D-integrated action path. Bottom: whole-module swap topology under uniform FP32 replay (slate A, blue B, coral crossed-swap loss increase).</span>'
    '<span lang="zh-CN">上图展示冻结 VLM、模型 A 中变化很小的 96.61M BF16 专家主体与变化更大的 26 个 FP32 张量（外部投影与 8 个奇数 CA 层的 K/V），以及训练监督 18 维与推理积分 32 维的差异。下图按外部投影包裹动作专家的拓扑展示整组参数交换结果（灰 A、蓝 B、红为跨组合 loss 升高）。</span>'
    '</span></figcaption>'
)
(R / 'content/smolvla/09-intervention-diagram.html').write_text(
    '<figure class="sv-eval-figure" id="smol-network-figure" data-enlarge-svg="true">' + draw() + caption + '</figure>\n'
)
print('Generated polished bilingual mixed-storage and parameter-swap diagram.')
