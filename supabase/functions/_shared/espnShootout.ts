export type ShootoutScore = { home: number; away: number };

type ScoreboardShootoutSource = {
  homeWinner?: boolean | null;
  awayWinner?: boolean | null;
  notes?: unknown[];
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function textValue(value: unknown) {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9+.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getNoteText(note: unknown) {
  if (typeof note === 'string') return note;
  if (!isRecord(note)) return null;
  return textValue(note.text ?? note.headline ?? note.displayValue ?? note.note);
}

export function getSummaryShootoutScore(summary: unknown): ShootoutScore | null {
  if (!isRecord(summary)) return null;
  const boxscore = isRecord(summary.boxscore) ? summary.boxscore : undefined;
  const form = toArray(boxscore?.form);

  for (const section of form) {
    if (!isRecord(section)) continue;
    for (const event of toArray(section.events)) {
      if (!isRecord(event)) continue;
      const home = numberValue(event.homeShootoutScore);
      const away = numberValue(event.awayShootoutScore);
      if (home !== null && away !== null && (home > 0 || away > 0)) return { home, away };
    }
  }

  return null;
}

export function getScoreboardNoteShootoutScore(source: ScoreboardShootoutSource): ShootoutScore | null {
  for (const note of source.notes ?? []) {
    const text = getNoteText(note);
    const match = text?.match(/\b(\d+)\s*-\s*(\d+)\s+on\s+(?:penalties|penalty kicks|pens)\b/i);
    if (!match) continue;

    const winnerScore = Number(match[1]);
    const loserScore = Number(match[2]);
    if (!Number.isFinite(winnerScore) || !Number.isFinite(loserScore) || winnerScore === loserScore) continue;
    if (source.homeWinner === true) return { home: winnerScore, away: loserScore };
    if (source.awayWinner === true) return { home: loserScore, away: winnerScore };
  }

  return null;
}

export function getShootoutScore(summary: unknown, fallback?: ShootoutScore | null) {
  return getSummaryShootoutScore(summary) ?? fallback ?? null;
}
