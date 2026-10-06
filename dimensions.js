import {axisValue,projectedEnd} from './measurement.js';
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const scale=(a,k)=>a.map(v=>v*k);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normalize=a=>scale(a,1/Math.hypot(...a));
// Cota independiente de la camara: siempre usa los ejes reales del modelo.
export function dimensionLayout(m){
 const a=m.a,b=projectedEnd(a,m.b,m.axis),delta=sub(b,a),length=Math.hypot(...delta);
 if(length<1e-8)return null;
 const direction=normalize(delta);let perpendicular=cross(direction,[0,0,1]);
 if(Math.hypot(...perpendicular)<1e-6)perpendicular=[1,0,0];
 perpendicular=normalize(perpendicular);
 const offset=Number.isFinite(m.offset)?m.offset:1;
 const shift=scale(perpendicular,offset),start=add(a,shift),end=add(b,shift);
 const size=Math.min(.15,length/5),width=size*.35;
 const wing=(tip,inward)=>{const base=add(tip,scale(inward,size));return [add(base,scale(perpendicular,width)),add(base,scale(perpendicular,-width))];};
 const [sa,sb]=wing(start,direction),[ea,eb]=wing(end,scale(direction,-1));
 const overrun=scale(perpendicular,(offset<0?-1:1)*.15);
 return {start,end,direction,perpendicular,normal:normalize(cross(direction,perpendicular)),label:scale(add(start,end),.5),value:axisValue(a,m.b,m.axis),
 segments:[[a,add(start,overrun)],[m.b,add(end,overrun)],[start,end],[start,sa],[start,sb],[end,ea],[end,eb]]};
}
