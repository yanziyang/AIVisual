Add-Type -AssemblyName System.Drawing
$su7Root = $PSScriptRoot
$su7RenderRoot = Join-Path $su7Root 'renders'
$su7Canvas = [System.Drawing.Bitmap]::new(1800,1510)
$su7Graphics = [System.Drawing.Graphics]::FromImage($su7Canvas)
$su7Graphics.Clear([System.Drawing.Color]::FromArgb(17,24,32))
$su7Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$su7Graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$su7TitleFont = [System.Drawing.Font]::new('Segoe UI',26,[System.Drawing.FontStyle]::Bold)
$su7SmallFont = [System.Drawing.Font]::new('Segoe UI',13)
$su7White = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(235,243,248))
$su7Muted = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(150,172,190))
$su7Graphics.DrawString('XIAOMI SU7 MAX', $su7TitleFont, $su7White, 28, 15)
$su7Graphics.DrawString('Aqua Blue  /  Blender 3.6.23  /  Photo-referenced exterior reconstruction', $su7SmallFont, $su7Muted, 30, 62)
$su7Views = @(
    @('front_hero','Front three-quarter'),
    @('rear_hero','Rear three-quarter'),
    @('side','Side profile'),
    @('front','Front'),
    @('rear','Rear'),
    @('wheel','Wheel and brake detail')
)
$su7Manifest = @()
for ($su7Index=0; $su7Index -lt $su7Views.Count; $su7Index++) {
    $su7File = Join-Path $su7RenderRoot ($su7Views[$su7Index][0] + '.png')
    $su7Image = [System.Drawing.Image]::FromFile($su7File)
    $su7Manifest += [PSCustomObject]@{name=$su7Views[$su7Index][0];width=$su7Image.Width;height=$su7Image.Height;bytes=(Get-Item -LiteralPath $su7File).Length}
    $su7Column = $su7Index % 2
    $su7Row = [Math]::Floor($su7Index / 2)
    $su7Left = 24 + $su7Column * 892
    $su7Top = 105 + $su7Row * 463
    $su7Fit = [Math]::Min(860.0/$su7Image.Width,416.0/$su7Image.Height)
    $su7Width = [int]($su7Image.Width*$su7Fit)
    $su7Height = [int]($su7Image.Height*$su7Fit)
    $su7X = [int]($su7Left+(860-$su7Width)/2)
    $su7Y = [int]($su7Top+(416-$su7Height)/2)
    $su7Graphics.DrawImage($su7Image,$su7X,$su7Y,$su7Width,$su7Height)
    $su7Graphics.DrawString($su7Views[$su7Index][1],$su7SmallFont,$su7Muted,[single]$su7Left,[single]($su7Top+424))
    $su7Image.Dispose()
}
$su7Canvas.Save((Join-Path $su7RenderRoot 'inspection_sheet.jpg'),[System.Drawing.Imaging.ImageFormat]::Jpeg)
$su7Manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $su7Root 'render_manifest.json') -Encoding utf8
$su7Graphics.Dispose()
$su7Canvas.Dispose()
$su7TitleFont.Dispose()
$su7SmallFont.Dispose()
$su7White.Dispose()
$su7Muted.Dispose()
$su7Manifest | Format-Table
