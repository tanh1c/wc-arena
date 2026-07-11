import { supabase } from '../lib/supabaseClient';
import type { FormationKey, SquadAssignments } from '../lib/squadBuilder';

export type SavedSquadFormation = {
  id: string;
  name: string;
  formation: FormationKey;
  assignments: SquadAssignments;
  created_at: string;
  updated_at: string;
};

type SavedSquadFormationInput = Pick<SavedSquadFormation, 'name' | 'formation' | 'assignments'>;

async function currentUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('Sign in to save a squad.');
  return user.id;
}

export async function listSavedSquadFormations() {
  const { data, error } = await supabase
    .from('saved_squad_formations')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedSquadFormation[];
}

export async function createSavedSquadFormation(input: SavedSquadFormationInput) {
  const user_id = await currentUserId();
  const { data, error } = await supabase
    .from('saved_squad_formations')
    .insert({ ...input, name: input.name.trim(), user_id, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as SavedSquadFormation;
}

export async function updateSavedSquadFormation(id: string, input: SavedSquadFormationInput) {
  const { data, error } = await supabase
    .from('saved_squad_formations')
    .update({ ...input, name: input.name.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as SavedSquadFormation;
}

export async function deleteSavedSquadFormation(id: string) {
  const { error } = await supabase.from('saved_squad_formations').delete().eq('id', id);
  if (error) throw error;
}
