// 규칙 기반 해석. tarot/reader.py의 RuleBasedReader와 같은 규칙과 문장을 쓴다.
// 해석 순서: 맥락 파악 → 원소·수비학 → 카드 간 관계 → 실천 조언.
// 단정적인 미래 예측("~할 것입니다")은 쓰지 않고, 에너지 흐름과 필요한 태도로 서술한다.
(function (root) {
  const ELEMENT_THEME = { 불: '행동과 열정', 물: '감정과 관계', 공기: '생각과 소통', 흙: '현실과 물질' };

  const ELEMENT_ACTION = {
    불: '작더라도 직접 행동으로 옮겨 보는 것',
    물: '자신의 감정을 솔직하게 들여다보고 표현하는 것',
    공기: '생각을 글로 정리해 상황을 한 걸음 떨어져서 보는 것',
    흙: '현실적인 계획과 일정, 예산을 세워 보는 것',
  };
  const MAJOR_ACTION = '이 변화가 삶에서 어떤 의미인지 시간을 두고 돌아보는 것';

  const NUMEROLOGY = {
    1: '시작과 잠재력', 2: '균형과 선택', 3: '성장과 표현', 4: '안정과 기반', 5: '갈등과 변화',
    6: '조화와 회복', 7: '성찰과 시험', 8: '움직임과 숙련', 9: '완성 직전의 정점', 10: '한 순환의 완결',
  };

  const COURT = {
    11: '배우고 탐색하는 시종의 태도',
    12: '밀고 나가는 기사의 태도',
    13: '안에서 성숙하게 품는 여왕의 태도',
    14: '밖으로 책임지고 다스리는 왕의 태도',
  };

  // ----- 조사 -----
  // 숫자를 한국어로 읽을 때 받침 유무 (0 영, 1 일, 3 삼, 6 육, 7 칠, 8 팔 → 받침 있음)
  const DIGIT_HAS_FINAL = { 0: true, 1: true, 2: false, 3: true, 4: false, 5: false, 6: true, 7: true, 8: true, 9: false };

  function lastInfo(word) {
    const w = String(word).trimEnd();
    const ch = w.slice(-1);
    if (/\d/.test(ch)) {
      if (w.endsWith('10')) return { final: true, rieul: false }; // 십
      return { final: DIGIT_HAS_FINAL[ch], rieul: '178'.includes(ch) }; // 일, 칠, 팔
    }
    const code = ch ? ch.charCodeAt(0) - 0xac00 : -1;
    if (code >= 0 && code <= 11171) return { final: code % 28 !== 0, rieul: code % 28 === 8 };
    return { final: false, rieul: false };
  }

  // josa('바보', '이', '가') -> '바보가'. '으로'는 ㄹ 받침 뒤에서 '로'가 된다.
  function josa(word, withFinal, withoutFinal) {
    const info = lastInfo(word);
    if (withFinal === '으로' && info.rieul) return word + withoutFinal;
    return word + (info.final ? withFinal : withoutFinal);
  }

  // 작은따옴표로 감싸고 받침에 맞는 조사를 붙인다. q('무모함', '으로', '로') -> "'무모함'으로"
  const q = (word, a, b) => `'${word}'` + josa(word, a, b).slice(word.length);

  // ----- 원소 관계 -----
  // 골든 던 원소 관계: 불·공기, 물·흙은 서로 돕고, 불·물, 공기·흙은 서로 부딪친다.
  const FRIENDLY = ['공기|불', '물|흙'];
  const HOSTILE = ['물|불', '공기|흙'];

  // '상생', '상극' 또는 null(같은 원소, 중립, 메이저 포함)
  function elementRelation(a, b) {
    if (!a || !b || a === b) return null;
    const pair = [a, b].sort().join('|');
    if (FRIENDLY.includes(pair)) return '상생';
    if (HOSTILE.includes(pair)) return '상극';
    return null;
  }

  // ----- 리딩 항목 도우미 -----
  // entry: { position, meaning(위치 의미), card, reversed }
  const side = (e) => (e.reversed ? e.card.reversed : e.card.upright);
  const kw = (e) => side(e).keywords.split(',')[0].trim();
  const orientation = (e) => (e.reversed ? '역방향' : '정방향');

  function cardText(e) {
    const c = e.card;
    const parts = [];
    if (c.arcana === 'major') {
      parts.push(`메이저 아르카나 ${c.number}번 ${josa(c.name, '은', '는')} 삶의 큰 흐름을 보여 주는 원형적인 카드예요.`);
    } else if (COURT[c.number]) {
      parts.push(`${c.element}의 원소(${ELEMENT_THEME[c.element]})에 속한 인물 카드로, ${COURT[c.number]}를 나타내요.`);
    } else {
      parts.push(`${c.element}의 원소(${ELEMENT_THEME[c.element]})에 속하고, `
        + `숫자 ${josa(String(c.number), '은', '는')} ${josa(NUMEROLOGY[c.number], '을', '를')} 뜻해요.`);
    }
    if (e.reversed) parts.push('역방향으로 나와 이 에너지가 막혀 있거나 바깥보다 안쪽으로 향하고 있어요.');
    parts.push(side(e).meaning);
    parts.push(`${q(e.meaning, '을', '를')} 묻는 자리에 '${kw(e)}'의 기운이 놓였다고 읽을 수 있어요.`);
    return parts.join(' ');
  }

  function relationNotes(pairs) {
    const notes = [];
    pairs.forEach(([a, b]) => {
      const rel = elementRelation(a.card.element, b.card.element);
      const head = `${a.position}의 ${josa(a.card.element, '과', '와')} ${b.position}의 ${josa(b.card.element, '은', '는')}`;
      if (rel === '상생') notes.push(`${head} 서로를 돕는 원소라, 두 자리의 에너지가 자연스럽게 이어져요.`);
      else if (rel === '상극') notes.push(`${head} 서로 부딪치는 원소라, 두 자리 사이에 긴장이 있어요. 이 간극을 어떻게 메울지가 관건이에요.`);
    });
    return notes;
  }

  function choiceNotes([now, a, b]) {
    const notes = [`선택 A는 '${kw(a)}', 선택 B는 '${kw(b)}'의 흐름을 보여요.`];
    if (a.reversed !== b.reversed) {
      notes.push(`정방향으로 나온 선택 ${a.reversed ? 'B' : 'A'} 쪽 에너지가 상대적으로 더 막힘없이 흐르고 있어요.`);
    }
    [['A', a], ['B', b]].forEach(([label, e]) => {
      const rel = elementRelation(now.card.element, e.card.element);
      if (rel) notes.push(`현재 상황과 선택 ${label}의 원소는 ${rel === '상생' ? '서로 돕는' : '서로 부딪치는'} 관계예요.`);
    });
    return notes;
  }

  function balanceNotes(entries) {
    if (entries.length < 3) return [];
    const notes = [];
    const major = entries.filter((e) => e.card.arcana === 'major').length;
    if (major / entries.length >= 0.5) {
      notes.push('메이저 아르카나가 절반 이상이라, 일상적인 사건보다 삶의 방향이 바뀌는 큰 흐름과 맞닿은 질문으로 보여요.');
    } else if (major === 0) {
      notes.push('마이너 아르카나만 나와, 스스로 조절할 수 있는 일상의 선택과 행동에 가까운 문제예요.');
    }

    // 동률이면 먼저 나온 원소를 고른다 (Python Counter.most_common과 같다).
    const counts = new Map();
    entries.forEach((e) => { if (e.card.element) counts.set(e.card.element, (counts.get(e.card.element) || 0) + 1); });
    if (counts.size) {
      let [top, count] = [null, 0];
      counts.forEach((n, el) => { if (n > count) [top, count] = [el, n]; });
      if (count >= 2) notes.push(`${top}의 원소가 ${count}장으로 가장 많아 ${josa(ELEMENT_THEME[top], '이', '가')} 이번 리딩의 중심이에요.`);
      if (entries.length >= 5) {
        const missing = Object.keys(ELEMENT_THEME).filter((el) => !counts.has(el));
        if (missing.length) {
          notes.push(`${missing.join(', ')}의 원소는 보이지 않아요. `
            + `${missing.map((el) => ELEMENT_THEME[el]).join(', ')} 쪽을 놓치고 있지 않은지 살펴보세요.`);
        }
      }
    }

    const rev = entries.filter((e) => e.reversed).length;
    if (rev / entries.length > 0.5) notes.push('역방향이 절반을 넘어, 밖으로 드러난 사건보다 안에서 막힌 감정이나 저항을 먼저 살펴볼 때예요.');
    return notes;
  }

  // 종합 해석을 문장 배열로 돌려준다. spread: { key, name }
  function synthesis(spread, question, entries) {
    const topic = question ? `'${question}'` : '이번 질문';
    const lines = [`${topic}에 대해 ${spread.name} 배열로 뽑은 ${entries.length}장의 흐름을 정리해 볼게요.`];
    const e = entries;

    if (spread.key === 'one') {
      lines.push(`한 장의 메시지는 ${josa(e[0].card.name, '이에요', '예요')}. ${side(e[0]).meaning}`);
    } else if (spread.key === 'three') {
      lines.push(`과거의 '${kw(e[0])}'에서 출발한 에너지가 현재 '${kw(e[1])}'의 국면을 지나 '${kw(e[2])}' 쪽으로 이어지고 있어요.`);
      lines.push(...relationNotes([[e[0], e[1]], [e[1], e[2]]]));
    } else if (spread.key === 'choice') {
      lines.push(...choiceNotes(e));
    } else if (spread.key === 'celtic') {
      lines.push(`중심에는 '${kw(e[0])}'의 상황이 있고, '${kw(e[1])}'의 힘이 그 위를 가로지르고 있어요. `
        + `근본 원인 자리의 ${q(kw(e[3]), '과', '와')} 희망·두려움 자리의 ${q(kw(e[8]), '을', '를')} 함께 보면 `
        + '이 상황이 마음 깊은 곳과 어떻게 이어져 있는지 보여요.');
      lines.push(...relationNotes([[e[0], e[1]], [e[6], e[9]]]));
    }

    lines.push(...balanceNotes(e));

    // 조언의 기준 카드: 양자택일은 현재 상황, 나머지는 흐름의 마지막 자리
    const target = spread.key === 'choice' ? e[0] : e[e.length - 1];
    const flow = target.reversed
      ? `현재 에너지 흐름은 '${kw(target)}' 쪽으로 기울어 있고, 이를 위해 그 막힘을 먼저 인정하고 다루는 태도가 필요해요.`
      : `현재 에너지 흐름은 '${kw(target)}' 쪽으로 향하고 있고, 이를 위해 그 기운을 의식적으로 키우는 태도가 필요해요.`;
    lines.push(`${flow} 실천으로는 ${ELEMENT_ACTION[target.card.element] || MAJOR_ACTION}부터 시작해 보세요.`);
    lines.push('타로는 정해진 미래가 아니라 지금의 흐름을 비추는 거울이에요. 어떻게 움직일지는 질문자가 정할 수 있어요.');
    return lines;
  }

  const api = { josa, elementRelation, cardText, synthesis, orientation, ELEMENT_THEME };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TAROT_READER = api;
})(typeof window !== 'undefined' ? window : globalThis);
