import { useEffect, useState } from 'react';
import { Shield, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ThemeControls } from '../App';
import SquadPitchBuilder from '../components/squad/SquadPitchBuilder';
import { pruneAssignmentsForOwnedCards, type FormationKey, type SquadAssignments } from '../lib/squadBuilder';
import { listCurrentUserOwnedCards, type OwnedPlayerCard } from '../services/cards';
import { getErrorMessage } from '../services/serviceTypes';
import { createSavedSquadFormation, deleteSavedSquadFormation, listSavedSquadFormations, updateSavedSquadFormation, type SavedSquadFormation } from '../services/savedSquadFormations';
import AppShell from '../components/layout/AppShell';

type SquadBuilderProps = { themeControls: ThemeControls };

export default function SquadBuilder({ themeControls }: SquadBuilderProps) {
  const { t } = useTranslation();
  const [ownedCards, setOwnedCards] = useState<OwnedPlayerCard[]>([]);
  const [savedFormations, setSavedFormations] = useState<SavedSquadFormation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formation, setFormation] = useState<FormationKey>('4-3-3');
  const [assignments, setAssignments] = useState<SquadAssignments>({});
  const [savedFormationId, setSavedFormationId] = useState('');
  const [savedFormationName, setSavedFormationName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([listCurrentUserOwnedCards(), listSavedSquadFormations()])
      .then(([cards, saved]) => {
        if (!active) return;
        setOwnedCards(cards);
        setSavedFormations(saved);
      })
      .catch((cause) => active && setError(getErrorMessage(cause)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  function loadSavedFormation(id: string) {
    setSavedFormationId(id);
    const saved = savedFormations.find((item) => item.id === id);
    if (!saved) return;
    setSavedFormationName(saved.name);
    setFormation(saved.formation);
    setAssignments(pruneAssignmentsForOwnedCards(saved.formation, saved.assignments, ownedCards));
  }

  async function saveSavedFormation(update = false) {
    const name = savedFormationName.trim();
    if (!name || saving) return;
    setSaving(true);
    setError(null);
    try {
      const input = { name, formation, assignments };
      const saved = update && savedFormationId
        ? await updateSavedSquadFormation(savedFormationId, input)
        : await createSavedSquadFormation(input);
      setSavedFormations((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setSavedFormationId(saved.id);
      setSavedFormationName(saved.name);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function removeSavedFormation() {
    if (!savedFormationId || saving) return;
    setSaving(true);
    setError(null);
    try {
      await deleteSavedSquadFormation(savedFormationId);
      setSavedFormations((current) => current.filter((item) => item.id !== savedFormationId));
      setSavedFormationId('');
      setSavedFormationName('');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return <AppShell themeControls={themeControls}>
    <div className="relative z-10 flex min-h-0 flex-col gap-3 p-3 sm:p-4 lg:gap-6 lg:p-6">
      <section className="flex w-full flex-col gap-3 border-4 border-main bg-card p-3 shadow-[6px_6px_0_0_var(--color-shadow)] sm:p-4 lg:p-6 lg:shadow-[8px_8px_0_0_var(--color-shadow)] xl:w-1/2">
        <div className="inline-flex w-fit items-center gap-2 border-2 border-main bg-c3 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-main shadow-[2px_2px_0_var(--color-shadow)]"><Shield size={14} strokeWidth={3} /> {t('appPages.squadBuilder.kicker')}</div>
        <h1 className="text-3xl font-black uppercase leading-none tracking-tighter text-main sm:text-4xl lg:text-5xl">{t('appPages.squadBuilder.title')}</h1>
        <p className="max-w-3xl text-sm font-bold text-subtle sm:text-base">{t('appPages.squadBuilder.description')}</p>
      </section>
      <section className="border-4 border-main bg-card p-3 shadow-[6px_6px_0_var(--color-shadow)]">
        <div className="flex flex-col gap-2 sm:flex-row"><select value={savedFormationId} onChange={(event) => loadSavedFormation(event.target.value)} className="min-w-0 flex-1 border-2 border-main bg-page px-3 py-2 text-xs font-black uppercase"><option value="">Import saved formation</option>{savedFormations.map((saved) => <option key={saved.id} value={saved.id}>{saved.name} · {saved.formation}</option>)}</select><input value={savedFormationName} onChange={(event) => setSavedFormationName(event.target.value)} maxLength={60} placeholder="Formation name" className="min-w-0 flex-1 border-2 border-main bg-page px-3 py-2 text-xs font-black uppercase" /><button type="button" disabled={!savedFormationName.trim() || saving} onClick={() => saveSavedFormation(false)} className="border-2 border-main bg-c1 px-3 py-2 text-xs font-black uppercase disabled:opacity-40">Save new</button>{savedFormationId && <><button type="button" disabled={!savedFormationName.trim() || saving} onClick={() => saveSavedFormation(true)} className="border-2 border-main bg-c2 px-3 py-2 text-xs font-black uppercase text-inv disabled:opacity-40">Update</button><button type="button" disabled={saving} onClick={removeSavedFormation} className="inline-flex items-center justify-center border-2 border-main bg-c5 px-3 py-2 text-main disabled:opacity-40" aria-label="Delete saved formation"><Trash2 size={16} strokeWidth={3} /></button></>}</div>
        {error && <p className="mt-2 text-sm font-black uppercase text-c2">{error}</p>}
      </section>
      <SquadPitchBuilder formation={formation} assignments={assignments} ownedCards={ownedCards} loading={loading} error={error} onFormationChange={setFormation} onAssignmentsChange={setAssignments} />
    </div>
  </AppShell>;
}
