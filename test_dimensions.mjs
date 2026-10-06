import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dimensionLayout} from './dimensions.js';
import {sessionData,dxf,ifc} from './exporters.js';
for(const axis of ['x','y','z','xy','3d']){
 const m={name:'Cota prueba',dimension:true,a:[0,0,0],b:[3,4,12],axis,offset:1};
 const layout=dimensionLayout(m);
 assert.ok(layout);assert.equal(layout.segments.length,7);
 assert.ok(Math.abs(layout.direction.reduce((sum,v,i)=>sum+v*layout.perpendicular[i],0))<1e-9);
 assert.equal(layout.value,({x:3,y:4,z:12,xy:5,'3d':13})[axis]);
 const negative=dimensionLayout({...m,offset:-1});
 assert.ok(Math.abs(Math.hypot(...layout.start.map((v,i)=>v-negative.start[i]))-2)<1e-9);
}
assert.equal(dimensionLayout({a:[0,0,0],b:[0,2,3],axis:'x'}),null);
const model=JSON.parse(fs.readFileSync(new URL('./modelo.json',import.meta.url)));
const data=sessionData(model,4,[],[{name:'Cota Z',dimension:true,offset:1,a:[0,0,4],b:[3,4,16],axis:'z'}]);
assert.equal(data.measurements[0].dimension,true);assert.equal(data.measurements[0].offset,1);
assert.equal(data.measurements[0].value,12);
const cad=dxf(data);assert.equal((cad.match(/\r\nLINE\r\n/g)||[]).length,7);assert.ok(cad.includes('1200.00 cm'));
assert.equal((ifc(data).match(/IFCPOLYLINE\(/g)||[]).length,7);
console.log('OK: cotas X/Y/Z/XY/3D, ambos lados, cero relativo y exportacion de 7 segmentos');
