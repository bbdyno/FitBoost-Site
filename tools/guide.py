"""사용 가이드를 만든다. tools/build.py가 부른다.

원본은 src/guide/<언어>/ 아래에 있다.

- meta.json: 주제 순서·제목·설명과 첫 화면의 '자주 찾는 것'
- <주제>.html: 주제 본문. <section id data-ask data-keys>마다 검색 항목 하나가 된다.
  data-ask는 사용자가 물을 법한 문장을 |로 나눠 적고, data-keys는 비슷한 말을 적는다.
  섹션 첫 <p class="lead">는 검색 답 카드의 요약, <ol class="steps">는 단계가 된다.
- queries.json: 검색 시험. {"질의": "주제#섹션"}이고, 그 섹션이 1위로 나와야 한다.
  가이드에 없는 일은 {"질의": null}로 적고, 답이 나오지 않아야 한다.

메뉴·버튼 이름은 손으로 쓰지 않고 {{> tabMenu > setAppSettings > cloudSyncTitle}}처럼
앱 문구 키로 적는다. 앱이 띄우는 안내 문장은 {{" watchNotPaired}}로 인용한다. 빌드가 앱 저장소(옆 폴더 ../FitBoost)의 언어별 문구로 바꿔 넣으니
앱에서 이름을 바꾸면 다시 빌드할 때 따라 바뀌고, 키가 없어지면 빌드가 멈춘다.
"""

import html
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src/guide"
APP = Path(os.environ.get("FITBOOST_APP", ROOT.parent / "FitBoost"))

# 사이트 언어 → 앱 문구 파일(없는 키는 뒤 파일에서 찾는다. 플러터와 같은 순서)
ARB = {
    "ko": ["app_ko"],
    "en": ["app_en"],
    "ja": ["app_ja"],
    "zh-hans": ["app_zh_Hans", "app_zh"],
    "zh-hant": ["app_zh_Hant", "app_zh"],
}

UI = re.compile(r'\{\{([>"])\s*(.+?)\s*\}\}')
SECTION = re.compile(r"<section\b([^>]*)>(.*?)</section>", re.S)
ATTR = re.compile(r'([\w-]+)="([^"]*)"')
HANGUL = re.compile(r"[ᄀ-ᇿ㄰-㆏가-힯]")
LINK = re.compile(r'href="([^"]*)"')


class GuideError(SystemExit):
    pass


def fail(where, msg):
    raise GuideError(f"가이드 {where}: {msg}")


def load_strings(code):
    strings = {}
    for name in reversed(ARB[code]):
        path = APP / f"lib/l10n/{name}.arb"
        if not path.exists():
            fail(code, f"앱 문구 파일이 없다 — {path}")
        strings.update({k: v for k, v in json.loads(path.read_text()).items() if not k.startswith("@")})
    return strings


def app_text(strings, key, where):
    if key not in strings:
        fail(where, f"앱 문구 키가 없다 — {key}")
    value = strings[key]
    if "{" in value or "\n" in value:
        fail(where, f"자리표시나 줄바꿈이 있는 문구는 그대로 옮길 수 없다 — {key}")
    return html.escape(value)


def fill_ui(text, strings, where):
    def sub(m):
        keys = [k.strip() for k in m.group(2).split(">")]
        if m.group(1) == '"':
            if len(keys) != 1:
                fail(where, f"인용은 키 하나만 — {m.group(0)}")
            return f'<q class="say">{app_text(strings, keys[0], where)}</q>'
        parts = [f"<b>{app_text(strings, k, where)}</b>" for k in keys]
        return '<span class="ui">' + " → ".join(parts) + "</span>"

    return UI.sub(sub, text)


INLINE = re.compile(r"</?(?:b|span|q|a|strong|em|small)\b[^>]*>")


def plain(fragment):
    # 글줄 안의 태그는 그냥 걷어 내야 "만들기</b>로"가 "만들기 로"로 띄어지지 않는다.
    text = re.sub(r"<[^>]+>", " ", INLINE.sub("", fragment))
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def bold_only(fragment):
    """답 카드에 넣을 요약과 단계: 메뉴 이름(<b>)과 앱 문구 인용(<q>)만 남기고 다른 태그는 걷어 낸다."""
    kept = re.sub(r"<(?!/?b>|q class=\"say\">|/q>)[^>]+>", "", fragment)
    return re.sub(r"\s+", " ", kept).strip()


def first(pattern, text):
    m = re.search(pattern, text, re.S)
    return m.group(1) if m else None


