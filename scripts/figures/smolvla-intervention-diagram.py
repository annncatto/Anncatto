"""Draw trained/frozen modules and the archived parameter-swap intervention."""
from html import escape
from pathlib import Path
import json

R=Path(__file__).resolve().parents[2]
out=R/'content/images/smolvla'
s=json.loads((out/'precision-summary.json').read_text())
BLUE,GREEN,GRAY,INK='#3263d9','#79a948','#8798aa','#19364b'


def draw(language=None):
    a=[]
    def text(x,y,zh,en=None,size=18,color=INK,weight=400,anchor='middle'):
        for lang,v in ([('zh-CN',zh),('en',en or zh)] if language is None else [(language,zh if language=='zh-CN' else en or zh)]):
            a.append(f'<text lang="{lang}" x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{weight}" text-anchor="{anchor}">{escape(v)}</text>')
    def box(x,y,w,h,fill='#f7f9fc',stroke='#c8d5df'):
        a.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="7" fill="{fill}" stroke="{stroke}" stroke-width="1.4"/>')
    def arrow(points,color=GRAY):
        d='M'+' L'.join(f'{x} {y}' for x,y in points)
        a.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="2" marker-end="url(#smol-arrow-{color[1:]})"/>')
    a.append('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1020" role="img" data-smol-intervention="true" aria-labelledby="smol-swap-title smol-swap-desc" style="display:block;width:100%;height:auto;font-family:\'IBM Plex Sans\',\'Noto Sans CJK JP\',sans-serif">')
    a.append('<title id="smol-swap-title">SmolVLA trained modules, sampling, and parameter swaps</title><desc id="smol-swap-desc">Frozen vision-language prefix, trainable state/action/time projections and a sixteen-layer expert. Memory-only module swaps use identical FP32 replay. The sampler integrates 32 dimensions; loss supervises 18.</desc><style>.figure-viewer-content>svg[data-smol-intervention]{min-width:1100px}</style><defs>')
    for color in [BLUE,GREEN,GRAY]:
        a.append(f'<marker id="smol-arrow-{color[1:]}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="{color}"/></marker>')
    a.append('</defs><rect width="1200" height="1020" fill="white"/>')
    text(35,42,'SmolVLA：实际更新模块与交换位置','SmolVLA: trained modules and parameter-swap locations',25,weight=650,anchor='start')
    text(35,78,'① 数据流：冻结 VLM，更新动作专家和投影；采样 32 维，监督 18 维','1. Frozen VLM; trained expert/projections. Sample 32 dimensions, supervise 18.',17,color=GRAY,anchor='start')
    nodes=[(30,120,190,65,'四路图像 + 指令','4 images + instruction',False),
           (270,120,210,65,'视觉 / 文字嵌入','Image / text embeddings',False),
           (550,120,250,80,'冻结 VLM 前缀层','Frozen VLM prefix',False),
           (30,225,190,60,'状态 18 → 补齐 32','State 18 → pad 32',False),
           (270,225,210,60,'状态投影 Pₛ','State projection Pₛ',True),
           (30,335,190,70,'噪声动作 + 时间 t','Noisy actions + time t',False),
           (270,335,210,70,'动作输入 / 时间投影','Action-in / time projections',True),
           (550,310,250,100,'动作专家 E · 16 层','Action expert E · 16 layers',True),
           (870,330,260,65,'输出投影 Pₒ：vₜ[50,32]','Output Pₒ: vₜ[50,32]',True),
           (870,445,260,65,'Euler 10 步：z[50,32]','10 Euler steps: z[50,32]',False),
           (550,445,250,65,'取前 18 维：a = μ + σz','Keep 18: a = μ + σz',False),
           (270,445,210,65,'Host 各字段接口约束','Host field-wise constraints',False)]
    for x,y,w,h,zh,en,trained in nodes:
        box(x,y,w,h,'#edf3ff' if trained else '#f1f4f7','#b6c9ea' if trained else '#c8d5df')
        text(x+w/2,y+h/2+6,zh,en,17)
    text(675,186,'冻结部分合计 350.17M','Frozen total: 350.17M',15,color=GRAY)
    arrow([(220,153),(267,153)]);arrow([(480,153),(547,153)])
    arrow([(220,255),(267,255)])
    arrow([(480,255),(520,255),(520,165),(547,165)],BLUE)
    arrow([(675,200),(675,307)],GRAY)
    text(690,260,'条件 K/V','Prefix K/V',16,anchor='start')
    arrow([(220,370),(267,370)]);arrow([(480,370),(547,370)],BLUE)
    arrow([(800,362),(867,362)],BLUE)
    arrow([(1000,395),(1000,442)])
    arrow([(870,478),(803,478)]);arrow([(550,478),(483,478)])
    box(870,210,260,65,'#f1f4f7')
    text(1000,238,'训练 loss 只监督前 18 维','Training loss: first 18 dims',16)
    text(1000,260,'其余 14 维为特征补零区','14 padded feature dimensions',14,color=GRAY)
    arrow([(1000,330),(1000,278)])
    text(35,553,'可训练合计 99.88M：专家 98.25M + 外部投影 1.64M','Trainable 99.88M: expert 98.25M + external projections 1.64M',18,weight=550,anchor='start')
    text(35,584,'线性速度头、Euler 更新与仿射还原本身保留连续输出；Host 再按字段约束','The linear head, Euler updates and affine restoration retain continuous outputs; Host constrains each field.',16,color=GRAY,anchor='start')
    text(35,633,'② 参数交换：同一观测和噪声，统一 FP32 计算，不重新训练','2. Parameter swaps: matched observations/noise, uniform FP32 compute, no retraining',21,weight=650,anchor='start')
    text(440,666,'投影组 P：状态、动作输入/输出、时间','P: state, action-in/out, time',16)
    text(790,666,'16 层动作专家 E','16-layer action expert E',16)
    text(1100,666,'Flow loss',size=16)
    rows=[('A 原配','A native','A','A',s['uniform_fp32_flow_loss']['A']),
          ('B 原配','B native','B','B',s['uniform_fp32_flow_loss']['B']),
          ('A 投影 + B 专家','A projections + B expert','A','B',next(v['mean_loss'] for v in s['module_swaps'] if v['base']=='A' and v['swapped']=='expert')),
          ('B 投影 + A 专家','B projections + A expert','B','A',next(v['mean_loss'] for v in s['module_swaps'] if v['base']=='A' and v['swapped']=='projections'))]
    for i,(zh,en,proj,expert,loss) in enumerate(rows):
        y=690+i*65
        text(35,y+31,zh,en,17,anchor='start')
        for x,w,label,owner in [(320,245,'P',proj),(665,245,'E',expert)]:
            color=BLUE if owner=='A' else GREEN
            box(x,y,w,48,'#edf3ff' if owner=='A' else '#eff5e8',color)
            text(x+w/2,y+31,f'{label} · {owner}',size=19,color=color,weight=550)
        arrow([(565,y+24),(662,y+24)])
        text(1100,y+31,f'{loss:.6f}',size=19)
    text(35,987,'A/B 均为 150 回合阶段的 100k 模型；四个组合共用冻结 VLM 和相同的 16 窗口 × 2 抽样','A/B are the 150-episode-stage 100k models; all cases share the frozen VLM and 16 windows × 2 draws.',16,color=GRAY,anchor='start')
    a.append('</svg>')
    return '\n'.join(a)


for language,suffix in [('en',''),('zh-CN','-zh')]:
    (out/f'precision-network{suffix}.svg').write_text(draw(language)+'\n')
caption='<figcaption><span class="figure-title"><span lang="zh-CN">更新范围、输出路径与参数交换</span><span lang="en">Update scope, output path and parameter swaps</span></span><span class="figure-description"><span lang="zh-CN">上图展示模型内部 32 维动作与 18 维监督的区别；下图只交换已训练参数组，在相同 FP32 条件下重新测 loss。蓝 A、绿 B，灰色表示冻结或共同保留部分。</span><span lang="en">Top distinguishes the 32-dimensional internal action from 18-dimensional supervision. Bottom swaps trained parameter groups and remeasures loss under matched FP32 replay. Blue A, green B; gray denotes frozen or shared parts.</span></span></figcaption>'
(R/'content/smolvla/09-intervention-diagram.html').write_text('<figure class="sv-eval-figure" id="smol-network-figure" data-enlarge-svg="true">'+draw()+caption+'</figure>\n')
print('Generated bilingual trained-module and parameter-swap diagram.')
