import { ImageResponse } from "next/og";
import { OgTemplate, ogContentType, ogSize } from "@/components/og-template";

export const alt = "Plans — General Care or Premium Care";
export const size = ogSize;
export const contentType = ogContentType;

export default async function PlansOgImage() {
  return new ImageResponse(
    (
      <OgTemplate
        eyebrow="Plans"
        title="Pick a plan. We handle the rest."
        description="General Care for steady upkeep, Premium Care when uptime matters. One flat monthly fee, no surprise hours."
      />
    ),
    { ...ogSize }
  );
}
