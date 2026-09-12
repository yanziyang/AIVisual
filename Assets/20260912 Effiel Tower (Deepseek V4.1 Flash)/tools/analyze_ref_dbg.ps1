param(
  [string]$Path = "C:\MyProjects\TempProject\eiffel\refs\ref_front.jpg",
  [int]$Step = 4
)
Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile($Path)
$W = $bmp.Width; $H = $bmp.Height
Write-Output "SIZE $W x $H"
$rect = New-Object System.Drawing.Rectangle 0,0,$W,$H
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $H)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$bmp.UnlockBits($data)

function IsSky([int]$b,[int]$g,[int]$r) { return ($b -gt ($r + 8)) }
function IsFoliage([int]$b,[int]$g,[int]$r) { return ($g -gt ($r + 6)) }
function IsTower([int]$b,[int]$g,[int]$r) {
  if (IsSky $b $g $r) { return $false }
  if (IsFoliage $b $g $r) { return $false }
  return ($r -gt 60)
}

$yy=1600; $ii=$yy*$stride+960*3
Write-Output ("DBG b,g,r=" + $bytes[$ii] + "," + $bytes[$ii+1] + "," + $bytes[$ii+2])
$b1=$bytes[$ii]; $g1=$bytes[$ii+1]; $r1=$bytes[$ii+2]
Write-Output ("DBG IsTower=" + (IsTower $b1 $g1 $r1))
Write-Output ("DBG IsSky=" + (IsSky $b1 $g1 $r1))
Write-Output ("DBG IsFoliage=" + (IsFoliage $b1 $g1 $r1))
for ($y = 0; $y -lt $H; $y += $Step) {
  $min = -1; $max = -1; $count = 0
  for ($x = 0; $x -lt $W; $x++) {
    $i = $y * $stride + $x * 3
    $b = $bytes[$i]; $g = $bytes[$i+1]; $r = $bytes[$i+2]
    if (IsTower $b $g $r) { if ($min -lt 0) { $min = $x }; $max = $x; $count++ }
  }
  $w = if ($min -ge 0) { $max - $min + 1 } else { 0 }
  Write-Output ("{0}`t{1}`t{2}`t{3}`t{4}" -f $y, $min, $max, $w, $count)
}

