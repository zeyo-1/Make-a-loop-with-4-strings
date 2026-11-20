import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import {
  analyze,
  END_COUNT,
  LABELS,
  LOOP_COLORS,
  STRING_COLORS,
  STRING_COUNT,
  STRING_NAMES,
  type Ties,
} from '../logic/strings';
import { particleOfEnd, PER, RopeSim, SEGS } from '../sim/RopeSim';

export interface RopeCanvasHandle {
  /** 結び方をセットして、輪・ひもをきれいに並べる */
  arrange(ties: Ties, duration?: number): void;
  /** 4本をまっすぐ並べ直す */
  straighten(ties: Ties, duration?: number): void;
}

interface Props {
  ties: Ties;
  onTie?: (a: number, b: number) => void;
  onUntie?: (e: number) => void;
  /** 結んでよい組か（指定しなければ、空いている端どうしならOK） */
  canTie?: (a: number, b: number) => boolean;
  canUntie?: boolean;
  /** 1手ずつモード：相手を選んでいる端 */
  source?: number;
  /** 候補として光らせる端 */
  candidates?: number[];
  /** 選ぶと輪が閉じる端 */
  closingEnd?: number;
  /** 外のボタンにふれているときなどに強調する端 */
  highlight?: number;
  label: string;
  className?: string;
}

type Pt = { x: number; y: number };

function smoothPath(pts: Pt[], closed: boolean) {
  const n = pts.length;
  if (n < 2) return '';
  const at = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return closed ? d + 'Z' : d;
}

const defaultCanTie = (ties: Ties) => (a: number, b: number) => a !== b && ties[a] === -1 && ties[b] === -1;

