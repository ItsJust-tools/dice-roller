# Dice Roller

Roll dice with configurable pools, sides, modifiers and live roll history. A tabletop-gaming utility for D&D, Pathfinder, board games and any dice-based game.

**Live:** [dice-roller.itsjust.tools](https://dice-roller.itsjust.tools)

## Features

- Standard dice notation parsing: `2d6+3`, `d20`, `4d6dl1` (drop lowest), `4d6dh1` (drop highest), multiple pools like `2d6+1d4-2`
- Supported dice: d4, d6, d8, d10, d12, d20, d100 and any custom sides from 2–1000
- Modifiers, advantage/disadvantage modes and an optional re-roll-on-1 rule
- Animated roll results showing every individual die value plus kept/dropped and total
- Roll history with timestamps, notation and results, plus per-entry re-roll buttons
- Saved favorite roll presets with custom labels (up to 10)
- Share/serialize roll setups via URL state — restores notation, mode, reroll rule and favorites
- Statistics panel: roll count, min/max/average, and a distribution of past totals
- Copy the latest total to the clipboard, image/PDF export, `.itsjust.json` import/export
- 100% client-side — no data ever leaves your browser

## Keyboard shortcuts

| Key                         | Action        |
| --------------------------- | ------------- |
| `R`                         | Roll dice     |
| `C`                         | Copy result   |
| `F`                         | Save favorite |
| `Enter` (in notation field) | Roll          |

## Development

```bash
npm install
npm run dev
npm test          # unit tests with coverage
npm run build     # production build
```

## License

MIT