def parse_topic(code, slug, raw, strings):
    where = f"{code}/{slug}"
    body = fill_ui(raw, strings, where)
    sections = []

    def take(m):
        attrs = dict(ATTR.findall(m.group(1)))
        inner = m.group(2)
        sid = attrs.get("id")
        if not sid:
            fail(where, "id 없는 섹션이 있다")
        title = first(r"<h2[^>]*>(.*?)</h2>", inner)
        lead = first(r'<p class="lead">(.*?)</p>', inner)
        steps = first(r'<ol class="steps">(.*?)</ol>', inner)
        ask = [q.strip() for q in attrs.get("data-ask", "").split("|") if q.strip()]
        if not title or not lead:
            fail(f"{where}#{sid}", "섹션에 <h2>와 <p class=\"lead\">가 있어야 한다")
        if len(ask) < 2:
            fail(f"{where}#{sid}", "data-ask에 질문을 두 개 넘게 적는다")
        sections.append({
            "id": sid,
            "title": plain(title),
            "lead": bold_only(lead),
            "steps": [bold_only(li) for li in re.findall(r"<li>(.*?)</li>", steps or "", re.S)],
            "ask": ask,
            "keys": attrs.get("data-keys", ""),
            "text": plain(inner),
        })
        return f'<section class="g-sec" id="{sid}">{inner}</section>'

    return SECTION.sub(take, body).strip(), sections


def load(code, strings):
    meta = json.loads((SRC / code / "meta.json").read_text())
    topics = []
    for t in meta["topics"]:
        raw = (SRC / code / f"{t['slug']}.html").read_text()
        content, sections = parse_topic(code, t["slug"], raw, strings)
        topics.append({**t, "content": content, "sections": sections})
    return meta, topics


def check_same_shape(langs):
    base_code, (base_meta, base_topics) = next(iter(langs.items()))
    shape = [(t["slug"], [s["id"] for s in t["sections"]]) for t in base_topics]
    for code, (meta, topics) in langs.items():
        mine = [(t["slug"], [s["id"] for s in t["sections"]]) for t in topics]
        if mine != shape:
            fail(code, f"주제·섹션 구성이 {base_code}와 다르다")
        if meta["popular"] != base_meta["popular"]:
            fail(code, f"자주 찾는 것이 {base_code}와 다르다")


def check_links(code, topics, popular):
    targets = {f"{t['slug']}.html#{s['id']}" for t in topics for s in t["sections"]}
    pages = {f"{t['slug']}.html" for t in topics}
    for ref in popular:
        slug, _, sid = ref.partition("#")
        if f"{slug}.html#{sid}" not in targets:
            fail(code, f"자주 찾는 것의 대상이 없다 — {ref}")
    for t in topics:
        for href in LINK.findall(t["content"]):
            if href.startswith(("http", "mailto:", "../")):
                continue
            full = f"{t['slug']}.html{href}" if href.startswith("#") else href
            if full not in targets and full not in pages:
                fail(f"{code}/{t['slug']}", f"가이드 안 링크 대상이 없다 — {href}")


def check_no_korean(code, where, text):
    if code == "ko":
        return
    found = HANGUL.findall(text)
    if found:
        i = HANGUL.search(text).start()
        fail(f"{code}/{where}", f"한국어가 남았다 — …{text[max(0, i - 30):i + 30]}…")


def search_index(topics):
    titles = {t["slug"]: t["title"] for t in topics}
    items = []
    for t in topics:
        for s in t["sections"]:
            items.append({
                "u": f"{t['slug']}.html#{s['id']}",
                "g": t["slug"],
                "t": s["title"],
                "s": s["lead"],
                "p": s["steps"][:5],
                "q": s["ask"],
                "k": s["keys"],
                "b": s["text"][:600],
            })
    return {"topics": titles, "items": items}


def run_queries(code, index_path):
    tests = SRC / code / "queries.json"
    if not tests.exists():
        fail(code, "검색 시험(queries.json)이 없다")
    node = shutil.which("node")
    if not node:
        print(f"{code}: node가 없어 검색 시험을 건너뛴다")
        return
    out = subprocess.run(
        [node, str(ROOT / "tools/guide_queries.js"), str(index_path), str(tests)],
        capture_output=True, text=True,
    )
    if out.returncode:
        fail(code, "검색 시험 실패\n" + out.stdout + out.stderr)
    print(f"{code}: {out.stdout.strip()}")


def topic_page(t, g, prev, nxt):
    toc = "".join(f'<li><a href="#{s["id"]}">{html.escape(s["title"])}</a></li>' for s in t["sections"])
    pager = []
    if prev:
        pager.append(f'<a class="g-pager__prev" href="{prev["slug"]}.html"><small>{g["prev"]}</small>{html.escape(prev["title"])}</a>')
    if nxt:
        pager.append(f'<a class="g-pager__next" href="{nxt["slug"]}.html"><small>{g["next"]}</small>{html.escape(nxt["title"])}</a>')
    return f"""<nav class="g-crumb" aria-label="{g['crumbLabel']}"><a href="./">{g['title']}</a></nav>
<h1>{html.escape(t['title'])}</h1>
<p class="g-lede">{html.escape(t['description'])}</p>
{find_box(g, "./", "")}
<nav class="g-toc" aria-label="{g['onThisPage']}"><p>{g['onThisPage']}</p><ol>{toc}</ol></nav>
{t['content']}
<nav class="g-pager" aria-label="{g['pagerLabel']}">{''.join(pager)}</nav>
<p class="g-contact">{g['stillStuck']}</p>"""


