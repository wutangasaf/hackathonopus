# Plumbline — Design Kit

**Status:** authoritative
**Owner:** founder
**Last updated:** 2026-04-23
**Files this document governs:** every UI surface in the Plumbline product and marketing site.

---

## 0. How to use this document (instructions for AI agents)

You are generating UI for **Plumbline** — an AI co-pilot that produces signable draw verdicts for bank-financed construction. Treat this kit as the source of truth.

**Before you write any UI code:**
1. Read §1 (Brand) so the *voice* matches.
2. Read §2 (Tokens) and use only the tokens defined there. Do not invent new colors, fonts, or radii.
3. For an existing component, copy the snippet from §3 verbatim, then customize content. Do not re-derive.
4. For a new component, follow the rules in §4 (Patterns) and §5 (Anti-patterns).
5. Before declaring done, run through §8 (Acceptance checklist).

**When in conflict** between this kit and any other instruction, follow this kit. If the user explicitly overrides a rule, ask once whether the override should be permanent (i.e., should the kit be updated).

**When making judgment calls,** prefer:
- **Density over decoration.** Plumbline is a banker-grade tool. Information per pixel matters.
- **Sharp over soft.** Right angles, hairlines, monospace numbers. No rounded card corners.
- **Mono for data, sans for prose.** Always. (See §2.2.)
- **Black, white, and one warm orange.** No greys-as-color, no second accent.

---

## 1. Brand foundations

### 1.1 What Plumbline is
An AI co-pilot for bank-financed construction. It ingests three things — approved plans, the finance plan with milestones, and phone photos from the jobsite — and produces the **draw verdict** (APPROVE / APPROVE WITH CONDITIONS / DISPUTE) the bank funds against. Every cell cites photos. Every deviation carries a flag. Every verdict is traceable.

### 1.2 Audience
Construction lenders, CRMC officers, builders' compliance staff. They sign legal artifacts. They are not delighted by glitz; they are reassured by precision.

### 1.3 Voice
- **Declarative, not promotional.** "Build to plan. Release on proof." Not "Revolutionary AI for construction!"
- **Domain-specific vocabulary.** G703, SOV, draw, milestone, CO, dry-in, MEP rough. Never strip this language to sound friendly.
- **Short clauses.** Most sentences ≤ 14 words. Hero headlines: 1–4 words per line.
- **No exclamation marks.** Ever.
- **Numbers carry meaning.** Show them; don't hide them in adjectives.

Examples of in-voice / out-of-voice:

| In voice | Out of voice |
|---|---|
| "Verified. Cited. Signable." | "Trusted by leading lenders!" |
| "$2,000,000 · Approve with conditions" | "Big approvals made easy" |
| "Seven narrow agents." | "A powerful AI workflow" |
| "Released on proof." | "Streamlining construction finance" |

### 1.4 Three design principles

1. **Show the artifact.** Don't describe what Plumbline produces; render a sample of it. The hero should preview the report; the report section should *be* the report.
2. **Hairlines, not boxes.** Separations are made with 1px lines, mono labels, and whitespace. Avoid heavy shadows, gradients, or container chrome.
3. **The orange is structural.** `#ff6b1a` is not decoration; it marks the *plumbline* — the vertical truth-line that runs through every page, every section header, every key word in a verdict.

---

## 2. Tokens

### 2.1 Color

All colors live in CSS custom properties on `:root` (already in `src/index.css`). Use semantic names, never raw hex, in components.

```css
:root {
  /* Surfaces — dark stack, never use white as a surface */
  --bg:           #0a0a0a;            /* page */
  --bg-1:         #111111;            /* card */
  --bg-2:         #161616;            /* nested card / matrix cell */
  --bg-3:         #1d1d1d;            /* progress track / divider tier 3 */

  /* Foregrounds */
  --fg:           #f5f5f5;            /* body, headlines */
  --fg-dim:       #8a8a8a;            /* secondary text, leads */
  --fg-muted:     #555555;            /* tertiary, mono micro-labels, footer */

  /* Lines — used as borders and as 1px-grid backgrounds */
  --line:         rgba(255,255,255,0.08);   /* default hairline (within a card) */
  --line-strong:  rgba(255,255,255,0.18);   /* between sections, around cards */

  /* Brand accent — the plumbline */
  --accent:       #ff6b1a;
  --accent-dim:   rgba(255,107,26,0.14);    /* tinted background for accent chips */
  --accent-glow:  rgba(255,107,26,0.55);    /* shadow under live dots, etc. */

  /* Status — only for verdict states, never for general UI */
  --success:      #00d97e;            /* verified, approve */
  --warn:         #ffb800;            /* partial, attention */
  --danger:       #ff3b30;            /* deviated, dispute */
}
```

