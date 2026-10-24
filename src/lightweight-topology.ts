import {language,onLanguageChange} from './language.js';
import {densitySVG,convergenceSVG,type TopologyRun} from './topology-figures.js';
export function mountTopology(figure:HTMLElement){
 const poster=figure.querySelector<HTMLImageElement>('[data-topology-image]')!,base=poster.src.slice(0,poster.src.lastIndexOf('/')+1),play=figure.querySelector<HTMLButtonElement>('[data-topology-play]')!,range=figure.querySelector<HTMLInputElement>('[data-topology-range]')!,metrics=figure.querySelector<HTMLElement>('[data-topology-metrics]')!,density=figure.querySelector<HTMLElement>('[data-topology-density]')!,curve=figure.querySelector<HTMLElement>('[data-topology-curve]')!,status=figure.querySelector<HTMLElement>('[data-topology-status]')!;
 let run:TopologyRun|undefined,step=0,field:'density'|'benefit'='density',playing=false,timer:ReturnType<typeof setInterval>|undefined,pending:Promise<void>|undefined;
 const tr=(en:string,zh:string)=>language==='en'?en:zh;
 const update=()=>{
  play.textContent=tr(playing?'Pause':step===80?'Replay':'Play evolution',playing?'暂停':step===80?'重新播放':'播放演化');play.setAttribute('aria-pressed',String(playing));range.setAttribute('aria-label',tr('Optimization iteration','优化迭代次数'));range.value=String(step);
  figure.querySelectorAll<HTMLButtonElement>('[data-topology-step]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.topologyStep)===step)));
  figure.querySelectorAll<HTMLButtonElement>('[data-topology-field]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.topologyField===field)));
  if(!run)return;const f=run.frames[step]!;poster.hidden=true;
  density.innerHTML=densitySVG(run,step,field,language);curve.innerHTML=convergenceSVG(run,step,language);
  metrics.innerHTML=`<span>${tr('Iteration','迭代')}<b>${step} / 80</b></span><span>${tr('Compliance c','柔度 c')}<b>${f.compliance.toFixed(2)}</b></span><span>${tr('c / initial c','相对初始柔度')}<b>${(f.compliance/run.frames[0]!.compliance).toFixed(3)}</b></span><span>${tr('Material volume','材料体积分数')}<b>${(f.volume*100).toFixed(2)}%</b></span>`;
  status.textContent=field==='benefit'?tr('Sensitivity is normalized by the current frame’s 99th percentile. Larger values identify where added material reduces compliance more.','敏度按当前帧的第 99 百分位归一化；数值较大，表示增加少量材料能更有效地降低柔度。'):tr('Dark cells retain more material. The volume budget stays at 40% throughout the solve.','深色单元保留更多材料，整个求解过程的材料体积预算保持为 40%。');
 };
 const stop=()=>{playing=false;if(timer)clearInterval(timer);timer=undefined;update();};
 const load=()=>pending??=fetch(base+'topology-evolution.json').then(async r=>{if(!r.ok)throw Error('Topology data unavailable');const data=await r.json() as TopologyRun;if(data.schema!=='anncatto.simp.v1'||data.frames.length!==81)throw Error('Invalid topology data');run=data;update();}).catch(()=>{pending=undefined;status.textContent=tr('Unable to load iteration data. Reload to try again.','未能载入迭代数据，请刷新后重试。');});
 range.addEventListener('input',()=>{const next=Number(range.value);stop();step=next;void load().then(update);});
 figure.addEventListener('click',async event=>{const target=event.target as Element;
  const choice=target.closest<HTMLButtonElement>('[data-topology-step]');if(choice){stop();step=Number(choice.dataset.topologyStep);await load();update();}
  const mode=target.closest<HTMLButtonElement>('[data-topology-field]');if(mode){field=mode.dataset.topologyField as typeof field;await load();update();}
  if(target.closest('[data-topology-play]')){if(playing){stop();return;}await load();if(!run)return;if(step===80)step=0;playing=true;update();timer=setInterval(()=>{step++;if(step>=80){step=80;stop();}else update();},140);}
 });
 new IntersectionObserver(entries=>{if(entries[0]!.isIntersecting)void load();else if(playing)stop();},{rootMargin:'200px'}).observe(figure);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});onLanguageChange(update);update();
}
