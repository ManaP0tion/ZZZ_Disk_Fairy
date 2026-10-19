<div align="center">
  <img src="extension/icons/icon128.png" width="96" alt="ZZZ 디스크 페어리 아이콘">
  <h1>ZZZ 디스크 페어리</h1>
  <a href="https://chromewebstore.google.com/detail/jjmgmcmclnplkihipekfgngnjfckklca"><img src="https://img.shields.io/chrome-web-store/v/jjmgmcmclnplkihipekfgngnjfckklca?label=Chrome%20Web%20Store" alt="Chrome Web Store"></a>
  <a href="https://chromewebstore.google.com/detail/jjmgmcmclnplkihipekfgngnjfckklca"><img src="https://img.shields.io/chrome-web-store/users/jjmgmcmclnplkihipekfgngnjfckklca" alt="Chrome Web Store Users"></a>
  <a href="https://developer.chrome.com/docs/extensions/mv3/intro/"><img src="https://img.shields.io/badge/Manifest-V3-blue" alt="Manifest V3"></a>
  <p align="center">
    <img src="images/store-promo-440x280.png" width="440" alt="ZZZ 디스크 페어리 홍보 이미지">
</p>
  <p>젠레스 존 제로(ZZZ) 에이전트가 장착한 디스크를 평가해 주는 크롬 확장 프로그램입니다.</p>
</div>

## 무엇을 알려주나요?

HoYoLAB 전적 페이지에서 에이전트를 클릭하면, 화면 오른쪽에 평가 패널이 나타납니다.  
패널에서는 아래 내용을 확인할 수 있습니다.

- 디스크 6개에 각각 매긴 점수 (우수 / 양호 / 보통 / 교체 후보)
- 주옵션이 권장 옵션과 일치하는지 여부
- 권장하는 2세트·4세트와 현재 장착한 세트의 비교
- 장착한 W-엔진이 시트 권장 엔진인지, 몇 순위인지, 교체를 고려해야 하는지
- 목표 스탯(치명타, 관통 등)에 도달하려면 얼마나 더 필요한지
- 스킬 레벨이 시트 권장 레벨에 도달했는지, 다음에 어떤 스킬을 올리면 되는지

평가 기준은 [ZZZ 세팅 시트](https://docs.google.com/spreadsheets/d/1C3ZpKCTQJXFwUBgZKZRdLOvGqDGlVijb/edit?gid=2007866856#gid=2007866856)를 따르며, 시트 제작자에게 허락을 받아 사용하고 있습니다.

<p align="center">
  <img src="images/panel-screenshot.png" width="800" alt="HoYoLAB 전적 페이지 오른쪽에 디스크 평가 패널이 열린 화면">
</p>

## 설치 방법

크롬 웹 스토어 등록은 아직 준비 중입니다. 지금은 압축 파일을 내려받아 직접 설치합니다.

1. 이 저장소 페이지에서 **Code → Download ZIP**을 눌러 파일을 내려받고 압축을 풉니다.
2. 크롬 주소창에 `chrome://extensions`를 입력해서 확장 프로그램 관리 페이지를 엽니다.
3. 오른쪽 위의 **개발자 모드**를 켭니다.
4. **압축해제된 확장 프로그램을 로드합니다** 버튼을 누르고, 압축을 푼 폴더 안의 `extension` 폴더를 선택합니다.

이렇게 설치한 확장 프로그램은 자동으로 업데이트되지 않습니다. 새 버전을 쓰려면 ZIP 파일을 다시 내려받아 같은 위치에 덮어쓴 다음, 확장 프로그램 관리 페이지에서 새로고침 버튼을 누릅니다.

## 사용 방법

1. [HoYoLAB 전적 페이지](https://act.hoyolab.com/app/zzz-game-record/)에 접속합니다. 확장 프로그램 아이콘을 누르고 **전적 보러 가기**를 눌러도 됩니다. 페이지가 이미 열려 있었다면 새로고침합니다.
2. 에이전트 목록에서 확인하고 싶은 에이전트를 클릭합니다.
3. 오른쪽에 나타난 패널에서 평가 결과를 확인합니다.

패널 상단에서는 평가 기준이 되는 등급을 바꿀 수 있습니다. 패널 왼쪽 가장자리를 드래그하면 폭을 넓힐 수 있고, 두 번 클릭하면 원래 폭으로 돌아갑니다.

| 등급 | 의미 |
|---|---|
| 응애 | 입문자에게 맞춘 기준 |
| 이잘키 | 일반적인 기준선 |
| 악귀 | 고점을 노리는 기준 |

## 점수는 어떻게 계산하나요?

부옵션이 쓸모 있는 옵션으로 몇 번 강화되었는지를 셉니다.

- 해당 에이전트에게 유효한 부옵션이 1회 강화되면 1점을 줍니다.
- 후순위 부옵션이나 깡 공격력/체력/방어력이 1회 강화되면 0.5점을 줍니다.
- 합계가 **6점 이상이면 우수**, 4점 이상이면 양호, 2.5점 이상이면 보통으로 표시하고, 그보다 낮으면 교체 후보로 표시합니다.

## 개인정보와 안전성

이 확장 프로그램은 HoYoLAB 서버에 별도의 요청을 보내지 않습니다. 전적 페이지가 원래 불러오는 데이터를 그대로 읽어서 평가하며, 어떤 정보도 외부로 전송하지 않습니다.


---

### 파일 구성

```
extension/                 크롬 확장 (이 폴더를 그대로 zip해서 배포)
├── manifest.json
├── inject.js              페이지가 받아오는 avatar/info 응답을 복사해서 content.js에 전달
├── content.js             평가를 실행하고 오른쪽 패널을 그림 (Shadow DOM)
├── evaluator.js           평가 엔진 (주옵·세트·W-엔진 판정, 유효 강화 횟수, 목표 스탯)
├── popup.html, popup.js   툴바 아이콘 팝업 (전적 페이지 열기)
├── icons/                 확장 아이콘 (16/32/48/128px)
└── data/                  자동 생성 데이터 (직접 수정하지 않음)
    ├── benchmark.js       시트 기준 데이터 (tools/convert.py로 생성)
    ├── suit-icons.js      디스크 세트 이름 → 이미지 URL (HoYoWiki)
    └── engine-icons.js    W-엔진 이름 → 이미지 URL (HoYoWiki)
images/                    README용 이미지
├── fairy-128.png          페어리 아이콘 (128px)
├── panel-screenshot.png   전적 페이지에 패널이 열린 화면
└── store-promo-440x280.png  웹 스토어 홍보 이미지
tools/convert.py           시트(xlsx) → extension/data/benchmark.js 변환
test/
├── run.js                 테스트 (배포 전에 CI에서 실행)
├── names.js               API 이름 ↔ 시트 이름 매칭 확인
├── audit.js, sweep.js     시트 전체 파싱·평가 점검 (결과 출력용)
└── fixture-avatar-vellina.json  테스트용 avatar/info 응답
```
