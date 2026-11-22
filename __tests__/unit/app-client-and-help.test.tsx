import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import ToolClient from '@/app/tool-client';
import ToolClientWrapper from '@/app/tool-client-wrapper';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="dynamic-tool-client">dynamic-tool-client</div>,
}));

const mockSetData = vi.fn();
const mockToast = vi.fn();

vi.mock('@itsjust/core', () => ({
  ToolShell: ({ toolbar, sidebar, canvas, statusBar }: Record<string, unknown>) => (
    <div>
      <div data-testid="shell-toolbar">{toolbar as ReactNode}</div>
      <div data-testid="shell-sidebar">{sidebar as ReactNode}</div>
      <div data-testid="shell-canvas">{canvas as ReactNode}</div>
      <div data-testid="shell-status">{statusBar as ReactNode}</div>
    </div>
  ),
  ImportExport: ({ onShare }: { onShare?: () => void }) => (
    <button type="button" onClick={onShare} data-testid="trigger-share">
      share
    </button>
  ),
  useTool: () => ({
    state: {
      data: {
        notation: '2d6+3',
        mode: 'normal',
        rerollOnes: false,
        history: [],
        favorites: [],
      },
      setData: mockSetData,
      isDirty: false,
      lastSaved: 'just now',
    },
    toast: mockToast,
    supportedFormats: ['json'],
    handleExport: vi.fn(),
    importFromFile: vi.fn(),
    isImporting: false,
  }),
}));

vi.mock('@/tool', () => ({
  toolConfig: {
    id: 'dice-roller',
    name: 'Dice Roller',
    version: '1.0.0',
    features: { sidebar: true },
    theme: { brand: 'Dice Roller' },
  },
  templateBaseVersion: '1.0.0',
  Canvas: () => <div>canvas</div>,
  Toolbar: () => <div>toolbar</div>,
  Sidebar: () => <div>sidebar</div>,
}));

vi.mock('@/tool/tool-definition', () => ({
  diceRollerTool: {
    id: 'dice-roller',
    name: 'Dice Roller',
    serialize: (state: unknown) => JSON.stringify(state),
    deserialize: () => ({
      success: true,
      data: {
        notation: '2d6+3',
        mode: 'normal',
        rerollOnes: false,
        history: [],
        favorites: [],
      },
    }),
  },
}));

describe('app client', () => {
  beforeEach(() => {
    mockSetData.mockReset();
    mockToast.mockReset();
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(navigator, 'share', {
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    window.history.replaceState(null, '', 'http://localhost:3000/');
  });

  it('renders dynamic tool client wrapper', () => {
    render(<ToolClientWrapper />);
    expect(screen.getByTestId('dynamic-tool-client')).toBeInTheDocument();
  });

  it('renders shell sections and handles share flow', async () => {
    render(<ToolClient />);

    expect(screen.getByTestId('shell-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('trigger-share')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('trigger-share'));

    // Share is async; flush microtasks before asserting the toast.
    await vi.waitFor(() => {
      expect(mockToast).toHaveBeenCalled();
    });
  });
});
