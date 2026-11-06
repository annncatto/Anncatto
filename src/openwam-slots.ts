const demo=document.querySelector<HTMLElement>('[data-rotation-demo]');
if(demo){
 const input=demo.querySelector<HTMLInputElement>('input')!;
 const update=()=>{
  const angle=Number(input.value),radians=angle*Math.PI/180;
  const f=(n:number)=>Math.abs(n)<.00005?'0.0000':n.toFixed(4);
  demo.querySelector('[data-unwrapped]')!.textContent=angle.toFixed(1)+'°';
  demo.querySelector('[data-wrapped]')!.textContent=(((angle+180)%360+360)%360-180).toFixed(1)+'°';
  demo.querySelector('[data-column-one]')!.textContent=`[${f(Math.cos(radians))}, ${f(Math.sin(radians))}, 0]`;
  demo.querySelector('[data-column-two]')!.textContent=`[${f(-Math.sin(radians))}, ${f(Math.cos(radians))}, 0]`;
 };
 input.addEventListener('input',update);update();
}
