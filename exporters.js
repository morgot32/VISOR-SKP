import {components,axisValue,projectedEnd,indexedMesh} from './measurement.js';
import {dimensionLayout} from './dimensions.js';
// Todos los datos de intercambio usan metros y Z relativa al cero elegido.
export function sessionData(model,zero,levels,measurements){return {schema:'odr-skp-survey-1',source:model.source,units:'m',zeroSourceZ:zero,coordinateSystem:'SKP X/Y; Z relative to zeroSourceZ',levels:levels.map(l=>({name:l.name,storey:l.storey!==false,sourceZ:l.p[2],point:[l.p[0],l.p[1],l.p[2]-zero],elevation:l.p[2]-zero})),measurements:measurements.map(m=>({name:m.name,dimension:!!m.dimension,offset:Number.isFinite(m.offset)?m.offset:1,axis:m.axis||'3d',value:axisValue(m.a,m.b,m.axis),...components(m.a,m.b),a:[m.a[0],m.a[1],m.a[2]-zero],b:[m.b[0],m.b[1],m.b[2]-zero]}))};}
export function dxf(data,meshes=[]){
 const o=[];let handle=256;const add=(...v)=>{for(let i=0;i<v.length;i+=2)if(v[i]===0&&['LTYPE','LAYER','APPID','LINE','TEXT','3DFACE'].includes(v[i+1])){v.splice(i+2,0,5,(handle++).toString(16).toUpperCase());i+=2;}o.push(...v.map(String));};
 const ascii=s=>Array.from(String(s)).map(c=>c.charCodeAt(0)>126?'\\U+'+c.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0'):c==='\n'||c==='\r'?' ':c).join('');
 const layerName=s=>String(s||'SKP_MODELO').replace(/[<>/\\":;?*|=,`]/g,'_').replace(/[\x00-\x1f]/g,' ').slice(0,120)||'SKP_MODELO';
 const pos=(p,base=10)=>{if(p.length!==3||!p.every(Number.isFinite))throw Error('DXF: coordenada no válida');add(base,p[0]*100,base+10,p[1]*100,base+20,p[2]*100);};
 const rgb=c=>/^#[0-9a-f]{6}$/i.test(c||'')?parseInt(c.slice(1),16):null;
 const layers=new Map(['SKP_MODELO','SKP_NIVELES','SKP_NIVELES_TXT','SKP_COTAS','SKP_MEDICIONES','SKP_ARISTAS'].map(n=>[n,{}]));
 for(const m of [...meshes,...(data.cadEdges||[])]){const name=layerName(m.cadLayer);if(!layers.has(name))layers.set(name,{color:m.color});}
 add(0,'SECTION',2,'HEADER',9,'$ACADVER',1,'AC1018',9,'$DWGCODEPAGE',3,'ANSI_1252',9,'$INSUNITS',70,5,9,'$MEASUREMENT',70,1,0,'ENDSEC');
 add(0,'SECTION',2,'TABLES',0,'TABLE',2,'LTYPE',5,'1',100,'AcDbSymbolTable',70,1,0,'LTYPE',2,'CONTINUOUS',70,0,3,'Solid line',72,65,73,0,40,0,0,'ENDTAB',0,'TABLE',2,'LAYER',5,'2',100,'AcDbSymbolTable',70,layers.size);
 for(const [name,props] of layers){add(0,'LAYER',2,ascii(name),70,0,62,7,6,'CONTINUOUS');const color=rgb(props.color);if(color!==null)add(420,color);}
 add(0,'ENDTAB',0,'TABLE',2,'APPID',5,'3',100,'AcDbSymbolTable',70,1,0,'APPID',2,'ODR_SKP',70,0,0,'ENDTAB',0,'ENDSEC',0,'SECTION',2,'ENTITIES');
 const entity=(kind,layer,subclass,props={})=>{add(0,kind,100,'AcDbEntity',8,ascii(layerName(layer)),100,subclass);const color=rgb(props.color);if(color!==null)add(420,color);if(Number.isFinite(props.transparency)){const t=Math.max(0,Math.min(100,props.transparency));add(440,0x02000000|Math.round(255*(1-t/100)));}};
 const metadata=props=>{if(!props.name&&!props.parameters)return;add(1001,'ODR_SKP');const str=ascii(JSON.stringify({name:props.name||'',parameters:props.parameters||{}}));for(let i=0;i<str.length;i+=200)add(1000,str.slice(i,i+200));};
 const line=(a,b,layer,props={})=>{entity('LINE',layer,'AcDbLine',props);pos(a);pos(b,11);metadata(props);};
 const text=(p,s)=>{entity('TEXT','SKP_NIVELES_TXT','AcDbText');pos(p);add(40,20,1,ascii(s),100,'AcDbText');};
 for(const l of data.levels){const p=l.point;line([p[0]-.5,p[1],p[2]],[p[0]+.5,p[1],p[2]],'SKP_NIVELES');line([p[0],p[1]-.5,p[2]],[p[0],p[1]+.5,p[2]],'SKP_NIVELES');text(p,l.name+'  '+l.elevation.toFixed(3)+' m');}
 for(const m of data.measurements){const layout=m.dimension?dimensionLayout(m):null;if(layout){for(const [a,b] of layout.segments)line(a,b,'SKP_COTAS');text(layout.label,(layout.value*100).toFixed(2)+' cm');}else{const b=projectedEnd(m.a,m.b,m.axis);line(m.a,b,'SKP_MEDICIONES');text(b,m.name+' '+(m.axis||'3d').toUpperCase()+' '+(axisValue(m.a,m.b,m.axis)*100).toFixed(2)+' cm');}}
 for(const mesh of meshes){const p=mesh.positions;if(p.length%9)throw Error('DXF: malla incompleta');for(let i=0;i<p.length;i+=9){entity('3DFACE',mesh.cadLayer||'SKP_MODELO','AcDbFace',mesh);for(let k=0;k<4;k++){const j=i+Math.min(k,2)*3;pos([p[j],p[j+1],p[j+2]-data.zeroSourceZ],10+k);}metadata(mesh);}}
 for(const edge of data.cadEdges||[])line([edge.a[0],edge.a[1],edge.a[2]-data.zeroSourceZ],[edge.b[0],edge.b[1],edge.b[2]-data.zeroSourceZ],edge.cadLayer||'SKP_ARISTAS',edge);
 add(0,'ENDSEC',0,'EOF');return o.join('\r\n')+'\r\n';
}
export function csv(data){const q=s=>'"'+String(s).replaceAll('"','""')+'"';const rows=[['tipo','nombre','X_m','Y_m','Z_m','X2_m','Y2_m','Z2_m','distancia_m','horizontal_m','desnivel_m','eje','valor_m','DX_m','DY_m','Z_SKP_m','planta_IFC']];for(const l of data.levels)rows.push(['nivel',l.name,...l.point,'','','','','','','','','',l.sourceZ,l.storey!==false]);for(const m of data.measurements){const c=components(m.a,m.b);rows.push(['medida',m.name,...m.a,...m.b,c.distance,c.horizontal,c.dz,m.axis||'3d',axisValue(m.a,m.b,m.axis),c.dx,c.dy]);}return '\ufeff'+rows.map(r=>r.map(q).join(';')).join('\r\n');}
export function ifc(data,meshes=[]){
 const rows=[];const e=(s)=>{rows.push('#'+(rows.length+1)+'='+s+';');return '#'+rows.length;};
 const s=v=>"'"+Array.from(String(v)).map(c=>c==="'"?"''":c.charCodeAt(0)>126||c==='\\'?'\\X2\\'+c.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0')+'\\X0\\':c).join('')+"'";
 const n=v=>{if(!Number.isFinite(v))throw Error('Coordenada no finita');let t=v.toFixed(9).replace(/0+$/,'');return t.endsWith('.')?t:t;};
 const guid=()=>{const chars='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';let bytes=crypto.getRandomValues(new Uint8Array(16));let x=0n;for(const b of bytes)x=(x<<8n)|BigInt(b);let t='';for(let i=0;i<22;i++){t=chars[Number(x&63n)]+t;x>>=6n;}return s(t);};
 const point=p=>e('IFCCARTESIANPOINT(('+p.map(n).join(',')+'))');
 const axis=p=>e('IFCAXIS2PLACEMENT3D('+point(p)+',$,$)');const place=(parent,p)=>e('IFCLOCALPLACEMENT('+parent+','+axis(p)+')');
 const origin=axis([0,0,0]);const context=e("IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,0.000001,"+origin+',$)');
 const unit=e('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)');const units=e('IFCUNITASSIGNMENT(('+unit+'))');
 const project=e('IFCPROJECT('+guid()+',$,'+s(data.source)+',$,$,$,$,('+context+'),'+units+')');
 const sitePlace=place('$',[0,0,0]);const site=e('IFCSITE('+guid()+",$,'Sitio',$,$,"+sitePlace+',$,$,.ELEMENT.,$,$,$,$,$)');
 const buildingPlace=place(sitePlace,[0,0,0]);const building=e('IFCBUILDING('+guid()+",$,'Edificio SKP',$,$,"+buildingPlace+',$,$,.ELEMENT.,$,$,$)');
 const agg=(a,b)=>e('IFCRELAGGREGATES('+guid()+',$,$,$,'+a+',('+b.join(',')+'))');agg(project,[site]);agg(site,[building]);
 const props=(obj,values)=>{const ps=values.map(([name,type,value])=>e('IFCPROPERTYSINGLEVALUE('+s(name)+',$,'+type+'('+(type==='IFCLABEL'||type==='IFCTEXT'?s(value):type==='IFCINTEGER'?String(Math.round(value)):n(value))+'),$)'));const set=e('IFCPROPERTYSET('+guid()+",$,'ODR_Levantamiento_SKP',$,("+ps.join(',')+'))');e('IFCRELDEFINESBYPROPERTIES('+guid()+',$,$,$,('+obj+'),'+set+')');};
 props(project,[['ArchivoOrigen','IFCLABEL',data.source],['CeroZ_SKP_m','IFCLENGTHMEASURE',data.zeroSourceZ],['Coordenadas','IFCTEXT',data.coordinateSystem||'SKP X/Y; Z relativa al cero']]);
 const ordered=data.levels.filter(l=>l.storey!==false).sort((a,b)=>a.elevation-b.elevation);const unique=[];
 for(const l of ordered){if(!Number.isFinite(l.elevation))throw Error('Nivel no finito');if(!unique.length||Math.abs(l.elevation-unique.at(-1).elevation)>.001)unique.push(l);}
 const floors=unique.map(l=>({elevation:l.elevation,id:e('IFCBUILDINGSTOREY('+guid()+',$,'+s(l.name)+',$,$,'+place(buildingPlace,[0,0,l.elevation])+',$,$,.ELEMENT.,'+n(l.elevation)+')')}));if(floors.length)agg(building,floors.map(f=>f.id));
 const containers=new Map();const contain=(id,z)=>{let parent=building;for(const f of floors)if(z>=f.elevation-.001)parent=f.id;const ids=containers.get(parent)||[];ids.push(id);containers.set(parent,ids);};
 for(const mesh of meshes){const indexed=indexedMesh(mesh.positions,data.zeroSourceZ);if(!indexed.faces.length)continue;const points=indexed.vertices.map(p=>'('+p.map(n).join(',')+')'),faces=indexed.faces.map(f=>'('+f.join(',')+')');
 const list=e('IFCCARTESIANPOINTLIST3D(('+points.join(',')+'))');const set=e('IFCTRIANGULATEDFACESET('+list+',$,'+(indexed.closed?'.T.':'.F.')+',('+faces.join(',')+'),$)');const rep=e("IFCSHAPEREPRESENTATION("+context+",'Body','Tessellation',("+set+'))');const shape=e('IFCPRODUCTDEFINITIONSHAPE($,$,('+rep+'))');const id=e('IFCBUILDINGELEMENTPROXY('+guid()+',$,'+s(mesh.name)+",'Geometria de referencia SKP',$,"+place(buildingPlace,[0,0,0])+','+shape+',$,.NOTDEFINED.)');
 const zs=indexed.vertices.map(p=>p[2]),minZ=zs.reduce((a,b)=>Math.min(a,b),Infinity),maxZ=zs.reduce((a,b)=>Math.max(a,b),-Infinity);contain(id,minZ);props(id,[['RutaGrupoSKP','IFCTEXT',mesh.name],['ZMin_m','IFCLENGTHMEASURE',minZ],['ZMax_m','IFCLENGTHMEASURE',maxZ],['AsignacionPlanta','IFCTEXT','Nivel inferior a ZMin; grupos entre pisos conservados completos'],['Triangulos','IFCINTEGER',indexed.faces.length],['TriangulosDuplicadosOmitidos','IFCINTEGER',indexed.duplicateTriangles]]);}
 const annotation=(name,a,b,values,segments=[[a,b]])=>{const curves=segments.map(([p,q])=>e('IFCPOLYLINE(('+point(p)+','+point(q)+'))'));const rep=e("IFCSHAPEREPRESENTATION("+context+",'Annotation','Curve3D',("+curves.join(',')+'))');const shape=e('IFCPRODUCTDEFINITIONSHAPE($,$,('+rep+'))');const id=e('IFCANNOTATION('+guid()+',$,'+s(name)+',$,$,'+place(buildingPlace,[0,0,0])+','+shape+')');contain(id,a[2]);props(id,values);};
 for(const l of data.levels)annotation(l.name,[l.point[0]-.25,l.point[1],l.elevation],[l.point[0]+.25,l.point[1],l.elevation],[['CotaRelativa_m','IFCLENGTHMEASURE',l.elevation],['ZOriginalSKP_m','IFCLENGTHMEASURE',l.elevation+data.zeroSourceZ]]);
 for(const m of data.measurements){const c=components(m.a,m.b);const layout=m.dimension?dimensionLayout(m):null;annotation(m.name,m.a,projectedEnd(m.a,m.b,m.axis),[['Eje','IFCLABEL',m.axis||'3d'],['Valor_m','IFCLENGTHMEASURE',axisValue(m.a,m.b,m.axis)],['DX_m','IFCLENGTHMEASURE',c.dx],['DY_m','IFCLENGTHMEASURE',c.dy],['DZ_m','IFCLENGTHMEASURE',c.dz],['Distancia3D_m','IFCLENGTHMEASURE',c.distance]],layout?.segments); }
 for(const [parent,ids] of containers)e('IFCRELCONTAINEDINSPATIALSTRUCTURE('+guid()+',$,$,$,('+ids.join(',')+'),'+parent+')');
 return "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');\nFILE_NAME('levantamiento.ifc','"+new Date().toISOString()+"',('ODR'),('ODR'),'ODR SKP','ODR SKP','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n"+rows.join('\n')+'\nENDSEC;\nEND-ISO-10303-21;';
}
