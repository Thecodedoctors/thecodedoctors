import { ImageResponse } from "next/og";
import { OgTemplate, ogContentType, ogSize } from "@/components/og-template";
import { site } from "@/lib/site";

/**
 * Default Open Graph card. Used for the homepage and inherited by any
 * route that doesn't define its own `opengraph-image`. Re-rendered at
 * request time, cached at the edge.
 */

export const alt = `${site.name} — ${site.tagline}`;
export const size = ogSize;
export const contentType = ogContentType;

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <OgTemplate
        eyebrow="Code Doctors"
        title="Your website needs a doctor."
        description={site.description}
      />
    ),
    {
      ...ogSize,
    }
  );
}
