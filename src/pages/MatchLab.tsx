import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { useAuth } from '../lib/auth';
import { assignCardToSlot, getFormationSlots, type FormationKey, validateMatchLabSquad } from '../lib/squadBuilder';
import { listCurrentUserOwnedCards, type OwnedPlayerCard } from '../services/cards';
import { listMatchLabBots, runMatchLab, type MatchLabBot, type MatchLabRun } from '../services/matchLab';
import type { ThemeControls } from '../App';

type Props = { themeControls: ThemeControls };
const formations: FormationKey[] = ['4-3-3', '4-2-3-1', '3-5-2'];
const botNames: Record<string, string> = { starter: 'Starter', 'pressing-academy': 'Pressing Academy', 'defensive-wall': 'Defensive Wall' };

export default function MatchLab({ themeControls }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [formation, setFormation] = useState<FormationKey>('4-3-3');
  const [cards, setCards] = useState<OwnedPlayerCard[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [bots, setBots] = useState<MatchLabBot[]>([]);
  const [botId, setBotId] = useState<string>('');
  const [debug, setDebug] = useState(false);
  const [result, setResult] = useState<MatchLabRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([listCurrentUserOwnedCards(), listMatchLabBots()]).then(([owned, nextBots]) => {
      setCards(owned);
      setBots(nextBots);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load Match Lab.'));
  }, [user]);

  const slots = getFormationSlots(formation);
  const validation = useMemo(() => validateMatchLabSquad(formation, assignments, cards), [formation, assignments, cards]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  async function start() {
    if (!validation.valid || !botId || running) return;
    setRunning(true);
    setError(null);
    try {
      setResult(await runMatchLab(formation, botId, assignments, debug));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Match Lab failed.');
    } finally {
      setRunning(false);
    }
  }

  return <AppShell themeControls={themeControls}>
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <header className="border-4 border-main bg-card p-5 shadow-[6px_6px_0_var(--color-shadow)]">
        <p className="text-xs font-black uppercase text-c2">Experimental</p>
        <h1 className="text-4xl font-black uppercase">Match Lab</h1>
        <p className="mt-2 font-bold">Experimental match simulation. Results and balance are still being tuned. AI agents can produce experimental behavior and occasional errors.</p>
      </header>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="border-4 border-main bg-card p-4">
          <h2 className="text-xl font-black uppercase">1. Build your XI</h2>
          <select className="mt-3 border-2 border-main bg-page p-2 font-bold" value={formation} onChange={(event) => { setFormation(event.target.value as FormationKey); setAssignments({}); }}>
            {formations.map((item) => <option key={item}>{item}</option>)}
          </select>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {slots.map((slot) => <label key={slot.id} className="border-2 border-main p-2 text-sm font-bold">
              {slot.label}
              <select className="mt-1 w-full bg-page p-1" value={assignments[slot.id] ?? ''} onChange={(event) => setAssignments(assignCardToSlot(assignments, slot.id, event.target.value))}>
                <option value="">Choose card</option>
                {cards.filter((card) => !Object.values(assignments).includes(card.id) || assignments[slot.id] === card.id).map((card) => <option key={card.id} value={card.id}>{card.player_cards.name} · {card.player_cards.position}</option>)}
              </select>
            </label>)}
          </div>
          {!validation.valid && <p className="mt-3 font-bold text-c2">{validation.reason}</p>}
        </div>
        <div className="border-4 border-main bg-card p-4">
          <h2 className="text-xl font-black uppercase">2. Choose a bot</h2>
          <div className="mt-3 space-y-2">{bots.map((bot) => <button type="button" key={bot.id} onClick={() => setBotId(bot.id)} className={`block w-full border-2 border-main p-3 text-left font-bold ${botId === bot.id ? 'bg-c2 text-inv' : 'bg-page'}`}>
            <span className="block text-lg">{botNames[bot.id]}</span><span>{bot.formation} · {bot.ovr_band} · {bot.identity}</span>
          </button>)}</div>
          {botId && <p className="mt-3 font-bold">Bot XI is revealed and ready for matchup inspection.</p>}
          <label className="mt-4 flex gap-2 font-bold"><input type="checkbox" checked={debug} onChange={(event) => setDebug(event.target.checked)} /> Debug</label>
          <button type="button" disabled={!validation.valid || !botId || running} onClick={start} className="mt-4 border-2 border-main bg-c1 px-4 py-2 font-black uppercase disabled:opacity-40">{running ? 'Simulating…' : 'Start experimental simulation'}</button>
          {error && <p className="mt-3 font-bold text-c2">{error}</p>}
        </div>
      </section>
      {result && <section className="border-4 border-main bg-card p-4">
        <h2 className="text-2xl font-black uppercase">Final score: You {result.score.home}–{result.score.away} {botNames[result.bot_id]}</h2>
        <ol className="mt-3 space-y-2">{result.timeline.map((event, index) => <li key={`${event.minute}-${index}`} className="border-l-4 border-c2 pl-3 font-bold">{event.minute}' {event.type.toUpperCase()} · {event.side}</li>)}</ol>
        {debug && result.debug && <pre className="mt-4 overflow-auto border-2 border-main bg-page p-3 text-xs">{JSON.stringify(result.debug, null, 2)}</pre>}
      </section>}
    </main>
  </AppShell>;
}