def find_box(g, base, extra_class):
    """주제·지원 페이지의 작은 검색창. 고르면 그 섹션으로, 엔터면 가이드 첫 화면 물어보기로 간다."""
    return f"""<form class="g-find{extra_class}" action="{base}" role="search" data-base="{base}">
  <label class="sr" for="g-find-q">{g['findLabel']}</label>
  <input id="g-find-q" name="q" type="search" autocomplete="off" placeholder="{g['findPlaceholder']}"
    role="combobox" aria-expanded="false" aria-controls="g-find-list" aria-autocomplete="list">
  <ul class="g-suggest" id="g-find-list" role="listbox" hidden></ul>
</form>"""


def home_page(topics, popular, g):
    by_ref = {f"{t['slug']}#{s['id']}": s for t in topics for s in t["sections"]}
    chips = "".join(
        f'<a class="chip" href="{ref.replace("#", ".html#")}" data-go="{ref.replace("#", ".html#")}">{html.escape(by_ref[ref]["title"])}</a>'
        for ref in popular
    )
    cards = "".join(
        f'<li><a href="{t["slug"]}.html"><b>{html.escape(t["title"])}</b>'
        f'<span>{html.escape(t["description"])}</span>'
        f'<small>{" · ".join(html.escape(s["title"]) for s in t["sections"][:3])}</small></a></li>'
        for t in topics
    )
    words = json.dumps({k: g[k] for k in ("you", "more", "also", "which", "none", "mail", "failed", "send")}, ensure_ascii=False)
    return f"""<h1>{g['title']}</h1>
<p class="g-lede">{g['intro']}</p>
<section class="ask" aria-label="{g['askLabel']}" data-index="search.json">
  <div class="ask__log" aria-live="polite">
    <div class="msg msg--bot"><p>{g['hello']}</p></div>
    <div class="msg msg--bot msg--chips"><p>{g['popular']}</p><div class="chips">{chips}</div></div>
  </div>
  <form class="ask__form" role="search">
    <label class="sr" for="ask-q">{g['askLabel']}</label>
    <input id="ask-q" name="q" type="search" autocomplete="off" enterkeyhint="send" placeholder="{g['placeholder']}"
      role="combobox" aria-expanded="false" aria-controls="ask-list" aria-autocomplete="list">
    <button type="submit" aria-label="{g['send']}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg></button>
    <ul class="g-suggest" id="ask-list" role="listbox" hidden></ul>
  </form>
  <script type="application/json" class="ask__words">{words}</script>
</section>
<h2 class="g-h2">{g['topicsTitle']}</h2>
<ul class="g-topics">{cards}</ul>
<p class="g-contact">{g['stillStuck']}</p>"""


def build(langs_conf, render, tpl, write_page):
    """langs_conf: [(code, prefix, base_ctx_fn)] — build.py가 넘긴다."""
    langs = {}
    for code, *_ in langs_conf:
        strings = load_strings(code)
        langs[code] = load(code, strings)
    check_same_shape(langs)

    for code, prefix, make_ctx in langs_conf:
        meta, topics = langs[code]
        check_links(code, topics, meta["popular"])
        ctx0 = make_ctx("guide/index")
        g = ctx0["guide"]
        out = ROOT / "docs" / prefix / "guide"
        out.mkdir(parents=True, exist_ok=True)

        index = search_index(topics)
        index_text = json.dumps(index, ensure_ascii=False, separators=(",", ":"))
        check_no_korean(code, "search.json", index_text)
        (out / "search.json").write_text(index_text)

        pages = [("index", g["title"], g["description"], home_page(topics, meta["popular"], g))]
        for i, t in enumerate(topics):
            prev = topics[i - 1] if i else None
            nxt = topics[i + 1] if i + 1 < len(topics) else None
            pages.append((t["slug"], t["title"], t["description"], topic_page(t, g, prev, nxt)))

        for slug, title, description, content in pages:
            check_no_korean(code, slug, content)
            ctx = make_ctx(f"guide/{slug}")
            ctx.update({"docTitle": title, "docDescription": description, "content": content})
            write_page(out / f"{slug}.html", render(tpl, ctx, f"{code}/guide/{slug}"))

        run_queries(code, out / "search.json")
