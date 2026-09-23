import { employeeActions } from "../../src/lib/employee-actions.server";
import { directActions } from "../../src/lib/direct-actions.server";
import { extraDirectActions } from "../../src/lib/direct-actions-extra.server";
import { extraEmployeeActions } from "../../src/lib/employee-actions-extra";
import { pipedreamApps } from "../../src/data/pipedream-apps";

const apps = new Map(pipedreamApps.map((a: any) => [a.provider, a]));
let bad = 0;
const byApp = new Map<string, string[]>();
const ALL = [...(employeeActions as any[]), ...(extraEmployeeActions as any[])];
const REG: any = { ...directActions, ...extraDirectActions };
for (const d of ALL) {
  const impl = d.run ? "run" : REG[d.id] ? "direct" : d.action ? "prebuilt(403!)" : "NONE";
  if (impl === "NONE" || impl === "prebuilt(403!)") {
    bad++;
    console.log("MISSING IMPL", d.id, impl);
  }
  if (!apps.has(d.provider)) {
    bad++;
    console.log("BAD PROVIDER", d.id, d.provider);
  }
  // input coverage: does direct fn reference values not declared?
  const src = String(d.run ?? REG[d.id] ?? "");
  const refs = new Set(
    [...src.matchAll(/(?:\bv|\bopt|\blist)\(ctx,\s*"([^"]+)"\)/g)].map((m) => m[1]),
  );
  const declared = new Set((d.inputs ?? []).map((i: any) => i.name));
  for (const r of refs)
    if (!declared.has(r)) {
      bad++;
      console.log("UNDECLARED INPUT", d.id, r);
    }
  for (const dd of declared) if (refs.size && !refs.has(dd)) console.log("unused input", d.id, dd);
  byApp.set(d.provider, [...(byApp.get(d.provider) ?? []), d.id]);
}
console.log("\nactions:", ALL.length, "problems:", bad);
console.log("apps with actions:", byApp.size, "/", pipedreamApps.length);
console.log(
  "APPS WITHOUT ACTIONS:",
  pipedreamApps
    .filter((a: any) => !byApp.has(a.provider))
    .map((a: any) => a.provider)
    .join(", "),
);
for (const [k, v] of [...byApp].sort()) console.log(k.padEnd(20), v.length);