**Tailwind theme extension** (mirrors the CSS vars):

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        bg:    'var(--bg)',
        'bg-1':'var(--bg-1)',
        'bg-2':'var(--bg-2)',
        'bg-3':'var(--bg-3)',
        fg:    'var(--fg)',
        'fg-dim':  'var(--fg-dim)',
        'fg-muted':'var(--fg-muted)',
        line:        'var(--line)',
        'line-strong':'var(--line-strong)',
        accent:  'var(--accent)',
        success: 'var(--success)',
        warn:    'var(--warn)',
        danger:  'var(--danger)',
      },
    },
  },
};
```

**Usage rules:**

- **Never** introduce a color outside this set. If you need a new tint, dim or brighten an existing token via opacity (`bg-accent/10`) or via a sibling token (`--bg-2` exists for a reason).
- Status colors (`success`, `warn`, `danger`) are reserved for **verdict states**. Don't use green for "save," yellow for "warning toast," red for "delete." Use orange for primary actions; use the line tokens for secondary affordances.
- `accent` is precious. Maximum density rule of thumb: **two accent moments per viewport.** A nav CTA + one accent word in the headline = correct. Six orange icons = wrong.
- Text on `--accent` is **`#000`**. Never white-on-orange.

### 2.2 Typography

Two faces only. Sans for prose and headlines, mono for everything that's data, micro-label, eyebrow, or numeric.

```css
:root {
  --sans: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  --mono: ui-monospace, "SFMono-Regular", "JetBrains Mono", Menlo, Consolas, monospace;
}

body { font-family: var(--sans); line-height: 1.5; -webkit-font-smoothing: antialiased; }
```

