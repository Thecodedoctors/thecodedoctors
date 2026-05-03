import { ImageResponse } from "next/og";
import { OgTemplate, ogContentType, ogSize } from "@/components/og-template";

export const alt = "Patient Stories — case studies from The Code Doctors";
export const size = ogSize;
export const contentType = ogContentType;

export default async function StoriesOgImage() {
  return new ImageResponse(
    (
      <OgTemplate
        eyebrow="Patient Stories"
        title="Sites we've put back on their feet."
        description="Diagnosis, prescription, treatment, recovery — case studies in the patients' own words."
      />
    ),
    { ...ogSize }
  );
}
