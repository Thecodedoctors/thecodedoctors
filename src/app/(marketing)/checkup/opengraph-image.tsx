import { ImageResponse } from "next/og";
import { OgTemplate, ogContentType, ogSize } from "@/components/og-template";

export const alt = "Free Checkup — diagnose your site in 60 seconds";
export const size = ogSize;
export const contentType = ogContentType;

export default async function CheckupOgImage() {
  return new ImageResponse(
    (
      <OgTemplate
        eyebrow="Free Checkup"
        title="Diagnose your site in 60 seconds."
        description="Security headers, performance, DNS posture, trackers, and more — a clear report, no email required."
      />
    ),
    { ...ogSize }
  );
}
