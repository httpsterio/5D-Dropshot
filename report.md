# DropShot — Design & Behavior Report

A mobile-first offline PWA for keeping score in badminton matches. This document
describes every design decision, the reasoning, the expected behavior of each
feature, and a bug-hunt checklist. The goal is for an external reviewer (e.g.
Gemini) to scan the codebase against this spec and find inconsistencies, missing
edge cases, or outright bugs.

The previous vanilla-JS version of the app lives in `4d/` for reference. The
new build lives in the project root.

---

## 1. Goals & Constraints

- **Local-first, offline-capable PWA.** Installable. All data lives in
  `localStorage`. No backend, no network calls during normal use.
- **Mobile-first, iPhone 13 baseline (390×844).** Must work in portrait
  orientation, with safe-area insets respected. No horizontal overflow at any
  viewport ≥360px.
- **Vanilla rewrite was monolithic.** The new version separates concerns: data
  model, storage, derived stats, router, views, components.
- **Score tracker has a dedicated person** (the scorer is not a player). They
  can afford one extra tap per point to categorize a shot. UX must still be
  fast and resilient to mistakes (Undo).
- **Same data model can be exported/imported to and from JSON** so history is
  portable across devices.

---

## 2. Stack & Rationale

| Choice | Reason |
|---|---|
| **Svelte 5 + Vite** | Compiles to small vanilla JS (~37 KB gzipped total). HTML-like component files keep view + logic + scoped styles together. Vite gives instant dev start and `vite-plugin-pwa` for the service worker. |
| **TypeScript** | The data model has many cross-references (player IDs, shot type IDs, slot positions). Strong typing catches mismatches at build time. |
| **Tailwind 4 + DaisyUI 5** | DaisyUI is a Tailwind plugin providing semantic component classes (`btn`, `modal`, `input`, `card`, `badge`). Smaller and more opinionated than shadcn, which would be overkill. Tree-shakes to almost nothing. |
| **vite-plugin-pwa** | Auto-generates the service worker, manifest, and registers the SW. |
| **nosleep.js** | Prevents the screen from sleeping during an active match. |
| **localStorage (synchronous)** | The data set is tiny (hundreds of matches, thousands of points at most). Synchronous reads/writes simplify the store. No need for IndexedDB. |

Bundle target is mobile so size matters. Current production build is **~92 KB
JS / ~44 KB CSS / ~37 KB gzipped total**.

---

## 3. Data Model

All types live in `src/lib/types.ts`. Defaults in `src/lib/defaults.ts`.
Schema validation in `src/lib/schema.ts`.

```
Player {
  id: string (UUID)         // stable; never reused for a different person
  name: string              // display name; not used as an identifier
  createdAt: number
  deletedAt: number | null  // soft-delete timestamp; null = active
}

ShotType {
  id: string                // stable
  label: string             // e.g. "Smash", "Bad serve"
  attribution: 'winner' | 'error'
}

Point {
  scorerSlot: 'left' | 'right'  // which slot got the point
  shotTypeId: string             // references ShotType.id
  timestamp: number
}

ActiveMatch {
  id: string
  startedAt: number
  leftPlayerId: string | null   // can be null while a slot is unassigned
  rightPlayerId: string | null
  points: Point[]
  winPromptShown: boolean       // ensures the win-condition prompt only fires once
}

FinishedMatch {
  id: string
  startedAt: number
  endedAt: number
  leftPlayerId: string          // both required at save time
  rightPlayerId: string
  points: Point[]
  leftScore: number             // pre-computed snapshot of len(points where slot=left)
  rightScore: number
  winnerId: string | null       // null when tie
  loserId: string | null        // null when tie
  isTie: boolean
}

MatchConfig {
  winThreshold: number   // default 21
  winByMargin: number    // default 2
}

AppData {
  schemaVersion: number
  players: Player[]
  shotTypes: ShotType[]
  matches: FinishedMatch[]      // sorted desc by endedAt after each save
  config: MatchConfig
  activeMatch: ActiveMatch | null
  historyVersion: number        // increments on every history mutation; used as stats cache key
}

ExportFile {
  app: 'dropshot'
  schemaVersion: number
  exportedAt: number
  data: { schemaVersion, players, shotTypes, matches, config }   // no activeMatch, no historyVersion
}
```

