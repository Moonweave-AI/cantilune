[CmdletBinding()]
param(
  [switch]$RequireProved,
  [switch]$RequireComplete,
  [switch]$CleanBuild,
  [switch]$VerifyTreeOnly
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

function Get-CanonicalText {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $strictUtf8 = [Text.UTF8Encoding]::new($false, $true)
  $text = [IO.File]::ReadAllText($Path, $strictUtf8)
  return $text -replace "`r`n?", "`n"
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

function Get-CanonicalTextSha256 {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  return Get-TextSha256 -Text (Get-CanonicalText -Path $Path)
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
  $pathComparison =
    if ([IO.Path]::DirectorySeparatorChar -eq [char]"\") {
      [StringComparison]::OrdinalIgnoreCase
    }
    else {
      [StringComparison]::Ordinal
    }
  if (-not $candidate.StartsWith(
      $rootPrefix,
      $pathComparison
    )) {
    throw "$Label escapes the repository root: $RelativePath"
  }
  if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
    throw "$Label does not exist as a file: $RelativePath"
  }

  return $candidate
}

function Assert-TrackedEvidenceFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RelativePath,

    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  Assert-HeadTrackedRegularFile `
    -RelativePath $RelativePath `
    -Label $Label
  Assert-WorkingFileMatchesHeadBlob `
    -RelativePath $RelativePath `
    -Label $Label
}

function Get-HeadTreeEntries {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Paths
  )

  $arguments = @("-C", $repoRoot, "ls-tree", "-r", "HEAD", "--") + $Paths
  $lines = @(& git @arguments)
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to enumerate repository HEAD paths: $($Paths -join ', ')"
  }

  return @(
    foreach ($line in $lines) {
      $separator = $line.IndexOf("`t")
      if ($separator -lt 0) {
        throw "Unable to parse git ls-tree output: $line"
      }
      $metadata = $line.Substring(0, $separator).Split(
        @([char]" "),
        [StringSplitOptions]::RemoveEmptyEntries
      )
      if ($metadata.Count -ne 3) {
        throw "Unable to parse git ls-tree metadata: $line"
      }
      [PSCustomObject]@{
        Mode = $metadata[0]
        Type = $metadata[1]
        Object = $metadata[2]
        Path = $line.Substring($separator + 1).Replace("\", "/")
      }
    }
  )
}

