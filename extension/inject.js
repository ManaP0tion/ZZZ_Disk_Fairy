// 페이지(MAIN world)에서 실행: 페이지가 원래 보내는 avatar/info 응답만 복사해서 content script로 전달한다.
// 추가 API 호출은 하지 않는다.
(() => {
  const MATCH = "/zzz/avatar/info";
  const post = (payload) => window.postMessage({ __zzzDiscAdvisor: true, payload }, "*");

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0] && args[0].url;
      if (url && url.includes(MATCH)) res.clone().json().then(post).catch(() => {});
    } catch (e) {}
    return res;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__zzzUrl = String(url);
    return origOpen.call(this, method, url, ...rest);
  };
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    if (this.__zzzUrl && this.__zzzUrl.includes(MATCH)) {
      this.addEventListener("load", () => {
        try {
          post(this.responseType === "json" ? this.response : JSON.parse(this.responseText));
        } catch (e) {}
      });
    }
    return origSend.apply(this, args);
  };
})();
