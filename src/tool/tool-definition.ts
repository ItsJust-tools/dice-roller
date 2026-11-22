import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig from './tool.config';
import {
  DEFAULT_STATE,
  MAX_FAVORITES,
  MAX_HISTORY,
  type Favorite,
  type HistoryEntry,
  type RollMode,
  type ToolState,
} from './types';

const VALID_MODES: RollMode[] = ['normal', 'advantage', 'disadvantage'];

/** Serialize tool state into a compact JSON string for share/import. */
export function serializeState(state: ToolState): string {
  return JSON.stringify({
    notation: state.notation,
    mode: state.mode,
    rerollOnes: state.rerollOnes,
    history: state.history,
    favorites: state.favorites,
  });
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function validHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is HistoryEntry => {
      if (typeof entry !== 'object' || entry === null) return false;
      const e = entry as Partial<HistoryEntry>;
      return (
        typeof e.notation === 'string' &&
        typeof e.createdAt === 'string' &&
        typeof e.result === 'object' &&
        e.result !== null &&
        typeof (e.result as RollResultLike).total === 'number'
      );
    })
    .slice(0, MAX_HISTORY);
}

interface RollResultLike {
  total?: unknown;
}

function validFavorites(value: unknown): Favorite[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (fav): fav is Favorite =>
        typeof fav === 'object' &&
        fav !== null &&
        typeof (fav as Favorite).id === 'string' &&
        typeof (fav as Favorite).label === 'string' &&
        typeof (fav as Favorite).notation === 'string'
    )
    .slice(0, MAX_FAVORITES);
}

/** Validate and recover tool state from an arbitrary payload. */
export function deserializeState(data: unknown): DeserializeResult<ToolState> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      success: false,
      error: 'Invalid data format: expected dice roller state object',
    };
  }
  const v = data as Record<string, unknown>;
  const mode: RollMode = VALID_MODES.includes(v.mode as RollMode)
    ? (v.mode as RollMode)
    : DEFAULT_STATE.mode;
  const state: ToolState = {
    notation: stringOr(v.notation, DEFAULT_STATE.notation),
    mode,
    rerollOnes: typeof v.rerollOnes === 'boolean' ? v.rerollOnes : DEFAULT_STATE.rerollOnes,
    history: validHistory(v.history),
    favorites: validFavorites(v.favorites),
  };
  return { success: true, data: state };
}

/** True when a serialized string round-trips back to the same state. */
export function roundTrips(state: ToolState): boolean {
  try {
    const restored = deserializeState(JSON.parse(serializeState(state)));
    return restored.success && JSON.stringify(restored.data) === JSON.stringify(state);
  } catch {
    return false;
  }
}

export const diceRollerTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: { ...DEFAULT_STATE },
  serialize: serializeState,
  deserialize: deserializeState,
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};

export {
  addFavorite,
  removeFavorite,
  clearHistory,
  parseNotation,
  executeRoll,
  performRoll,
  describeRoll,
  computeStats,
  historyTotals,
  randomInt,
  rollDie,
} from './types';
