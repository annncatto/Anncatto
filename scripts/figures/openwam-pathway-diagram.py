"""Draw the exact grouped video-to-action attention intervention.

No model is loaded. The diagram matches Trace.mixed in the archived probe:
mask[..., 360:, :360] = False only within the selected five-layer group.
"""
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'content/images/openwam-slots'
FONT = "'IBM Plex Sans','Noto Sans SC','Noto Sans CJK JP',sans-serif"
INK, BLUE, GREEN, GRAY, RED = '#19364b', '#3263d9', '#79a948', '#8798aa', '#b9544f'


def draw(language=None):
    items = []

    def add(s):
        items.append(s)

    def text(x, y, zh, en=None, size=18, color=INK, weight=400, anchor='middle'):
        en = en or zh
        values = [('zh-CN', zh), ('en', en)] if language is None else [(language, zh if language == 'zh-CN' else en)]
        for lang, value in values:
            add(f'<text lang="{lang}" x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{weight}" text-anchor="{anchor}">{escape(value)}</text>')

    def rect(x, y, w, h, fill='white', stroke='#ccd8e1', rx=8):
        add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="1.4"/>')

    def line(x1, y1, x2, y2, color=GRAY, width=2, dashed=False, arrow=False):
        dash = ' stroke-dasharray="6 5"' if dashed else ''
        marker = f' marker-end="url(#mask-arrow-{color[1:]})"' if arrow else ''
        add(f'<path d="M{x1} {y1} L{x2} {y2}" fill="none" stroke="{color}" stroke-width="{width}"{dash}{marker}/>')

    def cross(x, y, color=RED):
        line(x-7, y-7, x+7, y+7, color, 3)
        line(x-7, y+7, x+7, y-7, color, 3)

    add(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1090" role="img" data-pathway-mask="true" aria-labelledby="pathway-mask-title pathway-mask-desc" style="font-family:{FONT};display:block;width:100%;height:auto">')
    add('<title id="pathway-mask-title">Grouped video-to-action attention intervention</title>')
    add('<desc id="pathway-mask-desc">Thirty paired video and action layers. Only action-query to video-key entries are masked within one selected group of five layers. All other connections retain their original masks.</desc>')
    add('<style>.figure-viewer-content>svg[data-pathway-mask]{min-width:1100px}</style>')
    add('<defs>')
    for color in [INK, BLUE, GREEN, GRAY, RED]:
        add(f'<marker id="mask-arrow-{color[1:]}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="{color}"/></marker>')
    add('</defs><rect width="1200" height="1090" fill="white"/>')
    text(40, 40, '只屏蔽选定五层中的视频 → 动作通路', 'Mask video → action within one five-layer group', 25, weight=650, anchor='start')
    text(40, 75, '示例：第 25–29 层；每次恢复基线后，再切换到另一组', 'Example: layers 25–29. Reset to baseline before testing the next group.', 17, color=GRAY, anchor='start')

    # A. Both residual streams pass through all thirty layers.
    text(40, 123, '① 完整网络：30 层全部运行', '1. Full network: all 30 layers still execute', 21, weight=650, anchor='start')
    rect(30, 175, 170, 65, '#f0f5fc', '#b5c8e8')
    rect(30, 295, 170, 65, '#f2f6ee', '#c3d6ae')
    text(115, 201, '视频 token', 'Video tokens', 19)
    text(115, 225, '360 × 3072', size=17, color=GRAY)
    text(115, 321, '动作 token', 'Action tokens', 19)
    text(115, 345, '32 × 1024', size=17, color=GRAY)
    line(200, 207, 242, 207, BLUE, arrow=True)
    line(200, 327, 242, 327, GREEN, arrow=True)
    for i in range(6):
        x = 245 + 150*i
        selected = i == 5
        if selected:
            rect(x-10, 147, 140, 229, '#fff6f3', '#dbb5ae', 10)
        text(x+60, 169, f'{i*5}–{i*5+4}', size=17, color=RED if selected else GRAY, weight=600)
        rect(x, 182, 120, 52, '#edf3ff', '#b8c9e9')
        rect(x, 302, 120, 52, '#eff5e8', '#bed2a5')
        text(x+60, 214, '视频 ×5', 'Video ×5', 18)
        text(x+60, 334, '动作 ×5', 'Action ×5', 18)
        if i < 5:
            line(x+120, 208, x+146, 208, BLUE, arrow=True)
            line(x+120, 328, x+146, 328, GREEN, arrow=True)
        # Downward: information carried by video K/V reaches action Q.
        line(x+42, 235, x+42, 301, RED if selected else GRAY, dashed=selected, arrow=True)
        # Upward: action K/V remains available to future-video Q.
        line(x+78, 301, x+78, 235, GREEN if selected else GRAY, arrow=True)
        if selected:
            cross(x+42, 266)
    text(465, 402, '文本 / 状态条件、残差和 FFN 保持运行', 'Text/state conditioning, residuals and FFNs remain active', 18, anchor='middle')
    text(1100, 402, '输出速度场', 'Velocity output', 17, color=GREEN)
    line(1105, 355, 1105, 378, GREEN, arrow=True)
    text(40, 442, '箭头表示信息流：视频 K/V → 动作 Q；反向连接保留原掩码', 'Arrows show information flow: video K/V → action Q; the reverse path retains its original mask.', 16, color=GRAY, anchor='start')

    # B. Compute Q/K/V as usual, then edit only the indicated mask block.
    text(40, 496, '② 选定层内部：修改注意力掩码', '2. Inside a selected layer: modify the attention mask', 21, weight=650, anchor='start')
    rect(50, 535, 205, 65, '#edf3ff', '#b8c9e9')
    rect(320, 535, 205, 65, '#eff5e8', '#bed2a5')
    text(152, 562, '视频分支', 'Video stream', 19)
    text(152, 586, 'Qᵥ, Kᵥ, Vᵥ', size=18)
    text(422, 562, '动作分支', 'Action stream', 19)
    text(422, 586, 'Qₐ, Kₐ, Vₐ', size=18)
    line(152, 600, 152, 641, BLUE, arrow=True)
    line(422, 600, 422, 641, GREEN, arrow=True)
    rect(70, 645, 435, 110, '#f8fafc', '#c5d2de')
    text(287, 675, '联合注意力', 'Joint attention', 20, weight=600)
    text(287, 704, 'P = softmax(QKᵀ / √d + M)', size=21)
    text(287, 735, '仅 M[动作 Q, 视频 K] 设为 −∞', 'Only M[action Q, video K] becomes −∞', 16, color=RED)
    line(152, 755, 152, 793, BLUE, arrow=True)
    line(422, 755, 422, 793, GREEN, arrow=True)
    rect(50, 797, 205, 60, '#edf3ff', '#b8c9e9')
    rect(320, 797, 205, 60, '#eff5e8', '#bed2a5')
    text(152, 821, '视频层后处理', 'Video block suffix', 17)
    text(422, 821, '动作层后处理', 'Action block suffix', 17)
    text(152, 845, '残差 · Cross-attn · FFN', 'Residual · X-attn · FFN', 13, color=GRAY)
    text(422, 845, '残差 · Cross-attn · FFN', 'Residual · X-attn · FFN', 13, color=GRAY)
    rect(70, 882, 435, 42, '#f7f9fc', '#c5d2de')
    text(287, 909, '文本 + 状态 token（独立条件注意力）', 'Text + state token (separate cross-attention)', 16)
    line(152, 882, 152, 859, GRAY, arrow=True)
    line(422, 882, 422, 859, GRAY, arrow=True)

    # C. Actual first-frame-causal + mutual baseline, with one new red block.
    text(938, 529, '掩码分块：行是 Q，列是 K/V', 'Mask blocks: Q rows, K/V columns', 19, weight=600)
    x0, y0, cw, ch = 770, 600, 112, 77
    col_zh = ['当前视频', '未来视频', '动作']
    col_en = ['Observed', 'Future', 'Action']
    row_zh = ['当前视频 Q', '未来视频 Q', '动作 Q']
    row_en = ['Observed Q', 'Future Q', 'Action Q']
    for c, count in enumerate([120,240,32]):
        text(x0+c*cw+cw/2, 568, col_zh[c], col_en[c], 16)
        text(x0+c*cw+cw/2, 591, str(count), size=15, color=GRAY)
    for r in range(3):
        text(x0-18, y0+r*ch+44, row_zh[r], row_en[r], 16, anchor='end')
        for c in range(3):
            mode = 'new' if r==2 and c<2 else 'original' if r==0 and c>0 else 'keep'
            fill, stroke = {'keep':('#eef5e7','#bcd0aa'), 'original':('#f1f4f7','#cbd4dd'), 'new':('#fcece7','#d7a19a')}[mode]
            rect(x0+c*cw+2,y0+r*ch+2,cw-4,ch-4,fill,stroke,4)
            text(x0+c*cw+cw/2,y0+r*ch+45,
                 {'keep':'保留','original':'原有屏蔽','new':'新增屏蔽'}[mode],
                 {'keep':'Keep','original':'Existing','new':'Masked'}[mode],
                 16,color=RED if mode=='new' else GRAY if mode=='original' else '#547435')
    text(940, 867, '新增屏蔽：动作 Q 读取不到 360 个视频 K/V', 'New mask: action Q cannot read 360 video K/V tokens', 15, color=RED)
    text(940, 895, '其余位置保持原掩码；方格未按 token 数量缩放', 'Other entries retain the original mask; blocks are not to scale.', 14, color=GRAY)
    rect(40, 939, 1120, 105, '#f7f9fc', '#dae2e9')
    text(65, 970, '基线与干预：相同模型、观测、状态、文本、噪声和去噪时间',
         'Baseline vs intervention: same model, observation, state, text, noise and denoising time', 18, weight=550, anchor='start')
    text(65, 1003, '完整跑完 30 层后，比较最终动作速度场；逐层残差另行记录',
         'Run all 30 layers, then compare the final action velocity; record residuals by layer separately.', 17, anchor='start')
    text(65, 1029, '权重固定；四个窗口，t = 500，示范与固定噪声各 50%，屏蔽项概率为 0',
         'Fixed weights; four windows, t = 500, equal signal/noise; masked probabilities are 0', 16, color=GRAY, anchor='start')
    add('</svg>')
    return '\n'.join(items)


OUT.mkdir(parents=True, exist_ok=True)
for language, suffix in [('en',''), ('zh-CN','-zh')]:
    (OUT/f'correction-attention-mask{suffix}.svg').write_text(draw(language)+'\n')
caption = ('<figcaption><span class="figure-title"><span lang="zh-CN">五层组屏蔽在网络中的位置</span><span lang="en">Where five-layer masking acts in the network</span></span>'
           '<span class="figure-description"><span lang="zh-CN">上图以 25–29 层为例；下图红色块对应动作查询行与视频键列。每次只修改一个五层组，其余连接沿用原掩码，全部 30 层继续计算。</span>'
           '<span lang="en">Top: the 25–29 group as an example. Bottom: red blocks are action-query rows and video-key columns. Each trial changes one five-layer group, retains all other masks, and executes all 30 layers.</span></span></figcaption>')
(ROOT/'content/openwam-slots/12-masking-diagram.html').write_text(
    '<figure class="sv-eval-figure" id="pathway-mask-figure" data-enlarge-svg="true">\n'+draw()+caption+'</figure>\n')
print('Generated bilingual inline network diagram and standalone English/Chinese SVGs.')
