param(
  [string]$BaseUrl = "http://localhost:3000"
)

try { chcp 65001 | Out-Null } catch {}
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Post-Utf8Json {
  param([string]$Url, [hashtable]$Payload)
  $jsonBody = $Payload | ConvertTo-Json -Depth 12
  $client = [System.Net.Http.HttpClient]::new()
  try {
    $content = [System.Net.Http.StringContent]::new($jsonBody, [System.Text.Encoding]::UTF8, "application/json")
    $response = $client.PostAsync($Url, $content).GetAwaiter().GetResult()
    $bytes = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    return $text | ConvertFrom-Json
  }
  finally { $client.Dispose() }
}

$payload = @{
  message = "kasih saya ayat tentang sabar beserta ayatnya"
  sessionId = "cli-quran-test"
  mode = "quran"
  intelligenceLevel = "medium"
}

$result = Post-Utf8Json -Url "$BaseUrl/api/chat-json" -Payload $payload
[Console]::WriteLine([string]$result.answer)
