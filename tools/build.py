#!/usr/bin/env python3
"""src/의 템플릿과 언어별 문구로 docs/의 정적 페이지를 만든다.

한국어는 docs/ 바로 아래에, 나머지 언어는 docs/<언어>/ 아래에 쓴다.
스토어와 구글 동의 화면이 docs/privacy.html 같은 한국어 주소를 걸고 있어서
한국어 자리는 옮기지 않는다.

    python3 tools/build.py          # 모든 언어
    python3 tools/build.py ko en    # 고른 언어만
"""

import html
import json
import re
import sys
from pathlib import Path

import guide

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
OUT = ROOT / "docs"
SITE_URL = "https://bbdyno.github.io/FitBoost-Site/"

# (코드, html lang, docs/ 아래 경로, og:locale, 애플 배지, 구글 배지, 스토어 캠페인)
LANGS = [
    ("ko", "ko", "", "ko_KR", "ko-kr", "ko", "site"),
    ("en", "en", "en/", "en_US", "en-us", "en", "site-en"),
    ("ja", "ja", "ja/", "ja_JP", "ja-jp", "ja", "site-ja"),
    ("zh-hans", "zh-Hans", "zh-hans/", "zh_CN", "zh-cn", "zh-cn", "site-zh-hans"),
    ("zh-hant", "zh-Hant", "zh-hant/", "zh_TW", "zh-tw", "zh-tw", "site-zh-hant"),
]
LANG_NAMES = {
    "ko": "한국어",
    "en": "English",
    "ja": "日本語",
    "zh-hans": "简体中文",
    "zh-hant": "繁體中文",
}
PAGES = ["privacy", "terms", "support", "location-terms"]

APP_STORE = "https://apps.apple.com/app/apple-store/id6805938033?pt=118731534&ct={ct}&mt=8"
PLAY = (
    "https://play.google.com/store/apps/details?id=com.bbdyno.app.fitboost"
    "&referrer=utm_source%3D{ct}%26utm_medium%3Dreferral%26utm_campaign%3Dsite"
)

# 운동 사전 섹션에 보여 줄 그림. 6칸 두 줄이다.
LIB_CELLS = ["004312", "fn-burpee-box-jump", "002512", "054912", "fn-kb-american-swing", "106012",
             "003212", "fn-db-farmers-carry", "353312", "fn-bear-crawl", "160512", "fn-hollow-rock"]

TOKEN = re.compile(r"\{\{\s*([\w.]+)\s*\}\}")


def lookup(ctx, key):
    node = ctx
    for part in key.split("."):
        if not isinstance(node, dict) or part not in node:
            raise KeyError(key)
        node = node[part]
    return node


def render(template, ctx, where):
    def sub(m):
        try:
            value = lookup(ctx, m.group(1))
        except KeyError:
            raise SystemExit(f"{where}: 문구가 없다 — {m.group(1)}")
        if isinstance(value, list):
            return "".join(f"<li>{item}</li>" for item in value)
        return str(value)

    # 문구 안에 또 {{root}} 같은 자리표시가 있을 수 있어 두 번 돈다.
    return TOKEN.sub(sub, TOKEN.sub(sub, template))


def tail(page):
    """페이지 이름을 주소 꼬리로. index는 폴더 주소(guide/index → guide/)로 쓴다."""
    if page == "index":
        return ""
    if page.endswith("/index"):
        return page[: -len("index")]
    return f"{page}.html"


def page_href(root, prefix, page):
    return f"{root}{prefix}{tail(page)}" or "./"


def alternates(page):
    lines = [
        f'<link rel="alternate" hreflang="{hl}" href="{SITE_URL}{prefix}{tail(page)}">'
        for _, hl, prefix, *_ in LANGS
    ]
    lines.append(f'<link rel="alternate" hreflang="x-default" href="{SITE_URL}{tail(page)}">')
    return "\n".join(lines)


def nav(t, code, root, page, up=""):
    """up은 그 언어 첫 화면까지의 상대 경로다. 가이드처럼 한 단계 아래 폴더면 "../"."""
    here = up or ("./" if page != "index" else "")
    langs = "".join(
        f'<li><a href="{page_href(root, prefix, page)}" data-lang="{c}" lang="{hl}"'
        f'{" aria-current=\"true\"" if c == code else ""}>{LANG_NAMES[c]}</a></li>'
        for c, hl, prefix, *_ in LANGS
    )
    return f"""<header class="nav">
  <div class="wrap nav__in">
    <a class="brand" href="{up or './'}" aria-label="FitBoost">
      <img src="{root}assets/icon.webp" alt="" width="30" height="30">
      <span>FitBoost</span>
    </a>
    <nav class="nav__links" aria-label="{t['nav']['label']}">
      <a href="{here}#features">{t['nav']['features']}</a>
      <a href="{here}#pricing">{t['nav']['pricing']}</a>
      <a href="{up}guide/"{' aria-current="page"' if page.startswith('guide/') else ''}>{t['nav']['guide']}</a>
      <a href="{up}support.html">{t['nav']['support']}</a>
    </nav>
    <details class="langs">
      <summary aria-label="{t['nav']['language']}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z"/></svg><span>{LANG_NAMES[code]}</span></summary>
      <ul>{langs}</ul>
    </details>
    <a class="nav__cta" href="{here}#download">{t['nav']['download']}</a>
  </div>
</header>"""


