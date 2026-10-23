import React, { useState, useMemo } from 'react';
import {
  ArrowRight,
  History,
  ChevronRight,
  Search,
  X,
} from 'lucide-react';
import type { MigrationRecord } from '../../shared/messages';
import { BackButton } from '../components/BackButton';
import {
  formatActivityTime,
  getActivitySummary,
  renderStatusBadge,
} from './HomeScreen';

export interface MigrationHistoryScreenProps {
  migrationHistory: MigrationRecord[];
  onBack: () => void;
  onSelectMigration: (record: MigrationRecord) => void;
  onStartMigration: () => void;
}

export const MigrationHistoryScreen: React.FC<MigrationHistoryScreenProps> = ({
  migrationHistory,
  onBack,
  onSelectMigration,
  onStartMigration,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');

  const sortedHistory = useMemo(() => {
    return [...migrationHistory].sort((a, b) => {
      const timeA = a.completedAt || a.startedAt;
      const timeB = b.completedAt || b.startedAt;
      return timeB - timeA;
    });
  }, [migrationHistory]);

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return sortedHistory;
    const q = searchQuery.toLowerCase();
    return sortedHistory.filter((item) => {
      const src = item.sourceCollectionName.toLowerCase();
      const dst = item.destinationCollectionName.toLowerCase();
      const status = item.status.toLowerCase();
      return src.includes(q) || dst.includes(q) || status.includes(q);
    });
  }, [sortedHistory, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-[#0D0D0E] text-white select-none px-4 sm:px-6 py-5 sm:py-6 overflow-y-auto custom-scrollbar font-sans">
      <div className="w-full max-w-2xl mx-auto flex flex-col flex-1">
        {/* Top Back Navigation */}
        <div className="flex items-center pb-2">
          <BackButton onClick={onBack} label="Back to Home" />
        </div>

        {/* Title and Subtitle */}
        <div className="mt-2 mb-5">
          <h1 className="text-[22px] font-bold text-white tracking-tight leading-tight mt-1.5">
            Migration history
          </h1>
          <p className="text-[13px] text-neutral-400 mt-1 leading-normal">
            View all past token migrations and their execution outcomes.
          </p>
        </div>

        {/* Search Bar if history is not empty */}
        {sortedHistory.length > 0 && (
          <div className="relative mb-4">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search past migrations..."
              className="w-full h-9 bg-[#121214] border border-[#242427] focus:border-[#38383B] rounded-xl pl-8.5 pr-8 text-[12.5px] text-white placeholder:text-[#52525B] focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Content List */}
        {sortedHistory.length === 0 ? (
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-[#18181A] border border-neutral-800/80 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#1C1C1F] border border-neutral-800/80 flex items-center justify-center shrink-0 text-neutral-400 shadow-sm">
              <History className="w-4 h-4 text-neutral-400 stroke-[1.8]" />
            </div>
            <div className="pt-0.5 flex-1 min-w-0">
              <h3 className="text-[14px] font-medium text-neutral-200">
                No past migrations
              </h3>
              <p className="text-[12px] text-neutral-400 mt-0.5 leading-relaxed">
                Your past migrations will appear here once executed.
              </p>
              <button
                type="button"
                onClick={onStartMigration}
                className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-white hover:text-neutral-200 transition-colors cursor-pointer group"
              >
                <span>Start a migration</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform stroke-[2]" />
              </button>
            </div>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-neutral-500">
            No migrations found matching &ldquo;{searchQuery}&rdquo;.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 pb-6">
            <div className="flex items-center justify-between text-[12px] text-neutral-500 mb-0.5 px-0.5">
              <span>{filteredHistory.length} {filteredHistory.length === 1 ? 'migration' : 'migrations'}</span>
            </div>

            {filteredHistory.map((activity) => {
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
  );
};
