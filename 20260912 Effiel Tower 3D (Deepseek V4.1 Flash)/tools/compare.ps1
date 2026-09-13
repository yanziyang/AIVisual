param(
  [string]$RefPath = "C:\MyProjects\TempProject\eiffel\refs\ref_front.jpg",
  [string]$RenderPath = "C:\MyProjects\TempProject\eiffel\out\wb_classic_full.png",
  [string]$OutPath = "C:\MyProjects\TempProject\eiffel\out\overlay.png",
  [int]$Step = 4
)
Add-Type -AssemblyName System.Drawing

$refBmp = [System.Drawing.Bitmap]::FromFile($RefPath)
$renBmp = [System.Drawing.Bitmap]::FromFile($RenderPath)
$W = $refBmp.Width
$H = $refBmp.Height

$rrect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
$rd = $refBmp.LockBits($rrect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$rstride = $rd.Stride
$rbuf = [byte[]]::new($rstride * $H)
[System.Runtime.InteropServices.Marshal]::Copy($rd.Scan0, $rbuf, 0, $rbuf.Length)
$refBmp.UnlockBits($rd)

$nd = $renBmp.LockBits($rrect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$nstride = $nd.Stride
$nbuf = [byte[]]::new($nstride * $H)
[System.Runtime.InteropServices.Marshal]::Copy($nd.Scan0, $nbuf, 0, $nbuf.Length)
$renBmp.UnlockBits($nd)

$outBmp = New-Object System.Drawing.Bitmap($W, $H, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$orect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
$od = $outBmp.LockBits($orect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$ostride = $od.Stride
$obuf = [byte[]]::new($ostride * $H)

$rows = New-Object System.Collections.Generic.List[string]
$refTop = -1; $refBot = -1; $renTop = -1; $renBot = -1
for ($y = 0; $y -lt $H; $y++) {
  $ro = $y * $rstride
  $oo = $y * $ostride
  for ($x = 0; $x -lt $W; $x++) {
    $i = $ro + $x * 3
    $j = $oo + $x * 3
    $obuf[$j] = [byte]([int]$rbuf[$i] * 0.40)
    $obuf[$j + 1] = [byte]([int]$rbuf[$i + 1] * 0.40)
    $obuf[$j + 2] = [byte]([int]$rbuf[$i + 2] * 0.40)
  }
  if ($y % $Step -ne 0) { continue }
  $no = $y * $nstride
  $rmin = -1; $rmax = -1; $nmin = -1; $nmax = -1
  for ($x = 0; $x -lt $W; $x++) {
    $i = $ro + $x * 3
    $bb = [int]$rbuf[$i]; $gg = [int]$rbuf[$i + 1]; $rr = [int]$rbuf[$i + 2]
    if ($bb -le ($rr + 8) -and $gg -le ($rr + 6) -and $rr -gt 60) {
      if ($rmin -lt 0) { $rmin = $x }
      $rmax = $x
    }
    $j = $no + $x * 4
    if ($nbuf[$j + 3] -gt 128) {
      if ($nmin -lt 0) { $nmin = $x }
      $nmax = $x
    }
  }
  if ($rmin -ge 0) {
    if ($refTop -lt 0) { $refTop = $y }
    $refBot = $y
    foreach ($xx in @($rmin, $rmax)) {
      $j = $oo + $xx * 3
      $obuf[$j] = 30; $obuf[$j + 1] = 30; $obuf[$j + 2] = 255
    }
  }
  if ($nmin -ge 0) {
    if ($renTop -lt 0) { $renTop = $y }
    $renBot = $y
    foreach ($xx in @($nmin, $nmax)) {
      $j = $oo + $xx * 3
      $obuf[$j] = 30; $obuf[$j + 1] = 255; $obuf[$j + 2] = 30
    }
  }
  if ($y % 64 -eq 0) {
    $rs = 0
    if ($rmin -ge 0) { $rs = $rmax - $rmin + 1 }
    $ns = 0
    if ($nmin -ge 0) { $ns = $nmax - $nmin + 1 }
    $rows.Add(("{0}`t{1}`t{2}" -f $y, $rs, $ns))
  }
}

[System.Runtime.InteropServices.Marshal]::Copy($obuf, 0, $od.Scan0, $obuf.Length)
$outBmp.UnlockBits($od)
$outBmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$outBmp.Dispose(); $refBmp.Dispose(); $renBmp.Dispose()

Write-Output "REF top=$refTop bottom=$refBot  RENDER top=$renTop bottom=$renBot"
Write-Output "row`tref_span`trender_span"
$rows | ForEach-Object { Write-Output $_ }
