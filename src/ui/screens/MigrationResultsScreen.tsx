import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  X,
  ChevronDown,
  ListFilter,
  Layers,
  Code2,
} from 'lucide-react';
import { BackButton } from '../components/BackButton';
import type { TokenResolvedType } from '../../shared/messages';

export type MigrationOutcomeStatus = 'SUCCESSFUL' | 'UPDATED' | 'SKIPPED' | 'FAILED';

export interface MigrationTokenResult {
  id: string;
  name: string;
  leafName: string;
  groupPath: string;
  resolvedType: TokenResolvedType;
  status: MigrationOutcomeStatus;
  detail: string;
  sourceHex?: string;
  destHex?: string;
  sourceValue?: string;
  destValue?: string;
  errorReason?: string;
}

export interface MigrationResultsScreenProps {
  sourceCollectionName: string;
  destinationCollectionName: string;
  results: MigrationTokenResult[];
  isLoading?: boolean;
  onBackToTokens: () => void;
  onBackToPreview?: () => void;
  onRetryFailed?: () => void;
}

type FilterOption = 'ALL' | 'SUCCESSFUL' | 'UPDATED' | 'SKIPPED' | 'FAILED';

export const MigrationResultsScreen: React.FC<MigrationResultsScreenProps> = ({
  sourceCollectionName,
  destinationCollectionName,
  results,
  isLoading = false,
  onBackToTokens,
  onBackToPreview,
  onRetryFailed,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<FilterOption>('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  // Exact metric counts directly calculated from results
  const successfulCount = useMemo(
    () => results.filter((r) => r.status === 'SUCCESSFUL').length,
    [results]
  );
  const updatedCount = useMemo(
    () => results.filter((r) => r.status === 'UPDATED').length,
    [results]
  );
  const skippedCount = useMemo(
    () => results.filter((r) => r.status === 'SKIPPED').length,
    [results]
  );
  const failedCount = useMemo(
    () => results.filter((r) => r.status === 'FAILED').length,
    [results]
  );
  const totalCount = results.length;

  // Filtered list
  const filteredResults = useMemo(() => {
    return results.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesLeaf = item.leafName.toLowerCase().includes(q);
        const matchesGroup = item.groupPath.toLowerCase().includes(q);
        const matchesHex =
          (item.sourceHex && item.sourceHex.toLowerCase().includes(q)) ||
          (item.destHex && item.destHex.toLowerCase().includes(q));
        if (!matchesName && !matchesLeaf && !matchesGroup && !matchesHex) {
          return false;
        }
      }
      return true;
    });
  }, [results, statusFilter, searchQuery]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-[#0D0D0E] text-white select-none items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
        <h2 className="text-[18px] font-semibold text-white tracking-tight">
          Applying token migration...
        </h2>
        <p className="text-[13px] text-[#8E8E93] mt-1.5 max-w-xs leading-normal">
          Writing variable definitions and binding modes into {destinationCollectionName}.
        </p>
      </div>
    );
  }

  // Determine split prefix and leaf name for display
  const splitTokenName = (name: string) => {
    const clean = name.replace(/\\/g, '/');
    const slashIdx = clean.lastIndexOf('/');
    if (slashIdx !== -1) {
      return {
        prefix: clean.slice(0, slashIdx + 1),
        leaf: clean.slice(slashIdx + 1),
      };
    }
    const dotIdx = clean.lastIndexOf('.');
    if (dotIdx !== -1) {
      return {
        prefix: clean.slice(0, dotIdx + 1),
        leaf: clean.slice(dotIdx + 1),
      };
    }
    return {
      prefix: '',
      leaf: name,
    };
  };

  const getFilterLabel = (f: FilterOption) => {
    switch (f) {
      case 'SUCCESSFUL':
        return 'Created';
      case 'UPDATED':
        return 'Updated';
      case 'SKIPPED':
        return 'Skipped';
      case 'FAILED':
        return 'Failed';
      default:
        return 'All';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0D0D0E] text-white select-none overflow-hidden relative font-sans">
      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-4 pb-28">
        {/* Top Navigation */}
        <div className="flex items-center pb-2">
          <BackButton onClick={onBackToPreview || onBackToTokens} />
        </div>

        <h1 className="text-[20px] font-bold text-white tracking-tight leading-tight mt-1">
          Migration Results
        </h1>

        <p className="text-[13.5px] text-[#8E8E93] mt-2.5 font-normal leading-normal">
          Review the outcome of your token migration.
        </p>

        {/* 2. Collection Route Capsule / Pill Box */}
        <div className="mt-3.5 bg-[#141416] border border-[#222225] rounded-lg px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1 text-[13px] font-mono">
            <Layers className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
            <span className="text-white truncate">{sourceCollectionName}</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#71717A] shrink-0 mx-1" />
            <Code2 className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" />
            <span className="text-white truncate">{destinationCollectionName}</span>
          </div>
          <span className="text-[12px] text-[#71717A] font-mono shrink-0 ml-2">
            {totalCount} tokens
          </span>
        </div>

        {/* 3. Status Alert / Summary Banner */}
        <div className="mt-4 pt-1 flex items-center justify-between text-[13px]">
          <div className="flex items-center gap-2 min-w-0">
            {failedCount > 0 || skippedCount > 0 ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span className="font-medium text-white truncate">
              {failedCount > 0 || skippedCount > 0
                ? 'Migration completed with issues'
                : 'Migration completed successfully'}
            </span>
          </div>

          <div className="text-[12.5px] text-[#8E8E93] shrink-0 ml-2">
            {failedCount > 0 || skippedCount > 0 ? (
              <span>
                {skippedCount > 0 ? `${skippedCount} skipped` : ''}
                {skippedCount > 0 && failedCount > 0 ? ' · ' : ''}
                {failedCount > 0 ? `${failedCount} failed` : ''}
              </span>
            ) : (
              <span>
                {successfulCount} created
                {updatedCount > 0 ? ` · ${updatedCount} updated` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Subtle Horizontal Divider */}
        <div className="border-t border-[#1C1C1F] mt-3 mb-4" />

        {/* 4. Four Large Metric Numbers Grid */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {/* Created */}
          <div
            onClick={() => setStatusFilter((prev) => (prev === 'SUCCESSFUL' ? 'ALL' : 'SUCCESSFUL'))}
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="text-[24px] font-bold text-white leading-none">
              {successfulCount}
            </div>
            <div className="text-[12px] text-[#71717A] mt-1.5 font-normal">Created</div>
          </div>

          {/* Updated */}
          <div
            onClick={() => setStatusFilter((prev) => (prev === 'UPDATED' ? 'ALL' : 'UPDATED'))}
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="text-[24px] font-bold text-white leading-none">
              {updatedCount}
            </div>
            <div className="text-[12px] text-[#71717A] mt-1.5 font-normal">Updated</div>
          </div>

          {/* Skipped */}
          <div
            onClick={() => setStatusFilter((prev) => (prev === 'SKIPPED' ? 'ALL' : 'SKIPPED'))}
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="text-[24px] font-bold text-white leading-none">
              {skippedCount}
            </div>
            <div className="text-[12px] text-[#71717A] mt-1.5 font-normal">Skipped</div>
          </div>

          {/* Failed */}
          <div
            onClick={() => setStatusFilter((prev) => (prev === 'FAILED' ? 'ALL' : 'FAILED'))}
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="text-[24px] font-bold text-white leading-none">
              {failedCount}
            </div>
            <div className="text-[12px] text-[#71717A] mt-1.5 font-normal">Failed</div>
          </div>
        </div>

        {/* 5. Results Section Header & Filter Controls */}
        <div className="mt-5 flex items-center justify-between">
          <span className="text-[14px] font-semibold text-white">Results</span>
          <span className="text-[12px] text-[#71717A] font-mono">{filteredResults.length} tokens</span>
        </div>

        {/* Search & Filter Row */}
        <div className="mt-2.5 flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tokens"
              className="w-full h-9 bg-[#121214] border border-[#242427] focus:border-[#38383B] rounded-lg pl-8.5 pr-7 text-[12.5px] text-white placeholder:text-[#52525B] focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdown */}
          <div ref={filterDropdownRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="h-9 bg-[#121214] border border-[#242427] hover:border-[#38383B] rounded-lg px-3 flex items-center gap-2 text-[12.5px] text-white cursor-pointer transition-colors"
            >
              <ListFilter className="w-3.5 h-3.5 text-[#8E8E93]" />
              <span>{getFilterLabel(statusFilter)}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#71717A]" />
            </button>

            {isFilterOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-36 bg-[#18181B] border border-[#2E2E34] rounded-lg shadow-[0_12px_32px_rgba(0,0,0,0.85)] py-1 z-30">
                {(['ALL', 'SUCCESSFUL', 'UPDATED', 'SKIPPED', 'FAILED'] as FilterOption[]).map(
                  (f) => {
                    const isSelected = statusFilter === f;
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => {
                          setStatusFilter(f);
                          setIsFilterOpen(false);
                        }}
                        className={`w-full px-3 py-1.5 text-left text-[12px] flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer ${
                          isSelected ? 'text-white font-medium bg-white/5' : 'text-[#A1A1AA]'
                        }`}
                      >
                        <span>{getFilterLabel(f)}</span>
                        {f === 'FAILED' && failedCount > 0 && (
                          <span className="text-[10px] text-red-400 font-bold bg-red-500/15 px-1.5 py-0.2 rounded-full">
                            {failedCount}
                          </span>
                        )}
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </div>

        {/* 6. Results List (Dense Rows) */}
        <div className="mt-3 divide-y divide-[#18181C] border-t border-b border-[#18181C]">
          {filteredResults.length > 0 ? (
            filteredResults.map((item) => {
              const { prefix, leaf } = splitTokenName(item.name);
              return (
                <div
                  key={item.id}
                  title={`${item.name}\n${item.detail}`}
                  className="py-2.5 px-1 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Left: Swatch + Token Name */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className="w-3 h-3 rounded-[2px] shrink-0 border border-white/10"
                      style={{ backgroundColor: item.sourceHex || item.destHex || '#3B82F6' }}
                    />
                    <div className="truncate font-mono text-[13px] leading-tight flex items-baseline">
                      {prefix && <span className="text-[#71717A] truncate">{prefix}</span>}
                      <span className="text-white font-semibold">{leaf}</span>
                    </div>
                  </div>

                  {/* Right: Status Badge */}
                  <div className="shrink-0">
                    {item.status === 'SUCCESSFUL' && (
                      <span className="inline-block bg-[#062419] border border-[#0A3D29] text-[#22C55E] text-[11px] font-medium px-2.5 py-0.5 rounded-md leading-none">
                        Created
                      </span>
                    )}
                    {item.status === 'UPDATED' && (
                      <span className="inline-block bg-[#0B1E3B] border border-[#143261] text-[#3B82F6] text-[11px] font-medium px-2.5 py-0.5 rounded-md leading-none">
                        Updated
                      </span>
                    )}
                    {item.status === 'SKIPPED' && (
                      <span className="inline-block bg-[#2E1B07] border border-[#4D2D0C] text-[#F59E0B] text-[11px] font-medium px-2.5 py-0.5 rounded-md leading-none">
                        Skipped
                      </span>
                    )}
                    {item.status === 'FAILED' && (
                      <span className="inline-block bg-[#331114] border border-[#541C21] text-[#EF4444] text-[11px] font-medium px-2.5 py-0.5 rounded-md leading-none">
                        Failed
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-[12.5px] text-[#71717A]">
              No tokens match the selected filter.
            </div>
          )}
        </div>
      </div>

      {/* 7. Bottom Fixed Action Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#0D0D0E]/95 backdrop-blur-md border-t border-[#1C1C1F] px-4 py-3 flex items-center gap-3 z-20">
        <button
          type="button"
          onClick={onBackToTokens}
          className="bg-white hover:bg-neutral-200 text-black font-semibold text-[13.5px] h-10 px-4 rounded-lg flex-1 flex items-center justify-center transition-colors cursor-pointer shadow-sm active:scale-[0.99]"
        >
          Back to Tokens
        </button>

        {failedCount > 0 && (
          <button
            type="button"
            onClick={() => setStatusFilter('FAILED')}
            className="bg-[#141416] hover:bg-[#1A1A1D] border border-[#27272A] hover:border-[#38383B] text-white font-medium text-[13px] h-10 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <span>View Failed Items</span>
            <span className="bg-[#3B1519] border border-[#5C2128] text-[#F87171] text-[11px] font-bold px-1.5 py-0.2 rounded-full">
              {failedCount}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
