import { useEffect, useMemo, useRef, useState } from 'react';
import { RopeCanvas, type RopeCanvasHandle } from '../components/RopeCanvas';
import { V } from '../components/MathText';
import { WorkCard } from '../components/WorkCard';
import {
  analyze,
  emptyTies,
  LABELS,
  randomPairs,
  tiesFromPairs,
  type Ties,
} from '../logic/strings';
import { usePersistentState } from '../storage';

type Counts = [number, number, number, number];
const ZERO: Counts = [0, 0, 0, 0];

interface Props {
  hidden: boolean;
}

export function RandomMode({ hidden }: Props) {
  const [ties, setTies] = useState<Ties>(emptyTies);
  const [counts, setCounts] = usePersistentState<Counts>('random.counts', ZERO);
  const [recent, setRecent] = usePersistentState<number[]>('random.recent', []);
  const [prediction, setPrediction] = usePersistentState<number | null>('random.prediction', null);
  const [lastPairs, setLastPairs] = useState<[number, number][] | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const canvas = useRef<RopeCanvasHandle>(null);
  useEffect(() => {
    if (!confirmClear) return;
    const id = window.setTimeout(() => setConfirmClear(false), 4000);
    return () => clearTimeout(id);
  }, [confirmClear]);

  const total = counts.reduce((a, b) => a + b, 0);
  const current = useMemo(() => analyze(ties), [ties]);

  const record = (ns: number[]) => {
    setCounts((c) => {
      const next = [...c] as Counts;
      for (const n of ns) next[n - 1]++;
      return next;
    });
    setRecent((r) => [...r, ...ns.slice(-40)].slice(-40));
  };

  // 1回でも10回でも、結果の形へ一度だけなめらかに動かす
  const run = (times: number) => {
    const ns: number[] = [];
    let pairs: [number, number][] = [];
    for (let i = 0; i < times; i++) {
      pairs = randomPairs();
      ns.push(analyze(tiesFromPairs(pairs)).n);
    }
    const t = tiesFromPairs(pairs);
    setTies(t);
    setLastPairs(pairs);
    canvas.current?.arrange(t, 500);
    record(ns);
  };

  const mean = total > 0 ? counts.reduce((s, c, i) => s + c * (i + 1), 0) / total : null;
  const done = current.tieCount === 4 && lastPairs != null;

  const pairsText = lastPairs?.map(([a, b]) => `${LABELS[a]}と${LABELS[b]}`).join('、');

  return (
    <section className="mode mode-random" hidden={hidden} aria-label="ランダムに結ぶ">
      <WorkCard
        n={current.n}
        chains={current.chains.length}
        title="ランダムに結んで、輪の数を調べよう"
        sub={
          done ? (
            <>
              今回：<b>{pairsText}</b> → <mark className="mk-close">輪が{current.n}個</mark>
            </>
          ) : prediction == null ? (
            <>
              まず <b>①</b> で、いちばん多く出る輪の数 <V>N</V> を予想しよう。
            </>
          ) : (
            <>
              <b>②</b> の<b>「ランダムに結ぶ」</b>を押そう。8つの端が無作為に2つずつ結ばれます。
            </>
          )
        }
        actionsFull
        actions={
          <div className="flow">
            <div className={`flow-row${prediction == null ? ' is-next' : ''}`}>
              <span className="flow-step">
                <span className="flow-num">1</span>予想
              </span>
              <span className="flow-q">
                いちばん多く出る <V>N</V> は？
              </span>
              <div className="seg seg-inline" role="radiogroup" aria-label="予想：いちばん多く出る N">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={prediction === n}
                    className={prediction === n ? 'is-on' : ''}
                    onClick={() => setPrediction(prediction === n ? null : n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className={`flow-row${prediction != null ? ' is-next' : ''}`}>
              <span className="flow-step">
                <span className="flow-num">2</span>結ぶ
              </span>
              <button type="button" className="btn btn-primary btn-run" onClick={() => run(1)}>
                ランダムに結ぶ
              </button>
              <div className="many" role="group" aria-label="まとめて結ぶ">
                <span className="many-label">まとめて</span>
                {[10, 100, 1000].map((k) => (
                  <button key={k} type="button" className="btn btn-small" onClick={() => run(k)} aria-label={`${k}回まとめて結ぶ`}>
                    {k}回
                  </button>
                ))}
              </div>
            </div>
          </div>
        }
      >
        <RopeCanvas ref={canvas} ties={ties} label={`ランダムに結んだ結果。輪は${current.n}個`} canTie={() => false} />
      </WorkCard>

      <aside className="panel" aria-label="記録">
        <section className="panel-sec">
          <h3 className="panel-h">実演の結果（{total}回）</h3>
          <ResultTable counts={counts} prediction={prediction} />
          <p className="mean">
            <span>
              平均 <V>N</V> = {mean == null ? '—' : mean.toFixed(3)}
            </span>
          </p>
        </section>

        {recent.length > 0 && (
          <section className="panel-sec">
            <h3 className="panel-h">最近の結果（新しいものが右）</h3>
            <p className="recent-list">
              {recent.slice(-24).map((n, i) => (
                <span key={i} className="recent-n">
                  {n}
                </span>
              ))}
            </p>
          </section>
        )}

        <button
          type="button"
          className={`btn-text danger${confirmClear ? ' is-confirm' : ''}`}
          onClick={() => {
            if (!confirmClear) return setConfirmClear(true);
            setCounts(ZERO);
            setRecent([]);
            setConfirmClear(false);
          }}
          disabled={total === 0 && recent.length === 0}
        >
          {confirmClear ? 'もう一度押すと記録を消します' : '記録を消す'}
        </button>
      </aside>
    </section>
  );
}

function ResultTable({ counts, prediction }: { counts: Counts; prediction: number | null }) {
  const total = counts.reduce((a, b) => a + b, 0);
  const maxRel = Math.max(0.5, ...counts.map((c) => (total ? c / total : 0)));
  return (
    <table className="result">
      <thead>
        <tr>
          <th scope="col">
            <V>N</V>
          </th>
          <th scope="col" className="col-bar">
            <span className="sr-only">グラフ</span>
          </th>
          <th scope="col">回数</th>
          <th scope="col">相対度数</th>
        </tr>
      </thead>
      <tbody>
        {counts.map((c, i) => {
          const rel = total ? c / total : 0;
          return (
            <tr key={i} className={prediction === i + 1 ? 'is-predicted' : ''}>
              <th scope="row">
                {i + 1}
                {prediction === i + 1 && <span className="pred-tag">予想</span>}
              </th>
              <td className="col-bar">
                <div className="bar-track">
                  <div className="bar" style={{ width: `${(rel / maxRel) * 100}%` }} />
                </div>
              </td>
              <td className="num">{c}</td>
              <td className="num">{total ? rel.toFixed(3) : '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
