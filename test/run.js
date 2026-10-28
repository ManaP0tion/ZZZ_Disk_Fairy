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
{ // 디스크 카드 안내: 주옵이 틀린 6번은 우선 교체, 주옵과 같은 스탯은 챙길 부옵에서 뺀다
  const r = E.evaluate(fx.data.avatar_list[0], B, "good");
  const d = (n) => r.discs.find((x) => x.slot === n).tip;
  assert.equal(d(6).level, "high");
  assert.deepEqual(d(6).want, ["이상 마스터리", "공격력%"]);
  assert.deepEqual(d(4).want, ["공격력%"]);
  assert.equal(d(4).level, "keep");
  assert.deepEqual(d(1).lack, ["공격력%"]);
  assert.deepEqual(d(1).mains, []); // 1~3번은 주옵 고정이라 추천 주옵이 없다
  assert.ok(d(6).mains.length && d(6).mains.every((m) => !m.on)); // 주옵이 틀리면 추천 주옵 중 장착한 것이 없다
  assert.ok(d(4).mains.some((m) => m.on));
  assert.ok(r.advice.some((a) => a.text.startsWith("디스크 교체 / 6번 주옵 부적합 · 1, 3번 점수 낮음")));
  console.log("디스크 안내 테스트 통과");
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
{ // 스킬 레벨: 실제 응답(2026-10-19)의 skills/rank. 순서는 skill_type 0,1,2,3,5,6
  const sk = (lv) => [0, 1, 2, 3, 5, 6].map((t, i) => ({ skill_type: t, level: lv[i] }));
  const ev = (name, rank, lv, sel = "good") => E.evaluate({ name_mi18n: name, full_name_mi18n: name, rank, skills: sk(lv), equip: [], properties: [] }, B, sel).skills;
  // 레미엘 0돌, 목표 12,1,12,12,12: 7·9단계는 통과, 회피는 목표 1이라 제외
  const rem = ev("레미엘", 0, [11, 11, 9, 10, 7, 10]);
  assert.deepEqual(rem.rows.map((r) => r.cur), [11, 9, 10, 11, 10]);
  assert.ok(rem.rows[1].skip);
  assert.deepEqual(rem.next.map((x) => `${x.label} ${x.from}→${x.to}`), ["일반 공격 11→12", "지원 10→12", "특수 스킬 11→12", "궁극기 10→12"]);
  // 리나 3돌·레벨 1: API 레벨 3은 보너스 +2가 포함된 값. 판정은 1로 하고(목표 1,1,1,9,9 → 먼저 7까지), 표시는 게임처럼 +2
  const rina = ev("리나", 3, [3, 3, 3, 3, 1, 3]);
  assert.equal(rina.bonus, 2);
  assert.deepEqual(rina.next, [{ label: "특수 스킬", from: 3, to: 9 }, { label: "궁극기", from: 3, to: 9 }]);
  assert.deepEqual(rina.rows.map((r) => `${r.cur}/${r.wantText}`), ["3/1", "3/1", "3/1", "3/11", "3/11"]);
  // 「시드」 0돌, 목표 12,7,7,11,12 → 모두 달성
  const seed = ev("「시드」", 0, [12, 12, 9, 12, 7, 9]);
  assert.ok(seed.done && !seed.next);
  // 악귀 탭에는 스킬 칸이 없어서 이잘키 기준을 빌린다
  assert.equal(ev("레미엘", 0, [11, 11, 9, 10, 7, 10], "max").from, "이잘키");
  // 7단계가 막히면 9단계는 안내하지 않는다
  assert.deepEqual(ev("레미엘", 0, [6, 11, 9, 10, 7, 10]).next, [{ label: "일반 공격", from: 6, to: 7 }]);
  console.log("스킬 레벨 테스트 통과");
}
{ // 최대 점수가 낮은 슬롯: 자오 체력% 주옵 + 깡체력(0.5)만 유효 → 최대 3점
  const w = { "HP%": 1, HP: 0.5 };
  assert.equal(E.discCap(w, "HP%"), 3);
  assert.equal(E.discGrade(2, 3).key, "ok");   // 448 (+3)
  assert.equal(E.discGrade(1.5, 3).key, "ok"); // 336 (+2)
  assert.equal(E.discGrade(1, 3).key, "meh");  // 224 (+1)
  assert.equal(E.discGrade(0, 3).key, "bad");
  // 최대 점수가 충분한 슬롯은 기존 절대 기준 그대로
  const dps = { CR: 1, CD: 1, "ATK%": 1, PEN: 1 };
  assert.equal(E.discCap(dps, "ATK%"), 8);
  assert.equal(E.discGrade(2, 9).key, "bad");
  assert.equal(E.discGrade(0, 0).key, "bad"); // 기준 없음
  console.log("슬롯 최대 점수 테스트 통과");
}
