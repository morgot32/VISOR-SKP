param([switch]$NoBrowser)
$ErrorActionPreference='Stop'
$visorRoot=$PSScriptRoot
$visorUrl='http://127.0.0.1:8765'
function Test-Visor {
    try {
        $visorHealth=Invoke-RestMethod -Uri "$visorUrl/health" -TimeoutSec 2
        return ($visorHealth.service -eq 'odr-skp-viewer')
    } catch { return $false }
}
if (-not (Test-Visor)) {
    # Comprobar si el puerto ya pertenece a una version anterior del visor.
    # No detener procesos ajenos ni una conversion que pueda estar en curso.
    try {
        $visorPage=Invoke-WebRequest -Uri "$visorUrl/" -TimeoutSec 2 -UseBasicParsing
        if ($visorPage.StatusCode -eq 200) {
            throw 'Hay un servidor anterior abierto. Cierra su consola antes de iniciar esta version.'
        }
    } catch {
        if ($_.Exception.Message -like 'Hay un servidor anterior*') { throw }
    }
    $visorPython=(Get-Command python.exe -ErrorAction SilentlyContinue).Source
    if (-not $visorPython) { throw 'No se encuentra Python. Revisa la instalacion de Python en este equipo.' }
    $visorLogs=Join-Path $visorRoot '_logs'
    New-Item -ItemType Directory -Path $visorLogs -Force | Out-Null
    $visorArgs=@('-u',('"'+(Join-Path $visorRoot 'servidor.py')+'"'),'--no-browser')
    Start-Process -FilePath $visorPython -ArgumentList $visorArgs -WorkingDirectory $visorRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $visorLogs 'servidor.log') -RedirectStandardError (Join-Path $visorLogs 'errores.log') | Out-Null
    $visorReady=$false
    for ($visorAttempt=0; $visorAttempt -lt 20; $visorAttempt++) {
        if (Test-Visor) { $visorReady=$true;break }
        Start-Sleep -Milliseconds 300
    }
    if (-not $visorReady) { throw "No se pudo iniciar el visor. Revisa $visorLogs\errores.log" }
}
if (-not $NoBrowser) { Start-Process $visorUrl }
Write-Host 'Visor disponible en http://127.0.0.1:8765'
Write-Host 'El servidor sigue funcionando aunque cierres esta ventana.'
