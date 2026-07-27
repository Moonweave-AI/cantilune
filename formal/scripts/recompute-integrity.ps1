[CmdletBinding()]
param(
  [switch]$Write
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$formalRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$repoRoot = (Resolve-Path (Join-Path $formalRoot "..")).Path
$integrityPath = Join-Path $formalRoot "source-integrity.json"

function Get-TextSha256 {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Text
  )

  $algorithm = [Security.Cryptography.SHA256]::Create()
  try {
    $encoding = [Text.UTF8Encoding]::new($false)
    $digest = $algorithm.ComputeHash($encoding.GetBytes($Text))
    return ([BitConverter]::ToString($digest)).
      Replace("-", "").
      ToLowerInvariant()
  }
  finally {
    $algorithm.Dispose()
  }
}

function Get-CanonicalText {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $strictUtf8 = [Text.UTF8Encoding]::new($false, $true)
  $text = [IO.File]::ReadAllText($Path, $strictUtf8)
  return $text -replace "`r`n?", "`n"
}

function Get-CanonicalTextSha256 {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  return Get-TextSha256 -Text (Get-CanonicalText -Path $Path)
}

$sourceFiles = @(
  Get-ChildItem `
    -LiteralPath $formalRoot `
    -Filter "*.lean" `
    -File `
    -Force `
    -Recurse |
    Where-Object { $_.FullName -notmatch "[\\/]\.lake[\\/]" }
)
$entries = @(
  $sourceFiles | ForEach-Object {
    $relativePath = $_.FullName.
      Substring($formalRoot.Length + 1).
      Replace("\", "/")
    "$relativePath $(Get-CanonicalTextSha256 -Path $_.FullName)"
  }
)
[Array]::Sort($entries, [StringComparer]::Ordinal)

$aggregate = Get-TextSha256 -Text ($entries -join "`n")

$pinnedRelativePaths = @(
  ".gitattributes",
  ".github/workflows/formal.yml",
  "docs/adr/0001-unified-formal-structure.md",
  "docs/adr/zh-CN/0001-unified-formal-structure.zh-CN.md",
  "docs/rfc/0002-projection-consistency.md",
  "docs/rfc/zh-CN/0002-projection-consistency.zh-CN.md",
  "docs/spec/formal-semantics.md",
  "docs/spec/zh-CN/formal-semantics.zh-CN.md",
  "formal/lean-toolchain",
  "formal/lakefile.toml",
  "formal/lake-manifest.json",
  "formal/axiom-audit-targets.txt",
  "formal/p1c-rule-matrix.json",
  "formal/scripts/ci.ps1",
  "formal/scripts/recompute-integrity.ps1"
)
$pinnedInputs = [ordered]@{}
foreach ($relativePath in $pinnedRelativePaths) {
  $absolutePath = Join-Path $repoRoot $relativePath
  if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
    throw "Pinned integrity input is missing: $relativePath"
  }
  $pinnedInputs[$relativePath] =
    Get-CanonicalTextSha256 -Path $absolutePath
}

$document = [ordered]@{
  schemaVersion = 2
  algorithm = "SHA-256"
  textEncoding = "UTF-8"
  textNormalization = "CRLF and CR normalized to LF; UTF-8 encoded without BOM"
  fileHashMode = "canonical-utf8-lf"
  pathSchemaVersion = 1
  pathNormalization =
    "formal-relative path with / separators; entries sorted by StringComparer.Ordinal"
  entryFormat =
    "sorted formal-relative-path SPACE lowercase-canonical-text-sha256, joined with LF and no trailing LF"
  leanSourceFileCount = $sourceFiles.Count
  leanSourceAggregateSha256 = $aggregate
  pinnedInputs = $pinnedInputs
}

Write-Host "count=$($sourceFiles.Count)"
Write-Host "aggregate=$aggregate"
foreach ($entry in $pinnedInputs.GetEnumerator()) {
  Write-Host "pinned=$($entry.Key) $($entry.Value)"
}

if ($Write) {
  $json = $document | ConvertTo-Json -Depth 4 -Compress
  [IO.File]::WriteAllText(
    $integrityPath,
    $json + "`n",
    [Text.UTF8Encoding]::new($false)
  )
  Write-Host "updated=$integrityPath"
}
