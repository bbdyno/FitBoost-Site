/* 사용 가이드 검색과 물어보기.
   색인(guide/search.json)의 항목마다 질문·제목·비슷한 말·요약·단계·본문을 토막으로 나눠 두고,
   입력도 같은 방식으로 나눠 겹치는 정도로 순위를 매긴다.
   한중일 글자는 두 글자씩 끊는다. 조사·어미가 붙어도("동기화가") 앞 토막이 맞기 때문이다.
   라틴 글자는 낱말 단위로 끝의 s·ing·ed를 떼고 맞추고, 치는 중인 마지막 낱말은 앞부분만 맞아도 된다.
   여러 항목에 흔한 토막("해요", "how")은 덜 친다.
   node에서도 불러(tools/guide_queries.js) 빌드 때 검색 시험을 돌린다. */
(function () {
  'use strict';

  var CJK = 'ᄀ-ᇿ぀-ヿ㄰-㆏ㇰ-ㇿ㐀-䶿一-鿿가-힯豈-﫿';
  var RUN = new RegExp('[' + CJK + ']+(?:\\s+[' + CJK + ']+)*|[a-z0-9à-ɏ]+', 'g');
  var IS_CJK = new RegExp('^[' + CJK + ']');
  var LAST_WORD = /[a-z0-9à-ɏ]+$/;
  /* 질문에 맞으면 가장 세게, 본문에만 있으면 가장 약하게 친다. */
  var FIELDS = [['q', 3], ['t', 3.2], ['k', 2.5], ['s', 1.5], ['p', 1], ['b', 0.6]];
  var MIN_COVER = 0.35;
  var MIN_SCORE = 0.55;
  /* 띄어 쓴 낱말 사이에 걸친 토막은 붙여 쓴 입력을 받아 주려는 것이라 약하게 친다. */
  var JOINT = 0.3;
  /* 색인에 없는 토막도 조금은 맞히지 못한 몫으로 센다. 띄어 쓰지 않는 일본어·중국어에서
     "友達を追加"의 "追加"만 맞는 항목이 답으로 나서지 않게 한다. */
  var MISS = 0.35;
  /* 이보다 낮으면 답을 단정하지 않고 후보로만 보여 준다. */
  var CONFIDENT = 1.5;
  /* 일본어 조사가 붙은 토막("を追")은 뜻이 거의 없어 붙여 쓴 토막처럼 약하게 친다. */
  var PARTICLE = /[をがはにでのともへやか]/;
  /* 가나가 섞인 입력(일본어)에서 한자·가타카나로만 된 토막은 내용어다("友達").
     색인에 없으면 모르는 낱말로 보고 온전히 센다. */
  var KANA = /[\u3040-\u30ff]/;
  var CONTENT = /^[\u30a0-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+$/;

  function norm(s) { return String(s).normalize('NFKC').toLowerCase(); }
  function squash(s) { return norm(s).replace(/[\s\p{P}\p{S}]+/gu, ''); }
  function strip(s) { return String(s).replace(/<[^>]+>/g, ' '); }

  function stem(w) {
    if (w.length <= 3) return w;
    if (/ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (/ing$/.test(w) && w.length > 5) return w.slice(0, -3);
    if (/ed$/.test(w) && w.length > 4) return w.slice(0, -2);
    if (/[^s]s$/.test(w)) return w.slice(0, -1);
    return w;
  }

  function toks(s, joints) {
    var out = [], plain = {};
    norm(s).replace(RUN, function (run) {
      if (IS_CJK.test(run)) {
        /* 띄어 쓴 낱말마다 두 글자씩, 한 글자 낱말("뜻")은 그대로, 낱말 사이도 한 토막 더.
           "기기 간 동기화"를 "기기간동기화"로 붙여 써도 대부분 맞는다. */
        var parts = run.split(/\s+/);
        parts.forEach(function (w, j) {
          if (w.length === 1) { out.push(w); plain[w] = 1; }
          for (var i = 0; i + 1 < w.length; i++) {
            var bi = w.substr(i, 2);
            out.push(bi);
            if (joints && PARTICLE.test(bi)) joints[bi] = 1;
            else plain[bi] = 1;
          }
          if (j) {
            var joint = parts[j - 1].slice(-1) + w[0];
            out.push(joint);
            if (joints) joints[joint] = 1;
          }
        });
      } else {
        out.push(stem(run));
        plain[stem(run)] = 1;
      }
      return '';
    });
    if (joints) for (var t in joints) if (plain[t]) delete joints[t];
    return out;
  }

  function prepare(data) {
    var df = {};
    var items = data.items.map(function (it) {
      var f = {}, all = {};
      FIELDS.forEach(function (fw) {
        var set = {};
        [].concat(it[fw[0]] || []).forEach(function (v) {
          toks(strip(v)).forEach(function (t) { set[t] = 1; all[t] = 1; });
        });
        f[fw[0]] = set;
      });
      for (var t in all) df[t] = (df[t] || 0) + 1;
      return { it: it, f: f, qs: [].concat(it.q || []).map(squash) };
    });
    return { items: items, df: df, n: items.length, words: Object.keys(df), topics: data.topics };
  }

  function idf(ix, t) { return Math.log(1 + ix.n / ix.df[t]); }

  /* 질문 문장과 거의 같게 쳤으면 덤을 준다. 짧은 쪽이 긴 쪽의 7할이 넘어야 같다고 본다. */
  function sameQuestion(a, b) {
    if (a.length < 2 || b.length < 2) return false;
    var short = a.length < b.length ? a : b, long = short === a ? b : a;
    return long.indexOf(short) >= 0 && short.length >= long.length * 0.7;
  }

  function rank(ix, query, typing) {
    var joints = {}, seen = {};
    var qt = toks(query, joints).filter(function (t) { return !seen[t] && (seen[t] = 1); });
    var lastRaw = typing ? (norm(query).match(LAST_WORD) || [''])[0] : '';
    var terms = [];
    var missed = 0, maxW = Math.log(1 + ix.n), kana = KANA.test(query);
    qt.forEach(function (t, i) {
      var alts = ix.df[t] ? [t] : [];
      if (!alts.length && lastRaw.length >= 2 && i === qt.length - 1) {
        alts = ix.words.filter(function (w) { return w.indexOf(lastRaw) === 0; }).slice(0, 8);
      }
      if (!alts.length) {
        if (!joints[t] && IS_CJK.test(t)) missed += maxW * (kana && CONTENT.test(t) ? 1 : MISS);
        return;
      }
      var w = Math.max.apply(null, alts.map(function (a) { return idf(ix, a); }));
      terms.push({ alts: alts, w: joints[t] ? w * JOINT : w });
    });
    if (!terms.length) return [];
    /* 색인에 한 토막도 없는 낱말("친구")은 가이드가 모르는 말이다. 맞힐 수 없는 몫으로
       분모에 넣어, 나머지 낱말("추가")만 맞는 항목이 답으로 나서지 않게 한다.
       띄어쓰기가 낱말 경계인 한국어와 라틴 글자에만 쓴다. 중국어·일본어는 위의 토막 몫으로 센다. */
    var unknown = 0;
    var words = norm(query).split(/\s+/).filter(Boolean);
    words.forEach(function (word, i) {
      if (typing && i === words.length - 1) return;
      if (!/^[a-z0-9\u00e0-\u024f\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]+$/.test(word)) return;
      var ts = toks(word);
      if (ts.length && !ts.some(function (t) { return ix.df[t]; })) unknown += maxW;
    });
    var total = terms.reduce(function (s, t) { return s + t.w; }, 0) + Math.max(unknown, missed);
    var sq = squash(query);

    return ix.items.map(function (x) {
      var got = 0, cover = 0;
      terms.forEach(function (term) {
        var best = 0;
        FIELDS.forEach(function (fw) {
          if (fw[1] <= best) return;
          for (var i = 0; i < term.alts.length; i++) if (x.f[fw[0]][term.alts[i]]) { best = fw[1]; return; }
        });
        got += best * term.w;
        if (best) cover += term.w;
      });
      var c = cover / total;
      var score = (got / total) * (0.4 + 0.6 * c);
      if (x.qs.some(function (q) { return sameQuestion(q, sq); })) score += 1;
      return { item: x.it, score: score, cover: c };
    }).filter(function (r) {
      return r.cover >= MIN_COVER && r.score >= MIN_SCORE;
    }).sort(function (a, b) { return b.score - a.score; });
  }

  var api = { toks: toks, prepare: prepare, rank: rank, CONFIDENT: CONFIDENT };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }

  /* ── 여기부터 브라우저 ─────────────────────────────── */

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var cache = {};

  function load(url) {
    if (!cache[url]) {
      cache[url] = fetch(url).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      }).then(prepare);
      cache[url].catch(function () { delete cache[url]; });
    }
    return cache[url];
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* 입력 밑에 뜨는 제안 목록. 위아래 화살표로 고르고 엔터로 연다. */
  function suggester(input, list, ix, base, onPick) {
    var hits = [], at = -1;
    function close() {
      list.hidden = true; list.textContent = ''; hits = []; at = -1;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }
    function mark() {
      $$('li', list).forEach(function (li, i) { li.setAttribute('aria-selected', i === at ? 'true' : 'false'); });
      if (at >= 0) input.setAttribute('aria-activedescendant', list.id + '-' + at);
      else input.removeAttribute('aria-activedescendant');
    }
    function update() {
      var q = input.value.trim();
      if (!q || !ix()) { close(); return; }
      hits = rank(ix(), q, true).slice(0, 5);
      list.textContent = '';
      at = -1;
      if (!hits.length) { close(); return; }
      hits.forEach(function (h, i) {
        var li = el('li');
        li.id = list.id + '-' + i;
        li.setAttribute('role', 'option');
        var a = el('a');
        a.href = base + h.item.u;
        a.appendChild(el('b', '', h.item.t));
        a.appendChild(el('small', '', ix().topics[h.item.g]));
        a.addEventListener('mousedown', function (e) { e.preventDefault(); });
        a.addEventListener('click', function (e) { if (onPick) { e.preventDefault(); onPick(h.item); close(); } });
        li.appendChild(a);
        list.appendChild(li);
      });
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      mark();
    }
    var timer;
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(update, 60); });
    input.addEventListener('blur', function () { setTimeout(close, 120); });
    input.addEventListener('keydown', function (e) {
      if (list.hidden) return;
      if (e.key === 'ArrowDown') { at = (at + 1) % hits.length; mark(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { at = at <= 0 ? hits.length - 1 : at - 1; mark(); e.preventDefault(); }
      else if (e.key === 'Escape') { close(); }
    });
    return {
      picked: function () { return at >= 0 ? hits[at].item : null; },
      close: close,
      refresh: update,
    };
  }

  /* ── 가이드 첫 화면: 물어보기 ─────────────────────── */

  var ask = $('.ask');
  if (ask) {
    var words = JSON.parse($('.ask__words', ask).textContent);
    var log = $('.ask__log', ask);
    var form = $('.ask__form', ask);
    var input = $('input', form);
    var ix = null;
    var ready = load(ask.getAttribute('data-index')).then(function (x) { ix = x; return x; });
    var sugg = suggester(input, $('.g-suggest', form), function () { return ix; }, '', function (item) {
      say(item.t); answer(item, []);
    });
    input.addEventListener('focus', function () { ready.then(sugg.refresh, function () {}); }, { once: true });

    /* 대화창 안에서만 움직인다. 답이 길어도 방금 한 질문부터 보이게 그 말풍선 머리에 맞춘다.
       부드럽게 굴리면 새 글자의 글꼴 조각이 늦게 들어오며 레이아웃이 바뀔 때 멈춰 버려서 바로 옮긴다. */
    var lastAsk = null;
    var scrollEnd = function (node) {
      log.scrollTop = Math.max(0, (lastAsk || node).offsetTop - 8);
    };
    var bot = function () { var m = el('div', 'msg msg--bot'); log.appendChild(m); return m; };
    var say = function (text) {
      var m = el('div', 'msg msg--me');
      m.appendChild(el('span', 'sr', words.you));
      m.appendChild(el('p', '', text));
      log.appendChild(m);
      lastAsk = m;
    };
    var chips = function (msg, items) {
      var box = el('div', 'chips');
      items.forEach(function (it) {
        var b = el('button', 'chip', it.t);
        b.type = 'button';
        b.addEventListener('click', function () { say(it.t); answer(it, []); });
        box.appendChild(b);
      });
      msg.appendChild(box);
    };
    var answer = function (item, more) {
      var m = bot();
      var card = el('article', 'ans');
      card.appendChild(el('p', 'ans__topic', ix.topics[item.g]));
      card.appendChild(el('h3', '', item.t));
      var lead = el('p');
      lead.innerHTML = item.s;
      card.appendChild(lead);
      if (item.p && item.p.length) {
        var ol = el('ol', 'ans__steps');
        item.p.forEach(function (p) { var li = el('li'); li.innerHTML = p; ol.appendChild(li); });
        card.appendChild(ol);
      }
      var a = el('a', 'ans__more', words.more);
      a.href = item.u;
      card.appendChild(a);
      m.appendChild(card);
      if (more.length) {
        var m2 = el('div', 'msg msg--bot msg--chips');
        m2.appendChild(el('p', '', words.also));
        chips(m2, more);
        log.appendChild(m2);
      }
      scrollEnd(m);
    };
    var none = function () {
      var m = bot();
      m.appendChild(el('p', '', words.none));
      var a = el('a', 'ans__more', words.mail);
      a.href = 'mailto:della.kimko@gmail.com';
      m.appendChild(a);
      scrollEnd(m);
    };
    var run = function (q) {
      say(q);
      ready.then(function () {
        var hits = rank(ix, q, false);
        if (!hits.length) { none(); return; }
        var top = hits[0];
        var unsure = top.score < CONFIDENT || (hits[1] && hits[1].score >= top.score * 0.85 && top.score < CONFIDENT + 0.5);
        if (unsure) {
          var m = bot();
          m.className += ' msg--chips';
          m.appendChild(el('p', '', words.which));
          chips(m, hits.slice(0, 3).map(function (h) { return h.item; }));
          if (top.score < CONFIDENT) {
            var mail = el('a', 'ans__more', words.mail);
            mail.href = 'mailto:della.kimko@gmail.com';
            m.appendChild(mail);
          }
          scrollEnd(m);
        } else {
          answer(top.item, hits.slice(1, 4).map(function (h) { return h.item; }));
        }
      }, function () {
        var m = bot();
        m.appendChild(el('p', '', words.failed));
        scrollEnd(m);
      });
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var picked = sugg.picked();
      var q = input.value.trim();
      sugg.close();
      input.value = '';
      if (picked) { say(picked.t); answer(picked, []); }
      else if (q) run(q);
    });
    /* 자주 찾는 것: 스크립트가 없으면 그냥 링크로 간다. */
    $$('[data-go]', ask).forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        ready.then(function () {
          var item = ix.items.map(function (x) { return x.it; }).filter(function (it) { return it.u === a.getAttribute('data-go'); })[0];
          if (item) { say(item.t); answer(item, []); } else location.href = a.href;
        }, function () { location.href = a.href; });
      });
    });

    /* 주소의 ?q=로 바로 물어본다(앱의 도움말 버튼이 이렇게 연다). 글꼴과 그림이 다 들어온 뒤에
       해야 대화창 스크롤이 레이아웃 변화에 끊기지 않는다. */
    var start = new URLSearchParams(location.search).get('q');
    if (start) {
      var go = function () { run(start.slice(0, 200)); };
      if (document.readyState === 'complete') go();
      else window.addEventListener('load', go, { once: true });
    }
  }

  /* ── 주제·지원 페이지의 작은 검색창 ───────────────── */

  $$('.g-find').forEach(function (form) {
    var input = $('input', form);
    var base = form.getAttribute('data-base');
    var ix = null;
    var sugg = suggester(input, $('.g-suggest', form), function () { return ix; }, base, null);
    input.addEventListener('focus', function () {
      load(base + 'search.json').then(function (x) { ix = x; sugg.refresh(); }, function () {});
    }, { once: true });
    form.addEventListener('submit', function (e) {
      var picked = sugg.picked();
      if (picked) { e.preventDefault(); location.href = base + picked.u; }
      else if (!input.value.trim()) e.preventDefault();
    });
  });
})();
