export const site = {
  name: "The Code Doctors",
  shortName: "Code Doctors",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecodedoctors.com",
  tagline: "Your website needs a doctor.",
  description:
    "We diagnose what's broken, prescribe the fix, and keep your site fast, secure, and online — for one flat monthly fee.",
  email: "hello@thecodedoctors.com",
  emails: {
    general: "hello@thecodedoctors.com",
    security: "security@thecodedoctors.com",
    privacy: "privacy@thecodedoctors.com",
    book: "hello@thecodedoctors.com",
  },
  social: {
    x: "",
    linkedin: "",
    github: "",
  },
  nav: [
    { href: "/services", label: "Services" },
    { href: "/plans", label: "Plans" },
    { href: "/stories", label: "Stories" },
    { href: "/checkup", label: "Free Checkup" },
  ],
  footerNav: {
    practice: [
      { href: "/services", label: "Services" },
      { href: "/plans", label: "Plans" },
      { href: "/stories", label: "Patient Stories" },
      { href: "/about", label: "About" },
    ],
    care: [
      { href: "/checkup", label: "Free Checkup" },
      { href: "/book", label: "Contact us" },
      { href: "/login", label: "Sign in" },
      { href: "/status", label: "Service status" },
    ],
    legal: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/refund-policy", label: "Refunds" },
      { href: "/acceptable-use", label: "Acceptable use" },
      { href: "/sla", label: "Service levels" },
      { href: "/security", label: "Security" },
      { href: "/cookies", label: "Cookies" },
    ],
  },
} as const;
