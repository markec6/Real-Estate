param(
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$extensionRoot = $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $extensionRoot "..\public\extension.zip"
}

$resolvedOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Parent $resolvedOutputPath

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

if (Test-Path $resolvedOutputPath) {
  Remove-Item $resolvedOutputPath -Force
}

$excludedNames = @(
  ".cursor",
  ".git",
  "build-extension.ps1",
  "extension.zip"
)

$itemsToZip = Get-ChildItem -LiteralPath $extensionRoot -Force |
  Where-Object { $excludedNames -notcontains $_.Name }

$stagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) "brei-extension-$([System.Guid]::NewGuid())"
$temporaryZipPath = Join-Path $outputDirectory "extension-$([System.Guid]::NewGuid()).zip"

New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null

try {
  foreach ($item in $itemsToZip) {
    $destination = Join-Path $stagingRoot $item.Name

    if ($item.PSIsContainer) {
      Copy-Item -LiteralPath $item.FullName -Destination $destination -Recurse -Force
    } else {
      Copy-Item -LiteralPath $item.FullName -Destination $destination -Force
    }
  }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::CreateFromDirectory(
    $stagingRoot,
    $temporaryZipPath,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
  )

  Move-Item -LiteralPath $temporaryZipPath -Destination $resolvedOutputPath -Force
} finally {
  if (Test-Path $temporaryZipPath) {
    Remove-Item $temporaryZipPath -Force
  }

  if (Test-Path $stagingRoot) {
    Remove-Item $stagingRoot -Recurse -Force
  }
}

Write-Output "Created $resolvedOutputPath"
