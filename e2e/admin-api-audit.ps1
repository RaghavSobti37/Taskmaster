# Admin API audit via PowerShell (IPv4-friendly on Windows)
$Api = if ($env:E2E_API_URL) { $env:E2E_API_URL } else { 'http://127.0.0.1:5000' }
$Email = if ($env:E2E_EMAIL) { $env:E2E_EMAIL } else { 'raghavraj@theshakticollective.in' }
$Password = if ($env:E2E_PASSWORD) { $env:E2E_PASSWORD } else { '1Million#' }

$endpoints = @{
  '/admin' = @(
    '/api/data-hub/folders', '/api/data-hub/people?limit=5', '/api/data-hub/analytics?folder=all',
    '/api/data-hub/sync-status', '/api/data-hub/backups'
  )
  '/admin/control' = @('/api/users/directory?limit=10', '/api/teams', '/api/crm/stats', '/api/mail/stats')
  '/admin/qa' = @('/api/qa/lighthouse-routes', '/api/qa/history')
  '/admin/users' = @('/api/users/directory?limit=10', '/api/departments')
  '/admin/teams' = @('/api/departments')
  '/admin/roles' = @('/api/admin/roles')
  '/admin/artist-path' = @('/api/artist-path/people?limit=5')
  '/admin/exly-campaigns' = @('/api/exly/config', '/api/exly/offerings', '/api/exly/dashboard-stats', '/api/exly/unlinked-bookings')
  '/admin/scripts' = @('/api/admin/scripts', '/api/admin/queues/status')
  '/admin/gamification' = @('/api/gamification-admin/rules')
  '/admin/project-analytics' = @('/api/projects?limit=5', '/api/projects/analytics-summary?timeframe=30d')
}

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json
try {
  $login = Invoke-WebRequest -Uri "$Api/api/auth/login" -Method POST -Body $loginBody -ContentType 'application/json' -WebSession $session -UseBasicParsing -TimeoutSec 30
  Write-Host "login: $($login.StatusCode)"
} catch {
  Write-Error "Login failed: $($_.Exception.Message)"
  exit 1
}

$results = @()
$seen = @{}
foreach ($page in $endpoints.Keys) {
  foreach ($ep in $endpoints[$page]) {
    if ($seen[$ep]) { continue }
    $seen[$ep] = $true
    try {
      $r = Invoke-WebRequest -Uri "$Api$ep" -WebSession $session -UseBasicParsing -TimeoutSec 45
      $results += [pscustomobject]@{ page = $page; endpoint = $ep; status = $r.StatusCode; ok = $true }
    } catch {
      $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
      $results += [pscustomobject]@{ page = $page; endpoint = $ep; status = $status; ok = $false }
    }
  }
}

$out = Join-Path $PSScriptRoot '.admin-api-audit-ps.json'
$summary = @{
  auditedAt = (Get-Date).ToUniversalTime().ToString('o')
  user = $Email
  ok = ($results | Where-Object { $_.ok }).Count
  fails500 = ($results | Where-Object { $_.status -ge 500 }).Count
  forbidden = ($results | Where-Object { $_.status -eq 403 }).Count
  notFound = ($results | Where-Object { $_.status -eq 404 }).Count
  clientErrors = ($results | Where-Object { $_.status -ge 400 -and $_.status -lt 500 -and $_.status -ne 403 }).Count
  results = $results
}
$summary | ConvertTo-Json -Depth 5 | Set-Content $out
Write-Host ($summary | Select-Object ok, fails500, forbidden, notFound, clientErrors | ConvertTo-Json -Compress)
