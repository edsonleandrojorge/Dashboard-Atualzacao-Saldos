# Envia automaticamente para o GitHub as planilhas novas salvas na pasta "planilhas".
# Rodado pelo Agendador de Tarefas do Windows a cada 10 minutos.

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$log  = Join-Path $repo 'enviar-planilhas.log'
function Log($m) { "$(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')  $m" | Add-Content -Path $log -Encoding UTF8 }

try {
    Set-Location $repo
    $mudou = git status --porcelain -- planilhas | Where-Object { $_ -match '\.(xls|xlsx|xlsm)"?$' -and $_ -notmatch '~\$' }
    if (-not $mudou) { exit 0 }

    Start-Sleep -Seconds 20
    git pull --rebase --autostash --quiet
    git add -- 'planilhas/*.xls' 'planilhas/*.xlsx' 'planilhas/*.xlsm' ':(exclude)planilhas/~$*' 2>$null
    $arquivos = (git diff --cached --name-only) -join ', '
    if (-not $arquivos) { exit 0 }
    git commit -m "Nova planilha: $arquivos" --quiet
    git push --quiet
    Log "Enviado: $arquivos"
} catch {
    Log "ERRO: $($_.Exception.Message)"
    exit 1
}
