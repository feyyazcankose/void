# "Tasks | Editör" title bar toggle — build notes

Implementation of a Devin-style "Tasks | Editör" pill in the title bar + a mock Kanban pane.
Files: `voidTasksPane.ts`, `titlebar/tasksEditorToggleControl.ts`, `react/src/tasks-tsx/*`,
plus additive edits to `titlebarPart.ts` / `titlebarpart.css` / `tsup.config.js` / `void.contribution.ts`.

Two real bugs were hit during dev. Both are generic gotchas in this codebase, not specific
to this feature — worth remembering for any future custom title bar control or React pane.

## Bug 1: custom title bar controls need `position: relative; z-index: 2500`

Symptom: pill rendered correctly in `.titlebar-left`, was clickable-looking, but clicks did
nothing — no console output at all, not even from a click listener attached directly to the
element.

Cause: `titlebarPart.ts` prepends a `.titlebar-drag-region` (`position: absolute; width/height:
100%; -webkit-app-region: drag`) covering the whole title bar. CSS stacking rule: positioned
elements paint **above** static (non-positioned) siblings regardless of DOM order. Every
existing clickable title bar control (`.menubar`, `.command-center`, `.window-appicon`,
`.action-toolbar-container`) sets `position: relative; z-index: 2500;` specifically to lift
itself above this drag region. A new control that skips this is invisible to clicks even
though it renders fine visually.

Fix: any new element appended into `.titlebar-left/-center/-right` needs
`position: relative; z-index: 2500;` in its CSS, not just `-webkit-app-region: no-drag`
(that flag only affects native window-drag behavior, not DOM click delivery).

## Bug 2: new React panes render fully unstyled without `void-scope` + `styles.css` import

Symptom: Tasks pane opened fine, but rendered as plain unstyled HTML — no Tailwind colors,
spacing, borders, dark background, nothing.

Cause: the react build pipeline (`react/build.js`) runs `scope-tailwind ./src -o src2/
-s void-scope -c styles.css -p "void-"`. This does two things per file:
1. Rewrites every Tailwind class to a prefixed name (e.g. `bg-void-bg-1` → `void-bg-void-bg-1`).
2. Generates ONE shared `src2/styles.css` where every rule is scoped as
   `.void-scope .void-bg-void-bg-1 { ... }` — i.e. the rules only apply inside an ancestor
   carrying the literal class `void-scope`.

