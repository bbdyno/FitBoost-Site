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
주소를 걸고 있으니 한국어 자리는 옮기지 않습니다. `docs/go.html`(공유 링크)은
빌드와 상관없는 손으로 쓴 파일입니다.

공유 미리보기 그림 `docs/assets/og.png`는 `src/og.html`을 크롬으로 찍어 만듭니다.
명령은 그 파일 머리에 있습니다.
