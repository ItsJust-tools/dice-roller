import { describe, it, expect } from 'vitest';
import {
  parseNotation,
  executeRoll,
  performRoll,
  describeRoll,
  rollDie,
  computeStats,
  historyTotals,
  addFavorite,
  removeFavorite,
  clearHistory,
  randomInt,
} from '@/tool/types';
import { deserializeState, serializeState, roundTrips } from '@/tool/tool-definition';
import {
  DEFAULT_STATE,
  MAX_FAVORITES,
  MAX_HISTORY,
  MAX_POOLS,
  MAX_POOL_COUNT,
  MAX_SIDES,
  MIN_SIDES,
  type ToolState,
} from '@/tool/types';

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });
const rng = (values: number[]) => {
  let i = 0;
  return (): number => values[i++ % values.length] as number;
};

describe('parseNotation', () => {
  it('parses simple dice', () => {
    expect(parseNotation('d20')).toEqual({
      pools: [{ count: 1, sides: 20, dropLowest: 0, dropHighest: 0 }],
      modifier: 0,
    });
    expect(parseNotation('2d6')).toEqual({
      pools: [{ count: 2, sides: 6, dropLowest: 0, dropHighest: 0 }],
      modifier: 0,
    });
  });

  it('parses modifiers with signs', () => {
    expect(parseNotation('2d6+3')?.modifier).toBe(3);
    expect(parseNotation('d20-5')?.modifier).toBe(-5);
    expect(parseNotation('1d4+2d6-1')?.modifier).toBe(-1);
    expect(parseNotation('d6-0')?.modifier).toBe(0);
    expect(parseNotation('1d4+2d6-1')?.pools).toHaveLength(2);
  });

  it('parses drop lowest and drop highest', () => {
    expect(parseNotation('4d6dl1')).toEqual({
      pools: [{ count: 4, sides: 6, dropLowest: 1, dropHighest: 0 }],
      modifier: 0,
    });
    expect(parseNotation('5d8dh2+1')?.modifier).toBe(1);
    expect(parseNotation('5d8DH2')?.pools[0]?.dropHighest).toBe(2);
    expect(parseNotation('4D6DL1')?.pools[0]?.dropLowest).toBe(1);
  });

  it('parses multiple pools with drops combined', () => {
    const parsed = parseNotation('4d6dl1+2d10dh1+2');
    expect(parsed?.pools).toHaveLength(2);
    expect(parsed?.pools[0]).toEqual({ count: 4, sides: 6, dropLowest: 1, dropHighest: 0 });
    expect(parsed?.pools[1]).toEqual({ count: 2, sides: 10, dropLowest: 0, dropHighest: 1 });
    expect(parsed?.modifier).toBe(2);
  });

  it('ignores whitespace', () => {
    expect(parseNotation(' 2 d 6 + 3 ')).toEqual(parseNotation('2d6+3'));
  });

  it('rejects invalid notation', () => {
    expect(parseNotation('')).toBeNull();
    expect(parseNotation('   ')).toBeNull();
    expect(parseNotation('abc')).toBeNull();
    expect(parseNotation('+3')).toBeNull();
    expect(parseNotation('d')).toBeNull();
    expect(parseNotation('2d')).toBeNull();
    expect(parseNotation('0d6')).toBeNull();
    expect(parseNotation('2d1')).toBeNull();
    expect(parseNotation('2d1001')).toBeNull();
    expect(parseNotation('51d6')).toBeNull();
    expect(parseNotation('2d6dl2')).toBeNull();
    expect(parseNotation('2d6dh2')).toBeNull();
    expect(parseNotation('2d6dl1dh1')).toBeNull();
    expect(parseNotation('2d6x')).toBeNull();
  });

  it('enforces boundary constants', () => {
    expect(parseNotation(`${MAX_POOL_COUNT}d6`)).not.toBeNull();
    expect(parseNotation(`${MAX_POOL_COUNT + 1}d6`)).toBeNull();
    expect(parseNotation(`d${MIN_SIDES}`)).not.toBeNull();
    expect(parseNotation(`d${MAX_SIDES}`)).not.toBeNull();
    expect(parseNotation(`d${MAX_SIDES + 1}`)).toBeNull();
    const manyPools = Array.from({ length: MAX_POOLS + 1 }, (_, i) => `${i + 1}d4`).join('+');
    expect(parseNotation(manyPools)).toBeNull();
    expect(parseNotation('10000d6')).toBeNull();
  });
});

