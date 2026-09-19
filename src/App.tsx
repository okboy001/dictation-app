import { useState, useEffect, useCallback } from 'react';
import { Volume2, Trash2, Pencil, ChevronUp, ChevronDown, Plus, Gauge, Languages, BookOpen, Type, Check, X, type LucideIcon } from 'lucide-react';

const MAX_CHUNK = 6;
const SPEEDS = [0.6, 0.85, 1.0];

type DictationItem = { id: string; text: string };
type ListKey = 'words' | 'sentences';
type Lang = 'yue' | 'pu';
type Editing = { list: ListKey; id: string; value: string } | null;

const PARTICLES = new Set([
  '的', '了', '著', '着', '嗎', '吗', '呢', '吧', '啊', '呀',
  '是', '在', '和', '跟', '與', '与', '及', '或', '就', '都',
  '也', '很', '太', '更', '最', '又', '再', '才', '只', '被',
  '把', '給', '给', '讓', '让', '向', '從', '从', '對', '对',
  '為', '为', '由', '而', '但', '卻', '却', '並', '并', '且',
  '之', '其', '得', '地',
]);

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function lengthOf(text: string): number {
  return Array.from(text).length;
}

function hardSplit(text: string, size: number): string[] {
  const chars = Array.from(text);
  const out: string[] = [];
  for (let i = 0; i < chars.length; i += size) out.push(chars.slice(i, i + size).join(''));
  return out;
}

function segmentWords(text: string): string[] {
  try {
    const Segmenter = (Intl as any)?.Segmenter;
    if (typeof Segmenter === 'function') {
      const segmenter = new Segmenter('zh-Hant', { granularity: 'word' });
      const parts = Array.from(segmenter.segment(text) as Iterable<{ segment: string }>)
        .map(s => s.segment)
        .filter(s => s && s.trim());
      if (parts.length > 0) return parts;
    }
  } catch {
    // fall through to hard split
  }
  return [];
}

function polishGroups(groups: string[][]): string[][] {
  const g = groups.map(words => [...words]);

  for (let i = 0; i < g.length - 1; i++) {
    const cur = g[i];
    const next = g[i + 1];
    const first = next[0];
    if (first && lengthOf(first) === 1 && PARTICLES.has(first) && cur.length > 1) {
      const lastWord = cur[cur.length - 1];
      if (lengthOf(next.join('')) + lengthOf(lastWord) <= MAX_CHUNK) {
        cur.pop();
        next.unshift(lastWord);
      }
    }
  }

  for (let i = 0; i < g.length - 1; i++) {
    const cur = g[i];
    const next = g[i + 1];
    const last = cur[cur.length - 1];
    if (last && lengthOf(last) === 1 && PARTICLES.has(last) && cur.length > 1) {
      if (lengthOf(next.join('')) + 1 <= MAX_CHUNK) {
        cur.pop();
        next.unshift(last);
      }
    }
  }

  return g;
}

function splitClause(clause: string): string[] {
  if (lengthOf(clause) <= MAX_CHUNK) return [clause];

  const segments = segmentWords(clause);
  if (segments.length === 0) return hardSplit(clause, MAX_CHUNK);

  const words: string[] = [];
  for (const word of segments) {
    if (lengthOf(word) > MAX_CHUNK) words.push(...hardSplit(word, MAX_CHUNK));
    else words.push(word);
  }

  const groups: string[][] = [];
  let current: string[] = [];
  for (const word of words) {
    const currentLength = lengthOf(current.join(''));
    if (current.length > 0 && currentLength + lengthOf(word) > MAX_CHUNK) {
      groups.push(current);
      current = [word];
    } else {
      current.push(word);
    }
  }
  if (current.length > 0) groups.push(current);

  return polishGroups(groups).map(parts => parts.join(''));
}

function parseToItems(raw: string): string[] {
  const clauses = raw
    .split(/[。！？!?…；;：:，,、.．\s]+/)
    .map(part => part.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const clause of clauses) out.push(...splitClause(clause));
  return out;
}

function loadItems(key: string): DictationItem[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const items = parsed
      .filter((entry: any) => entry && typeof entry.text === 'string' && entry.text.trim())
      .map((entry: any) => ({ id: typeof entry.id === 'string' ? entry.id : makeId(), text: entry.text }));
    return items;
  } catch {
    return null;
  }
}

