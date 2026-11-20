// やわらかいひもの簡単な物理（Verlet 法）と「きれいに並べる」配置
import { analyze, emptyTies, END_COUNT, STRING_COUNT, stringOf, type Ties } from '../logic/strings';

export const SEGS = 20;
export const PER = SEGS + 1;
const N = STRING_COUNT * PER;
/** つながったひもを並べるときの円弧の角度（少し開けて輪と区別する） */
const CHAIN_ARC = Math.PI * 2 * 0.86;
const ITER = 14;
const DAMPING = 0.82; // 机の上をすべるような摩擦

export const particleOfEnd = (e: number) => stringOf(e) * PER + (e & 1 ? SEGS : 0);

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Anim {
  fx: Float32Array;
  fy: Float32Array;
  tx: Float32Array;
  ty: Float32Array;
  t0: number;
  dur: number;
}

export class RopeSim {
  W = 0;
  H = 0;
  L = 300;
  seg = 15;
  badgeR = 14;
  pad = 8;
  x = new Float32Array(N);
  y = new Float32Array(N);
  ox = new Float32Array(N);
  oy = new Float32Array(N);
  ties: Ties = emptyTies();
  pinned = -1;
  pinX = 0;
  pinY = 0;
  anim: Anim | null = null;
  initialized = false;
  private pending: { ties: Ties; straight: boolean } | null = null;

  get tieGap() {
    return this.badgeR * 2 + 4;
  }

  /** 画面の大きさに合わせて、ひもの長さを決める（どんな結び方でも並べたときに収まるように） */
  private computeL(W: number, H: number, badgeR: number) {
    const g = badgeR * 2 + 4;
    const maxDiam = Math.min(W, H) - 2 * this.pad - 2 * badgeR - 8;
    const byChain = ((maxDiam * CHAIN_ARC) / 2 - 3 * g) / 4;
    const byLoop = (maxDiam * Math.PI - 4 * g) / 4;
    const byStraight = W - 2 * this.pad - 4 * badgeR;
    return clamp(Math.min(byChain, byLoop, byStraight, 560), 80, 560);
  }

  resize(W: number, H: number, badgeR: number) {
    if (W < 60 || H < 60) return; // 非表示のとき
    if (W === this.W && H === this.H && badgeR === this.badgeR) return;
    const newL = this.computeL(W, H, badgeR);
    if (!this.initialized) {
      this.W = W;
      this.H = H;
      this.badgeR = badgeR;
      this.L = newL;
      this.seg = newL / SEGS;
      this.initialized = true;
      const p = this.pending;
      this.pending = null;
      if (p && !p.straight) {
        this.ties = p.ties.slice();
        const t = this.layout(this.ties);
        this.setPositions(t.x, t.y);
      } else {
        const t = this.straightLayout();
        this.setPositions(t.x, t.y);
      }
      return;
    }
    const s = newL / this.L;
    const ocx = this.W / 2, ocy = this.H / 2, ncx = W / 2, ncy = H / 2;
    const scale = (arr: Float32Array, oc: number, nc: number) => {
      for (let i = 0; i < arr.length; i++) arr[i] = (arr[i] - oc) * s + nc;
    };
    scale(this.x, ocx, ncx);
    scale(this.ox, ocx, ncx);
    scale(this.y, ocy, ncy);
    scale(this.oy, ocy, ncy);
    if (this.anim) {
      scale(this.anim.fx, ocx, ncx);
      scale(this.anim.tx, ocx, ncx);
      scale(this.anim.fy, ocy, ncy);
      scale(this.anim.ty, ocy, ncy);
    }
    this.W = W;
    this.H = H;
    this.badgeR = badgeR;
    this.L = newL;
    this.seg = newL / SEGS;
    this.clampAll();
  }

  private setPositions(tx: Float32Array, ty: Float32Array) {
    this.x.set(tx);
    this.y.set(ty);
    this.ox.set(tx);
    this.oy.set(ty);
  }

  private animateTo(tx: Float32Array, ty: Float32Array, dur: number) {
    if (dur <= 0) {
      this.anim = null;
      this.setPositions(tx, ty);
      return;
    }
    this.anim = {
      fx: this.x.slice(),
      fy: this.y.slice(),
      tx,
      ty,
      t0: performance.now(),
      dur,
    };
  }

  /** 結び方を変える。ほどいた端は少し離す */
  setTies(next: Ties) {
    for (let e = 0; e < END_COUNT; e++) {
      const was = this.ties[e];
      if (was > e && next[e] !== was) {
        const a = particleOfEnd(e), b = particleOfEnd(was);
        let dx = this.x[a] - this.x[b], dy = this.y[a] - this.y[b];
        let d = Math.hypot(dx, dy);
        if (d < 1e-3) {
          dx = 1;
          dy = 0;
          d = 1;
        }
        const push = this.tieGap * 0.7;
        for (const [p, sgn] of [[a, 1], [b, -1]] as const) {
          this.x[p] += (sgn * dx * push) / d;
          this.y[p] += (sgn * dy * push) / d;
          this.ox[p] = this.x[p];
          this.oy[p] = this.y[p];
        }
      }
    }
    this.ties = next.slice();
    if (!this.initialized && this.pending) this.pending.ties = next.slice();
  }

