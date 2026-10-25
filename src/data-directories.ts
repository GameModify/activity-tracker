import path from 'node:path';
export interface DesktopDirectories {
  directory: string;
  legacyDirectory: string;
}
export function desktopDirectories(profile: string, localData: string): DesktopDirectories {
  return {
    directory: path.join(profile, '.activity-tracker'),
    legacyDirectory: path.join(localData, 'ActivityTracker'),
  };
}
