import { useMemo, useRef, useState } from 'react';
import { RopeCanvas, type RopeCanvasHandle } from '../components/RopeCanvas';
import { PairList } from '../components/PairList';
import { WorkCard } from '../components/WorkCard';
import { analyze, emptyTies, tie, untie, type Ties } from '../logic/strings';

export function FreeMode({ hidden }: { hidden: boolean }) {
  const [ties, setTies] = useState<Ties>(emptyTies);
  const canvas = useRef<RopeCanvasHandle>(null);
  const analysis = useMemo(() => analyze(ties), [ties]);

  // 結んだり、ほどいたりするたびに、輪とひもをきれいに並べ直す
  const update = (next: Ties) => {
    setTies(next);
    canvas.current?.arrange(next, 550);
  };

  return (
    <section className="mode mode-free" hidden={hidden} aria-label="自由に結ぶ">
      <WorkCard
        n={analysis.n}
        chains={analysis.chains.length}
        title="端と端を結んで、輪をつくろう"
        sub={
          <>
            端を<b>ドラッグして別の端に重ねる</b>と結べます（端を2つ続けて<b>タップ</b>してもOK）。結んだ端をタップするとほどけます。
          </>
        }
        tools={
          <button
            type="button"
            className="btn btn-small btn-quiet"
            disabled={analysis.tieCount === 0}
            onClick={() => update(emptyTies())}
          >
            すべてほどく
          </button>
        }
      >
        <RopeCanvas
          ref={canvas}
          ties={ties}
          label={`4本のひも。輪は${analysis.n}個`}
          canUntie
          onTie={(a, b) => update(tie(ties, a, b))}
          onUntie={(e) => update(untie(ties, e))}
        />
      </WorkCard>

      <aside className="panel" aria-label="記録">
        <section className="panel-sec">
          <h3 className="panel-h">結んだ組</h3>
          <PairList ties={ties} onUntie={(e) => update(untie(ties, e))} />
        </section>
        <p className="note">
          ひもは指で動かせます。輪どうしがからまって見えても、輪の数はつながり方だけで数えます。
        </p>
      </aside>
    </section>
  );
}
