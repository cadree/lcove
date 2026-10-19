# Ether design system

Short reference for the chrome Cadre approved. Apply these tokens before inventing a new header or button treatment.

## Color

Brand accent is `#F5A6CF`, stored as `--ether-pink` and `--primary` (`hsl(329 80% 81%)`).

Primary buttons use that fill with near-black text (`--primary-foreground`, `hsl(0 0% 8%)`). That pair is about 10.7:1. Do not put white text on this pink.

`--muted-foreground` is light enough for body text on the near-black background. Do not fade it with an extra opacity utility for sentences people need to read.

The accent is a 1px hairline (`.hairline`, or `border-[hsl(var(--ether-pink))]`). Do not add pink glows. `.glow-pink` and `.glow-pink-sm` are intentionally empty.

## Type

- Display: Cormorant Garamond, utility `.ether-title` or `font-display`. One serif. Cinzel is not loaded and should not be added.
- Body: DM Sans, `font-body`.
- Titles stay in sentence or title case. Do not set Ether chrome titles in all caps.

## Eyebrow

`.eyebrow` is a short tracked label in the accent color, set above a section title. It is not uppercase.

## Photos and rules

- Photos are square or portrait with almost no corner radius. Use `.media-frame` or `rounded-[2px]` (`--radius-media`).
- Sections separate with whitespace and a 1px line: `.ether-rule`.

## Header

`PageHeader` is the page title. It always renders the `title` in `.ether-title`, an optional `eyebrow`, an optional description, a 44px back control, page actions, and the More button.

```tsx
<PageHeader eyebrow="People" title="Directory" description="Find creatives by name, city, or interests" />
```

Feed, Explore, Messages, and Profile use the same eyebrow-plus-serif pattern when they do not use `PageHeader`.

## Navigation

The bottom bar is five fixed tabs: Home (the feed), Explore, Create, Messages, Profile. Create opens pick, crop, caption, share. Projects, calendar, store, mall, wallet, fund, membership, live, cinema, and Nuance are in More (`MoreMenuButton`), opened from the header or profile.

`/home` redirects to `/feed`. `/landing` redirects to `/`.

## Tap targets

Interactive controls on these screens are at least 44px. Prefer `size="icon"` (`h-11 w-11`) or `min-h-11`.
