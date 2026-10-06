# -*- coding: utf-8 -*-
"""
IMPORTAR NIVELES SKP
===============================================================================
Script de PRUEBA para pyRevit. Diagnostico inicial; permite aplicar desde el dialogo.
Usa API Level.Create y unidades internas en pies. Prueba en Revit pendiente.

Que hace
--------
Lee JSON del visor ODR y crea niveles nativos, sin mover niveles existentes.
La cota cero del visor se coloca en la elevacion interna indicada por el usuario.
Configuracion
-------------
MODO: diagnostico inicial. TOLERANCIA_CM: coincidencia de alturas existentes.
"""
MODO = "diagnostico"
TOLERANCIA_CM = 0.1

import io
import json
import math
from pyrevit import revit, DB, forms, script
try:
    doc
except NameError:
    doc = revit.doc
try:
    uidoc
except NameError:
    uidoc = revit.uidoc
output = script.get_output()

def a_cm(pies):
    if pies is None:
        return None
    try:
        return DB.UnitUtils.ConvertFromInternalUnits(pies, DB.UnitTypeId.Centimeters)
    except Exception:
        return DB.UnitUtils.ConvertFromInternalUnits(pies, DB.DisplayUnitType.DUT_CENTIMETERS)

def desde_cm(cm):
    try:
        return DB.UnitUtils.ConvertToInternalUnits(cm, DB.UnitTypeId.Centimeters)
    except Exception:
        return DB.UnitUtils.ConvertToInternalUnits(cm, DB.DisplayUnitType.DUT_CENTIMETERS)

path = forms.pick_file(file_ext="json", title="JSON de niveles del visor SKP")
if not path:
    script.exit()
try:
    with io.open(path, "r", encoding="utf-8-sig") as stream:
        data = json.load(stream)
    if data.get("schema") != "odr-skp-survey-1" or data.get("units") != "m":
        raise ValueError("JSON no compatible; se requieren metros")
    rows = data.get("levels", [])
    if not rows:
        raise ValueError("No hay niveles registrados")
    names = set()
    for row in rows:
        value = float(row["elevation"])
        if math.isnan(value) or math.isinf(value):
            raise ValueError("Cota no finita")
        name = row["name"].strip()
        if not name or name in names:
            raise ValueError("Nombres vacios o duplicados; corrige la tabla del visor")
        names.add(name)
        row["name"] = name
except Exception as exc:
    forms.alert("No se puede leer el archivo: {0}".format(exc))
    script.exit()

offset = forms.ask_for_string(default="0", prompt="Elevacion INTERNA de Revit (cm) donde colocar el cero del visor. No es la cota topografica.", title="Referencia de niveles")
if offset is None:
    script.exit()
try:
    offset_cm = float(offset.replace(",", "."))
    if math.isnan(offset_cm) or math.isinf(offset_cm):
        raise ValueError()
except Exception:
    forms.alert("Referencia no valida")
    script.exit()

existing = list(DB.FilteredElementCollector(doc).OfClass(DB.Level))
existing_names = {}
for level in existing:
    try:
        name = DB.Element.Name.GetValue(level)
    except Exception:
        name = level.Name
    existing_names[name] = level
plan = []
conflicts = []
for row in rows:
    cm = float(row["elevation"]) * 100.0 + offset_cm
    match = existing_names.get(row["name"])
    if match is not None:
        if abs(a_cm(match.ProjectElevation) - cm) <= TOLERANCIA_CM:
            action = "Existe; omitir"
        else:
            action = "CONFLICTO: nombre con otra cota"
            conflicts.append(row["name"])
    else:
        same = [l for l in existing if abs(a_cm(l.ProjectElevation) - cm) <= TOLERANCIA_CM]
        if same:
            action = "Existe altura; omitir"
        elif any(abs(p[1]-cm) <= TOLERANCIA_CM for p in plan if p[2] == "Crear"):
            action = "Altura repetida en archivo; omitir"
        else:
            action = "Crear"
    plan.append((row["name"], cm, action))
output.print_md("# Niveles desde SKP")
output.print_table(table_data=plan, columns=["Nombre", "Elevacion interna (cm)", "Accion"])
if conflicts:
    forms.alert("Hay nombres existentes con otra altura. Corrige los nombres o la referencia. No se modifica el modelo.")
    script.exit()
pending = [p for p in plan if p[2] == "Crear"]
if not pending:
    output.print_md("No hay niveles nuevos para crear.")
    script.exit()
choice = forms.CommandSwitchWindow.show(["Solo diagnostico", "Crear niveles"], message="Revisa la tabla y la referencia interna antes de aplicar")
if choice == "Crear niveles":
    with revit.Transaction("ODR - Niveles desde SKP"):
        for name, cm, action in pending:
            level = DB.Level.Create(doc, desde_cm(cm))
            level.Name = name
    output.print_md("Creados {0} niveles. No se crean vistas de planta automaticamente.".format(len(pending)))
