# AFK THEORY Business OS — UI/UX Redesign & Business Calendar Engineering Plan

**Document Version:** 1.0.0  
**Date:** October 2026  
**Status:** Approved for Implementation  
**Working Branch:** `feature/ui-redesign-and-calendar`  
**Target Environment:** Local Docker Compose + PostgreSQL 16 + Next.js 15.5.28 + React 19 + Tailwind CSS 3.4.17  

---

## 1. Executive Summary & Audit Findings

AFK THEORY Business OS is an authoritative, local-first ERP and double-entry accounting engine for an apparel brand with five founding partners. The existing backend is robust, strictly transactional, and covers general ledger accounting, partner capital accounts, asymmetrical venture waterfalls, production WIP, and universal evidence archiving.

However, a systematic design audit across every route (`layout.tsx`, `globals.css`, `Sidebar.tsx`, `Header.tsx`, `MobileNav.tsx`, `page.tsx`, `settings/page.tsx`, `finance/`, `partners/`, `ventures/`, `documents/`, `reports/`) reveals key UI/UX deficiencies:

1. **Micro-Typography & Illegibility:** Widespread reliance on `text-[9px]`, `text-[10px]`, and `text-[11px]` labels. Dense data fields strain partner eyes.
2. **Excessive Monospace Styling:** Font family `font-mono` is applied indiscriminately to routine business titles, category labels, navigation items, and full financial statements. Monospace should be reserved for numbers, monetary values, codes, and technical identifiers.
3. **Contrast Deficits & Inconsistent Color System:** Secondary text colors (`text-afk-muted/60`, `#6B7280`) fall below WCAG 2.2 AA (4.5:1) against dark backgrounds. Hardcoded arbitrary hex values (`border-[#282E38]`, `bg-[#14171C]`) clash with core tokens.
4. **Technical Clutter vs. Business Usability:**
   - The top header prominently features `"PostgreSQL Active"`, while the desktop sidebar shows `"Database: PostgreSQL 16"`, `"Backups: AES-256-GCM"`, and a hardcoded blinking `"Offline Safe"` pill.
   - The System Health page labels SHA-256 integrity checksums as `"Encryption: SHA-256 Verified"`.
   - Navigation links are cluttered with static decorative badges (`"GL"`, `"20%"`, `"NEW"`, `"WEBP"`, `"WIP"`).
5. **Horizontal Squeezing on Medium/Large Screens:**
   - Partner summary cards are hardcoded to `grid-cols-5`, cramming 5 partner financial cards into unreadable columns under 150px wide on laptop viewports.
   - Container widths are restricted to `max-w-7xl` with excessive margins on wide displays.
6. **Absence of a Business Calendar & Planner:**
   - The top bar displays a static date string but cannot be clicked to open any schedule.
   - There is no central interface to plan clothing drops, fabric purchase deadlines, factory batch completions, photoshoots, supplier payments, courier follow-ups, or partner meetings.

---

## 2. Design System Architecture

### 2.1 Color Palette & Token Definitions
A cohesive, high-contrast palette inspired by modern business workspaces:

| Token Name | Hex Code | Purpose | WCAG Contrast Ratio (vs BG) |
|---|---|---|---|
| `bg-afk-black` | `#0E1011` | Primary Application Background | Base |
| `bg-afk-charcoal` | `#141719` | Surface Panels & Sidebar | Base surface |
| `bg-afk-card` | `#1A1E20` | Cards & Structured Content | 1.15:1 (distinguishable depth) |
| `bg-afk-elevated` | `#22282B` | Hover states, modals, popovers | 1.25:1 elevated |
| `border-afk-border` | `#2D3538` | Subtle separators & dividers | 1.35:1 |
| `border-afk-border-strong` | `#3D474B` | Interactive borders & focus outlines | 2.1:1 |
| `text-afk-offwhite` | `#F4F5F1` | Primary text, titles, headings | **14.8:1 (AAA Pass)** |
| `text-afk-secondary` | `#B5BDB6` | Secondary helper text & labels | **8.2:1 (AAA Pass)** |
| `text-afk-muted` | `#869288` | Tertiary metadata & inactive icons | **4.8:1 (AA Pass)** |
| `afk-olive` | `#4F6348` | Brand deep olive | Primary identity |
| `afk-olive-accent` | `#7D9472` | Brand interactive accent & badges | **4.9:1 against charcoal** |
| `afk-olive-light` | `#96AF8A` | High-contrast accent for dark mode | **7.5:1 against black** |
| `afk-success` | `#3EB465` | Approved, confirmed, profitable | **6.1:1** |
| `afk-danger` | `#E05252` | Negative profit, alerts, overdue | **4.6:1** |
| `afk-warning` | `#E59E27` | Pending, review required | **6.2:1** |
| `afk-gold` | `#C49A45` | Equity, capital, milestones | **5.5:1** |

