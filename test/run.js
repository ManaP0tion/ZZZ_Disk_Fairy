const fs = require("fs"), vm = require("vm");
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + "/../extension/data/benchmark.js", "utf8"), ctx);
const E = require("../extension/evaluator.js");
const assert = require("assert");
const B = ctx.window.ZZZ_BENCHMARK;
// 정규화/세트 매칭 단위 테스트
assert.equal(E.statKey("공격력", true), "ATK%");
assert.equal(E.statKey("공격력", false), "ATK");
assert.equal(E.statKey("바람 속성 피해 보너스"), "DMG_바람");
assert.equal(E.statKey("바람 피해", true), "DMG_바람");
assert.equal(E.statKey("치확"), "CR");
assert.equal(E.statKey("이상마"), "AP");
assert.ok(E.setMatches("카재", "카오스 재즈"));
assert.ok(E.setMatches("고요별", "고요 속의 별"));
assert.ok(E.setMatches("블루스", "자유의 블루스"));
assert.ok(!E.setMatches("블루스", "울부짖는 살롱"));
const fx = JSON.parse(fs.readFileSync(process.argv[2] || __dirname + "/fixture-avatar-vellina.json", "utf8"));
for (const sel of ["basic", "good", "max"]) {
const r = E.evaluate(fx.data.avatar_list[0], B, sel);
console.log("=== 선택:", sel, "| 주옵부옵 기준:", r.statFrom, "| 세트 기준:", r.setFrom);
console.log("matched:", r.matched, "| sets:", JSON.stringify(r.setInfo));
for (const k of ["basic", "good", "max"]) console.log(k, r.tiers[k].label, JSON.stringify(r.tiers[k].result));
for (const d of r.discs) console.log(d.slot, d.set, d.main.label, d.main.value, "mainOk=" + d.mainOk, "eff=" + d.eff, d.grade.text);
console.log("ADVICE:"); r.advice.forEach((a) => console.log(" [" + a.level + "] " + a.text));
}
// W-엔진 판정
{
  const av = { ...fx.data.avatar_list[0], weapon: { name: "영롱한 금빛 마음", star: 1 } };
  const r = E.evaluate(av, B, "good");
  assert.equal(r.engine.rank, 0);
  assert.ok(!r.advice.some((a) => a.text.includes("W-엔진")));
  const r2 = E.evaluate({ ...av, weapon: { name: "커터칼" } }, B, "max");
  assert.equal(r2.engine.rank, -1);
  assert.equal(r2.engine.from, "이잘키");
  assert.ok(r2.advice.some((a) => a.level === "mid" && a.text.startsWith("W-엔진 비권장 / 현재 커터칼")));
  const r3 = E.evaluate({ ...av, weapon: null }, B, "good");
  assert.ok(r3.advice[0].text.startsWith("W-엔진 없음"));
  console.log("W-엔진 테스트 통과");
}
{ // 456 조건이 하나도 맞지 않으면 "불일치"로 안내하고, 사용자가 다른 조건을 고를 수 있다
  const av = { ...fx.data.avatar_list[0], name_mi18n: "미야비", full_name_mi18n: "호시미 미야비" };
  const r1 = E.evaluate(av, B, "good").tiers.good.result;
  console.log("미야비 conds:", JSON.stringify(r1.conds));
  assert.deepEqual(r1.conds, [{ kind: "조건 불일치", picked: "456 치관공", options: ["456 치관공", "456 공관공"] }]);
  assert.equal(r1.checks.find((c) => c.stat === "ATK").need, 2900);
  const r2 = E.evaluate(av, B, "good", "456 공관공").tiers.good.result;
  assert.equal(r2.conds[0].picked, "456 공관공");
  assert.equal(r2.checks.find((c) => c.stat === "ATK").need, 3400);
  assert.deepEqual(r1.checks.find((c) => c.stat === "ATK").alts, [{ cond: "456 공관공", need: 3400 }]);
  assert.deepEqual(r2.checks.find((c) => c.stat === "ATK").alts, [{ cond: "456 치관공", need: 2900 }]);
  console.log("456 조건 선택 테스트 통과");
}
{ // 치확·치피는 1% 이내 부족까지 통과로 본다
  const entry = { crit: [{ CR: 80, CD: 130, raw: "치확 80 치피 130" }] };
  const r = (cr, cd) => E.checkTier(entry, { CR: cr, CD: cd }, {}, "테스트", "테스트");
  assert.equal(r(79, 129).pass, true);
  assert.equal(r(78.9, 130).pass, false);
  assert.equal(r(78.5, 130).checks[0].gap, 1.5);
  console.log("치명타 허용 오차 테스트 통과");
}
