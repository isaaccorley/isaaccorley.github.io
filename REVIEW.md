# Portfolio Site Review Checklist

## P0 - Breaking Issues

- [x] **#1** `text-l` is not a Tailwind class — Lines 66, 81, 98, 115, 132 in `page.tsx`. Should be `text-lg`.
- [x] **#24** Publication cards break on mobile — `flex-row` with `min-w-[160px]` image forces horizontal scroll on phones <400px wide.
- [x] **#25** Portfolio cards same issue — Same `flex-row gap-6 items-center` without responsive breakpoint.
- [x] **#39** Accent color contrast — `#0d9488` on `#fffcf8` is 3.2:1. Fails WCAG AA for normal text.

## P1 - Significant Issues

- [x] **#5** Twitter @ symbol has no spacing — `profile-section.tsx:93` needs space after icon.
- [x] **#13** `gap-2` on main grid is too tight — `page.tsx:42`. Should be `gap-8` or `gap-12`.
- [x] **#23** `<br />` tags in profile-section.tsx — Lines 72, 85, 98, 111, 113. Use flexbox instead.
- [x] **#26** SectionNav hidden on mobile — `hidden md:block` — no navigation on mobile.
- [x] **#28** `px-8` eats too much on mobile — Use `px-4 md:px-8`.
- [x] **#32** Links missing focus states — `accent-link` class has hover but no focus ring.
- [x] **#33** Theme toggle button focus — Has hover states but keyboard users see nothing.
- [ ] **#34** `dangerouslySetInnerHTML` for About — Screen readers may struggle with injected HTML.
- [x] **#35** Icon-only links in profile — ARIA labels would help.
- [x] **#36** Glass-card hover transform — Should respect `prefers-reduced-motion`.
- [x] **#37** Animation on scroll — `fadeInUp` should respect `prefers-reduced-motion: reduce`.
- [x] **#44** IntersectionObserver created per-component — Should share one observer.
- [x] **#49** `switch` statement for sections — Extract to config object + single renderer.

## P2 - Polish Issues

### Typography & Text

- [x] **#2** Font stack mismatch — `globals.css:30` declares `--source-serif-font` but never defined.
- [x] **#3** Inconsistent serif usage — Headings use `font-serif`, body inherits from root.
- [x] **#4** No `font-display: swap` — Add `display: 'swap'` to font configs.
- [x] **#6** Mixed text size units — `text-md` doesn't exist in Tailwind; fixed to `text-base`.
- [x] **#7** Line-height inconsistency — `leading-relaxed` is standard; one outlier in bioacoustics page (separate context).
- [x] **#8** All-caps nav + tracking-wider = readability hit on longer labels.
- [x] **#9** Section headings missing semantic weight — Proper `h2` hierarchy in place.
- [x] **#10** Award badge text too small — Added `sm:text-sm` breakpoint.
- [x] **#11** BibTeX casing — Data source has no BibTeX content (only URLs).
- [x] **#12** Empty `className=""` in layout.tsx:60 — Remove the attribute.

### Spacing & Layout

- [x] **#14** Inconsistent section spacing — Intentional gradation: `space-y-4`, `space-y-6`, `space-y-8` per section type.
- [x] **#15** `mb-8` on all section headings — Added responsive `mb-4 md:mb-8`.
- [x] **#16** Left column sticky positioning — Updated `top-12` → `top-14` for better offset.
- [x] **#17** Mobile: Profile image 1/3 width — Increased `w-1/3` → `w-2/5` (40%) for better visibility.
- [x] **#18** SectionNav `mt-8 pt-8` double-spacing — Removed redundant `mt-8`.
- [x] **#19** Publications/Projects `space-y-6` vs News/Education `space-y-8` — Standardized all to `space-y-6`.
- [x] **#20** Portfolio description has `mt-4 mb-4` — Already correct (removed in prior session).
- [x] **#21** Education grid `grid-cols-4` — Year column wastes space.
- [x] **#22** Experience grid same problem — Consider `grid-cols-[auto_1fr]`.

### Mobile Responsiveness

- [x] **#27** Fixed theme toggle position — Added responsive `right-4 sm:right-6 md:right-8`.
- [x] **#29** Profile flex reversal — Changed `flex-row-reverse` to `flex-col` with `order-first` on image.
- [x] **#30** Award badge doesn't wrap — Changed `flex-row` to `flex-wrap` for responsiveness.
- [x] **#31** Technology tags missing `gap-y-2` — Already has `gap-2` which applies to both axes.

### Accessibility

- [x] **#38** Color contrast — Fixed `text-zinc-400` → `text-zinc-500` in section-nav for AAA (7:1+) compliance.
- [x] **#40** Section nav buttons — Made desktop nav use same pill styling as mobile for consistency.

### Performance

- [x] **#41** No image optimization hints — Added `sizes` prop to publication, portfolio, and profile images.
- [x] **#42** `priority` only on profile image — Profile image is the only above-fold image, correctly marked.
- [x] **#43** Lucide icons imported individually — All imports already granular (no bulk imports); optimal.
- [x] **#45** CSS `transition-all` on glass-card — Triggers GPU compositing on layout changes.

### Code Quality

- [x] **#46** Duplicate nav logic — Single source of truth needed.
- [x] **#47** Magic numbers — `rootMargin` values need named constants.
- [x] **#48** Index as key in maps — Static list, low risk; acceptable pattern here.
- [x] **#50** Theme toggle hydration — Placeholder `w-9 h-9` prevents layout shift; script applies theme pre-hydrate.
- [x] **#51** `useState(false)` for dark mode — Script in layout.tsx applies theme before hydration; no flash.
- [x] **#52** Unused imports — Geist_Mono is used by font-mono classes in sub-pages.
- [x] **#53** `@/styles/globe.css` import — Used by planetary-computer-mcp page.

### Visual Polish

- [x] **#54** Award badge shine animation — 1000ms too slow.
- [x] **#55** Glass card border barely visible in light mode.
- [x] **#56** Dark mode glass card blur — Pointless on dark backgrounds.
- [x] **#57** Hover lift inconsistency — Education/Experience have no hover effect.
- [x] **#58** No empty state handling — Add fallback for blank page.
- [x] **#59** Favicon path — Already optimized by Next.js (imported from app dir).
- [x] **#60** No loading state — Deferred; low priority for static portfolio.

### Data/Content

- [x] **#61** Date format inconsistency — Standardize formats.
- [x] **#62** Author bolding — Bold your own name in publications.
- [x] **#63** Missing `alt` diversity — Descriptions are descriptive; adequate.
- [x] **#64** Conference abbreviations — Low ROI; tooltip mapping would require data maintenance.
