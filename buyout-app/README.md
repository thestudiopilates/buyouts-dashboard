# Buyout Operations Dashboard — The Studio Pilates

## What This Is

A comprehensive operational dashboard for managing group buyout events at The Studio Pilates (Atlanta, GA). Tracks the full buyout lifecycle from initial inquiry through event completion, including email automation, payment tracking, sign-up monitoring, and workflow checklists.

## Target Deployment

**Monday.com Vibe App** (App ID: 10103061)
- Stack: React + Chakra UI via Monday Vibe (AI code builder)
- API: Monday.com BoardSDK + GraphQL API v2
- Email automation: Make.com scenario → Gmail

Alternative: Can be built as a standalone React app that connects to Monday.com via API token.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    BUYOUT DASHBOARD (React)                      │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ KPI     │ │ Buyout   │ │ Detail   │ │ Filters & Sort     │  │
│  │ Cards   │ │ Table    │ │ Panel    │ │                    │  │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └────────┬───────────┘  │
│       │           │            │                │              │
│       └───────────┴────────────┴────────────────┘              │
│                           │                                     │
│                    ┌──────┴──────┐                              │
│                    │ Monday API  │                              │
│                    └──────┬──────┘                              │
└───────────────────────────┼─────────────────────────────────────┘
                            │
              ┌─────────────┼─────────────────┐
              │             │                 │
    ┌─────────┴────┐  ┌────┴─────┐  ┌───────┴────────┐
    │ Monday Board │  │ Make.com │  │ Gmail          │
    │ #18394979378 │  │ #4639696 │  │ events@tsp.com │
    └──────────────┘  └──────────┘  └────────────────┘
```

### Data Flow: Email Send
1. User clicks "Send" on a template in the dashboard
2. Dashboard sets `color_mkzjmcth` (Send Email Trigger) to the template's trigger label
3. Monday webhook (hookId: 2663435) fires instantly
4. Make.com runs GraphQL query with aliases (t1–t14) to fetch template content
5. `switch()` maps trigger label → template body from the aliased column
6. Gmail sends from events@thestudiopilates.com with auto-threading by subject
7. Gmail message ID stored back on board for reference

## File Structure

```
buyout-app/
├── README.md                          ← You are here
├── ARCHITECTURE.md                    ← Detailed system design doc
│
├── docs/
│   ├── Buyout_Dashboard_UI_Spec.docx  ← Full UI-to-board mapping (Word doc)
│   └── Buyout_Dashboard_Mockup.html   ← Annotated working prototype (open in browser)
│
├── src/
│   ├── config/
│   │   ├── boardColumns.js            ← All Monday column IDs (single source of truth)
│   │   ├── emailTemplates.js          ← 14 templates: triggers, columns, required vars
│   │   ├── workflowSteps.js           ← 16 workflow steps grouped by 6 phases
│   │   ├── statusLifecycle.js         ← "Where Are We Now" index → 12-step lifecycle
│   │   └── colorSystem.js             ← Brand palette + urgency threshold functions
│   │
│   ├── api/
│   │   ├── mondayClient.js            ← GraphQL queries & mutations for Monday API
│   │   └── makeWebhook.js             ← Make.com trigger integration + email send helpers
│   │
│   ├── hooks/
│   │   └── useBuyoutData.js           ← Data model, Monday→app transform, state shape
│   │
│   └── utils/
│       └── formatting.js              ← Date, money, time, percentage formatters
│
├── make-com/
│   ├── scenario-reference.md          ← Full Make.com scenario documentation
│   └── graphql-query.graphql          ← The exact GraphQL query used in Make.com
│
└── monday-board/
    ├── column-reference.json          ← Complete column ID registry (JSON)
    └── automations-needed.md          ← Planned Monday automations spec
```

## Key Board IDs

| Resource | ID |
|---|---|
| Board | 18394979378 |
| Make.com Scenario | 4639696 |
| Webhook Hook | 2663435 |
| Gmail Connection | 4719260 |
| Vibe App | 10103061 |

## Dashboard Features

### Main View (7-Column Table)
| Column | Data Source | Visual |
|---|---|---|
| Client | Item name + event type + assigned staff | Avatar with BIC color |
| Status | "Where Are We Now" + "How's it Tracking?" | Color-coded badge + 12-step lifecycle bar |
| Next Action | "What's Due Next" + days waiting | Text colored by urgency (green/yellow/red) |
| Waiting On | "Ball In Court" | Pill badge ("Us" or "Client") |
| Countdown | Days until event date | Circle badge with urgency colors |
| Sign-Ups | Signups / capacity | Count + progress bar |
| Progress | 16 workflow checkboxes | Percentage + progress bar |

### Detail Panel (4 Tabs)
- **Overview**: Event details, attendance, contact info, notes
- **Checklist**: 16 workflow steps in 6 phases (Intake → Execution)
- **Emails**: 14 templates with sent status, variable readiness, send buttons
- **Financials**: Payment breakdown, progress bar, payment links

### KPI Cards
- Active Buyouts (split by ball-in-court)
- This Week (events in next 7 days)
- Needs Attention (overdue or flagged)
- Pipeline (total revenue)
- Outstanding (unpaid balance)

## Color System

| Color | Hex | Meaning |
|---|---|---|
| Seaglass | #006976 | Positive: on track, TSP team, paid |
| Sky | #A1B1A4 | Complete, secondary positive |
| Sage | #797F5D | Moderate positive: 70%+ fill |
| Sunshine | #F2A408 | Warning: 7-13 days out |
| Apricot | #E0800E | Elevated: running behind |
| Terracotta | #9F543F | Brand accent, client action needed |
| Cherry | #E8581B | Urgent: 0-3 days, major issue |

## Known Issues to Fix Before Launch

1. **"How's it Tracking?" defaults to "Complete"** for new items — should default to "So far so good"
2. **"Event Completed" column has "v" instead of "No"** for its negative label
3. **t13 column is dual-purpose** — conversation log AND email template. Split needed.
4. **No Make.com validation** for unresolved `{{variables}}` before sending
5. **16 workflow checkbox column IDs** need to be fetched via `get_board_info` API call
6. **"Front Desk Assigned" column** doesn't exist yet — needs to be created
7. **Trigger column not reset** after email send — risk of re-firing

## New Board Columns Needed

| Column | Type | Purpose |
|---|---|---|
| Front Desk Assigned | Text/People | Staff routing and dashboard filtering |
| Event Type | Dropdown | Birthday/Corporate/Bachelorette/etc. |
| Outgoing Email Draft | Long Text | Separate from t13 conversation log |
| PM Notes | Long Text | Internal operational notes |

## Getting Started

1. Open `docs/Buyout_Dashboard_Mockup.html` in a browser to see the working prototype
2. Review `docs/Buyout_Dashboard_UI_Spec.docx` for the complete UI-to-board mapping
3. Start with `src/config/boardColumns.js` — this is the foundation everything imports from
4. Use `monday-board/column-reference.json` as your API field guide
5. Reference `make-com/scenario-reference.md` for the email automation architecture

## Brand & Typography

- **Heading font**: Playfair Display (stand-in for Moret)
- **Body font**: DM Sans (stand-in for Adelle Sans)
- **Background**: #F4EDE7
- **Cards**: #FEFCFA
- **Primary accent**: Terracotta (#9F543F)
- **Positive**: Seaglass (#006976)