def footer(t, root, up=""):
    return f"""<footer class="foot">
  <div class="wrap foot__in">
    <div class="foot__brand">
      <img src="{root}assets/icon.webp" alt="" width="28" height="28">
      <p>{t['footer']['tagline']}</p>
    </div>
    <nav class="foot__links" aria-label="{t['footer']['label']}">
      <a href="{up}guide/">{t['nav']['guide']}</a>
      <a href="{up}support.html">{t['nav']['support']}</a>
      <a href="{up}privacy.html">{t['footer']['privacy']}</a>
      <a href="{up}terms.html">{t['footer']['terms']}</a>
      <a href="mailto:della.kimko@gmail.com">della.kimko@gmail.com</a>
    </nav>
    <p class="foot__copy">© 2026 FitBoost</p>
  </div>
</footer>"""


def stores(t, apple, google, ct):
    return (
        f'<a class="store store--apple" href="{html.escape(APP_STORE.format(ct=ct))}">'
        f'<img src="https://toolbox.marketingtools.apple.com/api/v2/badges/download-on-the-app-store/black/{apple}"'
        f' alt="{t["stores"]["apple"]}" height="48"></a>'
        f'<a class="store store--google" href="{html.escape(PLAY.format(ct=ct))}">'
        f'<img src="https://play.google.com/intl/en_us/badges/static/images/badges/{google}_badge_web_generic.png"'
        f' alt="{t["stores"]["google"]}" height="70"></a>'
    )


def cells(root, keys):
    return "".join(
        f'<span class="cell"><img src="{root}assets/ex/{k}.webp" alt="" width="640" height="360" loading="lazy"></span>'
        for k in keys
    )


REDIRECT = """<script>
(function () {
  if (/bot|crawl|spider|slurp|facebookexternalhit/i.test(navigator.userAgent)) return;
  var saved = null;
  try { saved = localStorage.getItem('fb-lang'); } catch (e) {}
  var dirs = {en: 'en/', ja: 'ja/', 'zh-hans': 'zh-hans/', 'zh-hant': 'zh-hant/'};
  if (saved) { if (dirs[saved]) location.replace(dirs[saved] + location.hash); return; }
  var l = ((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase();
  if (!l || l.indexOf('ko') === 0) return;
  var to = l.indexOf('ja') === 0 ? 'ja' :
    l.indexOf('zh') === 0 ? (/hant|tw|hk|mo/.test(l) ? 'zh-hant' : 'zh-hans') : 'en';
  location.replace(dirs[to] + location.hash);
})();
</script>"""


def main():
    index_tpl = (SRC / "templates/index.html").read_text()
    doc_tpl = (SRC / "templates/doc.html").read_text()
    guide_tpl = (SRC / "templates/guide.html").read_text()

    only = set(sys.argv[1:])
    guide_langs = []
    for code, hl, prefix, og, apple, google, ct in LANGS:
        if only and code not in only:
            continue
        t = json.loads((SRC / f"i18n/{code}.json").read_text())
        root = "../" if prefix else ""
        out_dir = OUT / prefix
        out_dir.mkdir(parents=True, exist_ok=True)
        base = {
            **t,
            "lang": code,
            "htmlLang": hl,
            "root": root,
            "siteUrl": SITE_URL,
            "ogLocale": og,
            "stores": stores(t, apple, google, ct),
        }

        ctx = {
            **base,
            "path": prefix,
            "alternates": alternates("index"),
            "redirect": REDIRECT if code == "ko" else "",
            "nav": nav(t, code, root, "index"),
            "footer": footer(t, root),
            "cells": cells(root, LIB_CELLS),
        }
        (out_dir / "index.html").write_text(render(index_tpl, ctx, f"{code}/index"))

        meta_file = SRC / f"pages/{code}/meta.json"
        if not meta_file.exists():
            print(f"{code}: 문서 페이지가 아직 없어 건너뛴다")
            continue
        meta = json.loads(meta_file.read_text())
        for page in PAGES:
            content = (SRC / f"pages/{code}/{page}.html").read_text().strip()
            ctx = {
                **base,
                "path": f"{prefix}{page}.html",
                "alternates": alternates(page),
                "nav": nav(t, code, root, page),
                "footer": footer(t, root),
                "docTitle": meta[page]["title"],
                "docDescription": meta[page]["description"],
                "content": content,
                "guideFind": guide.find_box(t["guide"], "guide/", " g-find--wide"),
            }
            (out_dir / f"{page}.html").write_text(render(doc_tpl, ctx, f"{code}/{page}"))

        def guide_ctx(page, base=base, t=t, code=code, prefix=prefix):
            root = "../../" if prefix else "../"
            return {
                **base,
                "root": root,
                "path": f"{prefix}{tail(page)}",
                "alternates": alternates(page),
                "nav": nav(t, code, root, page, "../"),
                "footer": footer(t, root, "../"),
            }

        guide_langs.append((code, prefix, guide_ctx))
        print(f"{code}: {out_dir.relative_to(ROOT)}")

    # 가이드는 언어끼리 주제·섹션 구성을 맞대 보므로 모든 언어를 한꺼번에 만든다.
    if not only:
        guide.build(guide_langs, render, guide_tpl, lambda path, text: path.write_text(text))
    else:
        print("가이드: 언어를 골라 빌드하면 건너뛴다(구성 대조에 모든 언어가 필요하다)")


if __name__ == "__main__":
    main()
