$formalRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$sourceFiles = Get-ChildItem -LiteralPath $formalRoot -Filter '*.lean' -File -Recurse |
  Where-Object { $_.FullName -notmatch '[\\/]\.lake[\\/]' } |
  Sort-Object { $_.FullName.Substring($formalRoot.Length + 1).Replace("\","/") }
$entries = @(
  $sourceFiles | ForEach-Object {
    $relativePath = $_.FullName.Substring($formalRoot.Length + 1).Replace("\","/")
    "$relativePath $((Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant())"
  }
)
$alg = [System.Security.Cryptography.SHA256]::Create()
$enc = New-Object Text.UTF8Encoding($false)
$digest = $alg.ComputeHash($enc.GetBytes($entries -join "`n"))
$agg = ([BitConverter]::ToString($digest)).Replace("-","").ToLowerInvariant()
Write-Host "count=$($sourceFiles.Count)"
Write-Host "aggregate=$agg"
