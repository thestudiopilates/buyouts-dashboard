# Buyout Phase Alignment

This is the canonical lifecycle model for the first-party buyout platform. It aligns:

- lifecycle stage
- default status label
- next action
- ball in court
- primary email templates

## Canonical Flow

1. `Inquiry`
Status: `New Inquiry Received`
Next: `Review inquiry and send initial response`
Ball in Court: `Team`
Templates: `t1`, `t2`, `t13`

2. `Respond`
Status: `Initial Response Sent`
Next: `Wait for client response`
Ball in Court: `Client`
Templates: `t2`, `t13`

3. `Discuss`
Status: `Ongoing Discussion`
Next: `Confirm dates, location, and event details`
Ball in Court: `Both`
Templates: `t2`, `t13`

4. `Feasible`
Status: `Feasibility Confirmed`
Next: `Prepare quote and deposit terms`
Ball in Court: `Team`
Templates: `t3`, `t13`

5. `Quote`
Status: `Quote Sent`
Next: `Send deposit and date confirmation`
Ball in Court: `Client`
Templates: `t3`, `t4`, `t13`

6. `Deposit`
Status: `Awaiting Deposit`
Next: `Follow up on deposit payment`
Ball in Court: `Client`
Templates: `t4`, `t13`

7. `Paid`
Status: `Deposit Received`
Next: `Finalize instructor and send event details`
Ball in Court: `Team`
Templates: `t5`, `t6`, `t13`

8. `Sign-Ups`
Status: `Awaiting Guest Sign-Ups`
Next: `Monitor registrations and waivers`
Ball in Court: `Client`
Templates: `t6`, `t10`, `t13`, `t14`

9. `Confirmed`
Status: `Sign-Ups Complete`
Next: `Confirm remaining balance and prep final communication`
Ball in Court: `Team`
Templates: `t6`, `t7`, `t11`, `t13`

10. `Final`
Status: `Final Confirmation Sent`
Next: `Prepare final event logistics`
Ball in Court: `Team`
Templates: `t7`, `t11`, `t13`, `t14`

11. `Ready`
Status: `Ready for Event`
Next: `Host event and capture any final changes`
Ball in Court: `Team`
Templates: `t12`, `t13`, `t14`

12. `Complete`
Status: `Event Complete`
Next: `Closed`
Ball in Court: `Team`
Templates: `t12`

13. `Cancelled`
Status: `Cancelled`
Next: `Closed`
Ball in Court: `Team`
Templates: `t8`, `t9`

## Key Alignment Rules

- Sending `t3` moves a buyout into `Deposit`, which means waiting on the client for deposit payment.
- Once `deposit-paid-and-terms-signed` is complete, the platform should treat the buyout as `Paid`, not `Deposit`.
- Sending `t5` moves a buyout into `Sign-Ups`.
- When all attendees are registered and all waivers are signed, the platform should treat the buyout as `Confirmed`.
- Sending `t11` moves a buyout into `Final`.
- Sending `t12` moves a buyout into `Complete`.
- `t8` and `t9` move a buyout into `Cancelled`.
- Reminder and informational templates do not advance lifecycle unless explicitly configured.

## Current Implementation Notes

- Outbound delivery is still routed through the internal review recipient before true client-send mode is enabled.
- The live data model can still show source-board inconsistencies when Monday data conflicts with checklist completion.
- The platform now prioritizes checklist truth over stale Monday status labels for `Paid`, `Sign-Ups`, `Confirmed`, `Final`, and `Complete` transitions.
