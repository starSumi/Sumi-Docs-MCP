[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F]{40}$')]
  [string]$CommitSha,

  [Parameter(Mandatory = $true)]
  [string]$BenchmarkReport
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$releaseRoot = Join-Path $projectRoot 'artifacts/release'
$stagingRoot = Join-Path $projectRoot 'artifacts/release-staging'
$executable = Join-Path $projectRoot 'artifacts/bin/sumi-docs-mcp.exe'
$benchmarkSource = (Resolve-Path $BenchmarkReport).Path
$packageJson = Get-Content (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$version = [string]$packageJson.version
$archiveBaseName = "sumi-docs-mcp-v$version-windows-x64"
$archivePath = Join-Path $releaseRoot "$archiveBaseName.zip"
$archiveStaging = Join-Path $stagingRoot $archiveBaseName

if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
  throw "SEA executable is missing: $executable"
}

if (-not (Test-Path -LiteralPath $benchmarkSource -PathType Leaf)) {
  throw "Benchmark report is missing: $benchmarkSource"
}

$benchmark = Get-Content -LiteralPath $benchmarkSource -Raw | ConvertFrom-Json
$nodeVersion = (& node --version).Trim()
$exeVersion = (& $executable --version).Trim()
if ($LASTEXITCODE -ne 0 -or $exeVersion -ne $version) {
  throw "Executable version '$exeVersion' does not match package version '$version'."
}

foreach ($generatedPath in @($releaseRoot, $stagingRoot)) {
  if (Test-Path -LiteralPath $generatedPath) {
    Remove-Item -LiteralPath $generatedPath -Recurse -Force
  }
}

New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
New-Item -ItemType Directory -Path $archiveStaging -Force | Out-Null

Copy-Item -LiteralPath $executable -Destination (Join-Path $archiveStaging 'sumi-docs-mcp.exe')
Copy-Item -LiteralPath (Join-Path $projectRoot 'README.md') -Destination $archiveStaging
Copy-Item -LiteralPath (Join-Path $projectRoot 'CHANGELOG.md') -Destination $archiveStaging
Copy-Item -LiteralPath (Join-Path $projectRoot 'LICENSE') -Destination $archiveStaging
Copy-Item -LiteralPath $benchmarkSource -Destination (Join-Path $releaseRoot 'benchmark.json')

$manifest = [ordered]@{
  schemaVersion = 1
  project = 'sumi-docs-mcp'
  version = $version
  commit = $CommitSha.ToLowerInvariant()
  platform = 'windows-x64'
  node = $nodeVersion
  codeSigning = 'unsigned'
  executable = [ordered]@{
    file = 'sumi-docs-mcp.exe'
    sha256 = (Get-FileHash -LiteralPath $executable -Algorithm SHA256).Hash.ToLowerInvariant()
  }
  benchmark = [ordered]@{
    hardLimitMs = $benchmark.hardLimitMs
    minMs = $benchmark.minMs
    medianMs = $benchmark.medianMs
    maxMs = $benchmark.maxMs
    passed = [bool]$benchmark.passed
  }
}
$manifestJson = $manifest | ConvertTo-Json -Depth 5
$manifestPath = Join-Path $releaseRoot 'RELEASE-MANIFEST.json'
Set-Content -LiteralPath $manifestPath -Value $manifestJson -Encoding utf8NoBOM
Set-Content -LiteralPath (Join-Path $archiveStaging 'RELEASE-MANIFEST.json') -Value $manifestJson -Encoding utf8NoBOM
Copy-Item -LiteralPath $benchmarkSource -Destination (Join-Path $archiveStaging 'benchmark.json')

Compress-Archive -LiteralPath $archiveStaging -DestinationPath $archivePath -CompressionLevel Optimal -Force
Remove-Item -LiteralPath $stagingRoot -Recurse -Force

$packOutput = ((& npm pack --pack-destination $releaseRoot --silent) | Select-Object -Last 1).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($packOutput)) {
  throw 'npm pack did not produce a package archive.'
}

$sbomPath = Join-Path $releaseRoot 'sbom.cdx.json'
$sbomJson = & npm sbom --omit=dev --sbom-format cyclonedx
if ($LASTEXITCODE -ne 0 -or -not $sbomJson) {
  throw 'npm sbom did not produce a CycloneDX document.'
}
$sbomJson | Set-Content -LiteralPath $sbomPath -Encoding utf8NoBOM

$assetPaths = @(
  $archivePath
  (Join-Path $releaseRoot $packOutput)
  $manifestPath
  (Join-Path $releaseRoot 'benchmark.json')
  $sbomPath
)
$checksumLines = foreach ($assetPath in $assetPaths) {
  $hash = (Get-FileHash -LiteralPath $assetPath -Algorithm SHA256).Hash.ToLowerInvariant()
  "$hash  $(Split-Path -Leaf $assetPath)"
}
Set-Content -LiteralPath (Join-Path $releaseRoot 'SHA256SUMS') -Value $checksumLines -Encoding ascii

[pscustomobject]@{
  Version = $version
  Commit = $CommitSha.ToLowerInvariant()
  Archive = $archivePath
  Package = Join-Path $releaseRoot $packOutput
  PerformanceGatePassed = [bool]$benchmark.passed
} | Format-List
