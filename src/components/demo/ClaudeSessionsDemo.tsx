import { useCallback, useEffect, useRef, useState } from 'react';
import './ClaudeSessionsDemo.css';

/*
 * A simplified, self-contained mock of Claude Sessions for the
 * "Where AI Actually Fits" post. Nothing here talks to a real service:
 * every event (GitLab poll, session state, ClickUp status) is simulated.
 */

type SessionStatus = 'running' | 'waiting' | 'done';
type TaskStatus = 'To do' | 'In progress' | 'Peer review' | 'Delivered';
type Tab = 'sessions' | 'work';

interface Session {
  id: string;
  name: string;
  status: SessionStatus;
  taskId?: string;
  log: { who: 'you' | 'claude'; text: string }[];
  question?: { prompt: string; answer: string };
}

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  sessionId?: string;
}

interface Toast {
  id: number;
  title: string;
  body: string;
}

type Proposal = 'pending' | 'approved' | 'denied';
type Nudge = 'idle' | 'drafted';

const initialSessions: Session[] = [
  {
    id: 's1',
    name: 'Payment form validation',
    status: 'done',
    taskId: 't1',
    log: [
      { who: 'you', text: 'Add inline validation to the payment form.' },
      { who: 'claude', text: 'Done. Validation runs on blur, tests pass, and MR !142 is open.' },
      { who: 'claude', text: 'MR !142 was merged and deployed.' },
    ],
  },
  {
    id: 's2',
    name: 'Flaky checkout test',
    status: 'running',
    log: [
      { who: 'you', text: 'The checkout e2e test fails about one run in ten. Find out why.' },
      { who: 'claude', text: 'Reproducing locally with 50 runs…' },
    ],
  },
];

const initialTasks: Task[] = [
  { id: 't1', title: 'Finish payment form validation', status: 'In progress', sessionId: 's1' },
  { id: 't2', title: 'Address review comments on MR !138', status: 'Peer review' },
  { id: 't3', title: 'Update the rollout ticket', status: 'To do' },
];

const statusLabel: Record<SessionStatus, string> = {
  running: 'Working',
  waiting: 'Needs you',
  done: 'Finished',
};

let nextToastId = 1;

