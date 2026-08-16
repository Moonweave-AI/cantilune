# Enable Hyper-V isolated Windows containers (ADR-0024 / Microsoft Learn).
# Requires Administrator and a Pro/Enterprise/Education SKU.
# https://learn.microsoft.com/windows-server/virtualization/hyper-v/get-started/install-hyper-v
$ErrorActionPreference = "Stop"

$nt = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion"
Write-Output "WindowsEdition=$($nt.ProductName) EditionID=$($nt.EditionID)"
if ($nt.ProductName -match "Home" -or $nt.EditionID -match "^Core") {
  Write-Output "Microsoft Learn: The Hyper-V role can't be installed on Windows 10 Home or Windows 11 Home."
  Write-Output "https://learn.microsoft.com/windows-server/virtualization/hyper-v/get-started/install-hyper-v"
  Write-Output "Do not use unofficial Home-SKU Hyper-V patches. Linux isolation on this host is WSL + official runsc."
  exit 3
}

$hypervisor = (Get-CimInstance -ClassName Win32_ComputerSystem).HypervisorPresent
Write-Output "HypervisorPresent=$hypervisor"

$vmms = Get-Service -Name vmms -ErrorAction SilentlyContinue
if ($null -eq $vmms) {
  Write-Output "VMMS is not installed; enabling Microsoft-Hyper-V"
  Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All -NoRestart
  Enable-WindowsOptionalFeature -Online -FeatureName Containers -All -NoRestart
  Write-Output "Hyper-V feature enable requested. Reboot, then re-run this script to start VMMS."
  exit 2
}

if ($vmms.Status -ne "Running") {
  Set-Service -Name vmms -StartupType Automatic
  Start-Service -Name vmms
}

$after = Get-Service -Name vmms
Write-Output "VMMS=$($after.Status)"
if ($after.Status -ne "Running") {
  throw "VMMS failed to start"
}
