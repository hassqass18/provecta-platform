/**
 * Hard-gate regression test (P0-BRAIN/AUTONOMY).
 * REGULATED / IRREVERSIBLE actions must NEVER auto-execute, in ANY autonomy
 * state — this is non-flag-overridable. REVERSIBLE may auto-execute only when
 * fully AUTONOMOUS. Pure function test: no DB connection required.
 */
import { canAutoExecute, AUTONOMY_ORDER } from "../src/lib/autonomy";

let failures = 0;
const fail = (msg: string) => {
  console.error(`FAIL: ${msg}`);
  failures++;
};

for (const state of AUTONOMY_ORDER) {
  for (const risk of ["IRREVERSIBLE", "REGULATED"]) {
    if (canAutoExecute(state, risk)) fail(`${risk} in state ${state} auto-executed`);
  }
}

if (canAutoExecute("SUGGEST", "REVERSIBLE")) fail("REVERSIBLE/SUGGEST auto-executed");
if (canAutoExecute("AUTO_WITH_REVIEW", "REVERSIBLE")) fail("REVERSIBLE/AUTO_WITH_REVIEW auto-executed");
if (!canAutoExecute("AUTONOMOUS", "REVERSIBLE")) fail("REVERSIBLE/AUTONOMOUS should auto-execute");

// AUTONOMY_FREEZE kill-switch: when set, even REVERSIBLE/AUTONOMOUS must not auto-execute.
process.env.AUTONOMY_FREEZE = "1";
if (canAutoExecute("AUTONOMOUS", "REVERSIBLE")) fail("AUTONOMY_FREEZE failed to block REVERSIBLE/AUTONOMOUS");
delete process.env.AUTONOMY_FREEZE;
if (!canAutoExecute("AUTONOMOUS", "REVERSIBLE")) fail("unfreeze did not restore REVERSIBLE/AUTONOMOUS");

if (failures) {
  console.error(`test-gate: ${failures} failure(s)`);
  process.exit(1);
}
console.log("test-gate: PASS — REGULATED/IRREVERSIBLE never auto-execute; REVERSIBLE only when AUTONOMOUS");