Every existing top-level pane component (`Settings.tsx`, `Sidebar.tsx`, `VoidTooltip.tsx`,
etc.) wraps its root `<div>` with `className={`@@void-scope ${isDark ? 'dark' : ''}`}`
(the `@@` is scope-tailwind's own marker, becomes `void-scope` after processing) and pulls
in the compiled stylesheet via `import '../styles.css'` somewhere in its component tree.
Skip either of these and the classes exist in the DOM but have zero matching CSS rules.

Fix (applied in `tasks-tsx/Tasks.tsx`):
```tsx
import '../styles.css'
...
const isDark = useIsDark() // from '../util/services.js'
return <div className={`@@void-scope ${isDark ? 'dark' : ''} ...`}>
```

## Bug 3: new EditorPane content invisible without `overflow: 'auto'` on the root

Symptom: pane opened, DOM was 100% correct (verified via Elements panel — right project,
right classes, right text), CSS was correctly scoped (Bug 2 fixed), yet **nothing rendered
on screen**. Confirmed with a maximally obvious test: swapped the real content for a
hardcoded `width:600px; height:600px; background:yellow; outline:3px solid red` div — still
completely invisible, even though it showed up correctly in the DOM inspector.

Root cause found by comparison, not by reasoning about the CSS in isolation: opened
`Void's Settings` (an existing, proven-working `EditorPane`, same base class, same mount
mechanism) side-by-side and diffed its root wrapper against ours.

- `Settings.tsx` root: `style={{ height: '100%', width: '100%', overflow: 'auto' }}`
- `Tasks.tsx` root (broken): `style={{ height: '100%', width: '100%' }}` — **no `overflow`**

Fix: add `overflow: 'auto'` to the pane's root `<div>` inline style, matching every other
working pane in this codebase exactly. Whatever VS Code's editor-group DOM chain is doing
around a mounted `EditorPane`'s content, a root `overflow: visible` (the CSS default, which
is what you get if you don't set `overflow` at all) apparently fails to size/paint properly
inside it, while `overflow: auto` works. Not fully root-caused at the VS Code layout-internals
level — treat this as an empirically-required, copy-this-exactly convention for any new
`EditorPane` content root, not something to "clean up" later.

### General lesson: when a new pane/control silently fails, diff it against a working one first

All three bugs above were eventually solved the same way: instead of reasoning abstractly about
this codebase's title bar CSS or the React build pipeline, the fast path was **finding the
closest existing, already-working equivalent and diffing against it line-by-line**:
- Title bar click bug → diffed against `.menubar`/`.command-center`/`.action-toolbar-container`'s
  CSS (`position: relative; z-index: 2500;`).
- Unstyled pane bug → diffed against `Sidebar.tsx`/`Settings.tsx` for the `void-scope` +
  `styles.css` import convention.
- Invisible pane bug → diffed against `Settings.tsx`'s root wrapper style object directly.

Before spending time hypothesizing about *why* something isn't rendering/working in this
codebase, find the nearest working analog first (an existing pane, an existing title bar
control, an existing build config) and diff against it. It's consistently faster than reasoning
from CSS/framework internals blind, and the fixes above were all small, copy-the-convention
one-liners once the right reference was found.

## Other things that tripped things up (smaller, but worth knowing)

- **`.build/electron/<X>.app` must match `product.json`'s current `nameLong`.** `scripts/code.sh`
  reads `nameLong` at launch time and looks for `.build/electron/$NAME.app`. If `nameLong`
  changes (e.g. someone edits product.json, or a linter reverts it) without re-running the
  electron sync step, `code.sh` fails with "No such file or directory". Quick fix: rename the
  existing `.app` folder to match the current `nameLong` rather than re-downloading Electron.

- **Workbench layering**: `src/vs/workbench/browser/**` (core) is not allowed to import from
  `src/vs/workbench/contrib/**` (enforced by the `eslint.config.js` layers rule — contrib may
  import core, never the reverse). A new core-side hook has to be a plain exported
  register/create function that contrib calls into (see `registerTitleBarLeftContentContribution`
  in `titlebarPart.ts`), not a direct import of contrib code from core.

- **Relative import depth**: files placed in a new subfolder under `contrib/void/browser/`
  (e.g. `contrib/void/browser/titlebar/*.ts`) need one more `../` than sibling files directly
  in `contrib/void/browser/` for every relative import to `base/`, `platform/`, `nls.js`, etc.
  Easy to get wrong by copy-pasting import lines from a shallower reference file.

- **React pane registration pattern**: full-editor-area panes (Settings, Tasks) use
  `EditorInput` + `EditorPane` + `Registry.as(EditorExtensions.EditorPane).registerEditorPane(...)`.
  Side-panel panes (the AI chat sidebar) use `ViewPane` + `registerViewContainer`/`registerViews`.
  Picking the wrong one gets you the wrong location in the UI.

- **`npm run buildreact` output has two copies**: the tsup output lands in
  `src/vs/workbench/contrib/void/browser/react/out/<pane>/index.js`, and a running
  `npm run watch` (gulp watch-client) mirrors it into
  `out/vs/workbench/contrib/void/browser/react/out/<pane>/index.js` — the second path is what
  `voidTasksPane.ts`'s compiled JS actually resolves at runtime. If watch-client isn't running,
  that mirrored copy goes stale and the app loads old JS even after `buildreact` succeeds.