export const RopeCanvas = forwardRef<RopeCanvasHandle, Props>(function RopeCanvas(props, ref) {
  const {
    ties,
    onTie,
    onUntie,
    canUntie = false,
    source = -1,
    candidates,
    closingEnd = -1,
    highlight = -1,
    label,
    className,
  } = props;
  const canTie = props.canTie ?? defaultCanTie(ties);

  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<RopeSim>(null as unknown as RopeSim);
  if (!simRef.current) simRef.current = new RopeSim();
  const sim = simRef.current;

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [selected, setSelected] = useState(-1);
  const [hoverTarget, setHoverTarget] = useState(-1);
  const [dragging, setDragging] = useState(-1);

  const ropeRefs = useRef<(SVGPathElement | null)[]>([]);
  const shadowRefs = useRef<(SVGPathElement | null)[]>([]);
  const tagRefs = useRef<(SVGTextElement | null)[]>([]);
  const haloRefs = useRef<(SVGPathElement | null)[]>([]);
  const loopTagRefs = useRef<(SVGGElement | null)[]>([]);
  const knotRefs = useRef<(SVGLineElement | null)[]>([]);
  const endRefs = useRef<(SVGGElement | null)[]>([]);
  const ringRefs = useRef<(SVGCircleElement | null)[]>([]);

  const badgeR = Math.round(Math.max(13, Math.min(22, Math.min(size.w, size.h) / 30)));

  // ---- 描画 ----
  const draw = useCallback(() => {
    if (!sim.initialized) return;
    const pt = (i: number): Pt => ({ x: sim.x[i], y: sim.y[i] });
    const r = sim.badgeR;
    for (let s = 0; s < STRING_COUNT; s++) {
      const pts: Pt[] = [];
      for (let i = 0; i < PER; i++) pts.push(pt(s * PER + i));
      const d = smoothPath(pts, false);
      ropeRefs.current[s]?.setAttribute('d', d);
      shadowRefs.current[s]?.setAttribute('d', d);
      // ひも番号はひもの真ん中の少し横に
      const m = s * PER + SEGS / 2;
      const nx = -(sim.y[m + 1] - sim.y[m - 1]), ny = sim.x[m + 1] - sim.x[m - 1];
      const nl = Math.hypot(nx, ny) || 1;
      const off = r * 1.25;
      const tag = tagRefs.current[s];
      if (tag) {
        tag.setAttribute('x', (sim.x[m] + (nx / nl) * -off).toFixed(1));
        tag.setAttribute('y', (sim.y[m] + (ny / nl) * -off).toFixed(1));
      }
    }
    for (let e = 0; e < END_COUNT; e++) {
      const p = particleOfEnd(e);
      const tr = `translate(${sim.x[p].toFixed(1)} ${sim.y[p].toFixed(1)})`;
      endRefs.current[e]?.setAttribute('transform', tr);
      ringRefs.current[e]?.setAttribute('transform', tr);
    }
    // 結び目
    let k = 0;
    for (let e = 0; e < END_COUNT; e++) {
      const t = sim.ties[e];
      if (t > e) {
        const line = knotRefs.current[k++];
        if (!line) continue;
        const a = particleOfEnd(e), b = particleOfEnd(t);
        // 並べ直しの途中で端どうしが離れているときは、結び目の線を出さない
        if (Math.hypot(sim.x[a] - sim.x[b], sim.y[a] - sim.y[b]) > sim.tieGap * 1.8) {
          line.style.display = 'none';
          continue;
        }
        line.setAttribute('x1', sim.x[a].toFixed(1));
        line.setAttribute('y1', sim.y[a].toFixed(1));
        line.setAttribute('x2', sim.x[b].toFixed(1));
        line.setAttribute('y2', sim.y[b].toFixed(1));
        line.style.display = '';
      }
    }
    for (; k < 4; k++) {
      const line = knotRefs.current[k];
      if (line) line.style.display = 'none';
    }
    // 輪（蛍光ペンで囲む）
    const loops = analyze(sim.ties).loops;
    for (let i = 0; i < 4; i++) {
      const halo = haloRefs.current[i];
      const tag = loopTagRefs.current[i];
      const loop = loops[i];
      if (!loop) {
        if (halo) halo.style.display = 'none';
        if (tag) tag.style.display = 'none';
        continue;
      }
      const pts: Pt[] = [];
      let cx = 0, cy = 0;
      for (let j = 0; j < loop.ends.length; j += 2) {
        const e0 = loop.ends[j];
        const s = e0 >> 1;
        const fwd = (e0 & 1) === 0;
        for (let q = 0; q < PER; q++) {
          const p = pt(s * PER + (fwd ? q : SEGS - q));
          pts.push(p);
          cx += p.x;
          cy += p.y;
        }
      }
      cx /= pts.length;
      cy /= pts.length;
      if (halo) {
        halo.setAttribute('d', smoothPath(pts, true));
        halo.setAttribute('stroke', LOOP_COLORS[i]);
        halo.style.display = '';
      }
      if (tag) {
        tag.setAttribute('transform', `translate(${cx.toFixed(1)} ${cy.toFixed(1)})`);
        const rect = tag.querySelector('rect');
        if (rect) rect.setAttribute('fill', LOOP_COLORS[i]);
        tag.style.display = '';
      }
    }
  }, [sim]);

  // ---- 描画ループ（止まったら休む） ----
  const running = useRef(false);
  const calm = useRef(0);
  const raf = useRef(0);
  const wake = useCallback(() => {
    calm.current = 0;
    if (running.current) return;
    running.current = true;
    const tick = () => {
      const energy = sim.step();
      draw();
      if (sim.anim || sim.pinned >= 0 || energy > 0.01) calm.current = 0;
      else calm.current++;
      if (calm.current > 40) {
        running.current = false;
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [sim, draw]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // ---- 大きさ ----
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.clientWidth), h = Math.round(el.clientHeight);
      setSize((old) => (old.w === w && old.h === h ? old : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (size.w < 60 || size.h < 60) return;
    sim.resize(size.w, size.h, badgeR);
    draw();
    wake();
  }, [size, badgeR, sim, draw, wake]);

  // ---- 結び方の同期 ----
  useEffect(() => {
    sim.setTies(ties);
    wake();
  }, [ties, sim, wake]);

  useImperativeHandle(
    ref,
    () => {
      const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      return {
        arrange(t, duration = 650) {
          sim.arrange(t, reduce() ? 0 : duration);
          wake();
        },
        straighten(t, duration = 600) {
          sim.straighten(t, reduce() ? 0 : duration);
          wake();
        },
      };
    },
    [sim, wake],
  );

  // ---- 操作 ----
  const drag = useRef<{
    id: number;
    particle: number;
    end: number;
    sx: number;
    sy: number;
    offX: number;
    offY: number;
    moved: boolean;
  } | null>(null);

  const local = (ev: React.PointerEvent) => {
    const rect = (ev.currentTarget as SVGSVGElement).getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  };
  const hitR = Math.max(badgeR + 12, 26);
  const fixedSource = source >= 0;

  const findTarget = (from: number, x: number, y: number) =>
    sim.nearestEnd(x, y, badgeR * 2 + 16, (e) => e !== from && canTie(from, e));

  const onPointerDown = (ev: React.PointerEvent<SVGSVGElement>) => {
    if (drag.current || !sim.initialized) return;
    const { x, y } = local(ev);
    const end = sim.nearestEnd(x, y, hitR);
    const particle = end >= 0 ? particleOfEnd(end) : sim.nearestParticle(x, y, Math.max(18, badgeR));
    if (particle < 0) {
      if (!fixedSource) setSelected(-1);
      return;
    }
    ev.currentTarget.setPointerCapture(ev.pointerId);
    drag.current = {
      id: ev.pointerId,
      particle,
      end,
      sx: x,
      sy: y,
      offX: sim.x[particle] - x,
      offY: sim.y[particle] - y,
      moved: false,
    };
    sim.grab(particle, sim.x[particle], sim.y[particle]);
    wake();
  };

  const onPointerMove = (ev: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== ev.pointerId) return;
    const { x, y } = local(ev);
    if (!d.moved && Math.hypot(x - d.sx, y - d.sy) > 7) {
      d.moved = true;
      setDragging(d.end);
    }
    if (!d.moved) return;
    // つまんだ位置のずれを保ったまま動かす
    const px = x + d.offX, py = y + d.offY;
    sim.moveGrab(px, py);
    if (d.end >= 0 && sim.ties[d.end] === -1) setHoverTarget(findTarget(d.end, px, py));
    wake();
  };

  const finish = (ev: React.PointerEvent<SVGSVGElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.id !== ev.pointerId) return;
    drag.current = null;
    sim.release();
    setDragging(-1);
    setHoverTarget(-1);
    wake();
    if (cancelled) return;
    const { x, y } = local(ev);
    const e = d.end;
    if (d.moved) {
      if (e >= 0 && sim.ties[e] === -1) {
        const target = findTarget(e, x + d.offX, y + d.offY);
        if (target >= 0) {
          onTie?.(e, target);
          setSelected(-1);
        }
      }
      return;
    }
    // タップ
    if (e < 0) {
      if (!fixedSource) setSelected(-1);
      return;
    }
    if (fixedSource) {
      if (e !== source && canTie(source, e)) onTie?.(source, e);
      return;
    }
    if (sim.ties[e] !== -1) {
      if (canUntie) onUntie?.(e);
      return;
    }
    if (selected === -1 || selected === e) {
      setSelected(selected === e ? -1 : e);
    } else if (canTie(selected, e)) {
      onTie?.(selected, e);
      setSelected(-1);
    } else {
      setSelected(e);
    }
  };

  // 結び方が変わったら選択を見直す
  useEffect(() => {
    if (selected >= 0 && ties[selected] !== -1) setSelected(-1);
  }, [ties, selected]);

  const candidateSet = new Set(candidates ?? []);
  const activeSource = fixedSource ? source : selected;

  return (
    <div ref={wrapRef} className={`stage ${className ?? ''}`}>
      <svg
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w || 1} ${size.h || 1}`}
        role="img"
        aria-label={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, false)}
        onPointerCancel={(e) => finish(e, true)}
        style={{ ['--badge-r' as string]: `${badgeR}px` }}
      >
        <g aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <path
              key={i}
              ref={(el) => {
                haloRefs.current[i] = el;
              }}
              className="halo"
              fill="none"
              strokeWidth={badgeR * 1.7}
              strokeLinejoin="round"
              style={{ display: 'none' }}
            />
          ))}
        </g>
        <g aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <line
              key={i}
              ref={(el) => {
                knotRefs.current[i] = el;
              }}
              className="knot"
              strokeWidth={badgeR * 0.75}
              strokeLinecap="round"
              style={{ display: 'none' }}
            />
          ))}
        </g>
        <g aria-hidden>
          {Array.from({ length: STRING_COUNT }, (_, s) => (
            <g key={s}>
              <path
                ref={(el) => {
                  shadowRefs.current[s] = el;
                }}
                className="rope-shadow"
                fill="none"
                strokeWidth={badgeR * 0.55}
                strokeLinecap="round"
                transform="translate(1.5 2.5)"
              />
              <path
                ref={(el) => {
                  ropeRefs.current[s] = el;
                }}
                fill="none"
                stroke={STRING_COLORS[s]}
                strokeWidth={badgeR * 0.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}
        </g>
        <g aria-hidden className="string-tags" style={{ fontSize: badgeR * 1.05 }}>
          {Array.from({ length: STRING_COUNT }, (_, s) => (
            <text
              key={s}
              ref={(el) => {
                tagRefs.current[s] = el;
              }}
              fill={STRING_COLORS[s]}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {STRING_NAMES[s]}
            </text>
          ))}
        </g>
        <g aria-hidden className="loop-tags" style={{ fontSize: badgeR * 0.95 }}>
          {[0, 1, 2, 3].map((i) => (
            <g
              key={i}
              ref={(el) => {
                loopTagRefs.current[i] = el;
              }}
              style={{ display: 'none' }}
            >
              <rect x={-badgeR * 1.6} y={-badgeR * 0.8} width={badgeR * 3.2} height={badgeR * 1.6} rx={badgeR * 0.8} />
              <text textAnchor="middle" dominantBaseline="central">
                輪{i + 1}
              </text>
            </g>
          ))}
        </g>
        <g aria-hidden>
          {Array.from({ length: END_COUNT }, (_, e) => {
            let cls = 'ring';
            if (e === activeSource) cls += ' ring-source';
            else if (e === hoverTarget || e === highlight) cls += ' ring-target';
            else if (candidateSet.has(e)) cls += e === closingEnd ? ' ring-closing' : ' ring-candidate';
            else if (activeSource >= 0 && !fixedSource && e !== activeSource && canTie(activeSource, e))
              cls += ' ring-hint';
            return (
              <circle
                key={e}
                ref={(el) => {
                  ringRefs.current[e] = el;
                }}
                className={cls}
                r={badgeR + 6}
                fill="none"
              />
            );
          })}
        </g>
        <g className="ends">
          {Array.from({ length: END_COUNT }, (_, e) => (
            <g
              key={e}
              ref={(el) => {
                endRefs.current[e] = el;
              }}
              className={`end${dragging === e ? ' end-dragging' : ''}`}
            >
              <circle r={badgeR} fill={STRING_COLORS[e >> 1]} />
              <text textAnchor="middle" dominantBaseline="central" style={{ fontSize: badgeR * 1.15 }}>
                {LABELS[e]}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
});
