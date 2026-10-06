// Calculos en metros, independientes de la vista y de sus unidades de presentacion.
export const AXES=['3d','x','y','z','xy'];
export function components(a,b){
 const delta=b.map((v,i)=>v-a[i]);
 return {dx:delta[0],dy:delta[1],dz:delta[2],distance:Math.hypot(...delta),horizontal:Math.hypot(delta[0],delta[1])};
}
export function axisValue(a,b,axis='3d'){
 const c=components(a,b);
 return ({x:Math.abs(c.dx),y:Math.abs(c.dy),z:Math.abs(c.dz),xy:c.horizontal, '3d':c.distance})[axis]??c.distance;
}
export function projectedEnd(a,b,axis='3d'){
 return axis==='x'?[b[0],a[1],a[2]]:axis==='y'?[a[0],b[1],a[2]]:axis==='z'?[a[0],a[1],b[2]]:axis==='xy'?[b[0],b[1],a[2]]:[...b];
}
// Propuestas de cotas a partir de superficies horizontales, ponderadas por area.
// No presupone que una superficie sea un piso: el usuario acepta cada propuesta.
export function detectElevations(meshes,tolerance=.01,minArea=1){
 if(!(tolerance>0)||!(minArea>=0))throw Error('Tolerancia y area no validas');
 const samples=[];
 for(const m of meshes){const p=m.positions;for(let i=0;i<p.length;i+=9){
  const a=p.slice(i,i+3),b=p.slice(i+3,i+6),c=p.slice(i+6,i+9);
  if(Math.max(a[2],b[2],c[2])-Math.min(a[2],b[2],c[2])>1e-5)continue;
  const area=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;
  if(area<1e-8)continue;
  samples.push({z:(a[2]+b[2]+c[2])/3,area,p:a});
 }}
 samples.sort((a,b)=>a.z-b.z);const groups=[];
 for(const v of samples){let g=groups.at(-1);if(!g||v.z-g.minZ>tolerance){g={minZ:v.z,maxZ:v.z,z:0,area:0,count:0,p:v.p,largest:0};groups.push(g);}g.z+=v.z*v.area;g.area+=v.area;g.count++;g.maxZ=v.z;if(v.area>g.largest){g.largest=v.area;g.p=v.p;}}
 return groups.filter(g=>g.area>=minArea).map(g=>({...g,z:g.z/g.area,p:[g.p[0],g.p[1],g.z/g.area]}));
}
// Indices compactos exactos (9 decimales m), y diagnostico de cierre por aristas.
export function indexedMesh(positions,zero=0){
 if(!positions.length||positions.length%9)throw Error('Malla triangular incompleta');
 const vertices=[],faces=[],map=new Map(),edges=new Map(),seenFaces=new Set();let duplicateTriangles=0;
 for(let i=0;i<positions.length;i+=9){const f=[];for(let j=0;j<9;j+=3){const p=[positions[i+j],positions[i+j+1],positions[i+j+2]-zero];if(!p.every(Number.isFinite))throw Error('Malla con coordenadas no finitas');const key=p.map(v=>v.toFixed(9)).join(',');let k=map.get(key);if(k===undefined){k=vertices.length+1;map.set(key,k);vertices.push(p);}f.push(k);}if(new Set(f).size<3)continue;const faceKey=[...f].sort((a,b)=>a-b).join(',');if(seenFaces.has(faceKey)){duplicateTriangles++;continue;}seenFaces.add(faceKey);faces.push(f);
  for(let j=0;j<3;j++){const a=f[j],b=f[(j+1)%3],key=Math.min(a,b)+','+Math.max(a,b);const edge=edges.get(key)||{count:0,balance:0};edge.count++;edge.balance+=a<b?1:-1;edges.set(key,edge);}
 }
 return {vertices,faces,duplicateTriangles,closed:edges.size>0&&[...edges.values()].every(e=>e.count===2&&e.balance===0)};
}
