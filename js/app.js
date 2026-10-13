(function () {
  const { cards, suits } = window.TAROT_CARDS;
  const { SPREADS, draw } = window.TAROT_DECK;
  const { cardText, synthesis } = window.TAROT_READER;
  const HISTORY_KEY = 'tarot-history-v1';
  const HISTORY_MAX = 20;

  const $ = (id) => document.getElementById(id);
  const el = {
    question: $('question'),
    spreads: $('spreads'),
    spreadDesc: $('spread-desc'),
    optReversed: $('opt-reversed'),
    optMajor: $('opt-major'),
    btnDraw: $('btn-draw'),
    btnReveal: $('btn-reveal'),
    table: $('table'),
    result: $('result'),
    resultSpread: $('result-spread'),
    resultQuestion: $('result-question'),
    synthesis: $('synthesis'),
    interpretations: $('interpretations'),
    btnCopy: $('btn-copy'),
    btnShare: $('btn-share'),
    history: $('history'),
    btnClear: $('btn-clear'),
    dictSearch: $('dict-search'),
    dictionary: $('dictionary'),
    libFilters: $('lib-filters'),
    libEmpty: $('lib-empty'),
    dialog: $('card-dialog'),
    ai: $('ai'),
    aiBody: $('ai-body'),
    aiNote: $('ai-note'),
    btnAi: $('btn-ai'),
    btnAiStop: $('btn-ai-stop'),
  };

  let spreadKey = 'three';
  let current = null; // { question, spreadKey, reading, flipped:Set, date }

  function h(tag, attrs, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
    });
    children.flat().forEach((c) => {
      if (c != null) node.append(c.nodeType ? c : document.createTextNode(c));
    });
    return node;
  }

  // ----- 스프레드 선택 -----
  function renderSpreads() {
    el.spreads.replaceChildren(
      ...Object.entries(SPREADS).map(([key, s]) =>
        h('button', {
          type: 'button',
          role: 'radio',
          'aria-checked': String(key === spreadKey),
          onclick: () => { spreadKey = key; renderSpreads(); },
        }, `${s.name} (${s.positions.length}장)`)
      )
    );
    el.spreadDesc.textContent = SPREADS[spreadKey].description;
  }

  // ----- 카드 그리기 -----
  // RWS 그림을 앞면에 깔고, 그림을 못 불러오면(파일 없음 등) 글자 앞면을 보여 준다.
  function cardFace(entry) {
    const { card, reversed } = entry;
    const front = h('div', { class: 'card-front has-image' + (reversed ? ' is-reversed' : '') },
      h('img', {
        class: 'face-img',
        src: card.image,
        alt: '',
        draggable: 'false',
        onerror: () => front.classList.remove('has-image'),
      }),
      h('div', { class: 'face' },
        h('span', { class: 'face-num' }, card.label),
        h('span', { class: 'face-symbol', 'aria-hidden': 'true' }, card.symbol),
        h('span', null,
          h('div', { class: 'face-name' }, card.name),
          h('div', { class: 'face-en' }, card.nameEn)
        )
      )
    );
    return front;
  }

  // 카드 아래 이름 줄. 켈틱 크로스 가로 카드가 중심 카드와 겹치도록 위 이름표와 높이를 같게 둔다.
  function nameLine(entry) {
    if (!entry) return h('span', { class: 'card-name' });
    const { name } = entry.card;
    return h('span', {
      class: 'card-name' + (entry.reversed ? ' rev' : ''),
      title: entry.reversed ? `${name} 역방향` : name,
    }, entry.reversed ? `${name} (역)` : name);
  }

  function renderTable() {
    el.table.className = 'table' + (current.spreadKey === 'celtic' ? ' celtic' : '');
    el.table.replaceChildren(
      ...current.reading.map((entry, i) => {
        const flipped = current.flipped.has(i);
        const label = flipped
          ? `${entry.position}: ${entry.card.name}${entry.reversed ? ' 역방향' : ''}`
          : `${entry.position} 카드 뒤집기`;
        const btn = h('button', {
          type: 'button',
          class: 'card dealing' + (flipped ? ' flipped' : ''),
          style: `animation-delay:${i * 80}ms`,
          'aria-label': label,
          onclick: () => flip(i),
        },
          h('div', { class: 'card-inner' },
            h('div', { class: 'card-back', 'aria-hidden': 'true' }, '✧'),
            cardFace(entry)
          )
        );
        return h('div', { class: 'slot', 'data-i': i },
          h('span', { class: 'slot-label' }, `${i + 1}. ${entry.position}`),
          btn,
          nameLine(flipped ? entry : null)
        );
      })
    );
  }

  function flip(i) {
    if (!current || current.flipped.has(i)) return;
    current.flipped.add(i);
    const slot = el.table.querySelector(`.slot[data-i="${i}"]`);
    const entry = current.reading[i];
    const btn = slot.querySelector('.card');
    btn.classList.remove('dealing');
    btn.classList.add('flipped');
    btn.setAttribute('aria-label', `${entry.position}: ${entry.card.name}${entry.reversed ? ' 역방향' : ''}`);
    slot.querySelector('.card-name').replaceWith(nameLine(entry));
    if (current.flipped.size === current.reading.length) finishReading();
  }

  function revealAll() {
    if (!current) return;
    current.reading.forEach((_, i) => flip(i));
  }

  // ----- 결과 -----
  function finishReading() {
    el.btnReveal.hidden = true;
    renderResult(current);
    saveHistory(current);
    renderHistory();
    if (sample) interpret(current, false);
  }

  function renderResult(r) {
    el.result.hidden = false;
    resetAi(r);
    const spread = SPREADS[r.spreadKey];
    el.resultSpread.textContent = `${spread.name} · ${r.reading.length}장`;
    el.resultQuestion.textContent = r.question ? `“${r.question}”` : '질문 없이 본 리딩';
    el.synthesis.replaceChildren(
      ...synthesis({ key: r.spreadKey, name: spread.name }, r.question, r.reading).map((line) => h('p', null, line))
    );
    el.interpretations.replaceChildren(
      ...r.reading.map((entry, i) => {
        const side = entry.reversed ? entry.card.reversed : entry.card.upright;
        return h('li', null,
          h('img', {
            class: 'interp-img' + (entry.reversed ? ' rev' : ''), src: entry.card.image,
            alt: `${entry.card.name} 카드${entry.reversed ? '(역방향)' : ''}`, loading: 'lazy', width: 72, height: 123,
          }),
          h('div', null,
            h('div', { class: 'interp-pos' }, `${i + 1}. ${entry.position} — ${entry.meaning}`),
            h('div', { class: 'interp-name' }, entry.card.name,
              entry.reversed ? h('span', { class: 'rev' }, '역방향') : null),
            h('p', { class: 'interp-kw' }, side.keywords),
            h('p', { class: 'interp-text' }, cardText(entry))
          )
        );
      })
    );
    el.result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resultText(r) {
    const spread = SPREADS[r.spreadKey];
    const lines = [`[거울 타로] ${spread.name}`];
    if (r.question) lines.push(`질문: ${r.question}`);
    lines.push('');
    r.reading.forEach((entry, i) => {
      lines.push(`${i + 1}. ${entry.position} — ${entry.card.name}${entry.reversed ? ' (역방향)' : ''}`);
      lines.push(`   ${cardText(entry)}`);
    });
    lines.push('', '[종합 해석]', ...synthesis({ key: r.spreadKey, name: spread.name }, r.question, r.reading));
    if (r.interpretation) lines.push('', '[Claude의 해석]', r.interpretation.replace(/\*\*/g, ''));
    return lines.join('\n');
  }

  async function copyResult() {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(resultText(current));
      el.btnCopy.textContent = '복사했어요';
    } catch {
      el.btnCopy.textContent = '복사 실패';
    }
    setTimeout(() => { el.btnCopy.textContent = '결과 복사'; }, 1500);
  }

  // 휴대폰처럼 공유 기능이 있는 브라우저에서만 공유 버튼을 보여 준다.
  async function shareResult() {
    if (!current) return;
    try {
      await navigator.share({ title: '거울 타로', text: resultText(current) });
    } catch {
      /* 공유를 취소했거나 막힌 환경 */
    }
  }

  // ----- 기록 (브라우저에만 저장) -----
  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(r) {
    const item = {
      date: r.date,
      question: r.question,
      spreadKey: r.spreadKey,
      cards: r.reading.map((e) => ({ id: e.card.id, position: e.position, reversed: e.reversed })),
      interpretation: r.interpretation || '',
    };
    try {
      const list = [item, ...loadHistory()].slice(0, HISTORY_MAX);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch {
      /* 저장 불가 환경에서는 기록 없이 동작 */
    }
  }

  function restore(item) {
    const byId = new Map(cards.map((c) => [c.id, c]));
    const meanings = SPREADS[item.spreadKey]?.meanings || [];
    const reading = item.cards
      .map((c, i) => ({ position: c.position, meaning: meanings[i] || '', card: byId.get(c.id), reversed: c.reversed }))
      .filter((e) => e.card);
    current = {
      question: item.question,
      spreadKey: item.spreadKey,
      reading,
      flipped: new Set(reading.map((_, i) => i)),
      date: item.date,
      interpretation: item.interpretation || '',
    };
    el.btnReveal.hidden = true;
    renderTable();
    renderResult(current);
  }

  function renderHistory() {
    const list = loadHistory();
    if (!list.length) {
      el.history.replaceChildren(h('li', { class: 'h-empty' }, '아직 기록이 없어요.'));
      return;
    }
    const byId = new Map(cards.map((c) => [c.id, c]));
    el.history.replaceChildren(
      ...list.map((item) => {
        const names = item.cards
          .map((c) => (byId.get(c.id)?.name || '?') + (c.reversed ? '(역)' : ''))
          .join(', ');
        const spread = SPREADS[item.spreadKey]?.name || '';
        return h('li', null,
          h('div', { class: 'h-meta' }, `${new Date(item.date).toLocaleString('ko-KR')} · ${spread}`),
          h('div', null, item.question || '(질문 없음)'),
          h('div', { class: 'h-meta' }, names),
          h('button', { type: 'button', onclick: () => restore(item) }, '다시 보기')
        );
      })
    );
  }

  // 아티팩트 안에서는 confirm() 창이 뜨지 않아, 한 번 더 눌러야 지워지게 한다.
  let clearArmed = null;
  function clearHistory() {
    if (!clearArmed) {
      el.btnClear.textContent = '한 번 더 누르면 지워요';
      clearArmed = setTimeout(() => { clearArmed = null; el.btnClear.textContent = '기록 지우기'; }, 3000);
      return;
    }
    clearTimeout(clearArmed);
    clearArmed = null;
    el.btnClear.textContent = '기록 지우기';
    try { localStorage.removeItem(HISTORY_KEY); } catch { /* 무시 */ }
    renderHistory();
  }

  // ----- Claude 해석 (claude.ai 아티팩트 안에서만) -----
  // 빌드 스크립트가 해석 프롬프트를 넣어 주고, 아티팩트 런타임이 sample(Claude 호출)을 준다.
  const EXPERT_PROMPT = window.TAROT_EXPERT_PROMPT || '';
  let sample = null;
  let aiCtl = null;

  function userMessage(r) {
    const spread = SPREADS[r.spreadKey];
    const lines = [
      `질문: ${r.question || '(질문 없이 전반적인 흐름을 보고 싶어요)'}`,
      `배열: ${spread.name} — ${spread.description}`,
      '',
      '뽑힌 카드:',
    ];
    r.reading.forEach((e, i) => {
      const c = e.card;
      const side = e.reversed ? c.reversed : c.upright;
      const kind = c.arcana === 'major' ? '메이저 아르카나' : `마이너 아르카나, ${c.suitName}(${c.element})`;
      lines.push(`${i + 1}. 위치 '${e.position}': ${c.name} / ${c.nameEn}, ${e.reversed ? '역방향' : '정방향'}, ${kind}, `
        + `번호 ${c.number}. 참고 키워드: ${side.keywords}. 참고 의미: ${side.meaning}`);
    });
    return lines.join('\n');
  }

  function buildPrompt(r) {
    return `${EXPERT_PROMPT}

## 이번 답변의 화면
답변은 휴대폰 웹 화면에 그대로 보여요. 위 출력 형식 중 터미널 관련 문구 대신 이 규칙을 따르세요: 굵게(**)와 "- " 목록만 쓰고, 표와 제목(#)은 쓰지 않습니다.

---

${userMessage(r)}`;
  }

  // 답변의 **굵게**와 "- " 목록만 화면 요소로 바꾼다. 나머지는 글자 그대로 넣는다.
  function inline(text) {
    return text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((part) =>
      part.startsWith('**') && part.endsWith('**') ? h('strong', null, part.slice(2, -2)) : part);
  }

  function renderAi(text) {
    const nodes = [];
    let list = null;
    text.split('\n').forEach((line) => {
      if (!line.trim()) return;
      if (/^\s*[-*] /.test(line) && !/^\s{2,}/.test(line)) {
        if (!list) { list = h('ul'); nodes.push(list); }
        list.append(h('li', null, inline(line.replace(/^\s*[-*] /, ''))));
      } else if (list && /^\s+/.test(line)) {
        list.lastChild.append(h('span', { class: 'ai-cont' }, inline(line.trim())));
      } else {
        list = null;
        nodes.push(h('p', null, inline(line.trim())));
      }
    });
    el.aiBody.replaceChildren(...nodes);
  }

  const AI_ERRORS = {
    cancelled: '해석을 멈췄어요.',
    rate_limited: '지금은 Claude를 더 부를 수 없어요. 잠시 뒤 다시 받아 보세요.',
    session_expired: 'claude.ai 로그인이 만료됐어요. 다시 로그인한 뒤 받아 보세요.',
    refused: '이 질문으로는 해석을 만들지 못했어요. 질문을 바꿔 다시 뽑아 보세요.',
    empty_completion: '해석이 비어 있었어요. 다시 받아 보세요.',
  };
  const AI_UNAVAILABLE = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'];

  function resetAi(r) {
    aiCtl?.abort();
    aiCtl = null;
    el.ai.hidden = !sample && !r.interpretation;
    el.btnAi.hidden = !sample;
    el.btnAi.disabled = false;
    el.btnAiStop.hidden = true;
    el.aiNote.textContent = '';
    if (r.interpretation) {
      renderAi(r.interpretation);
      el.btnAi.textContent = '다시 해석 받기';
    } else {
      el.aiBody.replaceChildren(h('p', { class: 'ai-wait' }, '카드를 모두 뒤집으면 Claude가 해석해 드려요.'));
      el.btnAi.textContent = '해석 받기';
    }
  }

  async function interpret(r, fresh) {
    if (!sample) return;
    aiCtl?.abort();
    const ctl = new AbortController();
    aiCtl = ctl;
    el.ai.hidden = false;
    el.btnAi.disabled = true;
    el.btnAiStop.hidden = false;
    el.aiNote.textContent = '';
    el.aiBody.replaceChildren(h('p', { class: 'ai-wait' }, 'Claude가 카드를 읽고 있어요. 30초쯤 걸릴 수 있어요.'));
    const options = { signal: ctl.signal, onText: ({ text }) => renderAi(text) };
    if (fresh) options.cache = false;
    try {
      const { text, truncated } = await sample(buildPrompt(r), options);
      renderAi(text);
      r.interpretation = text;
      saveInterpretation(r);
      if (truncated) el.aiNote.textContent = '해석이 길이 제한에 걸려 중간에 끊겼어요.';
    } catch (e) {
      if (AI_UNAVAILABLE.includes(e.code)) {
        sample = null;
        el.btnAi.hidden = true;
        el.aiBody.replaceChildren();
        el.aiNote.textContent = 'Claude 사용을 허용하지 않아 기본 해석만 보여 드려요.';
        return;
      }
      if (e.text) renderAi(e.text); else if (r.interpretation) renderAi(r.interpretation); else el.aiBody.replaceChildren();
      el.aiNote.textContent = AI_ERRORS[e.code] || '해석을 받는 중에 연결이 끊겼어요. 다시 받아 보세요.';
    } finally {
      if (aiCtl === ctl) {
        aiCtl = null;
        el.btnAi.disabled = false;
        el.btnAi.textContent = r.interpretation ? '다시 해석 받기' : '해석 받기';
        el.btnAiStop.hidden = true;
      }
    }
  }

  function saveInterpretation(r) {
    try {
      const list = loadHistory();
      const item = list.find((it) => it.date === r.date);
      if (!item) return;
      item.interpretation = r.interpretation;
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch {
      /* 저장 불가 환경에서는 화면에만 남긴다 */
    }
  }

  if (EXPERT_PROMPT && window.claude && window.claude.use) {
    window.claude.use('sample').then((s) => {
      sample = s;
      if (sample && current && !el.result.hidden) resetAi(current);
    }, () => {});
  }

  // ----- 카드 사전 -----
  const LIB_GROUPS = [
    { key: 'all', name: '전체' },
    { key: 'major', name: '메이저' },
    ...suits.map((s) => ({ key: s.key, name: `${s.ko} · ${s.element}` })),
  ];
  let libGroup = 'all';

  function renderLibFilters() {
    el.libFilters.replaceChildren(
      ...LIB_GROUPS.map((g) => h('button', {
        type: 'button',
        role: 'radio',
        'aria-checked': String(g.key === libGroup),
        onclick: () => { libGroup = g.key; renderLibFilters(); renderDictionary(el.dictSearch.value); },
      }, g.name))
    );
  }

  function renderDictionary(filter) {
    const q = (filter || '').trim().toLowerCase();
    const inGroup = (c) => libGroup === 'all' || (libGroup === 'major' ? c.arcana === 'major' : c.suit === libGroup);
    const match = (c) => !q || [c.name, c.nameEn, c.upright.keywords, c.reversed.keywords]
      .some((s) => s.toLowerCase().includes(q));
    const list = cards.filter((c) => inGroup(c) && match(c));
    el.libEmpty.hidden = list.length > 0;
    el.dictionary.replaceChildren(
      ...list.map((c) =>
        h('li', null,
          h('button', { type: 'button', class: 'lib-card', onclick: () => openCard(c) },
            h('img', { src: c.image, alt: '', loading: 'lazy', width: 240, height: 410 }),
            h('span', null, c.name)
          )
        )
      )
    );
  }

  function openCard(c) {
    const $d = (id) => el.dialog.querySelector(id);
    $d('#dlg-img').src = c.image;
    $d('#dlg-img').alt = `${c.name} 카드 그림`;
    $d('#dlg-kind').textContent = c.arcana === 'major'
      ? `메이저 아르카나 ${c.number}번`
      : `${c.suitName} · ${c.element}의 원소 · ${c.domain}`;
    $d('#dlg-name').textContent = c.name;
    $d('#dlg-en').textContent = c.nameEn;
    $d('#dlg-up-kw').textContent = c.upright.keywords;
    $d('#dlg-up').textContent = c.upright.meaning;
    $d('#dlg-rev-kw').textContent = c.reversed.keywords;
    $d('#dlg-rev').textContent = c.reversed.meaning;
    if (el.dialog.showModal) el.dialog.showModal();
    else el.dialog.setAttribute('open', '');
  }

  // ----- 뽑기 -----
  function startReading() {
    const reading = draw(cards, spreadKey, {
      allowReversed: el.optReversed.checked,
      majorOnly: el.optMajor.checked,
    });
    current = {
      question: el.question.value.trim(),
      spreadKey,
      reading,
      flipped: new Set(),
      date: new Date().toISOString(),
    };
    aiCtl?.abort();
    el.result.hidden = true;
    el.btnReveal.hidden = false;
    renderTable();
  }

  el.btnDraw.addEventListener('click', startReading);
  el.btnReveal.addEventListener('click', revealAll);
  el.btnCopy.addEventListener('click', copyResult);
  el.btnShare.hidden = !navigator.share;
  el.btnShare.addEventListener('click', shareResult);
  // 바깥(배경)을 누르면 카드 상세 창을 닫는다.
  el.dialog.addEventListener('click', (e) => { if (e.target === el.dialog) el.dialog.close(); });
  el.btnClear.addEventListener('click', clearHistory);
  el.btnAi.addEventListener('click', () => { if (current) interpret(current, true); });
  el.btnAiStop.addEventListener('click', () => aiCtl?.abort());
  el.question.addEventListener('keydown', (e) => { if (e.key === 'Enter') startReading(); });
  el.dictSearch.addEventListener('input', (e) => renderDictionary(e.target.value));

  renderSpreads();
  renderHistory();
  renderLibFilters();
  renderDictionary('');
})();
