param(
  [string]$Mode = "auto",
  [string]$SessionId = "cli-rafi",
  [string]$IntelligenceLevel = "thinking",
  [string]$BaseUrl = "http://localhost:3000"
)

try { chcp 65001 > $null } catch {}

try {
  [Console]::InputEncoding = [System.Text.Encoding]::UTF8
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

# Load simple KEY=VALUE entries from project .env without overriding explicit process variables.
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DotEnvPath = Join-Path $ProjectRoot ".env"
if (Test-Path -LiteralPath $DotEnvPath) {
  Get-Content -LiteralPath $DotEnvPath -ErrorAction SilentlyContinue | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
      $parts = $line.Split("=", 2)
      $key = $parts[0].Trim()
      $value = $parts[1].Trim().Trim('"').Trim("'")
      if ($key -match '^[A-Za-z_][A-Za-z0-9_]*$' -and -not [Environment]::GetEnvironmentVariable($key, 'Process')) {
        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
      }
    }
  }
}

$CliVersion = "R13.45"
$ProfileName = "NusaMind Zenith"
$ChatMode = "general_chat"
$InternalCsEnabled = ($env:NUSAMIND_INTERNAL_CS -eq "true")
$script:AnswerFormat = "auto"
$AnswerMode = "APEX-AGENT-EVIDENCE"
$UploadLimitBytes = 80 * 1024 * 1024
$FolderFileLimit = 2500

$AllowedTextExtensions = @(
  ".txt", ".md", ".json", ".csv", ".ts", ".tsx", ".js", ".jsx", ".py", ".php",
  ".sql", ".html", ".css", ".scss", ".xml", ".yml", ".yaml", ".env", ".example",
  ".log", ".bat", ".ps1", ".ini", ".conf"
)

$AllowedDocumentExtensions = @(".pdf", ".docx", ".xlsx", ".xls")

function New-SessionId {
  return "cli-" + (Get-Date -Format "yyyyMMdd-HHmmss")
}

function Get-ProjectRoot {
  return Split-Path -Parent $PSScriptRoot
}

function Invoke-JsonRequest {
  param(
    [string]$Url,
    [string]$Method = "GET",
    [object]$Body = $null
  )

  $client = New-Object System.Net.WebClient
  $client.Encoding = [System.Text.Encoding]::UTF8
  $client.Headers.Add("Accept", "application/json")
  if ($env:ADMIN_TOKEN) { $client.Headers.Add('Authorization', "Bearer $env:ADMIN_TOKEN") }

  try {
    if ($Body -ne $null) {
      $client.Headers.Add("Content-Type", "application/json; charset=utf-8")
      $payloadJson = $Body | ConvertTo-Json -Depth 18
      $raw = $client.UploadString($Url, $Method, $payloadJson)
      return $raw | ConvertFrom-Json
    }

    $raw = $client.DownloadString($Url)
    return $raw | ConvertFrom-Json
  } finally {
    $client.Dispose()
  }
}

function Send-NusaMindMessage {
  param(
    [string]$Message,
    [string]$Mode,
    [string]$SessionId,
    [string]$BaseUrl,
    [string]$IntelligenceLevel,
    [string]$ChatMode = "general_chat"
  )

  $payloadObject = @{
    message = $Message
    mode = $Mode
    sessionId = $SessionId
    intelligenceLevel = $IntelligenceLevel
    sessionMode = $ChatMode
    answerMode = $script:AnswerFormat
  }

  try {
    $response = Invoke-JsonRequest -Url "$BaseUrl/api/chat-json" -Method "POST" -Body $payloadObject

    if ($response.answer) { return $response.answer }
    if ($response.reply) { return $response.reply }
    if ($response.message) { return $response.message }
    if ($response.error) { return "Error dari server: $($response.error)" }

    return ($response | ConvertTo-Json -Depth 10)
  } catch {
    return "ERROR_CLI_REQUEST: $($_.Exception.Message)"
  }
}


