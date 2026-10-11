# ZZZ 디스크 어드바이저

HoYoLAB 전적 페이지(act.hoyolab.com/app/zzz-game-record)에서 에이전트 상세를 열면,
페이지가 원래 받아오는 `avatar/info` 응답을 가로채 장착 디스크를 세팅 시트 기준으로 평가합니다.
확장이 직접 API를 추가 호출하지 않습니다.

## 구조
- `extension/inject.js` 페이지 컨텍스트에서 fetch/XHR 응답 복사 → postMessage
- `extension/content.js` 평가 실행, 오른쪽 패널(Shadow DOM) 렌더링
- `extension/evaluator.js` 평가 엔진 (주옵 판정, 세트 판정, 유효 강화 횟수, 등급별 목표 스탯)
- `extension/benchmark.js` 시트에서 자동 생성된 기준 데이터
- `extension/suit-icons.js` 세트명 → 원형 디스크 이미지 URL 30종 (HoYoWiki 디스크 문서의 '위치' 이미지)
- `tools/convert.py` xlsx → benchmark.js 변환
- `test/run.js` 엔진 테스트 (`node test/run.js`)

## 설치
1. chrome://extensions → 개발자 모드 ON → "압축해제된 확장 프로그램을 로드합니다" → `extension` 폴더 선택
2. 전적 페이지를 새로고침하고 에이전트를 클릭

## 시트 갱신
```
python3 tools/convert.py data/sheet.xlsx extension/benchmark.js
```
그 뒤 chrome://extensions에서 새로고침.

## 평가 규칙 (MVP)
- 기준 탭: 응애(입문) / 세팅=이잘키(기준선) / 악귀(고점)
- 주옵·부옵 기준은 이잘키 탭(없으면 응애)
- 디스크 점수 = Σ(가중치 × 해당 부옵 강화 횟수). 유효 부옵 1.0, (후순위) 0.5, 깡 공/체/방 0.5
- 6 이상 우수 / 4 이상 양호 / 2.5 이상 보통 / 그 미만 교체 후보
- 목표 스탯의 "(5번 주옵 공퍼)" 같은 조건은 실제 장착 주옵을 보고 적용

시트 출처: ZZZ 세팅 시트 (작성자 허락 없이 공개 배포하지 말 것)
