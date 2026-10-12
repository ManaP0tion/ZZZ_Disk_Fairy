// 팝업: 전적 페이지가 이미 열려 있으면 그 탭으로, 아니면 새 탭으로 연다.
const URL = "https://act.hoyolab.com/app/zzz-game-record/";
document.getElementById("go").onclick = async () => {
  const [tab] = await chrome.tabs.query({ url: URL + "*" });
  if (tab) {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: URL });
  }
  window.close();
};
