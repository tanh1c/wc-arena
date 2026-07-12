import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { ThemeControls } from '../App';
import SquadPitchBuilder from '../components/squad/SquadPitchBuilder';
import AppShell from '../components/layout/AppShell';
import { useAuth } from '../lib/auth';
import { getFormationSlots, matchLabFormationKeys, pruneAssignmentsForOwnedCards, type FormationKey, type SquadAssignments, validateMatchLabSquad } from '../lib/squadBuilder';
import { listCurrentUserOwnedCards, type OwnedPlayerCard } from '../services/cards';
import { abandonMatchLabRun, getMatchLabBotXi, listMatchLabBots, listMatchLabRuns, resumeMatchLabRun, runMatchLab, submitMatchLabFeedback, type MatchLabBot, type MatchLabBotXiPreview, type MatchLabRun } from '../services/matchLab';
import { listSavedSquadFormations, type SavedSquadFormation } from '../services/savedSquadFormations';

type Props = { themeControls: ThemeControls };
type Ratings = { fun_rating: number; clarity_rating: number; fairness_rating: number; feedback_text: string };
const botNames: Record<string, string> = { starter: 'Starter', 'pressing-academy': 'Pressing Academy', 'defensive-wall': 'Defensive Wall' };
const emptyRatings: Ratings = { fun_rating: 0, clarity_rating: 0, fairness_rating: 0, feedback_text: '' };

