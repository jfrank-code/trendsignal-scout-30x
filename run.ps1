$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Write-Host "`nTrendSignal Scout | Frontend React + Bootstrap / Backend FastAPI" -ForegroundColor Green
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw "No se encuentra Python en PATH. Instala Python 3.10 o superior." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "No se encuentra npm en PATH. Instala Node.js LTS." }
python -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)"
if ($LASTEXITCODE -ne 0) { throw "Se necesita Python 3.10 o superior." }
if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Se ha creado .env. Añade OPENAI_API_KEY y vuelve a ejecutar run.ps1." -ForegroundColor Yellow
  Start-Process notepad.exe -ArgumentList ".env"
  exit
}
python -m pip install --disable-pip-version-check -r requirements.txt
Push-Location frontend
if (-not (Test-Path "node_modules")) { npm install }
Pop-Location
Start-Process -FilePath "cmd.exe" -ArgumentList @('/k', "cd /d `"$PSScriptRoot`" && python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000")
Start-Process -FilePath "cmd.exe" -ArgumentList @('/k', "cd /d `"$PSScriptRoot\frontend`" && npm run dev")
Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:5173"
