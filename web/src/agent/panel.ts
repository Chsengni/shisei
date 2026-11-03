/* The assistant drawer: a toggle on the right edge and a slide-in panel that drives alibaba/page-agent against this
   page with the reader's own LLM key. Overlay on every width (a backdrop on phones), open state remembered in
   localStorage. The settings live only in this browser: nothing about them is in the repo or sent to the site. The
   page-agent code itself (runner.ts) is imported the first time the drawer opens. */
import { I18N } from '../i18n';
import { esc, pageLoc } from '../util';
import type { AgentSettings, Run } from './runner';

const loc = pageLoc();
const A = I18N[loc].agent;
const KEY_OPEN = 'shisei.agent.open';
const KEY_CFG = 'shisei.agent.cfg';
// Placeholders only: Alibaba Cloud DashScope's OpenAI-compatible endpoint and a Qwen model. Any OpenAI-compatible
// endpoint works; nothing here is a key.
const DEFAULTS: AgentSettings = { baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.5-plus', apiKey: '' };

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
function loadCfg(): AgentSettings {
  try { return { ...DEFAULTS, ...(JSON.parse(read(KEY_CFG) || '{}') as Partial<AgentSettings>) }; } catch { return { ...DEFAULTS }; }
}

// Sparkles, the usual mark for an AI feature (the sun icon is the theme switch).
const ICON_SPARK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5l1.9 5 5 1.9-5 1.9-1.9 5-1.9-5-5-1.9 5-1.9z"/><path d="M18 14.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/></svg>';
const ICON_X = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

const field = 'h-11 w-full rounded-xl border border-line bg-field px-3 text-sm text-ink placeholder:text-ink4 focus:border-ink3 focus:outline-none';
const label = 'flex flex-col gap-1.5 text-xs font-semibold tracking-wide text-ink3';

export function mountAgentPanel(): void {
  const root = document.createElement('div');
  // Everything here is invisible to the agent: it must act on the page, not on its own controls.
  root.dataset.pageAgentIgnore = 'true';
  root.id = 'agentRoot';
  root.innerHTML =
    '<button type="button" id="agentToggle" class="agent-toggle fixed right-0 top-1/2 z-[70] flex -translate-y-1/2 items-center gap-2 rounded-l-2xl border border-r-0 border-line bg-card py-3 pl-3 pr-2 max-[720px]:top-[64%] max-[720px]:py-2.5 max-[720px]:pl-2.5 max-[720px]:pr-1.5 text-ink shadow-[0_10px_30px_-14px_rgba(24,24,27,.35)] transition-[transform,opacity] duration-200 hover:bg-field [writing-mode:vertical-rl]" aria-controls="agentPanel" aria-expanded="false">' +
      '' + ICON_SPARK + '<span class="text-[13px] font-semibold tracking-wide max-[720px]:sr-only">' + esc(A.toggle) + '</span></button>' +
    '<div id="agentBackdrop" class="fixed inset-0 z-[71] bg-black/30 opacity-0 transition-opacity duration-200 pointer-events-none min-[721px]:hidden"></div>' +
    '<aside id="agentPanel" class="fixed inset-y-0 right-0 z-[72] flex w-[400px] max-w-[92vw] translate-x-full flex-col border-l border-line bg-bg text-ink shadow-[-24px_0_48px_-24px_rgba(24,24,27,.35)] transition-transform duration-250 ease-out invisible" role="complementary" aria-labelledby="agentTitle" aria-hidden="true">' +
      '<header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">' +
        '<h2 id="agentTitle" class="m-0 flex items-center gap-2 text-base font-bold">' + ICON_SPARK + esc(A.title) + '</h2>' +
        '<button type="button" id="agentClose" class="circle" aria-label="' + esc(A.close) + '">' + ICON_X + '</button></header>' +
      '<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">' +
        '<p class="m-0 text-sm leading-relaxed text-ink3">' + esc(A.intro) + '</p>' +
        '<details id="agentSettings" class="group rounded-2xl border border-line bg-card px-4 py-3">' +
          '<summary class="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold">' + esc(A.settings) +
            '<span class="text-ink4 transition-transform group-open:rotate-180" aria-hidden="true">▾</span></summary>' +
          '<form id="agentCfg" class="mt-2 flex flex-col gap-3" autocomplete="off">' +
            '<label class="' + label + '">' + esc(A.baseURL) + '<input class="' + field + '" name="baseURL" type="url" inputmode="url" spellcheck="false" placeholder="' + esc(DEFAULTS.baseURL) + '"></label>' +
            '<label class="' + label + '">' + esc(A.model) + '<input class="' + field + '" name="model" type="text" spellcheck="false" placeholder="' + esc(DEFAULTS.model) + '"></label>' +
            '<label class="' + label + '">' + esc(A.apiKey) + '<input class="' + field + '" name="apiKey" type="password" spellcheck="false" autocomplete="off" placeholder="sk-…"></label>' +
            '<p class="m-0 text-xs leading-relaxed text-ink4">' + esc(A.keyNote) + '</p>' +
            '<div class="flex items-center gap-3"><button type="submit" class="pill dark tiny !h-10 !px-4 !text-sm">' + esc(A.save) + '</button><span id="agentSaved" class="text-xs text-ink4" role="status"></span></div>' +
          '</form></details>' +
        '<form id="agentForm" class="flex flex-col gap-2">' +
          '<label class="' + label + '" for="agentTask">' + esc(A.task) + '</label>' +
          '<textarea id="agentTask" rows="3" class="' + field + ' h-auto resize-y py-2.5 leading-relaxed" placeholder="' + esc(A.taskPh) + '"></textarea>' +
          '<div class="flex items-center gap-2">' +
            '<button type="submit" id="agentRun" class="pill dark !h-11 flex-1 !text-[15px]">' + esc(A.run) + '</button>' +
            '<button type="button" id="agentStop" class="pill light !h-11 !px-5 !text-[15px]" disabled>' + esc(A.stop) + '</button>' +
          '</div></form>' +
        '<div class="flex items-center justify-between text-xs text-ink4">' +
          '<span class="inline-flex items-center gap-2"><i id="agentDot" class="inline-block size-2 rounded-full bg-line"></i><span id="agentStatus" role="status" aria-live="polite">' + esc(A.status.idle) + '</span></span>' +
          '<button type="button" id="agentClear" class="linklike !min-h-8 text-xs underline-offset-2 hover:underline">' + esc(A.clear) + '</button></div>' +
        '<ol id="agentLog" class="m-0 flex list-none flex-col gap-2 p-0 text-[13px] leading-relaxed" aria-live="polite"></ol>' +
      '</div></aside>';
  document.body.appendChild(root);

  const q = <T extends HTMLElement>(id: string) => root.querySelector('#' + id) as T;
  const toggle = q<HTMLButtonElement>('agentToggle'), panel = q('agentPanel'), backdrop = q('agentBackdrop');
  const cfgForm = q<HTMLFormElement>('agentCfg'), form = q<HTMLFormElement>('agentForm'), task = q<HTMLTextAreaElement>('agentTask');
  const runBtn = q<HTMLButtonElement>('agentRun'), stopBtn = q<HTMLButtonElement>('agentStop');
  const statusEl = q('agentStatus'), dot = q('agentDot'), log = q<HTMLOListElement>('agentLog');

  let cfg = loadCfg();
  const fill = () => {
    (cfgForm.elements.namedItem('baseURL') as HTMLInputElement).value = cfg.baseURL;
    (cfgForm.elements.namedItem('model') as HTMLInputElement).value = cfg.model;
    (cfgForm.elements.namedItem('apiKey') as HTMLInputElement).value = cfg.apiKey;
  };
  fill();
  if (!cfg.apiKey) q<HTMLDetailsElement>('agentSettings').open = true;

  let runner: Promise<typeof import('./runner')> | null = null;
  const loadRunner = () => {
    runner ??= import('./runner').catch((err: unknown) => { runner = null; throw err; });
    return runner;
  };

  const setOpen = (open: boolean, focus = true) => {
    panel.classList.toggle('translate-x-full', !open);
    panel.classList.toggle('invisible', !open);
    panel.setAttribute('aria-hidden', String(!open));
    panel.inert = !open;
    backdrop.classList.toggle('opacity-0', !open);
    backdrop.classList.toggle('pointer-events-none', !open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.classList.toggle('opacity-0', open);
    toggle.classList.toggle('pointer-events-none', open);
    document.body.classList.toggle('agent-open', open);
    write(KEY_OPEN, open ? '1' : '0');
    if (open) {
      // Start fetching page-agent now, so it is usually there by the time a task is typed.
      loadRunner().catch(() => addLog('error', A.loadFail));
      if (focus) setTimeout(() => (cfg.apiKey ? task : (cfgForm.elements.namedItem('apiKey') as HTMLInputElement)).focus(), 260);
    } else if (focus) toggle.focus();
  };
  toggle.addEventListener('click', () => setOpen(true));
  q('agentClose').addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } });

  cfgForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(cfgForm);
    cfg = {
      baseURL: String(fd.get('baseURL') || '').trim() || DEFAULTS.baseURL,
      model: String(fd.get('model') || '').trim() || DEFAULTS.model,
      apiKey: String(fd.get('apiKey') || '').trim()
    };
    write(KEY_CFG, JSON.stringify(cfg));
    fill();
    q('agentSaved').textContent = A.saved;
    setTimeout(() => { q('agentSaved').textContent = ''; }, 1600);
  });

  type LogKind = 'user' | 'step' | 'info' | 'error' | 'done' | 'ask';
  const tone: Record<LogKind, string> = {
    user: 'bg-btn text-btn-ink self-end max-w-[85%]',
    step: 'bg-card border border-line',
    info: 'text-ink4 px-1 py-0.5',
    error: 'bg-[#FBE4DC] text-[#7A2E12] dark:bg-[#3A1F16] dark:text-[#F3C2B0]',
    done: 'bg-[#E4EFE6] text-[#1F4D2B] dark:bg-[#1C2E21] dark:text-[#BFE3C8]',
    ask: 'bg-mark/60 border border-line'
  };
  function addLog(kind: LogKind, text: string, extra = ''): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'rounded-xl px-3 py-2 break-words whitespace-pre-wrap ' + tone[kind];
    li.innerHTML = esc(text) + extra;
    log.appendChild(li);
    li.scrollIntoView({ block: 'nearest' });
    return li;
  }
  q('agentClear').addEventListener('click', () => { log.innerHTML = ''; });

  const DOT: Record<string, string> = { idle: 'bg-line', running: 'bg-accent animate-pulse', completed: 'bg-[#4F9D69]', error: 'bg-[#D9534F]', stopped: 'bg-ink4' };
  const setStatus = (s: keyof typeof A.status) => {
    statusEl.textContent = A.status[s];
    dot.className = 'inline-block size-2 rounded-full ' + (DOT[s] ?? DOT.idle);
  };

  let current: Run | null = null;
  const busy = (on: boolean) => { runBtn.disabled = on; stopBtn.disabled = !on; task.disabled = on; };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void start();
  });
  task.addEventListener('keydown', (e) => {
    // Enter runs, Shift+Enter is a new line; an IME composition's Enter is not a submit.
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  stopBtn.addEventListener('click', () => { void current?.stop(); });

  async function start(): Promise<void> {
    const text = task.value.trim();
    if (!text || current) return;
    if (!cfg.baseURL || !cfg.model || !cfg.apiKey) {
      q<HTMLDetailsElement>('agentSettings').open = true;
      addLog('error', A.needConfig);
      return;
    }
    addLog('user', text);
    task.value = '';
    busy(true);
    setStatus('running');
    let mod: typeof import('./runner');
    try {
      const pending = addLog('info', A.loading);
      mod = await loadRunner();
      pending.remove();
    } catch {
      addLog('error', A.loadFail);
      busy(false); setStatus('error');
      return;
    }
    let thinking: HTMLLIElement | null = null;
    current = mod.runTask(text, cfg, loc === 'zh' ? 'zh-CN' : 'en-US', {
      onStatus: (s) => setStatus(s),
      onActivity: (a) => {
        if (a.type === 'thinking') { thinking ??= addLog('info', '…'); }
        else { thinking?.remove(); thinking = null; }
        if (a.type === 'retrying') addLog('info', '↻ ' + a.attempt + '/' + a.maxAttempts);
        if (a.type === 'error') addLog('error', a.message);
      },
      onStep: (ev) => {
        if (ev.type === 'step') {
          const goal = ev.reflection.next_goal || ev.reflection.evaluation_previous_goal || '';
          if (ev.action.name === 'done') return;  // the result line says it
          addLog('step', (goal ? goal + '\n' : '') + '→ ' + ev.action.name + (ev.action.output ? ' · ' + ev.action.output.slice(0, 160) : ''));
        } else if (ev.type === 'error') addLog('error', ev.message);
        else if (ev.type === 'retry') addLog('info', '↻ ' + ev.message);
      },
      ask: (question, signal) => new Promise<string>((resolve, reject) => {
        const li = addLog('ask', question, '<form class="mt-2 flex gap-2"><input class="' + field + ' !h-9" placeholder="' + esc(A.askPh) + '"><button class="pill dark tiny !h-9">' + esc(A.answer) + '</button></form>');
        const f = li.querySelector('form') as HTMLFormElement, input = li.querySelector('input') as HTMLInputElement;
        input.focus();
        f.addEventListener('submit', (ev) => { ev.preventDefault(); const v = input.value.trim(); f.remove(); addLog('user', v); resolve(v); });
        signal.addEventListener('abort', () => { f.remove(); reject(new DOMException('aborted', 'AbortError')); }, { once: true });
      })
    });
    try {
      const r = await current.result;
      addLog(r.success ? 'done' : 'error', (r.success ? A.done : A.failed) + (r.data ? ' · ' + r.data : ''));
    } catch (err) {
      addLog('error', err instanceof Error ? err.message : String(err));
      setStatus('error');
    } finally {
      // Assigned inside the hooks above, which the compiler cannot see.
      (thinking as HTMLLIElement | null)?.remove();
      current = null;
      busy(false);
    }
  }

  // Restore the last state without stealing focus from the page.
  setOpen(read(KEY_OPEN) === '1', false);
}
