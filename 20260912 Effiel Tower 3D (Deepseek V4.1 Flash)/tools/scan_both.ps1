param(
  [string]$RefPath = "C:\MyProjects\TempProject\eiffel\refs\ref_front.jpg",
  [string]$RenderPath = "C:\MyProjects\TempProject\eiffel\out\wb_classic_full.png",
  [string]$OutTsv = "C:\MyProjects\TempProject\eiffel\out\spans.tsv",
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
$lines = New-Object System.Collections.Generic.List[string]
for ($y = 0; $y -lt $H; $y += $Step) {
  $ro = $y * $rstride
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
  $rs = 0; if ($rmin -ge 0) { $rs = $rmax - $rmin + 1 }
  $ns = 0; if ($nmin -ge 0) { $ns = $nmax - $nmin + 1 }
  $rc = 0.0; if ($rmin -ge 0) { $rc = 0.5 * ($rmin + $rmax) }
  $nc = 0.0; if ($nmin -ge 0) { $nc = 0.5 * ($nmin + $nmax) }
  $lines.Add(("{0}`t{1}`t{2}`t{3:N1}`t{4:N1}" -f $y, $rs, $ns, $rc, $nc))
}
$refBmp.Dispose(); $renBmp.Dispose()
$lines | Set-Content -Path $OutTsv -Encoding utf8
Write-Output "WROTE $OutTsv ($($lines.Count) rows)"
