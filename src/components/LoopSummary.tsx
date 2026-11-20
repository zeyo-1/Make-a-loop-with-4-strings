import { LABELS, LOOP_COLORS, pairList, STRING_COLORS, STRING_NAMES, type Analysis, type Ties } from '../logic/strings';
import { V } from './MathText';

/** 輪の数 N と、それぞれの輪がどのひもでできているか */
export function LoopSummary({ analysis, done }: { analysis: Analysis; done: boolean }) {
  const { n, loops, chains } = analysis;
  return (
    <div className="summary" aria-live="polite">
      <div className="summary-n">
        <span className="summary-label">輪の数</span>
        <span className="summary-value">
          <V>N</V>
          <span className="eq">=</span>
          <span className="num">{n}</span>
        </span>
      </div>
      <p className="summary-sub">
        {done ? '結び終わり' : chains.length > 0 ? `まだ輪になっていないひも ${chains.length}本` : ''}
      </p>
      {loops.length > 0 && (
        <ul className="loop-chips">
          {loops.map((loop, i) => (
            <li key={i}>
              <span className="chip" style={{ background: LOOP_COLORS[i] }}>
                輪{i + 1}
              </span>
              <span className="chip-strings">
                {[...loop.strings].sort((x, y) => x - y).map((s) => (
                  <span key={s} style={{ color: STRING_COLORS[s] }}>
                    {STRING_NAMES[s]}
                  </span>
                ))}
              </span>
              <span className="chip-count">ひも{loop.strings.length}本</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 結んだ組の一覧（ワークシートに書き写せる形） */
export function PairList({ ties, onUntie }: { ties: Ties; onUntie?: (e: number) => void }) {
  const pairs = pairList(ties);
  return (
    <div className="pairs">
      <h3 className="panel-h">結んだ組</h3>
      {pairs.length === 0 ? (
        <p className="muted">まだ結んでいません</p>
      ) : (
        <ul className="pair-list">
          {pairs.map(([a, b]) => (
            <li key={a}>
              <span className="pair-text">
                <b style={{ color: STRING_COLORS[a >> 1] }}>{LABELS[a]}</b>と
                <b style={{ color: STRING_COLORS[b >> 1] }}>{LABELS[b]}</b>
              </span>
              {onUntie && (
                <button type="button" className="btn-text" onClick={() => onUntie(a)}>
                  ほどく
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
