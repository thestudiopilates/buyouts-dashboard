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
- `lib/`: mock repository, workflow definitions, and validation
- `prisma/`: production-oriented database schema

The UI currently reads seeded mock buyout data from `lib/mock-data.ts`. The inquiry form posts to `/api/inquiries`, which validates input and stores submissions in an in-memory placeholder repository. The next implementation step is swapping those repository functions for Prisma-backed database reads and writes.

Monday migration scaffolding is now included as well:

- `lib/monday-types.ts`: expected Monday export shapes
- `lib/monday-mapping.ts`: Monday-to-platform transform logic
- `docs/MONDAY_MIGRATION.md`: migration process notes

## Setup

1. Install Node.js 20+ and npm.
2. Copy `.env.example` to `.env.local`.
3. Set a valid `DATABASE_URL`.
4. Run `npm install`.
5. Run `npm run db:generate`.
6. Run `npm run dev`.

## Recommended Next Build Steps

1. Replace the mock `listBuyouts`, `getBuyout`, and `createInquiry` functions with Prisma implementations.
2. Add a real import command that writes Monday exports into Prisma.
3. Add authentication and protect internal routes.
4. Add email templates, send history, and provider integration.
5. Add assignment logic, tasks, and reminders.

## Verification Note

This workspace does not currently have `node` or `npm` available, so the scaffold could not be installed or run locally during this session. The files were created to be ready for local setup once the JavaScript toolchain is available.
