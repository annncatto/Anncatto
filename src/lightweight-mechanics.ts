/** SI units throughout. A screening model for a two-link limb, not a full robot solver. */
export const materials = {
  aluminium: { en: 'Aluminium · 6061-T6', zh: '铝合金 · 6061-T6', rho: 2700, E: 69e9, G: 26e9, strength: 240e6, color: '#b4c9cf' },
  magnesium: { en: 'Magnesium · AZ31B example', zh: '镁合金 · AZ31B 示例', rho: 1780, E: 45e9, G: 17e9, strength: 160e6, color: '#b2c5b8' },
  steel: { en: 'Steel · S355', zh: '结构钢 · S355', rho: 7850, E: 210e9, G: 81e9, strength: 355e6, color: '#84959e' },
  titanium: { en: 'Titanium · Ti-6Al-4V', zh: '钛合金 · Ti-6Al-4V', rho: 4430, E: 114e9, G: 44e9, strength: 830e6, color: '#b0adb8' },
  carbon: { en: 'CFRP · laminate example', zh: 'CFRP · 层合板示例', rho: 1600, E: 60e9, G: 20e9, strength: 300e6, color: '#36464e' },
} as const;
export type Material = keyof typeof materials;
export type RobotType = 'quadruped' | 'biped' | 'arm';
export type SectionType = 'box' | 'tube' | 'solid';
export interface Design {
  robot: RobotType; material: Material; section: SectionType;
  l1: number; l2: number; width: number; height: number; wall: number;
  motorMass: number; rotorInertia: number; ratio: number; remote: boolean;
  bodyMass: number; tipMass: number; force: number; q1: number; q2: number;
}
export const initialDesign: Design = {
  robot: 'quadruped', material: 'aluminium', section: 'box',
  l1: .28, l2: .28, width: .038, height: .05, wall: .002,
  motorMass: .65, rotorInertia: .000025, ratio: 9, remote: false,
  bodyMass: 4.2, tipMass: .12, force: 60, q1: -1.05, q2: -.95,
};
export function validate(d: Design): void {
  if (!(d.material in materials) || !['quadruped','biped','arm'].includes(d.robot) || !['box','tube','solid'].includes(d.section)) throw Error('Unknown design option');
  for (const k of ['l1','l2','width','height','wall','motorMass','rotorInertia','ratio','bodyMass'] as const)
    if (!Number.isFinite(d[k]) || d[k] <= 0) throw Error(`Invalid ${k}`);
  for (const k of ['tipMass','force'] as const) if (!Number.isFinite(d[k]) || d[k] < 0) throw Error(`Invalid ${k}`);
  if (![d.q1,d.q2].every(Number.isFinite)) throw Error('Invalid joint angles');
  if (d.section !== 'solid' && 2*d.wall >= Math.min(d.width,d.height)) throw Error('Wall must be smaller than half the outer section');
}
export function sectionProperties(d: Pick<Design,'section'|'width'|'height'|'wall'>) {
  const b=d.width,h=d.height,t=d.wall;
  if (d.section === 'tube') {
    const D=h,inner=D-2*t;
    const area=Math.PI*(D*D-inner*inner)/4, I=Math.PI*(D**4-inner**4)/64;
    return {area,I,J:2*I,c:D/2};
  }
  const bi=d.section==='solid'?0:b-2*t,hi=d.section==='solid'?0:h-2*t;
  const area=b*h-bi*hi,I=(b*h**3-bi*hi**3)/12;
  // Uniform thin-walled, closed box approximation. A solid rectangle uses Saint-Venant's approximation.
  const a=Math.max(b,h),s=Math.min(b,h);
  const J=d.section==='solid'?a*s**3*(1/3-.21*(s/a)*(1-s**4/(12*a**4)))
    :2*t*(b-t)**2*(h-t)**2/(b+h-2*t);
  return {area,I,J,c:h/2};
}
function compound(rodMass: number, length: number, crossI: number, area: number, tip: number) {
  const mass=rodMass+tip, center=(rodMass*length/2+tip*length)/mass;
  const inertia=rodMass*(length**2/12+crossI/area)+rodMass*(length/2-center)**2+tip*(length-center)**2;
  return {mass,center,inertia};
}
export function limbCount(robot: RobotType) { return robot==='quadruped'?4:robot==='biped'?2:1; }
export function evaluateDesign(d: Design) {
  validate(d);
  const mat=materials[d.material],s=sectionProperties(d),n=limbCount(d.robot);
  const beam1=mat.rho*s.area*d.l1,beam2=mat.rho*s.area*d.l2;
  const transmission=d.remote?.16:0;
  const link1=compound(beam1+transmission,d.l1,s.I,s.area,d.remote?0:d.motorMass);
  const link2=compound(beam2,d.l2,s.I,s.area,d.tipMass);
  const c=Math.cos(d.q2),r1=link1.center,r2=link2.center;
  const reflected=d.ratio**2*d.rotorInertia;
  const M11=link1.inertia+link2.inertia+link1.mass*r1*r1+link2.mass*(d.l1**2+r2*r2+2*d.l1*r2*c)+reflected;
  const M12=link2.inertia+link2.mass*(r2*r2+d.l1*r2*c);
  const M22=link2.inertia+link2.mass*r2*r2+reflected;
  const q12=d.q1+d.q2,cos1=Math.cos(d.q1),cos12=Math.cos(q12),g=9.80665;
  const x=d.l1*cos1+d.l2*cos12,z=d.l1*Math.sin(d.q1)+d.l2*Math.sin(q12);
  const gravity1=g*(link1.mass*r1*cos1+link2.mass*(d.l1*cos1+r2*cos12));
  const gravity2=g*link2.mass*r2*cos12;
  const torque1=gravity1+d.force*x,torque2=gravity2+d.force*d.l2*cos12;
  const L=Math.max(d.l1,d.l2),beamMass=mat.rho*s.area*L;
  const stiffness=3*mat.E*s.I/L**3,deflection=d.force/stiffness,stress=d.force*L*s.c/s.I;
  const modalTipMass=d.l1>=d.l2?beam2+d.tipMass+(d.remote?0:d.motorMass):d.tipMass;
  const frequency=Math.sqrt(stiffness/(modalTipMass+.236*beamMass))/(2*Math.PI);
  const buckling=Math.PI**2*mat.E*s.I/(2*L)**2;
  const totalMass=d.bodyMass+n*(beam1+beam2+2*d.motorMass+d.tipMass+transmission);
  // Inverse operational inertia for an unconstrained planar end point, vertical direction.
  const j1=x,j2=d.l2*cos12,det=M11*M22-M12*M12;
  const inverseMass=(j1*j1*M22-2*j1*j2*M12+j2*j2*M11)/det;
  const effectiveMass=inverseMass>1e-12?1/inverseMass:Infinity;
  return {section:s,beam1,beam2,transmission,link1,link2,M11,M12,M22,reflected,x,z,
    torque1,torque2,totalMass,stiffness,deflection,stress,frequency,buckling,effectiveMass,
    strengthReserve:stress>0?mat.strength/stress:Infinity,
    massBreakdown:[d.bodyMass,n*(beam1+beam2),n*2*d.motorMass,n*d.tipMass,n*transmission],
  };
}
export const presets: Record<string, Partial<Design>> = {
  baseline: {...initialDesign},
  proximal: {...initialDesign,remote:true},
  thin: {...initialDesign,wall:.001},
  tall: {...initialDesign,height:.065,wall:.0016},
};
export function cantileverCurve(x:number,L:number,F:number,E:number,I:number) { return F*x*x*(3*L-x)/(6*E*I); }
export function exportConfiguration(d:Design) { return JSON.stringify({schema:'anncatto.lightweight.v1',units:'SI',design:d,analysis:evaluateDesign(d),assumptions:'Two-link limb; static end load; linear cantilever screening; diagonal ideal reflected rotor inertia.'},null,2); }
const number=(n:number)=>n.toPrecision(9);
export function exportURDF(d:Design):string {
  const a=evaluateDesign(d),n=limbCount(d.robot);
  const bodyMass=d.bodyMass+n*(d.remote?2:1)*d.motorMass;
  const body=`<robot name="lightweight_${d.robot}"><link name="body"><inertial><origin xyz="0 0 0"/><mass value="${number(bodyMass)}"/><inertia ixx="${number(bodyMass*(.25**2+.16**2)/12)}" iyy="${number(bodyMass*(.45**2+.16**2)/12)}" izz="${number(bodyMass*(.45**2+.25**2)/12)}" ixy="0" ixz="0" iyz="0"/></inertial><visual><geometry><box size="0.45 0.25 0.16"/></geometry></visual></link>`;
  const parts=[`<?xml version="1.0"?>\n<!-- SI units. Body budget approximated as a uniform box; limb inertia follows the analytical member-plus-end-mass model. URDF uses Z-up; negative Y joint axes preserve the planar model angle sign. Continuous joints are used because travel and motor ratings are unspecified. Rotor armature requires simulator-specific configuration. -->\n${body}`];
  for(let i=0;i<n;i++) {
    const ox=n===1?0:(i<2?.17:-.17),oy=n===1?0:(i%2?.16:-.16);
    for(const j of [1,2]) {
      const l=j===1?d.l1:d.l2,v=j===1?a.link1:a.link2;
      const b=d.width,h=d.height,t=d.wall;
      const Iz=d.section==='tube'?a.section.I:(h*b**3-(d.section==='solid'?0:(h-2*t)*(b-2*t)**3))/12;
      const rodMass=j===1?a.beam1+a.transmission:a.beam2;
      const Ixx=rodMass*(a.section.I+Iz)/a.section.area,Izz=v.inertia+rodMass*(Iz-a.section.I)/a.section.area;
      const idx=`limb${i}_${j}`,parent=j===1?'body':`limb${i}_1`;
      const dx=j===1?ox:d.l1,dy=j===1?oy:0;
      parts.push(`<link name="${idx}"><inertial><origin xyz="${number(v.center)} 0 0"/><mass value="${number(v.mass)}"/><inertia ixx="${number(Ixx)}" iyy="${number(v.inertia)}" izz="${number(Izz)}" ixy="0" ixz="0" iyz="0"/></inertial><visual><origin xyz="${number(l/2)} 0 0"/><geometry><box size="${number(l)} ${number(d.width)} ${number(d.height)}"/></geometry></visual></link><joint name="joint_${idx}" type="continuous"><parent link="${parent}"/><child link="${idx}"/><origin xyz="${number(dx)} ${number(dy)} 0"/><axis xyz="0 -1 0"/></joint>`);
    }
  }
  return parts.join('\n')+'\n</robot>\n';
}
