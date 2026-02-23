param(
    [string]$BackendBaseUrl = "https://pothole-detection-system-4.onrender.com",
    [string]$ImagePath = "images.jpeg",
    [int]$IntervalMs = 700,
    [Nullable[double]]$Lat = $null,
    [Nullable[double]]$Lng = $null,
    [string]$OutDir = "logs",
    [int]$MaxIterations = 0
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ImagePath)) {
    throw "Image file not found: $ImagePath"
}

if ($IntervalMs -lt 100) {
    throw "IntervalMs must be >= 100"
}

if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $OutDir "detection-live-$timestamp.jsonl"
$tmpPath = Join-Path $OutDir "_tmp-live-response.json"
$apiUrl = "$($BackendBaseUrl.TrimEnd('/'))/api/detections/frame"

Write-Host "Live detection logging started"
Write-Host "API: $apiUrl"
Write-Host "Image: $ImagePath"
Write-Host "Interval: ${IntervalMs}ms"
if ($Lat -ne $null -and $Lng -ne $null) {
    Write-Host "Coordinates: lat=$Lat, lng=$Lng"
}
Write-Host "Log file: $logPath"
Write-Host "Press Ctrl+C to stop."

$index = 0
while ($true) {
    if ($MaxIterations -gt 0 -and $index -ge $MaxIterations) {
        break
    }

    $index++
    $requestAt = Get-Date

    $curlArgs = @(
        "-sS",
        "-o", $tmpPath,
        "-w", "%{http_code}",
        "-X", "POST",
        $apiUrl,
        "-F", "frame=@$ImagePath"
    )

    if ($Lat -ne $null) {
        $curlArgs += @("-F", "lat=$Lat")
    }
    if ($Lng -ne $null) {
        $curlArgs += @("-F", "lng=$Lng")
    }

    $httpCode = ""
    $parsed = $null
    $raw = ""
    $parseError = $null

    try {
        $httpCode = (& curl.exe @curlArgs).Trim()

        if (Test-Path $tmpPath) {
            $raw = Get-Content $tmpPath -Raw
        }

        if (-not [string]::IsNullOrWhiteSpace($raw)) {
            try {
                $parsed = $raw | ConvertFrom-Json
            } catch {
                $parseError = $_.Exception.Message
            }
        }
    } catch {
        $parseError = $_.Exception.Message
    }

    $entry = [ordered]@{
        index = $index
        requestAt = $requestAt.ToString("o")
        httpCode = $httpCode
        response = $parsed
        rawResponse = if ($parsed -eq $null) { $raw } else { $null }
        parseError = $parseError
    }
    ($entry | ConvertTo-Json -Compress -Depth 8) | Add-Content $logPath

    if ($parsed -ne $null -and $httpCode -eq "200") {
        $bboxText = ""
        if ($parsed.bbox -ne $null) {
            $bboxText = "[" + [string]::Join(",", $parsed.bbox) + "]"
        } else {
            $bboxText = "null"
        }

        $line = "[{0}] #{1} detected={2} conf={3} sev={4} bbox={5} lat={6} lng={7}" -f 
            (Get-Date -Format "HH:mm:ss"),
            $index,
            $parsed.potholeDetected,
            $parsed.confidence,
            $parsed.severity,
            $bboxText,
            $parsed.latitude,
            $parsed.longitude

        if ($parsed.potholeDetected -eq $true) {
            Write-Host $line -ForegroundColor Green
        } else {
            Write-Host $line -ForegroundColor Yellow
        }
    } else {
        $line = "[{0}] #{1} http={2} parseError={3}" -f (Get-Date -Format "HH:mm:ss"), $index, $httpCode, $parseError
        Write-Host $line -ForegroundColor Red
    }

    Start-Sleep -Milliseconds $IntervalMs
}

if (Test-Path $tmpPath) {
    Remove-Item $tmpPath -Force
}

Write-Host "Stopped. Logs saved to $logPath"