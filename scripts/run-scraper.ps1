# run-scraper.ps1
# Runner para el scraper de ARRIENDA+ (ejecutado por la tarea programada "ArriendaScraperMensual").
#
# IMPORTANTE: el scraper DEBE correr headful (ventana real de Chromium) porque los portales
# usan anti-bot (Akamai / Cloudflare Turnstile) que bloquean headless. Por eso la tarea
# programada se configura como interactiva (/it) y solo corre cuando el usuario esta logueado.
#
# Salvedad: hoy el .env apunta a Supabase local (debe estar corriendo). Al pasar a Supabase
# en la nube solo se actualiza el .env; este runner no cambia.

$ErrorActionPreference = 'Continue'

# (a) Posicionarse en la raiz del repo
$RepoRoot = 'd:\Projects\Personal\arrienda+'
Set-Location -LiteralPath $RepoRoot

# (b) Crear la carpeta de logs si no existe
$LogDir = Join-Path $RepoRoot '.scraper-logs'
if (-not (Test-Path -LiteralPath $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

# Log con timestamp
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogFile = Join-Path $LogDir "scraper-$Timestamp.log"

"=== ARRIENDA+ scraper iniciado: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File -FilePath $LogFile -Encoding utf8

# (c) Ejecutar el scraper redirigiendo stdout + stderr al log.
# Comando exacto: node --env-file=.env --experimental-strip-types apps/scraper/src/index.ts --once
& node --env-file=.env --experimental-strip-types 'apps/scraper/src/index.ts' --once *>> $LogFile
$ExitCode = $LASTEXITCODE

# (c2) Notificaciones de corte (avisa X dias antes segun config admin + override arrendador).
"--- notificaciones: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ---" | Out-File -FilePath $LogFile -Encoding utf8 -Append
& node --env-file=.env --experimental-strip-types 'apps/scraper/src/notify.ts' *>> $LogFile

# (d) Escribir el codigo de salida al final del log
"=== ARRIENDA+ scraper finalizado: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - ExitCode: $ExitCode ===" | Out-File -FilePath $LogFile -Encoding utf8 -Append

exit $ExitCode