describe('rollDie', () => {
  it('respects bounds [1..sides] with the real rng', () => {
    for (const sides of [4, 6, 8, 10, 12, 20, 100]) {
      for (let i = 0; i < 50; i++) {
        const v = randomInt(sides);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(sides);
        expect(Number.isInteger(v)).toBe(true);
      }
    }
    const die = rollDie(6, 'normal', false, () => 6);
    expect(die.value).toBe(6);
  });

  it('keeps base roll in normal mode', () => {
    expect(rollDie(6, 'normal', false, rng([3, 5])).value).toBe(3);
    expect(rollDie(6, 'normal', false, rng([3, 5])).rerolled).toBeFalsy();
  });

  it('advantage keeps the higher of two rolls', () => {
    expect(rollDie(20, 'advantage', false, rng([3, 5])).value).toBe(5);
    expect(rollDie(20, 'advantage', false, rng([5, 3])).value).toBe(5);
    expect(rollDie(20, 'advantage', false, rng([4, 4])).value).toBe(4);
  });

  it('disadvantage keeps the lower of two rolls', () => {
    expect(rollDie(20, 'disadvantage', false, rng([3, 5])).value).toBe(3);
    expect(rollDie(20, 'disadvantage', false, rng([5, 3])).value).toBe(3);
  });

  it('rerolls ones when the option is on', () => {
    const die = rollDie(6, 'normal', true, rng([1, 4]));
    expect(die.value).toBe(4);
    expect(die.rerolled).toBe(true);
  });

  it('does not reroll non-ones', () => {
    const die = rollDie(6, 'normal', true, rng([2]));
    expect(die.value).toBe(2);
    expect(die.rerolled).toBeUndefined();
  });

  it('rerolls also in advantage mode consuming extra rng values', () => {
    const die = rollDie(6, 'advantage', true, rng([1, 3, 5]));
    expect(die.rerolled).toBe(true);
    expect(die.value).toBe(5);
  });

  it('rerolls the second die of advantage and keeps lower', () => {
    const die = rollDie(6, 'disadvantage', true, rng([4, 1, 2]));
    expect(die.rerolled).toBe(true);
    expect(die.value).toBe(2);
  });
});

describe('executeRoll', () => {
  it('sums dice and modifier', () => {
    const parsed = parseNotation('2d6+3')!;
    const result = executeRoll(parsed, 'normal', false, rng([2, 4]));
    expect(result.diceGroups.flat().map((d) => d.value)).toEqual([2, 4]);
    expect(result.keptTotal).toBe(6);
    expect(result.modifier).toBe(3);
    expect(result.total).toBe(9);
  });

  it('handles negative modifiers', () => {
    const parsed = parseNotation('1d6-5')!;
    expect(executeRoll(parsed, 'normal', false, rng([2])).total).toBe(-3);
  });

  it('drops the lowest die for 4d6dl1', () => {
    const parsed = parseNotation('4d6dl1')!;
    const result = executeRoll(parsed, 'normal', false, rng([4, 4, 1, 1]));
    const dropped = result.diceGroups[0]!.filter((d) => d.dropped);
    expect(dropped).toHaveLength(1);
    expect(dropped[0]!.value).toBe(1);
    expect(result.keptTotal).toBe(9);
    expect(result.total).toBe(9);
  });

  it('drops the highest die for dh rules', () => {
    const parsed = parseNotation('3d6dh1')!;
    const result = executeRoll(parsed, 'normal', false, rng([6, 2, 5]));
    const dropped = result.diceGroups[0]!.filter((d) => d.dropped);
    expect(dropped).toHaveLength(1);
    expect(dropped[0]!.value).toBe(6);
    expect(result.total).toBe(7);
  });

  it('marks the single die when one die remains after a drop', () => {
    const parsed = parseNotation('2d6dh1')!;
    const result = executeRoll(parsed, 'normal', false, rng([3, 2]));
    expect(result.keptTotal).toBe(2);
  });

  it('handles multiple pools independently', () => {
    const parsed = parseNotation('2d6+1d4')!;
    const result = executeRoll(parsed, 'normal', false, rng([5, 6, 4]));
    expect(result.diceGroups[0]!.map((d) => d.value)).toEqual([5, 6]);
    expect(result.diceGroups[1]!.map((d) => d.value)).toEqual([4]);
    expect(result.total).toBe(15);
  });

  it('applies advantage per die inside executeRoll', () => {
    const parsed = parseNotation('2d6')!;
    const result = executeRoll(parsed, 'advantage', false, rng([1, 6, 2, 3]));
    expect(result.diceGroups[0]!.map((d) => d.value)).toEqual([6, 3]);
    expect(result.total).toBe(9);
  });
});

