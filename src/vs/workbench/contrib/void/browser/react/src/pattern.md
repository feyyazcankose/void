# Safe layout pattern for full-pane EditorPane React content

Applies to any React component mounted as the root of a Void `EditorPane` (Settings, Tasks,
or any future full-tab pane) — NOT the AI chat sidebar (that's a `ViewPane`, different DOM
context, doesn't need this).

## The bug this avoids

Putting `display: flex` + `height: 100%` (or `h-full`) + `overflow: auto` all on the SAME
root element, with a `flex-1` child expected to take remaining width, silently breaks: the
`flex-1` child renders in the DOM with correct classes/content but collapses to zero
width/height — invisible, no console error, no layout warning. Confirmed by mounting the
proven-working `Settings` component directly in place of broken content: it rendered fine,
proving the pane/mount mechanism is not at fault — the combination of properties on one
element is.

## The pattern (copy this shape for any new full-pane React root)

```tsx
export const MyPane = () => {
	const isDark = useIsDark()
	return (
		<div
			className={`@@void-scope ${isDark ? 'dark' : ''}`}
			style={{ height: '100%', width: '100%', overflow: 'auto' }}
		>
			<div
				className="flex flex-col md:flex-row w-full ..."
				style={{ minHeight: '100%' }}
			>
				<Sidebar />   {/* plain width (w-64, md:w-1/4, ...), no h-full */}
				<MainArea />  {/* flex-1, no h-full */}
			</div>
		</div>
	)
}
```

Two levels, two different jobs:

1. **Outer root** — owns scrolling only. `height:100%; width:100%; overflow:auto`.
   No `display:flex` here, no `h-full` on this element beyond its own explicit height.
2. **Inner row** — owns the flex layout. `flex flex-col md:flex-row w-full`, sized by
   `minHeight: '100%'` (or a fixed/viewport-based min-height like Settings' `80vh`), **never**
   `height: 100%` / `h-full`. Its children (sidebar + main content) also skip `h-full` —
   they size to their own content naturally; the outer root scrolls if content overflows.

## Rules of thumb

- Never combine `flex` + `overflow:auto` + `height:100%` on one element in this pane type.
- A fixed/percentage width (`w-64`, `w-1/4`) on a flex child is safe. A `flex-1` child that
  also tries to force `h-full`/height:100% on itself is the risky combination — drop the
  height constraint, let it size to content, and let the outer root's `overflow:auto` handle
  any overflow.
- Every pane root still needs `@@void-scope ${isDark ? 'dark' : ''}` (from `useIsDark()`,
  `util/services.js`) and an `import '../styles.css'` somewhere in the tree, or Tailwind
  classes render with zero matching CSS (separate, unrelated gotcha — see
  `VOID_TASKS_FEATURE_NOTES.md`).
- If a new pane's content silently doesn't appear (DOM correct, no console error): don't
  guess — open an existing working pane (Settings) side by side and diff the root wrapper's
  className/style first. That's how this pattern was found.

Reference implementation: `tasks-tsx/Tasks.tsx` + `ProjectsSidebar.tsx` + `TasksBoard.tsx`.
