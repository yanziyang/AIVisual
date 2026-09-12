param(
  [string]$Url,
  [string]$Out,
  [int]$WaitSec = 25
)

$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$proc = Start-Process -FilePath $edge -PassThru -NoNewWindow -ArgumentList @(
  '--headless', '--enable-unsafe-swiftshader', '--no-sandbox',
  '--remote-debugging-port=9333', '--window-size=1280,800', 'about:blank'
)
Start-Sleep -Seconds 3

$wsUrl = $null
for ($i = 0; $i -lt 20 -and -not $wsUrl; $i++) {
  try {
    $list = Invoke-RestMethod "http://127.0.0.1:9333/json/list" -TimeoutSec 3
    $t = $list | Where-Object { $_.type -eq 'page' } | Select-Object -First 1
    if ($t) { $wsUrl = $t.webSocketDebuggerUrl }
  } catch { }
  if (-not $wsUrl) { Start-Sleep -Milliseconds 500 }
}
if (-not $wsUrl) { $proc.Kill(); throw "no debug target" }

$cli = [System.Net.WebSockets.ClientWebSocket]::new()
$cli.ConnectAsync([uri]$wsUrl, [Threading.CancellationToken]::None).Wait()

function Send-Cmd([int]$id, [string]$method, $params) {
  $msg = @{ id = $id; method = $method }
  if ($params) { $msg.params = $params }
  $json = $msg | ConvertTo-Json -Depth 12 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $seg = [ArraySegment[byte]]::new($bytes)
  $cli.SendAsync($seg, [Net.WebSockets.WebSocketMessageType]::Text, $true,
                 [Threading.CancellationToken]::None).Wait()
}

function Receive-Response([int]$wantId) {
  $buf = New-Object byte[] 8192
  $acc = New-Object System.Text.StringBuilder
  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline) {
    $seg = [ArraySegment[byte]]::new($buf)
    $res = $cli.ReceiveAsync($seg, [Threading.CancellationToken]::None).Result
    if ($res.Count -gt 0) {
      [void]$acc.Append([Text.Encoding]::UTF8.GetString($buf, 0, $res.Count))
    }
    if ($res.EndOfMessage) {
      $text = $acc.ToString()
      $acc.Clear()
      try { $obj = $text | ConvertFrom-Json } catch { continue }
      if ($obj.id -eq $wantId) { return $obj }
    }
  }
  throw "timeout waiting for response $wantId"
}

Send-Cmd 1 'Page.enable' $null
[void](Receive-Response 1)
Send-Cmd 2 'Page.navigate' @{ url = $Url }
[void](Receive-Response 2)
Start-Sleep -Seconds $WaitSec
Send-Cmd 3 'Page.captureScreenshot' @{ format = 'png' }
$resp = Receive-Response 3
[IO.File]::WriteAllBytes($Out, [Convert]::FromBase64String($resp.result.data))
Write-Output ("WROTE {0} ({1} bytes)" -f $Out, (Get-Item $Out).Length)
$cli.Dispose()
$proc.Kill()
