'use client';

import React from 'react';
import { ROLL_MODES, type RollMode, type ToolState } from '../types';

interface ToolbarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
  onClear: () => void;
  onRoll: () => void;
  onCopy?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ state, onChange, onClear, onRoll, onCopy }) => {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
      role="toolbar"
      aria-label="Dice roller controls"
      data-testid="dice-toolbar"
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={state.notation}
          onChange={(e) => onChange({ ...state, notation: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRoll();
          }}
          placeholder="2d6+3, d20, 4d6dl1"
          data-testid="notation-input"
          aria-label="Dice notation"
          className="w-40 rounded-md border border-gray-300 bg-white px-3 py-1.5 font-mono text-sm text-gray-900 focus:border-amber-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <div className="flex gap-1" role="tablist" aria-label="Roll mode">
          {ROLL_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              role="tab"
              aria-selected={state.mode === mode.value}
              title={mode.hint}
              data-testid={`mode-tab-${mode.value}`}
              onClick={() => onChange({ ...state, mode: mode.value as RollMode })}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                state.mode === mode.value
                  ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={state.rerollOnes}
            onChange={(e) => onChange({ ...state, rerollOnes: e.target.checked })}
            data-testid="reroll-ones"
          />
          Re-roll 1s
        </label>
        <button
          type="button"
          onClick={onRoll}
          data-testid="btn-roll"
          className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600"
        >
          🎲 Roll
        </button>
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            data-testid="btn-copy-result"
            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Copy result
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {state.history.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            data-testid="btn-clear-history"
            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Clear history
          </button>
        ) : null}
      </div>
    </div>
  );
};