function Get-HeadTreeEntry {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RelativePath,

    [Parameter(Mandatory = $true)]
    [string]$Label,

    [string]$Commit = "HEAD"
  )

  $arguments = @(
    "-C", $repoRoot, "ls-tree", $Commit, "--", $RelativePath
  )
  $lines = @(& git @arguments)
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to inspect $Label in $Commit`: $RelativePath"
  }
  if ($lines.Count -ne 1) {
    throw "$Label must identify exactly one committed file in $Commit`: $RelativePath"
  }
  $separator = $lines[0].IndexOf("`t")
  if ($separator -lt 0) {
    throw "Unable to parse committed $Label metadata: $($lines[0])"
  }
  $metadata = $lines[0].Substring(0, $separator).Split(
    @([char]" "),
    [StringSplitOptions]::RemoveEmptyEntries
  )
  if ($metadata.Count -ne 3) {
    throw "Unable to parse committed $Label metadata: $($lines[0])"
  }
  $entryPath = $lines[0].Substring($separator + 1).Replace("\", "/")
  if ($entryPath -cne $RelativePath.Replace("\", "/")) {
    throw "$Label resolved to an unexpected committed path: $entryPath"
  }
  return [PSCustomObject]@{
    Mode = $metadata[0]
    Type = $metadata[1]
    Object = $metadata[2]
    Path = $entryPath
  }
}

function Assert-RegularBlobEntry {
  param(
    [Parameter(Mandatory = $true)]
    [PSCustomObject]$Entry,

    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  if ($Entry.Type -cne "blob" -or
      $Entry.Mode -notin @("100644", "100755")) {
    throw "$Label must be a regular committed blob, not mode/type $($Entry.Mode)/$($Entry.Type): $($Entry.Path)"
  }
}

function Assert-HeadTrackedRegularFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RelativePath,

    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  $entry = Get-HeadTreeEntry `
    -RelativePath $RelativePath `
    -Label $Label
  Assert-RegularBlobEntry -Entry $entry -Label $Label
}

function Assert-WorkingFileMatchesHeadBlob {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RelativePath,

    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  $entry = Get-HeadTreeEntry `
    -RelativePath $RelativePath `
    -Label $Label
  Assert-RegularBlobEntry -Entry $entry -Label $Label
  $absolutePath = Join-Path $repoRoot $RelativePath
  if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
    throw "$Label is missing from the working tree: $RelativePath"
  }
  $workingItem = Get-Item -LiteralPath $absolutePath -Force
  if (($workingItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
      -not [string]::IsNullOrWhiteSpace([string]$workingItem.LinkType)) {
    throw "$Label must not be a symbolic link or reparse point: $RelativePath"
  }
  $actualObject = (
    & git -C $repoRoot hash-object "--path=$RelativePath" -- $absolutePath
  ).Trim()
  if ($LASTEXITCODE -ne 0 -or
      [string]::IsNullOrWhiteSpace($actualObject)) {
    throw "Unable to hash working-tree $Label`: $RelativePath"
  }
  if ($actualObject -cne $entry.Object) {
    throw "$Label differs from the committed HEAD blob: $RelativePath"
  }
}

function Assert-ExactOrdinalSet {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Expected,

    [Parameter(Mandatory = $true)]
    [string[]]$Actual,

    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  $expectedSorted = @($Expected)
  $actualSorted = @($Actual)
  [Array]::Sort($expectedSorted, [StringComparer]::Ordinal)
  [Array]::Sort($actualSorted, [StringComparer]::Ordinal)
  if ($expectedSorted.Count -ne $actualSorted.Count) {
    throw "$Label set count differs: expected $($expectedSorted.Count), found $($actualSorted.Count)."
  }
  for ($index = 0; $index -lt $expectedSorted.Count; $index++) {
    if ($expectedSorted[$index] -cne $actualSorted[$index]) {
      throw "$Label set differs at index $index`: expected '$($expectedSorted[$index])', found '$($actualSorted[$index])'."
    }
  }
}

function Get-FormalLeanSnapshot {
  $files = @(
    Get-ChildItem `
      -LiteralPath $formalRoot `
      -Filter "*.lean" `
      -File `
      -Force `
      -Recurse |
      Where-Object { $_.FullName -notmatch "[\\/]\.lake[\\/]" }
  )
  $entries = @(
    $files | ForEach-Object {
      $relativePath = $_.FullName.
        Substring($formalRoot.Length + 1).
        Replace("\", "/")
      "$relativePath $(Get-CanonicalTextSha256 -Path $_.FullName)"
    }
  )
  [Array]::Sort($entries, [StringComparer]::Ordinal)
  return [PSCustomObject]@{
    Files = $files
    Entries = $entries
    Aggregate = Get-TextSha256 -Text ($entries -join "`n")
  }
}

function Assert-FormalLeanSourcesAreExactHeadBlobs {
  param(
    [Parameter(Mandatory = $true)]
    [PSCustomObject]$Snapshot
  )

  $headEntries = @(
    Get-HeadTreeEntries -Paths @("formal") |
      Where-Object {
        $_.Path.EndsWith(".lean", [StringComparison]::Ordinal) -and
        $_.Path -notmatch "^formal/\.lake/"
      }
  )
  foreach ($entry in $headEntries) {
    Assert-RegularBlobEntry `
      -Entry $entry `
      -Label "Lean proof source"
  }

  $unexpectedLinks = @(
    Get-ChildItem -LiteralPath $formalRoot -Force -Recurse |
      Where-Object {
        $_.FullName -notmatch "[\\/]\.lake(?:[\\/]|$)" -and
        (
          ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
          -not [string]::IsNullOrWhiteSpace([string]$_.LinkType)
        )
      }
  )
  if ($unexpectedLinks.Count -gt 0) {
    throw "Formal source tree contains symbolic links or reparse points outside .lake:`n$($unexpectedLinks.FullName -join "`n")"
  }

  $diskPaths = @(
    $Snapshot.Files | ForEach-Object {
      $_.FullName.
        Substring($repoRoot.Length + 1).
        Replace("\", "/")
    }
  )
  $headPaths = @($headEntries | ForEach-Object Path)
  Assert-ExactOrdinalSet `
    -Expected $headPaths `
    -Actual $diskPaths `
    -Label "formal Lean source"

  $headByPath = @{}
  foreach ($entry in $headEntries) {
    $headByPath[$entry.Path] = $entry
  }
  foreach ($relativePath in $diskPaths) {
    $absolutePath = Join-Path $repoRoot $relativePath
    $workingItem = Get-Item -LiteralPath $absolutePath -Force
    if (($workingItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        -not [string]::IsNullOrWhiteSpace([string]$workingItem.LinkType)) {
      throw "Lean proof source must not be a symbolic link or reparse point: $relativePath"
    }
    $actualObject = (
      & git -C $repoRoot hash-object "--path=$relativePath" -- $absolutePath
    ).Trim()
    if ($LASTEXITCODE -ne 0 -or
        [string]::IsNullOrWhiteSpace($actualObject)) {
      throw "Unable to hash Lean proof source: $relativePath"
    }
    if ($actualObject -cne $headByPath[$relativePath].Object) {
      throw "Lean proof source differs from its committed HEAD blob: $relativePath"
    }
  }
}

function Get-DiskFilesForProtectedPaths {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Paths
  )

  $result = [Collections.Generic.HashSet[string]]::new(
    [StringComparer]::Ordinal
  )
  foreach ($relativePath in $Paths) {
    $absolutePath = Join-Path $repoRoot $relativePath
    if (Test-Path -LiteralPath $absolutePath -PathType Container) {
      Get-ChildItem -LiteralPath $absolutePath -File -Force -Recurse |
        ForEach-Object {
          [void]$result.Add(
            $_.FullName.
              Substring($repoRoot.Length + 1).
              Replace("\", "/")
          )
        }
    }
    elseif (Test-Path -LiteralPath $absolutePath -PathType Leaf) {
      [void]$result.Add($relativePath.Replace("\", "/"))
    }
  }
  return @($result)
}

function Assert-ProofSensitiveTreeMatchesHead {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Paths
  )

  $headEntries = @(Get-HeadTreeEntries -Paths $Paths)
  foreach ($entry in $headEntries) {
    Assert-RegularBlobEntry `
      -Entry $entry `
      -Label "Proof-sensitive source"
  }
  $headPaths = @($headEntries | ForEach-Object Path)
  $diskPaths = @(Get-DiskFilesForProtectedPaths -Paths $Paths)
  Assert-ExactOrdinalSet `
    -Expected $headPaths `
    -Actual $diskPaths `
    -Label "proof-sensitive file"
  foreach ($relativePath in $diskPaths) {
    Assert-WorkingFileMatchesHeadBlob `
      -RelativePath $relativePath `
      -Label "Proof-sensitive source"
  }
}

function Assert-NoLeanPlaceholders {
  param(
    [Parameter(Mandatory = $true)]
    [PSCustomObject]$Snapshot,

    [switch]$Quiet
  )

  $forbiddenPattern = "\b(?:sorry|admit|axiom|unsafe)\b"
  $violations = @(
    foreach ($sourceFile in @($Snapshot.Files)) {
      Select-String `
        -LiteralPath $sourceFile.FullName `
        -Pattern $forbiddenPattern |
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
  if (-not $Quiet) {
    Write-Host "Lean placeholder gate: clean ($(@($Snapshot.Files).Count) project source files)."
  }
}

function Wait-LeanProcessDrain {
  param(
    [int]$TimeoutSeconds = 15,
    [int]$PollMilliseconds = 500,
    [int]$StablePasses = 2
  )

  $clock = [Diagnostics.Stopwatch]::StartNew()
  $stable = 0
  $lastProcesses = @()
  while ($clock.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
    $lastProcesses = @(
      Get-Process `
        -Name @("lake", "lean", "leanir") `
        -ErrorAction SilentlyContinue |
        Where-Object { $_.Id -ne $PID }
    )
    if ($lastProcesses.Count -eq 0) {
      $stable++
      if ($stable -ge $StablePasses) {
        Write-Host "Lean/Lake process drain gate: clean ($StablePasses stable polls)."
        return
      }
    }
    else {
      $stable = 0
    }
    Start-Sleep -Milliseconds $PollMilliseconds
  }

  $detail = (
    $lastProcesses |
      ForEach-Object { "$($_.ProcessName)#$($_.Id)" }
  ) -join ", "
  throw "Lean/Lake process drain did not quiesce within $TimeoutSeconds seconds: $detail"
}

function Get-ResolvedMathlibImportArtifacts {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FormalRoot
  )

  $mathlibRoot = Join-Path $FormalRoot ".lake\packages\mathlib"
  $setupPath = Join-Path `
    $mathlibRoot `
    ".lake\build\ir\Mathlib.setup.json"
  if (-not (Test-Path -LiteralPath $setupPath -PathType Leaf)) {
    throw "Mathlib setup manifest is missing after the umbrella build: $setupPath"
  }

  try {
    $setup = Get-Content -LiteralPath $setupPath -Raw |
      ConvertFrom-Json
  }
  catch {
    throw "Unable to parse the Mathlib setup manifest: $($_.Exception.Message)"
  }

  $artifacts = [Collections.Generic.HashSet[string]]::new(
    [StringComparer]::OrdinalIgnoreCase
  )
  foreach ($property in $setup.importArts.PSObject.Properties) {
    $moduleArtifacts = @(
      $property.Value | ForEach-Object { [string]$_ }
    )
    if ($moduleArtifacts.Count -notin @(1, 3, 4)) {
      throw "Unexpected Lake import-artifact arity $($moduleArtifacts.Count) for $($property.Name)."
    }
    foreach ($artifact in $moduleArtifacts) {
      [void]$artifacts.Add([IO.Path]::GetFullPath($artifact))
    }
    if ($moduleArtifacts.Count -eq 3) {
      $olean = @(
        $moduleArtifacts |
          Where-Object {
            $_.EndsWith(
              ".olean",
              [StringComparison]::OrdinalIgnoreCase
            )
          }
      )
      if ($olean.Count -ne 1) {
        throw "Module import lacks one unique .olean artifact for $($property.Name)."
      }
      [void]$artifacts.Add(
        [IO.Path]::GetFullPath($olean[0] + ".private")
      )
    }
  }

  $mathlibStem = Join-Path `
    $mathlibRoot `
    ".lake\build\lib\lean\Mathlib"
  foreach ($suffix in @(
      ".olean",
      ".ir",
      ".olean.server",
      ".olean.private"
    )) {
    [void]$artifacts.Add(
      [IO.Path]::GetFullPath($mathlibStem + $suffix)
    )
  }

  $leanLibOutput = @(& lean --print-libdir 2>&1)
  if ($LASTEXITCODE -ne 0) {
    throw "lean --print-libdir failed with exit code $LASTEXITCODE."
  }
  $leanLib = @(
    $leanLibOutput |
      ForEach-Object { $_.ToString().Trim() } |
      Where-Object { $_ }
  )[-1]
  if (-not (Test-Path -LiteralPath $leanLib -PathType Container)) {
    throw "Pinned Lean library directory is missing: $leanLib"
  }
  Get-ChildItem -LiteralPath $leanLib -Recurse -File |
    Where-Object {
      $_.Name -match "\.(?:olean(?:\.(?:server|private))?|ir)$"
    } |
    ForEach-Object { [void]$artifacts.Add($_.FullName) }

  return @($artifacts | Sort-Object)
}

function Wait-LeanArtifactReadability {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Paths,

    [int]$TimeoutSeconds = 300,

    [int]$PollMilliseconds = 750,

    [int]$StablePasses = 3,

    [string]$Label = "Lean artifact"
  )

  if ($Paths.Count -eq 0) {
    throw "$Label readiness received an empty expected set."
  }

  $clock = [Diagnostics.Stopwatch]::StartNew()
  $previousFingerprint = $null
  $stable = 0
  $attempt = 0
  $lastProblems = @()
  while ($clock.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
    $attempt++
    $records = [Collections.Generic.List[string]]::new()
    $problems = [Collections.Generic.List[string]]::new()
    foreach ($path in $Paths) {
      if ($clock.Elapsed.TotalSeconds -ge $TimeoutSeconds) {
        $problems.Add("deadline reached while scanning at $path")
        break
      }
      try {
        $item = Get-Item -LiteralPath $path -ErrorAction Stop
        if ($item.PSIsContainer) {
          throw [IO.IOException]::new("expected a regular file")
        }
        $stream = [IO.File]::Open(
          $item.FullName,
          [IO.FileMode]::Open,
          [IO.FileAccess]::Read,
          [IO.FileShare]::Read
        )
        try {
          if ($stream.Length -le 0) {
            throw [IO.IOException]::new("zero-length artifact")
          }
          if ($stream.ReadByte() -lt 0) {
            throw [IO.IOException]::new("cannot read first byte")
          }
          [void]$stream.Seek(-1, [IO.SeekOrigin]::End)
          if ($stream.ReadByte() -lt 0) {
            throw [IO.IOException]::new("cannot read last byte")
          }
          $records.Add(
            "$($item.FullName)|$($stream.Length)|$($item.LastWriteTimeUtc.Ticks)"
          )
        }
        finally {
          $stream.Dispose()
        }
      }
      catch {
        if ($problems.Count -lt 20) {
          $problems.Add("$path :: $($_.Exception.Message)")
        }
      }
    }

    $lastProblems = @($problems)
    if ($problems.Count -eq 0) {
      $fingerprint = $records -join "`n"
      if ($null -ne $previousFingerprint -and
          $fingerprint -ceq $previousFingerprint) {
        $stable++
      }
      else {
        $previousFingerprint = $fingerprint
        $stable = 1
      }
      if ($stable -ge $StablePasses) {
        Write-Host "$Label readability gate: $($Paths.Count) files, $StablePasses stable readable passes."
        return
      }
    }
    else {
      $previousFingerprint = $null
      $stable = 0
    }

    if ($clock.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
      Start-Sleep -Milliseconds $PollMilliseconds
    }
  }

  $detail =
    if ($lastProblems.Count) {
      $lastProblems -join "`n"
    }
    else {
      "artifact metadata never reached the required stable-pass count"
    }
  throw "$Label readability gate timed out after $TimeoutSeconds seconds (attempts=$attempt):`n$detail"
}

function Get-CantiluneSerialBuildModules {
  param(
    [Parameter(Mandatory = $true)]
    [IO.FileInfo[]]$SourceFiles
  )

  $queryOutput = @(& lake query "@/Cantilune:modules" --json)
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to query the Cantilune library module order: exit code $LASTEXITCODE."
  }
  $queryText = $queryOutput -join "`n"
  try {
    [object[]]$modules = $queryText | ConvertFrom-Json
  }
  catch {
    throw "Unable to parse the Cantilune library module order: $($_.Exception.Message)"
  }
  if ($modules.Count -eq 0) {
    throw "Lake returned an empty Cantilune module order."
  }

  $queried = [Collections.Generic.HashSet[string]]::new(
    [StringComparer]::Ordinal
  )
  foreach ($module in $modules) {
    $name = [string]$module
    if ($name -notmatch "^[\p{L}_][\p{L}\p{N}_'.]*$") {
      throw "Lake returned an invalid Cantilune module name: $name"
    }
    if (-not $queried.Add($name)) {
      throw "Lake returned a duplicate Cantilune module name: $name"
    }
  }

  $expected = [Collections.Generic.HashSet[string]]::new(
    [StringComparer]::Ordinal
  )
  foreach ($sourceFile in $SourceFiles) {
    $relativePath = $sourceFile.FullName.
      Substring($formalRoot.Length + 1).
      Replace("\", "/")
    $withoutExtension = $relativePath.Substring(
      0,
      $relativePath.Length - ".lean".Length
    )
    $name = $withoutExtension.Replace("/", ".")
    [void]$expected.Add($name)
  }

  $unexpected = @(
    $queried |
      Where-Object { -not $expected.Contains($_) } |
      Sort-Object
  )
  if ($unexpected.Count -gt 0) {
    throw "Lake module order contains sources outside the pinned Lean snapshot:`n$($unexpected -join "`n")"
  }

  # This regression module intentionally is not imported by Tests.All.  Keep
  # the exception explicit so every pinned .lean file is still compiled, and
  # any future detached source makes the evidence gate fail closed.
  $permittedDetachedModules = @(
    "Cantilune.Tests.FMSCpoSeparatedSum"
  )
  $detached = @(
    $expected |
      Where-Object { -not $queried.Contains($_) } |
      Sort-Object
  )
  Assert-ExactOrdinalSet `
    -Expected $permittedDetachedModules `
    -Actual $detached `
    -Label "detached Cantilune module"

  $result = [Collections.Generic.List[string]]::new()
  foreach ($module in $modules) {
    $result.Add([string]$module)
  }
  foreach ($module in $permittedDetachedModules) {
    $result.Add($module)
  }
  if ($result.Count -ne $SourceFiles.Count) {
    throw "Serial module order covers $($result.Count) modules, expected $($SourceFiles.Count)."
  }
  Write-Host "Serial Cantilune module order: $($result.Count) modules (Lake dependency order plus $($permittedDetachedModules.Count) explicit detached regression)."
  return @($result)
}

function Get-CantiluneModuleArtifacts {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Modules
  )

  $artifacts = [Collections.Generic.List[string]]::new()
  foreach ($module in $Modules) {
    $relativeStem = $module.Replace(
      ".",
      [IO.Path]::DirectorySeparatorChar
    )
    $libraryStem = Join-Path `
      $formalRoot `
      ".lake\build\lib\lean\$relativeStem"
    $irStem = Join-Path `
      $formalRoot `
      ".lake\build\ir\$relativeStem"
    foreach ($path in @(
        ($libraryStem + ".olean"),
        ($libraryStem + ".ilean"),
        ($irStem + ".c"),
        ($irStem + ".c.hash"),
        ($irStem + ".setup.json")
      )) {
      $artifacts.Add([IO.Path]::GetFullPath($path))
    }
  }
  return @($artifacts)
}

$toolchain = (Get-Content -LiteralPath $toolchainPath -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($toolchain)) {
  throw "formal/lean-toolchain is empty."
}
Write-Host "Pinned Lean toolchain: $toolchain"

# Resolve the pinned toolchain directly.  This keeps the evidence runner
# independent of whether an interactive shell happened to expose elan shims
# on PATH.
$toolchainDirectoryName = $toolchain.
  Replace("/", "--").
  Replace(":", "---")
$profileCandidates = @(
  $env:USERPROFILE,
  [Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile),
  $env:HOME
) | Where-Object {
  -not [string]::IsNullOrWhiteSpace([string]$_)
} | Select-Object -Unique
$elanHomeCandidates = if (-not [string]::IsNullOrWhiteSpace($env:ELAN_HOME)) {
  @($env:ELAN_HOME)
}
else {
  @($profileCandidates | ForEach-Object { Join-Path $_ ".elan" })
}
$toolchainBinCandidates = @(
  $elanHomeCandidates | ForEach-Object {
    Join-Path (
      Join-Path (Join-Path $_ "toolchains") $toolchainDirectoryName
    ) "bin"
  }
)
$toolchainBin = $toolchainBinCandidates |
  Where-Object { Test-Path -LiteralPath $_ -PathType Container } |
  Select-Object -First 1
if ([string]::IsNullOrWhiteSpace([string]$toolchainBin)) {
  throw "Pinned Lean toolchain directory is unavailable. Checked: $($toolchainBinCandidates -join ', ')"
}
$env:PATH = "$toolchainBin$([IO.Path]::PathSeparator)$env:PATH"

$sourceSnapshot = Get-FormalLeanSnapshot
$sourceFiles = @($sourceSnapshot.Files)
$sourceAggregate = [string]$sourceSnapshot.Aggregate
Assert-FormalLeanSourcesAreExactHeadBlobs -Snapshot $sourceSnapshot
$sourceIntegrity = Get-Content -LiteralPath $sourceIntegrityPath -Raw |
  ConvertFrom-Json
if ([int]$sourceIntegrity.schemaVersion -ne 2) {
  throw "source-integrity.json must use schemaVersion 2."
}
if ([string]$sourceIntegrity.algorithm -ne "SHA-256" -or
    [string]$sourceIntegrity.textEncoding -ne "UTF-8" -or
    [string]$sourceIntegrity.fileHashMode -ne "canonical-utf8-lf" -or
    [int]$sourceIntegrity.pathSchemaVersion -ne 1) {
  throw "source-integrity.json does not declare the required canonical UTF-8/LF SHA-256 and ordinal-path modes."
}
if ([int]$sourceIntegrity.leanSourceFileCount -ne $sourceFiles.Count) {
  throw "Lean source count differs from source-integrity.json: expected $($sourceIntegrity.leanSourceFileCount), found $($sourceFiles.Count)."
}
if ([string]$sourceIntegrity.leanSourceAggregateSha256 -ne $sourceAggregate) {
  throw "Lean source aggregate differs from source-integrity.json: expected $($sourceIntegrity.leanSourceAggregateSha256), found $sourceAggregate."
}
$requiredPinnedInputPaths = @(
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
$actualPinnedInputPaths = @(
  $sourceIntegrity.pinnedInputs.PSObject.Properties |
    ForEach-Object Name |
    Sort-Object
)
$pinnedInputDifference = Compare-Object `
  -ReferenceObject @($requiredPinnedInputPaths | Sort-Object) `
  -DifferenceObject $actualPinnedInputPaths
if ($pinnedInputDifference) {
  $differenceText = $pinnedInputDifference |
    ForEach-Object { "$($_.SideIndicator) $($_.InputObject)" }
  throw "source-integrity.json pinnedInputs differs from the required set:`n$($differenceText -join "`n")"
}
foreach ($pinnedInput in @($sourceIntegrity.pinnedInputs.PSObject.Properties)) {
  $inputPath = Resolve-RepositoryEvidenceFile `
    -RelativePath ([string]$pinnedInput.Name) `
    -Label "Pinned integrity input"
  $actualHash = Get-CanonicalTextSha256 -Path $inputPath
  if ($actualHash -ne [string]$pinnedInput.Value) {
    throw "Pinned input hash differs for $($pinnedInput.Name): expected $($pinnedInput.Value), found $actualHash."
  }
}
Write-Host "Source integrity gate: $($sourceFiles.Count) Lean files, aggregate $sourceAggregate."

$proofManifest = Get-Content -LiteralPath $proofManifestPath -Raw |
  ConvertFrom-Json
$obligations = @($proofManifest.obligations)
$declaredGate = "development"
if ($proofManifest.PSObject.Properties.Name -contains "requiredGate") {
  $declaredGate = [string]$proofManifest.requiredGate
}
if ($declaredGate -notin @("development", "proved")) {
  throw "proof-obligations.json requiredGate must be development or proved; reviewed is unavailable until a separate authenticated human gate exists."
}
$enforceProved = $RequireProved -or $RequireComplete -or
  $declaredGate -eq "proved"
$requiredScope =
  "Cantilune generic four-projection core plus one substantive reference execution; eight production packages are excluded and require separate Product Conformance certificates"
if ([string]$proofManifest.scope -cne $requiredScope) {
  throw "proof-obligations.json scope differs from the approved generic-core/reference scope."
}

$requiredObligations = @(
  [PSCustomObject]@{
    id = "CENTRAL-01"
    theorem = "freeSMC_universal"
    leanSymbol = "Cantilune.Core.FreeSMCArbitraryUniversal.AtomicComparison.freeSMC_arbitrary_universal"
  },
  [PSCustomObject]@{
    id = "CENTRAL-02"
    theorem = "dpo_result_unique"
    leanSymbol = "Cantilune.Core.dpo_result_unique"
  },
  [PSCustomObject]@{
    id = "CENTRAL-03"
    theorem = "dpo_concurrency"
    leanSymbol = "Cantilune.Core.DPOConcurrency.ParallelIndependent.parallel_independent_concurrency"
  },
  [PSCustomObject]@{
    id = "CENTRAL-04"
    theorem = "signature_extension_coherent"
    leanSymbol = "Cantilune.Core.signature_extension_coherent"
  },
  [PSCustomObject]@{
    id = "CENTRAL-05"
    theorem = "rewrite_respects_equiv"
    leanSymbol = "Cantilune.Core.ObservableLTS.rewrite_respects_equiv"
  },
  [PSCustomObject]@{
    id = "CENTRAL-06"
    theorem = "event_replay_unique"
    leanSymbol = "Cantilune.Core.DPOEvent.event_replay_unique"
  },
  [PSCustomObject]@{
    id = "CENTRAL-07"
    theorem = "projection_paths_lift_and_reflect"
    leanSymbol = "Cantilune.Core.ProjectionCertificate.projection_paths_lift_and_reflect"
  },
  [PSCustomObject]@{
    id = "CENTRAL-08"
    theorem = "dag_certificate"
    leanSymbol = "Cantilune.Theorems.TechnicalClosure.generic_p1a_projection_scope"
  },
  [PSCustomObject]@{
    id = "CENTRAL-09"
    theorem = "reconfigurable_petri_certificate"
    leanSymbol = "Cantilune.Theorems.TechnicalClosure.generic_petri_projection"
  },
  [PSCustomObject]@{
    id = "CENTRAL-10"
    theorem = "open_pi_smc"
    leanSymbol = "Cantilune.Theorems.TechnicalClosure.completeOpenPiSMCOperationalBoundary"
  },
  [PSCustomObject]@{
    id = "CENTRAL-11"
    theorem = "typed_pi_erasure_operational"
    leanSymbol = "Cantilune.Pi.Step.standard_typed_pi_erasure_operational"
  },
  [PSCustomObject]@{
    id = "CENTRAL-12"
    theorem = "maximum_compatible_d1a_fms_closure"
    leanSymbol = "Cantilune.Theorems.TechnicalClosure.maximum_compatible_d1a_fms_closure"
  },
  [PSCustomObject]@{
    id = "CENTRAL-13"
    theorem = "pi_ra_certificate"
    leanSymbol = "Cantilune.Pi.P1bNominalIncidenceClosure.pi_ra_certificate"
  },
  [PSCustomObject]@{
    id = "CENTRAL-14"
    theorem = "pi_mobility_certificate"
    leanSymbol = "Cantilune.Pi.P1cEnrichedStructuralCertificate.complete_enriched_structural_p1c_certificate"
  },
  [PSCustomObject]@{
    id = "CENTRAL-15"
    theorem = "feedback_stable_set"
    leanSymbol = "Cantilune.Feedback.CompleteFiniteHeightClosure.FiniteHeightFeedbackClosure.hard_forward_invariant"
  },
  [PSCustomObject]@{
    id = "CENTRAL-16"
    theorem = "feedback_almost_sure_hitting"
    leanSymbol = "Cantilune.Feedback.CompleteFiniteHeightClosure.FiniteHeightFeedbackClosure.feedback_almost_sure_hitting_with_replay"
  },
  [PSCustomObject]@{
    id = "CENTRAL-17"
    theorem = "terminal_classification_iff"
    leanSymbol = "Cantilune.Pi.P1cTerminalExecutionClassification.p1c_terminal_classification_iff"
  },
  [PSCustomObject]@{
    id = "CENTRAL-18"
    theorem = "four_projection_consistency"
    leanSymbol = "Cantilune.Theorems.TechnicalClosure.generic_four_projection_consistency"
  }
)
if ($obligations.Count -ne $requiredObligations.Count) {
  throw "proof-obligations.json must contain exactly $($requiredObligations.Count) central obligations; found $($obligations.Count)."
}

for ($index = 0; $index -lt $requiredObligations.Count; $index++) {
  $required = $requiredObligations[$index]
  $actual = $obligations[$index]
  foreach ($property in @("id", "theorem", "leanSymbol")) {
    if ([string]$actual.$property -cne [string]$required.$property) {
      throw "Central obligation tuple $index differs at $property`: expected '$($required.$property)', found '$($actual.$property)'."
    }
  }
}

$currentHead = (& git -C $repoRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $currentHead -notmatch "^[0-9a-f]{40}$") {
  throw "Unable to resolve the current repository HEAD."
}
$proofSensitivePaths = @(
  ".gitattributes",
  ".github/workflows/formal.yml",
  "docs/adr/0001-unified-formal-structure.md",
  "docs/adr/zh-CN/0001-unified-formal-structure.zh-CN.md",
  "docs/rfc/0002-projection-consistency.md",
  "docs/rfc/zh-CN/0002-projection-consistency.zh-CN.md",
  "docs/spec/formal-semantics.md",
  "docs/spec/zh-CN/formal-semantics.zh-CN.md",
  "docs/spec/observable-lts-policies.md",
  "docs/spec/success-predicates-interface.md",
  "formal/Cantilune",
  "formal/Cantilune.lean",
  "formal/axiom-audit-targets.txt",
  "formal/lakefile.toml",
  "formal/lake-manifest.json",
  "formal/lean-toolchain",
  "formal/p1c-rule-matrix.json",
  "formal/scripts/ci.ps1",
  "formal/scripts/recompute-integrity.ps1",
  "formal/source-integrity.json"
)

Assert-HeadTrackedRegularFile `
  -RelativePath "formal/proof-obligations.json" `
  -Label "Proof-obligation manifest"
Assert-WorkingFileMatchesHeadBlob `
  -RelativePath "formal/proof-obligations.json" `
  -Label "Proof-obligation manifest"
Assert-ProofSensitiveTreeMatchesHead -Paths $proofSensitivePaths

if ([int]$proofManifest.schemaVersion -ne 2) {
  throw "proof-obligations.json must use schemaVersion 2."
}

$reviewedObligations = @(
  $obligations | Where-Object { $_.status -eq "reviewed" }
)
if ($reviewedObligations.Count -gt 0) {
  throw "This delivery gate intentionally stops at proved/review-pending; reviewed status requires a later independently authenticated human-review gate."
}

$hasProvedEvidence = @(
  $obligations | Where-Object { $_.status -eq "proved" }
).Count -gt 0
$baselineSourceCommit = [string]$proofManifest.baseline.sourceCommit
$baselineEvidenceCommit = [string]$proofManifest.baseline.evidenceCommit
$evidenceParentCommit = $null
if ($hasProvedEvidence -or $enforceProved) {
  if ($baselineSourceCommit -notmatch "^[0-9a-f]{40}$") {
    throw "A proved manifest requires baseline.sourceCommit as exact lowercase 40-hex."
  }
  if ($baselineEvidenceCommit -notmatch "^[0-9a-f]{40}$") {
    throw "A proved manifest requires baseline.evidenceCommit as exact lowercase 40-hex."
  }
  if ($baselineSourceCommit -ceq $baselineEvidenceCommit -or
      $baselineEvidenceCommit -ceq $currentHead) {
    throw "Three-commit evidence semantics require distinct source, evidence, and final pointer commits; baseline.evidenceCommit cannot self-reference HEAD."
  }
  foreach ($commit in @($baselineSourceCommit, $baselineEvidenceCommit)) {
    & git -C $repoRoot cat-file -e "$commit`^{commit}"
    if ($LASTEXITCODE -ne 0) {
      throw "Baseline commit is not available as a commit object: $commit"
    }
  }
  & git -C $repoRoot merge-base --is-ancestor `
    $baselineSourceCommit $baselineEvidenceCommit
  if ($LASTEXITCODE -ne 0) {
    throw "baseline.sourceCommit must be an ancestor of baseline.evidenceCommit."
  }
  & git -C $repoRoot merge-base --is-ancestor `
    $baselineEvidenceCommit $currentHead
  if ($LASTEXITCODE -ne 0) {
    throw "baseline.evidenceCommit must be a strict ancestor of the final pointer commit."
  }

  $evidenceCommitLine = (
    & git -C $repoRoot rev-list --parents -n 1 $baselineEvidenceCommit
  ).Trim()
  if ($LASTEXITCODE -ne 0 -or
      [string]::IsNullOrWhiteSpace($evidenceCommitLine)) {
    throw "Unable to inspect baseline.evidenceCommit parents."
  }
  $evidenceCommitParts = @(
    $evidenceCommitLine.Split(
      @([char]" "),
      [StringSplitOptions]::RemoveEmptyEntries
    )
  )
  if ($evidenceCommitParts.Count -ne 2) {
    throw "baseline.evidenceCommit must be a single-parent evidence-introduction commit."
  }
  $evidenceParentCommit = $evidenceCommitParts[1]
  & git -C $repoRoot merge-base --is-ancestor `
    $baselineSourceCommit $evidenceParentCommit
  if ($LASTEXITCODE -ne 0) {
    throw "The evidence-introduction commit parent must descend from baseline.sourceCommit."
  }

  & git -C $repoRoot diff --quiet `
    $baselineSourceCommit $currentHead -- $proofSensitivePaths
  if ($LASTEXITCODE -eq 1) {
    throw "Proof-sensitive committed sources differ between baseline.sourceCommit and the final pointer commit."
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to compare baseline.sourceCommit with the final pointer commit."
  }
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
        "proved"
      )
    } |
    ForEach-Object leanSymbol
)
$auditTargetSet = [Collections.Generic.HashSet[string]]::new(
  [StringComparer]::Ordinal
)
foreach ($target in @($configuredAuditTargets + $manifestAuditTargets)) {
  [void]$auditTargetSet.Add([string]$target)
}
$auditTargets = @($auditTargetSet)
[Array]::Sort($auditTargets, [StringComparer]::Ordinal)

