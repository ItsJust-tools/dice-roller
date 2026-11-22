import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import manifest from '@/app/manifest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import ErrorPage from '@/app/error';
import NotFound from '@/app/not-found';
import { JsonLd } from '@/app/json-ld';
import ToolPage from '@/app/page';
import { cn } from '@/lib/utils';
import { generateJsonLd, generateToolMetadata } from '@/lib/seo';
import toolConfig from '@/tool/tool.config';
import { getPublicSiteUrl, templateMetadata } from '@/tool/template-metadata';
import { diceRollerTool } from '@/tool/tool-definition';
import { Canvas } from '@/tool/components/Canvas';
import { Sidebar } from '@/tool/components/Sidebar';
import { Toolbar } from '@/tool/components/Toolbar';
import { DEFAULT_STATE as BASE_DEFAULT_STATE, type ToolState } from '@/tool/types';
import type { ExporterLoader } from '@itsjust/core';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/app/tool-client-wrapper', () => ({
  default: () => <div data-testid="tool-client-wrapper">tool-client-wrapper</div>,
}));

describe('app and seo', () => {
  const getOgImageUrl = (
    images: NonNullable<NonNullable<ReturnType<typeof generateToolMetadata>['openGraph']>['images']>
  ): string | undefined => {
    const list = Array.isArray(images) ? images : [images];
    const first = list[0];
    if (!first) return undefined;
    if (typeof first === 'string') return first;
    if (first instanceof URL) return first.toString();
    return String(first.url);
  };

  it('builds metadata and json-ld values', () => {
    const metadata = generateToolMetadata(toolConfig);
    const jsonLd = generateJsonLd(toolConfig);

    expect(metadata.creator).toBe(toolConfig.name);
    expect(metadata.metadataBase?.toString()).toBe('http://localhost:3000/');
    const ogUrl = metadata.openGraph?.images ? getOgImageUrl(metadata.openGraph.images) : undefined;
    expect(ogUrl).toContain('/og.svg');
    expect(jsonLd.url).toBe('http://localhost:3000');
    expect(jsonLd.featureList.length).toBeGreaterThan(0);
  });

  it('returns site manifest, robots and sitemap', () => {
    const man = manifest();
    const rob = robots();
    const sm = sitemap();

    expect(man.name).toBe(templateMetadata.appName);
    expect(rob.sitemap).toBe('http://localhost:3000/sitemap.xml');
    expect(sm[0]?.url).toBe('http://localhost:3000');
  });

  it('renders json-ld script safely', () => {
    render(<JsonLd config={{ ...toolConfig, name: '</script>' }} />);
    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script?.innerHTML).toContain('\\u003c/script>');
  });

  it('renders error page and invokes reset', () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error('boom')} reset={reset} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders not-found page', () => {
    render(<NotFound />);
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
  });

  it('renders top-level tool page', () => {
    render(<ToolPage />);
    expect(screen.getByTestId('tool-client-wrapper')).toBeInTheDocument();
    expect(document.querySelector('script[type="application/ld+json"]')).toBeInTheDocument();
  });

  it('covers tool definition and helper exports', async () => {
    expect(cn('a', undefined, 'b', false, null, 'c')).toBe('a b c');
    expect(getPublicSiteUrl()).toBe('http://localhost:3000');
    expect(diceRollerTool.name).toBe(toolConfig.name);
    expect(diceRollerTool.id).toBe('dice-roller');
    expect(
      diceRollerTool.deserialize({
        notation: 'd20+5',
        mode: 'advantage',
        rerollOnes: true,
        history: [],
      })
    ).toEqual({
      success: true,
      data: {
        notation: 'd20+5',
        mode: 'advantage',
        rerollOnes: true,
        history: [],
        favorites: [],
      },
    });
    const repaired = diceRollerTool.deserialize({ nope: true });
    expect(repaired.success).toBe(true);
    if (repaired.success) {
      expect(repaired.data.notation).toBe(BASE_DEFAULT_STATE.notation);
      expect(repaired.data.history).toEqual([]);
    }
    expect(diceRollerTool.serialize({ ...BASE_DEFAULT_STATE, notation: '2d6+3' })).toContain(
      '"notation":"2d6+3"'
    );
    const exporters =
      (diceRollerTool as { exporters?: Array<{ loader: ExporterLoader }> }).exporters ?? [];
    expect(exporters).toHaveLength(4);
    const first = exporters[0];
    expect(first).toBeDefined();
    if (!first) throw new Error('missing exporter');
    const png = await (first.loader as ExporterLoader)();
    const resolved = 'default' in png ? png.default : png.exporter;
    expect(resolved.format).toBe('png');
  });

  it('renders tool components', () => {
    const state: ToolState = {
      ...BASE_DEFAULT_STATE,
      favorites: [{ id: 'f1', label: 'Attack', notation: '2d6+3' }],
    };
    render(
      <>
        <Toolbar state={state} onChange={() => {}} onClear={() => {}} onRoll={() => {}} />
        <Sidebar state={state} onChange={() => {}} onUseFavorite={() => {}} />
        <Canvas state={state} />
      </>
    );

    expect(screen.getByTestId('dice-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('notation-input')).toHaveValue('2d6+3');
    expect(screen.getByTestId('mode-tab-normal')).toBeInTheDocument();
    expect(screen.getByTestId('dice-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('favorites-list')).toBeInTheDocument();
    expect(screen.getByTestId('stats-empty')).toBeInTheDocument();
    expect(screen.getByTestId('result-empty')).toBeInTheDocument();
    expect(screen.getByTestId('history-empty')).toBeInTheDocument();
  });

  it('renders populated canvas with latest result and stats', () => {
    const state: ToolState = {
      ...BASE_DEFAULT_STATE,
      history: [
        {
          notation: '2d6+3',
          createdAt: '2026-01-01T00:00:00.000Z',
          result: {
            diceGroups: [
              [
                { sides: 6, value: 4 },
                { sides: 6, value: 2 },
              ],
            ],
            keptTotal: 6,
            modifier: 3,
            total: 9,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        },
      ],
    };
    render(<Canvas state={state} latestResult={state.history[0]?.result ?? null} />);
    expect(screen.getByTestId('result-total')).toHaveTextContent('9');
    expect(screen.getByTestId('result-modifier')).toHaveTextContent('modifier +3');
    expect(screen.getByTestId('result-description')).toHaveTextContent('2d6+3 → [4, 2] +3 = 9');
    expect(screen.getAllByTestId('die-0')).toHaveLength(1);
    expect(screen.getByTestId('stats-count')).toHaveTextContent('1');
    expect(screen.getByTestId('stats-min')).toHaveTextContent('9');
    expect(screen.getByTestId('stats-max')).toHaveTextContent('9');
    expect(screen.getByTestId('stats-avg')).toHaveTextContent('9');
    expect(screen.getByTestId('history-entry-0')).toBeInTheDocument();
  });

  it('renders advantage indicator for non-normal mode', () => {
    const state: ToolState = { ...BASE_DEFAULT_STATE, mode: 'disadvantage' };
    render(<Canvas state={state} latestResult={null} />);
    expect(screen.getByTestId('result-empty')).toBeInTheDocument();
  });
});
