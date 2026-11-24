import { useEffect, useId, useState } from "react";

import {
  CUSTOM_THEMES_STORAGE_KEY, loadCustomThemes, resolveWorkspaceTheme, saveCustomTheme,
  THEME_PRESETS, validateCustomTheme, type CustomWorkspaceTheme, type ThemeColorKey,
} from "./themes";
import type { WorkspaceTheme } from "./types";

const FIELDS: Array<{ key: ThemeColorKey; label: string }> = [
  { key: "background", label: "Background" }, { key: "text", label: "Text" },
  { key: "rise", label: "Rise" }, { key: "fall", label: "Fall" },
  { key: "buy", label: "Buy" }, { key: "sell", label: "Sell" }, { key: "accent", label: "Accent" },
];

export function ThemeSettings({ theme, onThemeChange }: { theme: WorkspaceTheme; onThemeChange: (theme: WorkspaceTheme) => void }) {
  const [library, setLibrary] = useState(loadCustomThemes);
  const [editor, setEditor] = useState<{ id?: string; draft: WorkspaceTheme }>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const helpId = useId();
  const displayedTheme = resolveWorkspaceTheme(theme, window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true);
  const validation = editor ? validateCustomTheme(editor.draft, library, editor.id) : undefined;

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === CUSTOM_THEMES_STORAGE_KEY || event.key === null) setLibrary(loadCustomThemes());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function openEditor(entry?: CustomWorkspaceTheme) {
    setEditor(entry ? { id: entry.id, draft: { ...entry.theme } } : { draft: { ...displayedTheme, preset: "" } });
    setError("");
    setNotice("");
  }

  function save(apply: boolean) {
    if (!editor) return;
    const result = saveCustomTheme(editor.draft, editor.id);
    if (result.error !== undefined) { setError(result.error); return; }
    setLibrary(result.library);
    setEditor({ id: result.entry.id, draft: { ...result.entry.theme } });
    setError("");
    setNotice(apply ? "Theme saved and applied." : "Theme saved. Apply it when you are ready.");
    if (apply) onThemeChange({ ...result.entry.theme });
  }

  function changeDraft(key: keyof WorkspaceTheme, value: string) {
    if (!editor) return;
    setEditor({ ...editor, draft: { ...editor.draft, [key]: value } });
    setError("");
    setNotice("");
  }

  return <div className="theme-popover" role="dialog" aria-label="Theme Settings">
    <div className="theme-popover-header">
      <div className="theme-popover-title">Theme Settings</div>
      <button type="button" className="theme-add-button" onClick={() => openEditor()}>+ Add theme</button>
    </div>
    <div className="theme-presets" aria-label="Built-in themes">
      {THEME_PRESETS.map((preset) => <button type="button" key={preset.preset} aria-pressed={theme.preset === preset.preset}
        className={theme.preset === preset.preset ? "is-selected" : ""} onClick={() => onThemeChange({ ...preset })}>{preset.preset}</button>)}
    </div>
    <section className="theme-library" aria-label="Custom themes">
      <strong>Custom themes</strong>
      {library.length ? library.map((entry) => <div className="theme-library-row" key={entry.id}>
        <button type="button" className={theme.preset === entry.theme.preset ? "is-selected" : ""}
          aria-pressed={theme.preset === entry.theme.preset} title={`Apply ${entry.theme.preset}`}
          onClick={() => { onThemeChange({ ...entry.theme }); setNotice("Theme applied."); }}>
          <span className="theme-swatch" aria-hidden="true" style={{ background: entry.theme.background, borderColor: entry.theme.accent }} />
          <span>{entry.theme.preset}</span>
        </button>
        <button type="button" aria-label={`Edit theme ${entry.theme.preset}`} onClick={() => openEditor(entry)}>Edit</button>
      </div>) : <p className="theme-help">No saved themes yet. Add a theme from your current palette.</p>}
    </section>
    {editor ? <form className="theme-editor" aria-label={editor.id ? "Edit theme" : "Create theme"} onSubmit={(event) => { event.preventDefault(); save(false); }}>
      <label className="theme-name-field">Theme name
        <input autoFocus maxLength={80} value={editor.draft.preset} onChange={(event) => changeDraft("preset", event.currentTarget.value)} aria-describedby={helpId} />
      </label>
      <p className="theme-help" id={helpId}>Saved in this browser. Rise and Fall color candles and volume bars; Buy and Sell color trade elements.</p>
      <div className="theme-editor-colors">
        {FIELDS.map((field) => <div className="theme-editor-color" key={field.key}>
          <label htmlFor={`${helpId}-${field.key}`}>{field.label}</label>
          <input type="color" aria-label={`${field.label} picker`} value={/^#[0-9a-f]{6}$/i.test(editor.draft[field.key]) ? editor.draft[field.key] : displayedTheme[field.key]}
            onChange={(event) => changeDraft(field.key, event.currentTarget.value)} />
          <input id={`${helpId}-${field.key}`} aria-label={`${field.label} HEX`} value={editor.draft[field.key]} maxLength={7}
            spellCheck={false} autoComplete="off" aria-invalid={!/^#[0-9a-f]{6}$/i.test(editor.draft[field.key])}
            onChange={(event) => changeDraft(field.key, event.currentTarget.value)} />
        </div>)}
      </div>
      {validation && <p className="theme-validation" role="status">{validation}</p>}
      <div className="theme-editor-actions">
        <button type="button" onClick={() => { setEditor(undefined); setError(""); setNotice(""); }}>Cancel</button>
        <button type="submit" disabled={!!validation}>{editor.id ? "Save" : "Create"}</button>
        <button type="button" className="theme-apply-button" disabled={!!validation} onClick={() => save(true)}>Apply</button>
      </div>
    </form> : <>
      <p className="theme-help">Current palette · changes apply immediately to this workspace.</p>
      <div className="theme-color-grid">
        {FIELDS.map((field) => <label key={field.key}>{field.label}<input aria-label={field.label} type="color" value={displayedTheme[field.key]}
          onChange={(event) => onThemeChange({ ...displayedTheme, preset: "Custom", [field.key]: event.currentTarget.value })} /></label>)}
      </div>
    </>}
    {error && <p className="theme-error" role="alert">{error}</p>}
    {notice && <p className="theme-help" role="status">{notice}</p>}
  </div>;
}