describe('performRoll', () => {
  it('returns null for invalid notation without touching history', () => {
    const before = state({ notation: 'bogus' });
    expect(performRoll(before)).toBeNull();
  });

  it('appends a history entry capped at MAX_HISTORY, newest first', () => {
    let s = state({ notation: 'd6' });
    for (let i = 0; i < MAX_HISTORY + 5; i++) {
      const outcome = performRoll(s, new Date(2026, 0, 1, 12, 0, i), rng([1]));
      expect(outcome).not.toBeNull();
      s = outcome!.state;
    }
    expect(s.history).toHaveLength(MAX_HISTORY);
    expect(new Date(s.history[0]!.createdAt).getTime()).toBeGreaterThan(
      new Date(s.history[1]!.createdAt).getTime()
    );
    expect(s.history[0]!.notation).toBe('d6');
    expect(s.history[0]!.result.total).toBe(1);
  });

  it('captures the notation snapshot at roll time', () => {
    const s = state({ notation: '2d6+3' });
    const outcome = performRoll(s, new Date(2026, 0, 1), rng([2, 4]))!;
    expect(outcome.state.history[0]!.notation).toBe('2d6+3');
    expect(outcome.description).toContain('2d6+3');
    expect(outcome.description).toContain('= 9');
  });
});

describe('describeRoll', () => {
  it('formats dice values with dropped markers and modifiers', () => {
    const parsed = parseNotation('4d6dl1-2')!;
    const result = executeRoll(parsed, 'normal', false, rng([1, 3, 5, 6]));
    const text = describeRoll('4d6dl1-2', { ...result, createdAt: '2026-01-01' });
    expect(text).toContain('(dropped)');
    expect(text).toContain('- 2');
    expect(text).toContain('= 12');
  });

  it('omits zero modifiers and shows plus for positive', () => {
    const parsed = parseNotation('2d6')!;
    const result = executeRoll(parsed, 'normal', false, rng([2, 2]));
    expect(describeRoll('2d6', { ...result, createdAt: 'x' })).toBe('2d6 → [2, 2] = 4');
    const parsed2 = parseNotation('1d6+2')!;
    const result2 = executeRoll(parsed2, 'normal', false, rng([1]));
    expect(describeRoll('1d6+2', { ...result2, createdAt: 'x' })).toContain('+2');
  });
});

describe('favorites', () => {
  it('adds a favorite with label and notation', () => {
    const s = addFavorite(state(), 'Attack', '2d6+3');
    expect(s.favorites).toHaveLength(1);
    expect(s.favorites[0]!.label).toBe('Attack');
    expect(s.favorites[0]!.notation).toBe('2d6+3');
    expect(s.favorites[0]!.id).toBeTruthy();
  });

  it('rejects empty labels or notation', () => {
    expect(addFavorite(state(), '', 'd6')).toEqual(state());
    expect(addFavorite(state(), '  ', 'd6')).toEqual(state());
    expect(addFavorite(state(), 'X', '')).toEqual(state());
    expect(addFavorite(state(), 'X', '   ')).toEqual(state());
  });

  it('deduplicates same label+notation', () => {
    let s = addFavorite(state(), 'Attack', '2d6+3');
    s = addFavorite(s, 'Attack', '2d6+3');
    expect(s.favorites).toHaveLength(1);
  });

  it('allows same notation with different labels', () => {
    let s = addFavorite(state(), 'Attack', '2d6+3');
    s = addFavorite(s, 'Damage', '2d6+3');
    expect(s.favorites).toHaveLength(2);
  });

  it('caps favorites at MAX_FAVORITES', () => {
    let s = state();
    for (let i = 0; i < MAX_FAVORITES + 3; i++) {
      s = addFavorite(s, `F${i}`, `d${i + 4}`);
    }
    expect(s.favorites).toHaveLength(MAX_FAVORITES);
    expect(s.favorites[0]!.label).toBe(`F${MAX_FAVORITES + 2}`);
  });

  it('removes by id, tolerating unknown ids', () => {
    let s = addFavorite(state(), 'A', 'd6');
    const id = s.favorites[0]!.id;
    s = removeFavorite(s, id);
    expect(s.favorites).toHaveLength(0);
    expect(removeFavorite(s, 'nope')).toEqual(s);
  });
});

describe('clearHistory', () => {
  it('empties history without touching favorites', () => {
    const s = addFavorite(state({ notation: 'd6' }), 'Q', 'd6');
    const rolled = performRoll(s, new Date())!;
    const cleared = clearHistory(rolled.state);
    expect(cleared.history).toHaveLength(0);
    expect(cleared.favorites).toHaveLength(1);
  });
});

