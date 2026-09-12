param(
  [string]$Path = "C:\MyProjects\TempProject\eiffel\refs\ref_front.jpg",
  [int]$Step = 8
)
Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile($Path)
$W = $bmp.Width
$H = $bmp.Height
Write-Output "SIZE $W x $H"
$rect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$stride = $data.Stride
$buf = New-Object byte[] ($stride * $H)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $buf.Length)
$bmp.UnlockBits($data)

$out = New-Object System.Collections.Generic.List[string]
for ($py = 0; $py -lt $H; $py += $Step) {
  $rowBase = $py * $stride
  $xmin = -1
  $xmax = -1
  $cnt = 0
  for ($px = 0; $px -lt $W; $px++) {
    $o = $rowBase + $px * 3
    $bb = [int]$buf[$o]
    $gg = [int]$buf[$o + 1]
    $rr = [int]$buf[$o + 2]
    $isTower = $false
    if ($bb -le ($rr + 8) -and $gg -le ($rr + 6) -and $rr -gt 60) { $isTower = $true }
    if ($isTower) {
      if ($xmin -lt 0) { $xmin = $px }
      $xmax = $px
      $cnt++
    }
  }
  $wd = 0
  if ($xmin -ge 0) { $wd = $xmax - $xmin + 1 }
  $out.Add(("{0}`t{1}`t{2}`t{3}`t{4}" -f $py, $xmin, $xmax, $wd, $cnt))
}
$out | ForEach-Object { Write-Output $_ }
