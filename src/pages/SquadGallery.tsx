import { useEffect, useMemo, useState } from 'react';
import { Camera, Search, Shield, Shirt, Users } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { getErrorMessage } from '../services/serviceTypes';
import { listTournamentSquads, type TeamSquad, type TournamentSquadPlayer } from '../services/players';
import { getTeamFlag } from '../utils/teamFlags';
import type { ThemeControls } from '../App';

type SquadGalleryProps = {
  themeControls: ThemeControls;
};

function TeamFlag({ squad }: { squad: TeamSquad }) {
  const Flag = getTeamFlag(squad.team.country_code, squad.team.short_name);
  if (!Flag) return <span className="font-black text-xs">{squad.team.short_name.slice(0, 2)}</span>;
  return <Flag className="w-full h-full object-cover" title={squad.team.name} />;
}

function PlayerCard({ row }: { row: TournamentSquadPlayer }) {
  return (
    <article className="border-4 border-main bg-card shadow-[4px_4px_0_var(--color-shadow)] min-w-0">
      <div className="relative aspect-square border-b-4 border-main bg-muted overflow-hidden">
        {row.player.image_url ? (
          <img src={row.player.image_url} alt={row.player.display_name} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-c1 text-main"><Camera size={42} strokeWidth={2.5} /></div>
        )}
        <div className="absolute left-2 top-2 bg-main text-inv border-2 border-main px-2 py-1 font-black text-xs shadow-[2px_2px_0_var(--color-shadow)]">
          #{row.squad_number ?? '—'}
        </div>
        {row.captain && <div className="absolute right-2 top-2 bg-c3 text-main border-2 border-main px-2 py-1 font-black text-xs shadow-[2px_2px_0_var(--color-shadow)]">CAP</div>}
      </div>
      <div className="p-3 flex flex-col gap-2 min-w-0">
        <div className="font-black uppercase text-sm sm:text-base leading-tight truncate text-main" title={row.player.display_name}>{row.player.display_name}</div>
        <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase">
          <div className="border-2 border-main bg-c1 text-main px-2 py-1">{row.position}</div>
          <div className="border-2 border-main bg-page text-main px-2 py-1 truncate" title={row.club ?? row.player.club ?? '—'}>{row.club ?? row.player.club ?? '—'}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase text-subtle">
          <span>Caps {row.caps ?? 0}</span>
          <span>Goals {row.international_goals ?? 0}</span>
        </div>
      </div>
    </article>
  );
}

