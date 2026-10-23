import React, { useMemo } from 'react';
import {
  Folder,
  SlidersHorizontal,
  ArrowRight,
  History,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import type { TokenCollection, TokenItem, MigrationRecord, MigrationStatus } from '../../shared/messages';

interface HomeScreenProps {
  collections: TokenCollection[];
  tokens: TokenItem[];
  loading: boolean;
  migrationHistory: MigrationRecord[];
  historyLoading?: boolean;
  historyError?: string | null;
  onExplore: () => void;
  onStartMigration: () => void;
  onSelectMigration: (record: MigrationRecord) => void;
  onViewAllHistory?: () => void;
}

export function formatActivityTime(timestamp: number): string {
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;

  const date = new Date(timestamp);
  const isToday = new Date().toDateString() === date.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `Today, ${timeStr}`;

  const isThisYear = new Date().getFullYear() === date.getFullYear();
  const monthDay = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  if (isThisYear) return `${monthDay}, ${timeStr}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}, ${timeStr}`;
}

export function getActivitySummary(record: MigrationRecord): string | null {
  if (record.status === 'IN_PROGRESS') {
    return record.summary?.total
      ? `Migrating ${record.summary.total} variable${record.summary.total === 1 ? '' : 's'}...`
      : 'Migration in progress...';
  }

  if (record.summary) {
    const { successful, updated, failed } = record.summary;
    const migrated = successful + updated;
    if (failed > 0 && migrated > 0) {
      return `${migrated} migrated · ${failed} failed`;
    }
    if (failed > 0 && migrated === 0) {
      return `${failed} failed`;
    }
    if (migrated > 0) {
      return `${migrated} variable${migrated === 1 ? '' : 's'} migrated`;
    }
    if (record.status === 'FAILED') {
      return record.errorMessage || 'Migration failed';
    }
    return `${record.summary.total} variable${record.summary.total === 1 ? '' : 's'} processed`;
  }

  if (record.errorMessage) {
    return record.errorMessage;
  }

  return null;
}

export function renderStatusBadge(status: MigrationStatus) {
  switch (status) {
    case 'COMPLETED':
      return null;
    case 'IN_PROGRESS':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#2563EB] text-white shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          In progress
        </span>
      );
    case 'NEEDS_ATTENTION':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#D97706] text-white shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          Needs attention
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#DC2626] text-white shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          Failed
        </span>
      );
  }
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  collections,
  tokens,
  loading,
  migrationHistory,
  historyLoading: _historyLoading = false,
  historyError = null,
  onExplore,
  onStartMigration,
  onSelectMigration,
  onViewAllHistory,
}) => {
  const collectionCount = collections.length;
  const variableCount = tokens.length;
  const modeCount = collections.reduce((acc, col) => acc + col.modes.length, 0);

  // Display latest up to 3 activities at home, newest first
  const recentActivities = useMemo(() => {
    return [...migrationHistory]
      .sort((a, b) => {
        const timeA = a.completedAt || a.startedAt;
        const timeB = b.completedAt || b.startedAt;
        return timeB - timeA;
      })
      .slice(0, 3);
  }, [migrationHistory]);

  return (
    <div className="flex flex-col h-full bg-[#0D0D0E] text-white select-none px-4 sm:px-6 py-5 sm:py-6 overflow-y-auto custom-scrollbar font-sans">
      <div className="w-full max-w-2xl mx-auto flex flex-col flex-1">
        {/* Title & Subtitle */}
        <div className="mb-6">
          <h1 className="text-[22px] font-bold text-white tracking-tight leading-tight">
            Your design tokens
          </h1>
          <p className="text-[13px] text-neutral-400 mt-1.5 leading-normal">
            Explore variables and plan safe migrations.
          </p>
        </div>

        {/* Token Summary Section */}
        <div className="mb-6">
          <h2 className="text-[13px] font-medium text-neutral-400 mb-2.5">
            Token summary
          </h2>

          <div className="bg-[#18181A] border border-neutral-800/80 rounded-2xl overflow-hidden divide-y divide-neutral-800/80 shadow-sm">
            {/* Collections Row */}
            <div className="px-4 py-3.5 flex items-center justify-between text-[14px]">
              <div className="flex items-center gap-3 text-neutral-300">
                <Folder className="w-4 h-4 text-neutral-400 stroke-[1.8]" />
                <span className="font-normal">Collections</span>
              </div>
              <span className="font-semibold text-white text-[15px]">
                {loading ? '—' : collectionCount}
              </span>
            </div>

            {/* Variables Row */}
            <div className="px-4 py-3.5 flex items-center justify-between text-[14px]">
              <div className="flex items-center gap-3 text-neutral-300">
                {/* (x) Variable icon */}
                <svg
                  className="w-4 h-4 text-neutral-400 stroke-[1.8]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 4a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3" />
                  <path d="M7 20a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3" />
                  <path d="m10 9 4 6" />
                  <path d="m14 9-4 6" />
                </svg>
                <span className="font-normal">Variables</span>
              </div>
              <span className="font-semibold text-white text-[15px]">
                {loading ? '—' : variableCount}
              </span>
            </div>

            {/* Modes Row */}
            <div className="px-4 py-3.5 flex items-center justify-between text-[14px]">
              <div className="flex items-center gap-3 text-neutral-300">
                <SlidersHorizontal className="w-4 h-4 text-neutral-400 stroke-[1.8]" />
                <span className="font-normal">Modes</span>
              </div>
              <span className="font-semibold text-white text-[15px]">
                {loading ? '—' : modeCount}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Responsive 1 or 2 column */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <button
            onClick={onExplore}
            className="w-full bg-white hover:bg-neutral-200 text-black font-semibold text-[14px] py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm active:scale-[0.99]"
          >
            <span>Explore tokens</span>
            <ArrowRight className="w-4 h-4 stroke-[2.2]" />
          </button>

          <button
            onClick={onStartMigration}
            className="w-full bg-[#18181A] hover:bg-[#222226] border border-neutral-800 text-white font-medium text-[14px] py-3.5 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-colors cursor-pointer active:scale-[0.99]"
          >
            {/* Branch / Migration icon */}
            <svg
              className="w-4 h-4 text-neutral-400 stroke-[1.8]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="6" cy="6" r="2.5" />
              <circle cx="18" cy="18" r="2.5" />
              <path d="M6 8.5v7a2.5 2.5 0 0 0 2.5 2.5H15.5" />
              <path d="M18 15.5v-7A2.5 2.5 0 0 0 15.5 6H8.5" />
            </svg>
            <span>Start migration</span>
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-neutral-850/80 mb-6 border-[#242428]" />

        {/* Recent Activity Section */}
        <div>
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-[13px] font-medium text-neutral-400">
              Recent activity
            </h2>
            {migrationHistory.length > 3 && onViewAllHistory && (
              <button
                type="button"
                onClick={onViewAllHistory}
                className="text-[12px] font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1 group select-none"
              >
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white transition-colors" />
              </button>
            )}
          </div>

          {historyError ? (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div className="text-[12px] leading-relaxed">
                <span className="font-medium">Could not load migration history.</span>
                <p className="text-amber-400/80 mt-0.5">
                  Previous activity could not be loaded, but you can still run new migrations.
                </p>
              </div>
            </div>
          ) : recentActivities.length === 0 ? (
            <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-[#18181A] border border-neutral-800/80 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#1C1C1F] border border-neutral-800/80 flex items-center justify-center shrink-0 text-neutral-400 shadow-sm">
                <History className="w-4 h-4 text-neutral-400 stroke-[1.8]" />
              </div>
              <div className="pt-0.5 flex-1 min-w-0">
                <h3 className="text-[14px] font-medium text-neutral-200">
                  No migrations yet
                </h3>
                <p className="text-[12px] text-neutral-400 mt-0.5 leading-relaxed">
                  Your migrations will appear here once you get started.
                </p>
                <button
                  type="button"
                  onClick={onStartMigration}
                  className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-white hover:text-neutral-200 transition-colors cursor-pointer group"
                >
                  <span>Start your first migration</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform stroke-[2]" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {recentActivities.map((activity) => {
                const summaryText = getActivitySummary(activity);
                const timeText = formatActivityTime(activity.completedAt || activity.startedAt);

                return (
                  <button
                    key={activity.id}
                    type="button"
                    onClick={() => onSelectMigration(activity)}
                    className="w-full text-left bg-[#18181A] hover:bg-[#202024] border border-neutral-800/80 hover:border-neutral-700/80 rounded-2xl p-4 transition-all duration-150 cursor-pointer group flex items-center justify-between gap-3 shadow-sm active:scale-[0.99]"
                  >
                    <div className="min-w-0 flex-1">
                      {/* Source -> Destination label */}
                      <div className="flex items-center gap-1.5 text-[14px] font-medium text-white tracking-tight">
                        <span className="truncate max-w-[140px] sm:max-w-[200px]">
                          {activity.sourceCollectionName}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-neutral-500 shrink-0 mx-0.5 stroke-[1.8]" />
                        <span className="truncate max-w-[140px] sm:max-w-[200px] text-neutral-200">
                          {activity.destinationCollectionName}
                        </span>
                      </div>

                      {/* Completion date/time & concise summary */}
                      <div className="flex items-center gap-2 mt-1.5 text-[12px] text-neutral-400 flex-wrap">
                        <span>{timeText}</span>
                        {summaryText && (
                          <>
                            <span className="text-neutral-600">•</span>
                            <span className="text-neutral-300 font-normal">{summaryText}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Status badge & Chevron */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      {renderStatusBadge(activity.status)}
                      <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
