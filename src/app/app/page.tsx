import type { Metadata } from "next";

// Public app-download page (pgco.world/app). No auth. Clients install the
// Android APK directly; iOS is invite-only via TestFlight for now.
export const metadata: Metadata = {
  title: "Get the Provecta Group app",
  description: "Download the Provecta Group client app — your project board, deliverables, documents, agreements and a direct line to us.",
};

const APK_URL =
  process.env.NEXT_PUBLIC_APK_URL ||
  "https://expo.dev/artifacts/eas/YnG2ujY8b8eNqCedbyPeT6tlhK-gCqV8wQvJtt5VRdw.apk";
const IOS_CONTACT = "mailto:support@pgco.world?subject=Provecta%20app%20%E2%80%94%20iOS%20(TestFlight)%20access";

export default function AppDownloadPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#f5f5f7", fontFamily: "-apple-system,Segoe UI,Roboto,Arial,sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 20px" }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 36 }}>Provecta Group</div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 8 }}>
          <div style={{ width: 72, height: 72, borderRadius: 16, background: "#1858a8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 38, color: "#fff", flexShrink: 0 }}>P</div>
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.6, margin: 0 }}>Get the Provecta app</h1>
            <p style={{ color: "#a1a1a6", margin: "4px 0 0", fontSize: 15 }}>Your project board, deliverables, documents, agreements & a direct line to us.</p>
          </div>
        </div>

        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr", maxWidth: 460, marginTop: 36 }}>
          <a href={APK_URL} style={{ background: "#0071e3", color: "#fff", textDecoration: "none", padding: "16px 22px", borderRadius: 14, fontWeight: 600, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Download for Android</span>
            <span style={{ opacity: 0.85, fontWeight: 400, fontSize: 13 }}>.apk · install</span>
          </a>
          <a href={IOS_CONTACT} style={{ background: "transparent", color: "#f5f5f7", textDecoration: "none", padding: "16px 22px", borderRadius: 14, fontWeight: 600, fontSize: 16, border: "1px solid #3a3a3e", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>iOS (iPhone / iPad)</span>
            <span style={{ opacity: 0.7, fontWeight: 400, fontSize: 13 }}>request TestFlight</span>
          </a>
        </div>

        <div style={{ marginTop: 34, borderTop: "1px solid #2a2a2e", paddingTop: 22, color: "#86868b", fontSize: 13.5, lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 10px" }}><strong style={{ color: "#c7c7cc" }}>Android install:</strong> tap “Download for Android,” open the downloaded file, and allow installing from this source if prompted. Sign in with the email and temporary password we sent you — you can change it from your dashboard.</p>
          <p style={{ margin: 0 }}><strong style={{ color: "#c7c7cc" }}>iPhone / iPad:</strong> tap “request TestFlight” and we’ll send you an invite.</p>
        </div>

        <p style={{ marginTop: 40, color: "#6e6e73", fontSize: 12 }}>Provecta Group, a Genius Co company.</p>
      </div>
    </div>
  );
}