export default function SquadGallery({ themeControls }: SquadGalleryProps) {
  const [squads, setSquads] = useState<TeamSquad[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    listTournamentSquads()
      .then((nextSquads) => {
        if (!active) return;
        setSquads(nextSquads);
      })
      .catch((nextError) => {
        if (!active) return;
        setError(getErrorMessage(nextError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const totalPlayers = squads.reduce((total, squad) => total + squad.players.length, 0);
  const playersWithImages = squads.reduce((total, squad) => total + squad.players.filter((row) => row.player.image_url).length, 0);

  const visibleSquads = useMemo(() => {
    const query = search.trim().toLowerCase();
    return squads
      .filter((squad) => selectedTeamId === 'all' || squad.team.id === selectedTeamId)
      .map((squad) => ({
        ...squad,
        players: squad.players.filter((row) => {
          if (!query) return true;
          return `${row.player.display_name} ${row.position} ${row.club ?? ''}`.toLowerCase().includes(query);
        }),
      }))
      .filter((squad) => squad.players.length > 0);
  }, [search, selectedTeamId, squads]);

  return (
    <AppShell themeControls={themeControls}>
      <div className="relative z-10 flex flex-col p-3 sm:p-4 lg:p-6 gap-4 lg:gap-6 min-h-0">
        <section className="bg-card border-4 border-main p-3 sm:p-4 lg:p-6 flex flex-col gap-3 w-full xl:w-2/3 shadow-[6px_6px_0_0_var(--color-shadow)] lg:shadow-[8px_8px_0_0_var(--color-shadow)]">
          <div className="inline-flex w-fit items-center gap-2 border-2 border-main bg-c3 px-3 py-1 font-black uppercase text-[10px] tracking-widest text-main shadow-[2px_2px_0_var(--color-shadow)]">
            <Camera size={14} strokeWidth={3} /> CDN Image Demo
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tighter text-main leading-none">Squad Gallery</h1>
          <p className="font-bold text-sm sm:text-base text-subtle max-w-3xl">
            Demo player catalog seeded from Wikipedia squads and enriched with Guardian CDN image URLs. Images are stored for preview; usage rights still need verification before public/commercial use.
          </p>
        </section>

        <section className="bg-card border-4 border-main shadow-[6px_6px_0_0_var(--color-shadow)] lg:shadow-[8px_8px_0_0_var(--color-shadow)]">
          <div className="grid grid-cols-2 xl:grid-cols-4 border-b-4 border-main">
            <div className="flex items-center gap-3 border-b-4 border-r-4 xl:border-b-0 border-main p-3 sm:p-4 bg-c1 text-main min-w-0">
              <Users size={28} strokeWidth={2.5} className="shrink-0" />
              <div className="min-w-0"><div className="text-[10px] uppercase font-black tracking-widest truncate">Players</div><div className="text-2xl sm:text-3xl font-black leading-none">{totalPlayers}</div></div>
            </div>
            <div className="flex items-center gap-3 border-b-4 xl:border-b-0 xl:border-r-4 border-main p-3 sm:p-4 bg-c2 text-inv min-w-0">
              <Camera size={28} strokeWidth={2.5} className="shrink-0" />
              <div className="min-w-0"><div className="text-[10px] uppercase font-black tracking-widest truncate">Images</div><div className="text-2xl sm:text-3xl font-black leading-none">{playersWithImages}</div></div>
            </div>
            <div className="flex items-center gap-3 border-r-4 xl:border-r-4 border-main p-3 sm:p-4 bg-c3 text-main min-w-0">
              <Shield size={28} strokeWidth={2.5} className="shrink-0" />
              <div className="min-w-0"><div className="text-[10px] uppercase font-black tracking-widest truncate">Teams</div><div className="text-2xl sm:text-3xl font-black leading-none">{squads.length}</div></div>
            </div>
            <div className="flex items-center gap-3 border-main p-3 sm:p-4 bg-c4 text-main min-w-0">
              <Shirt size={28} strokeWidth={2.5} className="shrink-0" />
              <div className="min-w-0"><div className="text-[10px] uppercase font-black tracking-widest truncate">Seed</div><div className="text-xl sm:text-2xl font-black leading-none">WC2026</div></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] min-h-[520px]">
            <aside className="border-b-4 lg:border-b-0 lg:border-r-4 border-main bg-card">
              <div className="bg-main text-inv font-black px-4 py-3 uppercase tracking-wide text-sm border-b-4 border-main">Teams</div>
              <div className="p-3 border-b-4 border-main flex flex-col gap-3">
                <label className="border-2 border-main bg-page flex items-center gap-2 px-3 py-2 shadow-[2px_2px_0_var(--color-shadow)]">
                  <Search size={16} strokeWidth={3} className="shrink-0" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search players" className="w-full bg-transparent outline-none font-black uppercase text-xs placeholder:text-subtle" />
                </label>
                <button type="button" onClick={() => setSelectedTeamId('all')} className={`border-2 border-main px-3 py-2 text-left font-black uppercase text-xs shadow-[2px_2px_0_var(--color-shadow)] ${selectedTeamId === 'all' ? 'bg-c2 text-inv' : 'bg-page text-main hover:bg-muted'}`}>All teams</button>
              </div>
              <div className="max-h-[520px] overflow-y-auto">
                {squads.map((squad) => (
                  <button key={squad.team.id} type="button" onClick={() => setSelectedTeamId(squad.team.id)} className={`w-full grid grid-cols-[32px_1fr_auto] items-center gap-3 p-3 border-b-2 border-line text-left transition-colors ${selectedTeamId === squad.team.id ? 'bg-c2 text-inv' : 'bg-card text-main hover:bg-muted'}`}>
                    <span className="w-8 h-8 border-2 border-main bg-page flex items-center justify-center overflow-hidden"><TeamFlag squad={squad} /></span>
                    <span className="min-w-0"><span className="block font-black uppercase text-xs truncate">{squad.team.name}</span><span className="block font-bold uppercase text-[10px] opacity-70">Group {squad.team.group_code ?? '—'}</span></span>
                    <span className="font-black text-xs">{squad.players.length}</span>
                  </button>
                ))}
              </div>
            </aside>

            <main className="bg-page min-w-0">
              {loading && <div className="p-6 font-black uppercase text-sm">Loading squad gallery...</div>}
              {error && <div className="m-4 p-4 border-4 border-main bg-c5 text-main font-black uppercase text-sm shadow-[4px_4px_0_var(--color-shadow)]">{error}</div>}
              {!loading && !error && visibleSquads.length === 0 && <div className="p-6 font-black uppercase text-sm">No squad players found.</div>}
              {!loading && !error && visibleSquads.map((squad) => (
                <section key={squad.team.id} className="border-b-4 border-main last:border-b-0 bg-card">
                  <div className="bg-main text-inv border-b-4 border-main p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 border-2 border-main bg-page flex items-center justify-center overflow-hidden shrink-0"><TeamFlag squad={squad} /></span>
                      <div className="min-w-0">
                        <h2 className="font-black uppercase text-lg sm:text-2xl leading-none truncate">{squad.team.name}</h2>
                        <div className="font-bold uppercase text-[10px] sm:text-xs text-faint mt-1">Group {squad.team.group_code ?? '—'} · Coach {squad.coachName ?? '—'}</div>
                      </div>
                    </div>
                    <div className="font-black uppercase text-xs text-faint">{squad.players.length} players</div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 p-3 sm:p-4 bg-page">
                    {squad.players.map((row) => <div key={`${squad.team.id}-${row.player.id}`}><PlayerCard row={row} /></div>)}
                  </div>
                </section>
              ))}
            </main>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
