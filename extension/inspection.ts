import { contentFiles } from './content-build.ts';
import { z } from 'zod';
import { inspectDocument } from './document-probe.ts';
import { grantedSites } from './registration.ts';
import { recordFrame } from './diagnostics.ts';
import { mediaObservation } from './media-observation.ts';
import { send } from './http.ts';
import { settings } from './model.ts';
import { selectedSite } from './site-selection.ts';
import { sitePattern } from './sites.ts';
const probeSchema = z.object({
  origin: z.url(),
  position_seconds: z.number().nonnegative().optional(),
  duration_seconds: z.number().nonnegative().optional(),
  playing: z.boolean(),
  media_count: z.number().int().min(0).max(1000),
  frames: z.string().max(8192).array().max(50),
});
type ProbeResult = chrome.scripting.InjectionResult<unknown>;
async function recordProbe(result: ProbeResult, tab: chrome.tabs.Tab): Promise<boolean> {
  if (result.result === null) return false;
  const probe = probeSchema.parse(result.result);
  if (!selectedSite(await settings(), 'sites', probe.origin)) return false;
  const message = {
    type: 'media' as const,
    position_seconds: probe.position_seconds,
    duration_seconds: probe.duration_seconds,
    playing: probe.playing,
    media_count: probe.media_count,
    frames: probe.frames.flatMap((url) => {
      const site = sitePattern(url);
      return site ? [site] : [];
    }),
  };
  const playing = await recordFrame(message, { frameId: result.frameId, url: probe.origin }, tab);
  send([await mediaObservation(tab, playing)]);
  return true;
}
async function recordResults(results: ProbeResult[], tab: chrome.tabs.Tab): Promise<number[]> {
  const frameIds: number[] = [];
  for (const result of results) {
    if (await recordProbe(result, tab)) frameIds.push(result.frameId);
  }
  return frameIds;
}
export async function inspectTab(tabId: number): Promise<void> {
  const sites = await grantedSites(),
    tab = await chrome.tabs.get(tabId);
  const current = sitePattern(tab.url ?? '');
  if (tab.incognito || !current || !selectedSite(await settings(), 'sites', tab.url ?? '')) return;
  if (!(await chrome.permissions.contains({ origins: [current] }))) return;
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: inspectDocument,
    args: [sites.map((site) => site.slice(0, -2))],
  });
  const frameIds = await recordResults(results, tab);
  if (frameIds.length)
    await chrome.scripting.executeScript({
      target: { tabId, frameIds },
      files: contentFiles('content'),
    });
}
