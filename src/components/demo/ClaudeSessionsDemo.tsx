import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import './ClaudeSessionsDemo.css';

/*
 * A simplified, self-contained mock of Claude Sessions, modeled on how the
 * real app behaves. Nothing here talks to a real service: GitLab polls,
 * session state and ClickUp changes are all simulated.
 */

type View = 'sessions' | 'work';
type State = 'running' | 'waiting' | 'idle' | 'done';

interface Msg {
  kind: 'you' | 'claude' | 'tools' | 'command';
  text: string;
  tools?: { verb: string; arg: string }[];
}

interface Ask {
  tool: string;
  heading: string;
  summary: string;
  field: string;
  value: string;
  why: string;
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
  ask?: Ask;
  then?: Msg[];
}

interface Pick {
  id: string;
  ticket: string;
  title: string;
  reason: string;
  status: string;
  track: 'Checkout' | 'Support';
  mr?: string;
  sessionId?: string;
}

interface Approval {
  id: string;
  ticket: string;
  name: string;
  from: string;
  to: string;
  why: string;
  pickId?: string;
}

interface Offer {
  label: string;
  title: string;
  author: string;
  starting?: boolean;
}

interface Review {
  label: string;
  title: string;
  state: 'running' | 'waiting';
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
      {
        kind: 'you',
        text: 'Give the permission dialog the same header style as the ClickUp one.',
      },
      {
        kind: 'claude',
        text: 'I updated the header and the button order. I want to run the build to check it.',
      },
    ],
    ask: {
      tool: 'Bash',
      heading: 'Run a command?',
      summary: 'Build the app',
      field: 'Command',
      value: 'pnpm build',
      why: 'The header and button order changed, and the build checks nothing else broke.',
    },
    then: [
      {
        kind: 'tools',
        text: '1 tool call',
        tools: [{ verb: 'Bash', arg: 'pnpm build' }],
      },
      {
        kind: 'claude',
        text: 'The build passes. The dialog matches the ClickUp header now.',
      },
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
      {
        kind: 'claude',
        text: 'I will swap vite.config.ts for an rsbuild.config.ts and keep the main process on esbuild.',
      },
      {
        kind: 'tools',
        text: '3 tool calls',
        tools: [
          { verb: 'Read', arg: 'vite.config.ts' },
          { verb: 'Write', arg: 'rsbuild.config.ts' },
          { verb: 'Bash', arg: 'pnpm build' },
        ],
      },
      {
        kind: 'claude',
        text: 'The build passes. Checking hot reload in pnpm dev next.',
      },
    ],
  },
  {
    id: 'totals',
    title: 'Round tax per line item',
    repo: 'checkout',
    branch: 'CU-86baf5d0y-mb-round-tax-per-line',
    state: 'idle',
    age: '3h',
    chips: [
      { label: '1 merge request', tone: 'amber' },
      { label: '1 ClickUp ticket', tone: 'blue' },
    ],
    msgs: [
      {
        kind: 'you',
        text: 'Round tax per line item instead of on the order total.',
      },
      {
        kind: 'claude',
        text: 'Done. Rounding moved into LineItem, and MR !418 is open for review.',
      },
    ],
  },
];

const initialPicks: Pick[] = [
  {
    id: 'tax',
    ticket: '86baf5d0y',
    title: 'Round tax per line item',
    reason: 'Finishing it closes the totals goal before the audit date.',
    status: 'peer review',
    track: 'Checkout',
    mr: '!418',
    sessionId: 'totals',
  },
  {
    id: 'invoice',
    ticket: '86bb2k7q1',
    title: 'Customer cannot download invoice',
    reason: 'Support has waited 6 days on it.',
    status: 'open',
    track: 'Support',
  },
  {
    id: 'safety',
    ticket: '86bb3m9x4',
    title: 'Judge Safety as a whole-MR check',
    reason: 'You asked for it: it blocks the release, and nobody owns it yet.',
    status: 'not on your board',
    track: 'Checkout',
  },
];

const swapPool: Pick[] = [
  {
    id: 'refund',
    ticket: '86bb4c2n8',
    title: 'Refund email shows the wrong currency',
    reason: 'Two tickets this week, both from the same region.',
    status: 'open',
    track: 'Support',
  },
];

const initialApprovals: Approval[] = [
  {
    id: 'delivered',
    ticket: '86baf5c1r',
    name: 'Show checkout totals before tax',
    from: 'in progress',
    to: 'delivered',
    why: 'Its MR !412 is merged',
  },
];

const whyAnswer: Record<Pick['track'], string> = {
  Checkout: 'Checkout is your top track this quarter, and this is the oldest open item on it.',
  Support: 'Support tickets past five days count against the team goal, and this one is at six.',
};

