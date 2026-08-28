---
name: Multi-POS
description: Multi-sucursal POS system with dynamic theming, adaptive navigation, and configurable density
colors:
  primary: "#1a1a1a"
  primary-foreground: "#fafafa"
  secondary: "#f7f7f7"
  secondary-foreground: "#1a1a1a"
  muted: "#f7f7f7"
  muted-foreground: "#8a8a8a"
  accent: "#f7f7f7"
  accent-foreground: "#1a1a1a"
  destructive: "#c7442a"
  destructive-foreground: "#ffffff"
  border: "#e2e2e2"
  input: "#e2e2e2"
  ring: "#8a8a8a"
  background: "#ffffff"
  foreground: "#1a1a1a"
  card: "#ffffff"
  card-foreground: "#1a1a1a"
  popover: "#ffffff"
  popover-foreground: "#1a1a1a"
  sidebar: "#fafafa"
  sidebar-foreground: "#1a1a1a"
  sidebar-primary: "#1a1a1a"
  sidebar-accent: "#f7f7f7"
  chart-1: "#d9d9d9"
  chart-2: "#8a8a8a"
  chart-3: "#606060"
  chart-4: "#4a4a4a"
  chart-5: "#383838"
typography:
  display:
    fontFamily: "Poppins, Montserrat, sans-serif"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Montserrat, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  heading:
    fontFamily: "Poppins, sans-serif"
    fontWeight: 500
    lineHeight: 1.3
  label:
    fontFamily: "Montserrat, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "Space Mono, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
  3xl: "22px"
  4xl: "26px"
spacing:
  compact: "6px"
  comfortable: "12px"
  spacious: "20px"
  card-sm: "12px"
  card-md: "16px"
  card-lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.xl}"
    padding: "0 12px"
  button-primary-hover:
    backgroundColor: "{colors.primary} / 80%"
    textColor: "{colors.primary-foreground}"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "0 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
  button-destructive:
    backgroundColor: "{colors.destructive} / 10%"
    textColor: "{colors.destructive}"
    rounded: "{rounded.xl}"
  input-default:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "8px 12px"
  card-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: "16px"
---

# Design System: Multi-POS

## Overview

**Creative North Star: "The Adaptive Operator"**

Multi-POS is a working tool, not a showcase. Its visual language prioritizes speed, scanability, and operational clarity over decorative expression. The system feels precise and confident — every element earns its space through function, not flourish. Density is configurable per-organization, and the palette shifts with hue-based theming, but the structural logic remains constant: flat surfaces, clear hierarchy, and zero visual noise between the operator and their task.

The design adapts to context: desktop gets a persistent sidebar with grouped navigation, mobile collapses to a bottom tab bar with safe-area awareness, and the POS interface transforms into a touch-optimized grid with large tap targets. Motion is purposeful — subtle entrance animations on navigation, a flash highlight on ticket updates, and scale micro-interactions on buttons. Nothing decorative.

**Key Characteristics:**
- Flat-by-default surfaces with tonal layering for depth
- Dynamic hue-based theming (primaryHue + accentHue configurable per tenant)
- Adaptive navigation: sidebar → bottom tab bar → navigation drawer
- Density-configurable spacing (compact / comfortable / spacious)
- Touch-first POS with large targets, virtual keyboard, and barcode scanner
- Monochrome base palette with destructive red as the sole accent color

## Colors

The palette is a disciplined monochrome foundation: near-black primary, near-white surfaces, and a single destructive red for errors and dangerous actions. Hue-based theming allows organizations to shift the primary and accent hues via `app_settings`, but the default is achromatic.

### Primary

