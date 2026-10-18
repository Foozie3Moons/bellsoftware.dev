import { useCallback, useEffect, useRef, useState } from 'react';
import './ClaudeSessionsDemo.css';

/*
 * A simplified, self-contained mock of Claude Sessions, modeled on the
 * screenshots in "Where AI Actually Fits". Nothing here talks to a real
 * service: GitLab polls, session state and ClickUp changes are all simulated.
 */

type View = 'sessions' | 'work';
type State = 'running' | 'waiting' | 'idle' | 'done';

interface Msg {
  kind: 'you' | 'claude' | 'tools' | 'command';
  text: string;
  tools?: { verb: string; arg: string }[];
}

interface Session {
  id: string;
  title: string;
  repo: string;
  branch: string;
  state: State;
  note?: string;
  age: string;
  chips: { label: string; tone: 'amber' | 'blue' | 'plain' }[];
  msgs: Msg[];
  ask?: { tool: string; arg: string };
  then?: Msg[];
}

interface Pick {
  id: string;
  title: string;
  reason: string;
  status: string;
  track: 'Checkout' | 'Support';
  mr?: string;
  sessionId?: string;
}

interface Toast {
  id: number;
  title: string;
  body: string;
}

const initialSessions: Session[] = [
  {
    id: 'perm',
    title: 'Permission dialog styling',
    repo: 'claude-sessions',
    branch: 'feature/work-tracks',
    state: 'waiting',
    note: 'permission',
    age: '2m',
    chips: [
      { label: '1 merge request', tone: 'amber' },
      { label: '1 ClickUp ticket', tone: 'blue' },
      { label: '3 uncommitted files', tone: 'amber' },
    ],
    msgs: [
      { kind: 'you', text: 'Give the permission dialog the same header style as the ClickUp one.' },
      { kind: 'claude', text: 'I updated the header and the button order. I want to run the build to check it.' },
    ],
    ask: { tool: 'Bash', arg: 'pnpm build' },
    then: [
      { kind: 'tools', text: '1 tool call', tools: [{ verb: 'Bash', arg: 'pnpm build' }] },
      { kind: 'claude', text: 'The build passes. The dialog matches the ClickUp header now.' },
    ],
  },
  {
    id: 'rsbuild',
    title: 'Rsbuild migration',
    repo: 'claude-sessions',
    branch: 'feature/audit-follow-ups',
    state: 'running',
    age: 'just now',
    chips: [{ label: '2 unpushed commits', tone: 'amber' }],
    msgs: [
      { kind: 'command', text: '/review the Rsbuild config' },
      { kind: 'you', text: 'Move the renderer build from Vite to Rsbuild.' },
      { kind: 'claude', text: 'I will swap vite.config.ts for an rsbuild.config.ts and keep the main process on esbuild.' },
      {
        kind: 'tools',
        text: '3 tool calls',
        tools: [
          { verb: 'Read', arg: 'vite.config.ts' },
          { verb: 'Write', arg: 'rsbuild.config.ts' },
          { verb: 'Bash', arg: 'pnpm build' },
        ],
      },
      { kind: 'claude', text: 'The build passes. Checking hot reload in pnpm dev next.' },
    ],
  },
  {
    id: 'totals',
    title: 'Checkout totals',
    repo: 'checkout',
    branch: 'CU-86baf5d0y-mb-checkout-totals',
    state: 'idle',
    age: '3h',
    chips: [
      { label: '1 merge request', tone: 'amber' },
      { label: '1 ClickUp ticket', tone: 'blue' },
    ],
    msgs: [
      { kind: 'you', text: 'Round tax per line item instead of on the order total.' },
      { kind: 'claude', text: 'Done. Rounding moved into LineItem, and MR !418 is open for review.' },
    ],
  },
];

