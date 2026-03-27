# Make.com Scenario Reference

## Scenario: Buyout Email Threading
- **ID**: 4639696
- **Folder**: Buyout Operations (ID: 312354)
- **URL**: https://us1.make.com/965901/scenarios/4639696
- **Status**: Active (production)

## Module Chain (4 modules)

### Module 1: Monday Webhook (Instant Trigger)
- **Hook ID**: 2663435
- **Board**: 18394979378 (Group Buyouts)
- **Watches**: `color_mkzjmcth` (Send Email Trigger) column changes
- **Filter**: Non-empty labels only (ignores clear events)

### Module 2: Monday ExecuteGraphQLQuery
- **Connection**: 3941894 (Monday Conflict Checker)
- **Query**: See `graphql-query.graphql` in this directory
- **Key**: Uses field aliases (t1–t14, dateCol, emailCol, instructorEmail, ccCol) for clean variable access in downstream modules
- **Why not GetItem?**: The `monday:GetItem` module shows long_text columns in the variable picker (reads board schema) but does NOT return their data at runtime. This was the root cause of blank email bodies.

### Module 3: Gmail Send
- **Connection**: 4719260 (events@thestudiopilates.com)
- **From**: events@thestudiopilates.com
- **To**: `{{2.body.data.items[1].emailCol[1].text}}` (dynamic from board)
- **CC**: `{{ifempty(2.body.data.items[1].ccCol[1].text; emptystring)}}` (null-safe)
- **Subject**: `The Studio Pilates Buyout: {{2.body.data.items[1].name}} | {{formatDate(parseDate(2.body.data.items[1].dateCol[1].text; "YYYY-MM-DD"); "MMMM D, YYYY")}}`
- **Body**: `switch()` maps trigger label → aliased template content, wrapped in `replace(TEMPLATE; newline; "<br>")` inside a styled HTML div for proper line break rendering
- **Filter (on this module)**: Checks that switch() result ≠ "No template found" — prevents sending when trigger column is cleared

### Module 4: Monday UpdateColumns
- **Connection**: 3941894
- **Board**: 18394979378
- **Item ID**: From webhook payload
- **Columns updated**:
  - `text_mm1ttgb7` (Email Thread ID) → Gmail message ID
  - `text_mm1t1dgy` (Email Message ID) → Gmail message ID
- **Purpose**: Enables email threading — Gmail auto-threads by matching subject line

## Gmail Connections
- **4719260**: events@thestudiopilates.com (ACTIVE — used in scenario)
- **4712300**: kelly@thestudiopilates.com (NOT used — cleanup recommended)

## Trigger Label → Template Mapping (switch() cases)

| Trigger Label | GraphQL Alias | Column ID |
|---|---|---|
| First Inquiry Email Sent | t1 | long_text_mkzjxtpp |
| Clarify Food Beverage Policy | t2 | long_text_mkzjd66k |
| Deposit & Date Email | t3 | long_text_mkzjwxsh |
| Deposit Reminder Email | t4 | long_text_mkzjpmj |
| Event Details & Sign Up | t5 | long_text_mkzjfbe9 |
| Second Half Payment Email | t6 | long_text_mkzj7sj5 |
| Remaining Balance Reminder | t7 | long_text_mkzjemea |
| Event Cancelled (No Refund) | t8 | long_text_mkzj2qt0 |
| Event Cancelled (Refund) | t9 | long_text_mkzj6xcc |
| Missing Signups Email | t10 | long_text_mkzj45br |
| Final Confirmation Email | t11 | long_text_mkzj6cy5 |
| Event Complete | t12 | long_text_mkzjab4d |
| Ongoing Discussion Email | t13 | long_text_mkzj14vc |
| 48-Hour Missing Signups | t14 | long_text_mkzjw24h |

## Known Issues
1. **No variable validation**: Make.com sends templates with raw `{{placeholders}}` if board columns are empty
2. **No trigger reset**: After sending, `color_mkzjmcth` retains the label — should be cleared to prevent re-fires
3. **t13 dual-purpose**: `long_text_mkzj14vc` is both conversation log AND template — sends entire history
4. **Duplicate Gmail connection**: Connection 4712300 (kelly@) exists but isn't used — should be removed
