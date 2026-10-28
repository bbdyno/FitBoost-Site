# FitBoost-Site

FitBoost 앱 소개 사이트입니다. GitHub Pages가 `docs/`를 그대로 내보냅니다.
https://bbdyno.github.io/FitBoost-Site/

## 고치는 법

`docs/`의 HTML은 손으로 고치지 않고 `src/`에서 만듭니다.

- `src/i18n/<언어>.json` 소개 페이지 문구 (ko, en, ja, zh-hans, zh-hant)
- `src/templates/index.html` 소개 페이지 틀
- `src/templates/doc.html` 개인정보·약관·지원 페이지 틀
- `src/pages/<언어>/` 개인정보·약관·지원 본문과 제목
- `docs/assets/site.css`, `docs/assets/site.js` 스타일과 움직임 (직접 고침)

고친 뒤 다시 만듭니다.

```
python3 tools/build.py
```

한국어는 `docs/` 바로 아래, 나머지 언어는 `docs/<언어>/` 아래에 생깁니다.
스토어와 구글 동의 화면이 `privacy.html`, `terms.html`, `support.html` 한국어
주소를 걸고 있으니 한국어 자리는 옮기지 않습니다. `docs/go.html`(공유 링크)과
`docs/course.html`(앱이 보내는 코스 링크)은 빌드와 상관없는 손으로 쓴 파일입니다.
코스 링크는 앱이 한 주소로만 만들므로 `course.html` 한 장이 다섯 언어 문구를 품고,
사이트 첫 화면과 같은 규칙(저장한 언어, 그다음 브라우저 언어)으로 고릅니다. 코스는 주소의
`#` 뒤에만 실리고 이 페이지는 그것을 어디에도 보내지 않으니, 분석·광고 스크립트를 넣지 않습니다.

공유 미리보기 그림 `docs/assets/og.png`는 `src/og.html`을 크롬으로 찍어 만듭니다.
명령은 그 파일 머리에 있습니다.

## 사용 가이드

`docs/guide/`(언어별 `docs/<언어>/guide/`)의 사용 가이드와 물어보기 검색도 같은
빌드로 만듭니다. 쓰는 규칙은 `tools/guide.py` 머리에 있습니다.

- `src/guide/<언어>/meta.json` 주제 순서·제목·설명과 첫 화면의 자주 찾는 것
- `src/guide/<언어>/<주제>.html` 주제 본문. 섹션 하나가 검색 항목 하나입니다.
- `src/guide/<언어>/queries.json` 검색 시험. 질의마다 기대한 섹션이 1위여야 합니다.
- `src/templates/guide.html` 가이드 틀, `docs/assets/guide.js` 검색과 물어보기 (직접 고침)

메뉴·버튼 이름은 `{{> tabMenu > setAppSettings}}`처럼 앱 문구 키로 적고, 빌드가 옆 폴더의
앱 저장소(`../FitBoost/lib/l10n/`) 문구로 바꿔 넣습니다. 앱 저장소가 다른 곳에 있으면
`FITBOOST_APP=경로`로 알려 줍니다. 앱에서 메뉴 이름을 바꿨으면 이 빌드를 다시 돌려
가이드에도 반영합니다. 키가 없어졌거나, 언어끼리 주제·섹션 구성이 다르거나, 다른 언어
본문에 한국어가 남았거나, 검색 시험이 어긋나면 빌드가 멈춥니다. 검색 시험에는 `node`가
필요합니다.
