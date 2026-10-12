const fs = require("fs"), vm = require("vm"), assert = require("assert");
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + "/../extension/data/benchmark.js", "utf8"), ctx);
const E = require("../extension/evaluator.js"); const B = ctx.window.ZZZ_BENCHMARK;
const pick = (name, full) => { const r = E.evaluate({ name_mi18n: name, full_name_mi18n: full, equip: [], properties: [] }, B, "good"); return r.ref && r.ref.set4.join("/"); };
const good = (n) => B.tiers.good.agents.find((a) => a.name === n).set4.join("/");
assert.equal(pick("0호·엔비", "0호·엔비"), good("0호 엔비"));
assert.equal(pick("엔비", "엔비 데마라"), good("엔비"));
assert.notEqual(good("0호 엔비"), good("엔비"));
assert.equal(pick("스타라이트 빌리", "스타라이트 빌리"), good("S. 빌리"));
assert.equal(pick("빌리", "빌리 키드"), good("빌리"));
assert.equal(pick("「시드」", "「시드」"), good("시드"));
assert.equal(pick("「11호」", "「11호」"), good("11호"));
// 내 계정 35명 이름이 전부 시트(이잘키)에 매칭되는지
const mine = [["레미엘","레미엘 댄"],["벨리나","벨리나 에어기드"],["피로이스","피로이스"],["아리아","아리아"],["다이아린","다이아린"],["「시드」","「시드」"],["루시아","루시아 엘로웬"],["엽빛나","엽빛나"],["유즈하","우키나미 유즈하"],["0호·엔비","0호·엔비"],["의현","의현"],["자오","자오"],["아스트라","아스트라 야오"],["그레이스","그레이스 하워드"],["미야비","호시미 미야비"],["소우카쿠","소우카쿠"],["하루마사","아사바 하루마사"],["리카온","본 리카온"],["「11호」","「11호」"],["반인호","반인호"],["파이퍼","파이퍼 휠"],["루시","루시아나 드 몬테피오"],["니콜","니콜 데마라"],["엘렌","엘렌 조"],["엔비","엔비 데마라"],["펄크라","펄크라 페리니"],["콜레다","콜레다 벨로보그"],["벤","벤 비거"],["빌리","빌리 키드"],["주연","주연"],["리나","알렉산드리나 세바스티안"],["마나토","코마노 마나토"],["세스","세스 로웰"],["앤톤","앤톤 이바노프"],["코린","코린 위크스"]];
const miss = mine.filter(([n, f]) => !E.evaluate({ name_mi18n: n, full_name_mi18n: f, equip: [], properties: [] }, B, "good").matched);
console.log("매칭 실패:", miss.map((m) => m[0]));
console.log("ok");
