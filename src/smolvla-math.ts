export type FloatFormat = 'fp32' | 'fp16' | 'bf16';
const formats = {fp32:{fraction:23,min:-126,max:127},fp16:{fraction:10,min:-14,max:15},bf16:{fraction:7,min:-126,max:127}};
const roundEven=(x:number)=>{const f=Math.floor(x),r=x-f;return r<.5?f:r>.5?f+1:f%2===0?f:f+1;};

/** Round a JS number to the named binary format, nearest with ties to even. */
export function quantizeFloat(value:number,format:FloatFormat):number{
  if(!Number.isFinite(value)||value===0)return value;
  const a=Math.abs(value),s=Math.sign(value),f=formats[format];
  const exponent=Math.floor(Math.log2(a));
  const spacing=2**(Math.max(exponent,f.min)-f.fraction);
  const rounded=roundEven(a/spacing)*spacing;
  return s*(rounded>=2**(f.max+1)?Infinity:rounded);
}

/** Both paths start from the same representable value; master accumulates in FP32. */
export function roundingSeries(weight:number,delta:number,format:FloatFormat,steps=100){
  let direct=quantizeFloat(weight,format),master=Math.fround(direct);
  const points=[{step:0,direct,master,compute:quantizeFloat(master,format)}];
  for(let i=1;i<=steps;i++){
    direct=quantizeFloat(direct-delta,format);
    master=Math.fround(master-delta);
    points.push({step:i,direct,master,compute:quantizeFloat(master,format)});
  }
  return points;
}

export function latencyBudget(horizon:number,hz:number,threshold:number,latencyMs:number){
  if(!Number.isFinite(horizon+hz+threshold+latencyMs)||horizon<=0||hz<=0||threshold<0||threshold>1||latencyMs<0)throw Error('Invalid timing inputs');
  const delay=latencyMs/1000,buffer=threshold*horizon/hz;
  return {buffer,delay,elapsedSteps:Math.ceil(hz*delay),idle:Math.max(0,delay-buffer),syncHz:horizon/(horizon/hz+delay)};
}
