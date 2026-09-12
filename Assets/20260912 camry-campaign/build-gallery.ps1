$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$template=[IO.File]::ReadAllText((Join-Path $root 'gallery-template.html'))
$log=Get-Content -LiteralPath (Join-Path $root 'generation-log.json') -Raw | ConvertFrom-Json
foreach($isRoot in @($true,$false)) {
  $prefix=if($isRoot){'Assets/20260912%20camry-campaign/'}else{''}
  $phases=@($log.phases | ForEach-Object { @{phase=$_.phase;title=$_.title;prompt=$_.prompt;file=$_.file;input=$_.input;src=($prefix+$_.file)} })
  foreach($phase in $phases){if(-not [IO.File]::Exists((Join-Path $root $phase.file))){throw "Missing $($phase.file)"}}
  if(-not [IO.File]::Exists((Join-Path $root 'final_8k.png'))){throw 'Missing final_8k.png'}
  $payload=@{phases=$phases;final=($prefix+'final_8k.png');log=$log} | ConvertTo-Json -Depth 15 -Compress
  $html=$template.Replace('__PAYLOAD__',$payload)
  $output=if($isRoot){Join-Path (Split-Path (Split-Path $root -Parent) -Parent) '20260912 camry-campaign.html'}else{Join-Path $root 'campaign-gallery.html'}
  [IO.File]::WriteAllText($output,$html,[Text.UTF8Encoding]::new($false))
  Write-Output "Created $output ($([Text.Encoding]::UTF8.GetByteCount($html)) bytes)."
}
