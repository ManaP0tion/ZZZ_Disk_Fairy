// 디스크 평가 엔진. 브라우저(window.ZZZEval)와 Node(module.exports) 양쪽에서 동작.
(function (root) {
  const STAT_LABEL = {
    "ATK%": "공격력%", ATK: "공격력", "HP%": "체력%", HP: "체력", "DEF%": "방어력%", DEF: "방어력",
    CR: "치명타 확률", CD: "치명타 피해", AP: "이상 마스터리", AM: "이상 장악력", PENR: "관통률",
    PEN: "관통 수치", ER: "에너지 회복", IMP: "충격력", SHEER: "관입력",
  };
  const label = (k) => STAT_LABEL[k] || (k.startsWith("DMG_") ? k.slice(4) + " 피해" : k);

  // 시트 표기 / API 표기를 공통 키로 정규화
  function statKey(raw, pct) {
    let s = String(raw).replace(/\(.*?\)|\[.*?\]/g, "").replace(/\s/g, "");
    const isPct = pct || s.endsWith("%");
    s = s.replace(/%$/, "");
    if (s === "공퍼") return "ATK%";
    if (s === "체퍼") return "HP%";
    if (/^(치명타확률|치확)/.test(s)) return "CR";
    if (/^(치명타피해|치피)/.test(s)) return "CD";
    if (/^(이상마스터리|이상마)/.test(s)) return "AP";
    if (/^이상장악력/.test(s)) return "AM";
    if (/^관통률/.test(s)) return "PENR";
    if (/^관통(수치)?$/.test(s)) return "PEN";
    if (/에너지/.test(s)) return "ER";
    if (/^충격력/.test(s)) return "IMP";
    if (/^관입력/.test(s)) return "SHEER";
    const el = s.match(/(물리|불|얼음|전기|에테르|바람|현묵)/);
    if (el && /피해/.test(s)) return "DMG_" + el[1];
    if (/^(공격력|공)$/.test(s)) return isPct ? "ATK%" : "ATK";
    if (/^(체력|HP)$/i.test(s)) return isPct ? "HP%" : "HP";
    if (/^(방어력|방)$/.test(s)) return isPct ? "DEF%" : "DEF";
    return s;
  }

  const num = (v) => {
    const n = parseFloat(String(v ?? "").replace(/[,%]/g, ""));
    return isNaN(n) ? null : n;
  };
  const squash = (s) => String(s).replace(/\s|\[.*?\]/g, "");

  // 시트 약칭(카재, 고요별 등)과 정식 세트명 매칭: 포함 또는 첫 글자가 같은 부분수열
  function setMatches(token, suitName) {
    const t = squash(token), n = squash(suitName);
    if (!t || !n) return false;
    if (n.includes(t)) return true;
    if (t.length < 2 || t[0] !== n[0]) return false;
    let i = 0;
    for (const ch of n) if (ch === t[i]) i++;
    return i === t.length;
  }

  // 이름 정규화: 공백·가운뎃점·마침표·낫표 제거 ("0호·엔비" = "0호 엔비", "「시드」" = "시드")
  const normName = (s) => String(s || "").replace(/[\s·・.,「」『』\[\]()]/g, "");
  // 게임 내 이름과 시트 표기가 다른 캐릭터 (정규화된 API 이름 → 정규화된 시트 이름)
  const NAME_ALIAS = { "스타라이트빌리": "S빌리", "빌리스타라이트": "S빌리" };

  function findAgent(tier, avatar) {
    if (!tier) return null;
    const keys = new Set();
    for (const n of [avatar.name_mi18n, avatar.full_name_mi18n].filter(Boolean)) {
      const k = normName(n);
      keys.add(k);
      if (NAME_ALIAS[k]) keys.add(NAME_ALIAS[k]);
      if (k.includes("스타라이트") && k.includes("빌리")) keys.add("S빌리");
    }
    // 부분 일치는 쓰지 않는다 ("0호 엔비"가 "엔비"로, "스타라이트 빌리"가 "빌리"로 잘못 붙는 문제)
    return (tier.agents || []).find((a) => keys.has(normName(a.name))) || null;
  }

  function parseDisc(e) {
    const main = e.main_properties && e.main_properties[0];
    return {
      slot: e.equipment_type,
      name: e.name,
      icon: e.icon || null,
      set: e.equip_suit && e.equip_suit.name,
      level: e.level,
      rarity: e.rarity,
      main: main ? { key: statKey(main.property_name, String(main.base).includes("%")), label: main.property_name, value: main.base } : null,
      subs: (e.properties || []).map((p) => ({
        key: statKey(p.property_name, String(p.base).includes("%")),
        label: p.property_name + (String(p.base).includes("%") ? "%" : ""),
        value: p.base,
        rolls: p.level || 1,
      })),
    };
  }

  function weightsFor(entry) {
    const w = {};
    for (const s of (entry && entry.subs) || []) {
      const k = statKey(s.name, s.name.includes("%"));
      let v = s.weight;
      if (k === "ATK" || k === "HP" || k === "DEF") v = Math.min(v, 0.5); // 깡옵은 절반
      w[k] = Math.max(w[k] || 0, v);
    }
    return w;
  }

  function discGrade(eff) {
    if (eff >= 6) return { key: "great", text: "우수" };
    if (eff >= 4) return { key: "ok", text: "양호" };
    if (eff >= 2.5) return { key: "meh", text: "보통" };
    return { key: "bad", text: "교체 후보" };
  }

  function finalStats(avatar) {
    const out = {};
    for (const p of avatar.properties || []) {
      const v = p.final ?? p.base;
      const k = statKey(p.property_name, String(v).includes("%") && !/치명타|관통률|피해/.test(p.property_name) ? true : false);
      // 최종 스탯은 공격력/체력/방어력이 깡수치(최종값)로 나오므로 ATK/HP/DEF 키로 저장
      const key = k.replace("%", "");
      out[key] = num(v);
    }
    return out;
  }

  const MAIN_GROUP = { 치명: ["CR", "CD"] };
  const stripTag = (s) => String(s).replace(/\[.*?\]/g, "").trim();
  // 시트 W-엔진 칸에서 "[전엔]" 또는 "[휴고]" 같은 태그가 붙은 엔진 이름 찾기
  const engineByTag = (entry, tag) => {
    const w = ((entry && entry.wengine) || []).find((x) => x.includes(`[${tag}]`));
    return w ? stripTag(w) : null;
  };

  // 조건 판정: true(충족) / false(불충족) / null(판정 불가)
  function condOk(cond, c) {
    if (!cond) return true;
    const weapon = c.weapon;
    const wm = (name) => (weapon && name ? setMatches(name, weapon) || setMatches(weapon, name) : null);
    switch (cond.type || "main") {
      case "main": {
        const d = c.discs.find((x) => x.slot === cond.slot);
        return !!(d && d.main && d.main.key === statKey(cond.main, true));
      }
      case "mains456":
        return cond.mains.every((m, i) => {
          const d = c.discs.find((x) => x.slot === 4 + i);
          if (!d || !d.main) return false;
          return (MAIN_GROUP[m] || [statKey(m, true)]).includes(d.main.key) || (m === "속성피해" && d.main.key.startsWith("DMG_"));
        });
      case "rank":
        if (c.rank == null) return null;
        return cond.op === "<=" ? c.rank <= cond.n : c.rank >= cond.n;
      case "set":
        return cond.sets.some((t) => Object.keys(c.setCounts).some((n) => setMatches(t, n) && c.setCounts[n] >= cond.pc));
      case "note": {
        const t = cond.text.replace(/\s*(착용 시만|착용 시|시)$/, "").trim();
        if (!weapon && /엔|엔진/.test(t)) return null;
        if (t === "전엔") return wm(engineByTag(c.entry, "전엔"));
        if (t === "비전엔") { const r = wm(engineByTag(c.entry, "전엔")); return r == null ? null : !r; }
        let m = t.match(/^(.+?) 엔진$/);
        if (m && !/치확|공퍼/.test(m[1])) { const e = engineByTag(c.entry, m[1]); return e ? wm(e) : null; }
        const parts = t.split("+").map((x) => x.trim());
        const res = parts.map((p) => {
          if (Object.keys(c.setCounts).some((n) => setMatches(p, n) && c.setCounts[n] >= 2)) return true;
          const w = ((c.entry && c.entry.wengine) || []).map(stripTag).find((x) => setMatches(p, x));
          if (w) return wm(w);
          return null;
        });
        if (res.some((r) => r === false)) return false;
        return res.every((r) => r === true) ? true : null;
      }
    }
    return null;
  }

  const condText = (cond) => cond.text || `${cond.slot}번 주옵 ${cond.main}`;

  // 같은 스탯에 대해 조건 충족 항목 우선 → 무조건 항목 → (조건만 있고 판정 불가/불충족이면) 사용자가 고른 조건, 없으면 첫 항목을 가정
  function pickTargets(list, c, keyOf) {
    const by = {};
    for (const t of list || []) {
      const k = keyOf(t);
      (by[k] = by[k] || []).push(t);
    }
    const res = [];
    for (const k in by) {
      const withCond = by[k].filter((t) => t.cond && condOk(t.cond, c) === true);
      const plain = by[k].filter((t) => !t.cond);
      // unknown: 판정 불가 조건이 있음 / 아니면 조건을 전부 판정했지만 하나도 맞지 않음
      const fallback = by[k].find((t) => c.pick && t.cond && condText(t.cond) === c.pick) || by[k][0];
      const chosen = withCond[0] || plain[0] || (fallback && { ...fallback, assumed: true,
        unknown: by[k].some((t) => condOk(t.cond, c) === null), options: by[k].filter((t) => t.cond).map((t) => condText(t.cond)),
        alts: by[k].filter((t) => t.cond && t !== fallback) });
      if (chosen) res.push(chosen);
    }
    return res;
  }

  function checkTier(entry, stats, c, tierLabel, agentName) {
    if (!entry) return { pass: null, checks: [], reason: `시트의 ${tierLabel} 탭에는 ${agentName} 기준이 작성되어 있지 않습니다.`, short: "시트에 없음" };
    const cc = { ...c, entry };
    const checks = [], missing = [];
    for (const t of pickTargets(entry.targets, cc, (t) => t.stat)) {
      const cur = stats[t.stat];
      if (cur == null) { missing.push(label(t.stat)); continue; }
      checks.push({ stat: t.stat, label: label(t.stat), need: t.min, max: t.max, cur, gap: Math.max(0, t.min - cur), raw: t.raw, assumed: !!t.assumed, unknown: !!t.unknown, options: t.options, alts: (t.alts || []).map((a) => ({ cond: condText(a.cond), need: a.min })), cond: t.cond });
    }
    const crit = pickTargets(entry.crit, cc, () => "crit")[0];
    if (crit) {
      for (const k of ["CR", "CD"]) {
        if (crit[k] == null) continue;
        if (stats[k] == null) { missing.push(label(k)); continue; }
        checks.push({ stat: k, label: label(k), need: crit[k], cur: stats[k], gap: Math.max(0, +(crit[k] - stats[k]).toFixed(1)), raw: crit.raw, pct: true, assumed: !!crit.assumed, unknown: !!crit.unknown, options: crit.options, alts: (crit.alts || []).filter((a) => a[k] != null).map((a) => ({ cond: condText(a.cond), need: a[k] })), cond: crit.cond });
      }
    }
    if (!checks.length) {
      const raw = [entry.targetsRaw, entry.critRaw].filter(Boolean).join(" / ");
      let reason, short;
      if (!raw) { reason = `시트의 ${tierLabel} 목표 스탯 칸이 비어 있어서, 주옵·부옵·세트만 평가합니다.`; short = "목표 칸 비어 있음"; }
      else if (missing.length) { reason = `시트에 적힌 목표 스탯(${missing.join(", ")})을 전적 데이터에서 찾을 수 없습니다.`; short = "스탯 없음"; }
      else { reason = `시트 표기 “${raw}”를 수치 기준으로 해석하지 못했습니다.`; short = "해석 불가"; }
      return { pass: null, checks, reason, short };
    }
    // 조건을 맞추지 못해 가정한 목표: 사용자가 다른 조건으로 바꿀 수 있게 선택지와 함께 넘긴다
    const conds = [];
    for (const x of checks.filter((x) => x.assumed && x.cond)) {
      const picked = condText(x.cond);
      if (conds.some((n) => n.picked === picked)) continue;
      conds.push({ kind: x.unknown ? "조건 확인 불가" : "조건 불일치", picked, options: [...new Set(x.options)] });
    }
    return { pass: checks.every((x) => x.gap <= 0), checks, conds };
  }

  function evaluate(avatar, bench, sel, pick) {
    sel = sel || "good";
    const T = bench.tiers;
    const entries = { basic: findAgent(T.basic, avatar), good: findAgent(T.good, avatar), max: findAgent(T.max, avatar) };
    // 선택한 등급 기준. 악귀 탭처럼 주옵/부옵 칸이 없으면 이잘키 → 응애 순으로 빌려온다.
    const statRef = [entries[sel], entries.good, entries.basic].find((e) => e && e.mains) || null;
    const setRef = [entries[sel], entries.good, entries.basic].find((e) => e && e.set4 && e.set4.length) || null;
    const ref = entries[sel] || statRef || setRef;
    const tierLabelOf = (e) => ["basic", "good", "max"].map((k) => (entries[k] === e ? T[k].label : null)).find(Boolean);
    const discs = (avatar.equip || []).map(parseDisc).sort((a, b) => a.slot - b.slot);
    const stats = finalStats(avatar);
    const weights = weightsFor(statRef);
    const advice = [];

    // 1) 디스크별 점수 + 주옵 판정
    for (const d of discs) {
      d.eff = 0;
      d.totalRolls = 0;
      for (const s of d.subs) {
        s.weight = weights[s.key] || 0;
        d.eff += s.weight * s.rolls;
        d.totalRolls += s.rolls;
      }
      d.eff = +d.eff.toFixed(1);
      d.grade = discGrade(d.eff);
      if (statRef && d.slot >= 4 && d.slot <= 6) {
        const allowed = (statRef.mains[d.slot] || []).map((m) => statKey(m, true));
        d.mainAllowed = (statRef.mains[d.slot] || []);
        d.mainOk = allowed.length ? allowed.includes(d.main && d.main.key) : null;
        if (d.mainOk === false)
          advice.push({ level: "high", text: `${d.slot}번 주옵 부적합 / 현재 ${d.main.label} · 권장 ${d.mainAllowed.join(", ")}` });
      }
    }
    const missing = [1, 2, 3, 4, 5, 6].filter((s) => !discs.some((d) => d.slot === s));
    if (missing.length) advice.unshift({ level: "high", text: `${missing.join(", ")}번 슬롯 비어 있음` });

    // 2) 세트 판정
    const counts = {};
    for (const d of discs) if (d.set) counts[d.set] = (counts[d.set] || 0) + 1;
    const four = Object.keys(counts).find((n) => counts[n] >= 4);
    const twos = Object.keys(counts).filter((n) => n !== four && counts[n] >= 2);
    const setInfo = { counts, four, twos, set4Ok: null, set2Ok: null };
    if (setRef) {
      const ref = setRef;
      if (ref.set4 && ref.set4.length) {
        setInfo.set4Ok = !!four && ref.set4.some((t) => setMatches(t, four));
        if (!setInfo.set4Ok)
          advice.push({ level: "mid", text: `4세트 불일치 / 현재 ${four || "없음"} · 권장 ${ref.set4.join(", ")}` });
      }
      if (ref.set2 && ref.set2.length) {
        setInfo.set2Ok = twos.some((n) => ref.set2.some((t) => setMatches(t, n)));
        if (!setInfo.set2Ok)
          advice.push({ level: "mid", text: `2세트 불일치 / 현재 ${twos.join(", ") || "없음"} · 권장 ${ref.set2.join(", ")}` });
      }
    }

    // 3) W-엔진 판정: 시트 W-엔진 칸(악귀 탭엔 없음)과 장착 엔진을 이름으로 비교
    const engRef = [entries[sel], entries.good, entries.basic].find((e) => e && e.wengine && e.wengine.length) || null;
    const w = avatar.weapon;
    const weaponName = w && (w.name || w.name_mi18n);
    let engine = null;
    if (engRef) {
      const recs = engRef.wengine.map((x) => {
        const tag = (x.match(/\[(.+?)\]/) || [])[1] || null;
        const name = stripTag(x);
        // 부분 일치는 쓰지 않는다 ("별빛 엔진"과 "별빛 엔진 레플리카"는 다른 엔진)
        return { name, tag, on: !!weaponName && squash(name) === squash(weaponName) };
      });
      const idx = recs.findIndex((r) => r.on);
      engine = { name: weaponName || null, icon: (w && w.icon) || null, star: (w && w.star) || null, recs, rank: idx, note: engRef.wengineNote || null, from: tierLabelOf(engRef) };
      if (!weaponName) advice.unshift({ level: "high", text: `W-엔진 없음 / 권장 ${recs.map((r) => r.name).join(", ")}` });
      else if (idx < 0) advice.push({ level: "mid", text: `W-엔진 비권장 / 현재 ${weaponName} · 권장 ${recs.map((r) => r.name).join(", ")}` });
    }

    // 4) 낮은 점수 디스크
    const weak = discs.filter((d) => d.grade.key === "bad" && d.mainOk !== false).sort((a, b) => a.eff - b.eff);
    weak.forEach((d, i) =>
      advice.push({ level: i === 0 ? "mid" : "low", text: `${d.slot}번 디스크 교체 고려 대상 / 유효 강화 ${d.eff}회 (전체 ${d.totalRolls}회)` })
    );

    // 5) 등급별 목표 스탯
    const tiers = {};
    const ctxBase = { discs, rank: avatar.rank ?? null, setCounts: counts, weapon: weaponName || null, pick: pick || null };
    for (const k of ["basic", "good", "max"])
      tiers[k] = { label: T[k].label, entry: entries[k], result: checkTier(entries[k], stats, ctxBase, T[k].label, avatar.name_mi18n) };
    const selRes = tiers[sel] && tiers[sel].result;
    if (selRes && selRes.pass === false) {
      const gaps = selRes.checks.filter((c) => c.gap > 0);
      advice.push({
        level: "info",
        text: `${tiers[sel].label} 기준까지: ` + gaps.map((c) => `${c.label} ${c.pct ? c.gap + "%" : Math.ceil(c.gap)} 부족`).join(", "),
      });
    } else if (selRes && selRes.pass === true) {
      advice.push({ level: "info", text: `${tiers[sel].label} 기준 목표 스탯을 모두 달성했습니다.` });
    }
    for (const c of (selRes && selRes.checks) || []) {
      if (c.max && c.cur > c.max) advice.push({ level: "info", text: `${c.label} 권장 상한 초과 / 현재 ${c.cur} · 상한 ${c.max}` });
    }

    const order = { high: 0, mid: 1, low: 2, info: 3 };
    advice.sort((a, b) => order[a.level] - order[b.level]);
    return { name: avatar.name_mi18n, id: avatar.id, matched: !!ref, ref, selected: sel,
      statFrom: tierLabelOf(statRef), setFrom: tierLabelOf(setRef), setRef, engine, discs, stats, setInfo, tiers, advice, weights };
  }

  const api = { evaluate, statKey, setMatches, label };
  root.ZZZEval = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
