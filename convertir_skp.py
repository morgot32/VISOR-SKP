"""Lectura local SKP mediante la biblioteca instalada. Coordenadas de salida en metros."""
import ctypes as C
import json
import os
import sys
from pathlib import Path

class Ref(C.Structure):
    _fields_ = [('ptr', C.c_void_p)]
class Point(C.Structure):
    _fields_ = [('x', C.c_double), ('y', C.c_double), ('z', C.c_double)]
class Transform(C.Structure):
    _fields_ = [('values', C.c_double * 16)]

IDENTITY = [1.,0.,0.,0.,0.,1.,0.,0.,0.,0.,1.,0.,0.,0.,0.,1.]
def multiply(a,b):
    return [sum(a[k*4+r]*b[c*4+k] for k in range(4)) for c in range(4) for r in range(4)]
def point(t,p):
    v = [p.x,p.y,p.z,1.]
    q = [sum(t[k*4+r]*v[k] for k in range(4)) for r in range(4)]
    return [q[i]/q[3]*0.0254 for i in range(3)]

def convert(source, target):
    candidates = [Path(os.environ.get('SKETCHUP_API_DIR','')) / 'SketchUpAPI.dll']
    candidates += [Path(r'C:\Program Files\Autodesk') / p / 'SketchUpAPI.dll' for p in ['Revit 2025','Revit 2024','Navisworks Manage 2026/Loaders/ATF','FormIt']]
    dll = next((p.resolve() for p in candidates if p.is_file()), None)
    if dll is None:
        raise RuntimeError('No se encuentra SketchUpAPI.dll. Define SKETCHUP_API_DIR con una instalacion compatible.')
    directory = os.add_dll_directory(str(dll.parent))
    api = C.CDLL(str(dll))
    def call(name,*args):
        rc = getattr(api,name)(*args)
        if rc != 0:
            raise RuntimeError('%s: SUResult %s' % (name,rc))
    def getrefs(entities,kind):
        n = C.c_size_t()
        call('SUEntitiesGetNum'+kind,entities,C.byref(n))
        if not n.value: return []
        a = (Ref*n.value)(); count = C.c_size_t()
        call('SUEntitiesGet'+kind,entities,C.c_size_t(n.value),a,C.byref(count))
        return list(a)[:count.value]
    def name(obj,method,fallback):
        s = Ref(); call('SUStringCreate',C.byref(s))
        try:
            if getattr(api,method)(obj,C.byref(s)) != 0: return fallback
            n=C.c_size_t(); call('SUStringGetUTF8Length',s,C.byref(n))
            buf=C.create_string_buffer(n.value+1); count=C.c_size_t()
            call('SUStringGetUTF8',s,C.c_size_t(len(buf)),buf,C.byref(count))
            return buf.value.decode('utf-8') or fallback
        finally: call('SUStringRelease',C.byref(s))
    meshes=[]; stats={'faces':0,'triangles':0,'instances':0}
    def walk(entities,t,label,depth=0):
        if depth>100: raise RuntimeError('Anidamiento excesivo')
        positions=[]
        for face in getrefs(entities,'Faces'):
            helper=Ref(); call('SUMeshHelperCreate',C.byref(helper),face)
            try:
                n=C.c_size_t(); nt=C.c_size_t(); count=C.c_size_t()
                call('SUMeshHelperGetNumVertices',helper,C.byref(n))
                call('SUMeshHelperGetNumTriangles',helper,C.byref(nt))
                vertices=(Point*n.value)(); indices=(C.c_size_t*(nt.value*3))()
                if not nt.value: continue
                call('SUMeshHelperGetVertices',helper,C.c_size_t(n.value),vertices,C.byref(count))
                call('SUMeshHelperGetVertexIndices',helper,C.c_size_t(nt.value*3),indices,C.byref(count))
                for i in indices: positions.extend(point(t,vertices[i]))
                stats['faces']+=1; stats['triangles']+=nt.value
            finally: call('SUMeshHelperRelease',C.byref(helper))
        if positions: meshes.append({'name':label,'positions':positions})
        for kind in ('Groups','Instances'):
            for i,obj in enumerate(getrefs(entities,kind)):
                child=Ref(); trans=Transform()
                if kind=='Groups':
                    call('SUGroupGetEntities',obj,C.byref(child))
                    call('SUGroupGetTransform',obj,C.byref(trans))
                    text=name(obj,'SUGroupGetName','Grupo %d'%(i+1))
                else:
                    definition=Ref()
                    call('SUComponentInstanceGetDefinition',obj,C.byref(definition))
                    call('SUComponentDefinitionGetEntities',definition,C.byref(child))
                    call('SUComponentInstanceGetTransform',obj,C.byref(trans))
                    text=name(definition,'SUComponentDefinitionGetName','Componente %d'%(i+1))
                stats['instances']+=1
                walk(child,multiply(t,list(trans.values)),label+' / '+text,depth+1)
    api.SUInitialize(); model=Ref()
    try:
        call('SUModelCreateFromFile',C.byref(model),C.c_char_p(str(Path(source).resolve()).encode('utf-8')))
        entities=Ref(); call('SUModelGetEntities',model,C.byref(entities))
        walk(entities,IDENTITY,Path(source).stem)
        allpos=[m['positions'] for m in meshes]
        bounds=[[min(min(p[i::3]) for p in allpos) for i in range(3)], [max(max(p[i::3]) for p in allpos) for i in range(3)]]
        result={'schema':'odr-skp-mesh-1','source':Path(source).name,'units':'m','bounds':bounds,'stats':stats,'meshes':meshes,
                'limitations':'Geometria triangulada; sin texturas, escenas ni filtros de visibilidad SKP. Incluye entidades ocultas.'}
        Path(target).write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
        print(json.dumps({'bounds_m':bounds,'stats':stats,'meshes':len(meshes),'output':str(target)}))
    finally:
        if model.ptr: api.SUModelRelease(C.byref(model))
        api.SUTerminate(); directory.close()

if __name__=='__main__':
    convert(sys.argv[1],sys.argv[2])
