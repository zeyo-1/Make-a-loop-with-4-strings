import { useEffect, useMemo, useRef, useState } from 'react';
import { RopeCanvas, type RopeCanvasHandle } from '../components/RopeCanvas';
import { Answer, Frac, V } from '../components/MathText';
import {
  analyze,
  emptyTies,
  EXPECTED_N,
  LABELS,
  randomPairs,
  THEORY_FRACTIONS,
  THEORY_OUT_OF_105,
  tiesFromPairs,
  type Ties,
} from '../logic/strings';
import { usePersistentState } from '../storage';

type Counts = [number, number, number, number];
const ZERO: Counts = [0, 0, 0, 0];

interface Props {
  hidden: boolean;
  teacher: boolean;
  reveal: boolean;
}

export function RandomMode({ hidden, teacher, reveal }: Props) {
  const [ties, setTies] = useState<Ties>(emptyTies);
  const [counts, setCounts] = usePersistentState<Counts>('random.counts', ZERO);
  const [recent, setRecent] = usePersistentState<number[]>('random.recent', []);
  const [prediction, setPrediction] = usePersistentState<number | null>('random.prediction', null);
  const [busy, setBusy] = useState(false);
  const [lastPairs, setLastPairs] = useState<[number, number][] | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const canvas = useRef<RopeCanvasHandle>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
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

  const runOnce = () => {
    if (busy) return;
    setBusy(true);
    setLastPairs(null);
    const pairs = randomPairs();
    const empty = emptyTies();
    setTies(empty);
    canvas.current?.straighten(empty, 350);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const stepMs = reduce ? 120 : 520;
    pairs.forEach((_, i) => {
      timers.current.push(
        window.setTimeout(() => {
          const t = tiesFromPairs(pairs.slice(0, i + 1));
          setTies(t);
          canvas.current?.arrange(t, reduce ? 0 : 450);
          if (i === pairs.length - 1) {
            record([analyze(t).n]);
            setLastPairs(pairs);
            setBusy(false);
          }
        }, 420 + i * stepMs),
      );
    });
  };

  const runMany = (times: number) => {
    if (busy) return;
    const ns: number[] = [];
    let pairs: [number, number][] = [];
    for (let i = 0; i < times; i++) {
      pairs = randomPairs();
      ns.push(analyze(tiesFromPairs(pairs)).n);
    }
    const t = tiesFromPairs(pairs);
    setTies(t);
    setLastPairs(pairs);
    canvas.current?.arrange(t, 450);
    record(ns);
  };

  const mean = total > 0 ? counts.reduce((s, c, i) => s + c * (i + 1), 0) / total : null;
  const done = current.tieCount === 4;

  return (
    <section className="mode" hidden={hidden} aria-label="ランダムに結ぶ">
      <div className="mode-stage">
        <RopeCanvas ref={canvas} ties={ties} label={`ランダムに結んだ結果。輪は${current.n}個`} canTie={() => false} />
        <div className="stage-foot" aria-live="polite">
          {busy ? (
            <span className="muted">結んでいます…</span>
          ) : done ? (
            <>
              <span className="foot-n">
                <V>N</V> = {current.n}
              </span>
              {lastPairs && (
                <span className="foot-pairs">{lastPairs.map(([a, b]) => `${LABELS[a]}と${LABELS[b]}`).join('、')}</span>
              )}
            </>
          ) : (
            <span className="muted">「ランダムに結ぶ」を押すと、8つの端が無作為に2つずつ結ばれます。</span>
          )}
        </div>
      </div>

      <aside className="panel">
        <div className="predict">
          <h3 className="panel-h">
            予想：いちばん多く出る <V>N</V> は？
          </h3>
          <div className="seg" role="radiogroup" aria-label="予想">
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

        <div className="run">
          <button type="button" className="btn btn-primary btn-big" onClick={runOnce} disabled={busy}>
            {busy ? '結んでいます…' : 'ランダムに結ぶ'}
          </button>
          <div className="btn-row many">
            <span className="many-label">まとめて</span>
            {[10, 100, 1000].map((k) => (
              <button
                key={k}
                type="button"
                className="btn"
                onClick={() => runMany(k)}
                disabled={busy}
                aria-label={`${k}回まとめて結ぶ`}
              >
                {k}回
              </button>
            ))}
          </div>
        </div>

        <ResultTable counts={counts} prediction={prediction} reveal={reveal} />

        <p className="mean">
          <span>
            {total}回の平均 <V>N</V> = {mean == null ? '—' : mean.toFixed(3)}
          </span>
          {reveal && (
            <span className="answer">
              期待値 <Frac n={EXPECTED_N[0]} d={EXPECTED_N[1]} /> ≈ {(EXPECTED_N[0] / EXPECTED_N[1]).toFixed(3)}
            </span>
          )}
        </p>

        {recent.length > 0 && (
          <div className="recent">
            <h3 className="panel-h">最近の結果（新しいものが右）</h3>
            <p className="recent-list">
              {recent.slice(-24).map((n, i) => (
                <span key={i} className={`recent-n n${n}`}>
                  {n}
                </span>
              ))}
            </p>
          </div>
        )}

        {teacher && <ClassInput onAdd={(add) => setCounts((c) => c.map((v, i) => v + add[i]) as Counts)} />}

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

function ResultTable({ counts, prediction, reveal }: { counts: Counts; prediction: number | null; reveal: boolean }) {
  const total = counts.reduce((a, b) => a + b, 0);
  const maxRel = Math.max(0.5, ...counts.map((c) => (total ? c / total : 0)));
  return (
    <table className="result">
      <caption>実演の結果（{total}回）</caption>
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
          {reveal && <th scope="col">確率</th>}
        </tr>
      </thead>
      <tbody>
        {counts.map((c, i) => {
          const rel = total ? c / total : 0;
          const [tn, td] = THEORY_FRACTIONS[i];
          const p = THEORY_OUT_OF_105[i] / 105;
          return (
            <tr key={i} className={prediction === i + 1 ? 'is-predicted' : ''}>
              <th scope="row">
                {i + 1}
                {prediction === i + 1 && <span className="pred-tag">予想</span>}
              </th>
              <td className="col-bar">
                <div className="bar-track">
                  <div className="bar" style={{ width: `${(rel / maxRel) * 100}%` }} />
                  {reveal && <div className="bar-theory" style={{ left: `${(p / maxRel) * 100}%` }} />}
                </div>
              </td>
              <td className="num">{c}</td>
              <td className="num">{total ? rel.toFixed(3) : '—'}</td>
              {reveal && (
                <td className="num">
                  <Answer show>
                    <Frac n={tn} d={td} />
                  </Answer>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ClassInput({ onAdd }: { onAdd: (add: number[]) => void }) {
  const [vals, setVals] = useState(['', '', '', '']);
  const nums = vals.map((v) => Math.max(0, Math.floor(Number(v) || 0)));
  const sum = nums.reduce((a, b) => a + b, 0);
  return (
    <form
      className="class-input"
      onSubmit={(e) => {
        e.preventDefault();
        if (sum === 0) return;
        onAdd(nums);
        setVals(['', '', '', '']);
      }}
    >
      <h3 className="panel-h">クラスの結果を足す</h3>
      <div className="class-grid">
        {vals.map((v, i) => (
          <label key={i}>
            <span>
              <V>N</V>={i + 1}
            </span>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={v}
              onChange={(e) => setVals((old) => old.map((o, j) => (j === i ? e.target.value.replace(/[^0-9]/g, '') : o)))}
              aria-label={`N=${i + 1} の回数`}
            />
          </label>
        ))}
      </div>
      <button type="submit" className="btn" disabled={sum === 0}>
        {sum > 0 ? `${sum}回分を足す` : '回数を入れて足す'}
      </button>
    </form>
  );
}
