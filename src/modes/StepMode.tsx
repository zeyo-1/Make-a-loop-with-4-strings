import { Fragment, useMemo, useRef, useState } from 'react';
import { RopeCanvas, type RopeCanvasHandle } from '../components/RopeCanvas';
import { Answer, V } from '../components/MathText';
import { WorkCard } from '../components/WorkCard';
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

const pairText = (s: Step) => `${LABELS[s.a]}と${LABELS[s.b]}`;

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

  const apply = (next: Step[]) => {
    setSteps(next);
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

  const lastResult = last && (
    <>
      前の手：<b>{pairText(last)}</b> →{' '}
      {last.closed ? <mark className="mk-close">輪が1つ閉じた</mark> : <mark className="mk-connect">2本がつながって1本になった</mark>}
    </>
  );

  return (
    <section className="mode mode-step" hidden={hidden} aria-label="1手ずつ結ぶ">
      <WorkCard
        n={analysis.n}
        chains={analysis.chains.length}
        kicker="1手ずつ順に相手を選ぼう"
        step={done ? undefined : `${steps.length + 1}回目`}
        title={
          done ? (
            '結び終わり！'
          ) : (
            <>
              <EndBadge e={source} size="lg" />
              の相手をえらぼう
            </>
          )
        }
        sub={
          done ? (
            <>
              輪が閉じたのは <b>{closedList}</b>。輪の数 <V>N</V> は「輪が閉じた回数」と同じです。
            </>
          ) : (
            <>
              <span className="how">
                端を<b>ドラッグして別の端に重ねる</b>と結べます（端を2つ続けて<b>タップ</b>してもOK）。
              </span>
              {last && <span className="last">{lastResult}</span>}
            </>
          )
        }
        tools={
          <>
            {!done && (
              <button
                type="button"
                className="btn btn-small"
                onClick={() => choose(candidates[Math.floor(Math.random() * candidates.length)])}
              >
                おまかせで選ぶ
              </button>
            )}
            <button
              type="button"
              className="btn btn-small btn-quiet"
              disabled={steps.length === 0}
              onClick={() => apply(steps.slice(0, -1))}
            >
              1手もどす
            </button>
            <button
              type="button"
              className={`btn btn-small${done ? ' btn-primary' : ' btn-quiet'}`}
              disabled={steps.length === 0}
              onClick={() => apply([])}
            >
              {done ? 'もう一度' : '最初から'}
            </button>
          </>
        }
      >
        <RopeCanvas
          ref={canvas}
          ties={ties}
          label={`1手ずつ結ぶ。${steps.length}回結んだところ。輪は${analysis.n}個`}
          source={source}
          candidates={candidates}
          canTie={(a, b) => (a === source && candidates.includes(b)) || (b === source && candidates.includes(a))}
          onTie={(a, b) => choose(a === source ? b : a)}
        />
      </WorkCard>

      <aside className="panel" aria-label="記録">
        <section className="panel-sec">
          <Tree steps={steps} />
        </section>

        <section className="panel-sec">
          <h3 className="panel-h">1〜3回目で輪が閉じた回</h3>
          {!reveal && <p className="ask-line">それぞれ何通りある？ そのときの輪の数 <V>N</V> は？</p>}
          <table className="patterns">
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
                      <Answer show={reveal}>
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
          <p className="note">黄色の行が、いま結んでいる道すじに当てはまる場合です。</p>
        </section>
      </aside>
    </section>
  );
}

/**
 * 結ぶたびの記録。最初は「ひも4本」だけ。1回結ぶごとに矢印と次の箱が増え、
 * その手で輪が「閉じた」か「閉じてない」かを箱に書く。
 */
function Tree({ steps }: { steps: Step[] }) {
  return (
    <figure className="tree" aria-label="結ぶたびの記録">
      <div className="tree-box">ひも4本（端8つ）</div>
      {steps.map((s, i) => {
        const k = 3 - i; // この手のあとに、まだ輪になっていないひもの本数
        return (
          <Fragment key={i}>
            <div className="tree-arrow" aria-hidden />
            <div className="tree-box">
              {k > 0 ? `ひも${k}本（端${2 * k}つ）` : '結び終わり'}
              <span className={`tree-tag ${s.closed ? 'is-closed' : 'is-open'}`}>
                <span className="sr-only">{i + 1}回目の結果：</span>
                {s.closed ? '閉じた' : '閉じてない'}
              </span>
            </div>
          </Fragment>
        );
      })}
    </figure>
  );
}
