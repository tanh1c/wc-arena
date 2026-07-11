import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { ThemeControls } from '../App';
import SquadPitchBuilder from '../components/squad/SquadPitchBuilder';
import AppShell from '../components/layout/AppShell';
import { useAuth } from '../lib/auth';
import { formationKeys, pruneAssignmentsForOwnedCards, type FormationKey, type SquadAssignments, validateMatchLabSquad } from '../lib/squadBuilder';
import { listCurrentUserOwnedCards, type OwnedPlayerCard } from '../services/cards';
import { listMatchLabBots, runMatchLab, type MatchLabBot, type MatchLabRun } from '../services/matchLab';
import { listSavedSquadFormations, type SavedSquadFormation } from '../services/savedSquadFormations';

type Props = { themeControls: ThemeControls };
const botNames: Record<string, string> = { starter: 'Starter', 'pressing-academy': 'Pressing Academy', 'defensive-wall': 'Defensive Wall' };

export default function MatchLab({ themeControls }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [formation, setFormation] = useState<FormationKey>('4-3-3');
  const [cards, setCards] = useState<OwnedPlayerCard[]>([]);
  const [assignments, setAssignments] = useState<SquadAssignments>({});
  const [savedFormations, setSavedFormations] = useState<SavedSquadFormation[]>([]);
  const [bots, setBots] = useState<MatchLabBot[]>([]);
  const [botId, setBotId] = useState('');
  const [debug, setDebug] = useState(false);
  const [result, setResult] = useState<MatchLabRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([listCurrentUserOwnedCards(), listSavedSquadFormations(), listMatchLabBots()])
      .then(([owned, saved, nextBots]) => { setCards(owned); setSavedFormations(saved); setBots(nextBots); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load Match Lab.'));
  }, [user]);

  const validation = useMemo(() => validateMatchLabSquad(formation, assignments, cards), [formation, assignments, cards]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  function importSavedFormation(id: string) {
    const saved = savedFormations.find((item) => item.id === id);
    if (!saved) return;
    setFormation(saved.formation);
    setAssignments(pruneAssignmentsForOwnedCards(saved.formation, saved.assignments, cards));
  }

  async function start() {
    if (!validation.valid || !botId || running) return;
    setRunning(true);
    setError(null);
    try { setResult(await runMatchLab(formation, botId, assignments, debug)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Match Lab failed.'); }
    finally { setRunning(false); }
  }

  return <AppShell themeControls={themeControls}>
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <header className="border-4 border-main bg-card p-5 shadow-[6px_6px_0_var(--color-shadow)]"><p className="text-xs font-black uppercase text-c2">Experimental</p><h1 className="text-4xl font-black uppercase">Match Lab</h1><p className="mt-2 font-bold">Experimental match simulation. Results and balance are still being tuned. AI agents can produce experimental behavior and occasional errors.</p></header>
      <section className="border-4 border-main bg-card p-4"><label className="block text-xs font-black uppercase">Import saved squad<select className="mt-2 block w-full border-2 border-main bg-page p-2 font-bold" defaultValue="" onChange={(event) => importSavedFormation(event.target.value)}><option value="">Choose saved formation</option>{savedFormations.map((saved) => <option key={saved.id} value={saved.id}>{saved.name} · {saved.formation}</option>)}</select></label><p className="mt-2 text-xs font-bold uppercase text-subtle">Formations: {formationKeys.join(' · ')}</p></section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div><h2 className="mb-2 text-xl font-black uppercase">1. Build your XI</h2><SquadPitchBuilder formation={formation} assignments={assignments} ownedCards={cards} onFormationChange={setFormation} onAssignmentsChange={setAssignments} />{!validation.valid && <p className="mt-3 border-2 border-main bg-c5 p-3 font-bold text-main">{validation.reason}</p>}</div>
        <div className="h-fit border-4 border-main bg-card p-4"><h2 className="text-xl font-black uppercase">2. Choose a bot</h2><div className="mt-3 space-y-2">{bots.map((bot) => <button type="button" key={bot.id} onClick={() => setBotId(bot.id)} className={`block w-full border-2 border-main p-3 text-left font-bold ${botId === bot.id ? 'bg-c2 text-inv' : 'bg-page'}`}><span className="block text-lg">{botNames[bot.id]}</span><span>{bot.formation} · {bot.ovr_band} · {bot.identity}</span></button>)}</div>{botId && <p className="mt-3 font-bold">Bot XI is revealed and ready for matchup inspection.</p>}<label className="mt-4 flex gap-2 font-bold"><input type="checkbox" checked={debug} onChange={(event) => setDebug(event.target.checked)} /> Debug</label><button type="button" disabled={!validation.valid || !botId || running} onClick={start} className="mt-4 border-2 border-main bg-c1 px-4 py-2 font-black uppercase disabled:opacity-40">{running ? 'Simulating…' : 'Start experimental simulation'}</button>{error && <p className="mt-3 font-bold text-c2">{error}</p>}</div>
      </section>
      {result && <section className="border-4 border-main bg-card p-4"><h2 className="text-2xl font-black uppercase">Final score: You {result.score.home}–{result.score.away} {botNames[result.bot_id]}</h2><ol className="mt-3 space-y-2">{result.timeline.map((event, index) => <li key={`${event.minute}-${index}`} className="border-l-4 border-c2 pl-3 font-bold">{event.minute}' {event.type.toUpperCase()} · {event.side}</li>)}</ol>{debug && result.debug && <pre className="mt-4 overflow-auto border-2 border-main bg-page p-3 text-xs">{JSON.stringify(result.debug, null, 2)}</pre>}</section>}
    </main>
  </AppShell>;
}
