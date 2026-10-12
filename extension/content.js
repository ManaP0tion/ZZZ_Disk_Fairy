// 격리된 content script: inject.js가 넘긴 응답을 평가해서 패널로 그린다.
// 디자인: docs/DESIGN.md (Apple 계열 — Parchment 서피스, 단일 Action Blue, pill 칩, 그림자 없음)
(() => {
  let host, shadow, lastAvatar;
  const KEY = "zzzDiscAdvisor.tier";
  let tier = "good";
  try { tier = localStorage.getItem(KEY) || "good"; } catch (e) {}
  const THEME_KEY = "zzzDiscAdvisor.theme";
  let theme = null; // null = 시스템 따라감, "light" | "dark" = 사용자가 고른 값
  try { theme = localStorage.getItem(THEME_KEY); } catch (e) {}
  const WIDTH_KEY = "zzzDiscAdvisor.width";
  let width = 400;
  try { width = +localStorage.getItem(WIDTH_KEY) || 400; } catch (e) {}
  const clampWidth = (w) => Math.round(Math.max(360, Math.min(w, window.innerWidth - 48)));
  const sysDark = () => window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = () => (theme ? theme === "dark" : sysDark());

  // 세트 아이콘 캐시: 사용자가 열어본 에이전트의 장착 디스크에서 세트명 → 아이콘을 모아 둔다.
  const ICON_KEY = "zzzDiscAdvisor.suitIcons";
  let suitIcons = {};
  try { suitIcons = JSON.parse(localStorage.getItem(ICON_KEY) || "{}"); } catch (e) {}
  function rememberIcons(avatar) {
    let changed = false;
    for (const e of avatar.equip || []) {
      const n = e.equip_suit && e.equip_suit.name;
      if (n && e.icon && suitIcons[n] !== e.icon) { suitIcons[n] = e.icon; changed = true; }
    }
    const w = avatar.weapon;
    if (w && w.name && w.icon && suitIcons["W:" + w.name] !== w.icon) { suitIcons["W:" + w.name] = w.icon; changed = true; }
    if (changed) try { localStorage.setItem(ICON_KEY, JSON.stringify(suitIcons)); } catch (e) {}
  }
  // W-엔진 이름 → 이미지: 1순위 위키(engine-icons.js), 2순위 열어본 에이전트에서 모은 아이콘
  const sq = (s) => String(s).replace(/\s/g, "");
  function engineIcon(name) {
    const ICONS = window.ZZZ_ENGINE_ICONS || {};
    const k = Object.keys(ICONS).find((n) => sq(n) === sq(name));
    return (k && ICONS[k]) || suitIcons["W:" + name] || null;
  }
  // 시트 약칭(카재 등) → 캐시에 있는 정식 세트명
  // 1순위: 확장에 내장된 위키 원형 디스크 이미지(suit-icons.js), 2순위: 열어본 에이전트에서 모은 아이콘
  function resolveSuit(token) {
    const ICONS = window.ZZZ_SUIT_ICONS || {};
    const names = [...new Set([...Object.keys(ICONS), ...Object.keys(suitIcons)])];
    const exact = names.find((n) => n.replace(/\s/g, "") === String(token).replace(/\s/g, ""));
    const full = exact || names.find((n) => window.ZZZEval.setMatches(token, n));
    return { name: full || token, icon: full ? ICONS[full] || suitIcons[full] : null };
  }

  const SHEET_URL = "https://docs.google.com/spreadsheets/d/1C3ZpKCTQJXFwUBgZKZRdLOvGqDGlVijb/edit?gid=2007866856#gid=2007866856";
  const ISSUE_URL = "https://github.com/ManaP0tion/ZZZ_Setting_Extension/issues/new";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  const CSS = `
  :host { all: initial; }
  .panel {
    /* 라이트 (docs/DESIGN.md 기본 팔레트) */
    --primary: #0066cc; --primary-focus: #0071e3;
    --ink: #1d1d1f; --ink-80: #333333; --ink-60: #6e6e73; --ink-48: #7a7a7a; --on-ink: #ffffff;
    --surface: #f5f5f7; --header: rgba(245, 245, 247, 0.8); --card: #ffffff;
    --hairline: #e0e0e0; --divider: #f0f0f0; --chip: rgba(210, 210, 215, 0.64);
    --valid-bg: #f5f5f7; --meter-off: #e0e0e0;
    --pass: #0a84c8; --pass-bg: #e6f4fc; --fail: #d70015; --fail-bg: #fdecee;
    --display: "Pretendard Variable", Pretendard, "SF Pro Display", system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif;
    --text: "Pretendard Variable", Pretendard, "SF Pro Text", system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif;
    position: fixed; top: 72px; right: 24px; z-index: 2147483647;
    width: var(--w, 400px); max-height: calc(100vh - 96px); display: flex; flex-direction: column; overflow: hidden;
    background: var(--surface); border: 1px solid var(--hairline); border-radius: 18px;
    color: var(--ink); font: 400 14px/1.43 var(--text); letter-spacing: -0.224px;
    -webkit-font-smoothing: antialiased; word-break: keep-all; overflow-wrap: anywhere;
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) {
    .panel:not([data-theme="light"]) {
      /* 다크 타일 계열: surface-tile-1/2/3, primary-on-dark */
      --primary: #2997ff; --primary-focus: #2997ff;
      --ink: #f5f5f7; --ink-80: #e0e0e0; --ink-60: #a1a1a6; --ink-48: #8e8e93; --on-ink: #1d1d1f;
      --surface: #1d1d1f; --header: rgba(29, 29, 31, 0.8); --card: #272729;
      --hairline: #3a3a3c; --divider: #323234; --chip: rgba(118, 118, 128, 0.36);
      --valid-bg: #353537; --meter-off: #3a3a3c;
      --pass: #64d2ff; --pass-bg: rgba(100, 210, 255, 0.14); --fail: #ff6961; --fail-bg: rgba(255, 105, 97, 0.14);
      color-scheme: dark;
    }
  }
  .panel[data-theme="dark"] {
      /* 다크 타일 계열: surface-tile-1/2/3, primary-on-dark */
      --primary: #2997ff; --primary-focus: #2997ff;
      --ink: #f5f5f7; --ink-80: #e0e0e0; --ink-60: #a1a1a6; --ink-48: #8e8e93; --on-ink: #1d1d1f;
      --surface: #1d1d1f; --header: rgba(29, 29, 31, 0.8); --card: #272729;
      --hairline: #3a3a3c; --divider: #323234; --chip: rgba(118, 118, 128, 0.36);
      --valid-bg: #353537; --meter-off: #3a3a3c;
      --pass: #64d2ff; --pass-bg: rgba(100, 210, 255, 0.14); --fail: #ff6961; --fail-bg: rgba(255, 105, 97, 0.14);
      color-scheme: dark;
    }
  .scroll { overflow: auto; overscroll-behavior: contain; min-height: 0; }
  .grip { position: absolute; left: 0; top: 0; bottom: 0; width: 8px; cursor: ew-resize; z-index: 2; touch-action: none; }
  .grip:hover, .grip.on { background: linear-gradient(to right, var(--primary) 2px, transparent 2px); }
  .panel.min { max-height: none; }
  .panel.min .body { display: none; }
  header { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: 8px;
    padding: 20px 20px 16px; background: var(--header);
    -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px); }
  .title { flex: 1; min-width: 0; display: grid; gap: 2px; }
  .eyebrow { font: 400 12px/1 var(--text); letter-spacing: -0.12px; color: var(--ink-60); }
  h2 { margin: 0; font: 600 28px/1.1 var(--display); letter-spacing: -0.28px; }
  .icon { all: unset; box-sizing: border-box; width: 32px; height: 32px; border-radius: 9999px; background: var(--chip);
    display: grid; place-items: center; cursor: pointer; color: var(--ink); font: 400 14px/1 var(--text); }
  .icon:active, .seg:active, summary:active { transform: scale(0.95); }
  .icon:focus-visible, .seg:focus-visible, summary:focus-visible { outline: 2px solid var(--primary-focus); outline-offset: 2px; }
  .body { padding: 0 20px 20px; display: grid; gap: 24px; }
  h3 { margin: 0 0 8px; font: 600 14px/1.29 var(--text); letter-spacing: -0.224px; color: var(--ink); }
  .muted { color: var(--ink-60); }
  .fine { font: 400 12px/1.4 var(--text); letter-spacing: -0.12px; color: var(--ink-60); margin: 0; }

  /* 기준 선택: configurator-option-chip */
  .segs { margin-top: 4px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .seg { all: unset; box-sizing: border-box; cursor: pointer; background: var(--card); border: 1px solid var(--hairline);
    border-radius: 9999px; padding: 10px 12px; text-align: center; display: grid; gap: 1px; color: var(--ink); }
  .seg[aria-pressed="true"] { border: 2px solid var(--primary-focus); padding: 9px 11px; }
  .seg b { font: 600 14px/1.29 var(--text); letter-spacing: -0.224px; }
  .seg span { font: 400 12px/1.2 var(--text); letter-spacing: -0.12px; color: var(--ink-60); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* 요약 */
  .summary { display: grid; gap: 6px; }
  .summary .big { font: 600 21px/1.19 var(--display); letter-spacing: 0.231px; }

  /* store-utility-card */
  .card { background: var(--card); border: 1px solid var(--hairline); border-radius: 18px; overflow: hidden; }
  .row { padding: 14px 16px; border-top: 1px solid var(--divider); }
  .row:first-child { border-top: 0; }
  .adv { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: baseline; }
  .tag { font: 600 10px/1.3 var(--text); letter-spacing: -0.08px; padding: 2px 7px; border-radius: 9999px;
    background: var(--valid-bg); color: var(--ink-80); white-space: nowrap; }
  .adv.high .tag { background: var(--ink); color: var(--on-ink); }
  .adv.high p { font-weight: 600; }
  .adv p { margin: 0; }

  /* 디스크 행 */
  .discs { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); }
  .disc { display: grid; grid-template-columns: 40px 1fr auto; gap: 2px 12px; align-items: start;
    background: var(--card); border: 1px solid var(--hairline); border-radius: 18px; padding: 16px; }
  .slot { grid-row: span 3; display: grid; justify-items: center; gap: 6px; font: 600 21px/1.19 var(--display); color: var(--ink-60); font-variant-numeric: tabular-nums; }
  .slot img { width: 40px; height: 40px; object-fit: contain; border-radius: 8px; background: var(--valid-bg); }
  .set { font: 600 15px/1.29 var(--text); letter-spacing: -0.24px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .score { grid-row: span 2; text-align: right; display: grid; justify-items: end; }
  .score b { font: 600 21px/1.19 var(--display); font-variant-numeric: tabular-nums; }
  .score span { font: 400 12px/1.3 var(--text); color: var(--ink-60); white-space: nowrap; }
  .score.bad span { color: var(--ink); font-weight: 600; }
  .meter { display: flex; gap: 2px; margin-top: 4px; }
  .meter i { width: 8px; height: 3px; border-radius: 2px; background: var(--meter-off); }
  .meter i.on { background: var(--ink); }
  .main { grid-column: 2; font: 400 13px/1.4 var(--text); color: var(--ink-80); }
  .main .lbl { color: var(--ink-60); margin-right: 4px; }
  .main.bad { color: var(--ink); font-weight: 600; }
  .main .rec { display: block; color: var(--ink-60); font-weight: 400; }
  .subs { grid-column: 2 / 4; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 8px; }
  .sub { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; padding: 6px 9px;
    border-radius: 8px; border: 1px solid var(--divider); font: 400 13px/1.3 var(--text); letter-spacing: -0.2px; color: var(--ink-60); min-width: 0; }
  .sub .n { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sub .val { white-space: nowrap; font-variant-numeric: tabular-nums; }
  .sub .r { font-size: 11px; margin-left: 3px; color: var(--ink-60); font-weight: 400; }
  .sub.v { background: var(--valid-bg); border-color: transparent; color: var(--ink); font-weight: 600; }

  .setrow { display: grid; grid-template-columns: 40px 1fr; gap: 12px; align-items: start; }
  .pc { font: 600 13px/32px var(--text); color: var(--ink-60); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
  .setchip { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; padding: 3px 10px 3px 3px;
    border-radius: 9999px; border: 1px solid var(--hairline); font: 400 13px/1.2 var(--text); color: var(--ink-80); }
  .setchip img, .setchip .ph { width: 26px; height: 26px; border-radius: 9999px; flex: none; object-fit: contain; background: var(--valid-bg); }
  .setchip .ph { display: grid; place-items: center; font: 600 12px/1 var(--text); color: var(--ink-60); }
  .setchip .sn { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .setchip.on { background: var(--valid-bg); border-color: transparent; color: var(--ink); font-weight: 600; }
  .setchip .ck { font: 600 10px/1.3 var(--text); padding: 1px 6px; border-radius: 9999px; background: var(--ink); color: var(--on-ink); }
  details { display: grid; }
  summary { cursor: pointer; color: var(--primary); list-style: none; width: max-content; border-radius: 5px; }
  summary::-webkit-details-marker { display: none; }
  summary::after { content: " ›"; }
  details[open] summary::after { content: " ‹"; }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .foot a { color: var(--primary); text-decoration: none; }
  .foot a:hover { text-decoration: underline; }
  .foot .btn { flex: none; padding: 6px 12px; border-radius: 9999px; background: var(--chip); color: var(--ink); font: 600 12px/1.2 var(--text); }
  .foot .btn:hover { text-decoration: none; }
  .foot a:focus-visible { outline: 2px solid var(--primary-focus); outline-offset: 2px; }
  /* 목표 스탯 박스: 달성 하늘색, 부족 빨간색 */
  .goals { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .goalbox { border-radius: 14px; padding: 12px 14px; display: grid; gap: 2px; font-variant-numeric: tabular-nums; }
  .goalbox.ok { background: var(--pass-bg); }
  .goalbox.no { background: var(--fail-bg); }
  .goalbox .k { display: flex; justify-content: space-between; gap: 6px; font: 600 12px/1.3 var(--text); color: var(--ink-80); }
  .goalbox .st { white-space: nowrap; }
  .goalbox.ok .st { color: var(--pass); }
  .goalbox.no .st { color: var(--fail); }
  .goalbox .v { font: 600 21px/1.2 var(--display); }
  .goalbox.ok .v { color: var(--pass); }
  .goalbox.no .v { color: var(--fail); }
  .goalbox .v small { font: 400 13px/1 var(--text); color: var(--ink-60); margin-left: 4px; }
  pre { white-space: pre-wrap; margin: 8px 0 0; font: 400 13px/1.5 var(--text); color: var(--ink-80);
    background: var(--card); border: 1px solid var(--hairline); border-radius: 11px; padding: 12px 14px; }
  `;

  function ensureHost() {
    if (host && document.contains(host)) return;
    host = document.createElement("div");
    host.id = "zzz-disc-advisor";
    // @font-face는 shadow DOM 안에서 안 먹으니 문서에 붙인다
    if (!document.getElementById("zzz-pretendard")) {
      const link = document.createElement("link");
      link.id = "zzz-pretendard"; link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";
      (document.head || document.documentElement).appendChild(link);
    }
    shadow = host.attachShadow({ mode: "open" });
    (document.body || document.documentElement).appendChild(host);
  }

  const fmtGap = (c) => (c.pct ? `${c.gap}%` : `${Math.ceil(c.gap).toLocaleString()}`);

  function seg(k, t, selected) {
    const r = t.result;
    const sub = !r || r.pass === null ? (r && r.short) || "기준 없음" : r.pass ? "달성" : `${r.checks.filter((c) => c.gap > 0).length}개 부족`;
    return `<button class="seg" data-tier="${k}" aria-pressed="${k === selected}"><b>${esc(t.label)}</b><span>${esc(sub)}</span></button>`;
  }
  function summary(res) {
    const t = res.tiers[res.selected];
    const r = t.result;
    if (!r || r.pass === null)
      return `<div class="summary"><div class="big">${esc(t.label)} 기준 없음</div><p class="fine">${esc((r && r.reason) || "평가할 기준이 없습니다.")}</p></div>`;
    const note = r.note ? `<p class="fine">${esc(r.note)}</p>` : "";
    if (r.pass) return `<div class="summary"><div class="big">${esc(t.label)} 기준 달성</div>${note}</div>`;
    const n = r.checks.filter((c) => c.gap > 0).length;
    return `<div class="summary"><div class="big">${esc(t.label)} 기준까지 ${n}개 부족</div>${note}</div>`;
  }


  // 선택한 등급의 목표 스탯을 스탯별 박스로
  function goalBoxes(res) {
    const r = res.tiers[res.selected].result;
    if (!r || !r.checks.length) return "";
    const n = (v, pct) => (pct ? `${v}%` : Math.round(v).toLocaleString());
    const boxes = r.checks.map((c) => {
      const ok = c.gap <= 0;
      return `<div class="goalbox ${ok ? "ok" : "no"}"><span class="k">${esc(c.label)}<span class="st">${ok ? "달성 ✓" : `−${esc(fmtGap(c))}`}</span></span>` +
        `<span class="v">${esc(n(c.cur, c.pct))}<small>/ ${esc(n(c.need, c.pct))}</small></span></div>`;
    });
    return `<section><h3>목표 스탯</h3><div class="goals">${boxes.join("")}</div></section>`;
  }

  const SHORT = { "치명타 확률": "치확", "치명타 피해": "치피", "이상 마스터리": "이상마", "이상 장악력": "이상장악", "관통 수치": "관통" };
  const short = (l) => { const n = l.replace(/%$/, ""); return SHORT[n] || n; };

  function setChips(tokens, equippedNames) {
    return tokens
      .map((t) => {
        const r = resolveSuit(t);
        const on = equippedNames.some((n) => window.ZZZEval.setMatches(t, n));
        const img = r.icon
          ? `<img src="${esc(r.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
          : `<span class="ph" aria-hidden="true">${esc(r.name.slice(0, 1))}</span>`;
        return `<span class="setchip${on ? " on" : ""}" title="${esc(r.name)}">${img}<span class="sn">${esc(r.name)}</span>${on ? `<span class="ck">장착</span>` : ""}</span>`;
      })
      .join("");
  }

  function setSection(res) {
    const ref = res.setRef;
    if (!ref) return "";
    const si = res.setInfo;
    const rows = [];
    if (ref.set4 && ref.set4.length) rows.push(`<div class="row setrow"><span class="pc">4세트</span><div class="chips">${setChips(ref.set4, si.four ? [si.four] : [])}</div></div>`);
    if (ref.set2 && ref.set2.length) rows.push(`<div class="row setrow"><span class="pc">2세트</span><div class="chips">${setChips(ref.set2, si.twos)}</div></div>`);
    return rows.length ? `<section><h3>권장 세트</h3><div class="card">${rows.join("")}</div></section>` : "";
  }

  function engineSection(res) {
    const e = res.engine;
    if (!e) return "";
    const status = !e.name ? "장착 안 함" : e.rank === 0 ? "최우선 권장" : e.rank > 0 ? `권장 ${e.rank + 1}순위` : "교체 고려";
    const pic = (src, name) => src ? `<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="ph" aria-hidden="true">${esc(String(name || "W").slice(0, 1))}</span>`;
    const img = pic(e.icon || (e.name && engineIcon(e.name)), e.name);
    const cur = `<div class="row setrow"><span class="pc">장착</span><div class="chips"><span class="setchip${e.rank >= 0 ? " on" : ""}">${img}` +
      `<span class="sn">${esc(e.name || "없음")}${e.star ? ` · 연마 ${esc(e.star)}` : ""}</span><span class="ck">${esc(status)}</span></span></div></div>`;
    const recs = e.recs.map((r) => `<span class="setchip${r.on ? " on" : ""}" title="${esc(r.name)}">${pic(engineIcon(r.name), r.name)}<span class="sn">${esc(r.name)}${r.tag ? ` <span class="muted">${esc(r.tag === "전엔" ? "전용" : r.tag + " 전용")}</span>` : ""}</span></span>`).join("");
    const sel = res.tiers[res.selected];
    const from = e.from && e.from !== sel.label ? `<p class="fine" style="margin-top:8px">${esc(sel.label)} 탭에는 W-엔진 기준이 없어서, ${esc(e.from)} 기준으로 표시합니다.</p>` : "";
    return `<section><h3>W-엔진</h3><div class="card">${cur}<div class="row setrow"><span class="pc">권장</span><div class="chips">${recs}</div></div></div>${e.note ? `<p class="fine" style="margin-top:8px">${esc(e.note)}</p>` : ""}${from}</section>`;
  }

  const TAG = { high: "필수", mid: "권장", low: "참고", info: "정보" };

  function discRow(d) {
    const main = d.main ? `<span class="lbl">주옵</span>${esc(d.main.label)} ${esc(d.main.value)}` : "주옵 없음";
    let mainHtml = `<div class="main">${main}</div>`;
    if (d.mainOk === false) mainHtml = `<div class="main bad">${main}<span class="rec">권장 ${esc(d.mainAllowed.join(" / "))}</span></div>`;
    const subs = d.subs
      .map((s) => `<div class="sub ${s.weight > 0 ? "v" : ""}"><span class="n">${esc(short(s.label))}</span>` +
        `<span class="val">${esc(s.value)}${s.rolls > 1 ? `<span class="r">+${s.rolls - 1}</span>` : ""}</span></div>`)
      .join("");
    const lit = Math.max(0, Math.min(8, Math.round(d.eff)));
    const meter = Array.from({ length: 8 }, (_, i) => `<i class="${i < lit ? "on" : ""}"></i>`).join("");
    return `<div class="disc"><div class="slot"><span>${d.slot}</span>${d.icon ? `<img src="${esc(d.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}</div><div class="set" title="${esc(d.name)}">${esc(d.set || d.name)}</div>
      <div class="score ${d.grade.key === "bad" ? "bad" : ""}"><b>${d.eff}</b><span>${esc(d.grade.text)}</span><div class="meter" aria-hidden="true">${meter}</div></div>
      ${mainHtml}<div class="subs">${subs}</div></div>`;
  }

  function render(res) {
    ensureHost();
    const minimized = !!shadow.querySelector(".panel.min");
    const ref = res.ref;
    const notes = ref ? [ref.targetsRaw && `목표: ${ref.targetsRaw}`, ref.critRaw && `치명타: ${ref.critRaw}`, ref.note].filter(Boolean).join("\n") : "";
    const advice = res.advice.filter((a) => !/기준까지:|모두 달성/.test(a.text));
    const adviceHtml = advice.length
      ? advice.map((a) => `<div class="row adv ${a.level}"><span class="tag">${TAG[a.level]}</span><p>${esc(a.text)}</p></div>`).join("")
      : `<div class="row"><p class="muted" style="margin:0">바꿀 디스크가 없습니다.</p></div>`;
    const sel = res.tiers[res.selected];
    const borrowed = res.statFrom && res.statFrom !== sel.label ? `<p class="fine">시트의 ${esc(sel.label)} 탭에는 주옵·부옵 기준이 없어서, ${esc(res.statFrom)} 기준으로 판정합니다.</p>` : "";

    shadow.innerHTML = `<style>${CSS}</style>
      <div class="panel${minimized ? " min" : ""}"${theme ? ` data-theme="${theme}"` : ""} role="dialog" aria-label="디스크 평가" style="--w:${clampWidth(width)}px">
        <div class="grip" title="드래그해서 폭 조절" aria-hidden="true"></div>
        <div class="scroll">
        <header>
          <div class="title"><span class="eyebrow">디스크 평가</span><h2>${esc(res.name)}</h2></div>
          <button class="icon" id="theme" aria-label="${isDark() ? "라이트 모드로 전환" : "다크 모드로 전환"}" title="${isDark() ? "라이트 모드" : "다크 모드"}">${isDark() ? "☀" : "☾"}</button>
          <button class="icon" id="min" aria-label="접기">${minimized ? "+" : "−"}</button>
          <button class="icon" id="close" aria-label="닫기">✕</button>
        </header>
        <div class="body">
          ${res.matched ? "" : `<p class="fine">시트에서 이 에이전트를 찾지 못했습니다. 전적 페이지에 표시된 이름: “${esc(lastAvatar.name_mi18n)}” / “${esc(lastAvatar.full_name_mi18n)}” (id ${esc(lastAvatar.id)})</p>`}
          <section><div class="segs" role="group" aria-label="평가 기준">${["basic", "good", "max"].map((k) => seg(k, res.tiers[k], res.selected)).join("")}</div></section>
          ${summary(res)}
          ${goalBoxes(res)}
          <section><h3>조언</h3><div class="card">${adviceHtml}</div></section>
          ${engineSection(res)}
          ${setSection(res)}
          <section><h3>장착 디스크</h3><div class="discs">${res.discs.map(discRow).join("")}</div>
            <p class="fine" style="margin-top:8px">오른쪽 숫자는 유효한 부옵이 강화된 횟수이며, 가중치를 반영해서 계산합니다. 배경색이 있는 부옵이 유효 옵션이고, +n은 그 부옵이 강화된 횟수입니다.</p>${borrowed}</section>
          ${notes ? `<details open><summary>시트 원문 메모</summary><pre>${esc(notes)}</pre></details>` : ""}
          <div class="foot"><p class="fine">기준 시트 · <a href="${SHEET_URL}" target="_blank" rel="noopener">${esc(window.ZZZ_BENCHMARK.version || "")}</a></p>
            <a class="btn" href="${ISSUE_URL}" target="_blank" rel="noopener">개선사항 건의</a></div>
        </div>
        </div>
      </div>`;

    shadow.getElementById("theme").onclick = (e) => {
      theme = isDark() ? "light" : "dark";
      try { localStorage.setItem(THEME_KEY, theme); } catch (err) {}
      shadow.querySelector(".panel").dataset.theme = theme;
      e.currentTarget.textContent = isDark() ? "☀" : "☾";
      e.currentTarget.setAttribute("aria-label", isDark() ? "라이트 모드로 전환" : "다크 모드로 전환");
      e.currentTarget.title = isDark() ? "라이트 모드" : "다크 모드";
    };
    const grip = shadow.querySelector(".grip");
    grip.onpointerdown = (e) => {
      const panel = shadow.querySelector(".panel");
      const x0 = e.clientX, w0 = panel.offsetWidth;
      grip.setPointerCapture(e.pointerId);
      grip.classList.add("on");
      grip.onpointermove = (ev) => { width = clampWidth(w0 + x0 - ev.clientX); panel.style.setProperty("--w", width + "px"); };
      grip.onpointerup = () => {
        grip.onpointermove = grip.onpointerup = null;
        grip.classList.remove("on");
        try { localStorage.setItem(WIDTH_KEY, width); } catch (err) {}
      };
    };
    grip.ondblclick = () => { width = 400; shadow.querySelector(".panel").style.setProperty("--w", "400px"); try { localStorage.removeItem(WIDTH_KEY); } catch (err) {} };
    shadow.getElementById("close").onclick = () => host.remove();
    shadow.getElementById("min").onclick = (e) => {
      const p = shadow.querySelector(".panel");
      p.classList.toggle("min");
      e.currentTarget.textContent = p.classList.contains("min") ? "+" : "−";
    };
    shadow.querySelectorAll("[data-tier]").forEach((b) =>
      b.addEventListener("click", () => {
        tier = b.dataset.tier;
        try { localStorage.setItem(KEY, tier); } catch (e) {}
        render(window.ZZZEval.evaluate(lastAvatar, window.ZZZ_BENCHMARK, tier));
      })
    );
  }

  window.addEventListener("message", (ev) => {
    if (ev.source !== window || !ev.data || !ev.data.__zzzDiscAdvisor) return;
    const list = ev.data.payload && ev.data.payload.data && ev.data.payload.data.avatar_list;
    if (!list || !list.length) return;
    lastAvatar = list[0];
    rememberIcons(lastAvatar);
    const draw = () => render(window.ZZZEval.evaluate(lastAvatar, window.ZZZ_BENCHMARK, tier));
    if (document.body) draw();
    else document.addEventListener("DOMContentLoaded", draw, { once: true });
  });
})();
