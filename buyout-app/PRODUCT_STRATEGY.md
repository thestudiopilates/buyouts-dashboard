# Buyouts Platform Product Strategy

## Recommendation

Build a first-party web platform that owns the full buyout workflow end to end:

- Public website inquiry form
- Internal management dashboard
- Backend API and automation layer
- Database as the system of record

Do not keep Monday.com and Make.com as the long-term center of the system. Use them only as temporary migration bridges where needed.

This approach gives The Studio Pilates:

- Lower recurring automation costs
- Full control over intake, workflow, and reporting
- Cleaner team experience than a board-based UI
- A strong foundation for later modules like projects, studio schedules, and front desk schedules

## Product Vision

Create one internal operations portal for the management team with a shared navigation shell:

- Buyouts
- Projects
- Studio Schedule
- Front Desk Schedule
- Reporting
- Admin

The first module should be Buyouts. It has the clearest existing process, defined lifecycle, and strongest source material in this repository.

## Current State

The current repository documents a Monday-centered workflow:

- Monday board stores buyout data and status fields
- Make.com triggers and sends emails
- Gmail is the outbound mail provider
- React dashboard is planned as the team-facing UI

This is a strong process definition, but not yet a complete product. It gives us enough structure to migrate the workflow into a first-party application.

## Target Architecture

### Core Principles

- The website form should write directly to your database
- The app should own workflow logic instead of Monday automations
- Email sending should happen through your backend, not Make.com
- The dashboard should be the single operational workspace for managers
- Other systems should integrate through APIs, sync jobs, or deep links

### Recommended Stack

- Frontend and app shell: Next.js
- Backend: Next.js server actions and route handlers or a small Node API layer
- Database: PostgreSQL
- ORM: Prisma or Drizzle
- Auth: Clerk or Supabase Auth
- Email: Resend or Postmark
- File storage: Supabase Storage or S3-compatible storage if needed later
- Background jobs: Vercel Cron, Trigger.dev, or a hosted worker
- Hosting: Vercel for the app, managed Postgres for the database

### Why This Stack

- One codebase can serve both the public inquiry form and internal dashboard
- PostgreSQL gives flexibility for workflow, reporting, and future modules
- A modern app framework keeps future expansion manageable
- Background jobs replace Make.com at far lower cost and with better control

## System Design

### Public Website Layer

Primary functions:

- Buyout inquiry form
- Confirmation page
- Optional intake update forms later

Behavior:

- Form submits to backend
- Backend validates the input
- Backend creates a new lead or buyout record
- Team receives notification
- Dashboard immediately shows the new inquiry

### Internal Dashboard Layer

Primary functions:

- Pipeline view
- Detail view
- Checklist and workflow management
- Email sending and templates
- Payment status tracking
- Sign-up monitoring
- Calendar and staffing views later

### Backend Layer

Primary functions:

- Stores all buyout data
- Runs workflow rules
- Sends transactional and operational emails
- Schedules reminders and follow-ups
- Syncs with optional third-party tools
- Powers reporting

### Integration Layer

Use integrations selectively:

- Website CMS or website embed for inquiry form
- Gmail or domain email provider for outbound mail
- Calendar provider for studio schedule sync later
- Project management system via API or linked records later
- Monday only as a temporary import or mirror during migration

## Data Model

Start with a normalized schema that can later support the wider management hub.

### Core Tables

`buyout_inquiries`
- `id`
- `created_at`
- `source`
- `client_name`
- `client_email`
- `client_phone`
- `company_name`
- `event_type`
- `preferred_dates`
- `preferred_location`
- `guest_count_estimate`
- `notes`
- `status`

`buyouts`
- `id`
- `inquiry_id`
- `created_at`
- `updated_at`
- `display_name`
- `lifecycle_stage`
- `workflow_status`
- `tracking_health`
- `ball_in_court`
- `assigned_manager_id`
- `event_date`
- `start_time`
- `end_time`
- `location_id`
- `instructor_name`
- `capacity`
- `signup_count`
- `last_action_at`
- `next_action`
- `notes_internal`

`buyout_contacts`
- `id`
- `buyout_id`
- `name`
- `email`
- `phone`
- `role`
- `is_primary`

`buyout_financials`
- `id`
- `buyout_id`
- `quoted_total`
- `deposit_amount`
- `amount_paid`
- `remaining_balance`
- `deposit_due_at`
- `final_payment_due_at`
- `deposit_link`
- `balance_link`

`buyout_workflow_steps`
- `id`
- `buyout_id`
- `step_key`
- `step_group`
- `label`
- `is_complete`
- `completed_at`
- `completed_by`

`buyout_emails`
- `id`
- `buyout_id`
- `template_key`
- `subject`
- `body_html`
- `body_text`
- `sent_at`
- `sent_by`
- `provider_message_id`
- `provider_thread_id`
- `status`

`buyout_tasks`
- `id`
- `buyout_id`
- `title`
- `due_at`
- `owner_id`
- `status`
- `task_type`

`locations`
- `id`
- `name`
- `address`
- `timezone`

`staff_users`
- `id`
- `name`
- `email`
- `role`
- `team`

### Important Design Choice

Store both:

- A high-level lifecycle stage
- A granular checklist of workflow steps

That preserves the structure already captured in the current documents while avoiding the status drift problem described in the Monday design.

## Workflow Model

The current buyout lifecycle is a strong starting point:

1. Inquiry
2. Respond
3. Discuss
4. Feasible
5. Quote
6. Deposit
7. Paid
8. Sign-Ups
9. Confirmed
10. Final
11. Ready
12. Complete

In the new system:

