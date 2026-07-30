// Design tokens — PLACEHOLDER — SINGLE GLOBAL SOURCE (TS mirror of DESIGN.md)
// ---------------------------------------------------------------------------
// DESIGN.md -> app/globals.css @theme is the source for Tailwind utility classes
//   (bg-primary, text-ink, rounded-xl, p-xl, ...). This file is the TypeScript
//   mirror for values CSS classes can't reach: chart series colors, inline style
//   props, canvas/SVG, email templates, etc.
// RULE: raw hex / px values appear ONLY here and in globals.css @theme.
//   Components must reference token names — never hardcode colors or spacing.
//
// Will export (Wise-inspired system from DESIGN.md):
//   colors    — primary #9fe870, ink #0e0f0c, canvas-soft #e8ebe6, semantic set...
//   typography— display-mega..caption + button-md (family/size/weight/line-height)
//   rounded   — none 0 / sm 8 / md 12 / lg 16 / xl 24 / pill 9999
//   spacing   — xxs 2 / xs 4 / sm 8 / md 12 / lg 16 / xl 24 / 2xl 32 / 3xl 48

export {}; // scaffold placeholder — implementation added later
