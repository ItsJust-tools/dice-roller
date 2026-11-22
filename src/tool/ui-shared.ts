import { DEFAULT_STATE, ROLL_MODES, type RollMode, type ToolState } from './types';

export { ROLL_MODES } from './types';

export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return typeof v.notation === 'string' && Array.isArray(v.history) && Array.isArray(v.favorites);
}

export function modeLabel(mode: RollMode): string {
  return ROLL_MODES.find((m) => m.value === mode)?.label ?? mode;
}

export { DEFAULT_STATE };
