"""Prueba independiente de IFC/DXF con lectores instalados de Bonsai."""
import sys, zipfile, tempfile, pathlib, importlib.util, json
root=pathlib.Path(__file__).resolve().parent
wheels=pathlib.Path.home()/'AppData/Roaming/Blender Foundation/Blender/5.1/extensions/blender_org/bonsai/wheels'
with tempfile.TemporaryDirectory(dir=root,ignore_cleanup_errors=True) as tmp:
    for pattern in ('ifcopenshell-*.whl','ezdxf-*.whl','isodate-*.whl','lark-*.whl','typing_extensions-*.whl','pyparsing-*.whl','fonttools-*.whl'):
        for wheel in wheels.glob(pattern):
            with zipfile.ZipFile(wheel) as archive:archive.extractall(tmp)
    sys.path.insert(0,tmp)
    import ifcopenshell, ifcopenshell.validate, ezdxf
    model=ifcopenshell.open(str(root/'pruebas/PRUEBA_NO_USAR_EN_PROYECTO.ifc'))
    logger=ifcopenshell.validate.json_logger()
    ifcopenshell.validate.validate(model,logger,express_rules=False)
    assert not logger.statements, json.dumps(logger.statements,default=str,indent=2)
    assert sorted(s.Elevation for s in model.by_type('IfcBuildingStorey'))==[0.,3.]
    # Procesar realmente la geometria IFC en coordenadas globales y comparar
    # limites y area contra el SKP triangulado, incluyendo el cambio de cero.
    import ifcopenshell.geom
    import numpy as np
    source=json.loads((root/'modelo.json').read_text(encoding='utf-8'))
    settings=ifcopenshell.geom.settings()
    settings.set('use-world-coords',True)
    coords=[]; area_ifc=0.;area_source=0.
    for mesh,elem in zip(source['meshes'],model.by_type('IfcBuildingElementProxy')):
        shape=ifcopenshell.geom.create_shape(settings,elem)
        v=np.array(shape.geometry.verts).reshape(-1,3)
        f=np.array(shape.geometry.faces).reshape(-1,3)
        coords.extend(v.tolist())
        triangles=v[f]
        area_ifc+=float(np.linalg.norm(np.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0]),axis=1).sum()/2)
        src=np.array(mesh['positions']).reshape(-1,3,3)
        keys=set();unique=[]
        for triangle in src:
            key=tuple(sorted(tuple(round(float(x),9) for x in vertex) for vertex in triangle))
            if key not in keys:keys.add(key);unique.append(triangle)
        src=np.array(unique)
        src_area=float(np.linalg.norm(np.cross(src[:,1]-src[:,0],src[:,2]-src[:,0]),axis=1).sum()/2)
        read_area=float(np.linalg.norm(np.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0]),axis=1).sum()/2)
        if abs(src_area-read_area)>.00001:print('AREA_DIFFERENCE',elem.Name,len(src),len(f),src_area-read_area,flush=True)
        assert len(elem.ContainedInStructure)==1
    for mesh in source['meshes']:
        t=np.array(mesh['positions']).reshape(-1,3,3)
        keys=set();unique=[]
        for triangle in t:
            key=tuple(sorted(tuple(round(float(x),9) for x in vertex) for vertex in triangle))
            if key not in keys:keys.add(key);unique.append(triangle)
        t=np.array(unique)
        area_source+=float(np.linalg.norm(np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]),axis=1).sum()/2)
    bounds=np.array([np.min(coords,axis=0),np.max(coords,axis=0)])
    expected=np.array(source['bounds']);expected[:,2]-=4
    assert np.allclose(bounds,expected,atol=1e-6), (bounds,expected)
    assert abs(area_ifc-area_source)<.0001, (area_ifc,area_source)
    cad=ezdxf.readfile(root/'pruebas/PRUEBA_NO_USAR_EN_PROYECTO.dxf')
    audit=cad.audit()
    assert not audit.errors, str(audit.errors)
    assert not audit.fixes, str(audit.fixes)
    assert cad.units==5
    faces=list(cad.modelspace().query('3DFACE'))
    assert len(faces)==28728
    result={'IFC_schema':model.schema,'IFC_validation_errors':len(logger.statements),'IFC_storeys':2,'IFC_meshes':len(model.by_type('IfcTriangulatedFaceSet')),'IFC_bounds_m':bounds.tolist(),'area_difference_m2':area_ifc-area_source,'DXF_faces':len(faces),'DXF_audit_errors':len(audit.errors),'DXF_audit_fixes':len(audit.fixes)}
    (root/'pruebas/validacion.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(result)
