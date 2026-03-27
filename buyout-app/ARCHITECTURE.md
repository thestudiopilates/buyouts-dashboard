# Buyout Operations — System Architecture

## Overview

The Buyout Operations system manages the full lifecycle of group buyout events at The Studio Pilates. It spans three integrated platforms: a Monday.com board (data), a Make.com scenario (email automation), and a React dashboard (operational UI).

## Monday.com Board (#18394979378)

### Board Structure
The "Group Buyouts" board contains 70+ columns organized into these functional groups:

**Client Information**: Item name, email (emailoeuk5uwf), CC emails (text_mm1tnygh), phone

**Event Details**: Preferred dates, finalized date (date_mkzjkm1t), start/end times (hour_mm0rahy6/hour_mm0rrxfq), preferred location (dropdown_mkzgaf3g), final location (dropdown_mkzjkhds), instructor (text_mkzg27y9)

**Financial**: Total price (numeric_mkzj1sfj), amount paid (numeric_mm1v48qj), deposit (numeric_mm1v472d), remaining balance formula (formula_mm1v17wd), number of hours formula (formula_mm1v4p39)

**Links**: Deposit link (link_mkzjmvqw), balance link (link_mkzjsm8r), signup/Momence link (link_mkzg7k99)

**Status Columns**: Where Are We Now (23 lifecycle labels), What's Due Next (26 task labels), Ball In Court (TSP Team/Client/Both), How's it Tracking? (color_mkzjdr77)

**Email System**: Send Email Trigger (color_mkzjmcth — 14 labels), 14 long_text template columns (t1–t14), Email Thread ID (text_mm1ttgb7), Email Message ID (text_mm1t1dgy), CC Emails (text_mm1tnygh)

**Workflow**: 16 Yes/No status columns tracking the buyout lifecycle from Inquiry Reviewed through Post-Event Follow-Up

### Lifecycle Model

A buyout progresses through 12 stages tracked by the "Where Are We Now" status column:

```
Inquiry → Respond → Discuss → Feasible → Quote → Deposit →
Paid → Sign-Ups → Confirmed → Final → Ready → Complete
```

Status index mapping (new indices 106–157):
- 106: New Inquiry Received
- 107: Initial Response Sent
- 108: Follow Up Sent
- 109: Feasibility Confirmed
- 110: Quote Sent
- 151: Deposit Received
- 152: Payment Complete
- 153: Awaiting Guest Sign-Ups
- 154: Sign-Ups Complete
- 155: Final Confirmation Sent
- 156: Ready for Event
- 15: Event Complete (legacy)

Terminal states (hidden by default): 15, 105, 157, 17, 18

### Triple Status Sync Problem

Three column groups track status independently — leads to drift:
1. "Where Are We Now" (lifecycle position)
2. "What's Due Next" (current task)
3. 16 workflow checkboxes (granular progress)

Currently all manually managed. Planned automations will sync them:
- Where Are We Now change → auto-update What's Due Next
- Where Are We Now change → auto-check relevant workflow boxes

## Make.com Scenario (#4639696)

### Module Chain

```
[Monday Webhook] → [GraphQL Query] → [Gmail Send] → [Store Message ID]
     (instant)       (fetch data)    (send email)    (update board)
```

**Module 1 — Webhook**: Watches `color_mkzjmcth` for non-empty label changes
**Module 2 — GraphQL**: Fetches item with aliases t1–t14, dateCol, emailCol, ccCol, instructorEmail
**Module 3 — Gmail**: switch() maps trigger label → template, sends from events@thestudiopilates.com
**Module 4 — Update**: Stores Gmail messageId back to board for threading

### Key Technical Decision: GraphQL over GetItem
The Monday `GetItem` module reads board schema (shows long_text columns in picker) but does NOT return long_text data at runtime. This caused blank email bodies. Solution: `ExecuteGraphQLQuery` with field aliases, which returns all data correctly.

### Email Threading
Emails auto-thread in Gmail by matching the subject line format:
`The Studio Pilates Buyout: [Client Name] | [Month Day, Year]`

The date is formatted from the `dateCol` alias using:
`formatDate(parseDate(dateCol; "YYYY-MM-DD"); "MMMM D, YYYY")`

## Dashboard Architecture

### Component Hierarchy

```
App
├── NavBar (logo, "New Buyout" button, user avatar)
├── KPICards (5 summary cards)
├── FilterBar (search, BIC, location, staff, sort, show-completed)
├── BuyoutTable
│   ├── TableHeader (7 column labels)
│   └── BuyoutRow[] (one per active buyout)
│       ├── ClientCell (avatar, name, type badge, assigned-to)
│       ├── StatusCell (badge + lifecycle bar)
│       ├── NextActionCell (due-next text + waiting badge)
│       ├── WaitingOnCell (BIC pill)
│       ├── CountdownCell (circle badge)
│       ├── SignUpsCell (count + bar)
│       └── ProgressCell (percentage + bar)
└── DetailPanel (slide-out, 460px)
    ├── PanelHeader (name, type, location, BIC/tracking pills)
    ├── StatusStrip (current status + lifecycle bar)
    ├── TabBar (Overview | Checklist | Emails | Financials)
    ├── OverviewTab (quick stats, event details, attendance, contact, notes)
    ├── ChecklistTab (16 steps in 6 groups with checkboxes)
    ├── EmailsTab (14 templates with readiness indicators + send buttons)
    ├── FinancialsTab (payment cards, progress bar, links)
    └── PanelFooter (Send Email, Edit Details, Notes buttons)
```

### State Management

```javascript
// App-level state
selectedBuyout    // Currently selected item (drives DetailPanel)
filterBIC         // "All" | "TSP Team" | "Client"
filterLocation    // "All" | "1583 Decatur" | "1581 Decatur" | "763 Trabert"
filterStaff       // "All" | "Kelly" | "Autumn" | "Unassigned"
searchQuery       // Free text filter on client name
sortKey           // "eventDate" | "daysWaiting" | "status" | "checklist" | "name"
showCompleted     // Boolean — toggle terminal-state items
```

### Urgency Color System

The dashboard uses a consistent green → yellow → red visual system:

**Countdown (days to event)**:
- 14+ days: Seaglass (#006976) — all good
- 7–13 days: Sunshine (#F2A408) — heads up
- 4–6 days: Terracotta (#9F543F) — getting close
- 0–3 days: Cherry (#E8581B) + glow — urgent

**Days Waiting (since last action)**:
- 0–2 days: Seaglass — fresh
- 3–5 days: Apricot (#E0800E) — follow up
- 6+ days: Cherry — overdue

**Tracking Health** (from board column):
- "So far so good": Seaglass
- "Running behind": Apricot
- "Major issue": Cherry
- "Complete": Sky (#A1B1A4)

## Integration Points

### Data Read
- Monday API `items_page` query fetches all board items with column values
- Transform function maps raw column_values to typed app data model
- Polling or webhook subscription for real-time updates

### Email Trigger (Write)
- Dashboard mutation sets `color_mkzjmcth` to trigger label
- Make.com webhook fires within seconds
- Email sent and message ID stored automatically

### Workflow Updates (Write)
- Checkbox toggle → Monday mutation to Yes/No status column
- Edit dialog → `change_multiple_column_values` mutation

### Future: Momence Integration
- Scrape or API the Momence class link to pull current signup count
- Write to a "Current Signups" column on the board
- Removes need for manual sign-up tracking
