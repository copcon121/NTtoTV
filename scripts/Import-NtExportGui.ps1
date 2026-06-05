Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$scriptDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptDir)) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $scriptDir "..")).Path
$importScript = Join-Path $scriptDir "Import-NtGap.ps1"

function Find-NtExportSet {
    param([string]$Folder)

    $sets = @()
    foreach ($last in Get-ChildItem -LiteralPath $Folder -Filter "*.Last.txt" -File) {
        $contract = $last.Name -replace "\.Last\.txt$", ""
        $bid = Join-Path $Folder "$contract.Bid.txt"
        $ask = Join-Path $Folder "$contract.Ask.txt"
        if ((Test-Path -LiteralPath $bid) -and (Test-Path -LiteralPath $ask)) {
            $sets += [pscustomobject]@{
                Contract = $contract
                Last = $last.FullName
                Bid = (Resolve-Path -LiteralPath $bid).Path
                Ask = (Resolve-Path -LiteralPath $ask).Path
            }
        }
    }
    return $sets
}

function Select-SourceFolder {
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = "Select folder containing NinjaTrader *.Last.txt, *.Bid.txt, *.Ask.txt exports"
    $dialog.SelectedPath = Join-Path $repoRoot "export data"
    $dialog.ShowNewFolderButton = $false
    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
        return $null
    }
    return $dialog.SelectedPath
}

function Show-ImportDialog {
    param(
        [string]$Folder,
        [object[]]$ExportSets
    )

    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Import NinjaTrader Export"
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.ClientSize = New-Object System.Drawing.Size(560, 245)

    $folderLabel = New-Object System.Windows.Forms.Label
    $folderLabel.Location = New-Object System.Drawing.Point(12, 15)
    $folderLabel.Size = New-Object System.Drawing.Size(520, 20)
    $folderLabel.Text = "Source: $Folder"
    $form.Controls.Add($folderLabel)

    $contractLabel = New-Object System.Windows.Forms.Label
    $contractLabel.Location = New-Object System.Drawing.Point(12, 52)
    $contractLabel.Size = New-Object System.Drawing.Size(90, 20)
    $contractLabel.Text = "Contract"
    $form.Controls.Add($contractLabel)

    $contractBox = New-Object System.Windows.Forms.ComboBox
    $contractBox.Location = New-Object System.Drawing.Point(105, 49)
    $contractBox.Size = New-Object System.Drawing.Size(210, 24)
    $contractBox.DropDownStyle = "DropDownList"
    foreach ($set in $ExportSets) {
        [void]$contractBox.Items.Add($set.Contract)
    }
    $contractBox.SelectedIndex = 0
    $form.Controls.Add($contractBox)

    $modeLabel = New-Object System.Windows.Forms.Label
    $modeLabel.Location = New-Object System.Drawing.Point(335, 52)
    $modeLabel.Size = New-Object System.Drawing.Size(50, 20)
    $modeLabel.Text = "Mode"
    $form.Controls.Add($modeLabel)

    $modeBox = New-Object System.Windows.Forms.ComboBox
    $modeBox.Location = New-Object System.Drawing.Point(390, 49)
    $modeBox.Size = New-Object System.Drawing.Size(145, 24)
    $modeBox.DropDownStyle = "DropDownList"
    [void]$modeBox.Items.Add("missing-only")
    [void]$modeBox.Items.Add("replace-range")
    $modeBox.SelectedIndex = 0
    $form.Controls.Add($modeBox)

    $fromLabel = New-Object System.Windows.Forms.Label
    $fromLabel.Location = New-Object System.Drawing.Point(12, 92)
    $fromLabel.Size = New-Object System.Drawing.Size(90, 20)
    $fromLabel.Text = "From"
    $form.Controls.Add($fromLabel)

    $fromBox = New-Object System.Windows.Forms.TextBox
    $fromBox.Location = New-Object System.Drawing.Point(105, 89)
    $fromBox.Size = New-Object System.Drawing.Size(210, 24)
    $fromBox.Text = ""
    $form.Controls.Add($fromBox)

    $toLabel = New-Object System.Windows.Forms.Label
    $toLabel.Location = New-Object System.Drawing.Point(335, 92)
    $toLabel.Size = New-Object System.Drawing.Size(50, 20)
    $toLabel.Text = "To"
    $form.Controls.Add($toLabel)

    $toBox = New-Object System.Windows.Forms.TextBox
    $toBox.Location = New-Object System.Drawing.Point(390, 89)
    $toBox.Size = New-Object System.Drawing.Size(145, 24)
    $toBox.Text = ""
    $form.Controls.Add($toBox)

    $hintLabel = New-Object System.Windows.Forms.Label
    $hintLabel.Location = New-Object System.Drawing.Point(105, 116)
    $hintLabel.Size = New-Object System.Drawing.Size(430, 20)
    $hintLabel.Text = "Optional ISO UTC, e.g. 2026-04-01T00:00:00Z"
    $form.Controls.Add($hintLabel)

    $noRebuildBox = New-Object System.Windows.Forms.CheckBox
    $noRebuildBox.Location = New-Object System.Drawing.Point(105, 148)
    $noRebuildBox.Size = New-Object System.Drawing.Size(210, 22)
    $noRebuildBox.Text = "Skip cache rebuild"
    $noRebuildBox.Checked = $true
    $form.Controls.Add($noRebuildBox)

    $dryRunBox = New-Object System.Windows.Forms.CheckBox
    $dryRunBox.Location = New-Object System.Drawing.Point(335, 148)
    $dryRunBox.Size = New-Object System.Drawing.Size(120, 22)
    $dryRunBox.Text = "Dry run"
    $dryRunBox.Checked = $false
    $form.Controls.Add($dryRunBox)

    $importButton = New-Object System.Windows.Forms.Button
    $importButton.Location = New-Object System.Drawing.Point(345, 195)
    $importButton.Size = New-Object System.Drawing.Size(90, 30)
    $importButton.Text = "Import"
    $importButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $form.AcceptButton = $importButton
    $form.Controls.Add($importButton)

    $cancelButton = New-Object System.Windows.Forms.Button
    $cancelButton.Location = New-Object System.Drawing.Point(445, 195)
    $cancelButton.Size = New-Object System.Drawing.Size(90, 30)
    $cancelButton.Text = "Cancel"
    $cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $form.CancelButton = $cancelButton
    $form.Controls.Add($cancelButton)

    if ($form.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
        return $null
    }

    $selected = $ExportSets | Where-Object { $_.Contract -eq [string]$contractBox.SelectedItem } | Select-Object -First 1
    return [pscustomobject]@{
        Contract = $selected.Contract
        Last = $selected.Last
        Bid = $selected.Bid
        Ask = $selected.Ask
        From = $fromBox.Text.Trim()
        To = $toBox.Text.Trim()
        Mode = [string]$modeBox.SelectedItem
        NoRebuild = $noRebuildBox.Checked
        DryRun = $dryRunBox.Checked
    }
}

