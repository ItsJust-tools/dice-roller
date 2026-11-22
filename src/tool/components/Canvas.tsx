'use client';

import React from 'react';
import {
  describeRoll,
  computeStats,
  historyTotals,
  type ToolState,
  type RollResult,
} from '../types';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  onRoll?: () => void;
  onReroll?: (entryIndex: number) => void;
  onRemoveHistory?: (entryIndex: number) => void;
  latestResult?: RollResult | null;
}

const dieFace = (value: number): string => {
  const faces: Record<number, string> = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };
  return faces[value] ?? String(value);
};

function DieChip({
  die,
  index,
}: {
  die: { value: number; sides: number; rerolled?: boolean; dropped?: boolean };
  index: number;
}) {
  const cls = die.dropped
    ? 'opacity-40 line-through border-gray-300 dark:border-gray-700'
    : 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100';
  return (
    <span
      data-testid={`die-${index}`}
      data-sides={die.sides}
      title={`d${die.sides}${die.rerolled ? ' (rerolled)' : ''}${die.dropped ? ' (dropped)' : ''}`}
      className={`inline-flex items-center justify-center rounded-md border-2 px-2 py-1 font-mono text-lg font-bold die-roll ${cls}`}
    >
      {die.sides === 6 ? dieFace(die.value) : die.value}
    </span>
  );
}

export const Canvas: React.FC<CanvasProps> = ({
  state,
  onChange,
  onRoll,
  onReroll,
  onRemoveHistory,
  latestResult,
}) => {
  const totals = historyTotals(state.history);
  const stats = computeStats(totals);

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full" data-testid="dice-canvas">
      {/* Latest roll */}
      <div
        className="rounded-lg border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900"
        data-testid="result-card"
        role="status"
      >
        <span className="mb-1 block text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Latest roll
        </span>
        {latestResult ? (
          <>
            <div
              className="flex flex-wrap items-center justify-center gap-2"
              data-testid="dice-group"
            >
              {latestResult.diceGroups.flatMap((group, gi) =>
                group.map((die, di) => <DieChip key={`${gi}-${di}`} die={die} index={di} />)
              )}
            </div>
            {state.mode !== 'normal' ? (
              <span
                className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                data-testid="mode-indicator"
              >
                {state.mode === 'advantage' ? '▲ advantage' : '▼ disadvantage'}
              </span>
            ) : null}
            <div className="mt-3 flex items-baseline justify-center gap-3">
              <span
                className="block font-mono text-4xl font-bold die-roll"
                data-testid="result-total"
              >
                {latestResult.total}
              </span>
              {latestResult.modifier !== 0 ? (
                <span
                  className="text-xs text-gray-500 dark:text-gray-400"
                  data-testid="result-modifier"
                >
                  modifier {latestResult.modifier > 0 ? '+' : ''}
                  {latestResult.modifier}
                </span>
              ) : null}
            </div>
            <p
              className="mt-2 font-mono text-xs text-gray-600 dark:text-gray-300"
              data-testid="result-description"
            >
              {describeRoll(state.notation, latestResult)}
            </p>
          </>
        ) : (
          <span
            className="block font-mono text-3xl font-bold text-gray-400"
            data-testid="result-empty"
          >
            Roll to see results
          </span>
        )}
      </div>

      {/* History */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Roll history
        </h3>
        {state.history.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="history-empty">
            No rolls yet.
          </p>
        ) : (
          <ul className="space-y-1" data-testid="history-list">
            {state.history.map((entry, i) => (
              <li
                key={`${entry.createdAt}-${i}`}
                className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs dark:border-gray-800"
                data-testid={`history-entry-${i}`}
              >
                <span className="flex-1 font-mono text-gray-700 dark:text-gray-300">
                  <span className="text-gray-400">
                    {new Date(entry.createdAt).toLocaleTimeString()}
                  </span>{' '}
                  {describeRoll(entry.notation, entry.result)}
                </span>
                <button
                  type="button"
                  data-testid={`reroll-${i}`}
                  aria-label="Re-roll this dice setup"
                  onClick={() => onReroll?.(i)}
                  className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  Re-roll
                </button>
                <button
                  type="button"
                  data-testid={`remove-history-${i}`}
                  aria-label="Remove this history entry"
                  onClick={() => onRemoveHistory?.(i)}
                  className="rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-400 hover:text-red-500 dark:border-gray-800"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Statistics */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Statistics
        </h3>
        {!stats ? (
          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="stats-empty">
            Roll some dice to see statistics.
          </p>
        ) : (
          <div data-testid="stats-panel">
            <div className="mb-3 flex flex-wrap gap-4 text-xs text-gray-700 dark:text-gray-300">
              <span>
                Rolls: <strong data-testid="stats-count">{stats.count}</strong>
              </span>
              <span>
                Min: <strong data-testid="stats-min">{stats.min}</strong>
              </span>
              <span>
                Max: <strong data-testid="stats-max">{stats.max}</strong>
              </span>
              <span>
                Avg: <strong data-testid="stats-avg">{stats.average.toFixed(2)}</strong>
              </span>
            </div>
            <ul
              className="space-y-1 text-xs text-gray-600 dark:text-gray-400"
              data-testid="stats-distribution"
            >
              {stats.distribution.map((bucket, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-20 font-mono">
                    {bucket.bucketStart}–{bucket.bucketEnd}
                  </span>
                  <span
                    className="h-2 rounded bg-amber-400"
                    style={{ width: `${Math.min(100, bucket.count * 12)}px` }}
                  />
                  <span>{bucket.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="hidden">
        <button
          type="button"
          data-testid="btn-notation-preview"
          onClick={() => onChange?.({ ...state })}
        >
          notation: {state.notation}
        </button>
        <button type="button" data-testid="btn-roll-canvas" onClick={() => onRoll?.()}>
          roll
        </button>
      </div>

      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        All rolls run locally in your browser; nothing is uploaded.
      </p>
    </div>
  );
};
