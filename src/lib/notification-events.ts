/**
 * UI catalogue of notification events that users are allowed to toggle on
 * the /settings/notifications page. Keys mirror EMAIL_DEFAULTS in
 * src/server/notifications.ts; default values mirror those defaults too.
 */

export type NotifyEventDef = {
  key: string;
  label: string;
  description: string;
  defaultEmail: boolean;
};

export const CLIENT_EVENTS: NotifyEventDef[] = [
  {
    key: "request.message_received",
    label: "Replies on your requests",
    description: "When a doctor replies to one of your requests.",
    defaultEmail: true,
  },
  {
    key: "request.status_changed",
    label: "Status changes",
    description:
      "When the status of a request changes (Reviewed, In progress, Awaiting your approval).",
    defaultEmail: true,
  },
  {
    key: "request.approved",
    label: "Resolution confirmations",
    description: "When you approve a deliverable and a request is closed.",
    defaultEmail: true,
  },
];

export const STAFF_EVENTS: NotifyEventDef[] = [
  {
    key: "request.message_received",
    label: "New requests + patient replies",
    description:
      "When a patient submits a request or replies on an existing one.",
    defaultEmail: true,
  },
  {
    key: "request.urgent_submitted",
    label: "Urgent requests",
    description: "When a patient submits an urgent request.",
    defaultEmail: true,
  },
  {
    key: "request.approved",
    label: "Patient approvals",
    description: "When a patient approves a deliverable as resolved.",
    defaultEmail: true,
  },
  {
    key: "request.assigned",
    label: "Assignments",
    description: "When a request is assigned to you.",
    defaultEmail: false,
  },
  {
    key: "site.went_down",
    label: "Sites going down",
    description:
      "When an uptime check flips a client site from up to down.",
    defaultEmail: true,
  },
  {
    key: "site.recovered",
    label: "Sites recovering",
    description: "When a site that was down comes back up.",
    defaultEmail: false,
  },
];
