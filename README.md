# ODR · Visor SKP

Visor local para explorar geometría SketchUp, medir, registrar niveles y exportar referencias CAD/BIM.

## Ejecutar

1. Instala Python 3.10 o superior.
2. En Windows abre `ABRIR_VISOR.cmd`, o ejecuta `python servidor.py` desde esta carpeta.
3. Abre http://127.0.0.1:8765/ . El servidor escucha solo en localhost.

El ejemplo incluido son dos bloques generados, sin datos de proyectos reales. Para abrir otro SKP usa **Abrir SKP**. El lector requiere `SketchUpAPI.dll` de una instalación compatible; busca Revit 2025/2024, Navisworks o FormIt. Puedes definir `SKETCHUP_API_DIR` apuntando a la carpeta que contiene esa DLL. La DLL no se distribuye. Sin ella puedes explorar el ejemplo, pero no convertir nuevos SKP.

El navegador debe permitir WebGL. No hace falta npm para ejecutar el visor: Three.js está incluido localmente. El servidor debe permanecer ejecutándose.

## Herramientas

- Cubo de navegación, perspectiva/ortogonal, bloqueo de giro, Mano y aristas.
- Pantalla completa y controles para ocultar/mostrar barras y panel lateral.
- Selección de piezas, caras planas y aristas. Ctrl agrega; Shift quita. Ventana izquierda→derecha contiene; derecha→izquierda cruza.
- Separación por grupos originales, piezas conectadas o superficies planas.
- Aislamiento, nombres, colores, grupos de selección, capas, transparencia y parámetros de texto.
- Medidas 3D/X/Y/Z/XY, cotas gráficas, referencia vertical y propuestas de niveles horizontales.
- Guardar/recuperar sesión JSON. Guarda antes de cargar otro modelo o recargar la página.

## Exportaciones y límites

DXF usa centímetros; IFC/JSON usan metros. IFC4 contiene mallas de referencia y niveles: no reconoce automáticamente muros o losas ni crea un RVT editable. `IMPORTAR_NIVELES_SKP.py` permite crear niveles en Revit mediante pyRevit. Los colores, capas y parámetros del visor se guardan en sesión; todavía no se convierten en layers DWG ni propiedades BIM exportadas.

No se altera el SKP original. La geometría se triangula; no se recuperan texturas, escenas ni todos los filtros de visibilidad. Las caras son superficies coplanares conectadas derivadas de la malla. Revisar las unidades y una medida conocida antes de usar resultados en un proyecto.

## Subir a GitHub

Crea un repositorio y sube el contenido completo de esta carpeta, incluyendo `vendor`, `modelo.json`, `.gitignore` y `.github`. Alternativamente, desde aquí:

```bash
git init
git add .
git commit -m "Visor SKP inicial"
git branch -M main
git remote add origin URL_DE_TU_REPOSITORIO
git push -u origin main
```

GitHub almacena el código. GitHub Pages por sí solo no ejecuta el servidor Python ni convierte SKP; el visor completo se ejecuta localmente. No incluyas modelos privados, DLL, logs o sesiones de trabajo al publicar.

## Verificación

Node.js 20 o superior, sin dependencias npm:

```bash
npm test
```

Las pruebas cubren mediciones, cotas, DXF/IFC y conservación de triángulos al separar geometría. No sustituyen la comprobación visual en navegador ni la importación real en CAD/Revit. `validar_archivos.py` es opcional y necesita IfcOpenShell.

## Licencias

Consulta `THIRD_PARTY.md`. Elige una licencia para el código propio antes de publicarlo si deseas conceder derechos de reutilización.
