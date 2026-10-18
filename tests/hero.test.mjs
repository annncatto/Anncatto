import test from "node:test";
import assert from "node:assert/strict";
import { vertices, faces, dot, cross, rotate, faceOrientation } from "../.build/hero/d20.js";
import { DiceRoll, rollD20, ROLL_LIMIT } from "../.build/hero/roll.js";

test("all twenty numbered faces are planar, outward, and align upright with their result", () => {
  assert.equal(vertices.length,12);
  assert.equal(faces.length,20);
  assert.deepEqual(faces.map(f=>f.value).sort((a,b)=>a-b),Array.from({length:20},(_,i)=>i+1));
  const edges = new Map();
  for (const face of faces) {
    for (const index of face.indices) assert.ok(Math.abs(dot(face.normal,vertices[index])-face.distance)<1e-12);
    const [a,b,c]=face.indices.map(i=>vertices[i]);
    assert.ok(dot(cross(b.map((v,i)=>v-a[i]),c.map((v,i)=>v-a[i])),face.normal)>0);
    for (let i=0;i<3;i++) {
      const key = [face.indices[i],face.indices[(i+1)%3]].sort((a,b)=>a-b).join(",");
      edges.set(key,(edges.get(key)||0)+1);
    }
    const opposite = faces.find(other=>dot(face.normal,other.normal)<-.999);
    assert.equal(face.value+opposite.value,21);
    const q=faceOrientation(face.value);
    for (const [input,expected] of [[face.normal,[0,0,1]],[face.up,[0,1,0]],[face.right,[1,0,0]]])
      rotate(q,input).forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-12));
  }
  assert.equal(edges.size,30);
  assert.ok([...edges.values()].every(count=>count===2));
});
test("d20 sampling rejects the incomplete modulo range", () => {
  const values=[2**32-1,ROLL_LIMIT,0,19,ROLL_LIMIT-1];
  const source={getRandomValues(buffer){buffer[0]=values.shift(); return buffer;}};
  assert.equal(rollD20(source),1);
  assert.equal(rollD20(source),20);
  assert.equal(rollD20(source),20);
  assert.equal(values.length,0);
});
test("a roll settles on its sampled face before dissolving and rejects repeat input", () => {
  const roll=new DiceRoll();
  assert.equal(roll.roll(0),true);
  const result=roll.frame(2.2);
  assert.equal(roll.roll(2.2),false);
  assert.equal(result.stage,"result");
  assert.deepEqual(result.rotation,faceOrientation(result.result));
  assert.equal(roll.frame(4.2).stage,"dissolving");
  assert.ok(roll.frame(5).dissolve>0);
  assert.equal(roll.frame(6.4).stage,"restoring");
  assert.equal(roll.frame(8.2).stage,"idle");
  assert.equal(roll.roll(8.2,true),true);
  const reduced=roll.frame(8.2);
  assert.equal(reduced.stage,"result");
  assert.equal(reduced.dissolve,0);
  assert.deepEqual(reduced.rotation,faceOrientation(reduced.result));
  const pending=new DiceRoll();pending.roll(0);
  const expected=pending.frame(.5).result;
  const settled=pending.settle();
  assert.equal(settled.result,expected);
  assert.equal(settled.stage,"result");
  assert.deepEqual(settled.rotation,faceOrientation(expected));
  assert.equal(pending.roll(.5,true),true);
});
