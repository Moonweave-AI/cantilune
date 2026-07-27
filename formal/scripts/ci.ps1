[CmdletBinding()]
param(
  [switch]$RequireComplete
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$formalRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$repoRoot = (Resolve-Path (Join-Path $formalRoot "..")).Path
$toolchainPath = Join-Path $formalRoot "lean-toolchain"
$lakeManifestPath = Join-Path $formalRoot "lake-manifest.json"
$proofManifestPath = Join-Path $formalRoot "proof-obligations.json"
$auditTargetsPath = Join-Path $formalRoot "axiom-audit-targets.txt"
$sourceIntegrityPath = Join-Path $formalRoot "source-integrity.json"

foreach ($requiredPath in @(
    $toolchainPath,
    $lakeManifestPath,
    $proofManifestPath,
    $auditTargetsPath,
    $sourceIntegrityPath
  )) {
  if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
    throw "Required pinned formalization input is missing: $requiredPath"
  }
}

function Get-Sha256 {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).
    Hash.ToLowerInvariant()
}

function Get-TextSha256 {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Text
  )

  $algorithm = [Security.Cryptography.SHA256]::Create()
  try {
    $encoding = New-Object Text.UTF8Encoding($false)
    $digest = $algorithm.ComputeHash($encoding.GetBytes($Text))
    return ([BitConverter]::ToString($digest)).
      Replace("-", "").
      ToLowerInvariant()
  }
  finally {
    $algorithm.Dispose()
  }
}

function Resolve-RepositoryEvidenceFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RelativePath,

    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  if ([IO.Path]::IsPathRooted($RelativePath)) {
    throw "$Label must be a repository-relative path: $RelativePath"
  }

  $candidate = [IO.Path]::GetFullPath((Join-Path $repoRoot $RelativePath))
  $rootPrefix = $repoRoot.TrimEnd(
    [IO.Path]::DirectorySeparatorChar,
    [IO.Path]::AltDirectorySeparatorChar
  ) + [IO.Path]::DirectorySeparatorChar
  if (-not $candidate.StartsWith(
      $rootPrefix,
      [StringComparison]::OrdinalIgnoreCase
    )) {
    throw "$Label escapes the repository root: $RelativePath"
  }
  if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
    throw "$Label does not exist as a file: $RelativePath"
  }

  return $candidate
}

$toolchain = (Get-Content -LiteralPath $toolchainPath -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($toolchain)) {
  throw "formal/lean-toolchain is empty."
}
Write-Host "Pinned Lean toolchain: $toolchain"

