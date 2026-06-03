---
name: vins-theming-rules
description: "CSS theming rules for VINS platform — CSS variables, never Tailwind dark:, rgba semantic colors"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2c01f4c2-63f4-4e14-afd3-cc34a9f69678
---

**Rule 1 — Use CSS custom variables for all colors.**
All theming is done via CSS variables defined in `:root` (light) and `.dark` class (dark) in `frontend/src/index.css`. ThemeContext toggles the `.dark` class on `<html>`.

**Rule 2 — NEVER use Tailwind `dark:` prefix.**
It won't work. Tailwind's dark mode variant expects `prefers-color-scheme` or a `class` strategy configured in `tailwind.config.js` that isn't set up here. Always use `style={{ color: 'var(--text-primary)' }}` or similar.

**Key CSS variables:**
- Backgrounds: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-card`
- Borders: `--border`, `--border-subtle`
- Text: `--text-primary`, `--text-secondary`, `--text-muted`
- Accent: `--accent`, `--accent-hover`, `--accent-light`, `--accent-dark`
- Semantic: `--success`, `--warning`, `--danger`
- Shadows: `--shadow`, `--shadow-md`, `--shadow-lg`

**Rule 3 — Use inline rgba() for semantic status colors in JSX.**
When Tailwind classes aren't precise enough, use these exact rgba values:
- Danger/red: `rgba(239,68,68,0.12)` bg / `rgb(239,68,68)` text
- Success/green: `rgba(34,197,94,0.12)` bg / `rgb(34,197,94)` text
- Warning/yellow: `rgba(234,179,8,0.12)` bg / `rgb(234,179,8)` text
- Purple/mention: `rgba(168,85,247,0.12)` bg / `rgb(168,85,247)` text

**Rule 4 — Component classes over inline styles where possible.**
`index.css` defines `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.card`, `.input`, `.textarea`, `.tag`, `.badge`, `.page-container`.

**Rule 5 — No gradients.**
No `linear-gradient`, `radial-gradient`, or gradient blobs. Flat solid colors and border accents only.

**Font:** Montserrat (from Google Fonts), system-ui fallback.

**Why:** ThemeContext uses `.dark` class on `<html>`. Tailwind `dark:` variant isn't configured to read this class. Inline rgba ensures correct visual states in both themes.

**How to apply:** Any time you add a colored element, use `var(--...)` or the rgba values above. If tempted to write `dark:text-white`, stop and use `style={{ color: 'var(--text-primary)' }}` instead.
