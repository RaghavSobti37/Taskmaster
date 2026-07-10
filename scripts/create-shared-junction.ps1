# Create Taskmaster/shared junction -> shared
param()

$link = Join-Path $PSScriptRoot '..' 'Taskmaster' 'shared'
$target = Join-Path $PSScriptRoot '..' 'shared'

if (Test-Path $link) {
    $item = Get-Item $link -Force
    if ($item.LinkType -eq 'Junction') { exit 0 }
    Remove-Item $link -Force
}

$targetResolved = Resolve-Path $target -ErrorAction Stop
New-Item -Path $link -ItemType Junction -Target $targetResolved.Path -Force | Out-Null
Write-Host "Created junction: Taskmaster\shared -> shared"