$folder = Select-SourceFolder
if ($null -eq $folder) {
    exit 0
}

$exportSets = @(Find-NtExportSet -Folder $folder)
if ($exportSets.Count -eq 0) {
    [System.Windows.Forms.MessageBox]::Show(
        "No complete Last/Bid/Ask export set found in:`n$folder",
        "Import NinjaTrader Export",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
    exit 1
}

$choice = Show-ImportDialog -Folder $folder -ExportSets $exportSets
if ($null -eq $choice) {
    exit 0
}

$argsList = @(
    "-Contract", $choice.Contract,
    "-Last", $choice.Last,
    "-Bid", $choice.Bid,
    "-Ask", $choice.Ask,
    "-Mode", $choice.Mode
)
if (-not [string]::IsNullOrWhiteSpace($choice.From)) {
    $argsList += @("-From", $choice.From)
}
if (-not [string]::IsNullOrWhiteSpace($choice.To)) {
    $argsList += @("-To", $choice.To)
}
if ($choice.NoRebuild) {
    $argsList += "-NoRebuild"
}
if ($choice.DryRun) {
    $argsList += "-DryRun"
}

Write-Host "Running import..."
Write-Host ("Contract: " + $choice.Contract)
Write-Host ("Mode:     " + $choice.Mode)
Write-Host ("Last:     " + $choice.Last)
Write-Host ("Bid:      " + $choice.Bid)
Write-Host ("Ask:      " + $choice.Ask)
Write-Host ""

& $importScript @argsList
$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    [System.Windows.Forms.MessageBox]::Show(
        "Import completed.",
        "Import NinjaTrader Export",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null
} else {
    [System.Windows.Forms.MessageBox]::Show(
        "Import failed with exit code $exitCode. Check the console output.",
        "Import NinjaTrader Export",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
}
exit $exitCode