export default function ClaudeSessionsDemo() {
  const [tab, setTab] = useState<Tab>('work');
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeId, setActiveId] = useState('s1');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [proposal, setProposal] = useState<Proposal>('pending');
  const [nudge, setNudge] = useState<Nudge>('idle');
  const [reviews, setReviews] = useState(0);
  const timers = useRef<number[]>([]);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const notify = useCallback(
    (title: string, body: string) => {
      const id = nextToastId++;
      setToasts((list) => [...list.slice(-1), { id, title, body }]);
      later(3200, () => setToasts((list) => list.filter((t) => t.id !== id)));
    },
    [later],
  );

  const updateSession = (id: string, patch: Partial<Session>) =>
    setSessions((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const setTaskStatus = (id: string, status: TaskStatus) =>
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, status } : t)));

  const openSession = (id: string) => {
    setActiveId(id);
    setTab('sessions');
  };

  // Play button: start a session with the task's context, or jump to the open one.
  const play = (task: Task) => {
    if (task.sessionId) {
      openSession(task.sessionId);
      return;
    }
    const id = `s-${task.id}`;
    const session: Session = {
      id,
      name: task.title,
      status: 'running',
      taskId: task.id,
      log: [
        { who: 'you', text: `Context: "${task.title}" from ClickUp, plus the linked MR and its open comments.` },
        { who: 'claude', text: 'Reading the review comments…' },
      ],
    };
    setSessions((list) => [...list, session]);
    setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, sessionId: id, status: 'In progress' } : t)));
    openSession(id);
    notify('Session started', 'ClickUp task moved to In progress.');

    later(2600, () => {
      updateSession(id, {
        status: 'waiting',
        question: {
          prompt: 'Two comments ask for the same refactor. Apply it once and reply to both?',
          answer: 'Yes, apply it once',
        },
      });
      notify('Claude needs your input', task.title);
    });
  };

  const answer = (session: Session) => {
    if (!session.question) return;
    updateSession(session.id, {
      status: 'running',
      question: undefined,
      log: [
        ...session.log,
        { who: 'claude', text: session.question.prompt },
        { who: 'you', text: session.question.answer },
        { who: 'claude', text: 'Applying the refactor and pushing…' },
      ],
    });
    later(2200, () => {
      setSessions((list) =>
        list.map((s) =>
          s.id === session.id
            ? {
                ...s,
                status: 'done',
                log: [...s.log.slice(0, -1), { who: 'claude', text: 'Pushed. Replied to both comments.' }],
              }
            : s,
        ),
      );
      if (session.taskId) setTaskStatus(session.taskId, 'Peer review');
      notify('Session finished', 'MR updated. ClickUp task moved to Peer review.');
    });
  };

  const approve = () => {
    setProposal('approved');
    setTaskStatus('t1', 'Delivered');
    notify('ClickUp updated', '"Finish payment form validation" moved to Delivered.');
  };

  const pollGitLab = () => {
    const mr = 151 + reviews;
    setReviews((n) => n + 1);
    notify('Review assigned', `MR !${mr} is waiting on your review.`);
  };

  const reset = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setSessions(initialSessions);
    setTasks(initialTasks);
    setActiveId('s1');
    setTab('work');
    setProposal('pending');
    setNudge('idle');
    setReviews(0);
    setToasts([]);
  };

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0];

  return (
    <figure className="csd" aria-label="Interactive mock of Claude Sessions">
      <div className="csd-window">
        <div className="csd-bar">
          <span className="csd-app">Claude Sessions</span>
          <div className="csd-tabs" role="tablist" aria-label="View">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'sessions'}
              className="csd-tab"
              onClick={() => setTab('sessions')}
            >
              Sessions
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'work'}
              className="csd-tab"
              onClick={() => setTab('work')}
            >
              Work
            </button>
          </div>
          <button type="button" className="csd-ghost" onClick={pollGitLab}>
            Simulate GitLab poll
          </button>
        </div>

        <div className="csd-body">
          <nav className="csd-side" aria-label="Sessions">
            <span className="csd-label">Sessions</span>
            {sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                className="csd-session"
                aria-current={tab === 'sessions' && s.id === active.id ? 'true' : undefined}
                onClick={() => openSession(s.id)}
              >
                <span className={`csd-dot csd-dot-${s.status}`} aria-hidden="true" />
                <span className="csd-session-name">{s.name}</span>
                <span className="csd-sr">({statusLabel[s.status]})</span>
              </button>
            ))}
          </nav>

          <div className="csd-main">
            {tab === 'work' ? (
              <div className="csd-work">
                <span className="csd-label">Today's priorities</span>
                <div className="csd-tasks">
                  {tasks.map((t, i) => (
                    <div key={t.id} className="csd-task">
                      <span className="csd-num">{i + 1}</span>
                      <div className="csd-task-text">
                        <span className="csd-task-title">{t.title}</span>
                        <span className={`csd-chip csd-chip-${t.status.replace(' ', '-').toLowerCase()}`}>
                          {t.status}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="csd-play"
                        onClick={() => play(t)}
                        aria-label={t.sessionId ? `Open session for ${t.title}` : `Start session for ${t.title}`}
                        title={t.sessionId ? 'Open session' : 'Start session'}
                      >
                        {t.sessionId ? (
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M5.5 3.5l7 4.5-7 4.5z" fill="currentColor" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                <span className="csd-label">Advisor</span>
                <div className="csd-card">
                  {proposal === 'pending' && (
                    <>
                      <span className="csd-card-title">Move "Finish payment form validation" to Delivered?</span>
                      <span className="csd-card-reason">Reason: MR !142 was merged and deployed.</span>
                      <div className="csd-actions">
                        <button type="button" className="csd-btn" onClick={() => setProposal('denied')}>
                          Deny
                        </button>
                        <button type="button" className="csd-btn csd-btn-primary" onClick={approve}>
                          Approve
                        </button>
                      </div>
                    </>
                  )}
                  {proposal === 'approved' && <span className="csd-card-done">Approved. The task is Delivered.</span>}
                  {proposal === 'denied' && <span className="csd-card-done">Denied. Nothing changed in ClickUp.</span>}
                </div>

                <div className="csd-card">
                  <span className="csd-card-title">MR !120 has had no approvals for 9 days.</span>
                  {nudge === 'idle' ? (
                    <div className="csd-actions">
                      <button type="button" className="csd-btn" onClick={() => setNudge('drafted')}>
                        Draft a nudge
                      </button>
                    </div>
                  ) : (
                    <span className="csd-quote">
                      "Hey, could you take a look at MR !120 when you get a chance? It's been open a while."
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="csd-chat">
                <div className="csd-chat-head">
                  <span className="csd-chat-title">{active.name}</span>
                  <span className={`csd-status csd-status-${active.status}`}>{statusLabel[active.status]}</span>
                </div>
                <div className="csd-log">
                  {active.log.map((m, i) => (
                    <div key={i} className={`csd-msg csd-msg-${m.who}`}>
                      {m.text}
                    </div>
                  ))}
                  {active.question && (
                    <div className="csd-msg csd-msg-claude csd-msg-ask">
                      {active.question.prompt}
                      <div className="csd-actions">
                        <button type="button" className="csd-btn csd-btn-primary" onClick={() => answer(active)}>
                          {active.question.answer}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="csd-toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="csd-toast">
              <span className="csd-toast-title">{t.title}</span>
              <span className="csd-toast-body">{t.body}</span>
            </div>
          ))}
        </div>
      </div>
      <figcaption className="csd-caption">
        <span>A simplified mock of Claude Sessions. Press play on a priority, approve the advisor, or simulate a GitLab poll.</span>
        <button type="button" className="csd-reset" onClick={reset}>
          Reset
        </button>
      </figcaption>
    </figure>
  );
}
