import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { RopeCanvas, type RopeCanvasHandle } from '../components/RopeCanvas';
import { Answer, V } from '../components/MathText';
import { WorkCard } from '../components/WorkCard';
import { usePersistentState } from '../storage';
import { analyze, chainOtherEnd, freeEnds, LABELS, STRING_COLORS, tiesFromPairs } from '../logic/strings';

interface Step {
  a: number;
  b: number;
  closed: boolean;
}

/** 問4の表：1〜3回目のどこで輪が閉じたか（4回目は必ず閉じる） */
const PATTERNS = [
  { name: 'なし', closes: [0, 0, 0], n: 1 },
  { name: '1回目だけ', closes: [1, 0, 0], n: 2 },
  { name: '2回目だけ', closes: [0, 1, 0], n: 2 },
  { name: '3回目だけ', closes: [0, 0, 1], n: 2 },
  { name: '1回目と2回目', closes: [1, 1, 0], n: 3 },
  { name: '1回目と3回目', closes: [1, 0, 1], n: 3 },
  { name: '2回目と3回目', closes: [0, 1, 1], n: 3 },
  { name: '3回とも', closes: [1, 1, 1], n: 4 },
];

const NONE_FOUND = PATTERNS.map(() => false);

function EndBadge({ e, size = 'md' }: { e: number; size?: 'md' | 'lg' }) {
  return (
    <span className={`end-badge end-badge-${size}`} style={{ background: STRING_COLORS[e >> 1] }}>
      {LABELS[e]}
    </span>
  );
}

const pairText = (s: Step) => `${LABELS[s.a]}と${LABELS[s.b]}`;

export function StepMode({ hidden }: { hidden: boolean }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [found, setFound] = usePersistentState<boolean[]>('step.found', NONE_FOUND);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showAllN, setShowAllN] = useState(false);
  useEffect(() => {
    if (!confirmClear) return;
    const id = window.setTimeout(() => setConfirmClear(false), 4000);
    return () => clearTimeout(id);
  }, [confirmClear]);
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
    const next = [...steps, { a: source, b, closed: b === closing }];
    apply(next);
    if (next.length === 4) {
      const idx = PATTERNS.findIndex((p) => p.closes.every((c, i) => c === (next[i].closed ? 1 : 0)));
      if (idx >= 0) setFound((f) => f.map((v, i) => v || i === idx));
    }
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
          <div className="panel-head">
            <h3 className="panel-h">1〜3回目で輪が閉じた回</h3>
            <button type="button" className="btn btn-toggle" aria-pressed={showAllN} onClick={() => setShowAllN((v) => !v)}>
              {showAllN ? 'Nの値を隠す' : 'Nの値を表示'}
            </button>
          </div>
          <table className="patterns">
            <thead>
              <tr>
                <th scope="col">閉じた回</th>
                <th scope="col" className="num">
                  <V>N</V>
                </th>
              </tr>
            </thead>
            <tbody>
              {PATTERNS.map((p, idx) => {
                const possible = closedAt.slice(0, 3).every((c, i) => (c ? 1 : 0) === p.closes[i]);
                const exact = possible && steps.length >= 3;
                return (
                  <tr key={p.name} className={exact ? 'is-exact' : possible && steps.length > 0 ? 'is-possible' : ''}>
                    <th scope="row">{p.name}</th>
                    <td className="num">
                      {found[idx] ? (
                        <span className="found-n">{p.n}</span>
                      ) : (
                        <Answer show={showAllN}>{p.n}</Answer>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="note">
            黄色の行が、いま結んでいる道すじに当てはまる場合です。結び終わると、その行に <V>N</V> が書き込まれます。
          </p>
          <button
            type="button"
            className={`btn-text danger${confirmClear ? ' is-confirm' : ''}`}
            disabled={!found.some(Boolean)}
            onClick={() => {
              if (!confirmClear) return setConfirmClear(true);
              setFound(NONE_FOUND);
              setConfirmClear(false);
            }}
          >
            {confirmClear ? 'もう一度押すと表の N を消します' : '表の N を消す'}
          </button>
        </section>
      </aside>
    </section>
  );
}

/**
 * 結ぶたびの記録。箱と矢印は最初からうすく出しておき、結んだところから濃くする。
 * 矢印の左に「n回目」、右にその手で輪が「閉じた」か「閉じてない」かを書く。
 */
function Tree({ steps }: { steps: Step[] }) {
  const levels = [4, 3, 2, 1, 0];
  return (
    <figure className="tree" aria-label="結ぶたびの記録">
      {levels.map((k, i) => {
        const s = i > 0 ? steps[i - 1] : undefined; // この箱にたどりついた手
        return (
          <Fragment key={k}>
            {i > 0 && (
              <div className={`tree-edge${s ? ' is-done' : ''}`}>
                <span className="tree-step">{s ? `${i}回目` : ''}</span>
                <span className="tree-arrow" aria-hidden />
                <span className="tree-result">
                  {s && (
                    <span className={`tree-tag ${s.closed ? 'is-closed' : 'is-open'}`}>
                      <span className="sr-only">{i}回目の結果：</span>
                      {s.closed ? '閉じた' : '閉じてない'}
                    </span>
                  )}
                </span>
              </div>
            )}
            <div className={`tree-box${i <= steps.length ? '' : ' is-future'}`}>
              {k > 0 ? `ひも${k}本（端${2 * k}つ）` : '結び終わり'}
            </div>
          </Fragment>
        );
      })}
    </figure>
  );
}
