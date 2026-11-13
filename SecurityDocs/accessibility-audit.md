# Perception LMS — WCAG 2.2 Accessibility Audit

**Owner:** Yoodem, Compliance and Risk Officer · **Status:** Draft, first round · **Issue:** #102
**Standard:** WCAG 2.2, level AA · **Site:** https://perceptionlms.com · **Date:** 11 November 2026
**For:** Bishu (design) and Dipesh (screens)

## 1. Summary

The site is a good start. It sets the page language, labels every form field, labels icon-only buttons, hides decorative icons from screen readers, announces loading and errors, and its text colours pass contrast.

There are **11 problems** to fix:

- **3 high:** pop-up windows don't move keyboard focus, delete icons are too faint, and small icon buttons are too small to tap
- **5 medium**
- **3 low**

The biggest gaps are in **pop-up windows (dialogs)** and **small icon buttons**.

## 2. How it was checked

| Page | How |
| --- | --- |
| Sign-in (`/login`) | **Live site:** keyboard only, colour contrast measured in the browser, phone width (375 px), wide desktop, and 200% zoom (shows the same layout as a phone) |
| Student, lecturer and admin dashboards, and the course, assignment, grades and users pages | **Code review** of the `dev` branch (`frontend/src`), with colour contrast worked out from the Tailwind colours used. These pages need a Google sign-in, so they couldn't be checked live in this round |

**Not yet done (second round, section 6):** checking the signed-in pages live with a screen reader (NVDA on Windows or VoiceOver on iPhone), keyboard only and 200% zoom.

**Severity:**
- **High:** stops some users from completing a task
- **Medium:** makes a task hard, or fails a WCAG AA criterion with a workaround
- **Low:** a small barrier or a best-practice gap

## 3. Problems found

| # | Page | Problem | WCAG criterion | Severity | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| A-01 | Every pop-up window: new announcement, new or edited assignment, add module, add material (`components/ui.jsx`, `Modal`) | When a pop-up opens, keyboard focus stays on the page behind it. Keyboard and screen reader users don't know it opened and can tab "behind" it. When it closes, focus isn't returned to the button that opened it | 2.4.3 Focus Order; 2.1.1 Keyboard | **High** | Move focus to the first field (or the dialog title) when it opens. Keep Tab inside the dialog while it's open. Return focus to the opening button when it closes. The native `<dialog>` element with `showModal()` does most of this for free |
| A-02 | Course home, modules (`CourseHome.jsx`, `Modules.jsx`) | Delete icons (bin) are light grey (`text-slate-400`) on white: **2.56 : 1**. Icons that are the only sign of a control need at least **3 : 1** | 1.4.11 Non-text Contrast | **High** | Use `text-slate-500` (4.76 : 1) or darker for the resting colour; keep red on hover |
| A-03 | Modules, course home, pop-up close button | Icon-only buttons (delete, download, close ✕) are the size of the icon, about **15–18 px** square, with no padding. WCAG 2.2 needs at least **24 × 24 px** to tap | 2.5.8 Target Size (Minimum) — new in 2.2 | **High** | Add padding, such as `p-1.5` or `w-8 h-8 grid place-items-center`, so each button is at least 24 × 24 px (44 × 44 px is better on phones) |
| A-04 | Every form (`index.css`, `.input`) | Text box and dropdown borders are very light grey (`border-slate-300`) on white: **1.48 : 1**. Users with low vision may not see where to type | 1.4.11 Non-text Contrast | Medium | Use `border-slate-500` (4.76 : 1), or at least `border-slate-400` with a light grey fill inside the box |
| A-05 | Every signed-in page | The browser tab title is always "Perception LMS", so screen reader users and people with many tabs can't tell which page they're on | 2.4.2 Page Titled | Medium | Set the title on each page, for example "Assignments – ICT101 – Perception LMS". A small `usePageTitle()` hook used next to each `PageHeader` would do it |
| A-06 | Every signed-in page | Moving to another page doesn't tell screen reader users that anything changed, because focus stays on the link they clicked | 2.4.3 Focus Order; 4.1.3 Status Messages | Medium | After a page change, move focus to the page's `<h1>`, with `tabIndex={-1}`, or announce the new page title in a polite live region |
| A-07 | Phones: every signed-in page (`Layout.jsx`) | The top bar (sticky) and the bottom menu (fixed) cover part of the screen. When tabbing with a keyboard, the focused item can end up hidden behind them | 2.4.11 Focus Not Obscured (Minimum) — new in 2.2 | Medium | Add `scroll-padding-top` and `scroll-padding-bottom` on `html`, matching the bar heights, so focused items scroll into the visible area. Check it in round 2 |
| A-08 | Side menu (tablet and desktop) | Menu labels are **11 px** and the role label is **10 px**, uppercase. They pass contrast, but are hard to read for people with low vision | 1.4.4 Resize Text (advisory) | Medium | Use at least 12 px (`text-xs`), and don't put the role label in all caps |
| A-09 | Side menu | The signed-in person's name is only in a `title` tooltip, and the avatar is hidden from screen readers, so screen reader and touch users never hear or see who's signed in | 1.3.1 Info and Relationships | Low | Show the name as visible text, or add it as screen-reader-only text (`sr-only`) next to the avatar |
| A-10 | Sign-in (live) | The page has no `<main>` area, and its first heading is an `<h2>` (the "Everything for your courses" panel) before the `<h1>` "Welcome back" | 1.3.1 Info and Relationships; 2.4.6 Headings and Labels | Low | Wrap the sign-in panel in `<main>`. Make the left panel's heading a `<p>`, or put the `<h1>` first |
| A-11 | Every signed-in page | There's no "Skip to main content" link. The menu is short (3–4 links), so this matters less, but keyboard users still pass it on every page | 2.4.1 Bypass Blocks | Low | Add a skip link as the first item in `Layout.jsx` that becomes visible on focus and jumps to `<main>` |

