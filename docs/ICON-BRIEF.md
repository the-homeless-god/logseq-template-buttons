# Icon brief for AI generation

Use this brief when generating `icon.png` for the Logseq marketplace and plugin settings.

## Output file

| Property | Value |
| --- | --- |
| Filename | `icon.png` |
| Size | **512×512 px** (square) |
| Format | PNG, RGBA, no interlacing |
| Safe area | Keep main symbol inside central **420×420 px** (Logseq may crop corners in lists) |

## Concept

**Template Buttons** — one-click creation of Logseq pages from templates.

Visual idea: a **sidebar panel** with **stacked template cards** and a **plus / action** cue — not a generic “settings gear” or “document only” icon.

Suggested metaphor (pick one direction):

1. **Sidebar + buttons** — narrow vertical strip on the left, 2–3 rounded rectangles (buttons) with a small star or file glyph on the top one.
2. **Template stack** — two offset page sheets, front sheet with a small “play” or “+” badge (child page / action).
3. **Branch + page** — subtle git-branch node merging into a page outline (matches page-bar “child page” feature, but keep it simple).

## Style (match Logseq ecosystem)

- **Flat or soft flat**, minimal depth (light inner shadow at most).
- **2–3 colors** plus transparency; works on **light and dark** UI backgrounds.
- Rounded corners (8–12 px feel at icon scale).
- **No text**, no tiny labels, no photorealism.
- Line weight: medium-thick so the icon reads at **16–24 px** in the sidebar.

## Color palette (suggested)

| Role | Light mode | Dark mode friendly |
| --- | --- | --- |
| Primary accent | `#6B9FFF` (Logseq link blue) | same |
| Secondary | `#8B8B8B` or `#A0A0A0` | `#C0C0C0` |
| Background | transparent or very soft `#F0F4FF` circle | transparent preferred |

Avoid pure black fills; use dark gray `#2A2A2A` if a dark shape is needed.

## Do not

- Clipart office documents, Microsoft Word-style icons.
- Emoji-style faces or excessive gradients.
- Logseq official logo or trademarked assets.
- Busy backgrounds; marketplace thumbnails are small.

## Reference plugins (tone only)

Similar clarity to Logseq marketplace icons: simple glyph, one clear idea, readable at small size.

## After generation

1. Replace `/icon.png` in the repository root.
2. Run `yarn build` and reload the plugin in Logseq to verify sidebar + marketplace preview.
