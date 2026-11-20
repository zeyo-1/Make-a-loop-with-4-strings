import { useMemo, useRef, useState } from 'react';
import { RopeCanvas, type RopeCanvasHandle } from '../components/RopeCanvas';
import { LoopSummary, PairList } from '../components/LoopSummary';
import { V } from '../components/MathText';
import { analyze, emptyTies, tie, untie, type Ties } from '../logic/strings';

export function FreeMode({ hidden }: { hidden: boolean }) {
  const [ties, setTies] = useState<Ties>(emptyTies);
  const canvas = useRef<RopeCanvasHandle>(null);
  const analysis = useMemo(() => analyze(ties), [ties]);
  const done = analysis.tieCount === 4;

  // 結んだり、ほどいたりするたびに、輪とひもをきれいに並べ直す
  const update = (next: Ties) => {
    setTies(next);
    canvas.current?.arrange(next, 550);
  };

  return (
    <section className="mode" hidden={hidden} aria-label="自由に結ぶ">
      <div className="mode-stage">
        <p className="stage-head">
          端を<b>ドラッグして別の端に重ねる</b>と結べます（端を2つ続けて<b>タップ</b>してもOK）。結んだ端をタップするとほどけます。
        </p>
        <div className="stage-wrap">
          <RopeCanvas
            ref={canvas}
            ties={ties}
            label={`4本のひも。輪は${analysis.n}個`}
            canUntie
            onTie={(a, b) => update(tie(ties, a, b))}
            onUntie={(e) => update(untie(ties, e))}
          />
          <div className="stage-n" aria-hidden>
            <V>N</V> = {analysis.n}
          </div>
        </div>
      </div>
      <aside className="panel">
        <LoopSummary analysis={analysis} done={done} />
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={() => canvas.current?.arrange(ties)}>
            きれいに並べる
          </button>
          <button type="button" className="btn" onClick={() => update(emptyTies())}>
            すべてほどく
          </button>
        </div>
        <PairList ties={ties} onUntie={(e) => update(untie(ties, e))} />
        <p className="note">
          ひもを指で動かして、からめてみましょう。輪どうしがからまって見えても、つながり方だけで数えます。「きれいに並べる」で元に戻せます。
        </p>
      </aside>
    </section>
  );
}
