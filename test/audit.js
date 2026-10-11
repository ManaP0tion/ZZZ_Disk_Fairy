// 시트 전체 감사: 파싱 누락/알 수 없는 표기/목표 없음 등을 찾는다.
const fs = require("fs"), vm = require("vm");
const ctx = { window: {} }; vm.createContext(ctx);
for (const f of ["benchmark.js", "suit-icons.js", "evaluator.js"]) vm.runInContext(fs.readFileSync(__dirname + "/../extension/" + f, "utf8"), ctx);
const E = ctx.window.ZZZEval, B = ctx.window.ZZZ_BENCHMARK, ICONS = Object.keys(ctx.window.ZZZ_SUIT_ICONS);
const KNOWN = /^(ATK%?|HP%?|DEF%?|CR|CD|AP|AM|PENR|PEN|ER|IMP|SHEER|DMG_.+)$/;
const issues = [];
const add = (tier, name, kind, detail) => issues.push({ tier, name, kind, detail });
for (const [tk, t] of Object.entries(B.tiers)) {
  for (const a of t.agents) {
    // 목표 스탯 줄 중 파싱 안 된 숫자 줄
    const parsedRaw = new Set([...a.targets.map((x) => x.raw), ...a.crit.map((x) => x.raw)]);
    for (const line of (a.targetsRaw + " ").split(/ (?=[가-힣])/).map((x) => x.trim()).filter(Boolean)) {}
    if (!a.targets.length && !a.crit.length) add(t.label, a.name, a.targetsRaw || a.critRaw ? "목표 파싱 실패" : "목표 칸 비어 있음", a.targetsRaw + " | " + a.critRaw);
    if (a.critRaw && !a.crit.length) add(t.label, a.name, "치명타 파싱 실패", a.critRaw);
    if (a.targetsRaw && !a.targets.length && a.targetsRaw.match(/\d{3,}/)) add(t.label, a.name, "목표 수치 파싱 실패", a.targetsRaw);
    if (a.mains) for (const s of [4, 5, 6]) for (const m of a.mains[s]) { const k = E.statKey(m, true); if (!KNOWN.test(k)) add(t.label, a.name, `${s}번 주옵 표기 미인식`, m); }
    for (const s of a.subs || []) { const k = E.statKey(s.name, s.name.includes("%")); if (!KNOWN.test(k)) add(t.label, a.name, "부옵 표기 미인식", s.raw); }
    for (const x of [...a.set4, ...a.set2]) { const m = ICONS.filter((n) => E.setMatches(x, n)); if (m.length !== 1) add(t.label, a.name, "세트 표기 미인식", x); }
    if (a.mains && !a.set4.length) add(t.label, a.name, "4세트 비어 있음", "");
  }
}
// 조건부 기준 표기 확인
for (const [tk, t] of Object.entries(B.tiers)) for (const a of t.agents) for (const x of [...a.targets, ...a.crit]) if (x.cond && (x.cond.type || "main") === "main" && !KNOWN.test(E.statKey(x.cond.main, true))) add(t.label, a.name, "조건 주옵 표기 미인식", JSON.stringify(x.cond));
const by = {};
for (const i of issues) (by[i.kind] = by[i.kind] || []).push(`${i.tier}/${i.name}: ${i.detail}`);
for (const k in by) { console.log(`\n## ${k} (${by[k].length})`); by[k].forEach((l) => console.log("  " + l)); }
console.log("\n총", issues.length);