  /** 4本をまっすぐ並べた最初の状態 */
  straightLayout() {
    const tx = new Float32Array(N), ty = new Float32Array(N);
    const r = this.badgeR;
    const spacing = clamp((this.H - 2 * this.pad - 2 * r) / 4.2, 3.2 * r, 0.32 * this.L + 2 * r);
    const y0 = this.H / 2 - 1.5 * spacing;
    const x0 = this.W / 2 - this.L / 2;
    for (let s = 0; s < STRING_COUNT; s++) {
      for (let i = 0; i < PER; i++) {
        tx[s * PER + i] = x0 + i * this.seg;
        ty[s * PER + i] = y0 + s * spacing;
      }
    }
    return { x: tx, y: ty };
  }

  straighten(ties: Ties, dur = 600) {
    this.setTies(ties);
    if (!this.initialized) {
      this.pending = { ties: ties.slice(), straight: true };
      return;
    }
    const t = this.straightLayout();
    this.animateTo(t.x, t.y, dur);
  }

  /** 輪は円に、つながったひもは少し開いた円弧に、1本だけのひもはまっすぐに並べる */
  layout(ties: Ties) {
    const tx = new Float32Array(N), ty = new Float32Array(N);
    const { L, badgeR: r } = this;
    const g = this.tieGap;
    const comps = analyze(ties).components;
    const isLine = comps.map((c) => c.kind === 'chain' && c.strings.length === 1);
    type Shape = { w: number; h: number; draw: (cx: number, cy: number) => void };
    const shapes: Shape[] = comps.map((c) => {
      const k = c.strings.length;
      if (c.kind === 'chain' && k === 1) {
        const e0 = c.ends[0];
        return {
          w: L + 2 * r,
          h: 2.8 * r,
          draw: (cx, cy) => {
            const s = stringOf(e0);
            const fwd = (e0 & 1) === 0;
            for (let i = 0; i < PER; i++) {
              const p = s * PER + (fwd ? i : SEGS - i);
              tx[p] = cx - L / 2 + i * this.seg;
              ty[p] = cy;
            }
          },
        };
      }
      const isLoop = c.kind === 'loop';
      const T = k * L + (isLoop ? k : k - 1) * g;
      const theta = isLoop ? Math.PI * 2 : CHAIN_ARC;
      const rad = T / theta;
      const a0 = isLoop ? Math.PI / 2 + g / 2 / rad : Math.PI / 2 + (Math.PI * 2 - theta) / 2;
      return {
        w: 2 * rad + 2 * r,
        h: 2 * rad + 2 * r,
        draw: (cx, cy) => {
          let s0 = 0;
          for (let j = 0; j < k; j++) {
            const e0 = c.ends[2 * j];
            const s = stringOf(e0);
            const fwd = (e0 & 1) === 0;
            for (let i = 0; i < PER; i++) {
              const p = s * PER + (fwd ? i : SEGS - i);
              const a = a0 + (s0 + i * this.seg) / rad;
              tx[p] = cx + rad * Math.cos(a);
              ty[p] = cy + rad * Math.sin(a);
            }
            s0 += L + g;
          }
        },
      };
    });

    // 輪・つながったひもは棚づめ（左から右へ、入らなければ次の段）。
    // まだ結んでいない1本だけのひもは、その下に1本ずつ縦に並べる
    const gap = Math.max(14, r * 1.4);
    const maxW = this.W - 2 * this.pad;
    type Row = { items: Shape[]; w: number; h: number; gapAfter: number };
    const rows: Row[] = [];
    let lastPacked: Row | null = null;
    shapes.forEach((sh, i) => {
      if (isLine[i]) return;
      if (lastPacked && lastPacked.w + gap + sh.w <= maxW) {
        lastPacked.items.push(sh);
        lastPacked.w += gap + sh.w;
        lastPacked.h = Math.max(lastPacked.h, sh.h);
      } else {
        lastPacked = { items: [sh], w: sh.w, h: sh.h, gapAfter: gap };
        rows.push(lastPacked);
      }
    });
    shapes.forEach((sh, i) => {
      if (isLine[i]) rows.push({ items: [sh], w: sh.w, h: sh.h, gapAfter: r * 0.8 });
    });
    const totalH = rows.reduce((s, row, i) => s + row.h + (i < rows.length - 1 ? row.gapAfter : 0), 0);
    let y = Math.max(this.pad, (this.H - totalH) / 2);
    for (const row of rows) {
      let x = (this.W - row.w) / 2;
      for (const sh of row.items) {
        sh.draw(x + sh.w / 2, y + row.h / 2);
        x += sh.w + gap;
      }
      y += row.h + row.gapAfter;
    }
    return { x: tx, y: ty };
  }

