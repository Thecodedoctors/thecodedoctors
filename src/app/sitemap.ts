import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const routes = [
    "",
    "/services",
    "/plans",
    "/stories",
    "/checkup",
    "/about",
    "/book",
    "/privacy",
    "/terms",
    "/refund-policy",
    "/acceptable-use",
    "/sla",
    "/security",
    "/cookies",
  ];
  return routes.map((path) => ({
    url: `${site.url}${path}`,
    lastModified,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
