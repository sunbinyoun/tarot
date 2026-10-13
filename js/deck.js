// 스프레드 정의, 셔플, 뽑기, 리딩 요약. UI와 분리해 Node에서도 테스트할 수 있게 한다.
(function (root) {
  const SPREADS = {
    one: {
      name: '원 카드',
      description: '오늘의 메시지나 간단한 질문에 한 장으로 답해요.',
      positions: ['메시지'],
      meanings: ['지금 질문에 가장 필요한 핵심 메시지'],
    },
    three: {
      name: '쓰리 카드',
      description: '과거·현재·미래의 흐름을 살펴요.',
      positions: ['과거', '현재', '미래'],
      meanings: ['지금 상황을 만든 배경과 지나온 에너지', '지금 질문자가 서 있는 상태와 핵심 과제', '현재 흐름이 이어질 때 향하는 방향'],
    },
    choice: {
      name: '양자택일',
      description: '두 가지 선택지를 비교해요.',
      positions: ['현재 상황', '선택 A', '선택 B'],
      meanings: ['선택을 앞둔 지금의 상태', '첫 번째 선택지를 따를 때의 흐름', '두 번째 선택지를 따를 때의 흐름'],
    },
    celtic: {
      name: '켈틱 크로스',
      description: '상황 전체를 10장으로 깊이 있게 읽어요.',
      positions: ['현재 상황', '장애물', '목표·의식', '근본 원인', '가까운 과거', '가까운 미래', '나의 태도', '주변 환경', '희망과 두려움', '최종 결과'],
      meanings: [
        '질문의 중심에 있는 상황', '현재 상황을 가로막거나 엇갈리는 힘', '의식적으로 바라는 것, 도달하려는 이상',
        '무의식에 깔린 상황의 뿌리', '막 지나가고 있는 영향', '곧 다가올 흐름', '질문자가 상황을 대하는 방식',
        '주변 사람과 환경이 주는 영향', '마음속 기대와 불안', '지금의 흐름이 이어질 때의 귀결',
      ],
    },
  };

  // 0 이상 max 미만의 균등 난수. 가능하면 crypto를 쓴다.
  function randomInt(max, rng) {
    if (rng) return Math.floor(rng() * max);
    const c = root.crypto;
    if (c && c.getRandomValues) {
      const limit = Math.floor(0x100000000 / max) * max;
      const buf = new Uint32Array(1);
      do c.getRandomValues(buf); while (buf[0] >= limit);
      return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  // Fisher–Yates 셔플. 원본 배열은 바꾸지 않는다.
  function shuffle(list, rng) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = randomInt(i + 1, rng);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function draw(cards, spreadKey, options) {
    const opts = Object.assign({ allowReversed: true, majorOnly: false, rng: null }, options);
    const spread = SPREADS[spreadKey];
    if (!spread) throw new Error(`알 수 없는 스프레드: ${spreadKey}`);
    const pool = opts.majorOnly ? cards.filter((c) => c.arcana === 'major') : cards;
    if (spread.positions.length > pool.length) throw new Error('카드 수가 부족해요.');
    const picked = shuffle(pool, opts.rng).slice(0, spread.positions.length);
    return picked.map((card, i) => ({
      position: spread.positions[i],
      meaning: spread.meanings[i],
      card,
      reversed: opts.allowReversed ? randomInt(2, opts.rng) === 1 : false,
    }));
  }

  function summarize(reading, suits) {
    const total = reading.length;
    const major = reading.filter((r) => r.card.arcana === 'major').length;
    const reversed = reading.filter((r) => r.reversed).length;
    const suitCount = {};
    reading.forEach((r) => {
      if (r.card.suit) suitCount[r.card.suit] = (suitCount[r.card.suit] || 0) + 1;
    });

    const notes = [];
    if (total >= 3 && major / total >= 0.5) {
      notes.push('메이저 아르카나가 많이 나왔어요. 인생의 큰 흐름이나 중요한 전환점과 관련된 질문일 가능성이 높아요.');
    } else if (total >= 3 && major === 0) {
      notes.push('마이너 아르카나만 나왔어요. 일상에서 스스로 조절할 수 있는 문제에 가까워요.');
    }

    const top = Object.entries(suitCount).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2 && total >= 3) {
      const suit = suits.find((s) => s.key === top[0]);
      notes.push(`${suit.ko}(${suit.element}) 카드가 ${top[1]}장으로 가장 많아요. ${suit.domain} 영역이 이번 리딩의 중심이에요.`);
    }

    if (total >= 3 && reversed / total > 0.5) {
      notes.push('역방향 카드가 절반을 넘어요. 막힌 에너지나 내면의 저항을 먼저 살펴보면 좋아요.');
    } else if (total >= 3 && reversed === 0) {
      notes.push('모든 카드가 정방향이에요. 에너지가 비교적 순조롭게 흐르고 있어요.');
    }

    return { total, major, reversed, suitCount, notes };
  }

  const api = { SPREADS, shuffle, draw, summarize, randomInt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TAROT_DECK = api;
})(typeof window !== 'undefined' ? window : globalThis);
