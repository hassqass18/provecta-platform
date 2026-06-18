import type { Metadata } from "next";
import { CalcShell } from "@/components/calc-shell";
import { RevenueLeakageCalc } from "./calc";

export const metadata: Metadata = {
  title: "Revenue-Leakage Calculator",
  description: "See the dollars dropping out of your funnel between lead and closed deal — free, instant, no account required.",
};

export default function Page() {
  return (
    <CalcShell
      eyebrow="Calculator · Free"
      title="Revenue-Leakage Calculator"
      intro="Enter your funnel numbers and see the annual revenue leaking out between a qualified lead and a closed deal. Adjust the achievable close rate to size the prize."
    >
      <RevenueLeakageCalc />
    </CalcShell>
  );
}
