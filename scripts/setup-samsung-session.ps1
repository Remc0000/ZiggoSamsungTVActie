$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$monitorPath = Join-Path $projectRoot 'src\monitor'
$sessionPath = Join-Path $monitorPath '.local\storage-state.json'

Push-Location $monitorPath
try {
    npm run login
    if ($LASTEXITCODE -ne 0) {
        throw 'Samsung interactive login failed.'
    }

    $sessionBytes = [System.IO.File]::ReadAllBytes($sessionPath)
    $output = [System.IO.MemoryStream]::new()
    $gzip = [System.IO.Compression.GZipStream]::new(
        $output,
        [System.IO.Compression.CompressionLevel]::Optimal,
        $true
    )
    $gzip.Write($sessionBytes, 0, $sessionBytes.Length)
    $gzip.Dispose()
    $bootstrapSession = [Convert]::ToBase64String($output.ToArray())
    $output.Dispose()

    azd env set BOOTSTRAP_SESSION $bootstrapSession
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not store the one-time Samsung bootstrap session.'
    }

    Write-Host ''
    Write-Host 'Samsung session prepared. Continue with:'
    Write-Host '  azd provision --no-prompt'
    Write-Host '  az containerapp job start --name (azd env get-value AZURE_CONTAINER_JOB_NAME) --resource-group (azd env get-value AZURE_RESOURCE_GROUP)'
    Write-Host ''
    Write-Host 'After the first successful job run, remove the one-time secret:'
    Write-Host '  azd env set BOOTSTRAP_SESSION ""'
    Write-Host '  azd provision --no-prompt'
}
finally {
    Pop-Location
}
