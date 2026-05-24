"use client";

import { useEffect } from "react";
import { captureException } from "@/lib/sentry";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    captureException(error, { surface: "global", digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0a0e13",
          color: "#f2f4f7",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          margin: 0,
          padding: "32px",
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <p
            style={{
              color: "#3dd9d6",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Critical · Code Doctors
          </p>
          <h1
            style={{
              fontSize: 40,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              marginTop: 12,
              marginBottom: 16,
            }}
          >
            Something didn&apos;t respond.
          </h1>
          <p style={{ color: "#9aa4b2", lineHeight: 1.6, margin: 0 }}>
            Take a deep breath, and try again in a moment. We&apos;ve been
            paged.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 24,
              padding: "10px 18px",
              borderRadius: 999,
              background: "#f2f4f7",
              color: "#0a0e13",
              border: "none",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
