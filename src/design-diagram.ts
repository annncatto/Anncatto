import {add, mul, rotate, fk, type RobotModel, type Transform, type V3} from './concept-model.js';
import type {DesignAnalysis} from './design-analysis.js';
import {designPalette as palette, displayComponentColor} from './design-palette.js';

export type DiagramView = 'spatial' | 'side' | 'front';
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));

/** All displayed joints and link endpoints come directly from canonical FK. */
export function assemblyDiagramGeometry(model: RobotModel, poses: Record<string, Transform> = fk(model, model.home)) {
  return model.nodes.map(node => ({node, start: poses[node.id]!.p,
    end: node.member ? add(poses[node.id]!.p, rotate(poses[node.id]!.q, node.member.vector)) : null,
    parent: node.parent ? poses[node.parent]!.p : null,
    components: node.components.map(component => ({component, center: add(poses[node.id]!.p, rotate(poses[node.id]!.q, component.p)),
      transform: (point: V3) => add(poses[node.id]!.p, rotate(poses[node.id]!.q, add(component.p, rotate(component.q, point))))})),
  }));
}

export function createDesignDiagram(host: HTMLElement, onSelect: (id: string) => void) {
  host.addEventListener('click', event => {
    const target = (event.target as Element).closest<SVGElement>('[data-member]');
    if (target) onSelect(target.dataset.member!);
  });
  host.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = (event.target as Element).closest<SVGElement>('[data-member]');
    if (target) {event.preventDefault(); onSelect(target.dataset.member!);}
  });

  function draw(model: RobotModel, analysis: DesignAnalysis, view: DiagramView, poses: Record<string, Transform>, zh: boolean, showCOM = true, memberLabel?: string) {
    const geometry = assemblyDiagramGeometry(model, poses), selected = analysis.member.id;
    const raw = (point: V3): [number, number] => view === 'side' ? [point[0], -point[2]] : view === 'front' ? [-point[1], -point[2]] : [.84 * point[0] - .6 * point[1], .28 * point[0] + .38 * point[1] - .9 * point[2]];
    const corners = geometry.flatMap(item => item.components.filter(c => c.component.role === 'body' || c.component.role === 'payload').flatMap(c => {
      const size = c.component.size;
      return [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => c.transform([x * size[0] / 2, y * size[1] / 2, z * size[2] / 2]))));
    }));
    const points = [...geometry.flatMap(item => [item.start, ...(item.end ? [item.end] : []), ...item.components.map(c => c.center)]), ...corners].map(raw);
    const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
    const minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
    const scale = Math.min(590 / Math.max(.15, maxX - minX), 350 / Math.max(.15, maxY - minY));
    const project = (point: V3) => {const p = raw(point); return [365 + (p[0] - (minX + maxX) / 2) * scale, 218 + (p[1] - (minY + maxY) / 2) * scale] as [number, number];};
    const xy = (point: V3) => project(point).map(v => v.toFixed(2)).join(',');
    const line = (a: V3, b: V3, attrs: string) => `<line x1="${project(a)[0]}" y1="${project(a)[1]}" x2="${project(b)[0]}" y2="${project(b)[1]}" ${attrs}/>`;
    let bodies = '', links = '', symbols = '';
    const selectedGroup = analysis.member.group;
    const ordered = [...geometry].sort((a, b) => Number(a.node.group === selectedGroup) - Number(b.node.group === selectedGroup));
    for (const item of ordered) {
      const {node} = item, active = node.group === selectedGroup || node.group === 'base' || node.group === 'torso';
      const opacity = active || view === 'spatial' ? 1 : .2;
      if (item.parent) links += line(item.parent, item.start, `stroke="${palette.blueGray}" stroke-width="3" opacity="${opacity}"`);
      if (item.end) {
        const label = escape(node.label[zh ? 1 : 0]);
        links += `<g data-member="${node.id}" role="button" tabindex="0" aria-label="${label}" aria-pressed="${node.id === selected}" opacity="${opacity}">` +
          line(item.start, item.end, 'stroke="transparent" stroke-width="22"') +
          line(item.start, item.end, `stroke="${node.id === selected ? palette.selected : palette.blueGray}" stroke-width="${node.id === selected ? 9 : 6}" stroke-linecap="round"`) + '</g>';
      }
      for (const c of item.components) {
        const role = c.component.role, color=displayComponentColor(c.component,model.design.armModel==='aloha'), [x, y] = project(c.center);
        if (role === 'payload' && model.design.payload === 0) continue;
        if (role === 'body' || role === 'payload') {
          const size = c.component.size, polygon = (z: number) => [-1, 1, 1, -1].map((sx, i) => c.transform([sx * size[0] / 2, (i < 2 ? -1 : 1) * size[1] / 2, z * size[2] / 2]));
          const top = polygon(1), bottom = polygon(-1);
          bodies += `<g opacity="${opacity}"><polygon points="${bottom.map(xy).join(' ')}" fill="${color}" stroke="${palette.blueGray}"/>`;
          if (view === 'spatial') for (let i = 0; i < 4; i++) bodies += `<polygon points="${[top[i]!, top[(i + 1) % 4]!, bottom[(i + 1) % 4]!, bottom[i]!].map(xy).join(' ')}" fill="${color}" stroke="${palette.blueGray}"/>`;
          if (view !== 'spatial') {
            const ps = [...top, ...bottom].map(project), xs = ps.map(p => p[0]), ys = ps.map(p => p[1]);
            bodies += `<rect x="${Math.min(...xs)}" y="${Math.min(...ys)}" width="${Math.max(...xs)-Math.min(...xs)}" height="${Math.max(...ys)-Math.min(...ys)}" fill="${color}" stroke="${palette.blueGray}"/>`;
          } else bodies += `<polygon points="${top.map(xy).join(' ')}" fill="${color}" stroke="${palette.blueGray}"/>`;
          bodies += '</g>';
          if (role === 'payload') symbols += `<text x="${x}" y="${y-6}" text-anchor="middle" class="diagram-note">${model.design.payload.toFixed(1)} kg</text>`;
        } else if (role === 'motor') {
          symbols += `<rect x="${x-5}" y="${y-5}" width="10" height="10" rx="2" fill="${color}" stroke="${palette.orange}" stroke-width="1.5" opacity="${opacity}"/>`;
        } else if (role === 'foot' || role === 'tool') {
          symbols += `<circle cx="${x}" cy="${y}" r="${role === 'foot' ? 7 : 9}" fill="${color}" stroke="${palette.red}" stroke-width="1.5" opacity="${opacity}"/>`;
        } else if (role === 'belt') {
          links += line(c.transform([0, 0, -c.component.size[2] / 2]), c.transform([0, 0, c.component.size[2] / 2]), `stroke="${palette.greenLine}" stroke-width="3" stroke-dasharray="6 4"`);
        }
      }
      if (node.joint) {
        const [x, y] = project(item.start);
        symbols += `<circle cx="${x}" cy="${y}" r="4.5" fill="white" stroke="${node.id === selected ? palette.selected : palette.muted}" stroke-width="2" opacity="${opacity}"/>`;
      }
    }
    const item = geometry.find(g => g.node.id === selected)!, mid = project(item.end ? mul(add(item.start, item.end), .5) : item.start);
    const label = memberLabel ?? item.node.label[zh ? 1 : 0], name = escape(label);
    const labelWidth = Math.min(195, Math.max(116, label.length * (zh ? 11 : 6.4) + 20)), labelX = Math.min(744 - labelWidth, mid[0] + 13);
    const annotation = `<g pointer-events="none"><rect x="${labelX}" y="${mid[1]-21}" width="${labelWidth}" height="${item.node.member?43:28}" rx="5" fill="white" stroke="#dce6e4"/><text x="${labelX+10}" y="${mid[1]-4}" class="diagram-label">${name}</text>${item.node.member?`<text x="${labelX+10}" y="${mid[1]+13}" class="diagram-note">${(item.node.member.length*1000).toFixed(0)} mm</text>`:''}</g>`;
    let com = '';
    if (showCOM) {
      let total = 0, center: V3 = [0, 0, 0];
      for (const node of model.nodes) {total += node.mass; center = add(center, mul(add(poses[node.id]!.p, rotate(poses[node.id]!.q, node.com)), node.mass));}
      center = mul(center, 1 / total); const [x, y] = project(center);
      com = `<g pointer-events="none"><title>${zh ? '整机质心' : 'Assembly COM'}</title><circle cx="${x}" cy="${y}" r="9" fill="white" stroke="${palette.red}" stroke-width="1.5"/><path d="M${x-6} ${y}h12M${x} ${y-6}v12" stroke="${palette.red}"/></g>`;
    }
    host.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 430" role="group" aria-label="${zh ? '机构连接与质量布置示意，可点击杆件' : 'Joint connections and mass placement; select a member'}"><style>text{font-family:system-ui,sans-serif}.diagram-label{font-size:12px;fill:${palette.ink}}.diagram-note{font-size:11px;fill:${palette.muted}}[data-member]{cursor:pointer}[data-member]:focus{outline:none}[data-member]:focus line:last-child{stroke:${palette.orange}}</style><defs><pattern id="diagram-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="${palette.neutral}"/></pattern></defs><rect width="760" height="430" fill="${palette.background}"/><rect width="760" height="430" fill="url(#diagram-grid)"/>${bodies}${links}${symbols}${com}${annotation}<text x="24" y="403" class="diagram-note">${zh ? '关节中心与杆长按模型投影 · 符号表示部件位置' : 'Projected joint centres and link lengths · symbols locate components'}</text></svg>`;
  }
  async function capture() {
    const svg = host.querySelector('svg'); if (!svg) throw Error('No diagram');
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], {type:'image/svg+xml'}));
    try {
      const img = new Image(); img.src = url; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = 1520; canvas.height = 860;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    } finally {URL.revokeObjectURL(url);}
  }
  return {draw, capture};
}
