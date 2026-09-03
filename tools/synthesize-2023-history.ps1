<#
PowerShell script: Initialize a Git repo here and synthesize a linear commit history across 2023.
Usage (from repo root, in PowerShell):
  .\tools\synthesize-2023-history.ps1 -Commits 300 -AuthorName "Your Name" -AuthorEmail "you@example.com"

What it does:
 - Initializes a git repo (if none exists)
 - Generates N random dates in 2023 (biases weekdays over weekends)
 - Sorts dates earliest->latest and creates one commit per date by appending to a small file
 - Sets GIT_AUTHOR_DATE and GIT_COMMITTER_DATE for each commit so history reflects those dates
 - Writes tools/synth-commit-date-mapping.csv with commit SHA -> date for review

Warnings:
 - This creates a new git repository in this folder. If you already have a repo here, it will continue in-place.
 - If you plan to push this to an existing remote, pushing will replace history on the remote if you force-push.
 - Inspect the generated mapping file before any push.

#>
param(
    [int]
    $Commits = 300,

    [string]
    $AuthorName = $(git config user.name 2>$null),

    [string]
    $AuthorEmail = $(git config user.email 2>$null),

    [int]
    $WeekdayBias = 5,

    [int]
    $WeekendBias = 1
)

function Ensure-Git {
    if (-not (Test-Path ".git")) {
        Write-Host "No .git directory found — initializing new repository..."
        git init || throw "git init failed"
    } else {
        Write-Host ".git exists — continuing in existing repository."
    }
}

function RandomDate2023Once {
    param($weekdayBias, $weekendBias)
    while ($true) {
        $start = Get-Date "2023-01-01T00:00:00Z"
        $end = Get-Date "2023-12-31T23:59:59Z"
        $totalDays = ($end - $start).Days + 1
        $offset = Get-Random -Minimum 0 -Maximum $totalDays
        $candidate = $start.AddDays($offset)
        $dayOfWeek = $candidate.DayOfWeek
        $weight = if ($dayOfWeek -eq 'Saturday' -or $dayOfWeek -eq 'Sunday') { $weekendBias } else { $weekdayBias }
        $roll = Get-Random -Minimum 1 -Maximum ($weekdayBias + $weekendBias)
        if ($roll -le $weight) {
            # random time during day 06:00-22:00 local time
            $hour = Get-Random -Minimum 6 -Maximum 22
            $minute = Get-Random -Minimum 0 -Maximum 59
            $second = Get-Random -Minimum 0 -Maximum 59
            $dtLocal = [datetime]::SpecifyKind((Get-Date -Year $candidate.Year -Month $candidate.Month -Day $candidate.Day -Hour $hour -Minute $minute -Second $second), [System.DateTimeKind]::Local)
            $dtUtc = $dtLocal.ToUniversalTime()
            # Format iso 8601 acceptable to git
            return $dtUtc.ToString("yyyy-MM-ddTHH:mm:ssZ")
        }
    }
}

try {
    Ensure-Git

    if (-not $AuthorName -or -not $AuthorEmail) {
        Write-Host "No git user.name/user.email found in config. You can pass -AuthorName and -AuthorEmail to the script. Using defaults: 'Synthetic Author' <synthetic@example.com>"
        if (-not $AuthorName) { $AuthorName = 'Synthetic Author' }
        if (-not $AuthorEmail) { $AuthorEmail = 'synthetic@example.com' }
    }

    Write-Host "Generating $Commits dates in 2023 (weekdayBias=$WeekdayBias weekendBias=$WeekendBias)..."
    $dates = @()
    for ($i = 0; $i -lt $Commits; $i++) {
        $dates += RandomDate2023Once -weekdayBias $WeekdayBias -weekendBias $WeekendBias
    }

    # Sort ascending so commits are chronological
    $dates = $dates | Sort-Object

    $mappingPath = "tools\\synth-commit-date-mapping.csv"
    $mappingLines = @()
    $mappingLines += "commit,date"

    $stampFile = "SYNTHETIC_HISTORY.md"
    if (-not (Test-Path $stampFile)) { Set-Content -Path $stampFile -Value "Synthetic history created on $(Get-Date)" -Encoding UTF8 }

    Write-Host "Creating commits..."
    $i = 0
    foreach ($d in $dates) {
        $i++
        $line = "Commit ${i} - ${d}"
        Add-Content -Path $stampFile -Value $line -Encoding UTF8

        # Set env vars for commit dates
        $env:GIT_AUTHOR_DATE = $d
        $env:GIT_COMMITTER_DATE = $d

        # Use explicit author to make all commits attributed to the provided author
        # Use -c to override config for the single commit command
        & git add "$stampFile" | Out-Null
        $message = "Synthetic commit ${i}: ${d}"
        & git -c user.name="$AuthorName" -c user.email="$AuthorEmail" commit -m $message | Out-Null

        # Capture the new commit sha and append to mapping
        $sha = (& git rev-parse HEAD).Trim()
        $mappingLines += "$sha,$d"

        # Clear env vars to avoid leaking
        Remove-Item Env:\GIT_AUTHOR_DATE -ErrorAction SilentlyContinue
        Remove-Item Env:\GIT_COMMITTER_DATE -ErrorAction SilentlyContinue

        if ($i % 50 -eq 0) { Write-Host "  created $i commits..." }
    }

    # Write mapping file
    if (-not (Test-Path "tools")) { New-Item -ItemType Directory -Path "tools" | Out-Null }
    Set-Content -Path $mappingPath -Value ($mappingLines -join "`n") -Encoding UTF8
    Write-Host "Done. Created $i commits. Mapping written to $mappingPath"
    Write-Host "Inspect the mapping file and SYNTHETIC_HISTORY.md. If you want to push this repo to remote, add a remote and force push:"
    Write-Host "  git remote add origin <remote-url>"
    Write-Host "  git branch -M main"
    Write-Host "  git push --force origin main"

} catch {
    Write-Error "Error: $_"
    exit 1
}
