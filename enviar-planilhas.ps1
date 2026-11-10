$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$log  = Join-Path $repo 'enviar-planilhas.log'
function Log($m) { "$(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')  $m" | Add-Content -Path $log -Encoding UTF8 }
function G { $out = & git @args 2>&1; if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' '): $out" }; $out }

# Arquivos do painel (melhorias) que o script envia quando mudam
$painel = @('index.html', 'core.js', 'scripts', 'enviar-planilhas.ps1')

try {
    Set-Location $repo
    # Planilhas: só arquivos NOVOS. Planilha já enviada que foi aberta/alterada é ignorada.
    $novas = @(G -c core.quotePath=false ls-files --others --exclude-standard -- planilhas |
        Where-Object { "$_" -match '\.(xls|xlsx|xlsm)$' -and "$_" -notmatch '~\$' })
    $mud = @(G status --porcelain -- $painel)
    if ($novas.Count -eq 0 -and $mud.Count -eq 0) { exit 0 }
    Start-Sleep -Seconds 20
    foreach ($f in $novas) { G add -- "$f" | Out-Null }
    G add -A -- $painel | Out-Null
    $arquivos = (G -c core.quotePath=false diff --cached --name-only) -join ', '
    if (-not $arquivos) { exit 0 }
    if ($novas.Count -gt 0) { $titulo = 'Nova planilha' } else { $titulo = 'Melhoria do painel' }
    G commit -m "${titulo}: $arquivos" | Out-Null
    # merge (sem rebase): não mexe em planilhas abertas no Excel
    G pull --no-rebase --no-edit | Out-Null
    G push | Out-Null
    Log "Enviado: $arquivos"
} catch {
    & git merge --abort 2>&1 | Out-Null
    Log "ERRO: $($_.Exception.Message)"
    exit 1
}
