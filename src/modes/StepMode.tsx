import { useMemo, useRef, useState } from 'react';
import { RopeCanvas, type RopeCanvasHandle } from '../components/RopeCanvas';
import { Answer, Frac, V } from '../components/MathText';
import { analyze, chainOtherEnd, freeEnds, LABELS, STRING_COLORS, tiesFromPairs } from '../logic/strings';

interface Step {
  a: number;
  b: number;
  closed: boolean;
}

/** 問4の表：1〜3回目のどこで輪が閉じたか（4回目は必ず閉じる） */
const PATTERNS = [
  { name: 'なし', closes: [0, 0, 0], ways: '6 × 4 × 2', count: 48, n: 1 },
  { name: '1回目だけ', closes: [1, 0, 0], ways: '1 × 4 × 2', count: 8, n: 2 },
  { name: '2回目だけ', closes: [0, 1, 0], ways: '6 × 1 × 2', count: 12, n: 2 },
  { name: '3回目だけ', closes: [0, 0, 1], ways: '6 × 4 × 1', count: 24, n: 2 },
  { name: '1回目と2回目', closes: [1, 1, 0], ways: '1 × 1 × 2', count: 2, n: 3 },
  { name: '1回目と3回目', closes: [1, 0, 1], ways: '1 × 4 × 1', count: 4, n: 3 },
  { name: '2回目と3回目', closes: [0, 1, 1], ways: '6 × 1 × 1', count: 6, n: 3 },
  { name: '3回とも', closes: [1, 1, 1], ways: '1 × 1 × 1', count: 1, n: 4 },
];

function EndBadge({ e, size = 'md' }: { e: number; size?: 'md' | 'lg' }) {
  return (
    <span className={`end-badge end-badge-${size}`} style={{ background: STRING_COLORS[e >> 1] }}>
      {LABELS[e]}
    </span>
  );
}

