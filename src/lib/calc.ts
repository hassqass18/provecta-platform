// Pure helpers shared by the client-side calculators (no server imports).

export const CALC_FIELD =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#2997ff] focus:outline-none";
export const CALC_LABEL = "mb-1.5 block text-sm font-medium text-white";

export function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