- Lifecycle stage should be the main operational status
- Workflow steps should be auto-derived or assisted by rules
- Ball in court should be derived from the active task and stage when possible
- Next action should be generated by workflow logic, with manual override allowed

## Email and Automation Strategy

Replace Make.com with native app workflows.

### Email Templates

Keep the current template library but move templates into the app database or code-managed templates.

Each template should support:

- Subject template
- Body template
- Required fields validation
- Preview before send
- Send history

### Automation Triggers

Examples:

- On inquiry created, notify internal team
- On quote sent, create deposit follow-up task
- If deposit unpaid after X days, schedule reminder email
- If event is approaching and sign-ups are below threshold, alert assigned manager
- After event completion, schedule follow-up email and closeout task

### Automation Engine

You do not need a heavy external automation product for this early stage.

Use:

- Database-driven jobs table
- Cron-triggered worker
- Event handlers in backend code

This will cover most needs at much lower cost than Make.com.

## MVP Scope

The first production release should focus on replacing the current buyouts workflow cleanly.

### MVP Must Have

- Public buyout inquiry form on the website
- Internal login for management team
- Buyouts list view with filters and search
- Buyout detail page
- Lifecycle status management
- Checklist workflow tracking
- Notes and internal ownership
- Email template preview and send
- Financial summary and payment status
- Basic alerts and reminders

### MVP Nice to Have

- Calendar view
- Front desk handoff view
- Simple reporting dashboard
- File attachments
- Activity timeline

### MVP Not Yet

- Rebuilding every external system inside the app
- Advanced forecasting
- Deep project-management replacement
- Full studio schedule engine

## UI and Navigation Strategy

Build the app as a multi-module internal portal from the beginning, even if only Buyouts is live at first.

Recommended top navigation:

- Home
- Buyouts
- Projects
- Studio Schedule
- Front Desk
- Reports
- Settings

Modules not yet built can initially show:

- Summary cards
- Quick links to source systems
- Placeholder data contracts for future buildout

This creates the single-home experience you want without forcing all module development at once.

## Migration Strategy

### Phase 0: Foundation

- Define data schema
- Stand up Next.js app and database
- Build auth and team roles
- Model the buyout lifecycle and workflow steps

### Phase 1: Intake Replacement

- Build the website inquiry form
- Send all new inquiries into your own database
- Notify team internally and by email
- Optionally mirror new inquiries into Monday during transition

Success criteria:

- New inquiries no longer require Monday form intake

### Phase 2: Internal Dashboard MVP

- Build pipeline table
- Build detail pages
- Add notes, assignments, workflow steps, and statuses
- Add financial snapshot and links
- Add email templates and send flow

Success criteria:

- Team can manage active buyouts inside the new dashboard

### Phase 3: Automation Cutover

- Replace Make email triggers with app-native sending
- Add reminder jobs and due-date logic
- Add event-based notifications
- Remove Make.com from day-to-day use

Success criteria:

- Operational email flow no longer depends on Make.com

### Phase 4: Monday Decommission or Reduced Use

- Import or sync legacy buyouts from Monday
- Freeze Monday to archive/reference mode
- Keep only limited sync if there is still business need

Success criteria:

- Your app becomes the system of record for buyouts

### Phase 5: Management Hub Expansion

- Add projects module
- Add studio schedule integration
- Add front desk schedule integration
- Add shared reporting

Success criteria:

- Managers can access the major operating systems from one app shell

## Monday Migration Notes

Monday still contains useful process definitions and historical data. Use it as migration input, not target architecture.

Recommended migration approach:

- Export current board data
- Map board columns to the new database schema
- Import active buyouts first
- Import email templates and workflow labels second
- Preserve Monday item IDs as legacy reference fields if needed

Do not try to replicate Monday column-for-column in the new system. Translate the business concepts instead.

## Risks and How to Reduce Them

### Risk: Rebuilding too much too early

Mitigation:

- Keep MVP focused on buyouts only
- Use links for unfinished modules

### Risk: Workflow ambiguity during migration

Mitigation:

- Define one canonical lifecycle model in code
- Establish clear ownership for stage changes and task generation

### Risk: Email reliability during cutover

Mitigation:

- Use a reputable transactional provider
- Log every send and failure
- Support manual resend from the dashboard

### Risk: Team adoption

Mitigation:

- Match the current team mental model from the existing buyout process
- Keep screens simple and operational
- Add deep links to familiar systems during transition

## Recommended First Build Sequence

1. Create the application shell and database
2. Build the public buyout inquiry form
3. Build the internal buyouts list and detail view
4. Add lifecycle, workflow, and assignment logic
5. Add email templates and send history
6. Add automations and reminders
7. Import legacy Monday data

## Suggested Repo Direction

This repository currently holds source material and architecture notes. The implementation repo should likely become a true application codebase with a structure like:

```text
buyout-platform/
  apps/
    web/
  packages/
    ui/
    db/
    workflows/
    integrations/
  docs/
    product/
    architecture/
    migration/
```

If you prefer to keep a single repo at first, that is also fine. The main goal is to separate:

- product docs
- application code
- database schema
- workflow logic
- integration adapters

## Immediate Next Decisions

The next build step should be:

- Start a new app codebase for the first-party platform

Recommended decision defaults:

- Use Next.js for both public and internal surfaces
- Use PostgreSQL as the system of record
- Use a transactional email provider instead of Make.com
- Keep Monday only as a temporary migration source

## What Success Looks Like

When this is working well:

- A customer submits a buyout form on your website
- The inquiry instantly appears in your internal dashboard
- The assigned manager can move it through the pipeline without touching Monday
- Email reminders, follow-ups, and internal tasks happen automatically
- Managers use the same app shell later to access projects and schedules

That gives you a real operations platform instead of a collection of connected tools.
