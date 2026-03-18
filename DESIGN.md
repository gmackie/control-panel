# Design System — GMAC.IO Control Panel

## Product Context
- **What this is:** Unified infrastructure monitoring and control dashboard for the GMAC.IO application ecosystem
- **Who it's for:** Solo power user (gmackie) — ops-focused, data-literate, long-session use
- **Space/industry:** DevOps / infrastructure management (peers: Datadog, Grafana, Linear, Vercel, Railway)
- **Project type:** Data-dense web dashboard with real-time monitoring

## Aesthetic Direction
- **Direction:** Midnight Studio — Refined/Editorial
- **Decoration level:** Intentional — subtle card gradients, soft shadows, fine 1px borders on interactive elements. No noise textures, no patterns.
- **Mood:** Premium without pretension. Dark but warm. The kind of dashboard you'd show someone and they'd say "what is this? it's beautiful." Designed for clarity during long sessions.

## Typography
- **Display/Hero:** Satoshi (700, 800) — Geometric with personality. Distinctive without being loud. Use for page titles, hero headings, and section headers.
- **Body/UI:** Instrument Sans (400, 500, 600) — Clean, excellent legibility at small sizes. Carries all body text, labels, descriptions, and navigation.
- **UI/Labels:** Instrument Sans (500, 600) — same family as body, weight differentiation for hierarchy
- **Data/Tables:** Geist Mono (400, 500) — Tabular-nums, tight, readable at 13px. All metrics, table data, timestamps, and numeric values.
- **Code:** Geist Mono (400)
- **Loading:** Google Fonts for Instrument Sans and Geist Mono. Fontshare for Satoshi. Use `display=swap`.
  - `https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,800,900&display=swap`
  - `https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap`
  - `https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700&display=swap`
- **Scale:** 12px / 13px / 14px / 16px / 18px / 20px / 24px / 30px / 36px / 48px

## Color

- **Approach:** Restrained — color is intentional. Violet for actions, gold for highlights, status colors for system state. Everything else is neutral.

### Dark Mode (default)
- **Primary:** `#8B5CF6` (violet) — Actions, active states, links, focus rings
- **Primary hover:** `#7C3AED`
- **Primary subtle:** `rgba(139, 92, 246, 0.12)` — Backgrounds for primary badges/chips
- **Secondary:** `#D4A853` (soft gold) — Highlights, premium badges, warm accent
- **Secondary subtle:** `rgba(212, 168, 83, 0.12)`
- **Background:** `#141316` (warm near-black) — Slight purple undertone ties to primary
- **Surface/Card:** `#1C1A1F` — Lifted off background
- **Surface hover:** `#22202A`
- **Border:** `#2A2730` — Visible but quiet
- **Border subtle:** `#201E25` — Dividers within cards
- **Text primary:** `#F8F7FA` — High contrast on dark
- **Text secondary:** `#B5B2C1` — Body text, descriptions
- **Text muted:** `#8E8A9E` — Labels, metadata
- **Text dim:** `#6B6780` — Timestamps, tertiary info

### Light Mode
- **Primary:** `#7C3AED` — Slightly deeper for contrast on white
- **Primary hover:** `#6D28D9`
- **Primary subtle:** `rgba(124, 58, 237, 0.08)`
- **Secondary:** `#B8922F` — Darker gold for readability
- **Secondary subtle:** `rgba(184, 146, 47, 0.08)`
- **Background:** `#F8F7FA` — Warm off-white
- **Surface/Card:** `#FFFFFF`
- **Surface hover:** `#F3F2F6`
- **Border:** `#E4E2EA`
- **Border subtle:** `#EEEDF2`
- **Text primary:** `#141316`
- **Text secondary:** `#524F64`
- **Text muted:** `#6B6780`
- **Text dim:** `#8E8A9E`

### Semantic Colors
- **Success:** `#22C55E` (dark) / `#16A34A` (light) — Healthy, running, deployed
- **Warning:** `#EAB308` (dark) / `#CA8A04` (light) — Degraded, high usage, expiring
- **Error:** `#EF4444` (dark) / `#DC2626` (light) — Down, failed, critical
- **Info:** `#60A5FA` (dark) / `#2563EB` (light) — Deploying, informational, neutral status
- Subtle variants: 12% opacity (dark) / 8% opacity (light) for backgrounds

### Neutral Scale (warm gray with purple undertone)
| Step | Hex | Usage |
|------|-----|-------|
| 50 | `#F8F7FA` | Light mode bg, dark mode text |
| 100 | `#EEEDF2` | Light mode borders |
| 200 | `#D8D6E0` | Light mode dividers |
| 300 | `#B5B2C1` | Dark mode secondary text |
| 400 | `#8E8A9E` | Dark mode muted text |
| 500 | `#6B6780` | Dark mode dim text |
| 600 | `#524F64` | Light mode secondary text |
| 700 | `#3D3A4D` | — |
| 800 | `#2A2730` | Dark mode borders |
| 900 | `#1C1A1F` | Dark mode surfaces |
| 950 | `#141316` | Dark mode background |

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)

## Layout
- **Approach:** Grid-disciplined
- **Grid:** 12 columns, 24px gutters
- **Max content width:** 1440px
- **Border radius:** Hierarchical — sm: 8px (buttons, inputs), md: 12px (cards), lg: 16px (modals, sheets), full: 9999px (avatars, pills, badges)

## Motion
- **Approach:** Intentional — smooth and confident, no spring physics or overshoot
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(100ms) short(150-200ms) medium(250-300ms) long(400ms)
- **Rules:** No bounce. No spring. Fade-ins for entering elements, smooth transitions for state changes. Instant for micro-interactions (hover highlights, focus rings).

## Component Patterns

### Buttons
- **Primary:** Solid violet, white text. Use for main actions (Deploy, Save, Create).
- **Secondary:** Gold subtle background, gold text. Use for secondary actions (Promote, Highlight).
- **Outline:** Transparent bg, border, current text color. Use for tertiary actions (Configure, Edit).
- **Ghost:** No bg, muted text. Use for inline actions (View logs, Details).

### Badges / Status
- Always use semantic colors with subtle backgrounds (12%/8% opacity).
- Include a dot indicator (6px circle) before the label.
- Use Geist Mono at 11px for badge text.

### Cards
- Surface background with 1px border and soft shadow.
- 12px border radius.
- 24px internal padding.

### Data Tables
- Geist Mono for all table content.
- 11px uppercase headers in dim text.
- Subtle row hover (surface-hover).
- Tabular-nums for all numeric columns.

### Alerts
- Semantic color with subtle background and matching border (20% opacity).
- Icon + message layout.
- 8px border radius.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-17 | Initial design system: Midnight Studio | Refined/editorial direction chosen over current stone/green and two alternatives (Mission Control retro-futuristic, Monolith industrial). Selected for premium feel, long-session legibility, and warm visual depth. |
| 2026-03-17 | Satoshi + Instrument Sans + Geist Mono | Three-tier font stack: Satoshi for display personality, Instrument Sans for body legibility, Geist Mono for data precision. Replaces Figtree. |
| 2026-03-17 | Violet primary + gold secondary | Violet (#8B5CF6) for actions distinct from status colors. Gold (#D4A853) as warm counterpoint. Replaces green accent. |
| 2026-03-17 | Warm purple-tinted neutrals | Neutral scale with slight purple undertone ties to primary and creates cohesion. Replaces stone base. |