const trackColor = { Checkout: '#7b4fd6', Support: '#c8461a' } as const;

let nextToast = 1;

function stateLabel(s: Session) {
  if (s.state === 'waiting') return 'waiting';
  if (s.state === 'running') return 'working';
  if (s.state === 'done') return 'done';
  return 'idle';
}

function slug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .split('-')
    .slice(0, 4)
    .join('-');
}

export default function ClaudeSessionsDemo() {
  const [view, setView] = useState<View>('work');
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [activeId, setActiveId] = useState('perm');
  const [picks, setPicks] = useState<Pick[]>(initialPicks);
  const [pool, setPool] = useState<Pick[]>(swapPool);
  const [why, setWhy] = useState<string | null>(null);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [swapReason, setSwapReason] = useState('');
  const [approvals, setApprovals] = useState<Approval[]>(initialApprovals);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [polls, setPolls] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<number[]>([]);
  const reviewRef = useRef<HTMLDivElement>(null);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  useEffect(() => {
    if (offers.length > 0) reviewRef.current?.scrollIntoView({ block: 'nearest' });
  }, [offers.length, view]);

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
          x.id === s.id
            ? {
                ...x,
                state: 'done',
                age: 'just now',
                msgs: [...x.msgs, ...(x.then ?? [])],
                then: undefined,
              }
            : x,
        ),
      );
      notify('Task finished', s.title);
    });
  };

  const deny = (s: Session) => {
    patch(s.id, {
      state: 'idle',
      note: undefined,
      ask: undefined,
      then: undefined,
      msgs: [
        ...s.msgs,
        {
          kind: 'claude',
          text: 'Okay, I will not run it. The changes are ready for you to check.',
        },
      ],
    });
  };

  const start = (p: Pick) => {
    const id = `s-${p.id}`;
    const branch = `CU-${p.ticket}-mb-${slug(p.title)}`;
    const s: Session = {
      id,
      title: p.title,
      repo: p.track === 'Support' ? 'billing-portal' : 'checkout',
      branch,
      state: 'running',
      age: 'just now',
      chips: [{ label: '1 ClickUp ticket', tone: 'blue' }],
      msgs: [
        {
          kind: 'you',
          text: `Start on CU-${p.ticket}, "${p.title}", on the ${p.track} track. ${p.reason}`,
        },
        {
          kind: 'claude',
          text: 'Reading the ticket and the linked support thread…',
        },
      ],
    };
    setSessions((list) => [...list, s]);
    setPicks((list) => list.map((x) => (x.id === p.id ? { ...x, sessionId: id } : x)));
    setApprovals((list) => [
      ...list,
      {
        id: `progress-${p.id}`,
        ticket: p.ticket,
        name: p.title,
        from: p.status,
        to: 'in progress',
        why: `A session is working on it on ${branch}`,
        pickId: p.id,
      },
    ]);
    open(id);
    later(2600, () => {
      setSessions((list) =>
        list.map((x) =>
          x.id === id
            ? {
                ...x,
                state: 'waiting',
                note: 'permission',
                msgs: [
                  ...x.msgs.slice(0, -1),
                  {
                    kind: 'claude',
                    text: 'The invoice URL expires before the email is opened. I want to run the failing test.',
                  },
                ],
                ask: {
                  tool: 'Bash',
                  heading: 'Run a command?',
                  summary: 'Run the invoice tests',
                  field: 'Command',
                  value: 'pnpm test invoices',
                  why: 'The download link looks like it expires early, and this test should reproduce it.',
                },
                then: [
                  {
                    kind: 'tools',
                    text: '1 tool call',
                    tools: [{ verb: 'Bash', arg: 'pnpm test invoices' }],
                  },
                  {
                    kind: 'claude',
                    text: 'Reproduced. The link lives 15 minutes, and the email often sits longer.',
                  },
                ],
              }
            : x,
        ),
      );
      notify('Waiting on permission', p.title);
    });
  };

  const submitSwap = (event: FormEvent) => {
    event.preventDefault();
    const id = swapping;
    const next = pool[0];
    setSwapping(null);
    setSwapReason('');
    if (!id || !next) return;
    setPicks((list) => list.map((x) => (x.id === id ? { ...x, status: 'swapping' } : x)));
    later(1200, () => {
      const old = picks.find((x) => x.id === id);
      setPicks((list) => list.map((x) => (x.id === id ? next : x)));
      setPool((list) => [...list.slice(1), ...(old ? [old] : [])]);
      setWhy(null);
    });
  };

  const decide = (a: Approval, allowed: boolean) => {
    const rest = approvals.filter((x) => x.id !== a.id);
    setApprovals(rest);
    if (rest.length === 0) setApprovalOpen(false);
    if (allowed && a.pickId) setPicks((list) => list.map((x) => (x.id === a.pickId ? { ...x, status: a.to } : x)));
  };

  const poll = () => {
    const label = `web-app!${482 + polls}`;
    const title = polls % 2 === 0 ? 'Cache facet counts' : 'Retry failed webhooks';
    setPolls((n) => n + 1);
    setOffers((list) => [...list, { label, title, author: 'jordan' }]);
    notify('Review requested', `${label} · ${title} by jordan`);
  };

  const runReview = (o: Offer) => {
    setOffers((list) => list.map((x) => (x.label === o.label ? { ...x, starting: true } : x)));
    later(800, () => {
      setOffers((list) => list.filter((x) => x.label !== o.label));
      setReviews((list) => [...list, { label: o.label, title: o.title, state: 'running' }]);
    });
    later(3200, () => {
      setReviews((list) => list.map((r) => (r.label === o.label ? { ...r, state: 'waiting' } : r)));
      notify('Task finished', `Review of ${o.label}`);
    });
  };

  const skip = (o: Offer) => setOffers((list) => list.filter((x) => x.label !== o.label));

  const reset = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setView('work');
    setSessions(initialSessions);
    setActiveId('perm');
    setPicks(initialPicks);
    setPool(swapPool);
    setWhy(null);
    setSwapping(null);
    setSwapReason('');
    setApprovals(initialApprovals);
    setApprovalOpen(false);
    setOffers([]);
    setReviews([]);
    setPolls(0);
    setToasts([]);
  };

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0];
  const needsYou = sessions.filter((s) => s.state === 'waiting');
  const groups = Array.from(new Set(sessions.filter((s) => s.state !== 'waiting').map((s) => s.repo)));
  const live = sessions.filter((s) => s.state === 'running' || s.state === 'waiting').length;
  const wip = (track: Pick['track']) => picks.filter((p) => p.track === track && p.status === 'in progress').length;
  const approval = approvals[0];

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

                {(offers.length > 0 || reviews.length > 0) && (
                  <div className="cs-review" ref={reviewRef}>
                    <span className="cs-label">Code review</span>
                    {offers.map((o) => (
                      <div key={o.label} className="cs-review-row cs-offer">
                        <span className="cs-dot cs-dot-waiting" aria-hidden="true" />
                        <span className="cs-row-main">
                          <span className="cs-row-title">{o.label}</span>
                          <span className="cs-ellip">{o.title}</span>
                          <span className="cs-row-note">Review requested by {o.author}</span>
                          <span className="cs-offer-actions">
                            <button type="button" className="cs-btn" disabled={o.starting} onClick={() => skip(o)}>
                              Skip
                            </button>
                            <button
                              type="button"
                              className="cs-btn cs-btn-blue"
                              disabled={o.starting}
                              onClick={() => runReview(o)}
                            >
                              {o.starting ? 'Starting…' : 'Run review'}
                            </button>
                          </span>
                        </span>
                      </div>
                    ))}
                    {reviews.map((r) => (
                      <div key={r.label} className={`cs-review-row${r.state === 'running' ? ' cs-review-live' : ''}`}>
                        <span className={`cs-dot cs-dot-${r.state}`} aria-hidden="true" />
                        <span className="cs-row-main">
                          <span className="cs-row-title">
                            {r.label} {r.title}
                          </span>
                          <span className="cs-row-note">
                            {r.state === 'running' ? 'reviewing…' : 'draft to approve'}
                          </span>
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
                  <span style={{ flex: 'none' }}>claude-opus-5-5</span>
                  <span className="cs-ellip cs-muted">
                    {active.repo} @ {active.branch}
                  </span>
                  <span className="cs-ctx" style={{ flex: 'none' }}>
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
                            <span className="cs-link">{m.text.split(' ')[0]}</span>{' '}
                            {m.text.split(' ').slice(1).join(' ')}
                          </span>
                        ) : (
                          m.text
                        )}
                      </div>
                    ),
                  )}
                  {active.state === 'running' && <div className="cs-working cs-muted">Working…</div>}
                </div>

                <div className="cs-reply">
                  <span className="cs-muted">Reply…</span>
                  <span className="cs-send">Send</span>
                </div>
              </section>
            </>
          ) : (
            <>
              <aside className="cs-side">
                <div className="cs-side-head">
                  <span className="cs-h1">Work</span>
                </div>
                <button
                  type="button"
                  className={`cs-advisor${approvals.length > 0 ? ' cs-advisor-waiting' : ''}`}
                  onClick={() => approvals.length > 0 && setApprovalOpen(true)}
                >
                  <span aria-hidden="true">✦</span> Advisor
                  {approvals.length > 0 && <span className="cs-badge">{approvals.length} waiting</span>}
                </button>
                <div className="cs-nav cs-nav-on">
                  Today <span className="cs-muted">{picks.length} picks</span>
                </div>
                <div className="cs-nav">
                  MRs <span className="cs-muted">5</span>
                </div>
                <div className="cs-nav">
                  Review <span className="cs-muted">{5 + offers.length}</span>
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
                </div>

                <div className="cs-picks">
                  {picks.map((p, i) => (
                    <div key={p.id} className={`cs-pick${p.status === 'not on your board' ? ' cs-pick-off' : ''}`}>
                      <span className="cs-pick-num">{i + 1}</span>
                      <div className="cs-pick-body">
                        <div className="cs-pick-top">
                          <span className="cs-pick-title">{p.title}</span>
                          <span className={`cs-status-pill${p.status === 'in progress' ? ' cs-status-live' : ''}`}>
                            {p.status === 'swapping' ? 'asking the advisor…' : p.status}
                          </span>
                        </div>
                        <span className="cs-pick-reason">{p.reason}</span>
                        {why === p.id && (
                          <span className="cs-why">
                            <span className="cs-muted">You asked: Why "{p.title}" today?</span>
                            <span>{whyAnswer[p.track]}</span>
                          </span>
                        )}
                        {swapping === p.id && (
                          <form className="cs-swap" onSubmit={submitSwap}>
                            <input
                              aria-label={`Swap ${p.title}`}
                              autoFocus
                              placeholder="Swap for… name a ticket, paste an id, or say why not this one"
                              value={swapReason}
                              onChange={(e) => setSwapReason(e.target.value)}
                            />
                            <button type="submit" className="cs-btn cs-btn-blue" disabled={pool.length === 0}>
                              Swap
                            </button>
                          </form>
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
                              <button type="button" onClick={() => start(p)} disabled={p.status === 'swapping'}>
                                ▷ Start
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSwapping(swapping === p.id ? null : p.id)}
                              aria-expanded={swapping === p.id}
                              disabled={p.status === 'swapping'}
                            >
                              Swap
                            </button>
                            <button
                              type="button"
                              onClick={() => setWhy(why === p.id ? null : p.id)}
                              aria-expanded={why === p.id}
                            >
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

        {view === 'sessions' && active.ask && (
          <div className="cs-scrim">
            <div className="cs-dialog" role="dialog" aria-label={`${active.title} wants to use ${active.ask.tool}`}>
              <div className="cs-dialog-head cs-dialog-head-private">
                <b>{active.title}</b>
                <span>{active.ask.tool}</span>
              </div>
              <div className="cs-dialog-body">
                <span className="cs-dialog-title">{active.ask.heading}</span>
                <span className="cs-muted">{active.ask.summary}</span>
                <div className="cs-box">
                  <b>{active.ask.field}</b>
                  <span className="cs-mono cs-field">{active.ask.value}</span>
                </div>
                <div className="cs-box">
                  <b>Why</b>
                  <span className="cs-muted">{active.ask.why}</span>
                </div>
                <div className="cs-dialog-actions">
                  <button type="button" className="cs-btn" onClick={() => deny(active)}>
                    Deny
                  </button>
                  <button type="button" className="cs-btn cs-btn-blue" onClick={() => allow(active)}>
                    Allow
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {approvalOpen && approval && (
          <div className="cs-scrim">
            <div className="cs-dialog" role="dialog" aria-label="Approve ClickUp change">
              <div className="cs-dialog-head">
                <b>ClickUp</b>
                <span>
                  Your team sees this
                  {approvals.length > 1 && ` · ${approvals.length - 1} more waiting`}
                </span>
              </div>
              <div className="cs-dialog-body">
                <span className="cs-dialog-title">
                  Move "{approval.name}" to {approval.to}
                </span>
                <div className="cs-box">
                  <b>Change</b>
                  <div className="cs-change">
                    <span className="cs-muted">Status</span>
                    <s>{approval.from}</s>
                    <span>
                      <i className="cs-green-sq" aria-hidden="true" /> {approval.to}
                    </span>
                  </div>
                </div>
                <div className="cs-box">
                  <b>Details</b>
                  <span>
                    <span className="cs-muted">Ticket</span> <span className="cs-mono">CU-{approval.ticket}</span>
                  </span>
                </div>
                <div className="cs-box">
                  <b>Why</b>
                  <span className="cs-muted">{approval.why}</span>
                </div>
                <div className="cs-dialog-actions">
                  <button type="button" className="cs-btn" onClick={() => decide(approval, false)}>
                    Not now
                  </button>
                  <button type="button" className="cs-btn cs-btn-blue" onClick={() => decide(approval, true)}>
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
        <span>
          A simplified mock of Claude Sessions. Start a pick, answer the advisor's ClickUp changes, or handle a
          permission request. Simulate a GitLab poll to get a review request.
        </span>
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
