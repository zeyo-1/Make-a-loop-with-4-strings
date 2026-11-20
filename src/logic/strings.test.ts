import { describe, expect, it } from 'vitest';
import {
  allMatchings,
  analyze,
  chainOtherEnd,
  emptyTies,
  randomPairs,
  THEORY_OUT_OF_105,
  tie,
  tiesFromPairs,
} from './strings';

const A = 0, B = 1, C = 2, D = 3, E = 4, F = 5, G = 6, H = 7;

describe('analyze', () => {
  it('何も結んでいなければ輪は0、つながったひもは4本', () => {
    const r = analyze(emptyTies());
    expect(r.n).toBe(0);
    expect(r.chains).toHaveLength(4);
  });

  it('ワークシートの例：AとB、CとE、DとF、GとH → N = 3', () => {
    const r = analyze(tiesFromPairs([[A, B], [C, E], [D, F], [G, H]]));
    expect(r.n).toBe(3);
    expect(r.loops.map((l) => l.strings.length).sort()).toEqual([1, 1, 2]);
  });

  it('4本全部で1つの輪', () => {
    const r = analyze(tiesFromPairs([[B, C], [D, E], [F, G], [H, A]]));
    expect(r.n).toBe(1);
    expect(r.loops[0].strings).toHaveLength(4);
  });

  it('途中の状態：輪1つ＋つながったひも2本', () => {
    const r = analyze(tiesFromPairs([[A, B], [D, E]]));
    expect(r.n).toBe(1);
    expect(r.chains).toHaveLength(2);
    const long = r.chains.find((c) => c.strings.length === 2)!;
    expect(long.ends).toEqual([C, D, E, F]);
  });
});

describe('chainOtherEnd', () => {
  it('つながったひもの反対側の端を返す', () => {
    const ties = tie(emptyTies(), B, C);
    expect(chainOtherEnd(ties, A)).toBe(D);
    expect(chainOtherEnd(ties, D)).toBe(A);
    expect(chainOtherEnd(ties, E)).toBe(F);
  });
});

describe('105通り（問1・問4）', () => {
  it('結び方は全部で105通りで、N=1,2,3,4 はそれぞれ 48, 44, 12, 1 通り', () => {
    const all = allMatchings();
    expect(all).toHaveLength(105);
    const counts = [0, 0, 0, 0];
    for (const t of all) counts[analyze(t).n - 1]++;
    expect(counts).toEqual([...THEORY_OUT_OF_105]);
    const total = all.reduce((s, t) => s + analyze(t).n, 0);
    expect(total).toBe(176); // E(N) = 176/105
  });

  it('ランダムに結ぶと105通りがほぼ同じ割合で出る', () => {
    // mulberry32（再現できる乱数）
    let seed = 12345;
    const rng = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const counts = new Map<string, number>();
    const trials = 105 * 400;
    for (let i = 0; i < trials; i++) {
      const key = randomPairs(rng).map((p) => p.join('')).join(',');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(105);
    for (const c of counts.values()) {
      expect(c).toBeGreaterThan(400 * 0.7);
      expect(c).toBeLessThan(400 * 1.3);
    }
  });
});
