param(
  [string]$BaseUrl = "http://localhost:3000"
)

try { chcp 65001 > $null } catch {}
try {
  [Console]::InputEncoding = [System.Text.Encoding]::UTF8
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LastJobId = $null

function Read-EnvValue {
  param([string]$Name)
  $envFile = Join-Path $ProjectRoot ".env"
  if (!(Test-Path $envFile)) { return $null }
  $line = Get-Content $envFile | Where-Object { $_ -match ("^" + [regex]::Escape($Name) + "=") } | Select-Object -Last 1
  if (!$line) { return $null }
  return ($line -replace ("^" + [regex]::Escape($Name) + "="), "").Trim()
}

function Invoke-CodingRequest {
  param([hashtable]$Payload)
  try {
    $headers = @{}
    $token = Read-EnvValue "CODING_AGENT_TOKEN"
    if ([string]::IsNullOrWhiteSpace($token)) { $token = Read-EnvValue "DESKTOP_CONTROL_TOKEN" }
    if (![string]::IsNullOrWhiteSpace($token)) { $headers["x-coding-token"] = $token }
    return Invoke-RestMethod -Uri "$BaseUrl/api/coding" -Method Post -ContentType "application/json; charset=utf-8" -Headers $headers -Body ($Payload | ConvertTo-Json -Depth 20)
  } catch {
    $detail = $_.ErrorDetails.Message
    try {
      $response = $_.Exception.Response
      if ($response -and $response.Content) {
        $bodyText = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if (![string]::IsNullOrWhiteSpace($bodyText)) { $detail = $bodyText }
      }
    } catch {}
    if ([string]::IsNullOrWhiteSpace($detail)) { $detail = $_.Exception.Message }
    try {
      $json = $detail | ConvertFrom-Json
      if ($json.error) {
        $message = [string]$json.error
        if ($json.hint) { $message += "`nSaran: " + [string]$json.hint }
        return @{ ok = $false; error = $message }
      }
    } catch {}
    return @{ ok = $false; error = $detail }
  }
}

function Show-Result {
  param($Result)
  if ($Result.ok -eq $false -or $Result.error) {
    Write-Host ("Coding error: " + $Result.error) -ForegroundColor Red
    return
  }
  if ($Result.job) {
    $script:LastJobId = $Result.job.jobId
    Write-Host "" 
    Write-Host ("Job ID     : " + $Result.job.jobId) -ForegroundColor Cyan
    Write-Host ("Project    : " + $Result.job.projectName) -ForegroundColor Gray
    Write-Host ("Framework  : " + $Result.job.framework) -ForegroundColor Gray
    Write-Host ("Target      : " + $Result.job.targetPath) -ForegroundColor Gray
    Write-Host ("Status      : " + $Result.job.status) -ForegroundColor Gray
    Write-Host ("File        : " + $Result.job.files.Count) -ForegroundColor Gray
    if ($Result.job.devUrl) { Write-Host ("URL         : " + $Result.job.devUrl) -ForegroundColor Green }
    if ($Result.job.summary) { Write-Host ("Ringkasan   : " + $Result.job.summary) -ForegroundColor Gray }
  }
  if ($Result.server) {
    Write-Host ("Server aktif: " + $Result.server.url) -ForegroundColor Green
  }
  if ($Result.warnings) {
    foreach ($warning in $Result.warnings) { Write-Host ("Peringatan: " + $warning) -ForegroundColor Yellow }
  }
  if ($Result.success -eq $true) { Write-Host "Build berhasil." -ForegroundColor Green }
  if ($Result.success -eq $false) { Write-Host "Build belum berhasil. Cek log job." -ForegroundColor Yellow }
  if (!$Result.job -and !$Result.server -and $null -eq $Result.success) {
    Write-Host ($Result | ConvertTo-Json -Depth 20) -ForegroundColor Gray
  }
}

function Confirm-Action {
  param([string]$Message)
  $answer = Read-Host $Message
  return $answer -match '^(y|yes|ya)$'
}

function Extract-TargetPath {
  param([string]$Text)
  $value = $Text.Trim()
  if ($value -match '"([A-Za-z]:\\[^\"]+)"') { return $Matches[1].Trim() }
  if ($value -match "'([A-Za-z]:\\[^']+)'") { return $Matches[1].Trim() }
  if ($value -match '(?i)(?:simpan\s+di|target(?:nya)?|folder|path|di)\s+([A-Za-z]:\\.*?)(?=\s+(?:(?:lalu|dan)\s+)?(?:jalankan|run|buka|buat|dengan|menggunakan)\b|$)') {
    return $Matches[1].Trim().TrimEnd('.', ',', ';')
  }
  if ($value -match '([A-Za-z]:\\[^\r\n]+)$') { return $Matches[1].Trim().TrimEnd('.', ',', ';') }
  return ""
}

function Parse-PathAndPrompt {
  param([string]$Text)
  $trimmed = $Text.Trim()
  if ($trimmed -match '^"([^"]+)"\s+(.+)$') { return @{ path = $Matches[1]; prompt = $Matches[2] } }
  if ($trimmed -match "^'([^']+)'\s+(.+)$") { return @{ path = $Matches[1]; prompt = $Matches[2] } }
  $path = Extract-TargetPath $trimmed
  return @{ path = $path; prompt = $trimmed }
}

function Show-Help {
  Write-Host "" 
  Write-Host "NusaMind Apex Coding Agent R13.45" -ForegroundColor Cyan
  Write-Host "" 
  Write-Host "/coding status" -ForegroundColor Gray
  Write-Host '/project-plan "C:\laragon\www\nusamind-workspace\landing" buat landing page modern' -ForegroundColor Gray
  Write-Host '/project-create "C:\laragon\www\nusamind-workspace\landing" buat landing page modern lalu jalankan' -ForegroundColor Gray
  Write-Host "/project-build JOB_ID" -ForegroundColor Gray
  Write-Host "/project-start JOB_ID [port]" -ForegroundColor Gray
  Write-Host "/project-stop JOB_ID" -ForegroundColor Gray
  Write-Host "/project-rollback JOB_ID" -ForegroundColor Gray
  Write-Host "/project-job JOB_ID" -ForegroundColor Gray
  Write-Host "/project-logs" -ForegroundColor Gray
  Write-Host "" 
  Write-Host "Natural chat:" -ForegroundColor Cyan
  Write-Host 'Buat landing page jasa website, simpan di "C:\laragon\www\nusamind-workspace\landing-jasa" lalu jalankan' -ForegroundColor Gray
  Write-Host "" 
  Write-Host "Ketik exit untuk keluar." -ForegroundColor Yellow
  Write-Host "" 
}

function Handle-Command {
  param([string]$InputLine)
  $text = $InputLine.Trim()
  if ($text -eq "/help") { Show-Help; return $true }
  if ($text -eq "/coding status") { Show-Result (Invoke-CodingRequest @{ action = "status" }); return $true }
  if ($text -eq "/project-logs") { Show-Result (Invoke-CodingRequest @{ action = "logs"; limit = 50 }); return $true }
  if ($text -match '^/project-job\s+(.+)$') { Show-Result (Invoke-CodingRequest @{ action = "job"; jobId = $Matches[1].Trim() }); return $true }
  if ($text -match '^/project-build\s+(.+)$') {
    $id = $Matches[1].Trim()
    if (Confirm-Action "Install dependency dan build project? ketik Y") { Show-Result (Invoke-CodingRequest @{ action = "build"; jobId = $id; confirmed = $true; install = $true; autoRepair = $true }) }
    return $true
  }
  if ($text -match '^/project-start\s+(\S+)(?:\s+(\d+))?$') {
    $id = $Matches[1]
    $port = if ($Matches[2]) { [int]$Matches[2] } else { 3100 }
    if (Confirm-Action "Jalankan dev server pada port $port? ketik Y") { Show-Result (Invoke-CodingRequest @{ action = "start"; jobId = $id; confirmed = $true; port = $port }) }
    return $true
  }
  if ($text -match '^/project-stop\s+(.+)$') {
    $id = $Matches[1].Trim()
    if (Confirm-Action "Hentikan dev server project? ketik Y") { Show-Result (Invoke-CodingRequest @{ action = "stop"; jobId = $id; confirmed = $true }) }
    return $true
  }
  if ($text -match '^/project-rollback\s+(.+)$') {
    $id = $Matches[1].Trim()
    if (Confirm-Action "Hapus seluruh project yang dibuat oleh job ini? ketik Y") { Show-Result (Invoke-CodingRequest @{ action = "rollback"; jobId = $id; confirmed = $true }) }
    return $true
  }
  if ($text -like "/project-plan *") {
    $arg = Parse-PathAndPrompt ($text.Substring(14))
    $payload = @{ action = "plan"; prompt = $arg.prompt }
    if (![string]::IsNullOrWhiteSpace($arg.path)) { $payload.targetPath = $arg.path }
    Show-Result (Invoke-CodingRequest $payload)
    return $true
  }
  if ($text -like "/project-create *") {
    $arg = Parse-PathAndPrompt ($text.Substring(16))
    $start = $arg.prompt -match '(?i)(lalu|dan)\s+(jalankan|run|buka)'
    Write-Host "" 
    Write-Host ("Target: " + $(if ($arg.path) { $arg.path } else { "workspace default" })) -ForegroundColor Gray
    Write-Host ("Permintaan: " + $arg.prompt) -ForegroundColor Gray
    if (Confirm-Action "Apex akan membuat file, install dependency, build, dan mencoba memperbaiki error. Lanjutkan? ketik Y") {
      $payload = @{ action = "create"; prompt = $arg.prompt; confirmed = $true; install = $true; build = $true; start = $start; port = 3100 }
      if (![string]::IsNullOrWhiteSpace($arg.path)) { $payload.targetPath = $arg.path }
      Show-Result (Invoke-CodingRequest $payload)
    }
    return $true
  }
  return $false
}

function Try-NaturalCoding {
  param([string]$InputLine)
  $text = $InputLine.Trim()
  if ($text -notmatch '(?i)\b(buat|bangun|generate|rancang)\b.*\b(landing|website|web|aplikasi|project|proyek)\b') { return $false }
  $target = Extract-TargetPath $text
  $start = $text -match '(?i)(lalu|dan)\s+(jalankan|run|buka)'
  Write-Host "" 
  Write-Host "Permintaan coding terdeteksi." -ForegroundColor Cyan
  if ($target) { Write-Host ("Target: " + $target) -ForegroundColor Gray }
  if (Confirm-Action "Buat project dan eksekusi secara supervised? ketik Y") {
    $payload = @{ action = "create"; prompt = $text; confirmed = $true; install = $true; build = $true; start = $start; port = 3100 }
    if ($target) { $payload.targetPath = $target }
    Show-Result (Invoke-CodingRequest $payload)
  }
  return $true
}

Clear-Host
Show-Help
while ($true) {
  Write-Host "You: " -NoNewline -ForegroundColor Green
  $inputLine = Read-Host
  if ($inputLine -match '^(exit|quit|keluar)$') { break }
  if ([string]::IsNullOrWhiteSpace($inputLine)) { continue }
  if (Handle-Command $inputLine) { continue }
  if (Try-NaturalCoding $inputLine) { continue }
  Write-Host "Perintah belum dikenali. Ketik /help." -ForegroundColor Yellow
}
