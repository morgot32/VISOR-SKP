// Split only within each original SKP group; coordinates are never changed.
export function splitMeshes(meshes,mode){
 if(mode==='groups')return meshes;
 return meshes.flatMap(mesh=>{
  const p=mesh.positions,n=p.length/9,parent=Array.from({length:n},(_,i)=>i),edges=new Map(),normals=[];
  const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const key=i=>p.slice(i,i+3).map(v=>v.toFixed(7)).join(',');
  for(let t=0;t<n;t++){
   const i=t*9,a=p.slice(i,i+3),b=p.slice(i+3,i+6),c=p.slice(i+6,i+9),u=b.map((v,j)=>v-a[j]),v=c.map((v,j)=>v-a[j]);
   let normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...normal);normals[t]=normal.map(x=>len?x/len:0);
   const keys=[key(i),key(i+3),key(i+6)];
   for(let e=0;e<3;e++){
    const edge=[keys[e],keys[(e+1)%3]].sort().join('|'),others=edges.get(edge)||[];
    for(const other of others)if(mode==='connected'||Math.abs(normals[t].reduce((s,x,j)=>s+x*normals[other][j],0))>1-1e-8)parent[root(t)]=root(other);
    others.push(t);edges.set(edge,others);
   }
  }
  const parts=new Map();for(let t=0;t<n;t++){const r=root(t);if(!parts.has(r))parts.set(r,[]);const out=parts.get(r);for(let i=t*9;i<t*9+9;i++)out.push(p[i]);}
  return [...parts.values()].map((positions,i)=>({name:mesh.name+' / '+(mode==='connected'?'Pieza conectada ':'Superficie ')+(i+1),positions}));
 });
}
