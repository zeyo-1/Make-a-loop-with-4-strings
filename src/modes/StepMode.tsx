import { useMemo, useRef, useState } from 'react';
import { RopeCanvas, type RopeCanvasHandle } from '../components/RopeCanvas';
import { Answer, Frac, V } from '../components/MathText';
import {
  analyze,
  chainOtherEnd,
  emptyTies,
  freeEnds,
  LABELS,
  STRING_COLORS,
  tiesFromPairs,
} from '../logic/strings';

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

export function StepMode({ hidden, reveal }: { hidden: boolean; reveal: boolean }) {
  const [steps, setSteps] = useState<Step[]>([]);
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
    const t = tiesFromPairs(next.map((s) => [s.a, s.b]));
    canvas.current?.arrange(t, 600);
  };

  const choose = (b: number) => {
    if (done || !candidates.includes(b)) return;
    apply([...steps, { a: source, b, closed: b === closing }]);
  };

  const closedAt = steps.map((s) => s.closed);
  const matchRow = (closes: number[]) => closedAt.slice(0, 3).every((c, i) => (c ? 1 : 0) === closes[i]);

  return (
    <section className="mode" hidden={hidden} aria-label="1手ずつ結ぶ">
      <div className="mode-stage">
        <RopeCanvas
          ref={canvas}
          ties={ties}
          label={`1手ずつ結ぶ。${steps.length}手目まで。輪は${analysis.n}個`}
          source={source}
          candidates={candidates}
          closingEnd={closing}
          canTie={(a, b) => (a === source && candidates.includes(b)) || (b === source && candidates.includes(a))}
          onTie={(a, b) => choose(a === source ? b : a)}
        />
        <div className="stage-n" aria-hidden>
          <V>N</V> = {analysis.n}
        </div>
        <p className="stage-hint">
          {done ? (
            '結び終わりました。「最初から」でもう一度。'
          ) : (
            <>
              <b>{LABELS[source]}</b> の相手を選びます。候補の端をタップしてください。
              <span className="legend">
                <span className="lg lg-cand" />
                つながる
                <span className="lg lg-close" />
                輪が閉じる
              </span>
            </>
          )}
        </p>
      </div>

      <aside className="panel">
        <div className="step-now" aria-live="polite">
          {done ? (
            <p className="step-title">
              結び終わり：輪が閉じたのは{' '}
              {closedAt
                .map((c, i) => (c ? `${i + 1}回目` : null))
                .filter(Boolean)
                .join('と')}
              <span className="step-result">
                <V>N</V> = {analysis.n}
              </span>
            </p>
          ) : (
            <>
              <p className="step-title">
                {steps.length + 1}回目：まだ輪になっていないひも <b>{remaining}本</b>（端 {remaining * 2}つ）
              </p>
              <p className="step-detail">
                <b>{LABELS[source]}</b> の相手の候補は{' '}
                <Answer show={reveal}>{2 * remaining - 1}通り</Answer>
                。そのうち輪が閉じるのは <Answer show={reveal}>1通り</Answer>（
                <b style={{ color: STRING_COLORS[closing >> 1] }}>{LABELS[closing]}</b>）。
              </p>
            </>
          )}
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={done}
              onClick={() => choose(candidates[Math.floor(Math.random() * candidates.length)])}
            >
              ランダムに選ぶ
            </button>
            <button type="button" className="btn" disabled={steps.length === 0} onClick={() => apply(steps.slice(0, -1))}>
              1手もどす
            </button>
            <button
              type="button"
              className="btn"
              disabled={steps.length === 0}
              onClick={() => {
                setSteps([]);
                canvas.current?.straighten(emptyTies());
              }}
            >
              最初から
            </button>
          </div>
          {steps.length > 0 && (
            <ol className="step-log">
              {steps.map((s, i) => (
                <li key={i}>
                  <span className="step-log-pair">
                    {LABELS[s.a]}と{LABELS[s.b]}
                  </span>
                  <span className={s.closed ? 'tag-close' : 'tag-connect'}>{s.closed ? '輪が閉じた' : 'つながった'}</span>
                </li>
              ))}
            </ol>
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
              const possible = matchRow(p.closes);
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
