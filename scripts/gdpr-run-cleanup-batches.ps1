<#
.SYNOPSIS
  Manually drives the GDPR cleanup sweep (app/api/cron/gdpr-cleanup) in
  bounded batches instead of one huge run.

.DESCRIPTION
  Calls POST /api/cron/gdpr-cleanup?limit=<BatchSize> repeatedly (oldest
  paidAt first, per lib/gdpr/runGdprCleanup.ts) until a batch comes back
  with nothing left to anonymize or clean up, or MaxBatches is reached.
  Useful right after a large bulk status correction (e.g. thousands of
  orders newly marked Paid at once) so the cleanup doesn't try to touch
  everything in a single request.

.PARAMETER BaseUrl
  The app's base URL, e.g. https://otman.no (no trailing slash).

.PARAMETER CronSecret
  Defaults to the CRON_SECRET environment variable if not passed explicitly.

.PARAMETER BatchSize
  Max orders processed per sweep, per call. Defaults to 200.

.PARAMETER DelaySeconds
  Pause between batches, to avoid hammering the production DB. Defaults to 5.

.PARAMETER MaxBatches
  Safety cap on how many batches this script will run in one invocation.
  Defaults to 100 (i.e. up to 100 * BatchSize orders per invocation --
  re-run the script again if there's still a backlog after that).

.EXAMPLE
  # Uses $env:CRON_SECRET
  .\scripts\gdpr-run-cleanup-batches.ps1 -BaseUrl "https://otman.no"

.EXAMPLE
  .\scripts\gdpr-run-cleanup-batches.ps1 -BaseUrl "https://otman.no" -CronSecret "..." -BatchSize 100 -DelaySeconds 10
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,

    [string]$CronSecret = $env:CRON_SECRET,

    [int]$BatchSize = 200,

    [int]$DelaySeconds = 5,

    [int]$MaxBatches = 100
)

if (-not $CronSecret) {
    Write-Error "No CronSecret provided and CRON_SECRET environment variable is not set."
    exit 1
}

$totalAnonymized = 0
$totalPodCleaned = 0
$totalFailed = 0
$batchNumber = 0

while ($batchNumber -lt $MaxBatches) {
    $batchNumber++
    $url = "$BaseUrl/api/cron/gdpr-cleanup?limit=$BatchSize"

    Write-Host "Batch $batchNumber : POST $url"

    try {
        $result = Invoke-RestMethod -Uri $url -Method Post -Headers @{ Authorization = "Bearer $CronSecret" }
    } catch {
        Write-Error "Batch $batchNumber failed: $_"
        break
    }

    Write-Host ("  anonymized={0}  podCleaned={1}  failed={2}" -f $result.anonymized, $result.podCleaned, $result.failed)

    $totalAnonymized += $result.anonymized
    $totalPodCleaned += $result.podCleaned
    $totalFailed += $result.failed

    if ($result.anonymized -eq 0 -and $result.podCleaned -eq 0) {
        Write-Host "Nothing left to process -- done."
        break
    }

    if ($batchNumber -lt $MaxBatches) {
        Start-Sleep -Seconds $DelaySeconds
    }
}

if ($batchNumber -ge $MaxBatches) {
    Write-Warning "Hit MaxBatches ($MaxBatches) -- there may still be a backlog. Re-run the script to continue."
}

Write-Host ""
Write-Host "==== Totals across $batchNumber batch(es) ===="
Write-Host ("anonymized={0}  podCleaned={1}  failed={2}" -f $totalAnonymized, $totalPodCleaned, $totalFailed)
