// Analytic curves, evaluated per fragment. No time-dependent decoration.
struct Params {
  viewport: vec4f, // physical pixels, logical width and height
  plot: vec4f,     // logical left, top, width, height
  domain: vec4f,   // x minimum, x span, y maximum, plot kind
  values: vec4f,   // prior mean, prior sigma, loss example, reserved
  primary: vec4f,  // solid curve color, shared with SVG
  secondary: vec4f, // dashed curve color, shared with SVG
};
@group(0) @binding(0) var<uniform> params: Params;
@vertex fn vertex_main(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  let positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(positions[index], 0.0, 1.0);
}
fn density(x: f32, mu: f32, sigma: f32) -> vec2f {
  let d = (x - mu) / sigma;
  let v = exp(-0.5 * d * d) / (sigma * sqrt(6.28318530718));
  return vec2f(v, -(x - mu) / (sigma * sigma) * v);
}
fn loss(x: f32, squared: bool) -> vec2f {
  if (params.values.z < 0.5) {
    if (squared) { return vec2f(x*x, 2.0*x); }
    return vec2f(abs(x), sign(x));
  }
  let left = x + 1.0;
  let right = x - 1.0;
  if (squared) { return vec2f((left*left+right*right)/2.0, 2.0*x); }
  return vec2f((abs(left)+abs(right))/2.0, (sign(left)+sign(right))/2.0);
}
fn stroke(point: vec2f, value: vec2f, width: f32) -> f32 {
  let y = params.plot.y + params.plot.w * (1.0 - value.x / params.domain.z);
  let slope = -value.y * params.plot.w / params.domain.z * params.domain.y / params.plot.z;
  let distance = abs(point.y - y) / sqrt(1.0 + slope*slope);
  let pixel = params.viewport.z / params.viewport.x;
  return 1.0 - smoothstep(width - 0.7*pixel, width + 0.7*pixel, distance);
}
@fragment fn fragment_main(@builtin(position) fragment: vec4f) -> @location(0) vec4f {
  let point = fragment.xy / params.viewport.xy * params.viewport.zw;
  let local = point - params.plot.xy;
  if (local.x < 0.0 || local.x > params.plot.z || local.y < 0.0 || local.y > params.plot.w) {
    return vec4f(0.0);
  }
  let x = params.domain.x + local.x / params.plot.z * params.domain.y;
  var first: vec2f;
  var second: vec2f;
  if (params.domain.w < 0.5) {
    first = density(x, params.values.x, params.values.y);
    second = density(x, 1.4, 0.7);
  } else {
    first = loss(x, false);
    second = loss(x, true);
  }
  let alpha1 = stroke(point, first, 1.5);
  let dash = select(0.0, 1.0, fract(local.x / 13.0) < 0.6153846);
  let alpha2 = stroke(point, second, 1.5) * dash;
  let blue = params.primary.rgb;
  let ink = params.secondary.rgb;
  let alpha = alpha1 + alpha2 * (1.0 - alpha1);
  return vec4f(blue * alpha1 + ink * alpha2 * (1.0 - alpha1), alpha);
}
