$ErrorActionPreference = 'Stop'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$email = if ($env:E2E_MEMBER_EMAIL) { $env:E2E_MEMBER_EMAIL } else { 'e2e-dept-editor@test.coreknot.local' }
$password = '1Million#'
$sandboxId = '6a2925ff19424604c33b579d'

$results = @{ user = $email; pages = @(); bugs = @(); checks = @() }

function Add-Check($name, $ok, $detail) {
  $results.checks += @{ name = $name; ok = $ok; detail = $detail }
  if (-not $ok) { $results.bugs += @{ id = "BUG-MEM-$($results.bugs.Count + 1)"; name = $name; detail = $detail } }
}

$loginBody = @{ email = $email; password = $password } | ConvertTo-Json
$r = Invoke-WebRequest -Uri 'http://localhost:5000/api/auth/login' -Method POST -Body $loginBody -ContentType 'application/json' -WebSession $session -UseBasicParsing
Add-Check 'login' $true "HTTP $($r.StatusCode)"

$probes = @(
  @{ m='GET'; u='/api/projects'; label='projects' },
  @{ m='GET'; u="/api/tasks?projectId=$sandboxId"; label='project_tasks' },
  @{ m='GET'; u='/api/attendance?start=2026-06-10&end=2026-06-10&mine=true'; label='attendance' },
  @{ m='GET'; u='/api/notes'; label='notes' },
  @{ m='GET'; u='/api/calendar?start=2026-06-01&end=2026-06-30'; label='calendar' }
)

foreach ($p in $probes) {
  $results.pages += $p.label
  try {
    $res = Invoke-WebRequest -Uri "http://localhost:5000$($p.u)" -Method $p.m -WebSession $session -UseBasicParsing
    Add-Check $p.label $true "HTTP $($res.StatusCode)"
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    Add-Check $p.label $false "HTTP $code"
  }
}

# notes create
$noteBody = @{ title = 'E2E member note'; content = 'probe'; workspace = 'GENERAL' } | ConvertTo-Json
try {
  $res = Invoke-WebRequest -Uri 'http://localhost:5000/api/notes' -Method POST -Body $noteBody -ContentType 'application/json' -WebSession $session -UseBasicParsing
  Add-Check 'notes_create' $true "HTTP $($res.StatusCode)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Add-Check 'notes_create' ($code -in 200,201) "HTTP $code"
}

$forbidden = @(
  @{ m='PUT'; u="/api/projects/$sandboxId"; b=@{ name='Hacked' }; label='forbid_project_rename'; expect=@(403) },
  @{ m='GET'; u='/api/admin/users'; b=$null; label='forbid_admin_users'; expect=@(403,404) },
  @{ m='GET'; u='/api/data-hub/backups'; b=$null; label='forbid_data_hub'; expect=@(403,404) }
)

foreach ($f in $forbidden) {
  try {
    if ($f.b) {
      $body = $f.b | ConvertTo-Json
      $res = Invoke-WebRequest -Uri "http://localhost:5000$($f.u)" -Method $f.m -Body $body -ContentType 'application/json' -WebSession $session -UseBasicParsing
      $code = $res.StatusCode
    } else {
      $res = Invoke-WebRequest -Uri "http://localhost:5000$($f.u)" -Method $f.m -WebSession $session -UseBasicParsing
      $code = $res.StatusCode
    }
    Add-Check $f.label ($f.expect -contains $code) "HTTP $code"
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    Add-Check $f.label ($f.expect -contains $code) "HTTP $code"
  }
}

$results | ConvertTo-Json -Depth 6
