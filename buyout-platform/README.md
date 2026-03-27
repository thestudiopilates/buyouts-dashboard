# Buyout Platform

This is the first-party application scaffold for The Studio Pilates buyouts platform. It is designed to replace the current Monday + Make workflow over time and become the foundation for a broader management portal.

## What Is Included

- Next.js application structure
- Public buyout inquiry page at `/buyouts/inquire`
- Internal dashboard shell at `/dashboard`
- Buyouts pipeline view at `/buyouts`
- Individual buyout detail view at `/buyouts/[id]`
- Prisma schema for the initial production data model
- Mock repository layer so UI can be built before the live database is wired up
- Monday migration mapping and import planning docs

## Current State

This scaffold is intentionally split into:

- `app/`: public pages, portal pages, and API routes
- `components/`: reusable UI pieces
- `lib/`: mock repository, workflow definitions, validation, Prisma client, and repository layer
- `prisma/`: production-oriented database schema
- `scripts/`: operational scripts such as Monday imports

The UI currently reads seeded mock buyout data from `lib/mock-data.ts` unless a `DATABASE_URL` is configured, in which case the app can read through the Prisma repository layer. The inquiry form posts to `/api/inquiries`, which validates input and stores submissions in an in-memory placeholder repository. The next implementation step is moving inquiry creation and the remaining read paths fully into Prisma.

Monday migration scaffolding is now included as well:

- `lib/monday-types.ts`: expected Monday export shapes
- `lib/monday-mapping.ts`: Monday-to-platform transform logic
- `docs/MONDAY_MIGRATION.md`: migration process notes

## Setup

1. Install Node.js 20+ and npm.
2. Copy `.env.example` to `.env.local`.
3. Set valid `DATABASE_URL` and `DIRECT_URL` values.
4. Run `npm install`.
5. Run `npm run db:generate`.
6. Run `npm run dev`.

If Node was installed locally into `~/.local/bin`, make sure your shell can see it:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## Available Scripts

- `npm run dev`: start the Next.js app locally
- `npm run build`: generate Prisma client and create a production build
- `npm run db:generate`: generate Prisma client
- `npm run db:push`: push the Prisma schema to the configured database
- `npm run import:monday -- ./path/to/export.json`: import a Monday JSON export into Prisma
- `npm run seed:demo`: seed Supabase with demo buyout records for local review

## Local Review

With `.env.local` configured, the app runs locally at:

- `http://localhost:3000`
- `http://localhost:3000/dashboard`
- `http://localhost:3000/buyouts/inquire`

The current Supabase project already has the initial schema and seeded demo records, so the dashboard is reviewable locally.

## Deployment Readiness

This repo now includes `vercel.json` for a straightforward Vercel deployment path. For the first hosted preview, configure these environment variables in Vercel:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_APP_NAME`

## Supabase Connection Setup

Use the Supabase pooler for application traffic and the direct database connection for Prisma schema operations.

- `DATABASE_URL`: pooled connection string for the app
- `DIRECT_URL`: direct connection string for Prisma schema push and admin operations

Typical setup:

```bash
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"
```

## Recommended Next Build Steps

1. Expand the Monday import command to preserve workflow steps once the missing status and workflow column IDs are exported from Monday.
2. Add authentication and protect internal routes.
3. Add email templates, send history, and provider integration.
4. Add assignment logic, tasks, and reminders.
5. Replace demo seed data with imported Monday records and live website submissions only.

## Verification Note

The app dependencies are installed locally, `npm run build` completes successfully, and the Supabase schema plus demo seed data are in place. The next milestone is importing real Monday records so the dashboard can move from demo content to live operational data.
