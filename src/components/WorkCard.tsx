import type { ReactNode } from 'react';
import { V } from './MathText';

interface Props {
  /** 見出しの上の小見出し（例：1手ずつ順に相手を選ぼう） */
  kicker?: ReactNode;
  /** 見出しの前の小さな札（例：3回目） */
  step?: ReactNode;
  /** いま何をするか（大きく） */
  title: ReactNode;
  /** 補足・直前の結果 */
  sub?: ReactNode;
  /** 主な操作（左側） */
  actions?: ReactNode;
  /** 主な操作を横いっぱいに使う */
  actionsFull?: boolean;
  /** もどす・やり直しなどの補助の操作（右側） */
  tools?: ReactNode;
  /** 輪の数 */
  n: number;
  /** まだ輪になっていないひもの本数 */
  chains: number;
  /** ひもの図 */
  children: ReactNode;
}

/**
 * 3つのタブ共通の作業エリア。
 * 上から「いま何をするか → 操作 → ひもの図」の順に1枚のカードにまとめ、
 * 輪の数 N はいつも右上に出す。
 */
export function WorkCard({ kicker, step, title, sub, actions, actionsFull, tools, n, chains, children }: Props) {
  return (
    <div className="work">
      <div className="work-head">
        <div className="work-text">
          {kicker && <p className="work-kicker">{kicker}</p>}
          <h2 className="work-title">
            {step && <span className="work-step">{step}</span>}
            {title}
          </h2>
          {sub && <div className="work-sub">{sub}</div>}
        </div>
        <div className="nbadge" aria-live="polite">
          <span className="nbadge-label">輪の数</span>
          <span className="nbadge-val">
            <V>N</V>
            <span className="nbadge-eq">=</span>
            <span className="nbadge-num">{n}</span>
          </span>
          <span className="nbadge-sub">{chains > 0 ? `輪でないひも ${chains}本` : '結び終わり'}</span>
        </div>
      </div>
      {(actions || tools) && (
        <div className="work-actions">
          {actions && <div className={`work-primary${actionsFull ? ' work-primary-full' : ''}`}>{actions}</div>}
          {tools && <div className="work-tools">{tools}</div>}
        </div>
      )}
      <div className="work-stage">{children}</div>
    </div>
  );
}
