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

$requiredIcons = @(
  "icons\icon16.png",
  "icons\icon48.png",
  "icons\icon128.png"
)

foreach ($relativeIconPath in $requiredIcons) {
  $iconPath = Join-Path $extensionRoot $relativeIconPath
  if (-not (Test-Path -LiteralPath $iconPath)) {
    throw "Missing required icon: $iconPath"
  }
}

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

  # Chrome requires ZIP entry names with forward slashes. ZipFile.CreateFromDirectory
  # on Windows can emit backslashes, which makes Chrome fail to resolve icons.
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem

  $zipStream = [System.IO.File]::Open($temporaryZipPath, [System.IO.FileMode]::CreateNew)
  try {
    $archive = New-Object System.IO.Compression.ZipArchive(
      $zipStream,
      [System.IO.Compression.ZipArchiveMode]::Create,
      $false
    )

    try {
      $files = Get-ChildItem -LiteralPath $stagingRoot -Recurse -File
      foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($stagingRoot.Length).TrimStart('\', '/')
        $entryName = $relativePath.Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
          $archive,
          $file.FullName,
          $entryName,
          [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
      }
    } finally {
      $archive.Dispose()
    }
  } finally {
    $zipStream.Dispose()
  }

  $stagedIcons = @(
    "icons/icon16.png",
    "icons/icon48.png",
    "icons/icon128.png"
  )

  $verifyZip = [System.IO.Compression.ZipFile]::OpenRead($temporaryZipPath)
  try {
    $entryNames = @($verifyZip.Entries | ForEach-Object { $_.FullName })
    foreach ($iconEntry in $stagedIcons) {
      if ($entryNames -notcontains $iconEntry) {
        throw "Built ZIP is missing icon entry '$iconEntry'. Found: $($entryNames -join ', ')"
      }
    }
  } finally {
    $verifyZip.Dispose()
  }

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