$sourceFiles = Get-ChildItem -LiteralPath $formalRoot -Filter "*.lean" -File -Recurse |
  Where-Object { $_.FullName -notmatch "[\\/]\.lake[\\/]" } |
  Sort-Object {
    $_.FullName.Substring($formalRoot.Length + 1).Replace("\", "/")
  }
$sourceEntries = @(
  $sourceFiles | ForEach-Object {
    $relativePath = $_.FullName.
      Substring($formalRoot.Length + 1).
      Replace("\", "/")
    "$relativePath $(Get-Sha256 -Path $_.FullName)"
  }
)
$sourceAggregate = Get-TextSha256 -Text ($sourceEntries -join "`n")
$sourceIntegrity = Get-Content -LiteralPath $sourceIntegrityPath -Raw |
  ConvertFrom-Json
if ([int]$sourceIntegrity.leanSourceFileCount -ne $sourceFiles.Count) {
  throw "Lean source count differs from source-integrity.json: expected $($sourceIntegrity.leanSourceFileCount), found $($sourceFiles.Count)."
}
if ([string]$sourceIntegrity.leanSourceAggregateSha256 -ne $sourceAggregate) {
  throw "Lean source aggregate differs from source-integrity.json: expected $($sourceIntegrity.leanSourceAggregateSha256), found $sourceAggregate."
}
foreach ($pinnedInput in @($sourceIntegrity.pinnedInputs.PSObject.Properties)) {
  $inputPath = Resolve-RepositoryEvidenceFile `
    -RelativePath ([string]$pinnedInput.Name) `
    -Label "Pinned integrity input"
  $actualHash = Get-Sha256 -Path $inputPath
  if ($actualHash -ne [string]$pinnedInput.Value) {
    throw "Pinned input hash differs for $($pinnedInput.Name): expected $($pinnedInput.Value), found $actualHash."
  }
}
Write-Host "Source integrity gate: $($sourceFiles.Count) Lean files, aggregate $sourceAggregate."

$proofManifest = Get-Content -LiteralPath $proofManifestPath -Raw |
  ConvertFrom-Json
$obligations = @($proofManifest.obligations)
$requiredTheorems = @(
  "freeSMC_universal",
  "dpo_result_unique",
  "dpo_concurrency",
  "signature_extension_coherent",
  "rewrite_respects_equiv",
  "event_replay_unique",
  "projection_paths_lift_and_reflect",
  "dag_certificate",
  "reconfigurable_petri_certificate",
  "open_pi_smc",
  "typed_pi_erasure_operational",
  "open_pi_fms_commutes",
  "pi_ra_certificate",
  "pi_mobility_certificate",
  "feedback_stable_set",
  "feedback_almost_sure_hitting",
  "terminal_classification_iff",
  "four_projection_consistency"
)
if ($obligations.Count -ne $requiredTheorems.Count) {
  throw "proof-obligations.json must contain exactly $($requiredTheorems.Count) central obligations; found $($obligations.Count)."
}

$duplicateTheorems = $obligations |
  Group-Object -Property theorem |
  Where-Object { $_.Count -ne 1 }
if ($duplicateTheorems) {
  $names = ($duplicateTheorems | ForEach-Object Name) -join ", "
  throw "Duplicate central theorem entries: $names"
}

$actualTheorems = @($obligations | ForEach-Object theorem | Sort-Object)
$expectedTheorems = @($requiredTheorems | Sort-Object)
$theoremDifference = Compare-Object -ReferenceObject $expectedTheorems `
  -DifferenceObject $actualTheorems
if ($theoremDifference) {
  $differenceText = $theoremDifference |
    ForEach-Object { "$($_.SideIndicator) $($_.InputObject)" }
  throw "The central theorem set differs from the approved 18 obligations:`n$($differenceText -join "`n")"
}

$currentHead = (& git -C $repoRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $currentHead -notmatch "^[0-9a-f]{40}$") {
  throw "Unable to resolve the current repository HEAD."
}
$proofSensitivePaths = @(
  "formal/Cantilune",
  "formal/Cantilune.lean",
  "formal/lean-toolchain",
  "formal/lakefile.toml",
  "formal/lake-manifest.json",
  "formal/axiom-audit-targets.txt"
)

$allowedStatuses = @(
  "missing",
  "partial_scaffold",
  "implemented_unverified",
  "proved",
  "reviewed"
)
foreach ($obligation in $obligations) {
  if ($obligation.status -notin $allowedStatuses) {
    throw "Unknown proof status '$($obligation.status)' for $($obligation.theorem)."
  }

  if ($obligation.status -in @("partial_scaffold", "implemented_unverified") -and
      [string]::IsNullOrWhiteSpace([string]$obligation.leanSymbol)) {
    throw "A partial/implemented obligation requires leanSymbol: $($obligation.theorem)."
  }

  if ($obligation.status -in @("proved", "reviewed")) {
    if ([string]::IsNullOrWhiteSpace([string]$obligation.leanSymbol)) {
      throw "A proved/reviewed obligation requires leanSymbol: $($obligation.theorem)."
    }
    if ([string]$obligation.verifiedCommit -notmatch "^[0-9a-f]{40}$") {
      throw "A proved/reviewed obligation requires an exact 40-hex verifiedCommit: $($obligation.theorem)."
    }
    if ([string]::IsNullOrWhiteSpace([string]$obligation.buildEvidence)) {
      throw "A proved/reviewed obligation requires buildEvidence: $($obligation.theorem)."
    }

    $verifiedCommit = [string]$obligation.verifiedCommit
    & git -C $repoRoot cat-file -e "$verifiedCommit`^{commit}"
    if ($LASTEXITCODE -ne 0) {
      throw "verifiedCommit is not an available commit for $($obligation.theorem): $verifiedCommit"
    }

    & git -C $repoRoot diff --quiet $verifiedCommit -- $proofSensitivePaths
    if ($LASTEXITCODE -eq 1) {
      throw "Proof-sensitive sources differ from verifiedCommit for $($obligation.theorem): $verifiedCommit"
    }
    if ($LASTEXITCODE -ne 0) {
      throw "Unable to compare proof-sensitive sources with verifiedCommit for $($obligation.theorem)."
    }

    $buildEvidencePath = Resolve-RepositoryEvidenceFile `
      -RelativePath ([string]$obligation.buildEvidence) `
      -Label "Build evidence for $($obligation.theorem)"
    $buildEvidenceText = Get-Content -LiteralPath $buildEvidencePath -Raw
    foreach ($requiredEvidenceToken in @(
        $verifiedCommit,
        [string]$obligation.leanSymbol
      )) {
      if (-not $buildEvidenceText.Contains($requiredEvidenceToken)) {
        throw "Build evidence for $($obligation.theorem) is not bound to '$requiredEvidenceToken'."
      }
    }
  }

  if ($obligation.status -eq "reviewed") {
    if ([string]::IsNullOrWhiteSpace([string]$obligation.reviewEvidence)) {
      throw "A reviewed obligation requires independent reviewEvidence: $($obligation.theorem)."
    }
    $reviewEvidencePath = Resolve-RepositoryEvidenceFile `
      -RelativePath ([string]$obligation.reviewEvidence) `
      -Label "Review evidence for $($obligation.theorem)"
    $reviewEvidenceText = Get-Content -LiteralPath $reviewEvidencePath -Raw
    foreach ($requiredReviewToken in @(
        [string]$obligation.verifiedCommit,
        [string]$obligation.leanSymbol
      )) {
      if (-not $reviewEvidenceText.Contains($requiredReviewToken)) {
        throw "Review evidence for $($obligation.theorem) is not bound to '$requiredReviewToken'."
      }
    }
  }
}

if ($RequireComplete) {
  $incomplete = @(
    $obligations |
      Where-Object { $_.status -ne "reviewed" } |
      ForEach-Object { "$($_.id):$($_.theorem)=$($_.status)" }
  )
  if ($incomplete.Count -gt 0) {
    throw "Completion gate requires all central obligations to be reviewed:`n$($incomplete -join "`n")"
  }
}

$forbiddenPattern = "\b(?:sorry|admit|axiom|unsafe)\b"
$violations = @(
  foreach ($sourceFile in $sourceFiles) {
    Select-String -LiteralPath $sourceFile.FullName -Pattern $forbiddenPattern |
      ForEach-Object {
        [PSCustomObject]@{
          Path = $_.Path
          Line = $_.LineNumber
          Text = $_.Line.Trim()
        }
      }
  }
)
if ($violations.Count -gt 0) {
  $rendered = $violations |
    ForEach-Object { "$($_.Path):$($_.Line): $($_.Text)" }
  throw "Forbidden whole-word Lean placeholders were found:`n$($rendered -join "`n")"
}
Write-Host "Lean placeholder gate: clean ($($sourceFiles.Count) project source files)."

$auditSourcePath = $null
Push-Location $formalRoot
try {
  & lake --version
  if ($LASTEXITCODE -ne 0) {
    throw "lake --version failed with exit code $LASTEXITCODE."
  }

  & lean --version
  if ($LASTEXITCODE -ne 0) {
    throw "lean --version failed with exit code $LASTEXITCODE."
  }

  & lake build
  if ($LASTEXITCODE -ne 0) {
    throw "lake build failed with exit code $LASTEXITCODE."
  }

  $configuredAuditTargets = @(
    Get-Content -LiteralPath $auditTargetsPath -Encoding UTF8 |
      ForEach-Object { $_.Trim() } |
      Where-Object { $_ -and -not $_.StartsWith("#") }
  )
  $manifestAuditTargets = @(
    $obligations |
      Where-Object {
        $_.status -in @(
          "partial_scaffold",
          "implemented_unverified",
          "proved",
          "reviewed"
        )
      } |
      ForEach-Object leanSymbol
  )
  $auditTargets = @(
    $configuredAuditTargets + $manifestAuditTargets |
      Sort-Object -Unique
  )

  if ($auditTargets.Count -eq 0) {
    Write-Host "Kernel dependency audit: no targets configured."
  }
  else {
    foreach ($target in $auditTargets) {
      if ($target -notmatch "^[\p{L}_][\p{L}\p{N}_'.]*$") {
        throw "Invalid Lean declaration in axiom-audit-targets.txt: $target"
      }
    }

    $auditSourcePath = Join-Path ([IO.Path]::GetTempPath()) (
      "cantilune-kernel-audit-{0}.lean" -f [Guid]::NewGuid().ToString("N")
    )
    $auditLines = @("import Cantilune", "") +
      ($auditTargets | ForEach-Object { "#print axioms $_" })
    [IO.File]::WriteAllLines(
      $auditSourcePath,
      $auditLines,
      [Text.UTF8Encoding]::new($false)
    )

    Write-Host "Kernel dependency audit targets:"
    $auditTargets | ForEach-Object { Write-Host "  $_" }
    # Decode Lean's UTF-8 stdout as UTF-8 so non-ASCII declaration names such
    # as `finite_chain_reaches_ωSup` round-trip through the axiom report parse.
    $previousOutputEncoding = [Console]::OutputEncoding
    $previousDefaultEncoding = [System.Console]::OutputEncoding
    [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
    try {
      $auditOutput = @(& lake env lean $auditSourcePath 2>&1)
    } finally {
      [Console]::OutputEncoding = $previousOutputEncoding
    }
    $auditExitCode = $LASTEXITCODE
    $auditOutput | ForEach-Object { Write-Host $_ }
    if ($auditExitCode -ne 0) {
      throw "Kernel dependency audit failed with exit code $auditExitCode."
    }

    $auditText = $auditOutput -join "`n"
    $auditPattern = "(?m)^'(?<name>[^']+)'\s+(?:(?:does not depend on any axioms)|(?:depends on axioms:\s*\[(?<axioms>[^\]]*)\]))\s*$"
    $auditMatches = [regex]::Matches($auditText, $auditPattern)
    $allowedAxioms = @(
      "propext",
      "Classical.choice",
      "Quot.sound"
    )
    foreach ($target in $auditTargets) {
      $targetMatches = @(
        $auditMatches |
          Where-Object { $_.Groups["name"].Value -eq $target }
      )
      if ($targetMatches.Count -ne 1) {
        throw "Expected exactly one parsed axiom report for $target; found $($targetMatches.Count)."
      }

      $axiomText = $targetMatches[0].Groups["axioms"].Value
      $axioms = @(
        $axiomText.Split(
          @([char]","),
          [StringSplitOptions]::RemoveEmptyEntries
        ) |
          ForEach-Object { $_.Trim() }
      )
      $unexpectedAxioms = @(
        $axioms | Where-Object { $_ -notin $allowedAxioms }
      )
      if ($unexpectedAxioms.Count -gt 0) {
        throw "Unexpected kernel dependencies for $target`: $($unexpectedAxioms -join ', ')."
      }
    }
    Write-Host "Kernel dependency allowlist gate: clean ($($auditTargets.Count) declarations)."
  }
}
finally {
  Pop-Location
  if ($auditSourcePath -and (Test-Path -LiteralPath $auditSourcePath)) {
    Remove-Item -LiteralPath $auditSourcePath -Force
  }
}

if ($RequireComplete) {
  Write-Host "Formal completion gate completed successfully."
}
else {
  Write-Host "Formal development evidence gate completed successfully."
}
