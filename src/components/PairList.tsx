import { LABELS, pairList, STRING_COLORS, type Ties } from '../logic/strings';

/** 結んだ組の一覧（ワークシートに書き写せる形） */
export function PairList({ ties, onUntie }: { ties: Ties; onUntie?: (e: number) => void }) {
  const pairs = pairList(ties);
  if (pairs.length === 0) return <p className="muted">まだ結んでいません</p>;
  return (
    <ul className="pair-list">
      {pairs.map(([a, b]) => (
        <li key={a}>
          <span className="pair-text">
            <b style={{ color: STRING_COLORS[a >> 1] }}>{LABELS[a]}</b>と
            <b style={{ color: STRING_COLORS[b >> 1] }}>{LABELS[b]}</b>
          </span>
          {onUntie && (
            <button type="button" className="btn-text" onClick={() => onUntie(a)} aria-label={`${LABELS[a]}と${LABELS[b]}をほどく`}>
              ほどく
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
