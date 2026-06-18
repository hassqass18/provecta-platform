import type { Metadata } from "next";
import { CalcShell } from "@/components/calc-shell";
import { OperationsDragCalc } from "./calc";

export const metadata: Metadata = {
  title: "Operations Drag Estimator",
  description: "Estimate the annual cost of manual, repeatable work — and what reclaiming it is worth. Free and instant.",
};

export default function Page() {
  return (
    <CalcShell
      eyebrow="Calculator · Free"
      title="Operations Drag Estimator"
      intro="Put a number on the manual work draining your team. Enter the hours and your loaded cost to see the annual cost — and what automation could reclaim."
    >
      <OperationsDragCalc />
    </CalcShell>
  );
}
