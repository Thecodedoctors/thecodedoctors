import { ImageResponse } from "next/og";
import { OgTemplate, ogContentType, ogSize } from "@/components/og-template";

export const alt = "About The Code Doctors";
export const size = ogSize;
export const contentType = ogContentType;

export default async function AboutOgImage() {
  return new ImageResponse(
    (
      <OgTemplate
        eyebrow="About"
        title="A practice for the modern web."
        description="Five doctors who treat websites like patients — calm, careful, and on call."
      />
    ),
    { ...ogSize }
  );
}
