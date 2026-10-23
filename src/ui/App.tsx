import React, { useState, useCallback, useEffect, useRef } from 'react';
import { postToPlugin, usePluginMessage } from './utils/messaging';
import type { PluginMessage, TokenCollection, TokenItem, MigrationRecord } from '../shared/messages';
import { HomeScreen } from './screens/HomeScreen';
import { ExplorerScreen } from './screens/ExplorerScreen';
import { MigrationScreen } from './screens/MigrationScreen';
import { MigrationResultsScreen } from './screens/MigrationResultsScreen';
import { MigrationHistoryScreen } from './screens/MigrationHistoryScreen';
import { ResizeHandle } from './components/ResizeHandle';
import { copyToClipboard } from './utils/clipboard';

type Screen = 'home' | 'explorer' | 'migration' | 'activity';

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [collections, setCollections] = useState<TokenCollection[]>([]);
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [migrationHistory, setMigrationHistory] = useState<MigrationRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<MigrationRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [docName, setDocName] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePluginMessage = useCallback((msg: PluginMessage) => {
    switch (msg.type) {
      case 'PLUGIN_READY':
        if (msg.payload.documentName) {
          setDocName(msg.payload.documentName);
        }
        break;

      case 'TOKENS_LOADED':
        setCollections(msg.payload.collections);
        setTokens(msg.payload.tokens);
        setLoading(false);
        break;

      case 'MIGRATION_HISTORY_LOADED':
        setMigrationHistory(msg.payload.records);
        setHistoryLoading(false);
        setHistoryError(msg.payload.error || null);
        break;

      case 'ERROR':
        setLoading(false);
        postToPlugin({ type: 'NOTIFY', message: msg.payload.message });
        break;

      default:
        break;
    }
  }, []);

  usePluginMessage(handlePluginMessage);

  useEffect(() => {
    postToPlugin({ type: 'INIT' });
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    postToPlugin({ type: 'LOAD_TOKENS' });
  };

  const handleCopy = (text: string, id: string, notifyMessage?: string) => {
    copyToClipboard(text);
    setCopiedId(id);
    const msg = notifyMessage || 'Copied to clipboard';
    postToPlugin({ type: 'NOTIFY', message: msg });
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      setCopiedId(null);
    }, 2000);
  };

  const [migrationTokenIds, setMigrationTokenIds] = useState<string[]>([]);
  const [returnScreen, setReturnScreen] = useState<Screen>('explorer');

  return (
    <div className="w-screen h-screen bg-[#0D0D0E] text-white overflow-hidden relative">
      {viewingRecord ? (
        <MigrationResultsScreen
          sourceCollectionName={viewingRecord.sourceCollectionName}
          destinationCollectionName={viewingRecord.destinationCollectionName}
          results={
            viewingRecord.results && viewingRecord.results.length > 0
              ? viewingRecord.results
              : viewingRecord.errorMessage
              ? [
                  {
                    id: 'err-history',
                    name: 'Migration Error',
                    leafName: 'Error',
                    groupPath: 'Figma API',
                    resolvedType: 'STRING',
                    status: 'FAILED',
                    detail: viewingRecord.errorMessage,
                    errorReason: viewingRecord.errorMessage,
                  },
                ]
              : []
          }
          isLoading={viewingRecord.status === 'IN_PROGRESS'}
          onBackToTokens={() => setViewingRecord(null)}
          onRetryFailed={
            viewingRecord.results?.some((r) => r.status === 'FAILED')
              ? () => {
                  const failedIds =
                    viewingRecord.results
                      ?.filter((r) => r.status === 'FAILED')
                      .map((r) => r.id) || [];
                  setViewingRecord(null);
                  setMigrationTokenIds(failedIds);
                  setReturnScreen('home');
                  setCurrentScreen('migration');
                }
              : undefined
          }
        />
      ) : (
        <>
          {currentScreen === 'home' && (
            <HomeScreen
              collections={collections}
              tokens={tokens}
              loading={loading}
              migrationHistory={migrationHistory}
              historyLoading={historyLoading}
              historyError={historyError}
              onExplore={() => setCurrentScreen('explorer')}
              onStartMigration={() => {
                setMigrationTokenIds([]);
                setReturnScreen('home');
                setCurrentScreen('migration');
              }}
              onSelectMigration={(record) => setViewingRecord(record)}
              onViewAllHistory={() => setCurrentScreen('activity')}
            />
          )}

          {currentScreen === 'activity' && (
            <MigrationHistoryScreen
              migrationHistory={migrationHistory}
              onBack={() => setCurrentScreen('home')}
              onSelectMigration={(record) => setViewingRecord(record)}
              onStartMigration={() => {
                setMigrationTokenIds([]);
                setReturnScreen('activity');
                setCurrentScreen('migration');
              }}
            />
          )}

          {currentScreen === 'explorer' && (
            <ExplorerScreen
              collections={collections}
              tokens={tokens}
              loading={loading}
              docName={docName}
              onBack={() => setCurrentScreen('home')}
              onRefresh={handleRefresh}
              onStartMigration={(ids) => {
                setMigrationTokenIds(ids);
                setReturnScreen('explorer');
                setCurrentScreen('migration');
              }}
              onCopy={handleCopy}
              copiedId={copiedId}
            />
          )}

          {currentScreen === 'migration' && (
            <MigrationScreen
              onBack={() => setCurrentScreen(returnScreen)}
              selectedTokenIds={migrationTokenIds}
              tokens={tokens}
              collections={collections}
              docName={docName}
              onNotify={(msg) => {
                setToastMessage(msg);
                if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                toastTimerRef.current = setTimeout(() => setToastMessage(null), 2500);
              }}
            />
          )}
        </>
      )}

      {/* Floating minimal toast */}
      {toastMessage && (
        <div
          style={{ zIndex: 999999 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#202023] border border-[#3A3A3D] text-white text-[12px] font-medium px-4 py-2 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.8)] pointer-events-none select-none transition-all duration-150"
        >
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Interactive corner resize handle */}
      <ResizeHandle />
    </div>
  );
};