const initialPicks: Pick[] = [
  {
    id: 'tax',
    title: 'Round tax per line item',
    reason: 'Finishing it closes the totals goal before the audit date.',
    status: 'to do',
    track: 'Checkout',
    mr: '!418',
    sessionId: 'totals',
  },
  {
    id: 'invoice',
    title: 'Customer cannot download invoice',
    reason: 'Support has waited 6 days on it.',
    status: 'open',
    track: 'Support',
  },
  {
    id: 'safety',
    title: 'Judge Safety as a whole-MR check',
    reason: 'You asked for it: it blocks the release, and nobody owns it yet.',
    status: 'not on your board',
    track: 'Checkout',
  },
];

const swapPool: Pick[] = [
  {
    id: 'refund',
    title: 'Refund email shows the wrong currency',
    reason: 'Two tickets this week, both from the same region.',
    status: 'open',
    track: 'Support',
  },
];

const trackColor = { Checkout: '#7b4fd6', Support: '#c8461a' } as const;

let nextToast = 1;

function stateLabel(s: Session) {
  if (s.state === 'waiting') return 'waiting';
  if (s.state === 'running') return 'working';
  if (s.state === 'done') return 'done';
  return 'idle';
}

export default function ClaudeSessionsDemo() {
  const [view, setView] = useState<View>('work');
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [activeId, setActiveId] = useState('perm');
  const [picks, setPicks] = useState<Pick[]>(initialPicks);
  const [pool, setPool] = useState<Pick[]>(swapPool);
  const [why, setWhy] = useState<string | null>(null);
  const [approval, setApproval] = useState<'pending' | 'open' | 'done'>('pending');
  const [reviews, setReviews] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<number[]>([]);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const notify = useCallback(
    (title: string, body: string) => {
      const id = nextToast++;
      setToasts((list) => [...list.slice(-1), { id, title, body }]);
      later(3400, () => setToasts((list) => list.filter((t) => t.id !== id)));
    },
    [later],
  );

  const patch = (id: string, p: Partial<Session>) =>
    setSessions((list) => list.map((s) => (s.id === id ? { ...s, ...p } : s)));

  const open = (id: string) => {
    setActiveId(id);
    setView('sessions');
  };

  const allow = (s: Session) => {
    patch(s.id, { state: 'running', note: undefined, ask: undefined });
    later(1600, () => {
      setSessions((list) =>
        list.map((x) =>
          x.id === s.id ? { ...x, state: 'done', age: 'just now', msgs: [...x.msgs, ...(x.then ?? [])], then: undefined } : x,
        ),
      );
      notify('Session finished', s.title);
    });
  };

  const deny = (s: Session) => {
    patch(s.id, {
      state: 'idle',
      note: undefined,
      ask: undefined,
      msgs: [...s.msgs, { kind: 'claude', text: 'Okay, I will not run the build. The changes are ready for you to check.' }],
    });
  };

  const start = (p: Pick) => {
    const id = `s-${p.id}`;
    const s: Session = {
      id,
      title: p.title,
      repo: p.track === 'Support' ? 'billing-portal' : 'checkout',
      branch: `CU-${p.id}-fix`,
      state: 'running',
      age: 'just now',
      chips: [{ label: '1 ClickUp ticket', tone: 'blue' }],
      msgs: [
        { kind: 'you', text: `${p.title}. ${p.reason}` },
        { kind: 'claude', text: 'Reading the ticket and the linked support thread…' },
      ],
    };
    setSessions((list) => [...list, s]);
    setPicks((list) => list.map((x) => (x.id === p.id ? { ...x, sessionId: id, status: 'in progress' } : x)));
    open(id);
    notify('ClickUp updated', `"${p.title}" moved to in progress.`);
    later(2600, () => {
      setSessions((list) =>
        list.map((x) =>
          x.id === id
            ? {
                ...x,
                state: 'waiting',
                note: 'permission',
                msgs: [...x.msgs.slice(0, -1), { kind: 'claude', text: 'The invoice URL expires before the email is opened. I want to run the failing test.' }],
                ask: { tool: 'Bash', arg: 'pnpm test invoices' },
                then: [
                  { kind: 'tools', text: '1 tool call', tools: [{ verb: 'Bash', arg: 'pnpm test invoices' }] },
                  { kind: 'claude', text: 'Reproduced. The link lives 15 minutes, and the email often sits longer.' },
                ],
              }
            : x,
        ),
      );
      notify('Claude needs you', `${p.title} · permission`);
    });
  };

  const swap = (p: Pick) => {
    const next = pool[0];
    if (!next) return;
    setPicks((list) => list.map((x) => (x.id === p.id ? next : x)));
    setPool((list) => [...list.slice(1), p]);
    setWhy(null);
  };

  const moveTicket = () => {
    setApproval('done');
    notify('ClickUp updated', '"Show checkout totals before tax" moved to delivered.');
  };

  const poll = () => {
    const mr = `media-search!${482 + reviews.length}`;
    setReviews((list) => [...list, mr]);
    notify('Review requested', `${mr} is waiting on you.`);
  };

  const reset = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setView('work');
    setSessions(initialSessions);
    setActiveId('perm');
    setPicks(initialPicks);
    setPool(swapPool);
    setWhy(null);
    setApproval('pending');
    setReviews([]);
    setToasts([]);
  };

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0];
  const needsYou = sessions.filter((s) => s.state === 'waiting');
  const groups = Array.from(new Set(sessions.filter((s) => s.state !== 'waiting').map((s) => s.repo)));
  const live = sessions.filter((s) => s.state === 'running' || s.state === 'waiting').length;
  const wip = (track: Pick['track']) => picks.filter((p) => p.track === track && p.status === 'in progress').length;

  const row = (s: Session) => (
    <button
      key={s.id}
      type="button"
      className="cs-row"
      aria-current={view === 'sessions' && s.id === active.id ? 'true' : undefined}
      onClick={() => open(s.id)}
    >
      <span className={`cs-dot cs-dot-${s.state}`} aria-hidden="true" />
      <span className="cs-row-main">
        <span className="cs-row-title">
          {s.title}
          {s.state === 'waiting' && <span className="cs-row-repo"> · {s.repo}</span>}
        </span>
        {s.note && <span className="cs-row-note">{s.note}</span>}
      </span>
      <span className="cs-row-age">{s.age}</span>
    </button>
  );

  return (
    <figure className="cs" aria-label="Interactive mock of Claude Sessions">
      <div className="cs-app">
        <div className="cs-titlebar">
          <span className="cs-lights" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <div className="cs-switch" role="tablist" aria-label="View">
            <button type="button" role="tab" aria-selected={view === 'sessions'} onClick={() => setView('sessions')}>
              Sessions
            </button>
            <button type="button" role="tab" aria-selected={view === 'work'} onClick={() => setView('work')}>
              Work
            </button>
          </div>
        </div>

        <div className="cs-body">
          {view === 'sessions' ? (
            <>
              <aside className="cs-side">
                <div className="cs-side-head">
                  <span className="cs-h1">Sessions</span>
                  <span className="cs-muted">{live} live</span>
                </div>
                <div className="cs-search">Search all sessions</div>

                {needsYou.length > 0 && (
                  <div className="cs-needs">
                    <span className="cs-needs-label">Needs you {needsYou.length}</span>
                    {needsYou.map(row)}
                  </div>
                )}

                {groups.map((repo) => {
                  const list = sessions.filter((s) => s.repo === repo && s.state !== 'waiting');
                  return (
                    <div key={repo} className="cs-group">
                      <div className="cs-group-head">
                        <span className="cs-group-name">{repo}</span>
                        <span className="cs-mono cs-muted cs-ellip">{list[0]?.branch}</span>
                      </div>
                      {list.map(row)}
                    </div>
                  );
                })}

                {reviews.length > 0 && (
                  <div className="cs-review">
                    <span className="cs-label">Code review {reviews.length}</span>
                    {reviews.map((r) => (
                      <div key={r} className="cs-review-row">
                        <span className="cs-dot cs-dot-waiting" aria-hidden="true" />
                        <span className="cs-row-main">
                          <span className="cs-row-title">{r} Cache facet counts</span>
                          <span className="cs-row-note">draft to approve</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </aside>

              <section className="cs-main" aria-label={active.title}>
                <header className="cs-head">
                  <div className="cs-head-line">
                    <span className="cs-title">{active.title}</span>
                    <span className={`cs-pill cs-pill-${active.state}`}>{stateLabel(active)}</span>
                    {active.note && <span className="cs-amber-text">{active.note}</span>}
                    <span className="cs-head-meta">{active.repo}</span>
                  </div>
                  <div className="cs-chips">
                    {active.chips.map((c) => (
                      <span key={c.label} className={`cs-chip cs-chip-${c.tone}`}>
                        {c.label}
                      </span>
                    ))}
                  </div>
                </header>
                <div className="cs-status cs-mono">
                  <span style={{ flex: "none" }}>claude-opus-5-5</span>
                  <span className="cs-ellip cs-muted">
                    {active.repo} @ {active.branch}
                  </span>
                  <span className="cs-ctx" style={{ flex: "none" }}>
                    ctx <i style={{ width: '42%' }} /> 42%
                  </span>
                </div>

                <div className="cs-convo">
                  {active.msgs.map((m, i) =>
                    m.kind === 'tools' ? (
                      <div key={i} className="cs-tools">
                        <span className="cs-muted">{m.text}</span>
                        {m.tools?.map((t) => (
                          <span key={t.verb + t.arg} className="cs-mono">
                            <span className="cs-chev">›</span> {t.verb} <span className="cs-muted">{t.arg}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div key={i} className={`cs-msg cs-msg-${m.kind}`}>
                        {m.kind === 'command' ? (
                          <span className="cs-mono">
                            <span className="cs-link">{m.text.split(' ')[0]}</span> {m.text.split(' ').slice(1).join(' ')}
                          </span>
                        ) : (
                          m.text
                        )}
                      </div>
                    ),
                  )}
                  {active.state === 'running' && <div className="cs-working cs-muted">Working…</div>}
                </div>

                {active.ask ? (
                  <div className="cs-ask">
                    <span>
                      Allow <b>{active.ask.tool}</b> <span className="cs-mono">{active.ask.arg}</span>?
                    </span>
                    <span className="cs-ask-actions">
                      <button type="button" className="cs-btn" onClick={() => deny(active)}>
                        Deny
                      </button>
                      <button type="button" className="cs-btn cs-btn-blue" onClick={() => allow(active)}>
                        Allow
                      </button>
                    </span>
                  </div>
                ) : (
                  <div className="cs-reply">
                    <span className="cs-muted">Reply…</span>
                    <span className="cs-send">Send</span>
                  </div>
                )}
              </section>
            </>
          ) : (
            <>
              <aside className="cs-side">
                <div className="cs-side-head">
                  <span className="cs-h1">Work</span>
                </div>
                <div className="cs-advisor">
                  <span aria-hidden="true">✦</span> Advisor
                </div>
                <div className="cs-nav cs-nav-on">
                  Today <span className="cs-muted">3 picks</span>
                </div>
                <div className="cs-nav">
                  MRs <span className="cs-muted">5</span>
                </div>
                <div className="cs-nav">
                  Review <span className="cs-muted">{5 + reviews.length}</span>
                </div>
                <div className="cs-nav">
                  Follow-ups <span className="cs-muted">3</span>
                </div>
                <span className="cs-label">Tracks</span>
                <div className="cs-track">
                  <span className="cs-dot" style={{ background: trackColor.Checkout }} aria-hidden="true" /> Checkout
                  <span className="cs-muted">60%</span>
                </div>
                <div className="cs-track">
                  <span className="cs-dot" style={{ background: trackColor.Support }} aria-hidden="true" /> Support
                  <span className="cs-muted">40%</span>
                </div>
              </aside>

              <section className="cs-main cs-work" aria-label="Today">
                <div className="cs-work-head">
                  <span className="cs-title">Today</span>
                  <span className="cs-muted">Picked 1:19 PM</span>
                  {approval !== 'done' && (
                    <button type="button" className="cs-pending" onClick={() => setApproval('open')}>
                      1 change to approve
                    </button>
                  )}
                </div>

                <div className="cs-picks">
                  {picks.map((p, i) => (
                    <div key={p.id} className={`cs-pick${p.status === 'not on your board' ? ' cs-pick-off' : ''}`}>
                      <span className="cs-pick-num">{i + 1}</span>
                      <div className="cs-pick-body">
                        <div className="cs-pick-top">
                          <span className="cs-pick-title">{p.title}</span>
                          <span className={`cs-status-pill${p.status === 'in progress' ? ' cs-status-live' : ''}`}>{p.status}</span>
                        </div>
                        <span className="cs-pick-reason">{p.reason}</span>
                        {why === p.id && (
                          <span className="cs-why">
                            Track {p.track} is at {p.track === 'Checkout' ? '60' : '40'}% of your week, and this is its oldest open item.
                          </span>
                        )}
                        <div className="cs-pick-foot">
                          <span className="cs-muted">{p.sessionId ? '1 session' : p.track}</span>
                          <span className="cs-pick-actions">
                            {p.mr && <span className="cs-mr">{p.mr}</span>}
                            {p.sessionId ? (
                              <button type="button" onClick={() => open(p.sessionId!)}>
                                Open session
                              </button>
                            ) : (
                              <button type="button" onClick={() => start(p)}>
                                ▷ Start
                              </button>
                            )}
                            <button type="button" onClick={() => swap(p)} disabled={pool.length === 0}>
                              Swap
                            </button>
                            <button type="button" onClick={() => setWhy(why === p.id ? null : p.id)} aria-expanded={why === p.id}>
                              Why?
                            </button>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <span className="cs-wip-title">Work in progress</span>
                <div className="cs-wip">
                  {(['Checkout', 'Support'] as const).map((t) => (
                    <div key={t} className="cs-wip-card">
                      <div className="cs-wip-top">
                        <b>{t}</b>
                        <span className="cs-room">Room for {3 - wip(t)}</span>
                      </div>
                      <span>
                        <b className="cs-big">{wip(t)}</b> / 3 in progress
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        {approval === 'open' && (
          <div className="cs-scrim">
            <div className="cs-dialog" role="dialog" aria-label="Approve ClickUp change">
              <div className="cs-dialog-head">
                <b>ClickUp</b>
                <span>Your team sees this</span>
              </div>
              <div className="cs-dialog-body">
                <span className="cs-dialog-title">Move "Show checkout totals before tax" to delivered</span>
                <div className="cs-box">
                  <b>Change</b>
                  <div className="cs-change">
                    <span className="cs-muted">Status</span>
                    <s>in progress</s>
                    <span>
                      <i className="cs-green-sq" aria-hidden="true" /> delivered
                    </span>
                  </div>
                </div>
                <div className="cs-box">
                  <b>Why</b>
                  <span className="cs-muted">Its MR !412 merged yesterday.</span>
                </div>
                <div className="cs-dialog-actions">
                  <button type="button" className="cs-btn" onClick={() => setApproval('pending')}>
                    Not now
                  </button>
                  <button type="button" className="cs-btn cs-btn-blue" onClick={moveTicket}>
                    Move ticket
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="cs-toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="cs-toast">
              <b>{t.title}</b>
              <span>{t.body}</span>
            </div>
          ))}
        </div>
      </div>

      <figcaption className="cs-caption">
        <span>A simplified mock of Claude Sessions. Start a pick, approve the ClickUp change, or answer a permission request.</span>
        <span className="cs-caption-actions">
          <button type="button" onClick={poll}>
            Simulate GitLab poll
          </button>
          <button type="button" onClick={reset}>
            Reset
          </button>
        </span>
      </figcaption>
    </figure>
  );
}
