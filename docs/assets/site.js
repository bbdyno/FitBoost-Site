/* FitBoost 사이트의 움직임.
   [data-scene] 섹션마다 스크롤 진행도(0~1)를 구해 장면별 함수에 넘긴다.
   나머지는 직접 눌러 보는 원판 계산이다. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lang = document.documentElement.lang || 'ko';
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var range = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* 고른 언어는 다음 방문에도 쓴다(첫 화면의 자동 이동이 이 값을 본다). */
  $$('[data-lang]').forEach(function (a) {
    a.addEventListener('click', function () {
      try { localStorage.setItem('fb-lang', a.getAttribute('data-lang')); } catch (e) {}
    });
  });
  document.addEventListener('click', function (e) {
    $$('details.langs[open]').forEach(function (d) { if (!d.contains(e.target)) d.removeAttribute('open'); });
  });

  /* ── 상단 바: 검은 장면 위에서는 검게 ─────────────── */
  var nav = $('.nav');
  var darks = $$('.dark');
  function updateNav() {
    if (!nav) return;
    nav.classList.toggle('is-stuck', window.scrollY > 4);
    var y = 30, onDark = false;
    for (var i = 0; i < darks.length; i++) {
      var r = darks[i].getBoundingClientRect();
      if (r.top <= y && r.bottom > y) { onDark = true; break; }
    }
    nav.classList.toggle('on-dark', onDark);
  }

  /* ── 1. 첫 화면 ───────────────────────────────────── */
  var hero = $('[data-scene="hero"]');
  var kg = hero && $('.hero__kg', hero);
  if (hero) setTimeout(function () { hero.classList.add('t1'); }, 500);
  function sceneHero(p) {
    hero.style.setProperty('--p', p.toFixed(4));
    var v = 100 + 2.5 * range(p, .22, .42);
    v = Math.round(v * 2) / 2;
    kg.textContent = v % 1 ? v.toFixed(1) : String(v);
    hero.classList.toggle('is-up', v >= 102.5);
    hero.classList.toggle('t2', p > .3 || reduce);
    hero.classList.toggle('t3', p > .5 || reduce);
  }

  /* ── 3. 운동 중 코치 ──────────────────────────────── */
  var coach = $('[data-scene="coach"]');
  var coachItems = coach ? $$('[data-at]', coach) : [];
  var coachSteps = coach ? $$('.coach__steps li', coach) : [];
  var coachSets = coach ? $$('.set', coach) : [];
  var restEl = coach && $('.rest', coach);
  var restT = coach && $('.rest__t', coach);
  function sceneCoach(p) {
    coachItems.forEach(function (el) {
      el.classList.toggle('shown', p >= parseFloat(el.getAttribute('data-at')));
    });
    var step = p < .28 ? 0 : p < .6 ? 1 : 2;
    coachSteps.forEach(function (li, i) { li.classList.toggle('is-on', i === step); });
    if (coachSets[1]) coachSets[1].classList.toggle('is-done', p > .38);
    if (coachSets[2]) coachSets[2].classList.toggle('is-done', p > .7);
    var r = range(p, .44, .58);
    restEl.style.setProperty('--rest', r.toFixed(3));
    var s = 150 + Math.round(30 * r / 5) * 5;
    restT.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  /* ── 5. 회복 지도: 피로가 시간에 따라 줄어든다 ─────── */
  var recov = $('[data-scene="recov"]');
  var muscles = [];
  var hoursEl = recov && $('.recov__h', recov);
  if (recov) {
    $$('.body', recov).forEach(function (body) {
      // 변수 안의 url()은 스타일시트 기준으로 풀리므로 절대 주소로 넣는다
      var base = $('img', body).src.replace(/(front|back)\.webp$/, '');
      $$('i', body).forEach(function (i) {
        i.style.setProperty('--m', 'url("' + base + i.getAttribute('data-m') + '.webp")');
        muscles.push({ el: i, load: parseFloat(i.getAttribute('data-load')) });
      });
    });
  }
  // 라임(회복) → 주황(회복 중) → 빨강(피로)
  var stops = [[0, [197, 240, 74]], [.42, [255, 181, 46]], [.75, [255, 91, 77]], [1, [255, 91, 77]]];
  function heat(f) {
    for (var i = 1; i < stops.length; i++) {
      if (f <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i], t = (f - a[0]) / (b[0] - a[0] || 1);
        return 'rgb(' + a[1].map(function (c, k) { return Math.round(c + (b[1][k] - c) * t); }).join(',') + ')';
      }
    }
    return 'rgb(255,91,77)';
  }
  function sceneRecov(p) {
    var h = 72 * range(p, .12, .88);
    hoursEl.textContent = Math.round(h);
    muscles.forEach(function (m) {
      var f = m.load * Math.exp(-h / 34);
      m.el.style.setProperty('--c', heat(f));
      m.el.style.setProperty('--o', (.42 + .48 * Math.min(1, f * 1.3)).toFixed(3));
    });
  }

  /* ── PRO+ 코칭: 세로로 내리는 만큼 카드 줄이 옆으로 간다 ── */
  var plus = $('[data-scene="plus"]');
  var plusTrack = plus && $('.plus__track', plus);
  var plusTrend = plus && $('.trend', plus);
  var plusRun = 0;
  function sizePlus() {
    if (!plus || reduce) return;
    plusRun = Math.max(0, plusTrack.scrollWidth - window.innerWidth);
    // 카드 줄을 다 보는 거리 + 들어올 때와 나갈 때 머무는 여유
    plus.style.height = (window.innerHeight * 1.5 + plusRun) + 'px';
  }
  function scenePlus(p) {
    var k = range(p, .1, .9);
    plusTrack.style.setProperty('--x', (plusRun * k).toFixed(1));
    plus.style.setProperty('--p', k.toFixed(4));
    if (plusTrend) plusTrend.style.setProperty('--draw', reduce ? 1 : range(k, .3, .6).toFixed(3));
  }
  sizePlus();
  window.addEventListener('resize', sizePlus);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { sizePlus(); request(); });

  /* ── 장면 돌리기 ──────────────────────────────────── */
  var scenes = [
    [hero, sceneHero], [coach, sceneCoach], [recov, sceneRecov], [plus, scenePlus]
  ].filter(function (s) { return s[0]; });

  function progress(el) {
    var r = el.getBoundingClientRect();
    var span = r.height - window.innerHeight;
    if (span <= 0) return r.top < window.innerHeight * .5 ? 1 : 0;
    return clamp(-r.top / span, 0, 1);
  }

  var ticking = false;
  function frame() {
    ticking = false;
    updateNav();
    scenes.forEach(function (s) { s[1](reduce ? (s[0] === recov ? .45 : 1) : progress(s[0])); });
  }
  function request() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  frame();

  /* ── 원판 계산은 화면에 들어올 때 한 번 원판을 끼운다 ── */
  var plateBox = $('[data-plates]');
  if (plateBox && 'IntersectionObserver' in window) {
    var pio = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      plates.intro();
      pio.disconnect();
    }, { rootMargin: '0px 0px -12% 0px', threshold: .05 });
    pio.observe(plateBox);
  }

  /* ── 시계: 휴식 시간이 줄어든다 ───────────────────── */
  $$('[data-tick]').forEach(function (el) {
    var start = parseInt(el.getAttribute('data-tick'), 10), left = start;
    if (reduce) return;
    setInterval(function () {
      left = left <= 0 ? start : left - 1;
      el.textContent = Math.floor(left / 60) + ':' + ('0' + (left % 60)).slice(-2);
    }, 1000);
  });

  /* ── 원판 계산 ────────────────────────────────────── */
  var plates = (function () {
    var root = $('[data-plates]');
    if (!root) return { intro: function () {} };
    var svg = $('.rack__bar', root);
    var totalEl = $('[data-total]', root);
    var unitEl = $('[data-unit]', root);
    var sideEl = $('[data-side]', root);
    var perSide = root.getAttribute('data-kg-label');
    var NS = 'http://www.w3.org/2000/svg';
    var SETS = {
      kg: { bar: 20, step: 2.5, min: 20, max: 300, start: 142.5, plates: [
        [25, '#D93A2F', 196, 34], [20, '#2563C9', 196, 30], [15, '#F0BE2C', 178, 26],
        [10, '#2E9C4E', 160, 22], [5, '#F1F1EC', 124, 18], [2.5, '#2A2A2E', 100, 14], [1.25, '#A7A7AE', 82, 11]] },
      lb: { bar: 45, step: 5, min: 45, max: 675, start: 315, plates: [
        [45, '#2563C9', 196, 32], [35, '#F0BE2C', 184, 28], [25, '#2E9C4E', 166, 24],
        [10, '#F1F1EC', 130, 18], [5, '#D93A2F', 108, 15], [2.5, '#A7A7AE', 88, 12]] }
    };
    var unit = 'kg', total = SETS.kg.start, shown = false, prevKeys = [];

    function solve(set, t) {
      var side = (t - set.bar) / 2, out = [];
      set.plates.forEach(function (pl) {
        while (side + 1e-9 >= pl[0]) { out.push(pl); side -= pl[0]; }
      });
      return out;
    }
    function el(name, attrs) {
      var n = document.createElementNS(NS, name);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      return n;
    }
    function draw(animate) {
      var set = SETS[unit];
      var list = solve(set, total);
      var thick = list.reduce(function (s, p) { return s + p[3] + 3; }, 0);
      var k = Math.min(1, 196 / (thick || 1));
      svg.textContent = '';
      // 봉
      svg.appendChild(el('rect', { x: 110, y: 99, width: 780, height: 22, rx: 6, fill: '#B9B9BF' }));
      svg.appendChild(el('rect', { x: 330, y: 103, width: 340, height: 14, rx: 4, fill: '#8E8E95' }));
      svg.appendChild(el('rect', { x: 312, y: 84, width: 16, height: 52, rx: 4, fill: '#55555C' }));
      svg.appendChild(el('rect', { x: 672, y: 84, width: 16, height: 52, rx: 4, fill: '#55555C' }));
      var keys = [];
      [-1, 1].forEach(function (dir) {
        var x = dir < 0 ? 310 : 690;
        list.forEach(function (pl, i) {
          var w = pl[3] * k, h = pl[2];
          var px = dir < 0 ? x - w : x;
          var g = el('g', { 'class': 'plate' + (dir < 0 ? ' l' : '') });
          g.appendChild(el('rect', { x: px, y: 110 - h / 2, width: w, height: h, rx: Math.min(5, w / 3), fill: pl[1], stroke: 'rgba(0,0,0,.25)', 'stroke-width': 1.2 }));
          g.appendChild(el('rect', { x: px + w * .3, y: 110 - h / 2 + 6, width: Math.max(1.5, w * .14), height: h - 12, rx: 1, fill: 'rgba(255,255,255,.18)' }));
          var key = dir + ':' + i + ':' + pl[0];
          keys.push(key);
          if (animate && prevKeys.indexOf(key) < 0) {
            g.classList.add('off');
            g.style.transitionDelay = (animate === 'intro' ? i * 90 : 0) + 'ms';
          }
          svg.appendChild(g);
          x += dir * (w + 3 * k);
        });
      });
      prevKeys = keys;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { $$('.plate.off', svg).forEach(function (g) { g.classList.remove('off'); }); });
      });
      totalEl.textContent = total % 1 ? total.toFixed(total * 4 % 2 ? 2 : 1) : String(total);
      unitEl.textContent = unit.toUpperCase();
      sideEl.textContent = '';
      var lab = document.createElement('span');
      lab.textContent = perSide + ' · ' + set.bar + ' ' + unit + ' bar +';
      sideEl.appendChild(lab);
      list.forEach(function (pl) {
        var c = document.createElement('span');
        c.className = 'chip';
        c.style.background = pl[1];
        if (pl[1] === '#F1F1EC' || pl[1] === '#F0BE2C' || pl[1] === '#A7A7AE') { c.style.color = '#0D0D0E'; }
        c.textContent = pl[0];
        sideEl.appendChild(c);
      });
    }

    $$('[data-step]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var set = SETS[unit];
        total = clamp(total + set.step * parseInt(b.getAttribute('data-step'), 10), set.min, set.max);
        draw(true);
      });
    });
    $$('[data-u]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var u = b.getAttribute('data-u');
        if (u === unit) return;
        $$('[data-u]', root).forEach(function (x) { x.classList.toggle('is-on', x === b); });
        var set = SETS[u];
        total = u === 'lb' ? Math.round(total * 2.20462 / 5) * 5 : Math.round(total / 2.20462 / 2.5) * 2.5;
        total = clamp(total, set.min, set.max);
        unit = u;
        prevKeys = [];
        draw('intro');
      });
    });

    draw(false);
    return {
      intro: function () {
        if (shown) return;
        shown = true;
        prevKeys = [];
        draw(reduce ? false : 'intro');
      }
    };
  })();
})();