### 2.2 Typography Scale & Self-Hosted Font Architecture
- **Primary Font:** Geist Sans (Local variable font, woff2).
- **Monospace Font:** Geist Mono (Local variable font, woff2) for tabular currency amounts, journal numbers, SKU codes, and technical references.
- **Bengali Fallback:** Noto Sans Bengali (Local woff2) packaged in `src/fonts/` and loaded via `next/font/local`.
- Zero external CDN or internet calls at runtime, satisfying 100% self-hosted requirements.

**Type Scale Standard:**
- **Page Heading:** 28px (`text-2xl`), font-semibold, letter-spacing -0.02em.
- **Section Heading:** 20px (`text-xl`), font-semibold.
- **Card Heading:** 16px (`text-base`), font-semibold.
- **Body Text:** 15px–16px (`text-sm` to `text-base`), font-normal, line-height 1.6.
- **Form Labels & Table Headers:** 14px (`text-sm`), font-medium.
- **Table Data Cells:** 14px–15px (`text-sm`), tabular numbers for money (`font-mono font-medium`).
- **Secondary Helper Text:** 13px–14px (`text-xs` to `text-sm`, minimum 13px; eliminating 10px-11px).
- **Key Financial Totals:** 24px–30px, `tabular-nums font-semibold`.

---

## 3. Navigation & Shell Overhaul

### 3.1 Sidebar Structure
```text
AFK THEORY BUSINESS OS
├── HOME
│   ├── Dashboard (/)
│   └── Calendar & Planner (/calendar) [NEW]
├── OPERATIONS
│   ├── Sales & Orders (/orders)
│   ├── Products & Inventory (/inventory)
│   ├── Manufacturing (/manufacturing)
│   └── Evidence & Documents (/documents)
├── FINANCE
│   ├── Money & Transactions (/finance)
│   ├── Partner Accounts (/partners)
│   ├── Ventures & Investments (/ventures)
│   └── Reports & Statements (/reports)
└── SYSTEM
    ├── Customisation Studio (/studio)
    └── Backup & System Health (/settings)
```
- **Collapsible Desktop Sidebar:** Toggle button with keyboard shortcut (`Ctrl+[`) to expand/collapse into icon-only mode, maximizing workspace area on smaller laptops (1024px–1366px).
- **Cleaned Badges:** Removed static labels (`GL`, `20%`, `WEBP`, `WIP`, `NEW`). Badges only display dynamic information (e.g., active task count, overdue items).
- **Removed Fake Indicators:** Eliminated hardcoded `"Offline Safe"` pill and PostgreSQL version footer from the sidebar.

### 3.2 Top Header
- **Breadcrumb / Current Route Indicator:** Clear, legible page titles and section context.
- **Clickable Date & Calendar Shortcut:** Displays real current date (e.g., "Sat, Oct 24, 2026") that directly links to `/calendar`.
- **Search / Command Palette Shortcut:** Quick trigger button (`Ctrl+K`) for jumping to pages, orders, partners, or creating items.
- **Quick-Add Dropdown:** "+ Add New" button with quick actions:
  - New Calendar Note / Event / Task
  - New Expense / Transfer
  - New Sales Order
  - New Venture
