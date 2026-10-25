import { readFile, writeFile } from 'node:fs/promises';
import { NtExecutable, NtExecutableResource, Data, Resource } from 'resedit';
function versionInformation(version: string): Resource.VersionInfo {
  const info = Resource.VersionInfo.createEmpty();
  info.setFileVersion(version);
  info.setProductVersion(version);
  info.setStringValues(
    { lang: 1033, codepage: 1200 },
    {
      FileDescription: 'Activity Tracker',
      ProductName: 'Activity Tracker',
      CompanyName: 'GameModify',
      OriginalFilename: 'ActivityTracker.exe',
    },
  );
  return info;
}
export async function guiExecutable(target: string, icon: string, version: string): Promise<void> {
  const executable = NtExecutable.from(await readFile(process.execPath), { ignoreCert: true });
  executable.newHeader.optionalHeader.subsystem = 2;
  const resources = NtExecutableResource.from(executable);
  resources.entries = resources.entries.filter(
    (entry) => ![3, 14, 16].includes(Number(entry.type)),
  );
  const icons = Data.IconFile.from(await readFile(icon)).icons.map((item) => item.data);
  Resource.IconGroupEntry.replaceIconsForResource(resources.entries, 1, 0, icons);
  versionInformation(version).outputToResourceEntries(resources.entries);
  resources.outputResource(executable);
  await writeFile(target, Buffer.from(executable.generate()));
}