  arrange(ties: Ties, dur = 650) {
    this.setTies(ties);
    if (!this.initialized) {
      this.pending = { ties: ties.slice(), straight: false };
      return;
    }
    const t = this.layout(ties);
    this.animateTo(t.x, t.y, dur);
  }

  grab(p: number, x: number, y: number) {
    this.anim = null;
    this.pinned = p;
    this.pinX = x;
    this.pinY = y;
  }

  moveGrab(x: number, y: number) {
    this.pinX = clamp(x, this.pad, this.W - this.pad);
    this.pinY = clamp(y, this.pad, this.H - this.pad);
  }

  release() {
    this.pinned = -1;
  }

  private constrain(a: number, b: number, rest: number, mode: 'eq' | 'min', k = 1) {
    const wa = a === this.pinned ? 0 : 1;
    const wb = b === this.pinned ? 0 : 1;
    const w = wa + wb;
    if (w === 0) return;
    const dx = this.x[b] - this.x[a];
    const dy = this.y[b] - this.y[a];
    const d = Math.hypot(dx, dy) || 1e-6;
    if (mode === 'min' && d >= rest) return;
    const diff = ((d - rest) / d) * k;
    this.x[a] += (dx * diff * wa) / w;
    this.y[a] += (dy * diff * wa) / w;
    this.x[b] -= (dx * diff * wb) / w;
    this.y[b] -= (dy * diff * wb) / w;
  }

  private clampAll() {
    const lo = this.pad, hx = this.W - this.pad, hy = this.H - this.pad;
    for (let i = 0; i < N; i++) {
      this.x[i] = clamp(this.x[i], lo, hx);
      this.y[i] = clamp(this.y[i], lo, hy);
    }
  }

  /** 1コマ進める。動きの大きさを返す（止まったら描画ループを休ませる） */
  step(): number {
    if (!this.initialized) return 0;
    if (this.anim) {
      const a = this.anim;
      const t = Math.min(1, (performance.now() - a.t0) / a.dur);
      const k = easeInOut(t);
      for (let i = 0; i < N; i++) {
        this.x[i] = a.fx[i] + (a.tx[i] - a.fx[i]) * k;
        this.y[i] = a.fy[i] + (a.ty[i] - a.fy[i]) * k;
      }
      this.ox.set(this.x);
      this.oy.set(this.y);
      if (t >= 1) this.anim = null;
      return 1;
    }
    let energy = 0;
    for (let i = 0; i < N; i++) {
      const vx = (this.x[i] - this.ox[i]) * DAMPING;
      const vy = (this.y[i] - this.oy[i]) * DAMPING;
      this.ox[i] = this.x[i];
      this.oy[i] = this.y[i];
      this.x[i] += vx;
      this.y[i] += vy;
      energy += vx * vx + vy * vy;
    }
    const pin = this.pinned;
    if (pin >= 0) {
      this.x[pin] = this.pinX;
      this.y[pin] = this.pinY;
    }
    const g = this.tieGap;
    for (let it = 0; it < ITER; it++) {
      for (let s = 0; s < STRING_COUNT; s++) {
        const base = s * PER;
        for (let i = 0; i < SEGS; i++) this.constrain(base + i, base + i + 1, this.seg, 'eq');
        for (let i = 0; i < SEGS - 1; i++) this.constrain(base + i, base + i + 2, this.seg * 1.55, 'min', 0.3);
      }
      for (let e = 0; e < END_COUNT; e++) {
        const t = this.ties[e];
        if (t > e) this.constrain(particleOfEnd(e), particleOfEnd(t), g, 'eq');
      }
      if (pin >= 0) {
        this.x[pin] = this.pinX;
        this.y[pin] = this.pinY;
      }
    }
    this.clampAll();
    return energy + (pin >= 0 ? 1 : 0);
  }

  /** 一番近い端（なければ -1） */
  nearestEnd(x: number, y: number, maxDist: number, filter?: (e: number) => boolean) {
    let best = -1, bestD = maxDist;
    for (let e = 0; e < END_COUNT; e++) {
      if (filter && !filter(e)) continue;
      const p = particleOfEnd(e);
      const d = Math.hypot(this.x[p] - x, this.y[p] - y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  nearestParticle(x: number, y: number, maxDist: number) {
    let best = -1, bestD = maxDist;
    for (let i = 0; i < N; i++) {
      const d = Math.hypot(this.x[i] - x, this.y[i] - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }
}
