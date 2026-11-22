'use client';

import React from 'react';
import { useState } from 'react';
import { addFavorite, removeFavorite, type ToolState } from '../types';
import { ROLL_MODES } from '../types';

interface SidebarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
  onUseFavorite: (notation: string) => void;
  onRerollFavorite?: (notation: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state, onChange, onUseFavorite }) => {
  const [label, setLabel] = useState('');

  const saveFavorite = () => {
    onChange(addFavorite(state, label || `Roll ${state.favorites.length + 1}`, state.notation));
    setLabel('');
  };

  return (
    <div className="p-4 space-y-6 text-sm overflow-y-auto h-full" data-testid="dice-sidebar">
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Roll modes</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {ROLL_MODES.map((mode) => (
            <li key={mode.value} className="flex justify-between gap-2">
              <span>{mode.label}</span>
              <span className="text-gray-500 dark:text-gray-400">{mode.hint}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Re-roll 1s rolls any die showing 1 one more time and keeps the new result.
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Favorites</h3>
        <div className="mb-2 flex gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Preset label"
            data-testid="favorite-label"
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={saveFavorite}
            data-testid="btn-save-favorite"
            className="shrink-0 rounded-md border border-amber-500 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/40"
          >
            Save
          </button>
        </div>
        {state.favorites.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="favorites-empty">
            No saved presets yet.
          </p>
        ) : (
          <ul className="space-y-1" data-testid="favorites-list">
            {state.favorites.map((fav) => (
              <li
                key={fav.id}
                className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-2 py-1.5 text-xs dark:border-gray-800"
                data-testid={`favorite-${fav.id}`}
              >
                <button
                  type="button"
                  onClick={() => onUseFavorite(fav.notation)}
                  className="flex-1 text-left"
                  title={`Use ${fav.notation}`}
                >
                  <span className="font-medium text-gray-800 dark:text-gray-200">{fav.label}</span>{' '}
                  <span className="font-mono text-gray-500 dark:text-gray-400">{fav.notation}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${fav.label}`}
                  data-testid={`remove-favorite-${fav.id}`}
                  onClick={() => onChange(removeFavorite(state, fav.id))}
                  className="text-gray-400 hover:text-red-500"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Notation reference</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>
            <kbd>d20</kbd> — single die
          </li>
          <li>
            <kbd>2d6+3</kbd> — pool with modifier
          </li>
          <li>
            <kbd>4d6dl1</kbd> — drop lowest
          </li>
          <li>
            <kbd>4d6dh1</kbd> — drop highest
          </li>
          <li>
            <kbd>d100</kbd> — percentile
          </li>
          <li>
            <kbd>2d6+1d4</kbd> — multiple pools
          </li>
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Share</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Use the toolbar share button to create a URL containing your dice setup; opening it
          restores the exact configuration — including favorites.
        </p>
      </div>
    </div>
  );
};
