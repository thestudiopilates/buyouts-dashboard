# Monday.com Automations Needed

## Priority 1: Status Sync Automations

### Where Are We Now → What's Due Next
When "Where Are We Now" changes, automatically set "What's Due Next" to the corresponding task:

| When Status Becomes | Set Due Next To |
|---|---|
| New Inquiry Received (106) | Review Inquiry |
| Initial Response Sent (107) | Waiting on Client |
| Follow Up Sent (108) | Waiting on Client |
| Feasibility Confirmed (109) | Send Quote |
| Quote Sent (110) | Waiting for Deposit |
| Deposit Received (151) | Secure Instructor / Send Sign-Up Link |
| Payment Complete (152) | Create Sign-Up Link |
| Awaiting Guest Sign-Ups (153) | Check on Fill |
| Sign-Ups Complete (154) | Send Final Confirmation |
| Final Confirmation Sent (155) | Day-Of Prep |
| Ready for Event (156) | Final Emails |
| Event Complete (15) | Done |

### Where Are We Now → Auto-Check Workflow Boxes
When status advances, check all preceding workflow steps:

| When Status Becomes | Auto-Check These Steps |
|---|---|
| Initial Response Sent (107) | inquiryReviewed, initialResponseSent |
| Follow Up Sent (108) | + followUpSent |
| Feasibility Confirmed (109) | + feasibilityConfirmed |
| Quote Sent (110) | + quoteSent |
| Deposit Received (151) | + depositRequested, depositReceived |
| Payment Complete (152) | + finalPaymentReceived |
| Awaiting Guest Sign-Ups (153) | + eventDetailsConfirmed, signUpLinkCreated, signUpLinkSent |
| Sign-Ups Complete (154) | + signUpsMonitored |
| Final Confirmation Sent (155) | + finalConfirmationSent |
| Ready for Event (156) | + dayOfPrepComplete |
| Event Complete (15) | + eventDelivered, postEventFollowUp |

## Priority 2: Ball In Court Auto-Update

### Where Are We Now → Ball In Court
| Status | Ball In Court |
|---|---|
| New Inquiry Received | TSP Team |
| Initial Response Sent | Client |
| Follow Up Sent | Client |
| Feasibility Confirmed | TSP Team |
| Quote Sent | Client |
| Deposit Received | TSP Team |
| Payment Complete | TSP Team |
| Awaiting Guest Sign-Ups | Client |
| Sign-Ups Complete | TSP Team |
| Final Confirmation Sent | Client |
| Ready for Event | TSP Team |

## Priority 3: Group Movement

### Auto-Move Items Between Board Groups
When a buyout reaches a terminal status (Event Complete, Cancelled), move the item from the "Active" group to an "Archive" group. This keeps the active board clean.

## Priority 4: Trigger Column Reset

### Clear Send Email Trigger After Send
After Make.com processes an email trigger, the `color_mkzjmcth` column retains the label. An automation should clear it after a short delay (e.g., 5 minutes) to prevent accidental re-fires.

Implementation options:
- Monday automation: "When status changes to X, wait 5 minutes, then clear status"
- Make.com: Add a 5th module that clears the trigger column after storing the message ID
- App-side: Dashboard clears the column immediately after confirming the mutation
