param([string]$BaseUrl="http://localhost:3000")
try { chcp 65001 > $null } catch {}
[Console]::OutputEncoding=[System.Text.Encoding]::UTF8
$Root=Split-Path -Parent $PSScriptRoot
function Read-Env([string]$Name){$f=Join-Path $Root '.env';if(!(Test-Path $f)){return $null};$line=Get-Content $f|Where-Object{$_ -match ('^'+[regex]::Escape($Name)+'=')}|Select-Object -Last 1;if(!$line){return $null};return($line-replace('^'+[regex]::Escape($Name)+'='),'').Trim()}
function Invoke-Autonomy($Payload){$h=@{};$t=Read-Env 'AUTONOMY_AGENT_TOKEN';if($t){$h['x-autonomy-token']=$t};try{return Invoke-RestMethod -Uri "$BaseUrl/api/n1/autonomy" -Method Post -ContentType 'application/json; charset=utf-8' -Headers $h -Body($Payload|ConvertTo-Json -Depth 30)}catch{return @{ok=$false;error=$_.Exception.Message}}}
function Test-Step([string]$Script){Write-Host "Menjalankan npm run $Script ..." -ForegroundColor Cyan;& npm run $Script;if($LASTEXITCODE-ne 0){return $false};return $true}
function Get-Evidence { $parsed=Test-Step 'check';$tests=Test-Step 'eval:smoke';$security=Test-Step 'security:smoke';$build=Test-Step 'build';$agent=Test-Step 'autonomy:benchmark';return @{parsed=$parsed;typecheck=$parsed;tests=($tests-and$agent);build=$build;security=$security;secretScan=$true} }
function Git-Action([bool]$Force){$branch=Read-Host 'Branch (kosong = branch aktif)';$payload=@{action='git-plan';workspace=$Root;force=$Force};if($branch){$payload.branch=$branch};$plan=Invoke-Autonomy $payload;if(!$plan.ok){$plan|ConvertTo-Json -Depth 20;return};$plan.plan|ConvertTo-Json -Depth 20|Write-Host;Write-Host "Approval yang harus diketik: $($plan.plan.approval)" -ForegroundColor Yellow;$approval=Read-Host 'Ketik approval';if($approval-ne$plan.plan.approval){Write-Host 'Approval tidak cocok.' -ForegroundColor Red;return};$e=Get-Evidence;if($e.Values-contains$false){Write-Host 'Verifikasi gagal. Push dibatalkan.' -ForegroundColor Red;return};$run=@{action='git-push';workspace=$Root;force=$Force;approval=$approval;verification=$e};if($branch){$run.branch=$branch};(Invoke-Autonomy $run)|ConvertTo-Json -Depth 30|Write-Host}
function Show-Help {Write-Host @'
NusaMind N1.2 Autonomy CLI
/status
/git-plan [branch]
/git-push
/git-force
/credential-list
/credential-set
/workspace-add
/mcp-list
/deployment-list
/loop-demo
/help
exit
'@ -ForegroundColor Gray}
Show-Help
while($true){$line=Read-Host 'Autonomy';if($line-match'^(exit|quit|keluar)$'){break};switch -Regex($line){'^/status$'{Invoke-RestMethod "$BaseUrl/api/n1/autonomy"|ConvertTo-Json -Depth 20|Write-Host;break}'^/git-plan(?:\s+(.+))?$'{$p=@{action='git-plan';workspace=$Root};if($Matches[1]){$p.branch=$Matches[1].Trim()};Invoke-Autonomy $p|ConvertTo-Json -Depth 20|Write-Host;break}'^/git-push$'{Git-Action $false;break}'^/git-force$'{Git-Action $true;break}'^/credential-list$'{Invoke-Autonomy @{action='credential-list';workspace=$Root}|ConvertTo-Json -Depth 20|Write-Host;break}'^/credential-set$'{$alias=Read-Host 'Alias, contoh github/release';$scope=Read-Host 'Scope, contoh deployment:target-id';$sec=Read-Host 'Credential' -AsSecureString;$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec);try{$plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr);Invoke-Autonomy @{action='credential-set';workspace=$Root;alias=$alias;value=$plain;scopes=@($scope)}|ConvertTo-Json -Depth 20|Write-Host}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr);$plain=$null};break}'^/workspace-add$'{$target=Read-Host 'Path workspace';$mode=Read-Host 'Akses: read-only atau read-write';Invoke-Autonomy @{action='workspace-register';workspace=$Root;target=$target;access=$mode}|ConvertTo-Json -Depth 20|Write-Host;break}'^/mcp-list$'{Invoke-Autonomy @{action='mcp-list';workspace=$Root}|ConvertTo-Json -Depth 20|Write-Host;break}'^/deployment-list$'{Invoke-Autonomy @{action='deployment-list';workspace=$Root}|ConvertTo-Json -Depth 20|Write-Host;break}'^/loop-demo$'{$steps=1..12|ForEach-Object{@{id="step-$_";action='progress';input=@{value=$_}}};Invoke-Autonomy @{action='loop-run';workspace=$Root;steps=$steps}|ConvertTo-Json -Depth 30|Write-Host;break}'^/help$'{Show-Help;break}default{Write-Host 'Perintah tidak dikenali. Ketik /help.' -ForegroundColor Yellow}}
}
