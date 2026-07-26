param(
    [string]$RepositoryUrl = "https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH.git"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $Root
try {
    if (Test-Path ".git") {
        throw "Folder ini sudah memiliki .git. Gunakan folder hasil ekstrak yang bersih."
    }

    git init
    git branch -M main
    git add .
    git commit -m "feat: publish NusaMind Zenith N1.2"
    if ($LASTEXITCODE -ne 0) { throw "git commit gagal" }

    $gh = Get-Command gh -ErrorAction SilentlyContinue
    if ($gh) {
        gh auth status 2>$null
        if ($LASTEXITCODE -eq 0) {
            gh repo create muhrafi-fsdev/NUSAMIND-ZENITH --public --source . --remote origin --push
            if ($LASTEXITCODE -eq 0) {
                Write-Host "NusaMind Zenith N1.2 berhasil dibuat dan diunggah." -ForegroundColor Green
                exit 0
            }
        }
    }

    git remote add origin $RepositoryUrl
    git push -u origin main
    if ($LASTEXITCODE -ne 0) {
        throw "Push gagal. Buat repository publik kosong NUSAMIND-ZENITH di GitHub, lalu jalankan: git push -u origin main"
    }
    Write-Host "NusaMind Zenith N1.2 berhasil diunggah." -ForegroundColor Green
}
finally {
    Pop-Location
}
