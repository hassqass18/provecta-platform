"use client";

import { useState } from "react";

export default function AcceptForm({ token, company }: { token: string; company: string }) {
  const [state, setState] = useState<"idle" | "working" | "accepted" | "declined" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function act(kind: "accept" | "decline") {
    if (kind === "decline" && !confirm("Decline this proposal?")) return;
    setState("working");
    try {
      const res = await fetch(`/api/p/${token}/${kind}`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; email?: string; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setState("error");
        setMsg(data?.error || "Something went wrong. Please contact Provecta Group.");
        return;
      }
      if (kind === "accept") {
        setState("accepted");
        setMsg(`Welcome aboard. We've emailed your secure workspace login${data.email ? ` to ${data.email}` : ""} and an engagement agreement to sign.`);
      } else {
        setState("declined");
        setMsg("Thanks for letting us know. We've recorded your decision.");
      }
    } catch {
      setState("error");
      setMsg("Network error. Please try again.");
    }
  }

  if (state === "accepted" || state === "declined") {
    return <div style={{ marginTop: 24, padding: 18, borderRadius: 12, background: "#0a2a0a", color: "#7ee787" }}>{msg}</div>;
  }

  return (
    <div style={{ marginTop: 24 }}>
      {state === "error" ? <div style={{ marginBottom: 12, color: "#ff6b6b", fontSize: 14 }}>{msg}</div> : null}
      <p style={{ color: "#a1a1a6", fontSize: 14, marginBottom: 14 }}>
        Accepting starts the engagement for {company}: you&apos;ll receive your workspace login and an agreement to sign.
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={() => act("accept")}
          disabled={state === "working"}
          style={{ background: "#0071e3", color: "#fff", border: "none", borderRadius: 980, padding: "13px 26px", fontWeight: 600, fontSize: 15, cursor: "pointer", opacity: state === "working" ? 0.6 : 1 }}
        >
          {state === "working" ? "Working…" : "Accept proposal"}
        </button>
        <button
          onClick={() => act("decline")}
          disabled={state === "working"}
          style={{ background: "transparent", color: "#a1a1a6", border: "1px solid #3a3a3e", borderRadius: 980, padding: "13px 22px", fontWeight: 600, fontSize: 15, cursor: "pointer" }}
        >
          Decline
        </button>
      </div>
    </div>
  );
}
