import {
  ROUTINES,
  SIBLING_FALLBACK,
  resolveTitle,
  routinesFor,
  suggestionsFor,
  suits,
} from '@/domain/missionLibrary';
import { Child } from '@/domain/types';

const child = (over: Partial<Child> = {}): Child => ({
  id: 'c1',
  familyId: 'f1',
  firstName: 'Noah',
  age: 8,
  avatarKey: 'blue',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const elliott = child({ id: 'c2', firstName: 'Elliott', age: 6 });
const lena = child({ id: 'c3', firstName: 'Léna', age: 10 });

describe('mission library', () => {
  it('never suggests a sibling mission to an only child', () => {
    const only = child();
    const sibling = ROUTINES.flatMap((r) => r.suggestions).find((s) => s.sibling)!;

    expect(suits(sibling, only, [])).toBe(false);
    expect(suits(sibling, only, [elliott])).toBe(true);
    expect(suggestionsFor(only, []).some((s) => s.sibling)).toBe(false);
  });

  it('names the sibling when there is exactly one', () => {
    const suggestion = { id: 'x', title: 'Dire un mot gentil à {enfant}', icon: '💬', minutes: 10, ages: [5, 12] as [number, number], sibling: true };

    expect(resolveTitle(suggestion, [elliott])).toBe('Dire un mot gentil à Elliott');
    expect(resolveTitle(suggestion, [elliott, lena])).toBe(`Dire un mot gentil à ${SIBLING_FALLBACK}`);
    expect(resolveTitle(suggestion, [])).toBe(`Dire un mot gentil à ${SIBLING_FALLBACK}`);
  });

  it('leaves titles without a placeholder alone', () => {
    const plain = ROUTINES[0].suggestions[0];
    expect(resolveTitle(plain, [elliott])).toBe(plain.title);
  });

  it('keeps suggestions inside the child’s age range', () => {
    const little = child({ age: 5 });
    for (const s of suggestionsFor(little, [elliott])) {
      expect(s.ages[0]).toBeLessThanOrEqual(5);
      expect(s.ages[1]).toBeGreaterThanOrEqual(5);
    }
  });

  it('drops routines that have nothing left for the child', () => {
    const only = child({ age: 5 });
    const ids = routinesFor(only, []).map((r) => r.id);

    // "Vivre ensemble" is entirely sibling missions.
    expect(ids).not.toContain('ensemble');
    expect(routinesFor(only, [elliott]).map((r) => r.id)).toContain('ensemble');
    expect(routinesFor(only, []).every((r) => r.suggestions.length > 0)).toBe(true);
  });

  it('does not repeat the same mission twice in the flat list', () => {
    // "Me brosser les dents" appears in both the morning and bedtime routines.
    const titles = suggestionsFor(child(), [elliott]).map((s) => s.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