function Show-MlStatus {
  try {
    $result = Invoke-JsonRequest -Url "$BaseUrl/api/ml" -Method "GET"
    Write-Host ($result | ConvertTo-Json -Depth 12) -ForegroundColor Cyan
  } catch {
    Write-Host "ML service tidak tersedia. Jalankan ml-start.bat. Detail: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

function Invoke-MlAnalyze {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) {
    Write-Host "Gunakan: /ml analyze pertanyaan" -ForegroundColor Yellow
    return
  }
  try {
    $result = Invoke-JsonRequest -Url "$BaseUrl/api/ml" -Method "POST" -Body @{ operation = "analyze"; payload = @{ text = $Text } }
    Write-Host ($result | ConvertTo-Json -Depth 12) -ForegroundColor Cyan
  } catch {
    Write-Host "ML analyze gagal: $($_.Exception.Message)" -ForegroundColor Red
  }
}

function Split-CommandArgument {
  param(
    [string]$InputLine,
    [string]$CommandName,
    [string]$DefaultQuestion
  )

  $raw = $InputLine.Substring($CommandName.Length).Trim()

  if ([string]::IsNullOrWhiteSpace($raw)) {
    return @{
      path = ""
      question = $DefaultQuestion
      raw = ""
    }
  }

  if ($raw.StartsWith('"')) {
    $end = $raw.IndexOf('"', 1)
    if ($end -gt 1) {
      $pathValue = $raw.Substring(1, $end - 1)
      $questionValue = $raw.Substring($end + 1).Trim()
      if ([string]::IsNullOrWhiteSpace($questionValue)) { $questionValue = $DefaultQuestion }
      return @{
        path = $pathValue
        question = $questionValue
        raw = $raw
      }
    }
  }

  if ($raw.StartsWith("'")) {
    $end = $raw.IndexOf("'", 1)
    if ($end -gt 1) {
      $pathValue = $raw.Substring(1, $end - 1)
      $questionValue = $raw.Substring($end + 1).Trim()
      if ([string]::IsNullOrWhiteSpace($questionValue)) { $questionValue = $DefaultQuestion }
      return @{
        path = $pathValue
        question = $questionValue
        raw = $raw
      }
    }
  }

  $tokens = $raw -split "\s+"
  if ($tokens.Count -eq 0) {
    return @{
      path = ""
      question = $DefaultQuestion
      raw = $raw
    }
  }

  for ($i = $tokens.Count; $i -ge 1; $i--) {
    $candidate = ($tokens[0..($i - 1)] -join " ")
    $resolved = Resolve-UploadPath -PathText $candidate -Silent
    if ($resolved.found) {
      $questionPart = ""
      if ($i -lt $tokens.Count) {
        $questionPart = ($tokens[$i..($tokens.Count - 1)] -join " ").Trim()
      }
      if ([string]::IsNullOrWhiteSpace($questionPart)) { $questionPart = $DefaultQuestion }
      return @{
        path = $resolved.path
        question = $questionPart
        raw = $raw
      }
    }
  }

  $parts = $raw -split "\s+", 2
  $pathFallback = $parts[0]
  $questionFallback = if ($parts.Count -gt 1) { $parts[1] } else { $DefaultQuestion }

  return @{
    path = $pathFallback
    question = $questionFallback
    raw = $raw
  }
}

function Resolve-UploadPath {
  param(
    [string]$PathText,
    [switch]$Silent
  )

  $clean = ($PathText -replace '^&\s*', '').Trim().Trim('"').Trim("'")

  if ([string]::IsNullOrWhiteSpace($clean)) {
    return @{
      found = $false
      path = $clean
      candidates = @()
    }
  }

  $candidates = New-Object 'System.Collections.Generic.List[string]'
  $projectRoot = Get-ProjectRoot

  $expanded = [Environment]::ExpandEnvironmentVariables($clean)
  $candidates.Add($expanded) | Out-Null

  if (!(Split-Path -IsAbsolute $expanded)) {
    $candidates.Add((Join-Path (Get-Location).Path $expanded)) | Out-Null
    $candidates.Add((Join-Path $projectRoot $expanded)) | Out-Null
    $candidates.Add((Join-Path $projectRoot ("uploads\" + $expanded))) | Out-Null
    $candidates.Add((Join-Path $env:USERPROFILE ("Downloads\" + $expanded))) | Out-Null
    $candidates.Add((Join-Path $env:USERPROFILE ("Desktop\" + $expanded))) | Out-Null
    $candidates.Add((Join-Path $env:USERPROFILE ("Documents\" + $expanded))) | Out-Null
  }

  foreach ($candidate in $candidates) {
    try {
      if (Test-Path -LiteralPath $candidate) {
        return @{
          found = $true
          path = (Get-Item -LiteralPath $candidate).FullName
          candidates = $candidates
        }
      }
    } catch {}
  }

  $fileName = Split-Path -Leaf $expanded
  if (![string]::IsNullOrWhiteSpace($fileName)) {
    $searchBases = @(
      (Get-Location).Path,
      $projectRoot,
      (Join-Path $projectRoot "uploads"),
      (Join-Path $env:USERPROFILE "Downloads"),
      (Join-Path $env:USERPROFILE "Desktop"),
      (Join-Path $env:USERPROFILE "Documents")
    )

    foreach ($base in $searchBases) {
      try {
        if (Test-Path -LiteralPath $base) {
          $match = Get-ChildItem -LiteralPath $base -File -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -eq $fileName -or $_.BaseName -eq $fileName } |
            Select-Object -First 1

          if ($match) {
            return @{
              found = $true
              path = $match.FullName
              candidates = $candidates
            }
          }
        }
      } catch {}
    }
  }

  return @{
    found = $false
    path = $clean
    candidates = $candidates
  }
}

function Read-TextFileSafely {
  param(
    [string]$FilePath,
    [int]$LimitBytes
  )

  $bytes = [System.IO.File]::ReadAllBytes($FilePath)
  $truncated = $false

  if ($bytes.Length -gt $LimitBytes) {
    $newBytes = New-Object byte[] $LimitBytes
    [Array]::Copy($bytes, 0, $newBytes, 0, $LimitBytes)
    $bytes = $newBytes
    $truncated = $true
  }

  $content = [System.Text.Encoding]::UTF8.GetString($bytes)

  return @{
    content = $content
    truncated = $truncated
  }
}

function Read-DocumentWithNode {
  param(
    [string]$FilePath,
    [string]$Extension
  )

  $projectRoot = Get-ProjectRoot
  $scriptFile = Join-Path $env:TEMP ("nusamind-doc-reader-" + [Guid]::NewGuid().ToString() + ".js")

  $scriptLines = @(
    "const fs = require('fs');",
    "const path = process.argv[2];",
    "const ext = (process.argv[3] || '').toLowerCase();",
    "(async () => {",
    "  if (ext === '.pdf') {",
    "    const pdf = require('pdf-parse');",
    "    const data = await pdf(fs.readFileSync(path));",
    "    process.stdout.write((data.text || '').trim());",
    "    return;",
    "  }",
    "  if (ext === '.docx') {",
    "    const mammoth = require('mammoth');",
    "    const result = await mammoth.extractRawText({path});",
    "    process.stdout.write((result.value || '').trim());",
    "    return;",
    "  }",
    "  if (ext === '.xlsx' || ext === '.xls') {",
    "    const XLSX = require('xlsx');",
    "    const wb = XLSX.readFile(path);",
    "    const parts = [];",
    "    for (const name of wb.SheetNames.slice(0, 8)) {",
    "      const ws = wb.Sheets[name];",
    "      const csv = XLSX.utils.sheet_to_csv(ws);",
    "      parts.push('--- SHEET: ' + name + ' ---\\n' + csv);",
    "    }",
    "    process.stdout.write(parts.join('\\n\\n'));",
    "    return;",
    "  }",
    "})().catch(err => { console.error(err.message || String(err)); process.exit(2); });"
  )

  Set-Content -LiteralPath $scriptFile -Value ($scriptLines -join "`n") -Encoding UTF8

  try {
    Push-Location $projectRoot
    $out = & node $scriptFile $FilePath $Extension 2>&1
    $exit = $LASTEXITCODE
    Pop-Location

    if ($exit -ne 0) {
      return @{
        ok = $false
        content = ""
        error = ($out | Out-String).Trim()
      }
    }

    $text = ($out | Out-String).Trim()

    return @{
      ok = $true
      content = $text
      error = ""
    }
  } catch {
    try { Pop-Location } catch {}
    return @{
      ok = $false
      content = ""
      error = $_.Exception.Message
    }
  } finally {
    Remove-Item -LiteralPath $scriptFile -Force -ErrorAction SilentlyContinue
  }
}

function Build-FileUploadMessage {
  param(
    [string]$Path,
    [string]$Question
  )

  $resolved = Resolve-UploadPath -PathText $Path

  if (!$resolved.found) {
    $tips = @(
      "File tidak ditemukan: $Path",
      "",
      "Cara paling aman:",
      "1. Ketik /upload lalu spasi.",
      "2. Drag file dari File Explorer ke terminal.",
      "3. Tambahkan perintah, contoh: analisis file ini.",
      "",
      "Contoh:",
      '/upload "C:\Users\Nama\Downloads\file.csv" analisis file ini',
      '/upload ".\uploads\file.csv" analisis file ini',
      "",
      "Folder yang dicek otomatis: folder project, .\uploads, Downloads, Desktop, Documents."
    )

    return @{
      ok = $false
      message = ($tips -join "`n")
    }
  }

  $item = Get-Item -LiteralPath $resolved.path

  if ($item.PSIsContainer) {
    return @{
      ok = $false
      message = "Path itu folder. Pakai: /uploadfolder `"$($item.FullName)`""
    }
  }

  $ext = [System.IO.Path]::GetExtension($item.Name).ToLower()
  $sizeKb = [Math]::Round($item.Length / 1KB, 2)
  $content = ""
  $truncated = $false
  $parserNote = "text-reader"

  try {
    if ($AllowedTextExtensions -contains $ext) {
      $readResult = Read-TextFileSafely -FilePath $item.FullName -LimitBytes $UploadLimitBytes
      $content = $readResult.content
      $truncated = $readResult.truncated
    } elseif ($AllowedDocumentExtensions -contains $ext) {
      $docResult = Read-DocumentWithNode -FilePath $item.FullName -Extension $ext
      if (!$docResult.ok -or [string]::IsNullOrWhiteSpace($docResult.content)) {
        return @{
          ok = $false
          message = "File ditemukan, tapi teks $ext belum berhasil diekstrak. Pastikan sudah npm install dan dependency pdf-parse/mammoth/xlsx tersedia. File: $($item.FullName). Error: $($docResult.error)"
        }
      }
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($docResult.content)
      if ($bytes.Length -gt $UploadLimitBytes) {
        $newBytes = New-Object byte[] $UploadLimitBytes
        [Array]::Copy($bytes, 0, $newBytes, 0, $UploadLimitBytes)
        $bytes = $newBytes
        $truncated = $true
      }
      $content = [System.Text.Encoding]::UTF8.GetString($bytes)
      $parserNote = "node-document-reader"
    } else {
      return @{
        ok = $false
        message = "Format $ext belum didukung upload CLI. Format aman: txt, md, csv, json, code, pdf, docx, xlsx."
      }
    }

    $lines = @(
      "Saya upload file via CLI NusaMind $CliVersion.",
      "",
      "Metadata file:",
      "- Nama file: $($item.Name)",
      "- Path: $($item.FullName)",
      "- Ukuran asli: $sizeKb KB",
      "- Parser: $parserNote",
      "- Dipangkas: $truncated",
      "- Batas baca CLI: 512 KB",
      "",
      "Pertanyaan/perintah user:",
      $Question,
      "",
      "Isi file yang berhasil dibaca:",
      '```text',
      $content,
      '```'
    )

    return @{
      ok = $true
      message = ($lines -join "`n")
    }
  } catch {
    return @{
      ok = $false
      message = "Gagal membaca file: $($_.Exception.Message)"
    }
  }
}

function Build-FolderUploadMessage {
  param(
    [string]$Path,
    [string]$Question
  )

  $resolved = Resolve-UploadPath -PathText $Path

  if (!$resolved.found) {
    return @{
      ok = $false
      message = "Folder tidak ditemukan: $Path. Coba pakai path lengkap atau drag folder ke terminal."
    }
  }

  $item = Get-Item -LiteralPath $resolved.path

  if (!($item.PSIsContainer)) {
    return @{
      ok = $false
      message = "Path itu file. Pakai: /upload `"$($item.FullName)`""
    }
  }

  try {
    $files = Get-ChildItem -LiteralPath $item.FullName -Recurse -File |
      Where-Object {
        $fileExt = $_.Extension.ToLower()
        ($AllowedTextExtensions -contains $fileExt) -or ($AllowedDocumentExtensions -contains $fileExt)
      } |
      Select-Object -First $FolderFileLimit

    if (!$files -or $files.Count -eq 0) {
      return @{
        ok = $false
        message = "Tidak ada file teks, CSV, JSON, Markdown, kode, PDF, DOCX, atau XLSX yang bisa dibaca di folder itu."
      }
    }

    $chunks = New-Object 'System.Collections.Generic.List[string]'

    foreach ($f in $files) {
      try {
        $fileExt = $f.Extension.ToLower()
        $localLimit = [Math]::Min($UploadLimitBytes, 96 * 1024)
        $content = ""
        $truncated = $false
        $parserNote = "text-reader"

        if ($AllowedTextExtensions -contains $fileExt) {
          $readResult = Read-TextFileSafely -FilePath $f.FullName -LimitBytes $localLimit
          $content = $readResult.content
          $truncated = $readResult.truncated
        } elseif ($AllowedDocumentExtensions -contains $fileExt) {
          $docResult = Read-DocumentWithNode -FilePath $f.FullName -Extension $fileExt
          if ($docResult.ok) {
            $content = $docResult.content
            $parserNote = "node-document-reader"
          } else {
            $content = "Gagal extract dokumen: $($docResult.error)"
            $parserNote = "extract-error"
          }
        }

        if ($content.Length -gt $localLimit) {
          $content = $content.Substring(0, $localLimit)
          $truncated = $true
        }

        $rel = $f.FullName.Substring($item.FullName.Length)
        $rel = $rel.TrimStart([char[]]@('\', '/'))
        $chunkLines = @(
          "--- FILE: $rel | $([Math]::Round($f.Length/1KB,2)) KB | parser=$parserNote | truncated=$truncated ---",
          $content
        )
        $chunks.Add(($chunkLines -join "`n")) | Out-Null
      } catch {
        $chunks.Add("--- FILE ERROR: $($f.FullName) | $($_.Exception.Message) ---") | Out-Null
      }
    }

    $joined = $chunks -join "`n`n"

    $lines = @(
      "Saya upload ringkasan folder via CLI NusaMind $CliVersion.",
      "",
      "Metadata folder:",
      "- Folder: $($item.FullName)",
      "- File dibaca: $($files.Count) dari batas $FolderFileLimit",
      "- Batas baca per file folder: 96 KB",
      "",
      "Pertanyaan/perintah user:",
      $Question,
      "",
      "Isi/ringkasan file:",
      '```text',
      $joined,
      '```'
    )

    return @{
      ok = $true
      message = ($lines -join "`n")
    }
  } catch {
    return @{
      ok = $false
      message = "Gagal membaca folder: $($_.Exception.Message)"
    }
  }
}

function Find-LocalFile {
  param([string]$Pattern)

  if ([string]::IsNullOrWhiteSpace($Pattern)) {
    Write-Host "Contoh: /find nilai atau /find dataset.csv" -ForegroundColor Yellow
    return
  }

  $projectRoot = Get-ProjectRoot
  $searchBases = @(
    (Get-Location).Path,
    $projectRoot,
    (Join-Path $projectRoot "uploads"),
    (Join-Path $env:USERPROFILE "Downloads"),
    (Join-Path $env:USERPROFILE "Desktop"),
    (Join-Path $env:USERPROFILE "Documents")
  )

  $matches = New-Object 'System.Collections.Generic.List[object]'

  foreach ($base in $searchBases) {
    try {
      if (Test-Path -LiteralPath $base) {
        Get-ChildItem -LiteralPath $base -File -ErrorAction SilentlyContinue |
          Where-Object { $_.Name -like "*$Pattern*" } |
          Select-Object -First 8 |
          ForEach-Object { $matches.Add($_) | Out-Null }
      }
    } catch {}
  }

  if ($matches.Count -eq 0) {
    Write-Host "File belum ketemu. Coba gunakan path lengkap atau drag file ke terminal." -ForegroundColor Yellow
    return
  }

  Write-Host ""
  Write-Host "File ditemukan:" -ForegroundColor Cyan
  $i = 1
  foreach ($m in $matches | Select-Object -First 12) {
    Write-Host ("{0}. {1}" -f $i, $m.FullName) -ForegroundColor Gray
    $i++
  }
  Write-Host ""
  Write-Host "Copy salah satu path, lalu pakai:" -ForegroundColor Yellow
  Write-Host '/upload "PATH_DI_ATAS" analisis file ini' -ForegroundColor Yellow
}


function Invoke-DesktopRequest {
  param([hashtable]$Payload)
  try {
    $headers = @{}
    if ($env:DESKTOP_CONTROL_TOKEN) { $headers["x-desktop-token"] = $env:DESKTOP_CONTROL_TOKEN }
    return Invoke-RestMethod -Uri "$BaseUrl/api/desktop" -Method Post -ContentType "application/json; charset=utf-8" -Headers $headers -Body ($Payload | ConvertTo-Json -Depth 12)
  } catch { return @{ ok = $false; error = $_.Exception.Message } }
}
function Show-DesktopResult { param($Result) if ($Result.ok -eq $false -or $Result.error) { Write-Host ("Desktop error: " + $Result.error) -ForegroundColor Red } else { Write-Host ($Result | ConvertTo-Json -Depth 10) -ForegroundColor Gray } }
function Handle-DesktopCommand {
  param([string]$InputLine)
  if ($InputLine -eq "/desktop status") { Show-DesktopResult (Invoke-DesktopRequest @{action="status"}); return $true }
  if ($InputLine -like "/desktop suggest *") { Show-DesktopResult (Invoke-DesktopRequest @{action="suggest";task=$InputLine.Substring(17).Trim()}); return $true }
  if ($InputLine -like "/run-preview *") { Show-DesktopResult (Invoke-DesktopRequest @{action="preview";command=$InputLine.Substring(13).Trim();cwd=(Get-Location).Path}); return $true }
  if ($InputLine -like "/allow-folder *") { $folder=$InputLine.Substring(14).Trim().Trim('"').Trim("'"); Show-DesktopResult (Invoke-DesktopRequest @{action="allow-folder";folder=$folder}); return $true }
  if ($InputLine -like "/run safe *") {
    $command=$InputLine.Substring(10).Trim(); $preview=Invoke-DesktopRequest @{action="preview";command=$command;cwd=(Get-Location).Path}; Show-DesktopResult $preview
    if ($preview.allowed -ne $true) { return $true }
    $confirm=Read-Host "Jalankan command ini? ketik Y untuk konfirmasi"
    if ($confirm -match '^(y|yes|ya)$') { Show-DesktopResult (Invoke-DesktopRequest @{action="execute";command=$command;cwd=(Get-Location).Path;confirmed=$true}) } else { Write-Host "Dibatalkan." -ForegroundColor Yellow }
    return $true
  }
  if ($InputLine -eq "/actions log") { Show-DesktopResult (Invoke-DesktopRequest @{action="logs";limit=30}); return $true }
  if ($InputLine -like "/stop*") { $id=$InputLine.Substring(5).Trim(); Show-DesktopResult (Invoke-DesktopRequest @{action="stop";taskId=$id}); return $true }
  if ($InputLine -match '^/file-create\s+"([^"]+)"\s+(.+)$') { $p=$Matches[1];$content=$Matches[2];$ok=Read-Host "Buat file ini? ketik Y";if($ok -match '^(y|yes|ya)$'){Show-DesktopResult (Invoke-DesktopRequest @{action="file-create";path=$p;content=$content;confirmed=$true})};return $true }
  if ($InputLine -match '^/file-edit\s+"([^"]+)"\s+(.+)$') { $p=$Matches[1];$content=$Matches[2];$ok=Read-Host "Edit file dan buat backup? ketik Y";if($ok -match '^(y|yes|ya)$'){Show-DesktopResult (Invoke-DesktopRequest @{action="file-edit";path=$p;content=$content;mode="overwrite";confirmed=$true})};return $true }
  if ($InputLine -match '^/file-move\s+"([^"]+)"\s+"([^"]+)"$') { $src=$Matches[1];$dst=$Matches[2];$ok=Read-Host "Pindahkan file? ketik Y";if($ok -match '^(y|yes|ya)$'){Show-DesktopResult (Invoke-DesktopRequest @{action="file-move";path=$src;target=$dst;confirmed=$true})};return $true }
  if ($InputLine -match '^/app-open\s+(.+)$') { $app=$Matches[1].Trim();$ok=Read-Host "Buka aplikasi $app? ketik Y";if($ok -match '^(y|yes|ya)$'){Show-DesktopResult (Invoke-DesktopRequest @{action="app-open";app=$app;confirmed=$true})};return $true }
  if ($InputLine -match '^/app-close\s+(.+)$') { $app=$Matches[1].Trim();$ok=Read-Host "Tutup aplikasi $app? ketik Y";if($ok -match '^(y|yes|ya)$'){Show-DesktopResult (Invoke-DesktopRequest @{action="app-close";app=$app;confirmed=$true})};return $true }
  return $false
}

function Try-NaturalAction {
  param([string]$InputLine)
  $text=$InputLine.Trim()
  if ($text -match '(?i)^(buka|jalankan) aplikasi\s+(.+)$') { $app=$Matches[2].Trim();$ok=Read-Host "Aksi aplikasi terdeteksi: buka $app. Konfirmasi Y";if($ok -match '^(y|yes|ya)$'){Show-DesktopResult (Invoke-DesktopRequest @{action="app-open";app=$app;confirmed=$true})};return $true }
  if ($text -match '(?i)^tutup aplikasi\s+(.+)$') { $app=$Matches[1].Trim();$ok=Read-Host "Aksi aplikasi terdeteksi: tutup $app. Konfirmasi Y";if($ok -match '^(y|yes|ya)$'){Show-DesktopResult (Invoke-DesktopRequest @{action="app-close";app=$app;confirmed=$true})};return $true }
  if ($text -match '(?i)^buat file\s+"([^"]+)"\s+(?:isi\s+)?(.+)$') { $p=$Matches[1];$content=$Matches[2];$ok=Read-Host "Buat file $p? Konfirmasi Y";if($ok -match '^(y|yes|ya)$'){Show-DesktopResult (Invoke-DesktopRequest @{action="file-create";path=$p;content=$content;confirmed=$true})};return $true }
  if ($text -match '(?i)^pindahkan file\s+"([^"]+)"\s+ke\s+"([^"]+)"$') { $src=$Matches[1];$dst=$Matches[2];$ok=Read-Host "Pindahkan file? Konfirmasi Y";if($ok -match '^(y|yes|ya)$'){Show-DesktopResult (Invoke-DesktopRequest @{action="file-move";path=$src;target=$dst;confirmed=$true})};return $true }
  return $false
}

function Show-LocalHelp {
  Write-Host ""
  Write-Host "Command lokal CLI:" -ForegroundColor Cyan
  Write-Host "/help                         tampilkan bantuan CLI" -ForegroundColor Gray
  Write-Host "/menu                         kembali ke menu pra-chat" -ForegroundColor Gray
  Write-Host "/mode                         pilih mode chat/session" -ForegroundColor Gray
  Write-Host "/version                      tampilkan versi CLI aktif" -ForegroundColor Gray
  Write-Host "/knowledge                    buka Knowledge Center R13.45" -ForegroundColor Gray
  Write-Host "/ml status                    cek Python ML Service R13.45" -ForegroundColor Gray
  Write-Host "/ml analyze [teks]            analisis domain, intent, sentimen, dan risiko" -ForegroundColor Gray
  Write-Host "/new                          buat session baru" -ForegroundColor Gray
  Write-Host "/load <sessionId>             ganti session" -ForegroundColor Gray
  Write-Host "/level <name>                 ganti level: instant, ordinary, medium, high, thinking" -ForegroundColor Gray
  Write-Host "/upload <file> [perintah]     baca file ke konteks chat" -ForegroundColor Gray
  Write-Host "/uploadfolder <folder>        baca ringkasan folder ke konteks chat" -ForegroundColor Gray
  Write-Host "/find <nama>                  cari file di project, uploads, Downloads, Desktop, Documents" -ForegroundColor Gray
  Write-Host "/desktop status               cek mode desktop aktif" -ForegroundColor Gray
  Write-Host "/desktop suggest <task>       buat saran/rencana desktop aman" -ForegroundColor Gray
  Write-Host "/run-preview <command>        klasifikasi risiko tanpa eksekusi" -ForegroundColor Gray
  Write-Host "/allow-folder <path>          izinkan workspace lokal" -ForegroundColor Gray
  Write-Host "/run safe <command>           eksekusi whitelist setelah konfirmasi" -ForegroundColor Gray
  Write-Host "/actions log                  lihat audit desktop" -ForegroundColor Gray
  Write-Host '/file-create "path" isi       buat file setelah konfirmasi' -ForegroundColor Gray
  Write-Host '/file-edit "path" isi         edit file + backup' -ForegroundColor Gray
  Write-Host '/file-move "src" "dst"      pindahkan file aman' -ForegroundColor Gray
  Write-Host "/app-open <nama>              buka aplikasi whitelist" -ForegroundColor Gray
  Write-Host "/app-close <nama>             tutup aplikasi whitelist" -ForegroundColor Gray
  Write-Host "/stop [taskId]                emergency stop" -ForegroundColor Gray
  Write-Host "exit                          keluar CLI" -ForegroundColor Gray
  Write-Host ""
  Write-Host "Tips upload:" -ForegroundColor Cyan
  Write-Host 'Gunakan tanda kutip untuk path yang ada spasi: /upload "C:\path\file.csv" analisis file ini' -ForegroundColor Gray
  Write-Host 'Bisa juga drag file dari File Explorer langsung ke terminal setelah mengetik /upload' -ForegroundColor Gray
  Write-Host ""
  Write-Host "Command server yang bisa dikirim:" -ForegroundColor Cyan
  Write-Host "/session, /summary, /last, /tasks, /pin, /health, /private on, /private off" -ForegroundColor Gray
  Write-Host ""
}


function Select-IntelligenceMenu {
  $options=@(@{label="Direct";level="high"},@{label="Analytical";level="high"},@{label="Deep Thinking";level="thinking"},@{label="Research";level="thinking"},@{label="Agent";level="thinking"},@{label="Auto";level="thinking"})
  Write-Host ""; Write-Host "Type Kecerdasan" -ForegroundColor Cyan
  for($i=0;$i -lt $options.Count;$i++){Write-Host ("["+($i+1)+"] "+$options[$i].label)}
  $pick=Read-Host "Pilih"
  if($pick -match '^\d+$' -and [int]$pick -ge 1 -and [int]$pick -le $options.Count){ $script:IntelligenceLevel=$options[[int]$pick-1].level; Write-Host ("Level aktif: "+$script:IntelligenceLevel) -ForegroundColor Green } else { Write-Host "Pilihan tidak valid; level lama dipertahankan." -ForegroundColor Yellow }
}
function Set-ChatMode {
  param([string]$ModeId)
  $script:ChatMode=$ModeId
  $script:SessionId=New-SessionId
  Write-Host ("Mode aktif: "+$script:ChatMode+" | session baru: "+$script:SessionId) -ForegroundColor Green
}

function Select-InsuranceFinanceMenu {
  Write-Host ""
  Write-Host "Keuangan Klaim dan Premi" -ForegroundColor Cyan
  Write-Host "[1] Perhitungan Klaim"
  Write-Host "[2] Premi dan Refund"
  Write-Host "[3] Rasio dan Underwriting"
  Write-Host "[4] Cadangan dan IBNR"
  Write-Host "[5] Reasuransi"
  Write-Host "[6] Solvabilitas dan Likuiditas"
  Write-Host "[7] Investasi dan ALM"
  Write-Host "[8] Scenario dan Sensitivity"
  Write-Host "[9] Mode Keuangan Asuransi Umum"
  $pick=Read-Host "Pilih submenu"
  switch($pick){
    '1'{Set-ChatMode 'insurance_finance_claim'}
    '2'{Set-ChatMode 'insurance_finance_premium'}
    '3'{Set-ChatMode 'insurance_finance_underwriting'}
    '4'{Set-ChatMode 'insurance_finance_reserve'}
    '5'{Set-ChatMode 'insurance_finance_reinsurance'}
    '6'{Set-ChatMode 'insurance_finance_capital'}
    '7'{Set-ChatMode 'insurance_finance_investment'}
    '8'{Set-ChatMode 'insurance_finance_scenario'}
    '9'{Set-ChatMode 'insurance_finance'}
    default{Write-Host "Pilihan tidak valid." -ForegroundColor Yellow}
  }
}

function Select-InsuranceMenu {
  Write-Host ""
  Write-Host "Customer Service Asuransi" -ForegroundColor Cyan
  Write-Host "[1] Informasi Produk dan Polis"
  Write-Host "[2] Panduan dan Status Klaim"
  Write-Host "[3] Keuangan Klaim dan Premi"
  Write-Host "[4] Mode Asuransi Umum"
  $pick=Read-Host "Pilih submenu"
  switch($pick){
    '1'{Set-ChatMode 'insurance_product_policy'}
    '2'{Set-ChatMode 'insurance_claim_service'}
    '3'{Select-InsuranceFinanceMenu}
    '4'{Set-ChatMode 'customer_service_insurance'}
    default{Write-Host "Pilihan tidak valid." -ForegroundColor Yellow}
  }
}


function Select-ReligionMenu {
  Write-Host ""
  Write-Host "Agama dan Al-Qur'an R13.45" -ForegroundColor Cyan
  Write-Host "[1] Tanya Ayat dan Kandungan"
  Write-Host "[2] Tafsir dan Konteks"
  Write-Host "[3] Perbandingan Ayat"
  Write-Host "[4] Bahasa Arab Al-Qur'an"
  Write-Host "[5] Qiraat"
  Write-Host "[6] Verifikasi Hadis"
  Write-Host "[7] Asbabun Nuzul dan Sejarah"
  Write-Host "[8] Fikih dan Perbedaan Mazhab"
  Write-Host "[9] Akidah dan Teologi"
  Write-Host "[10] Riset Akademik Agama"
  Write-Host "[11] Analisis File Agama"
  Write-Host "[12] Lihat Evidence dan Sumber"
  Write-Host "[13] Handoff ke Ahli Manusia"
  Write-Host "[14] Security dan Privacy"
  Write-Host "[15] Mode Agama Umum"
  $pick=Read-Host "Pilih submenu"
  switch($pick){
    '1'{Set-ChatMode 'quran_lookup_theme'}
    '2'{Set-ChatMode 'quran_contextual_tafsir'}
    '3'{Set-ChatMode 'quran_comparative'}
    '4'{Set-ChatMode 'quran_arabic'}
    '5'{Set-ChatMode 'quran_qiraat'}
    '6'{Set-ChatMode 'religion_hadith'}
    '7'{Set-ChatMode 'quran_asbab_history'}
    '8'{Set-ChatMode 'religion_fiqh'}
    '9'{Set-ChatMode 'religion_theology'}
    '10'{Set-ChatMode 'religion_academic'}
    '11'{Set-ChatMode 'religion_artifact'}
    '12'{Set-ChatMode 'religion_evidence_view'}
    '13'{Set-ChatMode 'religion_human_handoff'}
    '14'{Set-ChatMode 'religion_security'}
    '15'{Set-ChatMode 'religion_quran'}
    default{Write-Host "Pilihan tidak valid." -ForegroundColor Yellow}
  }
}

function Select-ChatModeMenu {
  Write-Host ""
  Write-Host "Mode Chat" -ForegroundColor Cyan
  Write-Host "[1] Chat Umum"
  Write-Host "[2] Customer Service Umum"
  Write-Host "[3] Customer Service Asuransi"
  Write-Host "[4] Agama dan Al-Qur'an"
  if ($InternalCsEnabled) { Write-Host "[5] CS Internal / Supervisor" }
  $pick=Read-Host "Pilih mode"
  switch($pick){
    '1'{Set-ChatMode 'general_chat'}
    '2'{Set-ChatMode 'customer_service_general'}
    '3'{Select-InsuranceMenu}
    '4'{Select-ReligionMenu}
    '5'{if($InternalCsEnabled){Set-ChatMode 'customer_service_internal'}else{Write-Host "Mode internal tidak tersedia/terverifikasi." -ForegroundColor Yellow}}
    default{Write-Host "Pilihan tidak valid." -ForegroundColor Yellow}
  }
}

function Select-AnswerFormatMenu {
  while($true){
    Write-Host ""
    Write-Host "Format Jawaban R13.45" -ForegroundColor Cyan
    Write-Host "[1] Otomatis"
    Write-Host "[2] Jawaban Langsung"
    Write-Host "[3] Langkah demi Langkah"
    Write-Host "[4] Mendalam / Expert"
    Write-Host "[5] Plain Text CLI"
    Write-Host "[6] Markdown"
    Write-Host "[7] LaTeX (hanya atas permintaan)"
    Write-Host "[8] Siap Disalin"
    Write-Host "[9] Lebar Terminal"
    Write-Host "[0] Kembali"
    Write-Host ("Aktif: "+$script:AnswerFormat) -ForegroundColor Gray
    $pick=Read-Host "Pilih format"
    switch($pick){
      '1'{$script:AnswerFormat='auto'}
      '2'{$script:AnswerFormat='direct'}
      '3'{$script:AnswerFormat='steps'}
      '4'{$script:AnswerFormat='expert'}
      '5'{$script:AnswerFormat='plain'}
      '6'{$script:AnswerFormat='markdown'}
      '7'{$script:AnswerFormat='latex'}
      '8'{$script:AnswerFormat='copy'}
      '9'{$width=Read-Host 'Lebar terminal (contoh 80)';if($width -match '^\d{2,3}$'){$env:NUSAMIND_TERMINAL_WIDTH=$width;Write-Host ("Lebar terminal: "+$width) -ForegroundColor Green}else{Write-Host 'Lebar tidak valid.' -ForegroundColor Yellow};continue}
      '0'{return}
      default{Write-Host "Pilihan tidak valid." -ForegroundColor Yellow;continue}
    }
    Write-Host ("Format aktif: "+$script:AnswerFormat) -ForegroundColor Green
    return
  }
}

function Show-VersionMenu {
  Write-Host ""
  Write-Host 'Version' -ForegroundColor Cyan
  Write-Host '[1] Swift - cepat/ringan'
  Write-Host '[2] Zenith - seimbang/multi-file'
  Write-Host '[3] Apex - expert/research/agent'
  Write-Host 'Aktif: NusaMind Apex. Untuk berpindah, jalankan launcher folder edition tujuan.' -ForegroundColor Gray
  Read-Host 'Tekan Enter untuk kembali' | Out-Null
}
function Show-DisclaimerMenu { Write-Host "";Write-Host "Disclaimer" -ForegroundColor Cyan;Write-Host "Apex dapat melakukan analisis kompleks, riset, dan agent workflow. Aksi berisiko selalu memerlukan izin dan verifikasi." -ForegroundColor Gray;Read-Host "Tekan Enter untuk kembali" | Out-Null }
function Invoke-KnowledgeApi {
  param([string]$Path,[string]$Method='GET',[object]$Body=$null)
  try {
    $headers=@{}; if($env:KNOWLEDGE_CONTROL_TOKEN){$headers['x-knowledge-token']=$env:KNOWLEDGE_CONTROL_TOKEN}
    if($Body -ne $null){return Invoke-RestMethod -Uri "$BaseUrl$Path" -Method $Method -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ($Body|ConvertTo-Json -Depth 20)}
    return Invoke-RestMethod -Uri "$BaseUrl$Path" -Method $Method -Headers $headers
  } catch { return @{ok=$false;error=$_.Exception.Message} }
}
function Show-KnowledgeCenter {
 while($true){
  Write-Host '';Write-Host 'Knowledge Center R13.45' -ForegroundColor Cyan
  Write-Host '[1] Coverage Domain';Write-Host '[2] Knowledge Gaps';Write-Host '[3] Import Source';Write-Host '[4] Review Pending Data';Write-Host '[5] Conflicting Claims';Write-Host '[6] Deprecated Knowledge';Write-Host '[7] Rebuild Index';Write-Host '[8] Run Benchmark';Write-Host '[9] Rollback Batch';Write-Host '[10] Export Health Report';Write-Host '[0] Kembali'
  $pick=Read-Host 'Pilih';if($pick -eq '0'){return}
  if($pick -eq '1'){$r=Invoke-KnowledgeApi '/api/knowledge/coverage';($r|ConvertTo-Json -Depth 12)|Write-Host}
  elseif($pick -eq '2'){$r=Invoke-KnowledgeApi '/api/knowledge/gaps?limit=30';($r|ConvertTo-Json -Depth 12)|Write-Host}
  elseif($pick -eq '3'){
   $file=(Read-Host 'Path JSON records').Trim('"');if(-not(Test-Path -LiteralPath $file)){Write-Host 'File tidak ditemukan.' -ForegroundColor Yellow;continue}
   try{$records=Get-Content -LiteralPath $file -Raw|ConvertFrom-Json}catch{Write-Host 'JSON tidak valid.' -ForegroundColor Red;continue}
   $rights=Read-Host 'Source rights: owned/licensed/public-domain/official/academic/user-provided';$ok=Read-Host 'Import supervised? ketik Y'
   if($ok -match '^(y|yes|ya)$'){$r=Invoke-KnowledgeApi '/api/knowledge/import' 'POST' @{sourceName=(Split-Path -Leaf $file);sourceKind='json';sourceRights=$rights;records=@($records);confirmed=$true};($r|ConvertTo-Json -Depth 16)|Write-Host}
  }
  elseif($pick -eq '4'){$r=Invoke-KnowledgeApi '/api/knowledge/review?limit=50';($r|ConvertTo-Json -Depth 12)|Write-Host}
  elseif($pick -eq '5'){$r=Invoke-KnowledgeApi '/api/knowledge/conflicts?limit=50';($r|ConvertTo-Json -Depth 12)|Write-Host}
  elseif($pick -eq '6'){$r=Invoke-KnowledgeApi '/api/knowledge/deprecated?limit=50';($r|ConvertTo-Json -Depth 12)|Write-Host}
  elseif($pick -eq '7'){$domain=Read-Host 'Domain (kosong untuk full Apex)';$ok=Read-Host 'Rebuild index? ketik Y';if($ok -match '^(y|yes|ya)$'){$r=Invoke-KnowledgeApi '/api/knowledge/reindex' 'POST' @{domain=$domain;confirmed=$true};($r|ConvertTo-Json -Depth 12)|Write-Host}}
  elseif($pick -eq '8'){$r=Invoke-KnowledgeApi '/api/knowledge/benchmark' 'POST' @{};($r|ConvertTo-Json -Depth 14)|Write-Host}
  elseif($pick -eq '9'){$id=Read-Host 'Batch ID';$ok=Read-Host 'Rollback high-risk? ketik Y';if($ok -match '^(y|yes|ya)$'){$r=Invoke-KnowledgeApi '/api/knowledge/rollback' 'POST' @{batchId=$id;confirmed=$true;reason='CLI authorized rollback'};($r|ConvertTo-Json -Depth 14)|Write-Host}}
  elseif($pick -eq '10'){$r=Invoke-KnowledgeApi '/api/knowledge/report';($r|ConvertTo-Json -Depth 15)|Write-Host}
  else{Write-Host 'Pilihan tidak tersedia.' -ForegroundColor Yellow}
  Read-Host 'Enter untuk kembali'|Out-Null
 }
}
function Show-PreChatMenu {
  while($true){
    Clear-Host
    Write-Host "Apex Nexus CLI R13.45" -ForegroundColor Cyan
    Write-Host "[1] Type Kecerdasan";Write-Host "[2] Mode Chat";Write-Host "[3] Chat dan Session";Write-Host "[4] Version";Write-Host "[5] Upload File";Write-Host "[6] Customer Service";Write-Host "[7] Agama dan Al-Qur'an";Write-Host "[8] Disclaimer";Write-Host "[9] Keamanan";Write-Host "[10] Format Jawaban";Write-Host "[11] Knowledge Center";Write-Host "[0] Keluar"
    $choice=Read-Host "Pilih menu"
    switch($choice){
      '1'{Select-IntelligenceMenu}
      '2'{Select-ChatModeMenu}
      '3'{$chat=Read-Host "[1] Chat baru  [2] Lanjut session aktif";if($chat -eq '1'){$script:SessionId=New-SessionId};return @{exit=$false;message=$null}}
      '4'{Show-VersionMenu}
      '5'{$up=Invoke-MenuUpload;if($up.ok){return @{exit=$false;message=$up.message}}}
      '6'{Write-Host "";Write-Host "Customer Service" -ForegroundColor Cyan;Write-Host ("Mode aktif: "+$script:ChatMode);Write-Host "Ticket/status/handoff serta kalkulasi keuangan mengikuti evidence, verifikasi, izin, konfirmasi, dan audit." -ForegroundColor Gray;Read-Host "Tekan Enter untuk kembali" | Out-Null}
      '7'{Select-ReligionMenu}
      '8'{Show-DisclaimerMenu}
      '9'{Show-SecurityMenu}
      '10'{Select-AnswerFormatMenu}
      '11'{Show-KnowledgeCenter}
      '0'{return @{exit=$true;message=$null}}
      default{Write-Host "Pilihan tidak dikenali." -ForegroundColor Yellow;Start-Sleep -Milliseconds 700}
    }
  }
}

function Show-Header {
  Clear-Host
  Write-Host "NusaMind AI CLI Chat $CliVersion - $ProfileName" -ForegroundColor Cyan
  Write-Host "Mode        : $Mode" -ForegroundColor Gray
  Write-Host "Chat Mode   : $ChatMode" -ForegroundColor Gray
  Write-Host "Level       : $IntelligenceLevel" -ForegroundColor Gray
  Write-Host "Answer Mode : $AnswerMode | Format: $script:AnswerFormat" -ForegroundColor Gray
  Write-Host "Session     : $SessionId" -ForegroundColor Gray
  Write-Host "Base URL    : $BaseUrl" -ForegroundColor Gray
  Write-Host 'Command     : /help, /version, /knowledge, /ml status, /ml analyze, /desktop status, /run-preview, /run safe, /find, /upload, /session, /summary, /last, /tasks, /pin, /health, /new, /load [id], /level [name], exit' -ForegroundColor Yellow
  Write-Host ("Upload      : text/code/csv/json/pdf/docx/xlsx/zip/sqlite, limit "+[Math]::Floor($UploadLimitBytes/1MB)+" MB per file, folder limit "+$FolderFileLimit+" files") -ForegroundColor DarkGray
  Write-Host ""
}


# --- R13.45 functional menu/upload/security registry ---
$script:FolderUploadEnabled = $true
function Invoke-MultipartUpload {
  param([string]$Path,[string]$Question='Analisis file ini.',[bool]$PrivateMode=$false)
  try {
    $resolved=(Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
    $info=Get-Item -LiteralPath $resolved -ErrorAction Stop
    if($info.Length -gt $UploadLimitBytes){return @{ok=$false;message="Ukuran file melebihi batas $([Math]::Floor($UploadLimitBytes/1MB)) MB untuk edition ini."}}
    Write-Host '[1/5] Scanning file dan validasi ukuran...' -ForegroundColor DarkCyan
    Add-Type -AssemblyName System.Net.Http -ErrorAction SilentlyContinue
    $client=[System.Net.Http.HttpClient]::new();$content=[System.Net.Http.MultipartFormDataContent]::new()
    if($env:ADMIN_TOKEN){$client.DefaultRequestHeaders.Authorization=[System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer',$env:ADMIN_TOKEN)}
    $stream=[System.IO.File]::OpenRead($resolved);$fileContent=[System.Net.Http.StreamContent]::new($stream);$fileContent.Headers.ContentType=[System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('application/octet-stream')
    $content.Add($fileContent,'file',$info.Name);$content.Add([System.Net.Http.StringContent]::new($Question),'question');$content.Add([System.Net.Http.StringContent]::new($script:SessionId),'sessionId');$content.Add([System.Net.Http.StringContent]::new($script:ChatMode),'mode');$content.Add([System.Net.Http.StringContent]::new($PrivateMode.ToString().ToLower()),'privateMode')
    Write-Host '[2/5] Uploading ke unified parser API...' -ForegroundColor DarkCyan
    $response=$client.PostAsync("$BaseUrl/api/upload/analyze",$content).GetAwaiter().GetResult();$raw=$response.Content.ReadAsStringAsync().GetAwaiter().GetResult();$stream.Dispose();$content.Dispose();$client.Dispose()
    $data=$raw|ConvertFrom-Json
    if(-not $response.IsSuccessStatusCode -or $data.ok -ne $true){return @{ok=$false;message=$(if($data.error){[string]$data.error}else{"HTTP $([int]$response.StatusCode)"});data=$data}}
    Write-Host '[3/5] Parsing/OCR selesai.' -ForegroundColor DarkCyan;Write-Host '[4/5] Artifact didaftarkan.' -ForegroundColor DarkCyan;Write-Host ("Artifact ID: "+$data.artifact.id) -ForegroundColor Yellow;Write-Host ("Parser: "+$data.analysis.parser+" | Confidence: "+$data.analysis.confidence) -ForegroundColor Gray;Write-Host '[5/5] Siap dipakai sebagai SOURCE_DATA.' -ForegroundColor Green
    return @{ok=$true;message=[string]$data.promptContext;data=$data}
  } catch {return @{ok=$false;message=$_.Exception.Message}}
}
function New-SafeProjectArchive {
 param([string]$Folder)
 $root=(Resolve-Path -LiteralPath $Folder -ErrorAction Stop).Path;$exclude='\\(node_modules|\.git|\.next|dist|build|cache|logs?|backups?|storage)(\\|$)';$max=if('apex' -eq 'apex'){2500}else{800}
 $files=Get-ChildItem -LiteralPath $root -Recurse -File -Force -ErrorAction Stop|Where-Object{-not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -and $_.FullName -notmatch $exclude -and $_.Name -notmatch '^\.env($|\.)|private.*key|id_rsa'}|Select-Object -First $max
 Write-Host ("Manifest aman: "+$files.Count+" file akan dimasukkan.") -ForegroundColor Cyan;$confirm=Read-Host 'Lanjut membuat ZIP sementara? ketik Y';if($confirm -notmatch '^(y|yes|ya)$'){return $null}
 $temp=Join-Path ([IO.Path]::GetTempPath()) ("nusamind-"+[guid]::NewGuid());$stage=Join-Path $temp 'project';New-Item -ItemType Directory -Path $stage -Force|Out-Null
 foreach($f in $files){$rel=$f.FullName.Substring($root.Length).TrimStart('\\');$dest=Join-Path $stage $rel;New-Item -ItemType Directory -Path (Split-Path $dest) -Force|Out-Null;Copy-Item -LiteralPath $f.FullName -Destination $dest}
 $zip="$temp.zip";Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal;Remove-Item -LiteralPath $temp -Recurse -Force;return $zip
}
function Build-FileUploadMessage {param([string]$Path,[string]$Question) return Invoke-MultipartUpload -Path $Path -Question $Question}
function Build-FolderUploadMessage {
 param([string]$Path,[string]$Question='Analisis folder/project ini secara aman.')
 if(-not $script:FolderUploadEnabled){return @{ok=$false;message='Edition ini hanya mendukung single-file upload. Gunakan Zenith/Apex untuk folder/project.'}}
 try{$zip=New-SafeProjectArchive -Folder $Path;if(-not $zip){return @{ok=$false;message='Pembuatan archive dibatalkan.'}};$result=Invoke-MultipartUpload -Path $zip -Question $Question;Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue;return $result}catch{return @{ok=$false;message=$_.Exception.Message}}
}
function Invoke-MultiFileQueue {
 if(-not $script:FolderUploadEnabled){return @{ok=$false;message='Multi-file queue tidak tersedia pada Swift.'}}
 $raw=Read-Host 'Masukkan path file dipisahkan tanda ;'
 $paths=$raw.Split(';')|ForEach-Object{$_.Trim().Trim('"')}|Where-Object{$_}
 if($paths.Count -eq 0){return @{ok=$false;message='Tidak ada file dipilih.'}}
 $contexts=New-Object System.Collections.Generic.List[string]
 foreach($path in $paths){Write-Host ("Queue: "+$path) -ForegroundColor DarkCyan;$r=Invoke-MultipartUpload -Path $path -Question 'Daftarkan sebagai artifact workspace dan ambil evidence relevan.';if($r.ok){$contexts.Add([string]$r.message)|Out-Null}else{Write-Host $r.message -ForegroundColor Red}}
 if($contexts.Count -eq 0){return @{ok=$false;message='Semua upload gagal.'}}
 return @{ok=$true;message=("[MULTI_ARTIFACT_WORKSPACE]`n"+($contexts -join "`n`n")+"`n[/MULTI_ARTIFACT_WORKSPACE]`nBandingkan dan jawab hanya dari evidence artifact di atas.")}
}
function Invoke-MenuUpload {
 while($true){Write-Host '';Write-Host 'Upload File R13.45' -ForegroundColor Cyan;Write-Host '[1] Single file';if($script:FolderUploadEnabled){Write-Host '[2] Folder/project aman (ZIP sementara)'};Write-Host '[3] Recent artifacts';Write-Host '[4] Upload private session';Write-Host '[5] Clear temporary ZIP';if($script:FolderUploadEnabled){Write-Host '[6] Multi-file queue'};Write-Host '[0] Kembali';$pick=Read-Host 'Pilih'
  if($pick -eq '0'){return @{ok=$false}}
  if($pick -eq '1' -or $pick -eq '4'){$path=Read-Host 'Masukkan/drag path file';$q=Read-Host 'Pertanyaan untuk file';if([string]::IsNullOrWhiteSpace($q)){$q='Analisis file ini.'};$r=Invoke-MultipartUpload -Path $path.Trim('"') -Question $q -PrivateMode:($pick -eq '4');if($r.ok){return $r}else{Write-Host $r.message -ForegroundColor Red}}
  elseif($pick -eq '2' -and $script:FolderUploadEnabled){$folder=Read-Host 'Path folder/project';$zip=New-SafeProjectArchive -Folder $folder.Trim('"');if($zip){$r=Invoke-MultipartUpload -Path $zip -Question 'Analisis manifest project ini secara aman.';Remove-Item $zip -Force -ErrorAction SilentlyContinue;if($r.ok){return $r}else{Write-Host $r.message -ForegroundColor Red}}}
  elseif($pick -eq '3'){try{$items=Invoke-RestMethod -Uri "$BaseUrl/api/upload/artifacts?limit=20";($items.artifacts|Select-Object id,name,parser,status,created_at|Format-Table|Out-String)|Write-Host}catch{Write-Host $_.Exception.Message -ForegroundColor Red};Read-Host 'Enter untuk kembali'|Out-Null}
  elseif($pick -eq '5'){Get-ChildItem ([IO.Path]::GetTempPath()) -Filter 'nusamind-*.zip' -ErrorAction SilentlyContinue|Remove-Item -Force;Write-Host 'Temporary ZIP dibersihkan.' -ForegroundColor Green}
  elseif($pick -eq '6' -and $script:FolderUploadEnabled){$r=Invoke-MultiFileQueue;if($r.ok){return $r}else{Write-Host $r.message -ForegroundColor Red}}
  else{Write-Host 'Pilihan tidak tersedia.' -ForegroundColor Yellow}
 }
}
function Show-SecurityMenu {
 while($true){
  Write-Host '';Write-Host 'Security Center R13.45' -ForegroundColor Cyan
  Write-Host '[1] Status';Write-Host '[2] Audit events';Write-Host '[3] Quarantine';Write-Host '[4] Desktop status';Write-Host '[5] Permission tokens';Write-Host '[6] Emergency stop';Write-Host '[7] Replay audit';Write-Host '[8] Repository threat scan';Write-Host '[9] SQLite read-only inspector';Write-Host '[0] Kembali'
  $p=Read-Host 'Pilih';if($p -eq '0'){return}
  $headers=@{};if($env:DESKTOP_CONTROL_TOKEN){$headers['x-desktop-token']=$env:DESKTOP_CONTROL_TOKEN}
  try{
   if($p -eq '1'){$r=Invoke-RestMethod "$BaseUrl/api/security/status";($r|ConvertTo-Json -Depth 8)|Write-Host}
   elseif($p -eq '2'){$r=Invoke-RestMethod "$BaseUrl/api/security/events?limit=30" -Headers $headers;($r.events|Format-Table|Out-String)|Write-Host}
   elseif($p -eq '3'){$r=Invoke-RestMethod "$BaseUrl/api/security/quarantine" -Headers $headers;($r.items|Format-Table|Out-String)|Write-Host}
   elseif($p -eq '4'){Show-DesktopResult (Invoke-DesktopRequest @{action='status'})}
   elseif($p -eq '5'){$r=Invoke-RestMethod "$BaseUrl/api/security/permissions?limit=50" -Headers $headers;($r.tokens|Format-Table|Out-String)|Write-Host}
   elseif($p -eq '6'){$ok=Read-Host 'Hentikan semua task aktif? ketik Y';if($ok -match '^(y|yes|ya)$'){$r=Invoke-RestMethod "$BaseUrl/api/security/emergency" -Method Post -Headers $headers -ContentType 'application/json' -Body '{}';($r|ConvertTo-Json -Depth 8)|Write-Host}}
   elseif($p -eq '7'){$r=Invoke-RestMethod "$BaseUrl/api/security/replay?limit=30" -Headers $headers;($r.replays|Format-Table|Out-String)|Write-Host}
   elseif($p -eq '8'){$folder=(Read-Host 'Folder repository').Trim('"');$payload=@{path=$folder}|ConvertTo-Json;$r=Invoke-RestMethod "$BaseUrl/api/security/repo-scan" -Method Post -Headers $headers -ContentType 'application/json' -Body $payload;($r|ConvertTo-Json -Depth 10)|Write-Host}
   elseif($p -eq '9'){$id=Read-Host 'Artifact ID SQLite';$query=Read-Host 'SELECT/EXPLAIN (kosong untuk schema)';$payload=@{artifactId=$id;query=$query;rowLimit=100}|ConvertTo-Json;$r=Invoke-RestMethod "$BaseUrl/api/artifact/sqlite" -Method Post -Headers $headers -ContentType 'application/json' -Body $payload;($r|ConvertTo-Json -Depth 12)|Write-Host}
   else{Write-Host 'Pilihan tidak tersedia.' -ForegroundColor Yellow}
  }catch{Write-Host $_.Exception.Message -ForegroundColor Red}
  Read-Host 'Enter untuk kembali'|Out-Null
 }
}
function Format-CliAnswer {param([string]$Text,[string]$Question='') if($Question -match '(?i)(format|gunakan|pakai|tampilkan).{0,24}latex|latex.{0,24}(format|gunakan|pakai|tampilkan)'){return $Text.Trim()} $x=$Text -replace '\$\$','' -replace '\\frac\{([^{}]+)\}\{([^{}]+)\}','($1)/($2)' -replace '\\sqrt\{([^{}]+)\}','√($1)' -replace '\\(times|cdot)',' × ' -replace '\\div',' ÷ ' -replace '\\leq?','≤' -replace '\\geq?','≥' -replace '\\neq','≠' -replace '\\text\{([^{}]+)\}','$1' -replace '\\left|\\right','' -replace '\\[A-Za-z]+','';return $x.Trim()}
$script:MenuRegistry=[ordered]@{'1'='Select-IntelligenceMenu';'2'='Select-ChatModeMenu';'4'='Show-VersionMenu';'5'='Invoke-MenuUpload';'7'='Select-ReligionMenu';'8'='Show-DisclaimerMenu';'9'='Show-SecurityMenu';'10'='Select-AnswerFormatMenu';'11'='Show-KnowledgeCenter'}
function Test-MenuRegistry {foreach($k in $script:MenuRegistry.Keys){$h=$script:MenuRegistry[$k];if(-not (Get-Command $h -ErrorAction SilentlyContinue)){throw "Menu $k handler $h tidak tersedia."}}}
Test-MenuRegistry

$PendingMessage = $null
$menuResult = Show-PreChatMenu
if ($menuResult.exit) { exit }
if ($menuResult.message) { $PendingMessage = $menuResult.message }
Show-Header

while ($true) {
  if ($PendingMessage) { $userInput=$PendingMessage; $PendingMessage=$null; Write-Host "You: [file dari menu]" -ForegroundColor Green } else { Write-Host "You: " -NoNewline -ForegroundColor Green; $userInput = Read-Host }

  if ($userInput -eq "exit" -or $userInput -eq "quit") {
    Write-Host ""
    Write-Host "Chat selesai." -ForegroundColor Yellow
    break
  }

  if ([string]::IsNullOrWhiteSpace($userInput)) {
    continue
  }

  if ($userInput -eq "/mode") { Select-ChatModeMenu; Show-Header; continue }
  if ($userInput -eq "/format") { Select-AnswerFormatMenu; Show-Header; continue }
  if ($userInput -eq "/knowledge" -or $userInput -eq "/knowledge center") { Show-KnowledgeCenter; Show-Header; continue }
  if ($userInput -eq "/ml status") { Show-MlStatus; continue }
  if ($userInput -like "/ml analyze*") { Invoke-MlAnalyze ($userInput.Substring(11).Trim()); continue }
  if ($userInput -eq "/menu") { $menuResult=Show-PreChatMenu; if($menuResult.exit){break}; if($menuResult.message){$userInput=$menuResult.message}else{Show-Header;continue} }
  if (Handle-DesktopCommand -InputLine $userInput) { continue }
  if (Try-NaturalAction -InputLine $userInput) { continue }

  if ($userInput -eq "/help") {
    Show-LocalHelp
    continue
  }

  if ($userInput -eq "/version" -or $userInput -eq "/profile") {
    Write-Host ""
    Write-Host "NusaMind AI CLI $CliVersion" -ForegroundColor Cyan
    Write-Host "Profile    : $ProfileName" -ForegroundColor Gray
    Write-Host "Mode       : $Mode" -ForegroundColor Gray
    Write-Host "Level      : $IntelligenceLevel" -ForegroundColor Gray
    Write-Host "AnswerMode : $AnswerMode | Format: $script:AnswerFormat" -ForegroundColor Gray
    Write-Host "Session    : $SessionId" -ForegroundColor Gray
    Write-Host "BaseUrl    : $BaseUrl" -ForegroundColor Gray
    Write-Host ""
    continue
  }

  if ($userInput -eq "/new") {
    $SessionId = New-SessionId
    Write-Host "Session baru: $SessionId" -ForegroundColor Yellow
    continue
  }

  if ($userInput -like "/load *") {
    $target = $userInput.Substring(6).Trim()

    if ($target.Length -gt 0) {
      $SessionId = $target
      Write-Host "Session aktif diganti: $SessionId" -ForegroundColor Yellow
    } else {
      Write-Host "Masukkan session id. Contoh: /load cli-rafi" -ForegroundColor Yellow
    }

    continue
  }

  if ($userInput -like "/level *") {
    $targetLevel = $userInput.Substring(7).Trim().ToLower()

    if ($targetLevel -eq "deep" -or $targetLevel -eq "thingking") {
      $targetLevel = "thinking"
    }

    if (@("instant", "ordinary", "medium", "high", "thinking") -contains $targetLevel) {
      $IntelligenceLevel = $targetLevel
      Write-Host "Level aktif: $IntelligenceLevel" -ForegroundColor Yellow
    } else {
      Write-Host "Level valid: instant, ordinary, medium, high, thinking" -ForegroundColor Yellow
    }

    continue
  }

  if ($userInput -like "/find *") {
    Find-LocalFile -Pattern ($userInput.Substring(6).Trim())
    continue
  }

  if ($userInput -eq "/upload") {
    Write-Host 'Contoh: /upload "C:\Users\Nama\Downloads\file.csv" analisis file ini' -ForegroundColor Yellow
    Write-Host 'Tips: drag file dari File Explorer ke terminal setelah /upload' -ForegroundColor Yellow
    continue
  }

  if ($userInput -eq "/uploadfolder") {
    Write-Host 'Contoh: /uploadfolder "C:\Users\Nama\Downloads\folder" analisis folder ini' -ForegroundColor Yellow
    continue
  }

  $messageToSend = $userInput

  if ($userInput -like "/uploadfolder *") {
    $arg = Split-CommandArgument -InputLine $userInput -CommandName "/uploadfolder" -DefaultQuestion "Analisis folder ini secara ringkas dan jawab sesuai konteksnya."
    $built = Build-FolderUploadMessage -Path $arg.path -Question $arg.question

    if (!$built.ok) {
      Write-Host $built.message -ForegroundColor Yellow
      continue
    }

    $messageToSend = $built.message
    Write-Host "Folder masuk konteks: $($arg.path)" -ForegroundColor Yellow
  } elseif ($userInput -like "/upload *") {
    $arg = Split-CommandArgument -InputLine $userInput -CommandName "/upload" -DefaultQuestion "Analisis file ini dan jawab sesuai konteksnya."
    $built = Build-FileUploadMessage -Path $arg.path -Question $arg.question

    if (!$built.ok) {
      Write-Host $built.message -ForegroundColor Yellow
      continue
    }

    $messageToSend = $built.message
    Write-Host "File masuk konteks: $($arg.path)" -ForegroundColor Yellow
  }

  Write-Host ""
  Write-Host "NusaMind AI:" -ForegroundColor Cyan

  $answer = Send-NusaMindMessage -Message $messageToSend -Mode $Mode -SessionId $SessionId -BaseUrl $BaseUrl -IntelligenceLevel $IntelligenceLevel -ChatMode $ChatMode

  if ($answer -like "ERROR_CLI_REQUEST:*") {
    Write-Host $answer -ForegroundColor Red
    Write-Host ""
    Write-Host ('Pastikan server Next.js sudah jalan di ' + $BaseUrl) -ForegroundColor Yellow
    Write-Host 'Cek terminal server: npm run dev' -ForegroundColor Yellow
  } else {
    Write-Host (Format-CliAnswer $answer $userInput)
  }

  Write-Host ""
}
