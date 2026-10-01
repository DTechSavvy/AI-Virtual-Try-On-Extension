# Start local S3-compatible private object storage using S3rver
Write-Host "Initializing S3 local storage..." -ForegroundColor Cyan

if (!(Test-Path -Path "data\s3")) {
    New-Item -ItemType Directory -Path "data\s3" -Force | Out-Null
}

Write-Host "Starting S3rver on 127.0.0.1:9000 with bucket 'vton-private'..." -ForegroundColor Green
npx.cmd s3rver -d data/s3 -a 127.0.0.1 -p 9000 --configure-bucket vton-private --no-vhost-buckets
