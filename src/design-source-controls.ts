import type {RobotModel} from './concept-model.js';
import {sourceParameterDefinitions} from './design-source-parameters.js';

type Translate = (en:string, zh:string) => string;

const escapeHTML = (value:string) => value
 .replaceAll('&', '&amp;')
 .replaceAll('<', '&lt;')
 .replaceAll('>', '&gt;')
 .replaceAll('"', '&quot;');

// Keep sub-millimetre source offsets readable without rounding the model itself.
const millimetres = (value:number) => String(Number((value * 1000).toFixed(6)));

/** Geometry controls for a design derived from a source joint tree.
 * Values enter/leave the model in SI; only the displayed inputs use millimetres.
 * The caller owns editing, model selection and restoring source dimensions.
 */
export function sourceDesignControls(model:RobotModel, tr:Translate):string {
 const parameters = sourceParameterDefinitions(model);
 if (!parameters.length) return '';

 const fields = (group:'mount'|'limb'|'terminal', coordinates=false) => parameters
  .filter(parameter => parameter.group === group && (parameter.axis!==undefined)===coordinates)
  .map(parameter => {
   const label = escapeHTML(tr(parameter.label[0], parameter.label[1]));
   const endpoints=parameter.reference?`${parameter.reference[0]} → ${parameter.reference[1]}`:'';
   const baseline = escapeHTML(tr(
    `Source dimension: ${millimetres(parameter.baseline)} mm${endpoints?" · "+endpoints:""}`,
    `源尺寸：${millimetres(parameter.baseline)} mm${endpoints?" · "+endpoints:""}`,
   ));
   return `<label class="design-field"><span>${label}</span>`
    + `<span class="design-value-input"><input type="number"`
    + ` name="source-dimension:${escapeHTML(parameter.id)}"`
    + ` value="${millimetres(parameter.value)}"`
    + ` min="${millimetres(parameter.min)}" max="${millimetres(parameter.max)}"`
    + ` step="any" aria-label="${label}" title="${baseline}">`
    + '<small>mm</small></span>'
    + `<input class="design-range" type="range" data-for="source-dimension:${escapeHTML(parameter.id)}"`
    + ` value="${parameter.value * 1000}" min="${parameter.min * 1000}" max="${parameter.max * 1000}"`
    + ` step="any" aria-label="${label}" title="${baseline}"></label>`;
  }).join('');

 const limb = fields('limb');
 const mount = fields('mount');
 const terminal = fields('terminal');
 const detail = (title:string, body:string) => body
  ? `<details class="design-details"><summary>${escapeHTML(title)}</summary>`
    + `<div class="design-two-fields">${body}</div></details>`
  : '';

 return '<div data-source-dimensions>'
  + (limb ? `<div class="design-two-fields">${limb}</div>` : '')
  + detail(tr('Member offsets · local XYZ', '杆段偏置 · 局部 XYZ'), fields('limb',true))
  + detail(tr('Mounting and joint offsets', '安装与关节偏置'), mount+fields('mount',true))
  + detail(tr('Wrist and tool offsets', '腕部与工具偏置'), model.design.robot === 'arm' ? terminal+fields('terminal',true) : '')
  + detail(tr('Ankle and foot offsets', '踝部与足端偏置'), model.design.robot === 'arm' ? '' : terminal+fields('terminal',true))
  + `<p class="design-control-note">${tr(
   'The source joint arrangement and limits are retained. Member material, section and length update mass, centres of mass and inertias together.',
   '沿用原机构关节关系与限位；杆件材料、截面和长度同步影响质量、质心与惯量。',
  )}</p>`
  + '<details class="design-details">'
  + `<summary>${tr('Dimension definitions', '尺寸口径')}</summary>`
  + `<p class="design-control-note">${tr(
   'Lengths measure the distance between joint origins; they are not the shortest distance between rotation axes. X, Y and Z offsets use the parent link frame. Changing a spacing scales the current XYZ vector; changing an offset updates its spacing. Paired limbs retain their source asymmetry, with lateral edits mirrored.',
   '长度按关节原点间距量取，不等于两转轴的最短距离。X、Y、Z 偏置使用父连杆坐标；修改间距沿当前方向伸缩，修改偏置会更新间距；左右肢段联动并保留原模型的不对称差异。',
  )}</p>`
  + `<p class="design-control-note">${tr(
   'Member mass is density × section area × cut length. The remaining assembly budget stays fixed; the Material tab gives the reference section and mass allocation.',
   '杆件质量按密度 × 截面积 × 下料长度计算，其余总成保持预算；基准截面和质量分配见“材料”页。',
  )}</p>`
  + (model.design.robot === 'arm' ? `<p class="design-control-note">${tr(
   'The end-assembly offsets move the gripper and camera together, using the TCP as the datum.',
   '末端总成偏置以 TCP 为基准，一同移动夹爪与摄像头的安装位置。',
  )}</p>` : '')
  + '</details>'
  + `<button type="button" data-reset-source-dimensions>${tr('Restore source dimensions', '恢复源尺寸')}</button>`
  + '</div>';
}
