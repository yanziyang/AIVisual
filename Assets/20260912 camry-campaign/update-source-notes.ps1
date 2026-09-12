$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$prompt = [IO.File]::ReadAllText((Join-Path $root 'original-prompt.txt'))
$encoded = [System.Net.WebUtility]::HtmlEncode($prompt)
$sourceUrl = 'https://x.com/Diplomeme/status/2098299916166873371'
$sourceMarkup = '<h3>Original prompt source</h3><p><a href="https://x.com/Diplomeme/status/2098299916166873371" target="_blank" rel="noopener">@Diplomeme on X — original prompt source</a> (source supplied by the user).</p>'
$oldDetails = '<details><summary>Complete initial production prompt</summary><pre id="baseprompt"></pre></details>'
$newDetails = '<details open><summary>Full original user prompt — all 15 phases</summary><pre id="originalprompt">__ORIGINAL_PROMPT__</pre></details><details><summary>Adapted initial image-generation prompt</summary><pre id="baseprompt"></pre></details>'
$oldIntro = 'The fifteen prompts are included under their corresponding images. The initial prompt carries the complete visual specification; later prompts direct focused edits.'
$newIntro = 'The full original user prompt is reproduced below, including all 15 phases and the delivery instruction. The adapted image-generation prompts remain under their corresponding images.'
foreach ($name in @('campaign-gallery.html','build-gallery.ps1')) {
  $path = Join-Path $root $name
  $text = [IO.File]::ReadAllText($path)
  if (-not $text.Contains($oldDetails)) { throw "Expected original prompt block missing from $name" }
  $text = $text.Replace($oldIntro,$newIntro)
  $text = $text.Replace('<h3>Vehicle specification references</h3>',($sourceMarkup + '<h3>Vehicle specification references</h3>'))
  $text = $text.Replace($oldDetails,$newDetails)
  $text = $text.Replace("const phases=data.phases;", "data.log.original_prompt=document.getElementById('originalprompt').textContent;data.log.prompt_source='$sourceUrl';const phases=data.phases;")
  if ($name -eq 'campaign-gallery.html') {
    $text = $text.Replace('__ORIGINAL_PROMPT__',$encoded)
  } else {
    $line = '$html = $template.Replace(''__PAYLOAD__'',$payload)'
    $replacement = '$originalPrompt = [IO.File]::ReadAllText((Join-Path $root ''original-prompt.txt''))' + "`n" + '$html = $template.Replace(''__PAYLOAD__'',$payload).Replace(''__ORIGINAL_PROMPT__'',[System.Net.WebUtility]::HtmlEncode($originalPrompt))'
    $text = $text.Replace($line,$replacement)
  }
  [IO.File]::WriteAllText($path,$text,[Text.UTF8Encoding]::new($false))
}
foreach ($name in @('generation-log.json','prompts.json')) {
  $path = Join-Path $root $name
  $log = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
  $log | Add-Member -NotePropertyName original_prompt -NotePropertyValue $prompt -Force
  $log | Add-Member -NotePropertyName prompt_source -NotePropertyValue $sourceUrl -Force
  [IO.File]::WriteAllText($path,($log | ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false))
}
$page = [IO.File]::ReadAllText((Join-Path $root 'campaign-gallery.html'))
$match = [regex]::Match($page,'<pre id="originalprompt">([\s\S]*?)</pre>')
$roundTrip = [System.Net.WebUtility]::HtmlDecode($match.Groups[1].Value)
if ($roundTrip -cne $prompt) { throw 'Full prompt verification failed' }
if ([regex]::Matches($roundTrip,'⸻ PHASE \d+').Count -ne 15) { throw 'Expected 15 phases' }
if (-not $page.Contains('href="'+$sourceUrl+'"')) { throw 'Missing source hyperlink' }
if ([regex]::Matches($page,'data:image/png;base64,').Count -ne 16) { throw 'Embedded image count changed' }
Write-Output 'Verified: full original prompt, all 15 phases, source hyperlink, and all 16 embedded images.'
