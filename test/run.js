const fs = require("fs"), vm = require("vm");
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + "/../extension/benchmark.js", "utf8"), ctx);
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
const fx = JSON.parse(fs.readFileSync(process.argv[2] || __dirname + "/fixture-vellina.json", "utf8"));
for (const sel of ["basic", "good", "max"]) {
const r = E.evaluate(fx.data.avatar_list[0], B, sel);
console.log("=== 선택:", sel, "| 주옵부옵 기준:", r.statFrom, "| 세트 기준:", r.setFrom);
console.log("matched:", r.matched, "| sets:", JSON.stringify(r.setInfo));
for (const k of ["basic", "good", "max"]) console.log(k, r.tiers[k].label, JSON.stringify(r.tiers[k].result));
for (const d of r.discs) console.log(d.slot, d.set, d.main.label, d.main.value, "mainOk=" + d.mainOk, "eff=" + d.eff, d.grade.text);
console.log("ADVICE:"); r.advice.forEach((a) => console.log(" [" + a.level + "] " + a.text));
}
