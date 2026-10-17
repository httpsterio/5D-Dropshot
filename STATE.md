# Project state

See `README.md` for the overview and `report.md` for the detailed design.

### Status

Scorekeeping, history, stats, settings, and voice scoring work. Offline
sherpa-onnx voice now finalizes stable complete partials and reports diagnostics;
real-device voice behavior still needs verification.

### Done recently

- `c15ac82` Finalize complete offline partials after 500 ms, add finals/endpoints/last-final diagnostics, normalize sherpa finals, set both trailing-silence rules to 0.8 s.
- `92017fd` Add offline engine diagnostics and create/resume the AudioContext inside the mic tap handler for Android.
- `e4f2a7d` Add maskable app icons and dark PWA theme colors.
- `bcc83bb` Add the selectable sherpa-onnx WebAssembly offline speech engine.
- `3823243` Expand reason aliases and add the armed "Again?" retry and guide text.
- `7bbd02e` Add the configurable voice wake word with validation and readback filtering.
- `68fc3a5` Add point wake-word grammar for undo/help/arm and tone feedback.
- `cd26d38` Auto-apply PWA updates, holding a refresh while a match could lose data.

### In progress

None.

### Next

1. Test offline voice on the target phone across several matches; check the
   `finals`, `endpoints`, and `last final` diagnostics on the match screen.
2. Confirm that 0.8 s endpoint silence cuts short commands off quickly without
   firing too early; tune the rules if needed.
3. Verify that the 500 ms partial fallback does not log the same command twice
   after a reset, tone, or readback.

### Known issues

- Offline endpoint reliability is unverified on real hardware after `c15ac82`;
  use the diagnostics block in `src/routes/MatchView.svelte`.
- There is no automated test suite; only `npm run check` and `npm run build`.
- `src/routes/SettingsPlayers.svelte:102` still triggers the Svelte `autofocus`
  accessibility warning.
- `localStorage` quota/write failures are silently ignored in
  `src/lib/storage.ts:29`.
- The browser Back button does not drive the internal router in
  `src/stores/router.svelte.ts`.

### Decisions

- Voice commands run only on final results; complete offline partials are
  promoted after 500 ms because endpoint results were not reaching the command
  logic reliably.
- Bare wake-word/player partials wait for an endpoint, so a following reason is
  not cut off.
- Offline trailing-silence rules 1 and 2 are both 0.8 s; rule 3 (maximum
  utterance length) stays at 20 s.
- `MatchView.handleEngineFinal` normalizes both Chrome and sherpa-onnx text
  before parsing, because sherpa output may differ in case and spacing.
- Recognition is muted while speech or a tone plays, plus 1 s, so readback is
  never scored as a new command.
- `dist/` is generated and gitignored; it is not part of source history.

### Open questions

- Which phone and browser should be the primary target for offline voice tests?
- Once the offline engine is verified, should it become the default instead of
  Chrome?
- Is 0.8 s of trailing silence comfortable during real play, or should it be
  adjusted after on-device testing?
