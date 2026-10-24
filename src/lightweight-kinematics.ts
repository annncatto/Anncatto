/** Planar two-revolute-joint kinematics, SI units and radians. */
export function forward2R(l1:number,l2:number,q1:number,q2:number) {
  return {x:l1*Math.cos(q1)+l2*Math.cos(q1+q2),y:l1*Math.sin(q1)+l2*Math.sin(q1+q2)};
}
export function inverse2R(l1:number,l2:number,x:number,y:number,branch:-1|1=-1) {
  if(![l1,l2,x,y].every(Number.isFinite)||l1<=0||l2<=0)throw Error('Invalid two-link geometry or target');
  const r=Math.hypot(x,y),min=Math.abs(l1-l2),max=l1+l2;
  const radius=Math.min(max,Math.max(min,r)),angle=r>1e-12?Math.atan2(y,x):0;
  const px=radius*Math.cos(angle),py=radius*Math.sin(angle);
  const c=Math.max(-1,Math.min(1,(radius*radius-l1*l1-l2*l2)/(2*l1*l2)));
  const q2=branch*Math.acos(c),q1=angle-Math.atan2(l2*Math.sin(q2),l1+l2*Math.cos(q2));
  const reached=forward2R(l1,l2,q1,q2),error=Math.hypot(reached.x-x,reached.y-y);
  return {q1,q2,x:reached.x,y:reached.y,reachable:r>=min-1e-9&&r<=max+1e-9,error};
}
/** Stationary-body treadmill cycle; phase in [0,1), not a contact dynamics simulation. */
export function footCycle(phase:number,stride:number,lift:number,duty=.62) {
  const p=((phase%1)+1)%1;
  if(p<duty)return {x:stride*(.5-p/duty),y:0,stance:true};
  const u=(p-duty)/(1-duty),smooth=u*u*(3-2*u);
  const tangent=-stride*(1-duty)/duty;
  return {x:stride*(smooth-.5)+tangent*(u-3*u*u+2*u*u*u),y:lift*Math.sin(Math.PI*u)**2,stance:false};
}
