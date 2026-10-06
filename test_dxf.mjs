import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dxf} from './exporters.js';
const data={source:'Prueba',zeroSourceZ:2,levels:[],measurements:[],cadEdges:[{a:[0,0,2],b:[1,0,2],name:'Arista ñ',cadLayer:'Hormigón',color:'#26b9c7',transparency:50}]};
const text=dxf(data,[{positions:[0,0,2,1,0,2,0,1,2],name:'Cara á',cadLayer:'Hormigón',color:'#26b9c7',transparency:50,parameters:{Material:'Hormigón'}}]);
const tags=text.trim().split('\r\n');const entities=[];for(let i=0;i<tags.length;i+=2)if(tags[i]==='0'&&['3DFACE','LINE','TEXT'].includes(tags[i+1])){let end=i+2;while(end<tags.length&&tags[end]!=='0')end+=2;const record=tags.slice(i,end);assert.ok(record.includes('AcDbEntity'));assert.ok(record.includes(tags[i+1]==='3DFACE'?'AcDbFace':'AcDbLine'));entities.push(record);}
assert.equal(entities.length,2);assert.ok(text.includes('Hormig\\U+00F3n'));assert.ok(text.includes('\r\n440\r\n'));fs.writeFileSync(new URL('./pruebas/DXF_CAPAS_CORREGIDO.dxf',import.meta.url),text);
console.log('OK DXF: separadores de clase, caras, aristas, capas, acentos y transparencia');