### 3.1 Why player IDs are stable and renames don't propagate

When you rename a player, only the `name` field in the `Player` record
changes; matches reference players by `id`. Old matches keep showing the new
name automatically because the UI looks up the name from the player record at
render time.

Consequence: if you export, then rename, then look at an old match, it shows
the new name. This is intentional.

### 3.2 Why "soft delete"

Deleting a player must not remove them from history (you played a real match
against them). So delete only sets `deletedAt`:

- Deleted players are hidden from the new-match player picker.
- Deleted players still resolve when historic matches reference their ID.
- Player profile of a deleted player is still reachable via match detail.

If a player is deleted while assigned to the active match's slot, we clear
that slot (set to null). This is to prevent a saved match from referencing a
deleted player. (See §6 bug hunts.)

### 3.3 Why attribution lives on the shot type, not on each point

Each shot type carries an `attribution` flag of `winner` or `error`:

- **`winner`** = the scorer did something good. Credit the shot to the scorer.
- **`error`** = the opponent screwed up. Credit the shot to the opponent.

When computing stats, "responsible player" for a point = scorer if attribution
is winner, else the other slot's player. This avoids storing a redundant
`responsiblePlayerId` on every point, and keeps the `Point` record minimal.

Consequence: if you change a shot type's attribution after a match is saved,
historic stats will recompute differently. We accept this — labels and
attributions are configuration, and matches are immutable in points but not in
how those points are interpreted.

### 3.4 Slot semantics — why swap doesn't move points

The match view has a "left slot" and a "right slot." Each slot can be assigned
to a player at any time during the match. **Slots are positions, not
identities.** Points are attached to a slot, never to a player ID directly.

- If at the start of a match the scorer assigns Sami to left and starts
  logging points, then halfway through realizes they meant Marko, they swap
  the left slot from Sami to Marko. The points already on the left side stay
  on the left side. At save time, those points are credited to whoever is in
  the left slot at that moment.
- This makes the scorer free to fix the slot assignment any time without
  losing or corrupting points.
- Both slots must be assigned before the match can be saved. End-match attempt
  with an unassigned slot does nothing (and currently bounces the user back to
  Home — see §6).

### 3.5 Stats are always derived

There is no stored `wins` / `losses` field on a Player. All stats come from
`statsFor(playerId, matches, shotTypes, historyVersion)` in `src/lib/stats.ts`,
which iterates the relevant matches and points.

`historyVersion` increments on every history-changing operation (end match,
delete match, import). The stats function holds a module-level cache keyed by
`historyVersion`; when the version changes, the cache is wiped on the next
call. This avoids recomputing stats on every render.

### 3.6 Active match recovery

The `ActiveMatch` is part of `AppData` and persists to `localStorage` on every
mutation. On app boot, if `activeMatch !== null`, the user can resume from the
Home screen's "Active match" card or the Match tab.

The active match is cleared only when the user **explicitly ends or aborts**
it. Closing/backgrounding the app, switching tabs, hard-refreshing — all
preserve the active match.

---

## 4. Storage & Persistence

`src/lib/storage.ts` reads/writes the entire `AppData` blob under a single
key (`dropshot:v1`). On schema version mismatch, `migrate()` shallow-merges
the loaded data over `emptyAppData()` defaults and stamps the new version.

`src/stores/app.svelte.ts` mounts a Svelte 5 `$state` proxy over `AppData`
and uses `$effect.root` + `$effect` to **persist on every reactive change**.
Every mutation funnels through helper functions (`addPlayer`, `logPoint`,
`endMatch`, etc.) so the persistence path is uniform.

This means writes happen synchronously after each user action. There's no
debounce. The dataset is small enough that this is fine.

---

## 5. Features & Expected Behavior

### 5.1 Navigation

Stack-based router (`src/stores/router.svelte.ts`). Top of the stack is the
current view. The four root tabs are mutually exclusive — clicking a tab
**resets the stack** to that tab's root.

Drill-downs (history detail, player profile, settings sub-pages) push onto the
stack. The AppBar's back button pops.

**Bottom nav is hidden when there is an active match AND the current tab is
the match tab**, so the match view gets full-screen real estate. As soon as
the user switches tabs (e.g. via the Home card), the bottom nav reappears.