$allowedStatuses = @(
  "missing",
  "partial_scaffold",
  "implemented_unverified",
  "proved"
)
foreach ($obligation in $obligations) {
  if ($obligation.status -notin $allowedStatuses) {
    throw "Unknown proof status '$($obligation.status)' for $($obligation.theorem)."
  }

  if ($obligation.status -in @("partial_scaffold", "implemented_unverified") -and
      [string]::IsNullOrWhiteSpace([string]$obligation.leanSymbol)) {
    throw "A partial/implemented obligation requires leanSymbol: $($obligation.theorem)."
  }

  if ($obligation.status -eq "proved") {
    if ([string]::IsNullOrWhiteSpace([string]$obligation.leanSymbol)) {
      throw "A proved obligation requires leanSymbol: $($obligation.theorem)."
    }
    if ([string]$obligation.verifiedCommit -notmatch "^[0-9a-f]{40}$") {
      throw "A proved obligation requires an exact 40-hex verifiedCommit: $($obligation.theorem)."
    }
    if ([string]::IsNullOrWhiteSpace([string]$obligation.buildEvidence)) {
      throw "A proved obligation requires buildEvidence: $($obligation.theorem)."
    }

    $verifiedCommit = [string]$obligation.verifiedCommit
    if ($verifiedCommit -cne $baselineSourceCommit) {
      throw "Every proved obligation verifiedCommit must equal baseline.sourceCommit: $($obligation.theorem)."
    }
    & git -C $repoRoot cat-file -e "$verifiedCommit`^{commit}"
    if ($LASTEXITCODE -ne 0) {
      throw "verifiedCommit is not an available commit for $($obligation.theorem): $verifiedCommit"
    }
    & git -C $repoRoot merge-base --is-ancestor $verifiedCommit $currentHead
    if ($LASTEXITCODE -eq 1) {
      throw "verifiedCommit must be an ancestor of the final pointer commit for $($obligation.theorem): $verifiedCommit"
    }
    if ($LASTEXITCODE -ne 0) {
      throw "Unable to establish verifiedCommit ancestry for $($obligation.theorem)."
    }

    & git -C $repoRoot diff --quiet `
      $verifiedCommit $currentHead -- $proofSensitivePaths
    if ($LASTEXITCODE -eq 1) {
      throw "Proof-sensitive sources differ from verifiedCommit for $($obligation.theorem): $verifiedCommit"
    }
    if ($LASTEXITCODE -ne 0) {
      throw "Unable to compare proof-sensitive sources with verifiedCommit for $($obligation.theorem)."
    }

    $normalizedBuildEvidence =
      ([string]$obligation.buildEvidence).Replace("\", "/")
    if ($normalizedBuildEvidence -notmatch
        "^docs/qa/evidence/[A-Za-z0-9._/-]+\.md$") {
      throw "Build evidence must live under docs/qa/evidence/ as Markdown: $($obligation.buildEvidence)"
    }
    $buildEvidencePath = Resolve-RepositoryEvidenceFile `
      -RelativePath $normalizedBuildEvidence `
      -Label "Build evidence for $($obligation.theorem)"
    $evidenceRoot = [IO.Path]::GetFullPath(
      (Join-Path $repoRoot "docs/qa/evidence")
    ).TrimEnd(
      [IO.Path]::DirectorySeparatorChar,
      [IO.Path]::AltDirectorySeparatorChar
    ) + [IO.Path]::DirectorySeparatorChar
    $evidencePathComparison =
      if ([IO.Path]::DirectorySeparatorChar -eq [char]"\") {
        [StringComparison]::OrdinalIgnoreCase
      }
      else {
        [StringComparison]::Ordinal
      }
    if (-not $buildEvidencePath.StartsWith(
        $evidenceRoot,
        $evidencePathComparison
      )) {
      throw "Build evidence resolves outside docs/qa/evidence/: $normalizedBuildEvidence"
    }
    Assert-TrackedEvidenceFile `
      -RelativePath $normalizedBuildEvidence `
      -Label "Build evidence for $($obligation.theorem)"
    if ([string]$obligation.buildEvidenceSha256 -notmatch "^[0-9a-f]{64}$") {
      throw "A proved obligation requires lowercase buildEvidenceSha256: $($obligation.theorem)."
    }
    $actualBuildEvidenceHash =
      Get-CanonicalTextSha256 -Path $buildEvidencePath
    if ($actualBuildEvidenceHash -ne
        [string]$obligation.buildEvidenceSha256) {
      throw "Build evidence hash differs for $($obligation.theorem): expected $($obligation.buildEvidenceSha256), found $actualBuildEvidenceHash."
    }

    $evidenceEntry = Get-HeadTreeEntry `
      -RelativePath $normalizedBuildEvidence `
      -Label "Build evidence" `
      -Commit $baselineEvidenceCommit
    Assert-RegularBlobEntry `
      -Entry $evidenceEntry `
      -Label "Build evidence"
    $headEvidenceEntry = Get-HeadTreeEntry `
      -RelativePath $normalizedBuildEvidence `
      -Label "Build evidence"
    if ($headEvidenceEntry.Object -cne $evidenceEntry.Object -or
        $headEvidenceEntry.Mode -cne $evidenceEntry.Mode) {
      throw "Build evidence must be byte-identical between baseline.evidenceCommit and the final pointer commit: $normalizedBuildEvidence"
    }
    & git -C $repoRoot cat-file -e `
      "$evidenceParentCommit`:$normalizedBuildEvidence" 2>$null
    if ($LASTEXITCODE -eq 0) {
      throw "baseline.evidenceCommit must introduce, not merely inherit, build evidence: $normalizedBuildEvidence"
    }
    if ($LASTEXITCODE -notin @(0, 128)) {
      throw "Unable to test build-evidence introduction at the evidence parent: $normalizedBuildEvidence"
    }

    $buildEvidenceText = Get-Content -LiteralPath $buildEvidencePath -Raw
    foreach ($requiredEvidenceToken in @(
        $verifiedCommit,
        [string]$obligation.leanSymbol,
        "Pinned Lean toolchain: $toolchain",
        "Source integrity gate: $($sourceFiles.Count) Lean files, aggregate $sourceAggregate.",
        "Lean placeholder gate: clean ($($sourceFiles.Count) project source files).",
        "Kernel dependency allowlist gate: clean ($($auditTargets.Count) declarations).",
        "Formal development evidence gate completed successfully."
      )) {
      if (-not $buildEvidenceText.Contains($requiredEvidenceToken)) {
        throw "Build evidence for $($obligation.theorem) is not bound to '$requiredEvidenceToken'."
      }
    }

    foreach ($reviewField in @(
        "reviewEvidence",
        "reviewEvidenceSha256",
        "independentReviewer",
        "reviewerIndependentOfOwner",
        "conflictOfInterestStatus"
      )) {
      if ($null -ne $obligation.$reviewField) {
        throw "A proved/review-pending obligation must keep $reviewField null: $($obligation.theorem)."
      }
    }
  }
}

