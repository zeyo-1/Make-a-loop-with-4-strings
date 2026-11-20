import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FreeMode } from './modes/FreeMode';
import { RandomMode } from './modes/RandomMode';
import { StepMode } from './modes/StepMode';
import { load, save } from './storage';

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

function initialTeacher() {
  const q = new URLSearchParams(location.search).get('teacher');
  if (q === '1' || q === 'true') return true;
  if (q === '0' || q === 'false') return false;
  return load('teacher', false);
}

export default function App() {
  const [tab, setTab] = useState<TabId>(tabFromHash);
  const [teacher, setTeacher] = useState(initialTeacher);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    save('teacher', teacher);
    document.documentElement.classList.toggle('teacher', teacher);
    if (!teacher) setReveal(false);
  }, [teacher]);

  const go = (id: TabId) => {
    setTab(id);
    history.replaceState(null, '', `${location.pathname}${location.search}#${id}`);
  };

  const showAnswers = teacher && reveal;

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
        <div className="tools">
          {teacher && (
            <button
              type="button"
              className={`reveal${reveal ? ' is-on' : ''}`}
              aria-pressed={reveal}
              onClick={() => setReveal((r) => !r)}
            >
              {reveal ? '答えをかくす' : '答えを表示'}
            </button>
          )}
          <label className="switch">
            <input type="checkbox" checked={teacher} onChange={(e) => setTeacher(e.target.checked)} />
            <span className="switch-track" aria-hidden />
            先生用
          </label>
        </div>
      </header>

      <main>
        <FreeMode hidden={tab !== 'free'} />
        <RandomMode hidden={tab !== 'random'} teacher={teacher} reveal={showAnswers} />
        <StepMode hidden={tab !== 'step'} reveal={showAnswers} />
      </main>
    </div>
  );
}
