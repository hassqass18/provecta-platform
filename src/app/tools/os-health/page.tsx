import type { Metadata } from "next";
import { CalcShell } from "@/components/calc-shell";
import { OsHealthCalc } from "./calc";

export const metadata: Metadata = {
  title: "Operating-System Health Scorecard",
  description: "Rate your business against a 5-level maturity model and get a sequenced 90-day roadmap. Free.",
};

export default function Page() {
  return (
    <CalcShell
      eyebrow="Assessment · Free"
      title="Operating-System Health Scorecard"
      intro="Rate each function against a 5-level maturity model. Get your operating-system score and where to start — the same diagnostic we run at the start of every engagement."
    >
      <OsHealthCalc />
    </CalcShell>
  );
}
