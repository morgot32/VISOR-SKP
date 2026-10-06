"""Servidor local del visor; no envia el modelo a servicios externos."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json, os, subprocess, sys, webbrowser, uuid, shutil, socket
from urllib.parse import urlparse, parse_qs

ROOT=Path(__file__).resolve().parent
class LocalServer(ThreadingHTTPServer):
    allow_reuse_address=False
    def server_bind(self):
        # Windows permitia dos instancias en el mismo puerto y seguia atendiendo
        # la version anterior. Reservar exclusivamente el puerto del visor.
        if hasattr(socket,'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET,socket.SO_EXCLUSIVEADDRUSE,1)
        super().server_bind()
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw): super().__init__(*a,directory=str(ROOT),**kw)
    def do_GET(self):
        if urlparse(self.path).path=='/health':
            self.respond_json(200,{'service':'odr-skp-viewer','version':3,'canConvert':True})
            return
        super().do_GET()
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        super().end_headers()
    def respond_json(self,status,body):
        raw=json.dumps(body,ensure_ascii=False).encode('utf-8')
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
    def do_POST(self):
        # Solo llamadas desde este visor local. Conversion aislada en otro proceso.
        origin=self.headers.get('Origin')
        expected='http://'+self.headers.get('Host','')
        if urlparse(self.path).path!='/convert' or origin not in (None,expected):
            self.send_error(403);return
        tmp=None
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=200*1024*1024: raise ValueError('Tamano no valido (maximo 200 MB)')
            name=Path(parse_qs(urlparse(self.path).query).get('name',['modelo.skp'])[0]).name
            if not name.lower().endswith('.skp'): raise ValueError('Se requiere un archivo SKP')
            # Carpetas normales con permisos heredados. TemporaryDirectory en
            # Python reciente crea ACL privadas que bloqueaban la carga SKP.
            uploads=ROOT/'_cargas';uploads.mkdir(exist_ok=True)
            tmp=uploads/uuid.uuid4().hex;tmp.mkdir()
            source=tmp/name;target=tmp/'mesh.json'
            raw=self.rfile.read(size)
            if len(raw)!=size:raise ValueError('Carga incompleta; vuelve a seleccionar el archivo')
            source.write_bytes(raw)
            result=subprocess.run([sys.executable,str(ROOT/'convertir_skp.py'),str(source),str(target)],capture_output=True,timeout=180)
            if result.returncode: raise RuntimeError(result.stderr.decode('utf-8',errors='replace')[-2000:])
            body=target.read_bytes()
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
        except Exception as exc:
            self.respond_json(400,{'error':'No se pudo abrir el SKP: '+str(exc)})
        finally:
            # Solo elimina la carpeta UUID creada por esta solicitud bajo _cargas.
            if tmp is not None and tmp.parent.resolve()==(ROOT/'_cargas').resolve():
                try:shutil.rmtree(tmp)
                except OSError:pass

if __name__=='__main__':
    try:
        server=LocalServer(('127.0.0.1',int(os.environ.get('ODR_SKP_PORT','8765'))),Handler)
    except OSError:
        print('El puerto del visor ya esta en uso. Cierra la consola anterior de ABRIR_VISOR y vuelve a abrirlo.',flush=True)
        sys.exit(1)
    url='http://127.0.0.1:'+str(server.server_port)
    print('Visor SKP: '+url,flush=True)
    if '--no-browser' not in sys.argv:webbrowser.open(url)
    server.serve_forever()