- **User Profile & Logout:** Name, role, initial avatar, and sign out.
- **Diagnostics Relocated:** Removed `"PostgreSQL Active"` from top bar; moved to Settings > System Health.

---

## 4. Calendar & Planner Data Architecture

### 4.1 Relational Schema (`src/db/schema.ts`)
New database tables with foreign keys, indexes, and full auditability:

1. **`calendar_categories`**:
   - `id` (UUID PK)
   - `name` (text, e.g., "Production", "Finance", "Supplier", "Marketing", "Personal")
   - `slug` (text unique)
   - `color` (hex string, e.g., `#7D9472`)
   - `icon` (text, Lucide icon name)
   - `description` (text)
   - `isShared` (boolean, default true)
   - `isArchived` (boolean, default false)
   - `sortOrder` (integer, default 0)
   - `createdByUserId` (UUID -> users.id)
   - `createdAt`, `updatedAt`

2. **`calendar_entries`**:
   - `id` (UUID PK)
   - `title` (text not null)
   - `description` (text)
   - `entryType` (text: `EVENT`, `NOTE`, `TASK`, `DEADLINE`, `REMINDER`)
   - `status` (text: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`)
   - `priority` (text: `LOW`, `MEDIUM`, `HIGH`, `URGENT`)
   - `startDate` (timestamp with time zone, not null)
   - `endDate` (timestamp with time zone)
   - `isAllDay` (boolean, default false)
   - `location` (text)
   - `scope` (text: `COMPANY`, `VENTURE`, `PERSONAL`)
   - `visibility` (text: `PUBLIC`, `PARTICIPANTS`, `PRIVATE`)
   - `categoryId` (UUID -> calendar_categories.id)
   - `ventureId` (UUID -> ventures.id, nullable)
   - `productionOrderId` (UUID -> production_orders.id, nullable)
   - `salesOrderId` (UUID -> sales_orders.id, nullable)
   - `purchaseOrderId` (UUID -> purchase_orders.id, nullable)
   - `assignedPartnerId` (UUID -> partners.id, nullable)
   - `ownerUserId` (UUID -> users.id, not null)
   - `isArchived` (boolean, default false)
   - `createdAt`, `updatedAt`

3. **`calendar_checklist_items`**:
   - `id` (UUID PK)
   - `calendarEntryId` (UUID -> calendar_entries.id ON DELETE CASCADE)
   - `title` (text not null)
   - `isCompleted` (boolean, default false)
   - `completedAt` (timestamp with time zone)
   - `sortOrder` (integer, default 0)

4. **`calendar_recurrence_rules`**:
   - `id` (UUID PK)
   - `calendarEntryId` (UUID -> calendar_entries.id ON DELETE CASCADE)
   - `frequency` (text: `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`)
   - `interval` (integer, default 1)
   - `daysOfWeek` (integer[], 0 = Sunday)
   - `dayOfMonth` (integer)
   - `untilDate` (timestamp with time zone)
   - `maxOccurrences` (integer)

5. **`calendar_recurrence_exceptions`**:
   - `id` (UUID PK)
   - `calendarEntryId` (UUID -> calendar_entries.id ON DELETE CASCADE)
   - `originalDate` (timestamp with time zone not null)
   - `isCancelled` (boolean, default false)
   - `overrideTitle` (text)
   - `overrideStartDate` (timestamp with time zone)
   - `overrideEndDate` (timestamp with time zone)

6. **`calendar_preferences`**:
   - `id` (UUID PK)
   - `userId` (UUID -> users.id ON DELETE CASCADE, unique)
   - `defaultView` (text: `MONTH`, `WEEK`, `DAY`, `AGENDA`)
   - `firstDayOfWeek` (integer: 0 = Sun, 1 = Mon, 6 = Sat, default 6 for BD or 0/1)
   - `defaultCategoryIds` (jsonb)
   - `timezone` (text, default "Asia/Dhaka")

### 4.2 Universal Evidence Integration
Reuses `documents` and `documentLinks` with `entityType: "CALENDAR_ENTRY"` so calendar notes and event briefs can hold photos, supplier invoices, tech packs, and agreements with automatic Sharp WebP conversion.

---

## 5. Calendar Interface & Views (`/calendar`)

### 5.1 Interactive Views
1. **Month View (Default & Primary Focus):**
   - 7x5 or 7x6 day grid with clear date numbering and day-of-week headers.
   - Shows colored category pills for events, checkboxes for tasks, and note icons.
   - Clicking any date cell opens the date drawer/modal or triggers quick-add for that date.
   - Overflow badge ("+3 more") opens day inspector popover without clipping.
2. **Week View:**
   - 7-column layout displaying timed blocks (08:00 to 22:00) plus an all-day top shelf.
   - Configurable week-start day (Sunday, Monday, or Saturday).
3. **Day View:**
   - Single-day hour-by-hour timeline alongside a dedicated tasks and quick-note pad.
4. **Agenda View:**
   - Chronological, searchable list grouped by date with category filters, priority markers, and checklist progress indicators.

### 5.2 Calendar Toolbar
- Controls: Previous / Today / Next.
- Date Pickers: Jump directly to any month and year.
- View Switcher: Month / Week / Day / Agenda tabs.
- Multi-Category Filter: Toggle visibility of Production, Finance, Partner Meeting, Marketing, etc.
- Scope Filter: All, Business, Personal, or Specific Venture.
- Search Input: Real-time client-side and server-side filter.
- Action Buttons:
  - `+ New Entry` (creates Event, Note, Task, or Deadline).
  - `🖨️ Print / Export` (opens Printable Planner dialog).

---

## 6. Printable Planner Engine (`/print/calendar`)

### 6.1 Layout Specifications
Dedicated clean print styles (pure white background, rich black typography `#111111`, hairline borders `#D1D5DB`, and subtle category tags):

1. **Daily Business Planner (A4 Portrait):**
   - AFK THEORY logo & header with current weekday and full date.
   - Daily Agenda & Scheduled Appointments timeline.
   - Priority Action Checklist with check-boxes.
   - Business Notes & Discussions section.
   - Cashflow & Payment Deadlines block.
   - Dedicated lined area for handwritten notes.
2. **Weekly Planner (A4 Landscape):**
   - 7-day multi-column spread with customizable starting day.
   - Compact event items with category indicators.
   - Weekly Focus & Venture Milestones side rail.
   - Multi-page continuation for busy schedules.
3. **Monthly Calendar (A4 Landscape):**
   - Clean 7x5 full grid with large day numbers.
   - High-contrast event listings.
   - Detail Appendix for days with high entry counts to prevent text clipping.

### 6.2 Print & PDF Generation Options
- **Print Preview Modal:** Real-time WYSIWYG preview with format toggles (Daily, Weekly, Monthly), orientation (Portrait/Landscape), include/exclude options (tasks, completed, notes, private items).
- **Native Browser Print:** Optimized `@media print` with CSS page breaks and zero dark-theme bleeding.
- **Client/Server Downloadable PDF:** Real PDF document generation using `jspdf` / `pdf-lib` with correct formatting, Bangla text support, and ৳ currency symbol.

---

## 7. Business Module Redesign

### 7.1 Dashboard (`/`)
- Remove dense technical text.
- Introduce 6 core executive widgets:
  1. Financial Health & Net Profit summary (tabular numbers).
  2. Liquid Cash & Bank Balances.
  3. Today's Schedule & Calendar Agenda.
  4. Approaching Deadlines & Production WIP Due Soon.
  5. Pending Tasks & Checklists.
  6. Quick Operations Launcher.

### 7.2 Partner Accounts (`/partners`)
- Replace the cramped 5-column layout with a responsive, readable grid:
  - 1 column on mobile (<640px)
  - 2 columns on tablet (640px–1023px)
  - 3 columns on standard laptops (1024px–1440px)
  - 5 columns on ultra-wide screens (≥1440px)
- Increase font sizes from 10px-11px to 14px-16px.
- Clarify Capital In, Loan Balance, Drawings, and Total Equity.
- Maintain contextual proof uploader and transaction history.

### 7.3 Finance (`/finance`), Ventures (`/ventures`), Documents (`/documents`), Reports (`/reports`)
- Eliminate arbitrary hardcoded hex styling and unify with design tokens.
- Convert walls of monospace text into clear sans-serif typography with tabular numerals for figures.
- Provide clean table headers (14px), readable row heights (44px min), and high-contrast status pills.

### 7.4 System Health & Backups (`/settings`)
- Redesign the System Health dashboard to present business-focused metrics:
  - System Operational Status (Operational / Attention).
  - Last Successful Backup (date, size, verification status).
  - Backup Storage Path & Available Disk Space.
  - One-click "Create Encrypted Backup" button.
  - Verified Backup History table.
  - Step-by-step Disaster Recovery Runbook.
- Move low-level diagnostics (PostgreSQL driver details, raw version strings, PowerShell command snippets, raw audit logs) into collapsible "Advanced System Diagnostics" cards.
- Correctly label integrity checks: "SHA-256 Checksum Verified" instead of "SHA-256 Encryption".

---

## 8. Implementation Roadmap & Milestones

- **Phase 1: Design Foundation:**
  - Font assets setup (`Geist`, `Geist Mono`, `Noto Sans Bengali` in `src/fonts/`).
  - Next.js local font loading in `src/app/layout.tsx`.
  - Refactor `tailwind.config.ts` and `src/app/globals.css` with new token palette.
- **Phase 2: Navigation & Shell Overhaul:**
  - Redesign `Sidebar.tsx` (collapsible, no fake pills, no raw badges).
  - Redesign `Header.tsx` (clickable calendar date, search trigger, breadcrumbs).
  - Redesign `MobileNav.tsx` (touch-friendly, accessible).
  - Redesign Dashboard (`src/app/page.tsx`).
- **Phase 3: Calendar Database & Engine:**
  - Add calendar tables to `src/db/schema.ts`.
  - Create database migration and seed default categories.
  - Implement server actions and query services (`src/server/services/calendar.ts`).
  - Build main route `/calendar` with Month, Week, Day, and Agenda views.
- **Phase 4: Notes, Tasks & Category Customization:**
  - Build Note & Task drawer/editor with attachments, checklists, and priorities.
  - Build Category Management modal (colors, icons, visibility, sorting).
  - Build Business Entity linking (production orders, ventures, suppliers).
- **Phase 5: Printable Planner & PDF Engine:**
  - Create `/print/calendar` route and print templates (Daily, Weekly, Monthly).
  - Implement print configuration modal with real-time preview.
  - Implement PDF export generator with local download.
- **Phase 6: Application-Wide Polish:**
  - Refactor `/partners`, `/finance`, `/ventures`, `/inventory`, `/manufacturing`, `/orders`, `/reports`, `/settings`.
- **Phase 7: Comprehensive Verification & Regression:**
  - Run all vitest suites.
  - Add calendar unit and acceptance test suites.
  - Verify mobile responsiveness and print output.
  - Test backup and restore with calendar tables.

---

## 9. Verification Standards & Acceptance Scenarios

1. All 60 existing financial, venture, inventory, and security tests pass without regressions.
2. New calendar tests verify:
   - Month/Week/Day/Agenda view switching.
   - Creating, editing, archiving notes and tasks.
   - Category creation, color customization, and filtering.
   - All-day and timed events in Asia/Dhaka timezone.
   - Recurrence rules and exceptions.
   - Linking business entities (ventures, production orders).
   - Universal evidence attachment to calendar notes.
3. Responsive validation at 360px, 390px, 768px, 1024px, 1366px, 1920px.
4. Offline verification: No external CDN requests; fonts and PDFs work without an internet connection.
5. Backup verification: `scripts/backup.ps1` captures all new calendar tables and attachments.
