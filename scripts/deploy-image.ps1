$ErrorActionPreference = 'Stop'

$required = @(
    'AZURE_CONTAINER_REGISTRY_NAME',
    'AZURE_CONTAINER_REGISTRY_ENDPOINT',
    'AZURE_CONTAINER_JOB_NAME',
    'AZURE_RESOURCE_GROUP',
    'AZURE_ENV_NAME'
)

foreach ($name in $required) {
    if (-not (Get-Item "Env:$name" -ErrorAction SilentlyContinue).Value) {
        throw "Missing required AZD environment value: $name"
    }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $projectRoot 'src\monitor'
$tag = $env:AZURE_ENV_NAME.ToLowerInvariant()
$image = "samsung-tv-monitor:$tag"
$fullImage = "$($env:AZURE_CONTAINER_REGISTRY_ENDPOINT)/$image"

az acr build `
    --registry $env:AZURE_CONTAINER_REGISTRY_NAME `
    --image $image `
    --file (Join-Path $sourcePath 'Dockerfile') `
    $sourcePath `
    --only-show-errors

if ($LASTEXITCODE -ne 0) {
    throw 'Azure Container Registry image build failed.'
}

az containerapp job update `
    --name $env:AZURE_CONTAINER_JOB_NAME `
    --resource-group $env:AZURE_RESOURCE_GROUP `
    --image $fullImage `
    --only-show-errors

if ($LASTEXITCODE -ne 0) {
    throw 'Container Apps Job image update failed.'
}

Write-Host "Deployed image $fullImage"