export default function MatchLab({ themeControls }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [formation, setFormation] = useState<FormationKey>('4-3-3');
  const [cards, setCards] = useState<OwnedPlayerCard[]>([]);
  const [assignments, setAssignments] = useState<SquadAssignments>({});
  const [savedFormations, setSavedFormations] = useState<SavedSquadFormation[]>([]);
  const [bots, setBots] = useState<MatchLabBot[]>([]);
  const [history, setHistory] = useState<MatchLabRun[]>([]);
  const [botId, setBotId] = useState('');
  const [botPreview, setBotPreview] = useState<MatchLabBotXiPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [debug, setDebug] = useState(false);
  const [result, setResult] = useState<MatchLabRun | null>(null);
  const [ratings, setRatings] = useState<Ratings>(emptyRatings);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [expandedHotspot, setExpandedHotspot] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([listCurrentUserOwnedCards(), listSavedSquadFormations(), listMatchLabBots(), listMatchLabRuns()])
      .then(([owned, saved, nextBots, runs]) => { setCards(owned); setSavedFormations(saved); setBots(nextBots); setHistory(runs); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load Match Lab.'));
  }, [user]);

  useEffect(() => {
    if (!botId) return setBotPreview(null);
    let cancelled = false;
    setBotPreview(null);
    setPreviewLoading(true);
    getMatchLabBotXi(botId as MatchLabBot['id'])
      .then((preview) => { if (!cancelled) setBotPreview(preview); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load bot XI.'); })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [botId]);

  const validation = useMemo(() => validateMatchLabSquad(formation, assignments, cards), [formation, assignments, cards]);
  const matchLabSavedFormations = savedFormations.filter((saved) => matchLabFormationKeys.includes(saved.formation));
  const botPreviewBySlot = useMemo(() => new Map((botPreview?.xi ?? []).map((card) => [card.slot_id, card])), [botPreview]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  function importSavedFormation(id: string) {
    const saved = matchLabSavedFormations.find((item) => item.id === id);
    if (!saved) return;
    setFormation(saved.formation);
    setAssignments(pruneAssignmentsForOwnedCards(saved.formation, saved.assignments, cards));
  }

  function remember(run: MatchLabRun) {
    setResult(run);
    setHistory((current) => [run, ...current.filter((item) => item.id !== run.id)]);
    setRatings({ fun_rating: run.fun_rating ?? 0, clarity_rating: run.clarity_rating ?? 0, fairness_rating: run.fairness_rating ?? 0, feedback_text: run.feedback_text ?? '' });
  }

  async function start() {
    if (!validation.valid || !botId || running) return;
    setRunning(true);
    setError(null);
    try { remember(await runMatchLab(formation, botId, assignments, debug)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Match Lab failed.'); }
    finally { setRunning(false); }
  }

  async function resume(run: MatchLabRun) {
    setRunning(true);
    setError(null);
    try { remember(await resumeMatchLabRun(run.id, debug)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not resume Match Lab.'); }
    finally { setRunning(false); }
  }

  async function abandon(run: MatchLabRun) {
    setRunning(true);
    setError(null);
    try { remember({ ...run, ...(await abandonMatchLabRun(run.id)) }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not abandon Match Lab.'); }
    finally { setRunning(false); }
  }

  async function saveFeedback() {
    if (!result || result.status !== 'completed' || !ratings.fun_rating || !ratings.clarity_rating || !ratings.fairness_rating) return;
    setRunning(true);
    setError(null);
    try {
      await submitMatchLabFeedback(result.id, ratings);
      remember({ ...result, ...ratings });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save feedback.'); }
    finally { setRunning(false); }
  }

  return <AppShell themeControls={themeControls}>
    <div className="relative z-10 flex min-h-0 flex-col gap-3 p-3 sm:p-4 lg:gap-6 lg:p-6">
      <header className="border-4 border-main bg-card p-5 shadow-[6px_6px_0_var(--color-shadow)]"><p className="text-xs font-black uppercase text-c2">Experimental</p><h1 className="text-4xl font-black uppercase">Match Lab</h1><p className="mt-2 font-bold">Experimental match simulation. Results and balance are still being tuned. AI agents can produce experimental behavior and occasional errors.</p></header>
      <section className="border-4 border-main bg-card p-4"><label className="block text-xs font-black uppercase">Import saved squad<select className="mt-2 block w-full border-2 border-main bg-page p-2 font-bold" defaultValue="" onChange={(event) => importSavedFormation(event.target.value)}><option value="">Choose saved formation</option>{matchLabSavedFormations.map((saved) => <option key={saved.id} value={saved.id}>{saved.name} · {saved.formation}</option>)}</select></label><p className="mt-2 text-xs font-bold uppercase text-subtle">Formations: {matchLabFormationKeys.join(' · ')}</p></section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div><h2 className="mb-2 text-xl font-black uppercase">1. Build your XI</h2><SquadPitchBuilder formation={formation} assignments={assignments} ownedCards={cards} availableFormations={matchLabFormationKeys} onFormationChange={setFormation} onAssignmentsChange={setAssignments} />{!validation.valid && <p className="mt-3 border-2 border-main bg-c5 p-3 font-bold text-main">{validation.reason}</p>}</div>
        <div className="h-fit border-4 border-main bg-card p-4"><h2 className="text-xl font-black uppercase">2. Choose a bot</h2><div className="mt-3 space-y-2">{bots.map((bot) => <button type="button" key={bot.id} onClick={() => { setError(null); setBotId(bot.id); }} className={`block w-full border-2 border-main p-3 text-left font-bold ${botId === bot.id ? 'bg-c2 text-inv' : 'bg-page'}`}><span className="block text-lg">{botNames[bot.id]}</span><span>{bot.formation} · {bot.ovr_band} · {bot.identity}</span></button>)}</div>{previewLoading && <p className="mt-3 font-bold">Loading bot XI…</p>}{botPreview && <section className="mt-3 border-2 border-main bg-page p-2"><h3 className="font-black uppercase">{botNames[botPreview.bot.id]} XI · {botPreview.bot.formation}</h3><ol className="mt-2 grid gap-2 sm:grid-cols-2">{getFormationSlots(botPreview.bot.formation).map((slot) => { const card = botPreviewBySlot.get(slot.id); return <li key={slot.id} className="flex min-w-0 items-center gap-2 border-2 border-main bg-card p-2">{card?.image_url && <img src={card.image_url} alt={card.name ?? slot.label} className="h-10 w-8 object-contain" />}<span className="min-w-0"><span className="block text-xs font-black uppercase text-c2">{slot.label}</span><span className="block truncate font-bold">{card?.name ?? 'Unavailable'}</span><span className="block text-xs font-bold text-subtle">{card?.position ?? slot.label} · {card?.rarity ?? ''}</span></span></li>; })}</ol></section>}<label className="mt-4 flex gap-2 font-bold"><input type="checkbox" checked={debug} onChange={(event) => setDebug(event.target.checked)} /> Debug</label><button type="button" disabled={!validation.valid || !botPreview || running} onClick={start} className="mt-4 border-2 border-main bg-c1 px-4 py-2 font-black uppercase disabled:opacity-40">{running ? 'Simulating…' : 'Start experimental simulation'}</button>{error && <p className="mt-3 font-bold text-c2">{error}</p>}</div>
      </section>
      {result && <section className="border-4 border-main bg-card p-4"><h2 className="text-2xl font-black uppercase">{result.status === 'paused' ? `Paused at hot spot ${result.hotspot_index + 1}` : `Final score: You ${result.score.home}–${result.score.away} ${botNames[result.bot_id]}`}</h2>{result.status === 'paused' && <div className="mt-3 flex gap-2"><button type="button" disabled={running} onClick={() => resume(result)} className="border-2 border-main bg-c1 px-3 py-2 font-black uppercase">Retry / resume</button><button type="button" disabled={running} onClick={() => abandon(result)} className="border-2 border-main bg-c5 px-3 py-2 font-black uppercase">Abandon</button></div>}<ol className="mt-3 space-y-2">{result.timeline.map((event, index) => <li key={`${event.minute}-${index}`} className="border-l-4 border-c2 pl-3 font-bold">{event.minute}' {event.summary ?? event.type.toUpperCase()} · {event.side}</li>)}</ol>{result.debug && <section className="mt-4 border-2 border-main bg-page p-3"><h3 className="font-black uppercase">Debug · {result.debug.hotspots} hot spots</h3><p className="mt-1 text-xs font-bold">Sources: {Object.entries(result.debug.action_sources).map(([source, count]) => `${source} ${count}`).join(' · ')}</p><div className="mt-3 space-y-2">{result.debug.hotspot_summaries.map((summary, index) => <div key={`${summary.minute}-${index}`} className="border-2 border-main"><button type="button" className="flex w-full items-center justify-between gap-3 p-2 text-left font-bold" aria-expanded={expandedHotspot === index} onClick={() => setExpandedHotspot(expandedHotspot === index ? null : index)}><span>{summary.minute}' · {summary.side} · {summary.action.source}</span><span>{summary.outcome.type.toUpperCase()}</span></button>{expandedHotspot === index && <div className="border-t-2 border-main p-2 text-xs font-bold"><p>Intent: {summary.coach_intent}</p><p>Carrier: {summary.local_actors.carrier} · Support: {summary.local_actors.support.join(', ') || 'none'} · Opponents: {summary.local_actors.opponents.join(', ') || 'none'}</p><p>Action: {summary.action.type} → {summary.action.target_slot || 'none'} · risk {summary.action.risk}</p><p>Score: You {summary.outcome.score.home}–{summary.outcome.score.away} · {summary.latency_ms}ms</p></div>}</div>)}</div></section>}{result.status === 'completed' && <section className="mt-4 border-2 border-main bg-page p-3"><h3 className="font-black uppercase">Rate this match</h3><div className="mt-2 grid gap-2 sm:grid-cols-3">{([['fun_rating', 'Fun'], ['clarity_rating', 'Clarity'], ['fairness_rating', 'Fairness']] as const).map(([key, label]) => <label key={key} className="text-xs font-black uppercase">{label}<select className="mt-1 block w-full border-2 border-main bg-card p-2" value={ratings[key]} onChange={(event) => setRatings({ ...ratings, [key]: Number(event.target.value) })}><option value={0}>Rate 1–5</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>)}</div><textarea className="mt-2 w-full border-2 border-main bg-card p-2 text-sm" maxLength={1000} placeholder="Optional feedback" value={ratings.feedback_text} onChange={(event) => setRatings({ ...ratings, feedback_text: event.target.value })} /><button type="button" disabled={running || !ratings.fun_rating || !ratings.clarity_rating || !ratings.fairness_rating} onClick={saveFeedback} className="mt-2 border-2 border-main bg-c1 px-3 py-2 font-black uppercase disabled:opacity-40">Save feedback</button></section>}</section>}
      <section className="border-4 border-main bg-card p-4"><h2 className="text-xl font-black uppercase">Personal report history</h2>{history.length ? <ol className="mt-3 space-y-2">{history.map((run) => <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 border-2 border-main bg-page p-3 font-bold"><span>{botNames[run.bot_id]} · {run.status} · You {run.score.home}–{run.score.away}</span>{run.status === 'paused' && <span className="flex gap-2"><button type="button" disabled={running} onClick={() => resume(run)} className="border-2 border-main bg-c1 px-2 py-1 text-xs uppercase">Retry / resume</button><button type="button" disabled={running} onClick={() => abandon(run)} className="border-2 border-main bg-c5 px-2 py-1 text-xs uppercase">Abandon</button></span>}</li>)}</ol> : <p className="mt-2 font-bold text-subtle">No reports yet.</p>}</section>
    </div>
  </AppShell>;
}
