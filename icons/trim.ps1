Add-Type -AssemblyName System.Drawing

$files = @("flowdesk-128x128-claro.png", "flowdesk-128x128-escuro.png", "flowdesk-64x64.png", "flowdesk-32x32.png")

foreach ($file in $files) {
    if (-Not (Test-Path $file)) { 
        Write-Host "Nao achou $file"
        continue 
    }

    Write-Host "Processando $file..."
    
    $img = [System.Drawing.Bitmap]::FromFile((Resolve-Path $file).Path)
    
    $minX = $img.Width; $minY = $img.Height; $maxX = 0; $maxY = 0;
    
    for ($y = 0; $y -lt $img.Height; $y++) {
        for ($x = 0; $x -lt $img.Width; $x++) {
            $pixel = $img.GetPixel($x, $y)
            if ($pixel.A -gt 10) { 
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    
    if ($minX -le $maxX -and $minY -le $maxY) {
        $width = $maxX - $minX + 1
        $height = $maxY - $minY + 1
        
        $rect = New-Object System.Drawing.Rectangle($minX, $minY, $width, $height)
        $cropped = $img.Clone($rect, $img.PixelFormat)
        
        $maxDimension = [Math]::Max($width, $height)
        $targetDim = [int]($maxDimension * 1.05)
        $square = New-Object System.Drawing.Bitmap($targetDim, $targetDim)
        
        $g = [System.Drawing.Graphics]::FromImage($square)
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        
        $destX = ($targetDim - $width) / 2
        $destY = ($targetDim - $height) / 2
        
        $g.DrawImage($cropped, [int]$destX, [int]$destY, $width, $height)
        $g.Dispose()
        
        $img.Dispose()
        
        $finalImage = New-Object System.Drawing.Bitmap($square, $img.Width, $img.Height)
        $square.Dispose()
        $cropped.Dispose()
        
        $finalImage.Save("$(Resolve-Path .)\cropped_$file", [System.Drawing.Imaging.ImageFormat]::Png)
        $finalImage.Dispose()
        
        Write-Host "-> Cropped file created cropped_$file"
    } else {
        $img.Dispose()
        Write-Host "-> Imagem está totalmente transparente ou vazia."
    }
}
Write-Host "Finalizado."
