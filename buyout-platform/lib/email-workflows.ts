import { StageKey } from "@/lib/types";

export type EmailVariableDefinition = {
  key: string;
  label: string;
};

export type EmailEffectDefinition = {
  stageChange?: StageKey;
  workflowKeys?: string[];
  nextAction?: string;
  trackingHealth?: "On track" | "At risk" | "Major issue" | "Complete";
  eventType?: "stage_change" | "workflow_only" | "reminder" | "terminal" | "informational";
  sendPolicy?: "single" | "repeatable";
};

export type EmailTemplateSeed = {
  key: string;
  name: string;
  triggerLabel: string;
  category: string;
  legacyColumnId: string;
  subjectTemplate: string;
  fallbackBodyTemplate: string;
  requiredVariables: EmailVariableDefinition[];
  allowedStages: StageKey[];
  effectConfig: EmailEffectDefinition;
};

const ALL_ACTIVE_STAGES: StageKey[] = [
  "Inquiry",
  "Respond",
  "Discuss",
  "Feasible",
  "Quote",
  "Deposit",
  "Paid",
  "Sign-Ups",
  "Confirmed",
  "Final",
  "Ready",
  "On Hold"
];

export const EMAIL_TEMPLATE_SEEDS: EmailTemplateSeed[] = [
  {
    key: "t0",
    name: "Custom / One-Off Message",
    triggerLabel: "Custom Message",
    category: "General",
    legacyColumnId: "",
    subjectTemplate: "The Studio Pilates Buyout: {{Client Name}} | Follow Up",
    fallbackBodyTemplate:
      "Hi {{Client First Name}},\n\n\n\nWarmly,\nAutumn\nThe Studio Pilates Team",
    requiredVariables: [{ key: "clientFirstName", label: "Client First Name" }],
    allowedStages: ALL_ACTIVE_STAGES,
    effectConfig: {
      eventType: "informational",
      sendPolicy: "repeatable"
    }
  },
  {
    key: "t1",
    name: "First Inquiry Email",
    triggerLabel: "First Inquiry Email Sent",
    category: "Intake",
    legacyColumnId: "long_text_mkzjxtpp",
    subjectTemplate: "The Studio Pilates Buyout: {{Client Name}} | Initial Inquiry",
    fallbackBodyTemplate:
      "Hi {{Client First Name}},\n\nThank you for reaching out about a Studio Buyout. We received your request for {{Preferred Date}} at {{Preferred Location}} and our team is reviewing availability now.\n\nWarmly,\nThe Studio Pilates Team",
    requiredVariables: [
      { key: "clientFirstName", label: "Client First Name" },
      { key: "preferredDate", label: "Preferred Date" },
      { key: "preferredLocation", label: "Preferred Location" }
    ],
    allowedStages: ["Inquiry", "Respond", "Discuss"],
    effectConfig: {
      eventType: "stage_change",
      stageChange: "Respond",
      workflowKeys: ["initial-inquiry-response-sent"],
      nextAction: "Wait for client response",
      sendPolicy: "single"
    }
  },
  {
    key: "t2",
    name: "Food & Beverage Policy",
    triggerLabel: "Clarify Food Beverage Policy",
    category: "Intake",
    legacyColumnId: "long_text_mkzjd66k",
    subjectTemplate: "The Studio Pilates Buyout: {{Client Name}} | Food and Beverage Policy",
    fallbackBodyTemplate:
      "Hi {{Client First Name}},\n\nThanks for asking. Here is our current food and beverage policy for Studio Buyouts.\n\nWarmly,\nThe Studio Pilates Team",
    requiredVariables: [{ key: "clientFirstName", label: "Client First Name" }],
    allowedStages: ALL_ACTIVE_STAGES,
    effectConfig: {
      eventType: "informational",
      sendPolicy: "repeatable"
    }
  },
  {
    key: "t3",
    name: "Deposit & Date",
    triggerLabel: "Deposit & Date Email",
    category: "Planning",
    legacyColumnId: "long_text_mkzjwxsh",
    subjectTemplate: "The Studio Pilates Buyout: {{Client Name}} | {{Event Date}}",
    fallbackBodyTemplate:
      "Hi {{Client First Name}},\n\nYour event is available on {{Event Date}} at {{Location}}. Total is {{Total Price}} and the deposit is {{Deposit Amount}}.\n\nComplete payment here: {{Deposit Link}}\n\nWarmly,\nThe Studio Pilates Team",
    requiredVariables: [
      { key: "clientFirstName", label: "Client First Name" },
      { key: "eventDate", label: "Event Date" },
      { key: "location", label: "Location" },
      { key: "totalPrice", label: "Total Price" },
      { key: "depositAmount", label: "Deposit Amount" },
      { key: "depositLink", label: "Deposit Link" }
    ],
    allowedStages: ["Discuss", "Feasible", "Quote", "Deposit"],
    effectConfig: {
      eventType: "stage_change",
      stageChange: "Deposit",
      workflowKeys: ["deposit-link-sent-and-terms-shared"],
      nextAction: "Wait for deposit payment",
      sendPolicy: "single"
    }
  },
  {
    key: "t4",
    name: "Deposit Reminder",
    triggerLabel: "Deposit Reminder Email",
    category: "Payment",
    legacyColumnId: "long_text_mkzjpmj",
    subjectTemplate: "The Studio Pilates Buyout: {{Client Name}} | Deposit Reminder",
    fallbackBodyTemplate:
      "Hi {{Client First Name}},\n\nThis is a reminder that your deposit of {{Deposit Amount}} is still outstanding.\n\nPay here: {{Deposit Link}}\n\nWarmly,\nThe Studio Pilates Team",
    requiredVariables: [
      { key: "clientFirstName", label: "Client First Name" },
      { key: "depositAmount", label: "Deposit Amount" },
      { key: "depositLink", label: "Deposit Link" }
    ],
    allowedStages: ["Quote", "Deposit"],
    effectConfig: {
      eventType: "reminder",
      nextAction: "Follow up on deposit payment",
      sendPolicy: "repeatable"
    }
  },
  {
    key: "t5",
    name: "Event Details & Sign Up",
    triggerLabel: "Event Details & Sign Up",
    category: "Logistics",
    legacyColumnId: "long_text_mkzjfbe9",
    subjectTemplate: "The Studio Pilates Buyout: {{Client Name}} | Event Details",
    fallbackBodyTemplate:
      "Hi {{Client First Name}},\n\nYour event is booked for {{Event Date}} from {{Start Time}} to {{End Time}} at {{Location}} with {{Instructor}}.\n\nPlease share this signup link with your guests: {{Signup Link}}\n\nWarmly,\nThe Studio Pilates Team",
    requiredVariables: [
      { key: "clientFirstName", label: "Client First Name" },
      { key: "eventDate", label: "Event Date" },
      { key: "startTime", label: "Start Time" },
      { key: "endTime", label: "End Time" },
      { key: "location", label: "Location" },
      { key: "instructor", label: "Instructor" },
      { key: "signupLink", label: "Signup Link" }
    ],
    allowedStages: ["Paid", "Sign-Ups"],
    effectConfig: {
      eventType: "stage_change",
      stageChange: "Sign-Ups",
      workflowKeys: ["instructor-finalized", "momence-link-sign-up-sent"],
      nextAction: "Monitor registrations and waivers",
      sendPolicy: "single"
    }
  },
  {
    key: "t6",
    name: "Second Half Payment",
    triggerLabel: "Second Half Payment Email",
    category: "Payment",
    legacyColumnId: "long_text_mkzj7sj5",
    subjectTemplate: "The Studio Pilates Buyout: {{Client Name}} | Remaining Balance",
    fallbackBodyTemplate:
      "Hi {{Client First Name}},\n\nYour remaining balance is {{Remaining Balance}}.\n\nSubmit it here: {{Remaining Balance Link}}\n\nWarmly,\nThe Studio Pilates Team",
    requiredVariables: [
      { key: "clientFirstName", label: "Client First Name" },
      { key: "remainingBalance", label: "Remaining Balance" },
      { key: "remainingBalanceLink", label: "Remaining Balance Link" }
    ],
    allowedStages: ["Deposit", "Paid", "Sign-Ups", "Confirmed"],
    effectConfig: {
      eventType: "reminder",
      nextAction: "Wait for remaining balance",
      sendPolicy: "repeatable"
    }
  },
  {
    key: "t7",
    name: "Balance Reminder",
    triggerLabel: "Remaining Balance Reminder",
    category: "Payment",
    legacyColumnId: "long_text_mkzjemea",
    subjectTemplate: "The Studio Pilates Buyout: {{Client Name}} | Balance Reminder",
    fallbackBodyTemplate:
      "Hi {{Client First Name}},\n\nFriendly reminder that your remaining balance is {{Remaining Balance}}.\n\nPay here: {{Remaining Balance Link}}\n\nWarmly,\nThe Studio Pilates Team",
    requiredVariables: [
      { key: "clientFirstName", label: "Client First Name" },
      { key: "remainingBalance", label: "Remaining Balance" },
      { key: "remainingBalanceLink", label: "Remaining Balance Link" }
    ],
    allowedStages: ["Deposit", "Paid", "Sign-Ups", "Confirmed", "Final"],
    effectConfig: {
      eventType: "reminder",
      nextAction: "Escalate remaining balance follow-up",
      sendPolicy: "repeatable"
    }
  },
  {
    key: "t8",
    name: "Cancelled (No Refund)",
    triggerLabel: "Event Cancelled (No Refund)",
    category: "Terminal",
    legacyColumnId: "long_text_mkzj2qt0",
    subjectTemplate: "The Studio Pilates Buyout: {{Client Name}} | Cancellation",
    fallbackBodyTemplate:
      "Hi {{Client First Name}},\n\nThis confirms that your event has been cancelled per the current no-refund policy.\n\nWarmly,\nThe Studio Pilates Team",
    requiredVariables: [{ key: "clientFirstName", label: "Client First Name" }],
    allowedStages: ALL_ACTIVE_STAGES,
    effectConfig: {
      eventType: "terminal",
      stageChange: "Cancelled",
      nextAction: "Closed",
      sendPolicy: "single"
    }
  },
  {
    key: "t9",
    name: "Cancelled (Refund)",
    triggerLabel: "Event Cancelled (Refund)",
    category: "Terminal",
    legacyColumnId: "long_text_mkzj6xcc",
    subjectTemplate: "The Studio Pilates Buyout: {{Client Name}} | Cancellation and Refund",
    fallbackBodyTemplate:
      "Hi {{Client First Name}},\n\nThis confirms cancellation of your event and refund of {{Deposit Amount}}.\n\nWarmly,\nThe Studio Pilates Team",
    requiredVariables: [
      { key: "clientFirstName", label: "Client First Name" },
      { key: "depositAmount", label: "Deposit Amount" }
    ],
    allowedStages: ALL_ACTIVE_STAGES,
    effectConfig: {
      eventType: "terminal",
      stageChange: "Cancelled",
      nextAction: "Closed",
      sendPolicy: "single"
    }
  },
  {
    key: "t10",
    name: "Missing Signups",
    triggerLabel: "Missing Signups Email",
    category: "Logistics",
    legacyColumnId: "long_text_mkzj45br",
    subjectTemplate: "The Studio Pilates Buyout: {{Client Name}} | Missing Signups",
    fallbackBodyTemplate:
      "Hi {{Client First Name}},\n\nWe still need your guests to sign up before {{Event Date}}.\n\nShare this link: {{Signup Link}}\n\nWarmly,\nThe Studio Pilates Team",
    requiredVariables: [
      { key: "clientFirstName", label: "Client First Name" },
      { key: "eventDate", label: "Event Date" },
      { key: "signupLink", label: "Signup Link" }
    ],
    allowedStages: ["Confirmed", "Final", "Ready"],
    effectConfig: {
      eventType: "reminder",
      nextAction: "Chase remaining guest signups",
      trackingHealth: "At risk",
      sendPolicy: "repeatable"
    }
  },
  {
    key: "t11",
    name: "Final Confirmation",
    triggerLabel: "Final Confirmation Email",
    category: "Pre-Event",
    legacyColumnId: "long_text_mkzj6cy5",
    subjectTemplate: "The Studio Pilates Buyout: {{Client Name}} | Final Confirmation",
    fallbackBodyTemplate:
      "Hi {{Client First Name}},\n\nEverything is confirmed for {{Event Date}} from {{Start Time}} to {{End Time}} at {{Location}} with {{Instructor}}.\n\nWarmly,\nThe Studio Pilates Team",
    requiredVariables: [
      { key: "clientFirstName", label: "Client First Name" },
      { key: "eventDate", label: "Event Date" },
      { key: "startTime", label: "Start Time" },
      { key: "endTime", label: "End Time" },
      { key: "location", label: "Location" },
      { key: "instructor", label: "Instructor" }
    ],
    allowedStages: ["Sign-Ups", "Confirmed", "Final", "Ready"],
    effectConfig: {
      eventType: "stage_change",
      stageChange: "Final",
      workflowKeys: ["final-confirmation-emails-sent"],
      nextAction: "Prepare final event logistics",
      sendPolicy: "single"
    }
  },
  {
    key: "t12",
    name: "Event Complete",
    triggerLabel: "Event Complete",
    category: "Execution",
    legacyColumnId: "long_text_mkzjab4d",
    subjectTemplate: "The Studio Pilates Buyout: {{Client Name}} | Thank You",
    fallbackBodyTemplate:
      "Hi {{Client First Name}},\n\nThank you for choosing The Studio Pilates. We loved hosting your event.\n\nWarmly,\nThe Studio Pilates Team",
    requiredVariables: [{ key: "clientFirstName", label: "Client First Name" }],
    allowedStages: ["Final", "Ready", "Complete"],
    effectConfig: {
      eventType: "stage_change",
      stageChange: "Complete",
      workflowKeys: ["event-completed"],
      nextAction: "Closed",
      sendPolicy: "single"
    }
  },
  {
    key: "t13",
    name: "Ongoing Discussion",
    triggerLabel: "Ongoing Discussion Email",
    category: "General",
    legacyColumnId: "long_text_mkzj14vc",
    subjectTemplate: "The Studio Pilates Buyout: {{Client Name}} | Follow Up",
    fallbackBodyTemplate:
      "Hi {{Client First Name}},\n\nFollowing up on your buyout inquiry.\n\nWarmly,\nThe Studio Pilates Team",
    requiredVariables: [{ key: "clientFirstName", label: "Client First Name" }],
    allowedStages: ALL_ACTIVE_STAGES,
    effectConfig: {
      eventType: "informational",
      sendPolicy: "repeatable"
    }
  },
  {
    key: "t14",
    name: "48-Hour Missing Signups",
    triggerLabel: "48-Hour Missing Signups",
    category: "Logistics",
    legacyColumnId: "long_text_mkzjw24h",
    subjectTemplate: "The Studio Pilates Buyout: {{Client Name}} | 48-Hour Signup Reminder",
    fallbackBodyTemplate:
      "Hi {{Client First Name}},\n\nYour event is almost here and we still need guest signups completed.\n\nShare this link now: {{Signup Link}}\n\nWarmly,\nThe Studio Pilates Team",
    requiredVariables: [
      { key: "clientFirstName", label: "Client First Name" },
      { key: "eventDate", label: "Event Date" },
      { key: "signupLink", label: "Signup Link" }
    ],
    allowedStages: ["Sign-Ups", "Confirmed", "Final", "Ready"],
    effectConfig: {
      eventType: "reminder",
      nextAction: "Escalate final signup reminders",
      trackingHealth: "At risk",
      sendPolicy: "repeatable"
    }
  }
];
