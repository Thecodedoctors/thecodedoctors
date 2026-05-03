import { ImageResponse } from "next/og";
import { OgTemplate, ogContentType, ogSize } from "@/components/og-template";

export const alt = "Services — what The Code Doctors do";
export const size = ogSize;
export const contentType = ogContentType;

export default async function ServicesOgImage() {
  return new ImageResponse(
    (
      <OgTemplate
        eyebrow="Services"
        title="Treatments for the whole site."
        description="Security hardening, performance tuning, ongoing maintenance, full rebuilds — calm, competent care end-to-end."
      />
    ),
    { ...ogSize }
  );
}
