import type { ReactNode } from 'react';

/** 分数（ワークシートと同じ縦書きの形） */
export function Frac({ n, d, className }: { n: ReactNode; d: ReactNode; className?: string }) {
  return (
    <span className={`frac ${className ?? ''}`} role="math" aria-label={`${d}分の${n}`}>
      <span className="frac-n">{n}</span>
      <span className="frac-d">{d}</span>
    </span>
  );
}

/** 文字式の N などを数式の書体で */
export function V({ children }: { children: ReactNode }) {
  return <var className="mv">{children}</var>;
}

/** 答え（朱書き）：表示していないときは空欄の枠にする */
export function Answer({ show, children, wide }: { show: boolean; children: ReactNode; wide?: boolean }) {
  return show ? (
    <span className="answer">{children}</span>
  ) : (
    <span className={`blank${wide ? ' blank-wide' : ''}`} aria-label="答えは先生が表示します" />
  );
}
