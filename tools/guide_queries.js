// 가이드 검색 시험. tools/guide.py가 언어마다 부른다.
//   node tools/guide_queries.js docs/guide/search.json src/guide/ko/queries.json
// 질의마다 기대한 섹션이 1위로 나와야 하고, 기대가 null이면 자신 있는 답이 없어야 한다.
// 하나라도 어긋나면 모두 찍고 실패한다.
'use strict';

const fs = require('fs');
const path = require('path');
const { prepare, rank, CONFIDENT } = require(path.join(__dirname, '../docs/assets/guide.js'));

const [indexFile, testFile] = process.argv.slice(2);
const ix = prepare(JSON.parse(fs.readFileSync(indexFile, 'utf8')));
const tests = JSON.parse(fs.readFileSync(testFile, 'utf8'));

const known = new Set(ix.items.map((x) => x.it.u));
const bad = [];
for (const [query, want] of Object.entries(tests)) {
  // null이면 가이드에 없는 일이라 자신 있는 답이 나오지 않아야 한다(후보만 보이는 건 괜찮다).
  if (want === null) {
    const hits = rank(ix, query, false);
    if (hits.length && hits[0].score >= CONFIDENT) bad.push(`${query} → 답이 없어야 하는데 ${hits[0].item.u} ${hits[0].score.toFixed(2)}`);
    continue;
  }
  const u = want.replace('#', '.html#');
  if (!known.has(u)) { bad.push(`${query} → 기대한 섹션이 없다: ${want}`); continue; }
  const hits = rank(ix, query, false);
  const got = hits.length ? hits[0].item.u : '(없음)';
  if (got !== u) {
    const top = hits.slice(0, 3).map((h) => `${h.item.u} ${h.score.toFixed(2)}`).join(', ');
    bad.push(`${query} → ${got} (기대 ${u}) [${top}]`);
  }
}

if (bad.length) {
  console.log(bad.join('\n'));
  process.exit(1);
}
console.log(`검색 시험 ${Object.keys(tests).length}개 통과`);
