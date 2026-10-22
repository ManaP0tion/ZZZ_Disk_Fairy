// 팝업: 전적 페이지가 이미 열려 있으면 그 탭으로, 아니면 새 탭으로 연다.
const URL = "https://act.hoyolab.com/app/zzz-game-record/";
async function openRecord() {
  const [tab] = await chrome.tabs.query({ url: URL + "*" });
  if (!tab) return chrome.tabs.create({ url: URL });
  await chrome.windows.update(tab.windowId, { focused: true });
  return chrome.tabs.update(tab.id, { active: true });
}
document.getElementById("go").onclick = async () => {
  await openRecord();
  window.close();
};
// 전체 에이전트 분석: 전적 페이지를 준비하고, 진행 상황이 보이도록 리포트 탭을 바로 옆에 앞으로 연다.
document.getElementById("report").onclick = async () => {
  const [found] = await chrome.tabs.query({ url: URL + "*" });
  const tab = found || await chrome.tabs.create({ url: URL, active: false });
  await chrome.tabs.create({ url: `report.html?tab=${tab.id}`, index: tab.index + 1, windowId: tab.windowId });
  window.close();
};
document.getElementById("ver").textContent = "v" + chrome.runtime.getManifest().version;
