$ErrorActionPreference = 'Stop'
Set-Location 'c:\Users\mikec\Documents\programming\apex_pilot\apex_pilot'

$bodiesDir = '.scratch\ui-overhaul\ticket-bodies'
$statePath = '.scratch\ui-overhaul\published-tickets.json'
$repo = (gh repo view --json nameWithOwner -q .nameWithOwner).Trim()

$tickets = @(
  @{ file = '01-mission-control-chrome-region-scaffold.md'; title = 'Mission Control chrome + region scaffold'; blockers = @() }
  @{ file = '02-panel-layout-controls.md'; title = 'Panel layout controls'; blockers = @(0) }
  @{ file = '03-stub-surface-convention.md'; title = 'Stub surface convention'; blockers = @(0) }
  @{ file = '04-minimal-command-palette.md'; title = 'Minimal command palette'; blockers = @(0, 1) }
  @{ file = '05-explorer-project-files.md'; title = 'Explorer - project files'; blockers = @(0, 2) }
  @{ file = '06-explorer-multi-section-schema-home.md'; title = 'Explorer - multi-section + schema home'; blockers = @(4) }
  @{ file = '07-mission-composer-stub.md'; title = 'Mission - composer Stub'; blockers = @(0, 2) }
  @{ file = '08-mission-timeline-stage-chrome.md'; title = 'Mission - timeline and stage chrome'; blockers = @(6) }
  @{ file = '09-sql-editor-center-workspace.md'; title = 'SQL Editor to center workspace'; blockers = @(0, 2) }
  @{ file = '10-center-editor-stubs-dirty-close.md'; title = 'Center editor stubs + dirty Close Project'; blockers = @(8) }
  @{ file = '11-inspector-panel.md'; title = 'Inspector panel'; blockers = @(0, 2, 5, 8) }
  @{ file = '12-developer-console-scaffold.md'; title = 'Developer Console scaffold'; blockers = @(0, 2) }
  @{ file = '13-mcp-activity-console-tauri-e2e.md'; title = 'MCP Activity to Console + Tauri e2e smoke'; blockers = @(11) }
  @{ file = '14-preferences-layout-mapping-home.md'; title = 'Preferences, layout persistence and Mapping home'; blockers = @(0, 2, 10) }
  @{ file = '15-dialog-wizard-chrome.md'; title = 'Dialog and wizard chrome'; blockers = @(13) }
  @{ file = '16-density-modes-motion-polish.md'; title = 'Density modes + motion polish'; blockers = @(0, 1) }
  @{ file = '17-quick-open.md'; title = 'Quick Open'; blockers = @(4, 5) }
)

$created = New-Object System.Collections.Generic.List[object]

foreach ($t in $tickets) {
  $bodyPath = Join-Path $bodiesDir $t.file
  $body = [System.IO.File]::ReadAllText((Resolve-Path $bodyPath).Path)

  if ($t.blockers.Count -eq 0) {
    $blockerText = '- None - can start immediately'
  } else {
    $lines = foreach ($bi in $t.blockers) {
      $b = $created[$bi]
      '- #' + $b.number + ' - ' + $b.title
    }
    $blockerText = [string]::Join([Environment]::NewLine, $lines)
  }
  $body = $body.Replace('- PLACEHOLDER_BLOCKERS', $blockerText)

  $tmp = Join-Path $env:TEMP ('apex-issue-' + [guid]::NewGuid().ToString('N') + '.md')
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($tmp, $body, $utf8)
  try {
    $url = (gh issue create --title $t.title --body-file $tmp --label ready-for-agent).Trim()
  } finally {
    Remove-Item -Force $tmp -ErrorAction SilentlyContinue
  }
  if ($url -notmatch '/issues/(\d+)$') { throw "Bad URL: $url" }
  $num = [int]$Matches[1]
  $item = [pscustomobject]@{
    index = $created.Count
    number = $num
    title = $t.title
    url = $url
    blockerIndexes = @($t.blockers)
  }
  $created.Add($item) | Out-Null
  Write-Host ("Created #{0} - {1}" -f $num, $t.title)
}

foreach ($item in $created) {
  foreach ($bi in $item.blockerIndexes) {
    $blocker = $created[$bi]
    $blockerId = (gh api ("repos/{0}/issues/{1}" -f $repo, $blocker.number) --jq .id).Trim()
    Write-Host ("Link blocked_by: #{0} blocked by #{1} (id={2})" -f $item.number, $blocker.number, $blockerId)
    gh api --method POST ("repos/{0}/issues/{1}/dependencies/blocked_by" -f $repo, $item.number) -f ("issue_id={0}" -f $blockerId) | Out-Null
  }
}

foreach ($item in $created) {
  $childId = (gh api ("repos/{0}/issues/{1}" -f $repo, $item.number) --jq .id).Trim()
  Write-Host ("Sub-issue link attempt: #{0} id={1} under #25" -f $item.number, $childId)
  gh api --method POST ("repos/{0}/issues/25/sub_issues" -f $repo) -f ("sub_issue_id={0}" -f $childId) 2>&1 | Out-Null
}

$created | ConvertTo-Json -Depth 4 | Set-Content -Path $statePath -Encoding utf8
Write-Host ""
Write-Host ("Published {0} tickets" -f $created.Count)
foreach ($item in $created) {
  Write-Host ("#{0} {1}" -f $item.number, $item.title)
}
