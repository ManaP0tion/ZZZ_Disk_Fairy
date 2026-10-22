// 페이지(MAIN world)에서 실행: 페이지가 원래 보내는 avatar/info 응답을 복사해서 content script로 전달한다.
// 추가 API 호출은 사용자가 전체 리포트를 열 때(cmd: "all")만 보낸다.
(() => {
  const INFO = "/zzz/avatar/info", BASIC = "/zzz/avatar/basic";
  const post = (msg) => window.postMessage({ __zzzDiscAdvisor: true, ...msg }, "*");

  // 전체 리포트용: 페이지가 받은 에이전트 목록, 이미 받은 상세 정보, 페이지가 보낸 x-rpc-* 헤더(언어, 앱 버전 등)
  // 메인 화면(#/zzz/home)은 avatar/basic을 부르지 않고 /api/zzz/index만 부른다. 그래서 아무 전적 API 주소(apiUrl)에서
  // 서버·UID를 얻어 두고, 목록이 없으면 avatar/basic을 직접 요청한다.
  let basicUrl = null, basicList = null, apiUrl = null, rpcHeaders = {}, gotApi;
  const apiReady = new Promise((r) => { gotApi = r; });
  const infoById = new Map();
  function keepHeaders(headers) {
    for (const [k, v] of new Headers(headers || {})) if (k.startsWith("x-rpc-")) rpcHeaders[k] = v;
  }
  function onResponse(url, body) {
    const u = new URL(url, location.href);
    if (body && body.retcode === 0 && u.searchParams.get("role_id")) { apiUrl = u; gotApi(); }
    if (url.includes(INFO)) {
      for (const a of (body && body.data && body.data.avatar_list) || []) infoById.set(a.id, a);
      post({ payload: body });
    } else if (url.includes(BASIC) && body && body.retcode === 0) {
      basicUrl = new URL(url, location.href);
      basicList = body.data.avatar_list || [];
    }
  }
  const watched = (url) => url && url.includes("/game_record_zzz/api/zzz/");

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const req = args[0];
      const url = typeof req === "string" ? req : req && req.url;
      if (watched(url)) {
        if (req instanceof Request) keepHeaders(req.headers);
        if (args[1] && args[1].headers) keepHeaders(args[1].headers);
        res.clone().json().then((b) => onResponse(url, b)).catch(() => {});
      }
    } catch (e) {}
    return res;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__zzzUrl = String(url);
    return origOpen.call(this, method, url, ...rest);
  };
  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    if (watched(this.__zzzUrl) && /^x-rpc-/i.test(k)) rpcHeaders[k.toLowerCase()] = v;
    return origSetHeader.call(this, k, v);
  };
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    if (watched(this.__zzzUrl)) {
      const url = this.__zzzUrl;
      this.addEventListener("load", () => {
        try {
          onResponse(url, this.responseType === "json" ? this.response : JSON.parse(this.responseText));
        } catch (e) {}
      });
    }
    return origSend.apply(this, args);
  };

  // 에이전트 목록의 id마다 avatar/info를 요청한다. 페이지가 이미 받은 에이전트는 다시 요청하지 않는다.
  // ponytail: 동시 2개 고정, HoYoLAB이 요청 제한을 걸면 간격을 두는 쪽으로 바꿀 것
  async function fetchAll() {
    // 방금 열린 탭이면 페이지가 전적 API를 한 번 부를 때까지 기다린다. 로그인이 안 되어 있으면 이 요청 자체가 없다.
    const timeout = new Promise((r) => setTimeout(r, 20000));
    await Promise.race([apiReady, timeout]);
    if (!apiUrl) throw new Error("전적 페이지에서 전적 정보를 받지 못했습니다. HoYoLAB에 로그인되어 있는지 확인해 주세요.");
    if (!basicList) {
      const url = new URL(apiUrl.href.replace(/\/zzz\/[^?]*/, "/zzz/avatar/basic"));
      url.search = `?server=${encodeURIComponent(apiUrl.searchParams.get("server") || "")}&role_id=${encodeURIComponent(apiUrl.searchParams.get("role_id"))}`;
      const res = await origFetch(url.href, { credentials: "include", headers: rpcHeaders });
      const body = await res.json();
      if (body.retcode === -100) throw new Error("HoYoLAB 로그인이 풀렸습니다. 전적 페이지에서 다시 로그인해 주세요.");
      if (body.retcode !== 0) throw new Error(`에이전트 목록을 받지 못했습니다. (${body.message || "HTTP " + res.status})`);
      basicUrl = url;
      basicList = body.data.avatar_list || [];
    }
    const total = basicList.length;
    let next = 0, done = 0, failed = 0;
    const getInfo = async (ids) => {
      // 페이지와 같은 모양으로 보낸다 (URLSearchParams는 id_list[]를 id_list%5B%5D로 인코딩한다)
      const url = basicUrl.href.replace(BASIC, INFO) + (basicUrl.search ? "&" : "?") +
        ids.map((id) => `id_list[]=${encodeURIComponent(id)}`).join("&") + "&need_wiki=true";
      const res = await origFetch(url, { credentials: "include", headers: rpcHeaders });
      const body = await res.json();
      if (body.retcode !== 0) throw Object.assign(new Error(body.message || `HTTP ${res.status}`), { retcode: body.retcode });
      return body.data.avatar_list || [];
    };
    // 먼저 남은 에이전트 전부를 요청 하나로 받아 본다. 서버가 여러 id를 받지 않으면 빠진 에이전트만 아래에서 하나씩 받는다.
    // ponytail: 여러 id 지원 여부는 실제 로그인 응답으로 확인 못 함, 확인되면 하나씩 받는 경로를 지워도 됨
    const rest = basicList.filter((a) => !infoById.has(a.id)).map((a) => a.id);
    if (rest.length > 1) {
      try {
        for (const a of await getInfo(rest)) infoById.set(a.id, a);
      } catch (e) {
        if (e.retcode === -100) throw new Error("HoYoLAB 로그인이 풀렸습니다. 전적 페이지에서 다시 로그인해 주세요.");
      }
    }
    const worker = async () => {
      while (next < total) {
        const a = basicList[next++];
        if (!infoById.has(a.id)) {
          try {
            const [info] = await getInfo([a.id]);
            if (info) infoById.set(a.id, info); else failed++;
          } catch (e) {
            if (e.retcode === -100) throw new Error("HoYoLAB 로그인이 풀렸습니다. 전적 페이지에서 다시 로그인해 주세요.");
            failed++;
          }
        }
        post({ progress: { done: ++done, total } });
      }
    };
    await Promise.all([worker(), worker()]);
    // 목록 항목(프로필 이미지 등)에 상세 정보를 덮어쓴다. 상세를 못 받은 에이전트는 뺀다.
    return { all: basicList.filter((a) => infoById.has(a.id)).map((a) => ({ ...a, ...infoById.get(a.id) })), failed };
  }

  window.addEventListener("message", (ev) => {
    if (ev.source !== window || !ev.data || !ev.data.__zzzDiscAdvisor || ev.data.cmd !== "all") return;
    fetchAll().then(post, (e) => post({ error: e.message }));
  });
})();
