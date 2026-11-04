# Sets up (or updates) a Windows task that backs up the live store every day at 9 PM.
# If the computer is off or asleep at 9 PM, it runs the next time you're signed in.
#   powershell -ExecutionPolicy Bypass -File tools\schedule-backup.ps1            set it up
#   powershell -ExecutionPolicy Bypass -File tools\schedule-backup.ps1 -Remove    remove it
# It runs only while you're signed in to this computer, needs no admin rights, and opens no window.
param([switch]$Remove, [string]$At = '21:00')
$name = 'Carsinstore daily backup'
if ($Remove) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
  "Removed the task '$name'."
  return
}
$node = (Get-Command node -ErrorAction Stop).Source
$script = Join-Path $PSScriptRoot 'backup-store.js'
# conhost --headless runs node without flashing a console window.
$action = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument "--headless `"$node`" `"$script`"" -WorkingDirectory (Split-Path $PSScriptRoot)
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Downloads a full backup of carsin.store and keeps the newest 7. See tools\backup-store.js.' -Force | Out-Null
"Scheduled '$name' every day at $At."
