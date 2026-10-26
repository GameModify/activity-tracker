#ifndef AppVersion
  #error AppVersion is required
#endif
#ifndef AppSource
  #error AppSource is required
#endif
[Setup]
AppId={{7DC4E549-3D1F-49E4-A4B4-BC37C02E37D1}
AppName=Activity Tracker
AppVersion={#AppVersion}
AppPublisher=GameModify
LicenseFile={#AppSource}\LICENSE.md
AppPublisherURL=https://github.com/GameModify/activity-tracker
DefaultDirName={localappdata}\Programs\ActivityTracker
DefaultGroupName=Activity Tracker
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#AppSource}\..
OutputBaseFilename=ActivityTracker-{#AppVersion}-windows-x64-setup
SetupIconFile={#AppSource}\assets\tracker.ico
UninstallDisplayIcon={app}\ActivityTracker.exe
AppMutex=Local\GameModify.ActivityTracker.3536
Compression=lzma2/fast
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
CloseApplications=yes
RestartApplications=no
[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"
[Tasks]
Name: "desktopicon"; Description: "Создать ярлык на рабочем столе"; Flags: unchecked
Name: "autostart"; Description: "Запускать трекер при входе в Windows"; Flags: unchecked
[Files]
Source: "{#AppSource}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\Activity Tracker"; Filename: "{app}\ActivityTracker.exe"
Name: "{autodesktop}\Activity Tracker"; Filename: "{app}\ActivityTracker.exe"; Tasks: desktopicon
[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "ActivityTracker"; ValueData: """{app}\ActivityTracker.exe"""; Flags: uninsdeletevalue; Tasks: autostart
[Run]
Filename: "{app}\ActivityTracker.exe"; Description: "Запустить Activity Tracker"; Flags: nowait postinstall skipifsilent
