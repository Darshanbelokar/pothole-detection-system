param(
    [string]$BackendBaseUrl = "https://pothole-detection-system-4.onrender.com",
    [string]$ImagePath = "images.jpeg",
    [int]$Count = 10,
    [int]$DelayMs = 400,
    [Nullable[double]]$Lat = $null,
    [Nullable[double]]$Lng = $null,
    [string]$OutDir = "logs"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ImagePath)) {
    throw "Image file not found: $ImagePath"
}

if ($Count -lt 1) {
    throw "Count must be >= 1"
}

if ($DelayMs -lt 0) {
    throw "DelayMs must be >= 0"
}

if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$jsonlPath = Join-Path $OutDir "detection-log-$timestamp.jsonl"
$summaryPath = Join-Path $OutDir "detection-log-$timestamp-summary.txt"
$tmpPath = Join-Path $OutDir "_tmp-detection-response.json"

$apiUrl = "$($BackendBaseUrl.TrimEnd('/'))/api/detections/frame"

"Detection logging started at $(Get-Date -Format o)" | Set-Content $summaryPath
"API: $apiUrl" | Add-Content $summaryPath
"Image: $ImagePath" | Add-Content $summaryPath
"Count: $Count, DelayMs: $DelayMs" | Add-Content $summaryPath
if ($Lat -ne $null -and $Lng -ne $null) {
    "Coordinates: lat=$Lat, lng=$Lng" | Add-Content $summaryPath
}
"" | Add-Content $summaryPath

$results = @()

for ($i = 1; $i -le $Count; $i++) {
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

    $httpCode = (& curl.exe @curlArgs).Trim()

    $raw = ""
    if (Test-Path $tmpPath) {
        $raw = Get-Content $tmpPath -Raw
    }

    $parsed = $null
    $parseError = $null

    try {
        if (-not [string]::IsNullOrWhiteSpace($raw)) {
            $parsed = $raw | ConvertFrom-Json
        }
    } catch {
        $parseError = $_.Exception.Message
    }

    $entry = [ordered]@{
        index = $i
        loggedAt = (Get-Date -Format o)
        httpCode = $httpCode
        response = $parsed
        rawResponse = if ($parsed -eq $null) { $raw } else { $null }
        parseError = $parseError
    }

    ($entry | ConvertTo-Json -Compress -Depth 8) | Add-Content $jsonlPath

    $results += [pscustomobject]@{
        Index = $i
        HttpCode = $httpCode
        Parsed = $parsed
    }

    if ($i -lt $Count -and $DelayMs -gt 0) {
        Start-Sleep -Milliseconds $DelayMs
    }
}

if (Test-Path $tmpPath) {
    Remove-Item $tmpPath -Force
}

$ok = $results | Where-Object { $_.HttpCode -eq "200" -and $_.Parsed -ne $null }
$positives = $ok | Where-Object { $_.Parsed.potholeDetected -eq $true }

"HTTP 200 parsed responses: $($ok.Count)/$Count" | Add-Content $summaryPath
"Pothole positives: $($positives.Count)" | Add-Content $summaryPath
"" | Add-Content $summaryPath
"Positive detections:" | Add-Content $summaryPath

if ($positives.Count -eq 0) {
    "(none)" | Add-Content $summaryPath
} else {
    foreach ($p in $positives) {
        $bbox = ""
        if ($p.Parsed.bbox -ne $null) {
            $bbox = [string]::Join(",", $p.Parsed.bbox)
        }
        "index=$($p.Index) id=$($p.Parsed.id) ts=$($p.Parsed.timestamp) conf=$($p.Parsed.confidence) sev=$($p.Parsed.severity) bbox=[$bbox] lat=$($p.Parsed.latitude) lng=$($p.Parsed.longitude)" | Add-Content $summaryPath
    }
}

Write-Host "Saved JSONL log: $jsonlPath"
Write-Host "Saved summary:  $summaryPath"
Write-Host "Total: $Count | HTTP200 parsed: $($ok.Count) | Positives: $($positives.Count)"
