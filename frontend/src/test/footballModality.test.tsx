import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { modalityToSave, sportAllowsModality } from '@/lib/sports/footballModality';
import { buildTeamWritePayload, type TeamFormValues } from '@/lib/coachTeamScope';
import { FootballModalitySelect } from '@/components/teams/FootballModalitySelect';

const form = (over: Partial<TeamFormValues> = {}): TeamFormValues => ({
  name: 'Sub 10', description: '', sport: 'Fútbol', sport_modality: '7', level: '', max_students: 20,
  location: '', price_monthly: 0, coach_ids: [], branch_ids: [], status: 'active', image_url: null, ...over,
});

describe('modalidad de fútbol', () => {
  it('solo el deporte «Fútbol» la admite (no futsal, no americano, no otros)', () => {
    expect(sportAllowsModality('Fútbol')).toBe(true);
    expect(sportAllowsModality('Fútbol Sala')).toBe(false);
    expect(sportAllowsModality('Fútbol Americano')).toBe(false);
    expect(sportAllowsModality('Voleibol')).toBe(false);
    expect(sportAllowsModality('')).toBe(false);
  });

  it('modalityToSave: valor válido en fútbol; NULL en lo demás o si es inválido/vacío', () => {
    expect(modalityToSave('Fútbol', '7')).toBe('7');
    expect(modalityToSave('Fútbol', '')).toBeNull();
    expect(modalityToSave('Fútbol', '9')).toBeNull();
    expect(modalityToSave('Tenis', '7')).toBeNull();
  });

  it('el payload de teams lleva sport_modality (y NULL si cambió a otro deporte)', () => {
    const ctx = { isAdmin: true, isCreate: true, schoolId: 's1' };
    expect(buildTeamWritePayload(form(), ctx).payload.sport_modality).toBe('7');
    expect(buildTeamWritePayload(form({ sport: 'Tenis' }), ctx).payload.sport_modality).toBeNull();
    expect(buildTeamWritePayload(form({ sport_modality: '' }), ctx).payload.sport_modality).toBeNull();
    expect(buildTeamWritePayload(form(), { isAdmin: false, isCreate: false, schoolId: 's1' }).payload.sport_modality).toBe('7');
  });

  it('el selector solo aparece con Fútbol', () => {
    const { rerender } = render(<FootballModalitySelect sport="Tenis" value="" onChange={() => {}} />);
    expect(screen.queryByTestId('football-modality')).toBeNull();
    rerender(<FootballModalitySelect sport="Fútbol" value="" onChange={() => {}} />);
    expect(screen.getByTestId('football-modality')).toBeInTheDocument();
    expect(screen.getByText('Sin definir (según el nombre)')).toBeInTheDocument();
  });
});
