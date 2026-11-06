# Envia automaticamente para o GitHub as planilhas novas salvas na pasta "planilhas".
# Rodado pelo Agendador de Tarefas do Windows.

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$log  = Join-Path $repo 'enviar-planilhas.log'
function Log($m) { "$(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')  $m" | Add-Content -Path $log -Encoding UTF8 }
function G { $out = & git @args 2>&1; if ($LASTEXITCODE -ne 0) { throw "git $($args[0]): $out" }; $out }

try {
    Set-Location $repo
    $mudou = G status --porcelain -- planilhas | Where-Object { "$_" -match '\.(xls|xlsx|xlsm)"?$' -and "$_" -notmatch '~\$' }
    if (-not $mudou) { exit 0 }

    Start-Sleep -Seconds 20
    G add -A -- planilhas ':(exclude)planilhas/~$*' | Out-Null
    $arquivos = (G diff --cached --name-only) -join ', '
    if (-not $arquivos) { exit 0 }
    G commit -m "Nova planilha: $arquivos" | Out-Null
    G pull --rebase --autostash | Out-Null
    G push | Out-Null
    Log "Enviado: $arquivos"
} catch {
    Log "ERRO: $($_.Exception.Message)"
    exit 1
}