- **Near-Black** (oklch(0.205 0 0) / #1a1a1a): The dominant text and button color. Used for primary buttons, sidebar text, headings, and active navigation states. Its near-black neutrality ensures maximum contrast on white surfaces.

### Secondary

- **Soft Gray** (oklch(0.97 0 0) / #f7f7f7): Background for secondary buttons, muted containers, and hover states. Provides subtle tonal separation from the pure white background without introducing color.

### Neutral

- **Pure White** (#ffffff): Background, card, and popover surfaces. The canvas for all content.
- **Medium Gray** (oklch(0.556 0 0) / #8a8a8a): Muted text, descriptions, and placeholder copy. Reads as "secondary information" without competing with primary text.
- **Light Gray** (oklch(0.922 0 0) / #e2e2e2): Borders, input strokes, and dividers. Provides structure without visual weight.
- **Focus Ring** (oklch(0.708 0 0) / #8a8a8a): Visible focus indicators for keyboard navigation.

### Destructive

- **Alert Red** (oklch(0.577 0.245 27.325) / #c7442a): Reserved exclusively for error states, destructive confirmations, and danger-mode buttons. Never used for primary actions or decoration.

### Named Rules

**The Monochrome Foundation Rule.** The default palette is achromatic. Color enters only through dynamic hue theming (per-organization primaryHue/accentHue) or the destructive red. Any new color must justify why the monochrome foundation is insufficient.

**The Destructive-Only Accent Rule.** The only chromatic color in the base system is destructive red. It appears on ≤5% of any given screen. Its rarity signals urgency; its absence signals safety.

## Typography

**Display Font:** Poppins (Montserrat fallback)
**Body Font:** Montserrat (system-ui fallback)
**Mono Font:** Space Mono (Courier fallback)

**Character:** Poppins provides geometric clarity for headings and display text, while Montserrat offers humanist warmth for body copy and UI labels. The pairing balances professionalism with approachability — appropriate for a business tool that needs to feel both trustworthy and modern.

### Hierarchy

- **Display** (Poppins, 600, clamp(1.5rem, 3vw, 2.25rem), 1.2): Hero headlines on the landing page and dashboard summary cards. Appears rarely — maximum once per viewport.
- **Headline** (Poppins, 500, 1.25rem, 1.3): Section titles, dialog headers, card titles (`CardTitle`). The primary structural type level.
- **Title** (Montserrat, 600, 1rem, 1.4): Subsection headers, table column headers, navigation labels.
- **Body** (Montserrat, 400, 1rem, 1.5): Default text for paragraphs, descriptions, form labels, and list items. Max line length: 65–75ch for readability.
- **Label** (Montserrat, 500, 0.875rem, 1.4): Button text, input placeholders, badges, chips, and metadata. Slightly tighter than body for density.
- **Mono** (Space Mono, 400, 0.875rem, 1.4): Receipt/ ticket rendering, code snippets, and technical identifiers.

### Named Rules

**The Configurable Scale Rule.** The base font size is `16px * fontScale`, where `fontScale` ranges from 0.7 to 1.4 and is set per-organization. All rem-based measurements scale proportionally. Never hardcode font sizes in px that bypass this system.

## Layout

The layout is a three-zone adaptive shell:

- **Desktop (≥768px):** Persistent sidebar (264px full / 200px compact / 64px icon) on the left, scrollable content area with sticky header. Sidebar groups navigation by section with collapsible accordions.
- **Tablet (768px–1024px):** Navigation drawer (slides from left) replaces the persistent sidebar. Content area fills the viewport.
- **Mobile (<768px):** Bottom tab bar (fixed, 4-5 primary items) with safe-area-inset-bottom padding. Content is full-width with no sidebar. The POS interface transforms to a ticket-panel-first layout.

**Density System:** Spacing between elements is controlled by a per-organization density setting:
- Compact: 6px gaps — for dense data tables and POS grids
- Comfortable: 12px gaps — default, balanced breathing room
- Spacious: 20px gaps — for dashboards and less data-dense screens

**Card Sizes:** Cards adapt to a per-organization size setting:
- Small: 220px min-width — for POS product grids
- Medium: 260px min-width — default for catalog lists
- Large: 320px min-width — for dashboard analytics cards

## Elevation & Depth

Multi-POS uses a **flat-by-default** approach with minimal shadow vocabulary. Depth is conveyed through tonal layering (background → card → popover) and subtle ring borders rather than drop shadows.

### Shadow Vocabulary

- **Subtle Lift** (`box-shadow: 0 4px 24px rgba(0,0,0,0.12)`): Applied to popovers, dialogs, and the SweetAlert2 popup. The only elevation signal in the system.
- **Ticket Flash** (keyframe animation): A 0.9s ease-out flash that highlights modified ticket lines with a primary-tinted background and ring glow, then fades to the card background.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only as a response to state (hover, elevation, focus) or for overlay elements (dialogs, popovers). Cards use `ring-1 ring-foreground/10` for border definition, not shadows.

## Shapes

The form language is **softly rounded** with a configurable radius system:

- **Base Radius:** 0.625rem (10px) — the root `--radius` variable
- **Scale:** Derived from the base via multipliers: sm (0.6x), md (0.8x), lg (1x), xl (1.4x), 2xl (1.8x), 3xl (2.2x), 4xl (2.6x)
- **Per-Organization:** The `borderRadius` setting (0–2) scales the entire radius system, allowing organizations to shift from sharp (0) to very rounded (2)

**Component Radius Pattern:**
- Buttons and inputs: `rounded-xl` (14px) on mobile, `rounded-lg` (10px) on desktop — larger touch targets on mobile
- Cards: `rounded-xl` (14px) — consistent with the soft aesthetic
- Dialogs and modals: `rounded-xl` (14px) with `--radius-xl`
- Sidebar items: `rounded-lg` (10px) — slightly tighter for density

## Components

### Buttons

- **Shape:** `rounded-xl` (14px) on mobile, `rounded-lg` (10px) on desktop. Heights scale from h-6 (xs) to h-12 (lg).
- **Primary:** Near-black background (#1a1a1a), white text. Hover darkens via `bg-primary/80`. Scale micro-interaction on hover (`scale-105`, 200ms ease-in-out).
- **Outline:** Transparent background with border, hover fills to muted. Used for secondary actions.
- **Ghost:** No background or border, hover fills to muted. Used in toolbars and navigation.
- **Destructive:** 10% opacity red background with red text. Hover increases to 20%. Never solid red — the transparency keeps it from dominating.
- **Focus:** `ring-3 ring-ring/50` with visible border shift. Keyboard-accessible by default.

### Inputs

- **Shape:** `rounded-xl` (14px) on mobile, `rounded-lg` (10px) on desktop. Height h-11 mobile / h-9 desktop.
- **Style:** Transparent background with `border-input` stroke. Placeholder text in muted-foreground.
- **Focus:** Border shifts to `ring` color with `ring-3 ring-ring/50` glow.
- **Error:** Border shifts to `destructive` with `ring-3 ring-destructive/20`.
- **Disabled:** 50% opacity with cursor-not-allowed.

### Cards

- **Shape:** `rounded-xl` (14px) with `ring-1 ring-foreground/10` border.
- **Background:** Card surface color (#ffffff light / oklch(0.205) dark).
- **Internal Padding:** Configurable via `--card-spacing`: sm (12px), md (16px default), lg (24px).
- **Footer:** Optional, uses `bg-muted/50` with top border.

### Navigation

- **Desktop Sidebar:** Full-width (264px) with grouped sections, collapsible accordions, and section labels. Active item gets `bg-sidebar-accent` with `text-sidebar-primary`. Smooth entrance animations (opacity + x-translate, 150ms).
- **Mobile Bottom Tab Bar:** Fixed bottom, 4-5 items, icons + labels. Active item gets primary color. Backdrop blur with `bg-background/90`. Safe-area-aware padding.
- **Navigation Drawer:** Tablet-only slide-out panel with the same sidebar content.

### POS Product Grid

- **Touch Targets:** Minimum 44px tap areas for all interactive elements.
- **Product Cards:** Display product name, price, image, and type indicator (standard/bulk). Bulk products show price-per-unit.
- **Category Tabs:** Horizontal scrollable tabs above the grid for category filtering.

### Ticket Panel

- **Receipt Width:** Fixed 80mm thermal receipt format for print.
- **Flash Animation:** Modified lines flash with a primary-tinted background (0.9s ease-out) to draw attention to changes.
- **Split Payments:** Visual breakdown of payment methods with labeled rows.

## Do's and Don'ts

### Do:
- **Do** use the density system (compact/comfortable/spacious) rather than hardcoding gaps.
- **Do** keep the destructive color reserved for errors and dangerous actions — never for primary CTAs.
- **Do** use `ring-1 ring-foreground/10` for card borders instead of box-shadow.
- **Do** scale button and input sizes for mobile (h-11 → h-8 on desktop) using the responsive pattern.
- **Do** use Poppins for headings and Montserrat for body — never swap them.
- **Do** respect the configurable radius system — use `var(--radius)` derivatives, not hardcoded px values.

### Don't:
- **Don't** add drop shadows to cards or surfaces — use tonal layering and ring borders instead.
- **Don't** use color for decorative purposes — the monochrome palette is intentional.
- **Don't** hardcode font sizes — always use the `fontScale`-aware rem system.
- **Don't** place more than 5 items in the mobile bottom tab bar.
- **Don't** use `rounded-full` on buttons or inputs — the system uses `rounded-xl` / `rounded-lg`.
- **Don't** mix Poppins and Montserrat in the same text block — keep the hierarchy clean.
