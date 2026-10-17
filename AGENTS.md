# DropShot

Mobile-first badminton scorekeeping PWA. Svelte 5, TypeScript and Vite. `src/routes` contains screens, `src/lib` contains scoring, storage and voice logic, and `src/stores` contains app state. `4d/` is the older reference implementation, not the current app.

## Sources of truth

- Current code and tests define actual behavior. `STATE.md` is a short handoff of status and open questions; check `git status --short` and recent code because it may lag uncommitted work.
- `README.md` covers setup. `report.md` is background design, not necessarily current behavior.

## Working rules

- Do not silently change scoring semantics, saved match data, import/export formats or offline voice asset compatibility.
- Keep unrelated changes intact. Do not edit generated `dist/` or bundled files in `public/voice/` unless the task specifically requires it.
- Do not commit or push unless asked. State what was checked and what still needs a real-device test.

## Checks

- Run `npm test`, `npm run check` and `npm run build` for relevant code changes. Report any existing warnings separately from failures.
- Changes to voice recognition, microphone access, offline caching or PWA updates need a short manual phone test plan; passing unit tests alone does not prove device behavior.