if ($enforceProved) {
  $unproved = @(
    $obligations |
      Where-Object { $_.status -ne "proved" } |
      ForEach-Object { "$($_.id):$($_.theorem)=$($_.status)" }
  )
  if ($unproved.Count -gt 0) {
    throw "Technical completion gate requires all central obligations to be proved/review-pending:`n$($unproved -join "`n")"
  }
}

if ($RequireComplete) {
  throw "RequireComplete is intentionally unavailable until an independently authenticated human-review gate exists; use RequireProved for proved/review-pending."
}

Assert-NoLeanPlaceholders -Snapshot $sourceSnapshot

if ($VerifyTreeOnly) {
  Write-Host "Immutable proof-tree verification completed successfully."
  return
}

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

  if ($CleanBuild -or $enforceProved) {
    & lake clean
    if ($LASTEXITCODE -ne 0) {
      throw "lake clean failed with exit code $LASTEXITCODE."
    }
    Write-Host "Clean project build gate: prior project artifacts removed."
  }

  # Materialize every pinned mathlib module and its Lean sidecars before any
  # Cantilune module may import the umbrella. On Windows, scheduling the
  # dependency umbrella and root graph together can expose transient
  # .olean.private/.ir visibility failures under parallel load.
  & lake build "@mathlib/Mathlib"
  if ($LASTEXITCODE -ne 0) {
    throw "Pinned mathlib umbrella build failed with exit code $LASTEXITCODE."
  }
  Write-Host "Pinned mathlib umbrella build gate: complete."

  # A successful umbrella job is already a Lake dependency barrier.  The
  # explicit process/readability gates additionally detect foreign concurrent
  # builds and transient Windows mapping failures before the project imports
  # the large legacy import-all closure.
  Wait-LeanProcessDrain
  $resolvedArtifacts = Get-ResolvedMathlibImportArtifacts `
    -FormalRoot $formalRoot
  Wait-LeanArtifactReadability `
    -Paths $resolvedArtifacts `
    -Label "Pinned dependency artifact"

  # Lake 5 has no public job-count flag.  A parallel root build can start one
  # legacy import-all Lean process per ready Cantilune module, exhausting
  # memory on Windows and surfacing random reads of already-published
  # .olean.private files as failures.  Lake's :modules query is dependency
  # first, so build one not-yet-materialized module per invocation.
  $serialModules = Get-CantiluneSerialBuildModules `
    -SourceFiles $sourceFiles
  for ($moduleIndex = 0;
      $moduleIndex -lt $serialModules.Count;
      $moduleIndex++) {
    $module = $serialModules[$moduleIndex]
    Write-Host "Serial Cantilune build [$($moduleIndex + 1)/$($serialModules.Count)]: $module"
    & lake build "+$module"
    if ($LASTEXITCODE -ne 0) {
      throw "Serial Cantilune module build failed for $module with exit code $LASTEXITCODE."
    }
  }

  $projectArtifacts = Get-CantiluneModuleArtifacts `
    -Modules $serialModules
  Wait-LeanArtifactReadability `
    -Paths $projectArtifacts `
    -Label "Cantilune project artifact"

  # Refuse to launch another aggregate parallel build until Lake proves that
  # every default target is already materialized by the serial phase.
  & lake --no-build build
  if ($LASTEXITCODE -ne 0) {
    throw "Aggregate Cantilune target is not fully materialized after the serial build: exit code $LASTEXITCODE."
  }
  Write-Host "Aggregate Cantilune no-build closure gate: complete."

  & lake build
  if ($LASTEXITCODE -ne 0) {
    throw "lake build failed with exit code $LASTEXITCODE."
  }

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

# Lake packages and build scripts are executable inputs.  Recompute every
# proof-sensitive invariant after the build and axiom audit so a generated,
# ignored, or rewritten Lean source cannot win a time-of-check/time-of-use
# race against the evidence gate.
$postBuildSnapshot = Get-FormalLeanSnapshot
Assert-FormalLeanSourcesAreExactHeadBlobs -Snapshot $postBuildSnapshot
if (@($postBuildSnapshot.Files).Count -ne
    [int]$sourceIntegrity.leanSourceFileCount) {
  throw "Post-build Lean source count differs from source-integrity.json."
}
if ([string]$postBuildSnapshot.Aggregate -cne
    [string]$sourceIntegrity.leanSourceAggregateSha256) {
  throw "Post-build Lean source aggregate differs from source-integrity.json."
}
Assert-NoLeanPlaceholders -Snapshot $postBuildSnapshot -Quiet
Assert-WorkingFileMatchesHeadBlob `
  -RelativePath "formal/proof-obligations.json" `
  -Label "Post-build proof-obligation manifest"
Assert-ProofSensitiveTreeMatchesHead -Paths $proofSensitivePaths
if ($hasProvedEvidence) {
  foreach ($obligation in $obligations) {
    $normalizedBuildEvidence =
      ([string]$obligation.buildEvidence).Replace("\", "/")
    Assert-TrackedEvidenceFile `
      -RelativePath $normalizedBuildEvidence `
      -Label "Post-build evidence for $($obligation.theorem)"
    $postBuildEvidencePath = Resolve-RepositoryEvidenceFile `
      -RelativePath $normalizedBuildEvidence `
      -Label "Post-build evidence for $($obligation.theorem)"
    if ((Get-CanonicalTextSha256 -Path $postBuildEvidencePath) -cne
        [string]$obligation.buildEvidenceSha256) {
      throw "Post-build evidence hash drifted for $($obligation.theorem)."
    }
  }
}
Write-Host "Post-build immutable proof-tree seal: clean."

if ($RequireComplete) {
  Write-Host "Formal completion gate completed successfully."
}
elseif ($RequireProved) {
  Write-Host "Formal proved/review-pending gate completed successfully."
}
elseif ($enforceProved) {
  Write-Host "Formal manifest-declared proved/review-pending gate completed successfully."
}
else {
  Write-Host "Formal development evidence gate completed successfully."
}