This is a deliberate UX choice — putting nav at the top would force scoring
controls down the screen, but the user wants scoring at the bottom for thumb
reach. Hiding the bottom nav during play gives both: native feel (bottom tabs)
and bottom-anchored scoring.

### 5.2 Home view

- **Active match card** (only if `activeMatch !== null`): shows current score,
  player names, started-at time. Tap to switch to the Match tab.
- **Big primary CTA**: "Start New Match" (or "Open Active Match" when one
  exists). Tapping calls `startMatch()` if needed and switches to the Match
  tab.
- **Stat tiles**: counts of active players and total finished matches.
- **Recent matches**: last 3 from history. Tapping opens match detail.

### 5.3 Match view

Layout (top to bottom):

1. App bar — title only, no back button (this is a tab root).
2. Player slot row — two halves, each shows the slot's assigned player name or
   "Player 1"/"Player 2" placeholder. Tap to open the player picker for that
   slot.
3. Score display — two huge tabular-nums numbers, one per slot.
4. "Last points" list — the last 3 points in reverse chronological order, with
   slot badge, scorer name, and shot label. Empty state shown when no points.
5. Action area — three small buttons (`Undo`, `Abort`, `End`) above two large
   primary buttons (`+ <leftName>` and `+ <rightName>`).

Behavior:

- **Auto-create**: on entering Match view with no active match, `startMatch()`
  is called automatically.
- **Tap "+ Player"**: if both slots are assigned, opens the shot-type picker.
  If a slot is unassigned, opens the player picker for the empty slot first.
- **Shot-type picker** (`PointTypePicker.svelte`): bottom sheet listing
  Winner-attribution types and Error-attribution types in two grids, with
  contextual headers ("X scored" / "Y error"). Tap a type to log the point.
  Cancel button dismisses without logging.