describe('computeStats', () => {
  it('returns null with no totals', () => {
    expect(computeStats([])).toBeNull();
  });

  it('computes min, max, average and count', () => {
    const stats = computeStats([3, 7, 4])!;
    expect(stats.count).toBe(3);
    expect(stats.min).toBe(3);
    expect(stats.max).toBe(7);
    expect(stats.average).toBeCloseTo(14 / 3);
    expect(stats.distribution.length).toBeGreaterThan(0);
    expect(stats.distribution.reduce((s, b) => s + b.count, 0)).toBe(3);
  });

  it('handles identical totals with a single bucket', () => {
    const stats = computeStats([5, 5, 5])!;
    expect(stats.min).toBe(5);
    expect(stats.max).toBe(5);
    expect(stats.average).toBeCloseTo(5);
    expect(stats.distribution).toHaveLength(1);
    expect(stats.distribution[0]).toEqual({ bucketStart: 5, bucketEnd: 5, count: 3 });
  });

  it('covers totals spread across buckets', () => {
    const totals = [1, 2, 3, 4, 5, 6, 10, 20];
    const stats = computeStats(totals, 6)!;
    expect(stats.distribution.reduce((s, b) => s + b.count, 0)).toBe(totals.length);
  });

  it('handles negative modifiers producing negative totals', () => {
    const stats = computeStats([-3, -1, 2])!;
    expect(stats.min).toBe(-3);
    expect(stats.max).toBe(2);
    expect(stats.distribution.reduce((s, b) => s + b.count, 0)).toBe(3);
  });
});

describe('historyTotals', () => {
  it('extracts totals newest first', () => {
    let s = state({ notation: 'd6' });
    const a = performRoll(s, new Date(2026, 0, 1, 0, 0, 0), rng([2]))!;
    s = a.state;
    const b = performRoll(s, new Date(2026, 0, 1, 0, 0, 1), rng([5]))!;
    expect(historyTotals(b.state.history)).toEqual([5, 2]);
  });
});

describe('serialize/deserialize', () => {
  it('round-trips the exact roll setup', () => {
    const s = state({
      notation: '4d6dl1',
      mode: 'advantage',
      rerollOnes: true,
      history: [],
    });
    const withFavs = addFavorite(s, 'Ability scores', '4d6dl1');
    const rolled = performRoll(withFavs, new Date(2026, 0, 1), rng([1, 2, 3, 4]))!;
    const restored = deserializeState(JSON.parse(serializeState(rolled.state)));
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(JSON.stringify(restored.data)).toBe(JSON.stringify(rolled.state));
      expect(restored.data.notation).toBe('4d6dl1');
      expect(restored.data.mode).toBe('advantage');
      expect(restored.data.rerollOnes).toBe(true);
      expect(restored.data.favorites).toEqual(rolled.state.favorites);
      expect(restored.data.history).toEqual(rolled.state.history);
    }
    expect(roundTrips(rolled.state)).toBe(true);
  });

  it('round-trips default state', () => {
    expect(roundTrips(DEFAULT_STATE)).toBe(true);
  });

  it('rejects non-object payloads', () => {
    expect(deserializeState('nope')).toEqual({
      success: false,
      error: 'Invalid data format: expected dice roller state object',
    });
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState([1, 2]).success).toBe(false);
    expect(deserializeState(42).success).toBe(false);
  });

  it('repairs invalid fields with defaults', () => {
    const r = deserializeState({
      notation: 5,
      mode: 'cheat',
      rerollOnes: 'yes',
      history: 'nope',
      favorites: 'nope',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual(DEFAULT_STATE);
    }
  });

  it('keeps valid entries and drops malformed history/favorites', () => {
    const r = deserializeState({
      notation: 'd6',
      history: [
        {
          notation: 'd6',
          createdAt: '2026-01-01T00:00:00.000Z',
          result: {
            diceGroups: [[{ sides: 6, value: 4 }]],
            keptTotal: 4,
            modifier: 0,
            total: 4,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        },
        { junk: true },
        { notation: 'd6', createdAt: 'x', result: null },
        { notation: 'd6', createdAt: 'x', result: { noTotal: true } },
      ],
      favorites: [{ id: 'a', label: 'A', notation: 'd6' }, { nope: 1 }, null],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.history).toHaveLength(1);
      expect(r.data.favorites).toHaveLength(1);
    }
  });

  it('caps oversized history and favorites on import', () => {
    const history = Array.from({ length: 60 }, (_, i) => ({
      notation: 'd6',
      createdAt: `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z`,
      result: {
        diceGroups: [],
        keptTotal: i,
        modifier: 0,
        total: i,
        createdAt: `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z`,
      },
    }));
    const favorites = Array.from({ length: 15 }, (_, i) => ({
      id: `f${i}`,
      label: `F${i}`,
      notation: 'd6',
    }));
    const r = deserializeState({ history, favorites });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.history).toHaveLength(MAX_HISTORY);
      expect(r.data.favorites).toHaveLength(MAX_FAVORITES);
    }
  });
});