**Type scale** (use these, don't invent in-between sizes):

| Role | Size | Weight | Tracking | Line-height | Family |
|---|---|---|---|---|---|
| Display XXL (hero headline) | `clamp(56px, 9.4vw, 148px)` | 900 | -0.055em | 0.88 | sans |
| Display XL (closing CTA) | `clamp(48px, 7.5vw, 120px)` | 900 | -0.05em | 0.92 | sans |
| Display L (chapter h2) | `clamp(34px, 4.4vw, 60px)` | 800 | -0.035em | 1.0 | sans |
| Display M (card h3) | 30px | 800 | -0.022em | 1.05 | sans |
| Body XL (hero sub) | `clamp(15px, 1.35vw, 19px)` | 400 | normal | 1.55 | sans |
| Body L (lead) | 16px | 400 | normal | 1.6 | sans |
| Body M (default) | 14px | 400 | normal | 1.6 | sans |
| Body S (card body) | 12-13px | 400 | normal | 1.55 | sans |
| Mono XL (verdict amount) | 44px | 800 | -0.035em | 1 | sans (yes — amounts are display-sans, not mono) |
| Mono L (stat value) | 26px | 600 | -0.02em | 1 | mono |
| Mono M (button) | 11px | 600 | 0.16em | 1 | mono |
| Mono S (eyebrow / chip) | 11px | 500 | 0.14-0.16em | 1 | mono |
| Mono XS (cadence, footer) | 10px | 500 | 0.12-0.14em | 1 | mono |
| Mono XXS (matrix header) | 9px | 600 | 0.08em | 1 | mono |

**Casing:** all mono labels are `text-transform: uppercase`. Sans text is sentence case. Never use uppercase on sans except for the brand wordmark.

**Headline rule:** key business words ("plan", "proof", "verdict", "agents", "Signable") get `color: var(--accent)` inline via `<span class="accent">…</span>`. Never more than two accent words per headline.

### 2.3 Spacing & layout

**Base grid:** 4px. Allowed step ladder: `4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 120`. Don't pick 18, 22, 30, 38.

```css
:root {
  --container: 1280px;
  --gutter: 32px;          /* desktop */
  --section-pad: 96px;     /* vertical padding inside <section> */
  --nav-h: 64px;
}
```

**Container:** `max-width: 1280px`, gutters `32px` desktop / `20px` mobile. Wider than 1280 lets type lines exceed comfortable measure.

**Vertical rhythm:**

- Hero: top `56px`, bottom `96px`.
- Section: `96px` top + bottom (Tailwind `py-[96px]`).
- Closing CTA: top `120px`, bottom `80px`.
- Footer: `40px` top + bottom.
- Inside a section: header → content gap `56px`, header internal padding-bottom `32px`.

**Section dividers:** 1px `var(--line-strong)`. Within a card: 1px `var(--line)`. Never use box-shadow as a divider.

**Breakpoints:**

```css
/* desktop-first */
@media (max-width: 1100px) { /* hero stacks; verdict card centers */ }
@media (max-width: 860px)  { /* sections collapse to single column; section pad shrinks to 64px */ }
@media (max-width: 480px)  { /* gutters shrink to 16px; nav links collapse */ }
```

### 2.4 Motion

Restrained. Three patterns only.

| Pattern | Where | Spec |
|---|---|---|
| `pulse` | Live status dots (verdict card, nav indicator if any) | `1.8s ease-in-out infinite`, opacity 1↔0.55, scale 1↔0.85 |
| `bob` | Plumbline-rail head | `4.5s ease-in-out infinite`, `translateY(0↔8px)` |
| `glow` | Optional on accent decorative cells (sparingly) | `3.6s ease-in-out infinite`, opacity 1↔0.45 |

Hover: 180ms ease, color or background change only. **No hover translate, no hover scale > 1.08, no flip animations.**

Respect `@media (prefers-reduced-motion: reduce)` — disable all infinite animations.

### 2.5 Borders & elevation

- **Radius:** `0` everywhere. Plumbline does not round corners. The only exception is fully-circular status dots (`border-radius: 50%`) — they're shapes, not containers.
- **Shadows:** avoid. The single permitted shadow is on the verdict card (large soft drop to lift it from the page background): `0 30px 80px -30px rgba(0,0,0,0.6)`. That's it.
- **Inset highlight:** for premium surfaces (verdict card), a 1px inner highlight is allowed: `0 1px 0 rgba(255,255,255,0.04) inset`.
- **Borders are color, not weight.** Always `1px solid`. Use `var(--line)` for within-card lines and `var(--line-strong)` for section/card boundaries.

### 2.6 Iconography

Plumbline does not lean on icons. The **typography is the system.** Use icons only for:
- The arrow `↗` after a primary CTA ("Start a project ↗")
- The arrow `→` for rare inline links
- The `·` (middle dot) for label separation in mono micro-text ("Once at loan origination · Versioned on CO")

If you must add an icon, use **Lucide** at 16px stroke 1.5 in `var(--fg-dim)`. Do not introduce a second icon library.

---

## 3. Component library

Each component is given as a self-contained Tailwind/JSX snippet. Copy verbatim, then customize content.

### 3.1 Nav (sticky top)

```tsx
<nav className="sticky top-0 z-50 bg-bg/80 backdrop-blur-md backdrop-saturate-150 border-b border-line">
  <div className="max-w-[1280px] mx-auto px-8 h-16 flex justify-between items-center">
    <a href="/" className="flex items-center gap-2.5 font-mono text-[13px] font-bold tracking-[0.16em] uppercase">
      <span className="inline-block w-[3px] h-3.5 bg-accent" style={{ boxShadow: '0 0 12px rgba(255,107,26,0.55)' }} />
      Plumbline
    </a>
    <ul className="flex gap-9 font-mono text-[11px] tracking-[0.14em] uppercase">
      <li><a href="#inputs"   className="text-fg-dim hover:text-fg transition-colors">Inputs</a></li>
      <li><a href="#pipeline" className="text-fg-dim hover:text-fg transition-colors">Pipeline</a></li>
      <li><a href="#report"   className="text-fg-dim hover:text-fg transition-colors">Report</a></li>
      <li><a href="#start"    className="text-black bg-accent px-3.5 py-2 hover:bg-[#ff8940] transition-colors">Open app ↗</a></li>
    </ul>
  </div>
</nav>
```

### 3.2 Buttons

Two variants only. **Primary** (filled accent) and **Ghost** (outlined). No third variant.

```tsx
// Primary
<a href="#" className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-accent text-black font-mono text-[11px] font-semibold tracking-[0.16em] uppercase hover:bg-[#ff8940] hover:shadow-[0_0_0_3px_rgba(255,107,26,0.18)] transition-all">
  Start a project <span>↗</span>
</a>

// Ghost
<a href="#" className="inline-flex items-center gap-2.5 px-6 py-3.5 text-fg border border-line-strong font-mono text-[11px] font-semibold tracking-[0.16em] uppercase hover:bg-bg-1 hover:border-fg-dim transition-all">
  See the pipeline
</a>
```

**Rules:**
- One primary per viewport.
- Buttons are square (no radius). Use horizontal padding `px-6` (24px), vertical `py-3.5` (14px).
- Button label is mono uppercase, `tracking-[0.16em]`.
- Trailing `↗` arrow on primary CTA only.

### 3.3 Eyebrow

A mono micro-label preceded by an orange dot. Marks the start of a section header or any chapter-like block.

```tsx
<div className="inline-flex items-center gap-2.5 font-mono text-[11px] tracking-[0.16em] uppercase text-fg-dim">
  <span className="w-1.5 h-1.5 bg-accent" style={{ boxShadow: '0 0 8px rgba(255,107,26,0.5)' }} />
  Built with Opus 4.7 · Apr 2026
</div>
```

### 3.4 Chapter divider (section header)

Anchors a section. Left rail holds the eyebrow; right column holds the headline + lead.

```tsx
function Chapter({ number, title, lead }: { number: string; title: React.ReactNode; lead: string }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-16 items-end mb-14 pb-8 border-b border-line">
      <div className="font-mono text-[11px] tracking-[0.16em] uppercase text-fg-dim pl-3.5 relative">
        <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-accent" />
        {number}
      </div>
      <div>
        <h2 className="text-[clamp(34px,4.4vw,60px)] font-extrabold tracking-tight leading-none">
          {title}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-fg-dim max-w-[620px]">{lead}</p>
      </div>
    </div>
  );
}

// usage
<Chapter
  number="01 · Inputs"
  title={<>Three inputs.<br/>One <span className="text-accent">verdict</span>.</>}
  lead="Every Plumbline verdict is the composition of three things — the plans the bank pinned to the loan, the finance plan that prices them, and the imagery that proves them. Each arrives on its own cadence."
/>
```

### 3.5 Card (input card pattern)

Used for the three inputs and any similar enumerated set.

```tsx
<div className="bg-bg p-9 min-h-[320px] flex flex-col justify-between transition-colors hover:bg-[#0c0c0c]">
  <div className="flex justify-between items-start">
    <span className="font-mono text-[11px] tracking-wider text-fg-muted">01</span>
    <span className="inline-block px-2.5 py-1 border border-line-strong font-mono text-[10px] tracking-wider uppercase text-fg-dim">PDF · slow</span>
  </div>
  <div>
    <h3 className="text-[30px] font-extrabold tracking-tight leading-tight mt-9">Construction plans</h3>
    <p className="mt-3.5 text-fg-dim text-sm leading-relaxed">Architectural, structural, electrical, plumbing drawings…</p>
  </div>
  <div className="mt-7 font-mono text-[10px] tracking-wider uppercase text-fg-muted">
    Once at loan origination · Versioned on CO
  </div>
</div>
```

For a **grid of cards**, draw the dividers with the grid background trick (no per-card borders):

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-px border border-line-strong" style={{ backgroundColor: 'var(--line-strong)' }}>
  {/* each card has bg-bg → the grid gap shows the divider color */}
</div>
```

### 3.6 Chip

Inline meta-tag. Mono micro-text inside a 1px box.

```tsx
<span className="inline-block px-2.5 py-1 border border-line-strong font-mono text-[10px] tracking-wider uppercase text-fg-dim">
  PDF · slow
</span>

// "Live" variant uses accent
<span className="inline-block px-2.5 py-1 border border-accent/40 font-mono text-[10px] tracking-wider uppercase text-accent">
  IMG · live
</span>
```

### 3.7 Status badge (verdict state)

```tsx
// success
<span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-success/10 border border-success/30 font-mono text-[12px] tracking-wider uppercase text-success">
  Approve with conditions
</span>

// danger
<span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-danger/10 border border-danger/30 font-mono text-[12px] tracking-wider uppercase text-danger">
  Dispute
</span>
```

### 3.8 Live status dot

```tsx
<span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-wider uppercase text-success">
  <span className="w-[7px] h-[7px] bg-success rounded-full animate-pulse" style={{ boxShadow: '0 0 10px rgba(0,217,126,0.7)' }} />
  Live
</span>
```

### 3.9 Progress bar (verdict card row)

```tsx
function ProgressRow({ label, pct, variant = 'ok' }: { label: string; pct: number; variant?: 'ok' | 'warn' | 'dev' }) {
  const fill = variant === 'warn' ? 'bg-warn' : variant === 'dev' ? 'bg-danger' : 'bg-success';
  return (
    <div className="grid items-center gap-3" style={{ gridTemplateColumns: '90px 1fr 32px' }}>
      <span className="font-mono text-[10px] tracking-wider uppercase text-fg-muted">{label}</span>
      <span className="block h-1.5 bg-bg-3 relative overflow-hidden">
        <i className={`absolute left-0 top-0 bottom-0 ${fill}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="font-mono text-[10px] text-fg-dim text-right">{pct}%</span>
    </div>
  );
}
```

### 3.10 Matrix cell (Gap Report grid)

Cell colors carry meaning — see status colors.

```tsx
<div className="bg-bg-2 aspect-square flex items-center justify-center font-mono text-[10px] font-semibold cursor-pointer transition-transform hover:scale-110 hover:z-10 relative">100</div>

// variants
<div className="… bg-success/85 text-[#003d24]">100</div>      {/* ok */}
<div className="… bg-warn/80 text-[#3d2d00]">78</div>          {/* partial */}
<div className="… bg-danger/85 text-[#3d0000]">62</div>        {/* dev */}
<div className="… border border-dashed border-fg-muted text-fg-muted">—</div>  {/* miss */}
<div className="bg-bg-1 opacity-30"></div>                     {/* na */}
```

### 3.11 Verdict card (hero artifact)

Full implementation in `REDESIGN-NOTES.md` §3. The signature features:
- Stacked-paper depth (two ghost rectangles slightly rotated behind)
- Orange left-edge tab (`absolute -left-px top-0 bottom-0 w-0.5 bg-accent`)
- Live pulse dot in head
- Display-sans amount (`44px` font-extrabold)
- Three to four progress rows (Architecture / Structural / Plumbing / Electrical)
- Foot row with deviation count chip + generation timestamp

### 3.12 Footer

```tsx
<footer className="py-10 font-mono text-[11px] tracking-wider text-fg-muted">
  <div className="max-w-[1280px] mx-auto px-8 flex justify-between items-center flex-wrap gap-4">
    <div className="flex items-center gap-4">
      <span className="inline-block w-[3px] h-3 bg-accent" />
      <span>PLUMBLINE · Build to plan. Release on proof.</span>
    </div>
    <div>© 2026 · <a href="#" className="text-fg-dim hover:text-fg">GitHub ↗</a></div>
  </div>
</footer>
```

---

## 4. Page patterns

### 4.1 The plumbline rail

A 1px orange line running down the left edge of every page. Brand structure, not decoration.

```css
body::before {
  content: "";
  position: fixed;
  left: 0; top: 64px; bottom: 0;
  width: 1px;
  background: linear-gradient(to bottom,
    rgba(255,107,26,0.55) 0%,
    rgba(255,107,26,0.18) 35%,
    rgba(255,107,26,0.06) 70%,
    transparent 100%);
  pointer-events: none;
  z-index: 5;
}
```

**Optional bob-head** (for marketing pages, not in-app):

```css
body::after {
  content: "";
  position: fixed;
  left: -3px; top: 64px;
  width: 7px; height: 7px;
  background: var(--accent);
  box-shadow: 0 0 14px rgba(255,107,26,0.8);
  z-index: 6;
  animation: bob 4.5s ease-in-out infinite;
}
@keyframes bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(8px) } }
```

### 4.2 Section rhythm

Every marketing-page section follows this skeleton:

```tsx
<section id="…" className="border-b border-line-strong py-[96px] relative">
  <div className="max-w-[1280px] mx-auto px-8">
    <Chapter number="0X · Section name" title={…} lead={…} />
    {/* section content */}
  </div>
</section>
```

Vertical rhythm (top → bottom): `96px` → eyebrow → headline → 18px → lead → 56px → content → `96px` → next section's `border-b border-line-strong`.

### 4.3 Hero pattern

Two-column grid on desktop (`1.4fr 1fr`), stacks at `≤1100px`. **Always show the artifact** in the right column — never abstract decoration. On marketing pages this is the verdict card; on app screens it's a real list/table preview.

Above-the-fold checklist for hero on a 1280×800 viewport:
- [ ] Eyebrow + headline + sub + CTAs + stats fit in the first viewport
- [ ] No more than `56px` top padding
- [ ] One primary, one ghost button
- [ ] Stats row: 3 stats, mono values, mono micro-labels

### 4.4 Closing CTA pattern

Centered, larger headline than chapter h2, restates the brand promise, two buttons (primary + ghost). Subtle radial accent glow behind.

```tsx
<section id="start" className="relative overflow-hidden border-b border-line text-center py-[120px]">
  <div className="absolute left-1/2 top-[-120px] -translate-x-1/2 w-3/5 h-[360px] pointer-events-none"
       style={{ background: 'radial-gradient(ellipse at center, rgba(255,107,26,0.07), transparent 65%)' }} />
  <div className="max-w-[1280px] mx-auto px-8 relative">
    <Eyebrow>Start a project</Eyebrow>
    <h2 className="mt-4 text-[clamp(48px,7.5vw,120px)] font-black tracking-tighter leading-[0.92]">
      Build to <span className="text-accent">plan</span>.<br/>
      Release on <span className="text-accent">proof</span>.
    </h2>
    <p className="mt-6 mx-auto max-w-[540px] text-base text-fg-dim leading-relaxed">…</p>
    <div className="mt-8 flex gap-3 justify-center">{/* primary + ghost */}</div>
  </div>
</section>
```

### 4.5 Pipeline pattern (n cards as a flow)

Whenever you render an enumerated sequence (agents, steps, milestones), draw a thin orange rail above the cards with one node per card. Filled nodes mark endpoints; outlined nodes mark intermediates.

See `plumbline-mockup-v2.html` §pipeline-rail for the exact markup.

---

## 5. Anti-patterns (don't do these)

| Don't | Why |
|---|---|
| Round corners on cards or buttons | Plumbline is a sharp brand. Right angles only. |
| Use shadows under everyday cards | Reserve elevation for the single hero verdict card. Otherwise hairlines do the work. |
| Use white as a surface | The app is dark mode. Don't paint cards white. |
| Introduce a second accent color (blue, purple, etc.) | Visual noise. Orange is the only accent. Use status colors only for verdicts. |
| Use sentence-case mono labels | Mono is uppercase. Always. |
| Use sans for numbers in tables/data | Tabular data is mono so columns align. |
| Animate everything | Restrained motion. Three patterns total (pulse / bob / glow). |
| Use icons for primary navigation | Typography carries the system. |
| Add a "Learn more →" CTA in the hero | The hero's secondary CTA is "See the pipeline" or similar. Anchor links, not vague invitations. |
| Use a stock photo or 3D illustration | Render the artifact (a real-looking sample report). Photography would feel off-brand. |
| Center-align body copy | Body and lead text is left-aligned. Closing CTA is the one centered exception. |
| Auto-play sound or video | Never. |
| Use `!important` to override tokens | If you need to override a token, the token is wrong — propose updating the kit. |
| Place > 2 accent words in one headline | The accent word is precious. Two max. |
| Use emoji as UI affordance | Plumbline does not use emoji. (Words like "↗" and "→" and "·" are typographic, not emoji.) |

---

## 6. Accessibility

### 6.1 Color contrast

All text/background pairs must hit at least **WCAG AA**:

| Pair | Ratio | OK? |
|---|---|---|
| `--fg` on `--bg` | 16.7:1 | OK |
| `--fg-dim` on `--bg` | 4.8:1 | OK (body lead) |
| `--fg-muted` on `--bg` | 2.7:1 | Fail for body, OK for non-essential micro-mono labels only |
| `#000` on `--accent` | 8.9:1 | OK (button label) |
| `--success` on `--bg` | 9.3:1 | OK |
| `--danger` on `--bg` | 5.1:1 | OK |

Rule: `--fg-muted` is for decorative mono labels only ("Once at loan origination · Versioned on CO"). Never use it for actionable text or anything required to read the page.

### 6.2 Focus states

Every focusable element gets a visible 2px outline:

```css
*:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

Don't override per-component. The token is the system.

### 6.3 Keyboard

- Nav links: tabbable, `:focus-visible` ring.
- Matrix cells: not interactive in v1; if made so, must respond to Enter/Space.
- All `<a>` and `<button>` use real semantic elements (no `<div onClick>`).

### 6.4 Motion

Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

### 6.5 Semantic HTML

- One `<h1>` per page (the hero headline).
- Every section has an `<h2>` (chapter title).
- Use `<nav>`, `<main>`, `<section>`, `<footer>`.
- Decorative SVG/elements get `aria-hidden="true"` (the plumbline rail, the verdict-card stack, the pipeline-rail nodes).

---

## 7. Decision rules (when in doubt)

- **Padding choice:** ladder is `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 96 / 120`. Round up if between two.
- **Hierarchy in a new section:** `eyebrow → headline (display L) → lead (body L) → content`.
- **Numbers:** if it's a data value, use `mono` and right-align in tables. If it's a hero stat, use mono `26px / weight 600`.
- **Emphasis:** use `<span class="text-accent">` on at most two words per headline. Don't bold for emphasis in body.
- **Adding a chip vs. a badge:** chip = neutral metadata (`PDF · slow`); badge = state (`UNAPPROVED CO`, `Approve with conditions`).
- **Adding a new color:** don't. Take it to the kit owner.
- **A new section type:** start with the `Section rhythm` skeleton (§4.2), then identify which existing pattern is closest (Inputs / Pipeline / Report / Closing CTA) and lift its grid.
- **Empty states:** use a single mono micro-label `NO PHOTOS YET · UPLOAD TO BEGIN`. Do not show illustrations.
- **Loading states:** use a 1px hairline progress bar in `--accent` at the top of the affected card. Skeletons are `bg-bg-2`.
- **Error states:** `--danger` text, no icon, mono micro-label preceding the message: `ERROR · COULD NOT PARSE PDF`.

---

## 8. Acceptance checklist (run before declaring any UI done)

Copy this into the PR/task and tick each item.

**Tokens & visual**
- [ ] Only colors, fonts, sizes, and spacings from §2 are used.
- [ ] No new accent color introduced.
- [ ] No rounded corners (except status dots which are circles).
- [ ] No box-shadow except on the single hero verdict card.

**Layout**
- [ ] Container max-width is 1280px with 32/20px gutters.
- [ ] Section vertical padding is `96px` (or `120` for closing CTA).
- [ ] Section borders use `--line-strong`; within-card lines use `--line`.

**Typography**
- [ ] All micro-labels are mono uppercase with letter-spacing ≥ 0.12em.
- [ ] All numeric/tabular data is mono (except hero/verdict amounts which are display-sans).
- [ ] Headlines have negative letter-spacing per the scale in §2.2.
- [ ] At most two accent words per headline.

**Voice**
- [ ] No exclamation marks.
- [ ] Domain vocabulary preserved (G703, SOV, draw, milestone, CO).
- [ ] Sentences ≤ 14 words on average.

**Hero (if applicable)**
- [ ] Above-the-fold on 1280×800 viewport.
- [ ] Right column shows the artifact, not abstract decoration.
- [ ] One primary + one ghost CTA.

**Sections (if applicable)**
- [ ] Each has an eyebrow + chapter divider.
- [ ] Plumbline rail visible down the left edge of the page.
- [ ] Closing CTA section sits before the footer.

**Accessibility**
- [ ] Visible `:focus-visible` outline on every interactive element.
- [ ] Single `<h1>` on the page; semantic landmarks present.
- [ ] All decorative elements `aria-hidden="true"`.
- [ ] `prefers-reduced-motion` respected.

**Done means:** all boxes ticked, mockup file updated if a new pattern was introduced, kit updated if a token was added.

---

## 9. Appendix — files in this repo that are part of the kit

- `DESIGN-KIT.md` — this document (authoritative)
- `plumbline-mockup-v2.html` — visual reference; opens in any browser
- `REDESIGN-NOTES.md` — change list to bring the React app to v2
- `src/index.css` — token definitions live here

When you change a token in `src/index.css`, mirror the change in this document's §2. The kit and the code are the same source.
