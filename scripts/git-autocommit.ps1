param (
    [int]$IntervalSeconds = 300
)

# Disable interactive credential prompting for git and credential manager
$env:GIT_TERMINAL_PROMPT = "0"
$env:GCM_INTERACTIVE = "never"

# Set working directory to workspace root (one level up from scripts directory)
$WorkspaceRoot = Split-Path $PSScriptRoot -Parent
Set-Location $WorkspaceRoot

$pidFile = Join-Path $PSScriptRoot "git-autocommit.pid"
$logFile = Join-Path $WorkspaceRoot "git-autocommit.log"
$PID | Out-File -FilePath $pidFile -Encoding ascii -Force

function Log-Message {
    param ([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$timestamp] $Message"
    Write-Output $logLine
    Add-Content -Path $logFile -Value $logLine
}

Log-Message "Starting Git auto-commit background service with interval $IntervalSeconds seconds."
Log-Message "Workspace root path: $WorkspaceRoot"

try {
    while ($true) {
        # Check git status for modified, untracked, or deleted files
        $status = git status --porcelain 2>$null
        if ($null -ne $status -and $status.Length -gt 0) {
            Log-Message "Detected changes in repository:"
            foreach ($line in $status) {
                Log-Message "  $line"
            }
            
            Log-Message "Staging changes..."
            $addResult = git add -A 2>&1
            if ($addResult) {
                Log-Message "Add output: $addResult"
            }
            
            Log-Message "Committing changes..."
            $commitMessage = "Auto-commit: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
            $commitResult = git commit -m $commitMessage 2>&1
            if ($commitResult) {
                Log-Message "Commit result: $($commitResult -join ' `n')"
            }
            
            Log-Message "Pushing changes to origin..."
            $pushResult = git push origin main 2>&1
            if ($pushResult) {
                Log-Message "Push result: $($pushResult -join ' `n')"
            }
        }
        
        Start-Sleep -Seconds $IntervalSeconds
    }
}
catch {
    Log-Message "An error occurred: $_"
}
finally {
    Log-Message "Stopping Git auto-commit background service."
    if (Test-Path $pidFile) {
        Remove-Item $pidFile -Force
    }
}
