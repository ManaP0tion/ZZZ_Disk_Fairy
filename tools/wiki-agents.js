// HoYoWiki 에이전트 목록(menu_id 8) → extension/data/agent-wiki.js (이름 → 일러스트, 소개 대사)
// 실행: node tools/wiki-agents.js  (새 에이전트가 나오면 다시 실행)
const API = "https://sg-wiki-api-static.hoyolab.com/hoyowiki/zzz/wapi/";
const H = { "content-type": "application/json", "x-rpc-language": "ko-kr", "x-rpc-wiki_app": "zzz", origin: "https://wiki.hoyolab.com", referer: "https://wiki.hoyolab.com/" };
const get = async (url, body) => {
  const j = await (await fetch(API + url, { method: body ? "POST" : "GET", headers: H, body: body && JSON.stringify(body) })).json();
  if (j.retcode) throw new Error(`${url}: ${j.message}`);
  return j.data;
};
// <p> 단위로 줄을 나누고 태그를 지운다
const text = (html) => html.split(/<\/p>/).map((s) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim()).filter(Boolean).join("\n");

(async () => {
  const list = [];
  for (let n = 1; ; n++) {
    const d = await get("get_entry_page_list", { filters: [], menu_id: "8", page_num: n, page_size: 30, use_es: true });
    list.push(...d.list);
    if (!d.list.length || list.length >= Number(d.total)) break;
  }
  const out = {};
  for (let i = 0; i < list.length; i += 8) {
    await Promise.all(list.slice(i, i + 8).map(async (e) => {
      const p = (await get(`entry_page?entry_page_id=${e.entry_page_id}`)).page;
      out[e.name] = { img: p.header_img_url || e.icon_url, desc: text(p.desc || "") };
    }));
  }
  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b, "ko")));
  require("fs").writeFileSync(__dirname + "/../extension/data/agent-wiki.js",
    `// HoYoWiki 에이전트 일러스트(header_img_url)와 소개 대사(desc)\n// 갱신: node tools/wiki-agents.js\nwindow.ZZZ_AGENT_WIKI = ${JSON.stringify(sorted, null, 1)};\n`);
  console.log(`${list.length}명 저장`);
})();
