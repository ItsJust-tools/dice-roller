'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { ToolShell, useTool, ImportExport } from '@itsjust/core';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { toolConfig, templateBaseVersion, Canvas, Toolbar, Sidebar } from '@/tool';
import { diceRollerTool } from '@/tool/tool-definition';
import { performRoll, type RollResult, type ToolState } from '@/tool/types';

export default function ToolClient() {
  const ToolShellCompat = ToolShell as unknown as ComponentType<Record<string, unknown>> & {
    Toolbar?: ComponentType<{ children?: ReactNode }>;
    Body?: ComponentType<{ children?: ReactNode }>;
    Sidebar?: ComponentType<{ children?: ReactNode }>;
    Canvas?: ComponentType<{ children?: ReactNode }>;
    StatusBar?: ComponentType<{ children?: ReactNode }>;
  };
  const canvasRef = useRef<HTMLDivElement>(null);
  const tool = useTool<ToolState>(diceRollerTool, canvasRef);
  const setToolData = tool.state.setData;
  const showToast = tool.toast;
  const [isSharing, setIsSharing] = useState(false);
  const hasLoadedSharedState = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth > 768 && toolConfig.features.sidebar
  );
  const [latestResult, setLatestResult] = useState<RollResult | null>(null);

  const title = toolConfig.name;
  const state = tool.state.data;

  const doRoll = useCallback(
    (rollState: ToolState) => {
      const outcome = performRoll(rollState);
      if (!outcome) {
        showToast('Invalid dice notation', 'error');
        return;
      }
      setToolData(() => outcome.state);
      setLatestResult(outcome.result);
    },
    [setToolData, showToast]
  );

  const handleRoll = useCallback(() => doRoll(state), [doRoll, state]);

  const handleReroll = useCallback(
    (entryIndex: number) => {
      const entry = state.history[entryIndex];
      if (!entry) return;
      doRoll({ ...state, notation: entry.notation });
    },
    [doRoll, state]
  );

  const handleRemoveHistory = useCallback(
    (entryIndex: number) => {
      setToolData((prev) => ({
        ...prev,
        history: prev.history.filter((_, i) => i !== entryIndex),
      }));
    },
    [setToolData]
  );

  const handleUseFavorite = useCallback(
    (notation: string) => {
      setToolData((prev) => ({ ...prev, notation }));
    },
    [setToolData]
  );

  useEffect(() => {
    if (hasLoadedSharedState.current) return;
    hasLoadedSharedState.current = true;
    const params = new URLSearchParams(window.location.search);
    const encodedState = params.get('state');
    if (!encodedState) return;
    try {
      const serialized = decompressFromEncodedURIComponent(encodedState);
      if (!serialized) throw new Error('Invalid shared URL');
      const parsed: unknown = JSON.parse(serialized);
      const deserialized = diceRollerTool.deserialize(parsed);
      if (!deserialized.success) throw new Error(deserialized.error);
      setToolData(deserialized.data);
      showToast('Loaded dice setup from shared URL', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load shared URL';
      showToast(message, 'error');
    }
  }, [setToolData, showToast]);

  const handleCopyResult = useCallback(async () => {
    if (!latestResult) {
      showToast('Nothing to copy yet — roll first', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(`${latestResult.total}`);
      showToast('Result copied to clipboard', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to copy result';
      showToast(message, 'error');
    }
  }, [latestResult, showToast]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const serialized = diceRollerTool.serialize(state);
      const encodedState = compressToEncodedURIComponent(serialized);
      if (!encodedState) throw new Error('Failed to encode state for URL');
      const url = new URL(window.location.href);
      url.searchParams.set('state', encodedState);
      url.searchParams.set('tool', toolConfig.id);
      window.history.replaceState(null, '', url.toString());

      const shareUrl = url.toString();
      if (navigator.share) {
        try {
          await navigator.share({ title, url: shareUrl });
          showToast('Shared URL ready', 'success');
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
        }
      }
      await navigator.clipboard.writeText(shareUrl);
      showToast('Share URL copied to clipboard', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create share URL';
      showToast(message, 'error');
    } finally {
      setIsSharing(false);
    }
  }, [showToast, state, title]);

  const toolbarContent = (
    <Toolbar
      state={state}
      onChange={(next) => setToolData(() => next)}
      onClear={() => setToolData((prev) => ({ ...prev, history: [] }))}
      onRoll={handleRoll}
      onCopy={() => void handleCopyResult()}
    />
    // ImportExport is rendered below via the shell toolbar slot; kept inline for layout parity.
  );

  const toolbarSlot = (
    <>
      {toolbarContent}
      {typeof ImportExport === 'function' ? (
        <ImportExport
          formats={tool.supportedFormats}
          onExport={tool.handleExport}
          onImport={tool.importFromFile}
          isImporting={tool.isImporting}
          onShare={handleShare}
          isSharing={isSharing}
        />
      ) : null}
    </>
  );

  const sidebarContent = (
    <Sidebar
      state={state}
      onChange={(next) => setToolData(() => next)}
      onUseFavorite={handleUseFavorite}
    />
  );

  const canvasContent = (
    <div ref={canvasRef}>
      <Canvas
        state={state}
        latestResult={latestResult}
        onRoll={handleRoll}
        onReroll={handleReroll}
        onRemoveHistory={handleRemoveHistory}
      />
    </div>
  );

  const statusBarContent = (
    <>
      <span
        className={`status-slot status-slot-state ${tool.state.isDirty ? 'status-unsaved' : 'status-saved'}`}
      >
        {tool.state.isDirty ? (
          <>
            <span className="status-saving-dot" />
            Unsaved
          </>
        ) : tool.state.lastSaved ? (
          <>Saved {tool.state.lastSaved}</>
        ) : (
          'Ready'
        )}
      </span>
      <span className="status-slot status-slot-mode">{state.mode}</span>
      <span className="status-slot status-slot-summary">
        {state.notation} · {state.history.length} rolls · {state.favorites.length} favorites
      </span>
      {latestResult ? (
        <span className="status-slot status-slot-result">Last: {latestResult.total}</span>
      ) : null}
      <span className="status-slot status-slot-tool-version">Tool v{toolConfig.version}</span>
      <span className="status-slot status-slot-template-version">
        Template v{templateBaseVersion}
      </span>
    </>
  );

  const hasLegacySections = Boolean(
    ToolShellCompat.Toolbar &&
    ToolShellCompat.Body &&
    ToolShellCompat.Sidebar &&
    ToolShellCompat.Canvas &&
    ToolShellCompat.StatusBar
  );

  return (
    <ToolShellCompat
      config={toolConfig}
      sidebarOpen={sidebarOpen}
      onSidebarChange={setSidebarOpen}
      toolbar={toolbarSlot}
      sidebar={sidebarContent}
      canvas={canvasContent}
      statusBar={statusBarContent}
    >
      {hasLegacySections
        ? (() => {
            const ToolbarSection = ToolShellCompat.Toolbar as ComponentType<{
              children?: ReactNode;
            }>;
            const BodySection = ToolShellCompat.Body as ComponentType<{ children?: ReactNode }>;
            const SidebarSection = ToolShellCompat.Sidebar as ComponentType<{
              children?: ReactNode;
            }>;
            const CanvasSection = ToolShellCompat.Canvas as ComponentType<{ children?: ReactNode }>;
            const StatusBarSection = ToolShellCompat.StatusBar as ComponentType<{
              children?: ReactNode;
            }>;
            return (
              <>
                <ToolbarSection>{toolbarSlot}</ToolbarSection>
                <BodySection>
                  <SidebarSection>{sidebarContent}</SidebarSection>
                  <CanvasSection>{canvasContent}</CanvasSection>
                </BodySection>
                <StatusBarSection>{statusBarContent}</StatusBarSection>
              </>
            );
          })()
        : null}
    </ToolShellCompat>
  );
}
