import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FreeMode } from './modes/FreeMode';
import { RandomMode } from './modes/RandomMode';
import { StepMode } from './modes/StepMode';

const TABS = [
  { id: 'free', label: '自由に結ぶ' },
  { id: 'random', label: 'ランダムに結ぶ' },
  { id: 'step', label: '1手ずつ結ぶ' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const tabFromHash = (): TabId => {
  const h = location.hash.replace('#', '');
  return (TABS.find((t) => t.id === h)?.id ?? 'free') as TabId;
};

export default function App() {
  const [tab, setTab] = useState<TabId>(tabFromHash);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (id: TabId) => {
    setTab(id);
    history.replaceState(null, '', `${location.pathname}${location.search}#${id}`);
  };

  // ヘッダーの高さを測って、横長の画面ではひもの台を画面いっぱいにする
  const headerRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="app">
      <header className="top" ref={headerRef}>
        <div className="brand">
          <img className="brand-icon" src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={44} height={44} />
          <div className="brand-text">
            <h1>ひもの輪</h1>
            <p>輪はいくつできる？</p>
          </div>
        </div>
        <nav className="tabs" role="tablist" aria-label="モード">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'is-on' : ''}
              onClick={() => go(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        <FreeMode hidden={tab !== 'free'} />
        <RandomMode hidden={tab !== 'random'} />
        <StepMode hidden={tab !== 'step'} />
      </main>
    </div>
  );
}