export default function App() {
  const [words, setWords] = useState<DictationItem[]>(() => loadItems('dictation_words_v1') ?? []);
  const [sentences, setSentences] = useState<DictationItem[]>(() => loadItems('dictation_sentences_v1') ?? []);
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('dictation_lang_v1') === 'pu' ? 'pu' : 'yue'));
  const [speed, setSpeed] = useState<number>(() => {
    const stored = parseFloat(localStorage.getItem('dictation_speed_v1') || '');
    return Number.isNaN(stored) ? 0.85 : stored;
  });

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ttsSupported, setTtsSupported] = useState(true);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [draftWords, setDraftWords] = useState('');
  const [draftSentences, setDraftSentences] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => { localStorage.setItem('dictation_words_v1', JSON.stringify(words)); }, [words]);
  useEffect(() => { localStorage.setItem('dictation_sentences_v1', JSON.stringify(sentences)); }, [sentences]);
  useEffect(() => { localStorage.setItem('dictation_lang_v1', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('dictation_speed_v1', String(speed)); }, [speed]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setTtsSupported(false);
      return;
    }
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(id);
  }, [notice]);

  const speak = useCallback((id: string, text: string) => {
    if (!('speechSynthesis' in window)) {
      setTtsSupported(false);
      setNotice('此瀏覽器不支援語音朗讀');
      return;
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const bcp47 = lang === 'yue' ? 'zh-HK' : 'zh-CN';
    const target = bcp47.toLowerCase();
    utterance.lang = bcp47;

    const normalize = (value: string) => value.replace('_', '-').toLowerCase();
    const exact = voices.find(v => normalize(v.lang).startsWith(target));
    const anyChinese = voices.find(v => normalize(v.lang).startsWith('zh'));
    const voice = exact || anyChinese;
    if (voice) utterance.voice = voice;

    utterance.rate = speed;
    utterance.onend = () => setSpeakingId(prev => (prev === id ? null : prev));
    utterance.onerror = () => setSpeakingId(prev => (prev === id ? null : prev));

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  }, [lang, speed, voices]);

  const addItems = (list: ListKey, raw: string) => {
    const texts = parseToItems(raw);
    if (texts.length === 0) {
      setNotice('請先輸入內容');
      return;
    }
    const items = texts.map(text => ({ id: makeId(), text }));
    if (list === 'words') {
      setWords(prev => [...prev, ...items]);
      setDraftWords('');
    } else {
      setSentences(prev => [...prev, ...items]);
      setDraftSentences('');
    }
  };

  const removeItem = (list: ListKey, id: string) => {
    const setter = list === 'words' ? setWords : setSentences;
    setter(prev => prev.filter(item => item.id !== id));
    if (speakingId === id && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
    }
    if (editing?.id === id) setEditing(null);
  };

  const moveItem = (list: ListKey, index: number, direction: number) => {
    const setter = list === 'words' ? setWords : setSentences;
    setter(prev => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const commitEdit = () => {
    if (!editing) return;
    const text = editing.value.trim();
    if (!text) {
      setEditing(null);
      return;
    }
    const setter = editing.list === 'words' ? setWords : setSentences;
    setter(prev => prev.map(item => (item.id === editing.id ? { ...item, text } : item)));
    setEditing(null);
  };

  const toggleLang = () => setLang(prev => (prev === 'yue' ? 'pu' : 'yue'));

  const cycleSpeed = () =>
    setSpeed(prev => {
      const index = SPEEDS.indexOf(prev);
      return SPEEDS[(index + 1) % SPEEDS.length];
    });

  const renderList = (
    list: ListKey,
    items: DictationItem[],
    draft: string,
    setDraft: (value: string) => void,
    title: string,
    Icon: LucideIcon,
    placeholder: string,
    emptyText: string,
  ) => (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-none items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="flex items-center gap-2 font-black tracking-widest text-slate-700">
          <Icon className="h-5 w-5 text-blue-500" /> {title}
        </h2>
        <span className="text-xs font-bold text-slate-400">{items.length} 段</span>
      </div>

      <div className="flex flex-none flex-col gap-2 border-b border-slate-100 p-3">
        <textarea
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              addItems(list, draft);
            }
          }}
          rows={2}
          placeholder={placeholder}
          className="w-full resize-none rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700 transition-all focus:border-blue-400 focus:bg-white focus:outline-none"
        />
        <button
          onClick={() => addItems(list, draft)}
          disabled={!draft.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 py-2.5 font-bold tracking-widest text-white transition-all hover:bg-blue-600 active:scale-[0.98] disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> 新增（Enter，過長自動分段）
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {items.length === 0 && (
          <div className="py-8 text-center text-sm font-bold text-slate-300">{emptyText}</div>
        )}
        {items.map((item, index) => {
          const isEditing = editing?.list === list && editing.id === item.id;
          const isSpeaking = speakingId === item.id;
          return (
            <div
              key={item.id}
              className={`flex items-center gap-1.5 rounded-xl border p-1.5 transition-all ${
                isSpeaking ? 'border-blue-300 bg-blue-50' : 'border-slate-100 bg-slate-50'
              }`}
            >
              <button
                onClick={() => speak(item.id, item.text)}
                disabled={!ttsSupported}
                title="朗讀"
                className={`flex-none rounded-lg p-2 transition-all active:scale-95 disabled:opacity-40 ${
                  isSpeaking ? 'bg-blue-500 text-white' : 'border border-slate-200 bg-white text-blue-500 hover:bg-blue-50'
                }`}
              >
                <Volume2 className={`h-4 w-4 ${isSpeaking ? 'animate-pulse' : ''}`} />
              </button>

              {isEditing ? (
                <input
                  autoFocus
                  value={editing?.value ?? ''}
                  onChange={event => editing && setEditing({ ...editing, value: event.target.value })}
                  onKeyDown={event => {
                    if (event.key === 'Enter') commitEdit();
                    if (event.key === 'Escape') setEditing(null);
                  }}
                  className="min-w-0 flex-1 rounded-lg border-2 border-blue-300 bg-white px-2 py-1.5 font-bold text-slate-700 focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => speak(item.id, item.text)}
                  disabled={!ttsSupported}
                  title={item.text}
                  className="min-w-0 flex-1 truncate text-left text-lg font-black tracking-wider text-slate-700 disabled:opacity-60"
                >
                  {item.text}
                </button>
              )}

              {isEditing ? (
                <>
                  <button
                    onClick={commitEdit}
                    title="確定"
                    className="flex-none rounded-lg border border-slate-200 bg-white p-2 text-emerald-500 hover:bg-emerald-50 active:scale-95"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    title="取消"
                    className="flex-none rounded-lg border border-slate-200 bg-white p-2 text-slate-400 hover:bg-slate-100 active:scale-95"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setEditing({ list, id: item.id, value: item.text })}
                    title="編輯"
                    className="flex-none rounded-lg border border-slate-200 bg-white p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:scale-95"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <div className="flex flex-none flex-col">
                    <button
                      onClick={() => moveItem(list, index, -1)}
                      disabled={index === 0}
                      title="上移"
                      className="rounded-md p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-30"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => moveItem(list, index, 1)}
                      disabled={index === items.length - 1}
                      title="下移"
                      className="rounded-md p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-30"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(list, item.id)}
                    title="刪除"
                    className="flex-none rounded-lg border border-slate-200 bg-white p-2 text-rose-400 hover:bg-rose-50 hover:text-rose-500 active:scale-95"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-br from-slate-50 to-blue-50 font-sans text-slate-800">
      <header className="mx-auto flex w-full max-w-5xl flex-none items-center justify-between gap-3 p-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-blue-500 text-white shadow-sm">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black tracking-widest text-slate-800">默書小幫手</h1>
            <p className="truncate text-[11px] font-bold text-slate-400">輸入詞語／課文，逐項按鍵朗讀</p>
          </div>
        </div>

        <div className="flex flex-none items-center gap-2">
          <button
            onClick={toggleLang}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold shadow-sm transition-all active:scale-95 ${
              lang === 'yue' ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-rose-200 bg-rose-50 text-rose-600'
            }`}
            title="切換朗讀語言"
          >
            <Languages className="h-4 w-4" />
            {lang === 'yue' ? '粵語' : '普通話'}
          </button>

          <button
            onClick={cycleSpeed}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold shadow-sm transition-all active:scale-95 ${
              speed !== 0.85 ? 'border-purple-200 bg-purple-50 text-purple-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'
            }`}
            title="調整語速"
          >
            <Gauge className="h-4 w-4" />
            {speed}x
          </button>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4 px-4 pb-4 md:flex-row md:px-6">
        {renderList(
          'words',
          words,
          draftWords,
          setDraftWords,
          '詞語',
          Type,
          '每行一個詞語。過長會自動分段，例如「香港特別行政區」會拆成兩段。',
          '尚未輸入詞語',
        )}
        {renderList(
          'sentences',
          sentences,
          draftSentences,
          setDraftSentences,
          '課文',
          BookOpen,
          '貼上或輸入課文：會先按標點分句，每句過長再自動拆到每段最多 6 字。',
          '尚未輸入課文',
        )}
      </main>

      {!ttsSupported && (
        <div className="mx-auto mb-3 w-full max-w-5xl px-4 md:px-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-bold text-amber-600">
            此瀏覽器不支援語音朗讀，請改用 Chrome、Edge 或 Safari。
          </div>
        </div>
      )}

      {notice && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-800 px-4 py-2 text-sm font-bold text-white shadow-lg">
          {notice}
        </div>
      )}
    </div>
  );
}
