param(
    [Parameter(Mandatory=$true)][ValidateSet('EnableAll','Restore')][string]$Mode,
    [Parameter(Mandatory=$true)][string]$BaselineExport,
    [long]$ChartHandle = 418579636,
    [switch]$Sensitivity
)

# Temporary, reversible chart-only audit. Changes only the selected OF7's
# feature enable checkboxes and seven explicit audit thresholds. Restore from
# a previous read-only native export. Sensitivity is branch coverage, not tuning.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$taskBaseline = Get-Content -LiteralPath $BaselineExport -Raw | ConvertFrom-Json
if ($taskBaseline.schema_version -ne 'of7-live-audit-v1' -or
    $taskBaseline.reference_sha256 -ne 'd47bbcfad05978a3864297e6a569f99be736984ac474c58ab31065e4a4f07cce') {
    throw 'Expected a pinned original OF7 native export for restoration.'
}
$taskChart = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$ChartHandle)
if ($taskChart.Current.Name -notlike 'Chart - GC*') { throw 'Expected the GC chart window.' }
$taskDialogCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,'Indicators')
$taskDialog = $taskChart.FindFirst([System.Windows.Automation.TreeScope]::Children,$taskDialogCondition)
if ($null -eq $taskDialog) {
    $taskButtonCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'ChartWindowIndicatorsButton')
    $taskButton = $taskChart.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$taskButtonCondition)
    $taskButton.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
    for ($taskWait = 0; $taskWait -lt 30 -and $null -eq $taskDialog; $taskWait++) {
        Start-Sleep -Milliseconds 100
        $taskDialog = $taskChart.FindFirst([System.Windows.Automation.TreeScope]::Children,$taskDialogCondition)
    }
}
if ($null -eq $taskDialog) { throw 'Indicator settings dialog is unavailable.' }
$taskTargets = @($taskBaseline.settings.psobject.Properties | Where-Object {$_.Name -match '^Enable[A-Za-z0-9]+$'})
if ($taskTargets.Count -ne 32) { throw 'Expected exactly 32 OF7 enable settings (33 feature IDs).' }
# Resolve every target before changing any value; never change another indicator.
$taskEditors = @()
$taskNumericAudit = [ordered]@{
    MinimalImbalanceVolume=1; ImbalanceClusterSize=2; RatioBoundsHigh=1.5
    DeltaBreakoutThreshold=1; RestingLiquidityThreshold=1
    VerticalLiquidityThreshold=1; VerticalLiquidityClusterSize=2
}
$taskNumericEditors = @()
$taskCheckboxCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::CheckBox)
$taskCheckboxes = $taskDialog.FindAll([System.Windows.Automation.TreeScope]::Descendants,$taskCheckboxCondition)
$taskCheckboxById = @{}
foreach ($taskCheckbox in $taskCheckboxes) {
    $taskId = $taskCheckbox.Current.AutomationId
    if ($taskId -like 'OrderFlowsTraderPropertyGridEditorEnable*') { $taskCheckboxById[$taskId] = $taskCheckbox }
}
foreach ($taskTarget in $taskTargets) {
    if ($taskTarget.Value -isnot [bool]) { throw 'Baseline enables must be booleans.' }
    $taskEditor = $taskCheckboxById[('OrderFlowsTraderPropertyGridEditor' + $taskTarget.Name)]
    if ($null -eq $taskEditor) { throw ('OF7 checkbox unavailable: ' + $taskTarget.Name) }
    $taskPattern = $taskEditor.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern)
    $taskEditors += [pscustomobject]@{Name=$taskTarget.Name;Pattern=$taskPattern;Desired=($Mode -eq 'EnableAll' -or $taskTarget.Value)}
}
foreach ($taskNumeric in $taskNumericAudit.GetEnumerator()) {
    if ($taskBaseline.settings.psobject.Properties.Name -notcontains $taskNumeric.Key) { throw 'Baseline lacks an audit threshold.' }
    $taskCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty,('OrderFlowsTraderPropertyGridEditor' + $taskNumeric.Key))
    $taskEditor = $taskDialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$taskCondition)
    if ($null -eq $taskEditor) { throw ('OF7 threshold unavailable: ' + $taskNumeric.Key) }
    $taskPattern = $taskEditor.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    $taskDesired = if ($Mode -eq 'EnableAll' -and $Sensitivity) {$taskNumeric.Value} else {$taskBaseline.settings.($taskNumeric.Key)}
    $taskNumericEditors += [pscustomobject]@{Name=$taskNumeric.Key;Editor=$taskEditor;Pattern=$taskPattern;Desired=$taskDesired}
}
Write-Output ('Resolved ' + $taskEditors.Count + ' enable controls and ' + $taskNumericEditors.Count + ' thresholds')
$taskChanged = 0
foreach ($taskEditor in $taskEditors) {
    $taskDesired = if ($taskEditor.Desired) {[System.Windows.Automation.ToggleState]::On} else {[System.Windows.Automation.ToggleState]::Off}
    if ($taskEditor.Pattern.Current.ToggleState -ne $taskDesired) {
        $taskEditor.Pattern.Toggle()
        if ($taskEditor.Pattern.Current.ToggleState -ne $taskDesired) { throw ('OF7 checkbox did not update: ' + $taskEditor.Name) }
        $taskChanged++
    }
}
$taskNumericChanged = 0
foreach ($taskEditor in $taskNumericEditors) {
    $taskText = [Convert]::ToString($taskEditor.Desired,[Globalization.CultureInfo]::InvariantCulture)
    if ($taskEditor.Pattern.Current.Value -ne $taskText) {
        $taskEditor.Editor.SetFocus()
        $taskEditor.Pattern.SetValue($taskText)
        if ($taskEditor.Pattern.Current.Value -ne $taskText) { throw ('OF7 threshold text did not update: ' + $taskEditor.Name) }
        $taskNumericChanged++
    }
}
$taskOkCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'btnOk')
$taskOk = $taskDialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$taskOkCondition)
$taskOk.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
[pscustomobject]@{Mode=$Mode;Sensitivity=[bool]$Sensitivity;EnableSettings=$taskTargets.Count;Changed=$taskChanged;ThresholdsChanged=$taskNumericChanged;Baseline=$BaselineExport}
