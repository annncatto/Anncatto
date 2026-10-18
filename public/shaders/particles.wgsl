struct Uniforms { viewport: vec4f, rotation: vec4f, control: vec4f, volume: vec4f }
struct Seed { position: vec4f, random: vec4f }
@group(0) @binding(0) var<uniform> scene: Uniforms;
@group(0) @binding(1) var<storage,read> seeds: array<Seed>;
struct Vertex { @builtin(position) position: vec4f, @location(0) uv: vec2f, @location(1) opacity: f32 }
fn rotate(q: vec4f,v: vec3f)->vec3f { return v+2.0*cross(q.xyz,cross(q.xyz,v)+q.w*v); }
// Analytic curl of a smooth, periodic vector potential. Radial drift is added separately.
fn curl(p: vec3f,t: f32)->vec3f {
  let k1=vec3f(1.7,2.3,.7); let k2=vec3f(-1.2,1.1,2.5); let k3=vec3f(2.1,-.9,1.4);
  let d1=cos(dot(p,k1)+t*.5); let d2=cos(dot(p,k2)-t*.4); let d3=cos(dot(p,k3)+t*.3);
  return vec3f(k3.y*d3-k2.z*d2,k1.z*d1-k3.x*d3,k2.x*d2-k1.y*d1)*.14;
}
@vertex fn vertex_main(@builtin(vertex_index) vertex: u32,@builtin(instance_index) instance: u32)->Vertex {
  let seed=seeds[instance];
  let age=max(0.0,scene.control.x*2.2-seed.random.x*.9);
  var p=rotate(scene.rotation,seed.position.xyz);
  let drift=normalize(p+vec3f(.0001))*(.24+seed.random.y*.3);
  for(var i=0u;i<8u;i++) { p+=(curl(p,scene.viewport.z-age+age*f32(i)/8.0)+drift)*(age/8.0); }
  p.y+=scene.control.y;
  let aspect=scene.viewport.x/scene.viewport.y;
  let extent=max(1.18,1.13/aspect);
  let corners=array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(-1,1),vec2f(-1,1),vec2f(1,-1),vec2f(1,1));
  let corner=corners[vertex];
  let radius=(.85+seed.random.z*1.1)/scene.viewport.y*2.0;
  var out:Vertex;
  out.position=vec4f(p.xy/vec2f(extent*aspect,extent)+corner*vec2f(radius/aspect,radius),0,1);
  out.uv=corner;
  out.opacity=smoothstep(0.0,.18,age)*(1.0-smoothstep(.6,3.5,age))*.52;
  if scene.control.x<=0.0 {out.opacity=0.0;}
  return out;
}
@fragment fn fragment_main(in:Vertex)->@location(0) vec4f {
  let alpha=(1.0-smoothstep(.25,1.0,length(in.uv)))*in.opacity;
  return vec4f(.16,.29,.35,alpha);
}
