export type RollMode = 'normal' | 'advantage' | 'disadvantage';

export const ROLL_MODES: { value: RollMode; label: string; hint: string }[] = [
  { value: 'normal', label: 'Normal', hint: 'roll each die once' },
  { value: 'advantage', label: 'Advantage', hint: 'roll each die twice, keep the higher' },
  { value: 'disadvantage', label: 'Disadvantage', hint: 'roll each die twice, keep the lower' },
];

export const MAX_SIDES = 1000;
export const MIN_SIDES = 2;
export const MAX_POOL_COUNT = 50;
export const MAX_POOLS = 10;
export const MAX_MODIFIER = 999;
export const MAX_HISTORY = 50;
export const MAX_FAVORITES = 10;

/** One group of identical dice, e.g. the "4d6" with one dropped lowest. */
export interface DicePool {
  count: number;
  sides: number;
  dropLowest: number;
  dropHighest: number;
}

export interface ParsedNotation {
  pools: DicePool[];
  modifier: number;
}

/** A single rolled die. */
export interface Die {
  /** Number of faces on the die. */
  sides: number;
  /** Final value used for the roll (after reroll/advantage resolution). */
  value: number;
  /** Value was rerolled because of the reroll-on-1 option. */
  rerolled?: boolean;
  /** Die is excluded from the kept total by a drop rule. */
  dropped?: boolean;
}

export interface RollResult {
  /** One group of dice per parsed pool, in notation order. */
  diceGroups: Die[][];
  /** Sum of kept (non-dropped) dice. */
  keptTotal: number;
  /** Constant modifier added after kept dice. */
  modifier: number;
  /** Final total: keptTotal + modifier. */
  total: number;
  /** ISO timestamp of the roll. */
  createdAt: string;
}

export interface HistoryEntry {
  /** Raw notation string the user rolled. */
  notation: string;
  result: RollResult;
  createdAt: string;
}

export interface Favorite {
  id: string;
  label: string;
  notation: string;
}

export interface ToolState {
  /** Current notation input, e.g. "2d6+3". */
  notation: string;
  mode: RollMode;
  rerollOnes: boolean;
  history: HistoryEntry[];
  favorites: Favorite[];
}

export const DEFAULT_NOTATION = '2d6+3';

export const DEFAULT_STATE: ToolState = {
  notation: DEFAULT_NOTATION,
  mode: 'normal',
  rerollOnes: false,
  history: [],
  favorites: [],
};

/** Uniform random integer in [1..sides]; injectable for deterministic tests. */
export type RandomInt = (sides: number) => number;

export function randomInt(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Parse dice notation into pools and a modifier.
 * Supported: "d20", "2d6+3", "4d6dl1" (drop lowest), "4d6dh1" (drop highest),
 * multiple pools like "2d6+1d4-2". Whitespace and case are ignored.
 * Returns null for empty/invalid notation.
 */
export function parseNotation(input: string): ParsedNotation | null {
  const cleaned = input.replace(/\s+/g, '').toLowerCase();
  if (!cleaned) return null;
  const pools: DicePool[] = [];
  let modifier = 0;
  let matchedLength = 0;
  const tokenRe = /([+-]?)(\d*)d(\d+)(?:dl(\d+))?(?:dh(\d+))?|([+-]\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(cleaned)) !== null) {
    matchedLength += m[0].length;
    if (m[6] !== undefined) {
      // Plain signed modifier token.
      modifier += parseInt(m[6], 10);
      continue;
    }
    const sign = m[1] === '-' ? -1 : 1;
    const countStr = m[2] ?? '';
    const sidesStr = m[3];
    const count = countStr === '' ? 1 : parseInt(countStr, 10);
    const sides = typeof sidesStr === 'string' ? sign * parseInt(sidesStr, 10) : sign;
    const dropLowest = m[4] !== undefined ? parseInt(m[4], 10) : 0;
    const dropHighest = m[5] !== undefined ? parseInt(m[5], 10) : 0;
    pools.push({ count, sides, dropLowest, dropHighest });
  }
  if (matchedLength !== cleaned.length || pools.length === 0) return null;
  if (pools.length > MAX_POOLS) return null;
  for (const pool of pools) {
    if (!Number.isInteger(pool.count) || pool.count < 1 || pool.count > MAX_POOL_COUNT) return null;
    if (
      !Number.isInteger(pool.sides) ||
      Math.abs(pool.sides) < MIN_SIDES ||
      Math.abs(pool.sides) > MAX_SIDES
    ) {
      return null;
    }
    if (pool.dropLowest < 0 || pool.dropHighest < 0) return null;
    if (pool.dropLowest + pool.dropHighest >= pool.count) return null;
  }
  if (!Number.isFinite(modifier) || Math.abs(modifier) > MAX_MODIFIER) return null;
  return { pools, modifier };
}

/** Roll one die honoring mode and reroll-on-1. */
export function rollDie(
  sides: number,
  mode: RollMode,
  rerollOnes: boolean,
  rng: RandomInt = randomInt
): Die {
  let roll = rng(sides);
  let rerolled = false;
  if (rerollOnes && roll === 1) {
    rerolled = true;
    roll = rng(sides);
  }
  if (mode !== 'normal') {
    let other = rng(sides);
    if (rerollOnes && other === 1) {
      rerolled = true;
      other = rng(sides);
    }
    roll = mode === 'advantage' ? Math.max(roll, other) : Math.min(roll, other);
  }
  return { sides, value: roll, ...(rerolled ? { rerolled: true } : {}) };
}

