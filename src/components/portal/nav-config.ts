import {
  Home,
  Inbox,
  ListChecks,
  HeartPulse,
  CreditCard,
  BookOpen,
  Users,
  ShieldCheck,
  BarChart3,
  Activity,
  Bell,
  Sparkles,
  Settings,
  HelpCircle,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** When set, the item is rendered as disabled with a "soon" pill. */
  soon?: boolean;
};

export type NavSection = {
  heading?: string;
  items: NavItem[];
};

export const CLIENT_NAV: NavSection[] = [
  {
    heading: "Workspace",
    items: [
      { href: "/", label: "Hub", icon: Home },
      { href: "/requests", label: "Requests", icon: ListChecks },
      { href: "/health", label: "Site health", icon: HeartPulse },
      { href: "/billing", label: "Billing", icon: CreditCard, soon: true },
      { href: "/knowledge", label: "Knowledge", icon: BookOpen },
    ],
  },
  {
    heading: "Account",
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/referrals", label: "Refer a friend", icon: Sparkles },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/help", label: "Help", icon: HelpCircle },
    ],
  },
];

export const ADMIN_NAV: NavSection[] = [
  {
    heading: "Workflow",
    items: [
      { href: "/", label: "Inbox", icon: Inbox },
      { href: "/requests", label: "All requests", icon: ListChecks },
      { href: "/clients", label: "Patients", icon: Users },
      { href: "/fleet", label: "Fleet", icon: Activity },
    ],
  },
  {
    heading: "Operations",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/audit", label: "Audit log", icon: ShieldCheck },
      { href: "/runbooks", label: "Runbooks", icon: BookOpen },
    ],
  },
  {
    heading: "Practice",
    items: [
      { href: "/team", label: "Team", icon: Users },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const MOBILE_BOTTOM_NAV_CLIENT: NavItem[] = [
  { href: "/", label: "Hub", icon: Home },
  { href: "/requests", label: "Requests", icon: ListChecks },
  { href: "/help", label: "Help", icon: HelpCircle },
];

export const MOBILE_BOTTOM_NAV_ADMIN: NavItem[] = [
  { href: "/", label: "Inbox", icon: Inbox },
  { href: "/requests", label: "Requests", icon: ListChecks },
];
