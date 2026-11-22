import type { ToolConfig } from '@itsjust/core';

const toolConfig: ToolConfig = {
  id: 'dice-roller',
  name: 'Dice Roller',
  description:
    'Roll dice with configurable pools, sides, modifiers, advantage/disadvantage and reroll-on-1, animated individual die results, roll history with re-rolls, saved favorite presets, shareable URLs and statistics of past totals.',
  version: '1.0.0',
  exportFormats: ['png', 'jpeg', 'webp', 'pdf'],
  features: {
    export: true,
    autoSave: true,
    undoRedo: false,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    accent: '#f59e0b',
    accentHover: '#d97706',
    accentSubtle: 'rgba(245, 158, 11, 0.12)',
    brand: 'Dice Roller',
    icon: '🎲',
  },
  shortcuts: [
    {
      title: 'Actions',
      shortcuts: [
        {
          keys: 'R',
          label: 'Roll dice',
          description: 'roll the current dice notation',
        },
        {
          keys: 'C',
          label: 'Copy result',
          description: 'copy the latest roll total to the clipboard',
        },
        {
          keys: 'F',
          label: 'Save favorite',
          description: 'save the current notation as a favorite preset',
        },
      ],
    },
  ],
};

export default toolConfig;