- **Undo**: pops the last point from `activeMatch.points`. Disabled when no
  points. No confirmation (Undo's whole job is to be cheap and reversible).
- **End**: opens a confirm modal. On confirm, finalizes the match (snapshots
  scores, sets winner/loser/tie, pushes to `matches[]`, sorts by `endedAt`
  desc, increments `historyVersion`, clears `activeMatch`) and switches to
  History.
- **Abort**: opens a confirm modal. On confirm, sets `activeMatch = null`
  without saving anything. Switches to Home.
- **Win condition prompt**: when `max(score) >= winThreshold` AND
  `|leftScore - rightScore| >= winByMargin`, a modal appears asking "End
  match? / Keep playing." Triggers exactly once per active match —
  `winPromptShown` is set to true on dismissal so it doesn't re-fire on
  subsequent points.
- **Player swap mid-match**: tapping a slot's name opens the player picker.
  The currently-assigned player on the **other** slot is excluded so the two
  sides can't be the same person. Selecting "— Unassigned —" clears the slot.

### 5.4 History view

Reverse-chronological list of finished matches. Each card shows the two
players, their scores, end time, duration, and "Tie" if applicable. The
winner's name and score render bold/green. Tap a row to open the detail view.

### 5.5 Match detail

- Header card mirrors the match summary (names, scores, time, duration).
- Numbered list of all points in play order with slot badge, scorer name, and
  shot label.
- "Delete match" button at the bottom — confirm-protected. Deletes from the
  list and bumps `historyVersion`. Locked otherwise (by design): saved matches
  are immutable. If something is wrong, edit the JSON manually and re-import.

### 5.6 Settings

Four sub-pages, each pushed onto the router stack:

- **Players**: list active players. Tap a row → player profile. Trash icon →
  confirm → soft-delete. "Add player" opens an input modal:
  - If the trimmed name (case-insensitive) matches an active player, the add
    is silently ignored (duplicate-name guard).
  - If it matches a soft-deleted player, the add modal is closed and a
    "Player exists" modal opens with three options: **Restore** (un-delete,
    same UUID, same stats), **Create new** (renames the old record to "Sami
    (deleted YYYY-MM-DD)" and creates a fresh one), **Cancel**.
  - Otherwise creates a new player.
- **Shot types**: two sections, Winners and Errors. Each row tappable to edit;
  trailing × to delete with confirm. "Add shot type" opens a modal with label
  input and Winner/Error radio (rendered as two big buttons). Edit reuses the
  same modal.
- **Match config**: two number inputs (win threshold, win-by margin). Bound
  reactively — the value is persisted on every change.
- **Data**: two sections.
  - Export: builds an `ExportFile`, blob-downloads it as
    `dropshot-YYYY-MM-DD.json`.
  - Import: hidden file input, accepts `application/json`. On selection, reads
    the file, parses, validates against the schema. If valid, opens a confirm
    modal warning that import replaces all data. On confirm,
    `replaceAll(data)` overwrites players, shot types, matches, config, clears
    active match, and bumps `historyVersion`. Toasts surface success/error.

### 5.7 Player Profile

- Three-tile W/L/T summary.
- Two-tile points-won / points-conceded summary.
- "Winning shots" list — every shot type with `attribution: 'winner'` that the
  player ever won points with, sorted by count desc, with raw count and
  percentage of all credited actions.
- "Errors made" list — same but for `attribution: 'error'` types where the
  player was the responsible side (i.e., they made the error).
- "Matches" list — every match the player participated in, with W/L/T badge
  and final score. Tap to open the match detail.

Stats use `statsFor(playerId, app.matches, app.shotTypes, app.historyVersion)`
and reflect the current history exactly.

### 5.8 Mobile chrome

- Viewport meta locks scale and uses `viewport-fit=cover` for safe areas.
- `apple-mobile-web-app-capable` for standalone iOS install.
- `theme-color` set to match the dark base.
- Body `user-select: none` (with input/textarea opt-back-in) to feel app-like.
- `overscroll-behavior: none` on root to prevent rubber-band.
- `tabular-nums` font feature on score numbers and timestamps.

---

## 6. Bug-Hunt Checklist (For Reviewer)

Look for these specifically. Each item is something that **should** behave a
certain way, or a place a real bug could plausibly hide.

### 6.1 Player lifecycle

- [ ] **Soft-delete with active assignment**: deleting a player who is the
  `leftPlayerId` or `rightPlayerId` of the active match should clear that
  slot. Verify the active match doesn't end up referencing a deleted player.
  Check `softDeletePlayer` in `src/stores/app.svelte.ts`.
- [ ] **Soft-delete and finished matches**: deleted players must still resolve
  when shown in history (their name should still appear, not "—" or empty).
- [ ] **Auto-restore by name**: case-insensitivity of the name comparison.
  `findPlayerByName` lowercases and trims; check that "  Sami " matches "sami".
- [ ] **Restore vs. Create new (escape hatch)**: when "Create new" is chosen,
  the old record is renamed with a `(deleted YYYY-MM-DD)` suffix. Confirm the
  old matches still display the new suffixed name (because they look up by
  ID), and the new player is a fresh UUID.
- [ ] **Duplicate active name guard**: typing an existing **active** player's
  name in Add Player silently closes the modal. Is silence the right UX, or
  should we surface a toast?
- [ ] **Empty / whitespace-only player name**: should not create. Verify
  `submitAdd` early-returns on `!name`.

### 6.2 Active match invariants

- [ ] **Slot uniqueness**: the player picker excludes the other slot's player.
  Verify there's no path that lets the same player end up on both slots
  (e.g. by setting left, then setting right while no one is on left, then
  back). The exclude logic uses the *current* other-slot value at picker open
  time.
- [ ] **End match with unassigned slot**: `endMatch()` returns null and the
  Match view bounces to Home. Should this instead show an error / keep the
  user on the match screen? Currently silent.
- [ ] **Win prompt edge cases**:
  - Score is `21-21` with margin 2: condition is `>=21 AND lead>=2`. Lead is
    0, so prompt does NOT fire. Correct.
  - User changes `winThreshold` mid-match (via Settings) to a value below the
    current score: prompt re-arming logic — `winPromptShown` is true after
    the first dismissal, so it won't re-fire even if conditions change. Is
    that the desired behavior? (We said yes — only ask once.)
  - User undoes back below threshold then climbs back up: prompt does NOT
    refire because `winPromptShown` stays true. Confirm this matches the
    "ask once" requirement.
- [ ] **Undo with empty points**: button should be disabled. Confirm.
- [ ] **Undo and the win prompt**: if the prompt fired and was dismissed
  ("keep playing"), then the user undoes back below threshold and the score
  re-meets it later — see above; should not re-prompt.
- [ ] **Match save when both `winnerId` and `loserId` are null**: only when
  `isTie` is true. Verify `endMatch()` sets these consistently.
- [ ] **Active match persistence across reload**: hard-refresh during a match.
  All points and slot assignments should restore. The `winPromptShown` flag
  also persists.
- [ ] **Active match across player deletion + import**: deleting a player
  clears the slot. What about replacing all data via import while a match is
  active? `replaceAll` clears `activeMatch` — confirm this is the right call
  (probably yes, since the imported data may reference different player IDs).

### 6.3 Shot types

- [ ] **Deleting a shot type that historic matches reference**: `getShotType`
  returns `undefined`, and the UI should fall back to "—" rather than crash.
  Verify in MatchDetail and in last-points list.
- [ ] **Stats for orphaned shot type**: `statsFor` skips points whose shot
  type can't be resolved (the `if (!shot) continue;` guard). Confirm this is
  what we want — the alternative is to count the point but as "unknown."
- [ ] **Editing a shot type's attribution after matches were played using it**:
  retro-active recomputation will move the credit between players. Verify
  this is intentional and `historyVersion` bumps so caches invalidate. (NOTE:
  `updateShotType` does NOT currently bump `historyVersion` — possible bug.
  Check whether stats stay stale after such an edit.)
- [ ] **Empty label**: `submit()` early-returns on `!l`. Verify.
- [ ] **All winners deleted, only errors remain (or vice versa)**: the
  PointTypePicker shows "No winner types defined" / "No error types defined"
  but otherwise lets you proceed. Score logging would then be impossible from
  the empty side. Acceptable?

### 6.4 Match config

- [ ] **`winThreshold` set to 0 or negative**: the input has `min=1` but a
  user could paste any value. `setConfig` accepts whatever. Verify the win
  prompt still behaves sensibly (e.g. doesn't fire at score 0-0).
- [ ] **`winByMargin` set to 0**: condition `|left-right| >= 0` is always
  true. Prompt fires the moment threshold is met regardless of lead. Is that
  acceptable? (Probably yes — user explicitly set 0.)
- [ ] **Non-integer input**: `Math.floor` truncates in the `$effect`. Confirm.
- [ ] **NaN input** (clearing the field): the effect guard
  `Number.isFinite(threshold) && threshold > 0` should prevent persistence of
  NaN. Verify.

### 6.5 Import / Export

- [ ] **Malformed JSON**: caught, "Invalid JSON" toast.
- [ ] **Wrong app marker**: `validateExportFile` rejects when `app !==
  'dropshot'`.
- [ ] **Schema version mismatch in import**: currently no version-specific
  migration on import (the file's `schemaVersion` is read but not enforced).
  Should an older export be migrated? Currently it's accepted as-is.
- [ ] **Forward compatibility**: an export from a future schemaVersion will
  pass the per-field type checks if the shapes match. May silently drop new
  fields. Acceptable for v1.
- [ ] **Import with empty arrays**: should leave the app in a clean state with
  no players, no matches, no shot types. (No defaults are reseeded after
  import.) Verify the user can still add things back via Settings.
- [ ] **Import while active match exists**: `replaceAll` clears active match.
  No prompt warns the user about losing the active match. Possible
  improvement.
- [ ] **Export contains active match?**: by design, no. `exportSnapshot()`
  excludes `activeMatch` and `historyVersion`. Verify.

### 6.6 Stats correctness

- [ ] **Tied match counts**: `isTie` set, `winnerId` and `loserId` null.
  Stats should increment `ties`, not `wins` or `losses`.
- [ ] **Self-match**: data model allows `leftPlayerId === rightPlayerId` only
  if the slot-uniqueness guard fails. Verify there's no path to it.
- [ ] **Player who only appeared as opponent (no points credited)**: their
  shotBreakdown should be empty, but `matches`, `wins`, `losses` should still
  count.
- [ ] **Percentage rounding**: `pct` is `count/total*100`. For a single shot
  it should be 100.0%. Confirm formatting (`toFixed(1)`).
- [ ] **`pointsConceded` accuracy**: the opponent's total score in matches
  the player participated in. Verify.
- [ ] **historyVersion bumps in all paths**: `endMatch`, `deleteMatch`,
  `replaceAll` bump. Are there other paths that mutate matches indirectly?
  E.g., `softDeletePlayer` doesn't bump `historyVersion` — should it?
  Player-name changes flow through but match contents are unchanged.

### 6.7 Routing

- [ ] **Tab switch from inside a drill-down**: switching tabs resets the
  stack to that tab's root. Verify back history doesn't leak across tabs.
- [ ] **Bottom nav hide rule**: hidden iff `tab === 'match' && app.activeMatch
  !== null`. So if you're on the Match tab with no active match, the nav is
  visible. Once `startMatch()` runs (auto on entering the view), the nav
  disappears.
- [ ] **Back from Match tab root**: AppBar shows no back button on tab roots,
  but the OS/browser back button is unhandled. There's no `popstate`
  listener — refreshing or pressing browser back currently does nothing
  meaningful. Acceptable for a PWA but worth noting.

### 6.8 Mobile / layout

- [ ] **No horizontal overflow** at 360–414 px wide viewports.
- [ ] **Touch targets** ≥48×48 px on all buttons and tap rows. The 3 small
  ghost buttons in the match action area (Undo/Abort/End) are `btn-sm` —
  measure and verify they're still tappable.
- [ ] **Safe-area insets**: top app bar and bottom nav both use safe-area
  classes. Modal sheets respect bottom inset.
- [ ] **Long player names**: truncate (`truncate` class) instead of overflowing.
  Verify in match view, history list, profile, last-points entries.
- [ ] **Many points in match detail**: scroll containment is on the inner div;
  the outer view is `h-full overflow-hidden`. Verify scroll works on long
  matches.
- [ ] **Modal scroll**: long content (e.g. profile inside player picker, or
  shot-type picker with many types) should scroll within `max-h-[88dvh]`.
- [ ] **Dark mode only**: `daisyui themes: dark --default`. iOS light/dark
  preference is ignored. Acceptable.

### 6.9 PWA / service worker

- [ ] **Manifest icons**: 192 and 512 only. iOS may want a separate
  apple-touch-icon, but home-screen install on iOS will fall back to the
  manifest icon. Verify install works.
- [ ] **Service worker cache invalidation after deploy**: `registerType:
  'autoUpdate'`. Stale data risk on update; user may need to refresh once.
  Acceptable for a personal-use PWA.
- [ ] **Offline boot**: with no network, the app should fully load from cache
  and access `localStorage` normally.
- [ ] **NoSleep activation**: the wake lock should engage exactly when an
  active match is showing on the Match tab. Confirm `nosleep.disable()` is
  called when the user leaves Match or aborts/ends.

### 6.10 General quality

- [ ] **Race conditions**: rapid double-tap on score buttons — do we log two
  points? Probably yes, which may not be desired. Worth checking.
- [ ] **localStorage quota**: at hundreds of matches with hundreds of points
  each, payload could grow toward MBs. Failures will silently throw in
  `save()`. We don't surface that to the user.
- [ ] **Numeric inputs**: ensure pasting non-numeric strings doesn't crash
  reactivity.
- [ ] **Date locale**: `toLocaleString` with no locale uses the user's
  system locale. Date strings in match records (shown but not stored as
  strings) will vary. The old app stored locale-formatted strings, which
  was a bug; the new app stores numeric timestamps and formats on render.
- [ ] **A11y**: visible focus rings, `aria-label` on icon-only buttons.
  `autofocus` on the Add Player input fires an a11y warning at build —
  intentional trade-off.

---

## 7. Things explicitly out of scope (so don't flag as missing)

- Multi-language / i18n.
- Doubles (4 players on court). Singles only.
- Cloud sync / accounts.
- Match editing after save (only delete or hand-edit JSON).
- Light theme.
- Cap rules (badminton's 30-cap rule isn't enforced; we play to threshold +
  win-by-margin with no upper bound).
- Renaming players (not in the UI; can be done via export → edit JSON →
  import).
- Tournament brackets, sets, games.
- Per-opponent stats breakdown on the player profile.
- Match start/end notifications.
