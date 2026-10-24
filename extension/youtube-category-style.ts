export const categoryStyle = `
:host { display: inline-flex; min-width: 0; flex: 0 1 auto; align-self: center; margin-inline-start: 10px; font: 500 14px/1.4 Roboto, Arial, sans-serif; color: var(--yt-spec-text-primary, #0f0f0f); }
* { box-sizing: border-box; } button, select { font: inherit; color: inherit; }
button { cursor: pointer; } button:disabled, select:disabled { opacity: .6; cursor: default; }
.trigger { border: 1px solid var(--yt-spec-10-percent-layer, #ddd); border-radius: 22px; padding: 9px 14px; background: var(--yt-spec-badge-chip-background, #f2f2f2); white-space: nowrap; max-width: min(240px, 40vw); overflow: hidden; text-overflow: ellipsis; }
.panel { position: fixed; z-index: 3000; width: min(340px, calc(100vw - 24px)); max-height: calc(100vh - 24px); overflow: auto; padding: 18px; border: 1px solid var(--yt-spec-10-percent-layer, #ddd); border-radius: 16px; background: var(--yt-spec-base-background, #fff); box-shadow: 0 8px 28px #0003; font-weight: 400; }
[hidden] { display: none !important; } h3 { font-size: 16px; margin: 0 0 14px; font-weight: 500; }
label { display: grid; gap: 6px; margin-bottom: 12px; } select { width: 100%; min-width: 0; padding: 10px; border: 1px solid var(--yt-spec-10-percent-layer, #bbb); border-radius: 8px; background: var(--yt-spec-base-background, #fff); }
p { font-size: 13px; margin: 10px 0; overflow-wrap: anywhere; } .hint { color: var(--yt-spec-text-secondary, #606060); } .actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; }
.actions button { border: 0; border-radius: 20px; padding: 9px 15px; background: var(--yt-spec-badge-chip-background, #f2f2f2); } .actions .save { background: #6550c9; color: #fff; }
button:focus-visible, select:focus-visible { outline: 2px solid #9479ff; outline-offset: 2px; }
`;
