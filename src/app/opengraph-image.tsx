import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const photo = await readFile(join(process.cwd(), "public/images/rumina.jpg"));
  const photoSrc = `data:image/jpeg;base64,${photo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background:
            "radial-gradient(130% 120% at 20% 15%, #0d3a2b 0%, #082a1f 45%, #051710 75%, #020b07 100%)",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 0 0 64px",
          }}
        >
          <svg width="220" height="30" viewBox="0 0 260 34" style={{ marginBottom: 16 }}>
            <path d="M4 28 Q130 -10 256 28" fill="none" stroke="#D8BD85" strokeWidth={4} strokeLinecap="round" />
          </svg>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 700, fontFamily: "Georgia, serif" }}>
            <span style={{ color: "#ffffff" }}>F.I.R.E&nbsp;</span>
            <span style={{ color: "#00B389" }}>LOANS</span>
          </div>
          <div
            style={{
              marginTop: 18,
              width: 500,
              fontSize: 24,
              color: "#D8BD85",
              fontFamily: "Georgia, serif",
              letterSpacing: 1,
            }}
          >
            Helping Australians Achieve Financial Independence & Retire Early
          </div>
          <div
            style={{
              marginTop: 30,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div style={{ width: 34, height: 2, background: "rgba(216,189,133,0.5)" }} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", fontFamily: "Arial, sans-serif" }}>
                Rumina
              </span>
              <span style={{ fontSize: 17, color: "rgba(255,255,255,0.6)", fontFamily: "Arial, sans-serif" }}>
                Mortgage Broker, Fire Loans
              </span>
            </div>
          </div>
        </div>

        <div style={{ position: "relative", width: 460, height: "100%", display: "flex" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(90deg, #051710 0%, rgba(5,23,16,0) 18%)",
              zIndex: 1,
            }}
          />
          <img src={photoSrc} width={460} height={630} style={{ objectFit: "cover" }} alt="" />
        </div>
      </div>
    ),
    { ...size }
  );
}
