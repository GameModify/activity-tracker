export const desktopProbeScript = String.raw`
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class DiscordAccessibility { [DllImport("user32.dll")] public static extern IntPtr SendMessageTimeout(IntPtr h, uint m, IntPtr w, IntPtr l, uint f, uint t, out UIntPtr result); }'
$requestedHandles=[Collections.Generic.HashSet[long]]::new()
function Request-DiscordAccessibility($handle) {
  if(!$requestedHandles.Add([long]$handle)){return}
  $result=[UIntPtr]::Zero
  [void][DiscordAccessibility]::SendMessageTimeout($handle,0x003D,[IntPtr]::Zero,[IntPtr]::new(1),2,1000,[ref]$result)
}
function Read-WordDocument {
  $app=$null; $doc=$null; $window=$null
  try {
    $app=[Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application')
    $doc=$app.ActiveDocument; $window=$app.ActiveWindow
    $full=if($doc.Path){[string]$doc.FullName}else{''}
    return @{name=[string]$doc.Name;path=$full;window_handle=[long]$window.Hwnd}
  } catch { return $null }
  finally {
    foreach($item in @($window,$doc,$app)) {
      if($null -ne $item){[void][Runtime.InteropServices.Marshal]::ReleaseComObject($item)}
    }
  }
}
function Find-Label($root,$names,$button) {
  foreach($name in $names) {
    $condition=[Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::NameProperty,$name)
    if($button){$condition=[Windows.Automation.AndCondition]::new($condition,[Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::ControlTypeProperty,[Windows.Automation.ControlType]::Button))}
    $item=$root.FindFirst([Windows.Automation.TreeScope]::Descendants,$condition)
    if($null -ne $item){return $true}
  }
  return $false
}
function Read-DiscordVoice {
  $apps=@(Get-Process -Name Discord -ErrorAction SilentlyContinue | Where-Object MainWindowHandle -ne 0)
  if(!$apps.Count){return @{available=$false;disconnect=$false;reconnect=$false}}
  foreach($app in $apps) {
    try {
      Request-DiscordAccessibility $app.MainWindowHandle
      $root=[Windows.Automation.AutomationElement]::FromHandle($app.MainWindowHandle)
      $disconnect=Find-Label $root @('Disconnect','Отключиться','Disconnect from Voice','Отключиться от голосового канала') $true
      $reconnect=Find-Label $root @('Reconnect','Переподключиться') $true
      if($disconnect -or $reconnect){return @{available=$true;disconnect=$disconnect;reconnect=$reconnect}}
    } catch { return @{available=$true;disconnect=$false;reconnect=$false} }
  }
  return @{available=$true;disconnect=$false;reconnect=$false}
}
while($true) {
  $sample=@{observed_at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();word=(Read-WordDocument);discord=(Read-DiscordVoice)}
  $sample | ConvertTo-Json -Depth 4 -Compress
  Start-Sleep -Milliseconds 5000
}
`;