/**
 * Execute all pools, apply drop rules, modifier and totals.
 * Pure apart from the injectable rng.
 */
export function executeRoll(
  parsed: ParsedNotation,
  mode: RollMode,
  rerollOnes: boolean,
  rng: RandomInt = randomInt
): Omit<RollResult, 'createdAt'> {
  const diceGroups: Die[][] = [];
  let keptTotal = 0;
  for (const pool of parsed.pools) {
    const dice: Die[] = [];
    const sides = Math.abs(pool.sides);
    for (let i = 0; i < pool.count; i++) {
      dice.push(rollDie(sides, mode, rerollOnes, rng));
    }
    const dropped = new Set<number>();
    if (pool.dropLowest > 0) {
      const order = dice.map((die, i) => ({ i, v: die.value }));
      order.sort((a, b) => a.v - b.v);
      for (const entry of order.slice(0, pool.dropLowest)) dropped.add(entry.i);
    }
    if (pool.dropHighest > 0) {
      const order = dice.map((die, i) => ({ i, v: die.value }));
      order.sort((a, b) => b.v - a.v);
      for (const entry of order.slice(0, pool.dropHighest)) dropped.add(entry.i);
    }
    dice.forEach((die, i) => {
      if (dropped.has(i)) {
        die.dropped = true;
      } else {
        keptTotal += die.value;
      }
    });
    diceGroups.push(dice);
  }
  return { diceGroups, keptTotal, modifier: parsed.modifier, total: keptTotal + parsed.modifier };
}

/** Human readable dice summary, e.g. "2d6+3 → [4, 2] (+2 dropped) +3 = 5". */
export function describeRoll(notation: string, result: RollResult): string {
  const groups = result.diceGroups.map((group) => {
    const values = group.map((d) => (d.dropped ? `${d.value} (dropped)` : String(d.value)));
    return `[${values.join(', ')}]`;
  });
  const modifier =
    result.modifier === 0
      ? ''
      : result.modifier > 0
        ? ` +${result.modifier}`
        : ` - ${Math.abs(result.modifier)}`;
  return `${notation} → ${groups.join(' + ')}${modifier} = ${result.total}`;
}

export interface RollOutcome {
  state: ToolState;
  result: RollResult;
  description: string;
}

/**
 * Roll the current state's notation and append the result to history.
 * Returns null when the notation is invalid or state is unchanged structurally.
 */
export function performRoll(
  state: ToolState,
  now: Date = new Date(),
  rng: RandomInt = randomInt
): RollOutcome | null {
  const parsed = parseNotation(state.notation);
  if (!parsed) return null;
  const rolled = executeRoll(parsed, state.mode, state.rerollOnes, rng);
  const result: RollResult = { ...rolled, createdAt: now.toISOString() };
  const entry: HistoryEntry = {
    notation: state.notation,
    result,
    createdAt: now.toISOString(),
  };
  const nextState: ToolState = {
    ...state,
    history: [entry, ...state.history].slice(0, MAX_HISTORY),
  };
  return { state: nextState, result, description: describeRoll(state.notation, result) };
}

/** Add a favorite, capped at MAX_FAVORITES; no-op duplicates by label+notation. */
export function addFavorite(state: ToolState, label: string, notation: string): ToolState {
  const trimmedLabel = label.trim();
  const trimmedNotation = notation.trim();
  if (!trimmedLabel || !trimmedNotation) return state;
  if (state.favorites.some((f) => f.label === trimmedLabel && f.notation === trimmedNotation)) {
    return state;
  }
  const favorite: Favorite = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    label: trimmedLabel,
    notation: trimmedNotation,
  };
  return { ...state, favorites: [favorite, ...state.favorites].slice(0, MAX_FAVORITES) };
}

export function removeFavorite(state: ToolState, id: string): ToolState {
  return { ...state, favorites: state.favorites.filter((f) => f.id !== id) };
}

export function clearHistory(state: ToolState): ToolState {
  return { ...state, history: [] };
}

/** Extract totals of all history entries in roll order (newest first). */
export function historyTotals(history: HistoryEntry[]): number[] {
  return history.map((entry) => entry.result.total);
}

export interface TotalStats {
  count: number;
  min: number;
  max: number;
  average: number;
  distribution: { bucketStart: number; bucketEnd: number; count: number }[];
}

/**
 * Aggregate statistics over past totals with an even-width distribution
 * across [min, max] (single bucket when all totals are equal).
 */
export function computeStats(totals: number[], bucketCount = 6): TotalStats | null {
  if (totals.length === 0) return null;
  const min = Math.min(...totals);
  const max = Math.max(...totals);
  const average = totals.reduce((sum, t) => sum + t, 0) / totals.length;
  const bucketWidth = max === min ? 1 : Math.max(1, Math.ceil((max - min + 1) / bucketCount));
  const distribution: TotalStats['distribution'] = [];
  const bucketTotal = max === min ? 1 : Math.ceil((max - min + 1) / bucketWidth);
  for (let b = 0; b < bucketTotal; b++) {
    const bucketStart = min + b * bucketWidth;
    const bucketEnd = b === bucketTotal - 1 ? max : Math.min(max, bucketStart + bucketWidth - 1);
    distribution.push({
      bucketStart,
      bucketEnd,
      count: totals.filter((t) => t >= bucketStart && t <= bucketEnd).length,
    });
  }
  return { count: totals.length, min, max, average, distribution };
}

export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return typeof v.notation === 'string' && Array.isArray(v.history) && Array.isArray(v.favorites);
}
