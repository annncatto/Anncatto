struct Uniforms {
  viewport: vec4f, // width, height, time, dissolve
  rotation: vec4f,
  control: vec4f, // scatter age, vertical offset, result emphasis, reserved
  volume: vec4f, // volume layer width and height
}
struct Face { plane: vec4f, right: vec4f, up: vec4f, center: vec4f }
@group(0) @binding(0) var<uniform> scene: Uniforms;
@group(0) @binding(1) var<storage, read> faces: array<Face>;
@group(0) @binding(2) var blue_noise: texture_2d<f32>;
@group(0) @binding(3) var numbers: texture_2d<f32>;
@group(0) @binding(4) var linear_sampler: sampler;
@group(0) @binding(5) var volume_image: texture_2d<f32>;
@group(0) @binding(6) var<storage, read> vertices: array<vec4f>;

fn rotate(q: vec4f, v: vec3f) -> vec3f { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w*v); }
fn hash3(p: vec3f) -> f32 {
  var a = fract(p * 0.1031);
  a += dot(a, a.yzx + 33.33);
  return fract((a.x + a.y) * a.z);
}
fn noise(p: vec3f) -> f32 {
  let i = floor(p); let f = fract(p); let u = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash3(i), hash3(i+vec3f(1,0,0)),u.x),mix(hash3(i+vec3f(0,1,0)),hash3(i+vec3f(1,1,0)),u.x),u.y),
    mix(mix(hash3(i+vec3f(0,0,1)),hash3(i+vec3f(1,0,1)),u.x),mix(hash3(i+vec3f(0,1,1)),hash3(i+vec3f(1,1,1)),u.x),u.y),u.z);
}
fn density(p: vec3f, time: f32) -> f32 {
  let warp = vec3f(sin(p.y*2.5+time*.23), cos(p.z*2.7-time*.19), sin(p.x*2.2+time*.17))*.65;
  let a = noise(p*2.1+warp+vec3f(time*.09,-time*.11,0));
  let b = noise(p*5.8-warp+vec3f(0,time*.08,-time*.06));
  return pow(smoothstep(.28,.76,a*.80+b*.20),2.6);
}
@vertex fn vertex_main(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let xy = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(xy*2.0-1.0,0,1);
}
struct RayHit { origin: vec3f, direction: vec3f, near: f32, far: f32, face: u32 }
fn intersect(pixel: vec2f, resolution: vec2f) -> RayHit {
  let aspect = scene.viewport.x / scene.viewport.y;
  let extent = max(1.18, 1.13/aspect);
  let uv = (pixel/resolution*2.0-1.0)*vec2f(aspect,-1)*extent;
  let inverse = vec4f(-scene.rotation.xyz,scene.rotation.w);
  let origin = rotate(inverse,vec3f(uv.x,uv.y-scene.control.y,3.2));
  let ray = rotate(inverse,vec3f(0,0,-1));
  var near = 0.0; var far = 10.0; var face_index = 0u;
  for (var i=0u; i<20u; i++) {
    let plane = faces[i].plane;
    let denominator = dot(plane.xyz,ray);
    let numerator = plane.w-dot(plane.xyz,origin);
    if abs(denominator)<0.00001 { if numerator < 0.0 { return RayHit(origin,ray,10.0,0.0,0u); } }
    else {
      let distance = numerator/denominator;
      if denominator < 0.0 { if distance > near { near=distance; face_index=i; } }
      else { far=min(far,distance); }
    }
  }
  return RayHit(origin,ray,near,far,face_index);
}
@fragment fn volume_main(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let hit = intersect(position.xy,scene.volume.xy);
  if hit.near >= hit.far || scene.viewport.w >= 1.0 { return vec4f(1); }
  var transmittance = 1.0; var ink = vec3f(0);
  let step_size = (hit.far-hit.near)/28.0;
  for (var i=0u; i<28u; i++) {
    let sample_point = hit.origin+hit.direction*(hit.near+(f32(i)+.5)*step_size);
    let d = density(sample_point,scene.viewport.z);
    let opacity = 1.0-exp(-d*step_size*5.5);
    let depth = f32(i)/28.0;
    let pigment = mix(vec3f(.075,.15,.19),vec3f(.34,.47,.51),depth);
    ink += transmittance*opacity*pigment;
    transmittance *= 1.0-opacity;
  }
  return vec4f(ink+transmittance*vec3f(1),1);
}
struct SurfaceVertex {
  @builtin(position) position: vec4f,
  @location(0) local: vec3f,
  @location(1) @interpolate(flat) face: u32,
  @location(2) barycentric: vec3f,
}
@vertex fn surface_vertex(@builtin(vertex_index) index: u32) -> SurfaceVertex {
  let p = vertices[index].xyz;
  let world = rotate(scene.rotation,p)+vec3f(0,scene.control.y,0);
  let aspect = scene.viewport.x/scene.viewport.y;
  let extent = max(1.18,1.13/aspect);
  let corners = array<vec3f,3>(vec3f(1,0,0),vec3f(0,1,0),vec3f(0,0,1));
  return SurfaceVertex(vec4f(world.xy/vec2f(extent*aspect,extent),0,1),p,index/3u,corners[index%3u]);
}
@fragment fn fragment_main(in: SurfaceVertex) -> @location(0) vec4f {
  let p = in.local;
  let face = faces[in.face];
  // Screen-space edge width remains stable across faces, viewport sizes and quality levels.
  let edge_pixels = in.barycentric/max(fwidth(in.barycentric),vec3f(.00001));
  let normal = rotate(scene.rotation,face.plane.xyz);
  let blue = (textureLoad(blue_noise,vec2i(in.position.xy)%vec2i(64),0).r*255.0+.5)/256.0;
  // Fixed screen-space blue noise controls coverage; slow 3D noise controls erosion.
  let erosion = noise(p*3.1+vec3f(0,scene.viewport.z*.025,0));
  let coverage = 1.0-smoothstep(erosion*.3, .7+erosion*.3, scene.viewport.w);
  if blue > coverage { return vec4f(1); }
  var color = textureSampleLevel(volume_image,linear_sampler,in.position.xy/scene.viewport.xy,0).rgb;
  let light = dot(normal,normalize(vec3f(-.55,.8,1)))*.5+.5;
  color = mix(color,vec3f(.66,.76,.79),.10+(1.0-light)*.14);
  let edge = 1.0-smoothstep(.2,1.1,min(edge_pixels.x,min(edge_pixels.y,edge_pixels.z)));
  color = mix(color,vec3f(.21,.34,.40),edge*.58);

  let local = p-face.center.xyz;
  let letter_uv = vec2f(dot(local,face.right.xyz),-dot(local,face.up.xyz))/.34+vec2f(.5);
  if all(letter_uv>vec2f(0)) && all(letter_uv<vec2f(1)) {
    let number = u32(face.right.w)-1u;
    let atlas_uv = (vec2f(f32(number%5u),f32(number/5u))+letter_uv)/vec2f(5,4);
    let letter = textureSampleLevel(numbers,linear_sampler,atlas_uv,0).a;
    let emphasis = mix(.48,.94,scene.control.z*pow(max(0.0,normal.z),8.0));
    let digit_ink = select(vec3f(.04,.11,.15),vec3f(.98),dot(color,vec3f(.2126,.7152,.0722))<.52);
    color=mix(color,digit_ink,letter*emphasis);
  }
  return vec4f(color,1);
}
