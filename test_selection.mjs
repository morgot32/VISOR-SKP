import assert from 'node:assert/strict';
import {splitMeshes} from './selection.js';
import fs from 'node:fs';
const square=[0,0,0,1,0,0,1,1,0,0,0,0,1,1,0,0,1,0];
const disconnected=[...square,...square.map((v,i)=>i%3===0?v+3:v)];
const mesh=[{name:'Una sola malla',positions:disconnected}];
assert.equal(splitMeshes(mesh,'groups').length,1);
assert.equal(splitMeshes(mesh,'connected').length,2);
assert.equal(splitMeshes(mesh,'surfaces').length,2);
const corner=[...square,0,0,0,1,0,0,1,0,1];
assert.equal(splitMeshes([{name:'Esquina',positions:corner}],'connected').length,1);
assert.equal(splitMeshes([{name:'Esquina',positions:corner}],'surfaces').length,2);
const model=JSON.parse(fs.readFileSync(new URL('./modelo.json',import.meta.url),'utf8'));
const triangles=p=>{const out=[];for(let i=0;i<p.length;i+=9)out.push(JSON.stringify(p.slice(i,i+9)));return out;};
const original=model.meshes.flatMap(m=>triangles(m.positions)).sort();
const counts={};for(const mode of ['groups','connected','surfaces']){const split=splitMeshes(model.meshes,mode);assert.deepEqual(split.flatMap(m=>triangles(m.positions)).sort(),original);counts[mode]=split.length;}
fs.writeFileSync(new URL('./pruebas/separacion_resultado.json',import.meta.url),JSON.stringify({passed:true,counts,triangles:original.length}));
