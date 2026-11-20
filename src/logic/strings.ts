// ひもと端の基本的な決まりごと
// 端 0..7 = A..H。ひも s の端は 2s と 2s+1（①A–B, ②C–D, ③E–F, ④G–H）

export const STRING_COUNT = 4;
export const END_COUNT = STRING_COUNT * 2;
export const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export const STRING_NAMES = ['①', '②', '③', '④'] as const;

/** ワークシートと同じ色（①青 ②オレンジ ③緑 ④紺） */
export const STRING_COLORS = ['#2b6fd6', '#ef7d16', '#1f9d57', '#283a8f'] as const;

/** 輪につける蛍光ペンの色（輪の番号順に使う） */
export const LOOP_COLORS = ['#ffd84a', '#ff9cc6', '#7fd8ff', '#b8ee6a'] as const;

/** ties[e] = 結んだ相手の端。結んでいなければ -1 */
export type Ties = number[];

export const emptyTies = (): Ties => Array(END_COUNT).fill(-1);
export const stringOf = (end: number) => end >> 1;
export const oppositeEnd = (end: number) => end ^ 1;
export const label = (end: number) => LABELS[end];

export interface Component {
  kind: 'loop' | 'chain';
  /** たどった順の端の並び（ひもの端 → 反対の端 → 結んだ相手 → …） */
  ends: number[];
  /** たどった順のひも */
  strings: number[];
}

export interface Analysis {
  loops: Component[];
  chains: Component[];
  /** ひも番号の小さい順に並べたもの（並べ方を安定させるため） */
  components: Component[];
  /** 輪の数 N */
  n: number;
  /** 結んだ組の数 */
  tieCount: number;
}

/** 結び方から、輪とつながったひも（まだ輪でないもの）を求める */
export function analyze(ties: Ties): Analysis {
  const visited = new Array(STRING_COUNT).fill(false);
  const chains: Component[] = [];
  const loops: Component[] = [];

  // まず両端の片方が空いている「つながったひも」をたどる
  for (let start = 0; start < END_COUNT; start++) {
    if (ties[start] !== -1 || visited[stringOf(start)]) continue;
    const ends: number[] = [];
    const strings: number[] = [];
    let e = start;
    for (;;) {
      const s = stringOf(e);
      visited[s] = true;
      strings.push(s);
      ends.push(e, oppositeEnd(e));
      const next = ties[oppositeEnd(e)];
      if (next === -1) break;
      e = next;
    }
    chains.push({ kind: 'chain', ends, strings });
  }

  // 残りはすべて輪
  for (let s = 0; s < STRING_COUNT; s++) {
    if (visited[s]) continue;
    const start = s * 2;
    const ends: number[] = [];
    const strings: number[] = [];
    let e = start;
    do {
      visited[stringOf(e)] = true;
      strings.push(stringOf(e));
      ends.push(e, oppositeEnd(e));
      e = ties[oppositeEnd(e)];
    } while (e !== start && e !== -1);
    loops.push({ kind: 'loop', ends, strings });
  }

  const minString = (c: Component) => Math.min(...c.strings);
  const components = [...loops, ...chains].sort((a, b) => minString(a) - minString(b));
  const tieCount = ties.filter((t) => t !== -1).length / 2;
  return { loops, chains, components, n: loops.length, tieCount };
}

/** e をふくむ「つながったひも」の反対側の端（結ぶと輪が閉じる相手） */
export function chainOtherEnd(ties: Ties, e: number): number {
  let cur = e;
  for (let guard = 0; guard < END_COUNT; guard++) {
    const opp = oppositeEnd(cur);
    const next = ties[opp];
    if (next === -1) return opp;
    cur = next;
  }
  return -1;
}

export function tie(ties: Ties, a: number, b: number): Ties {
  const next = ties.slice();
  next[a] = b;
  next[b] = a;
  return next;
}

export function untie(ties: Ties, a: number): Ties {
  const next = ties.slice();
  const b = next[a];
  next[a] = -1;
  if (b !== -1) next[b] = -1;
  return next;
}

export const freeEnds = (ties: Ties) =>
  ties.map((t, e) => (t === -1 ? e : -1)).filter((e) => e !== -1);

/** 結んだ組を「AとB」の形で、アルファベット順に並べる */
export function pairList(ties: Ties): [number, number][] {
  const pairs: [number, number][] = [];
  for (let e = 0; e < END_COUNT; e++) {
    const p = ties[e];
    if (p > e) pairs.push([e, p]);
  }
  return pairs;
}

export type Rng = () => number;

/**
 * 問3の手順どおりに無作為に結ぶ：
 * まだ結んでいない端のうちアルファベット順で最初のものを選び、
 * 残りの端から相手を等確率で選ぶ。これで105通りが同じ確率になる。
 */
export function randomPairs(rng: Rng = Math.random): [number, number][] {
  let ties = emptyTies();
  const pairs: [number, number][] = [];
  for (;;) {
    const free = freeEnds(ties);
    if (free.length === 0) break;
    const a = free[0];
    const candidates = free.slice(1);
    const b = candidates[Math.floor(rng() * candidates.length)];
    pairs.push([a, b]);
    ties = tie(ties, a, b);
  }
  return pairs;
}

export function tiesFromPairs(pairs: [number, number][]): Ties {
  let ties = emptyTies();
  for (const [a, b] of pairs) ties = tie(ties, a, b);
  return ties;
}

/** 105通りすべての結び方 */
export function allMatchings(): Ties[] {
  const out: Ties[] = [];
  const rec = (ties: Ties) => {
    const free = freeEnds(ties);
    if (free.length === 0) {
      out.push(ties);
      return;
    }
    const a = free[0];
    for (const b of free.slice(1)) rec(tie(ties, a, b));
  };
  rec(emptyTies());
  return out;
}

/** 理論値（答え）：N = 1,2,3,4 の確率を 105 分の何かで */
export const THEORY_OUT_OF_105 = [48, 44, 12, 1] as const;
/** 約分した形 */
export const THEORY_FRACTIONS: [number, number][] = [
  [16, 35],
  [44, 105],
  [4, 35],
  [1, 105],
];
export const EXPECTED_N: [number, number] = [176, 105];
