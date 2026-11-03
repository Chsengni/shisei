/* The page-agent side of the assistant drawer, loaded with import() the first time the drawer opens, so readers who
   never open it download none of it. page-agent's PageAgent class is PageAgentCore + PageController + a floating
   panel of its own; the drawer is the only UI we want, so this builds the headless pair directly. */
import { PageAgentCore, type AgentActivity, type ExecutionResult, type HistoricalEvent } from '@page-agent/core';
import { PageController } from '@page-agent/page-controller';

export interface AgentSettings { baseURL: string; model: string; apiKey: string }
export interface RunHooks {
  onStatus: (status: PageAgentCore['status']) => void;
  onActivity: (a: AgentActivity) => void;
  onStep: (e: HistoricalEvent) => void;
  ask: (question: string, signal: AbortSignal) => Promise<string>;
}

export interface Run { result: Promise<ExecutionResult>; stop: () => Promise<void> }

/** Start one task. Each run gets a fresh agent, disposed when it settles, so a stopped run leaves nothing behind. */
export function runTask(task: string, cfg: AgentSettings, lang: 'zh-CN' | 'en-US', hooks: RunHooks): Run {
  const pageController = new PageController({
    // The drawer marks itself data-page-agent-ignore; the mask would cover the Stop button, so it stays off.
    enableMask: false
  });
  const agent = new PageAgentCore({
    pageController,
    baseURL: cfg.baseURL,
    model: cfg.model,
    apiKey: cfg.apiKey,
    language: lang,
    maxSteps: 25,
    instructions: {
      system: 'You are operating Shisei, a static pose-reference gallery (faceless mannequin line art, five camera angles, ' +
        'plus clay / depth / normal maps and photo renders). Use the page\'s own controls (series and category chips, angle ' +
        'filter, cards, lightbox buttons). Suggestive poses are blurred on purpose: never reveal them unless the user ' +
        'explicitly asks. Do not download files or open external sites unless asked. Reply in the user\'s language.'
    }
  });
  agent.onAskUser = (question, opts) => hooks.ask(question, opts?.signal ?? new AbortController().signal);
  let seen = 0;
  agent.addEventListener('statuschange', () => hooks.onStatus(agent.status));
  agent.addEventListener('activity', (e) => hooks.onActivity((e as CustomEvent<AgentActivity>).detail));
  agent.addEventListener('historychange', () => {
    for (; seen < agent.history.length; seen++) hooks.onStep(agent.history[seen]);
  });
  const result = agent.execute(task).finally(() => { setTimeout(() => agent.dispose(), 0); });
  return { result, stop: () => agent.stop() };
}
