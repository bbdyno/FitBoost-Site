// 스크롤에 물린 동작만 둔다.
// CSS의 scroll-driven animation이 되는 브라우저에서는 등장 연출을 CSS에 맡기고,
// 안 되는 브라우저에서만 IntersectionObserver로 같은 자리를 메운다.

(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var hasScrollTimeline =
    window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()');

  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  // ── 상단 바: 내려가면 진해진다 ──────────────────────────
  var nav = document.querySelector('.nav');
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('is-stuck', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ── 등장: CSS가 못 하면 여기서 ──────────────────────────
  var revealables = document.querySelectorAll('.reveal');
  if (!hasScrollTimeline) {
    if (reduce || !hasIO) {
      each(revealables, function (el) { el.classList.add('is-in'); });
    } else {
      var revealer = new IntersectionObserver(
        function (entries) {
          each(entries, function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-in');
            revealer.unobserve(entry.target);
          });
        },
        { rootMargin: '0px 0px -10% 0px', threshold: 0.06 }
      );
      each(revealables, function (el) { revealer.observe(el); });
    }
  }

  // ── 숫자 세기 ───────────────────────────────────────────
  var nums = document.querySelectorAll('.stat__num[data-count]');
  function countUp(el) {
    var target = Number(el.dataset.count);
    if (!target || reduce) return;           // 무제한처럼 숫자가 아닌 값은 그대로 둔다
    var start = null;
    var dur = 1100;
    function tick(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if (hasIO && nums.length) {
    var counter = new IntersectionObserver(
      function (entries) {
        each(entries, function (entry) {
          if (!entry.isIntersecting) return;
          countUp(entry.target);
          counter.unobserve(entry.target);
        });
      },
      { threshold: 0.6 }
    );
    each(nums, function (el) { counter.observe(el); });
  }

  // ── 쇼케이스: 폰이 자라고, 읽는 단계에 맞춰 화면이 바뀐다 ──
  var phone = document.querySelector('.phone');
  if (phone && hasIO && !reduce) {
    var phoneWatcher = new IntersectionObserver(
      function (entries) {
        each(entries, function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          phoneWatcher.unobserve(entry.target);
        });
      },
      { threshold: 0.15 }
    );
    phoneWatcher.observe(phone);
  } else if (phone) {
    phone.classList.add('is-in');
  }

  var steps = document.querySelectorAll('.showcase__steps .step');
  var shots = document.querySelectorAll('.phone__screen img');
  if (!steps.length || !shots.length) return;

  function activate(index) {
    each(shots, function (img, i) {
      img.classList.toggle('is-active', i === index);
    });
    each(steps, function (step, i) {
      step.classList.toggle('is-current', i === index);
    });
  }
  activate(0);

  if (!hasIO) return;

  var stepWatcher = new IntersectionObserver(
    function (entries) {
      each(entries, function (entry) {
        if (!entry.isIntersecting) return;
        var index = Number(entry.target.dataset.step);
        if (!Number.isNaN(index)) activate(index);
      });
    },
    // 화면 한가운데를 지나는 단계를 현재로 본다.
    { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
  );
  each(steps, function (step) { stepWatcher.observe(step); });
})();