### Close to the limit: don't make these lighter

These pass now, but only just. Any lighter colour would fail.

| Where | Colours | Ratio | Needs |
| --- | --- | --- | --- |
| "Late" and "Submitted late" badges | `amber-700` on `amber-100` | 4.51 : 1 | 4.5 : 1 |
| Grey text on the sign-in page background | `slate-500` on `slate-50` | 4.55 : 1 | 4.5 : 1 |
| Feature list on the sign-in panel | `blue-200` on the lightest part of the blue background | about 4.7 : 1 | 4.5 : 1 |

## 4. What already passes

| Check | Result | WCAG |
| --- | --- | --- |
| Page language set (`lang="en"`) | Pass | 3.1.1 |
| Zoom isn't blocked; phone width (375 px) has no sideways scrolling; 200% zoom on sign-in works | Pass (sign-in, live) | 1.4.4, 1.4.10 |
| Keyboard: the Google sign-in button can be reached with Tab and shows a clear focus outline | Pass (live) | 2.1.1, 2.4.7 |
| Decorative icons are hidden from screen readers (`aria-hidden`) | Pass | 1.1.1 |
| Icon-only buttons have names, such as "Delete Week 1" and "Download Lecture slides" | Pass | 4.1.2 |
| Every text box, dropdown and checkbox has a visible label linked to it | Pass | 1.3.1, 3.3.2 |
| Loading messages (`role="status"`) and errors (`role="alert"`) are announced | Pass | 4.1.3 |
| Status badges (Late, Missing, Released, Published) use words, not just colour | Pass | 1.4.1 |
| Body text and button text contrast (for example, white on blue buttons 5.17 : 1, red "Delete" 4.83 : 1) | Pass | 1.4.3 |
| Menus are marked as navigation (`<nav aria-label="Main">`) and pages use `<main>` | Pass | 1.3.1 |
| Pop-ups close with the Esc key | Pass | 2.1.1 |
| Signing in needs no password to remember or puzzle to solve (Google sign-in) | Pass | 3.3.8 Accessible Authentication — new in 2.2 |

## 5. Fix order

1. **A-01, A-02, A-03** (high): pop-up focus, faint delete icons, tap size. These are mostly in `components/ui.jsx` and two page files, about half a day's work.
2. **A-04, A-05, A-06, A-07, A-08** (medium): input borders, page titles, page-change focus, phone bars and menu text size.
3. **A-09, A-10, A-11** (low).

Bishu can update the design colours and sizes (A-02, A-03, A-04, A-08). Dipesh can make the code changes in the screens (A-01, A-05, A-06, A-07, A-09 to A-11).

## 6. Second round (after fixes)

To be done with a test account for each role (student, lecturer and admin):

- [ ] Go through each dashboard and one full task per role with **keyboard only**: hand in an assignment, mark it, and add a user
- [ ] Repeat with **NVDA** (free, Windows) or **VoiceOver** (iPhone)
- [ ] Check every signed-in page at **200% zoom** and on a phone
- [ ] Run an automatic checker, such as axe DevTools or Lighthouse in Chrome, on each page
- [ ] Re-check A-01 to A-11 and update this table

## 7. Review

Re-audit after each major release, and before ASA College's go-live. An accessibility statement for the site, saying what's been checked and how to report a problem, can be written once round 2 is done.
