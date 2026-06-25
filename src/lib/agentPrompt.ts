type MatchPromptMatch = {
  home_team_id: string;
  away_team_id: string;
};

type MatchPromptTeam = {
  short_name?: string | null;
};

export function getAgentMatchSelectionPrompt(match: MatchPromptMatch, teams: Map<string, MatchPromptTeam>) {
  const home = teams.get(match.home_team_id)?.short_name ?? match.home_team_id;
  const away = teams.get(match.away_team_id)?.short_name ?? match.away_team_id;
  return `${home} vs ${away}`;
}

export function appendAgentPromptText(currentInput: string, suggestionText: string) {
  const current = currentInput.trimEnd();
  const suggestion = suggestionText.trim();

  if (!current) return suggestion;
  if (!suggestion) return current;

  return `${current} ${suggestion}`;
}