export function StepMode({ hidden, reveal }: { hidden: boolean; reveal: boolean }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [hover, setHover] = useState(-1);
  const canvas = useRef<RopeCanvasHandle>(null);
  const ties = useMemo(() => tiesFromPairs(steps.map((s) => [s.a, s.b])), [steps]);
  const analysis = useMemo(() => analyze(ties), [ties]);
  const free = freeEnds(ties);
  const done = free.length === 0;
  const source = done ? -1 : free[0];
  const candidates = done ? [] : free.slice(1);
  const closing = done ? -1 : chainOtherEnd(ties, source);
  const remaining = 4 - steps.length; // まだ輪になっていないひもの本数

  const apply = (next: Step[]) => {
    setSteps(next);
    setHover(-1);
    canvas.current?.arrange(
      tiesFromPairs(next.map((s) => [s.a, s.b])),
      600,
    );
  };

  const choose = (b: number) => {
    if (done || !candidates.includes(b)) return;
    apply([...steps, { a: source, b, closed: b === closing }]);
  };

  const closedAt = steps.map((s) => s.closed);
  const closedList = closedAt.map((c, i) => (c ? `${i + 1}回目` : null)).filter(Boolean).join('と');
  const last = steps[steps.length - 1];

  return (
    <section className="mode mode-step" hidden={hidden} aria-label="1手ずつ結ぶ">
      <div className="mode-stage">
        <div className="step-card">
          <ol className="step-progress" aria-label="進み具合">
            {[0, 1, 2, 3].map((i) => {
              const s = steps[i];
              const state = s ? (s.closed ? 'closed' : 'connected') : i === steps.length ? 'current' : 'future';
              return (
                <li key={i} className={`sp sp-${state}`}>
                  <span className="sp-num">{i + 1}回目</span>
                  <span className="sp-pair">{s ? `${LABELS[s.a]}と${LABELS[s.b]}` : state === 'current' ? 'いまここ' : '　'}</span>
                  <span className="sp-out">{s ? (s.closed ? '輪が閉じた' : 'つながった') : '　'}</span>
                </li>
              );
            })}
          </ol>

          <p className="sr-only" aria-live="polite">
            {last
              ? `${LABELS[last.a]}と${LABELS[last.b]}を結びました。${last.closed ? '輪が1つ閉じました。' : '2本がつながって1本のひもになりました。'}`
              : ''}
          </p>

          {done ? (
            <p className="step-q step-done">
              結び終わり！ 輪が閉じたのは{closedList}。
              <span className="step-result">
                <V>N</V> = {analysis.n}
              </span>
            </p>
          ) : (
            <>
              <p className="step-q">
                <EndBadge e={source} size="lg" />
                <span>
                  の相手をえらぼう
                  <small>まだ結んでいない端のうち、アルファベット順で最初の端です</small>
                </span>
              </p>
              <div className="cand-grid" role="group" aria-label={`${LABELS[source]}の相手の候補`}>
                {candidates.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`cand ${c === closing ? 'cand-same' : 'cand-other'}`}
                    onClick={() => choose(c)}
                    onPointerEnter={() => setHover(c)}
                    onPointerLeave={() => setHover(-1)}
                    onFocus={() => setHover(c)}
                    onBlur={() => setHover(-1)}
                    aria-label={`${LABELS[c]}（${c === closing ? '同じひもの反対の端' : '別のひもの端'}）と結ぶ`}
                  >
                    <EndBadge e={c} />
                    <span className="cand-tag">{c === closing ? '同じひも' : '別のひも'}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="step-tools">
            {!done && (
              <button
                type="button"
                className="btn btn-small"
                onClick={() => choose(candidates[Math.floor(Math.random() * candidates.length)])}
              >
                おまかせで選ぶ
              </button>
            )}
            <button type="button" className="btn btn-small" disabled={steps.length === 0} onClick={() => apply(steps.slice(0, -1))}>
              1手もどす
            </button>
            <button
              type="button"
              className={`btn btn-small${done ? ' btn-primary' : ''}`}
              disabled={steps.length === 0}
              onClick={() => apply([])}
            >
              {done ? 'もう一度' : '最初から'}
            </button>
          </div>
        </div>

        <div className="stage-wrap">
          <RopeCanvas
            ref={canvas}
            ties={ties}
            label={`1手ずつ結ぶ。${steps.length}回結んだところ。輪は${analysis.n}個`}
            source={source}
            candidates={candidates}
            closingEnd={closing}
            highlight={hover}
            canTie={(a, b) => (a === source && candidates.includes(b)) || (b === source && candidates.includes(a))}
            onTie={(a, b) => choose(a === source ? b : a)}
          />
          <div className="stage-n" aria-hidden>
            <V>N</V> = {analysis.n}
          </div>
        </div>
      </div>

      <aside className="panel">
        <div className="step-explain">
          <h3 className="panel-h">考えよう</h3>
          {done ? (
            <p>
              4回目は必ず輪が閉じます。輪の数 <V>N</V> は「輪が閉じた回数」と同じです。
            </p>
          ) : (
            <p>
              まだ輪になっていないひもは <b>{remaining}本</b>（端 {remaining * 2}つ）。 まだ結んでいない端のうちアルファベット順で最初の{' '}
              <b style={{ color: STRING_COLORS[source >> 1] }}>{LABELS[source]}</b> の相手の候補は{' '}
              <Answer show={reveal}>{2 * remaining - 1}通り</Answer>。そのうち輪が閉じるのは{' '}
              <Answer show={reveal}>1通り</Answer>。
            </p>
          )}
        </div>

        <Tree steps={steps} reveal={reveal} />

        <table className="patterns">
          <caption>1〜3回目で輪が閉じた回（問4）</caption>
          <thead>
            <tr>
              <th scope="col">閉じた回</th>
              <th scope="col">通り数</th>
              <th scope="col">
                <V>N</V>
              </th>
            </tr>
          </thead>
          <tbody>
            {PATTERNS.map((p) => {
              const possible = closedAt.slice(0, 3).every((c, i) => (c ? 1 : 0) === p.closes[i]);
              const exact = possible && steps.length >= 3;
              return (
                <tr key={p.name} className={exact ? 'is-exact' : possible && steps.length > 0 ? 'is-possible' : ''}>
                  <th scope="row">{p.name}</th>
                  <td>
                    <Answer show={reveal} wide>
                      {p.ways} = {p.count}
                    </Answer>
                  </td>
                  <td className="num">
                    <Answer show={reveal}>{p.n}</Answer>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">合計</th>
              <td>
                <Answer show={reveal}>105</Answer>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </aside>
    </section>
  );
}

/** 3ページ目の図：1回結ぶたびに、ひもは必ず1本減る */
function Tree({ steps, reveal }: { steps: Step[]; reveal: boolean }) {
  const levels = [4, 3, 2, 1];
  return (
    <figure className="tree" aria-label="1回結ぶたびに、ひもは必ず1本減る">
      <figcaption>1回結ぶたびに、ひもは必ず1本減る</figcaption>
      {levels.map((k, i) => {
        const taken = steps[i];
        const isCurrent = steps.length === i;
        const reached = steps.length >= i;
        return (
          <div key={k} className="tree-block">
            <div className={`tree-box${isCurrent ? ' is-current' : ''}${reached ? '' : ' is-future'}`}>
              ひも{k}本（端{2 * k}つ）
            </div>
            <div className="tree-edge">
              <div className={`tree-side tree-left${taken && !taken.closed ? ' is-taken' : ''}`}>
                {k > 1 && (
                  <>
                    つながる{' '}
                    <Answer show={reveal}>
                      <Frac n={2 * k - 2} d={2 * k - 1} />
                    </Answer>
                  </>
                )}
              </div>
              <div className={`tree-arrow${taken ? (taken.closed ? ' is-close' : ' is-connect') : ''}`} aria-hidden />
              <div className={`tree-side tree-right${taken?.closed ? ' is-taken' : ''}`}>
                {k > 1 ? '輪が閉じる' : '必ず輪が閉じる'}{' '}
                <Answer show={reveal}>{k > 1 ? <Frac n={1} d={2 * k - 1} /> : '1'}</Answer>
              </div>
            </div>
          </div>
        );
      })}
      <div className={`tree-box${steps.length === 4 ? ' is-current' : ' is-future'}`}>結び終わり</div>
    </figure>
  );
}
