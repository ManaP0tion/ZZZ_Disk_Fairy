// 시트의 모든 에이전트 × 3개 기준을 가상 응답으로 평가해서 "기준 없음"이 나오는 경우와 이유를 출력
const fs = require("fs"), vm = require("vm");
const ctx = { window: {} }; vm.createContext(ctx);
for (const f of ["data/benchmark.js", "data/suit-icons.js", "evaluator.js"]) vm.runInContext(fs.readFileSync(__dirname + "/../extension/" + f, "utf8"), ctx);
const E = ctx.window.ZZZEval, B = ctx.window.ZZZ_BENCHMARK;
// 실제 API 이름(내 계정 35명) — 그 외는 시트 이름 그대로 온다고 가정
const API = { "0호 엔비": "0호·엔비", "시드": "「시드」", "11호": "「11호」", "S. 빌리": "스타라이트 빌리" };
const props = ["HP=10000", "공격력=3000", "방어력=900", "충격력=120", "치명타 확률=50%", "치명타 피해=120%", "이상 장악력=150",
  "이상 마스터리=300", "관통률=10%", "에너지 자동 회복=2.0", "관통 수치=0", "관입력=2000"].map((x) => { const [n, v] = x.split("="); return { property_name: n, final: v }; });
const names = [...new Set(Object.values(B.tiers).flatMap((t) => t.agents.map((a) => a.name)))];
const rows = [];
for (const n of names) {
  const av = { name_mi18n: API[n] || n, full_name_mi18n: API[n] || n, properties: props, equip: [], rank: 0, weapon: { name: "x" } };
  const line = [n];
  for (const k of ["basic", "good", "max"]) {
    const r = E.evaluate(av, B, k).tiers[k].result;
    line.push(r.pass === null ? `✗ ${r.short}` : "✓");
    if (r.pass === null && r.short !== "시트에 없음") rows.push(`${n} / ${B.tiers[k].label}: ${r.reason}`);
  }
  if (!E.evaluate(av, B, "good").matched) rows.push(`${n}: 어떤 탭에도 매칭 안 됨`);
}
console.log("시트에 행은 있는데 기준 없음/매칭 실패:");
rows.forEach((r) => console.log("  " + r));
const notIn = names.filter((n) => !B.tiers.good.agents.some((a) => a.name === n));
console.log("이잘키 탭에 없는 이름:", notIn);
