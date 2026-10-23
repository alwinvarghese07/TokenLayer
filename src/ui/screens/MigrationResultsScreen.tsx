import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  ListFilter,
  Layers,
  Code2,
  AlertCircle,
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

  // Auto-expand any tokens that were skipped or failed so their explanations are immediately accessible
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    results.forEach((item) => {
      if (item.status === 'SKIPPED' || item.status === 'FAILED') {
        initial.add(item.id);
      }
    });
    return initial;
  });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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

  const formatSkipReason = (detail?: string) => {
    if (!detail) return 'Variable already exists in destination';
    return detail.replace(/^Skipped(\s*[·:]\s*)?/i, '');
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

        <div className="mt-2">
          <h1 className="text-[22px] font-semibold text-white tracking-tight leading-tight mt-1.5">
            Migration Results
          </h1>
          <p className="text-[13px] font-normal text-[#8E8E93] mt-0.5 leading-normal">
            Review the outcome of your token migration.
          </p>
        </div>

        {/* 2. Collection Route Capsule / Pill Box */}
        <div className="mt-3.5 bg-[#121214] border border-[#4a4a4a] rounded-lg px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1 text-[13px] font-mono">
            <Layers className="w-3.5 h-3.5 text-[#d4d4d8] shrink-0" />
            <span className="text-white truncate">{sourceCollectionName}</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#d4d4d8] shrink-0 mx-1" />
            <Code2 className="w-3.5 h-3.5 text-[#d4d4d8] shrink-0" />
            <span className="text-white truncate">{destinationCollectionName}</span>
          </div>
          <span className="text-[12px] text-[#d4d4d8] font-mono shrink-0 ml-2">
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
                        className={`w-full px-3 py-1.5 text-left text-[12px] flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer ${isSelected ? 'text-white font-medium bg-white/5' : 'text-[#A1A1AA]'
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
              const isExpanded = expandedIds.has(item.id);
              const hasReason = Boolean(item.detail || item.errorReason);

              return (
                <div key={item.id} className="transition-colors">
                  {/* Row Header - Click to toggle expansion */}
                  <div
                    onClick={() => toggleExpand(item.id)}
                    className="py-2 px-1.5 flex items-center justify-between gap-3 hover:bg-white/[0.04] transition-colors cursor-pointer select-none rounded-md"
                  >
                    {/* Left: Expand Chevron + Swatch + Token Name & Subtitle */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <ChevronRight
                        className={`w-3.5 h-3.5 text-[#ffffff] shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90 text-white' : ''
                          }`}
                      />
                      <div
                        className="w-3 h-3 rounded-[2px] shrink-0 border border-white/10"
                        style={{ backgroundColor: item.sourceHex || item.destHex || '#3B82F6' }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-[13px] leading-tight flex items-baseline pb-1">
                          {prefix && <span className="text-[#ffffff] truncate">{prefix}</span>}
                          <span className="text-white font-semibold">{leaf}</span>
                        </div>
                        {/* Subtitle preview when collapsed */}
                        {!isExpanded && hasReason && (
                          <div className="text-[11px] text-[#ffffff] truncate font-sans mt-0.5">
                            {item.status === 'SKIPPED'
                              ? `Skipped · ${formatSkipReason(item.detail)}`
                              : item.status === 'FAILED'
                                ? (item.errorReason || item.detail)
                                : item.detail}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Status Badge */}
                    <div className="shrink-0 flex items-center gap-2">
                      {(item.status === 'SUCCESSFUL' || (item.status as string) === 'COMPLETED') && (
                        <span className="inline-block bg-[#16A34A] text-white text-[11px] font-medium px-2 py-1 rounded-md leading-none shadow-xs">
                          {(item.status as string) === 'COMPLETED' ? 'Completed' : 'Created'}
                        </span>
                      )}
                      {item.status === 'UPDATED' && (
                        <span className="inline-block bg-[#2563EB] text-white text-[11px] font-medium px-2 py-1 rounded-md leading-none shadow-xs">
                          Updated
                        </span>
                      )}
                      {item.status === 'SKIPPED' && (
                        <span className="inline-block bg-[#D97706] text-white text-[11px] font-medium px-2 py-1 rounded-md leading-none shadow-xs">
                          Skipped
                        </span>
                      )}
                      {item.status === 'FAILED' && (
                        <span className="inline-block bg-[#DC2626] text-white text-[11px] font-medium px-2 py-1 rounded-md leading-none shadow-xs">
                          Failed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded Inspection Drawer */}
                  {isExpanded && (
                    <div className="mx-1 mb-2.5 mt-0.5 bg-[#121214] border border-[#4a4a4a] rounded-lg p-3 space-y-2.5">
                      {/* Skipped Reason Line */}
                      {item.status === 'SKIPPED' && (
                        <div className="text-[12px] text-[#e4e4e7] leading-normal font-sans py-0.5">
                          Skipped · {formatSkipReason(item.detail)}
                        </div>
                      )}

                      {item.status === 'FAILED' && (
                        <div className="bg-red-950/30 border border-red-500/35 rounded-md p-2.5 flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-red-300 font-semibold text-[11px] uppercase tracking-wider">
                              Failure Details
                            </div>
                            <div className="text-[#E4E4E7] text-[12px] leading-relaxed mt-0.5 font-sans">
                              {item.errorReason || item.detail || 'An unexpected error occurred while writing this variable to Figma.'}
                            </div>
                          </div>
                        </div>
                      )}

                      {(item.status === 'SUCCESSFUL' || item.status === 'UPDATED') && (
                        <div className="bg-[#121214] border border-[#4a4a4a] rounded-md p-2 flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <div className="text-[#d4d4d8] text-[12px] leading-relaxed font-sans">
                            {item.detail || (item.status === 'SUCCESSFUL' ? 'Successfully created in destination' : 'Successfully updated in destination')}
                          </div>
                        </div>
                      )}

                      {/* Side-by-side Source vs Destination Inspection */}
                      <div className="grid grid-cols-2 gap-2 text-[11.5px] font-mono">
                        {/* Source Side */}
                        <div className="bg-[#121214] border border-[#4a4a4a] rounded-md p-2">
                          <div className="text-[12px] text-[#a9a9a9] font-sans font-medium mb-1">
                            Source ({sourceCollectionName})
                          </div>
                          <div className="flex items-center gap-1.5 text-white">
                            {item.sourceHex && (
                              <div
                                className="w-2.5 h-2.5 rounded-[2px] border border-white/20 shrink-0"
                                style={{ backgroundColor: item.sourceHex }}
                              />
                            )}
                            <span className="truncate text-[14px]">{item.sourceValue || item.sourceHex || '—'}</span>
                          </div>
                        </div>

                        {/* Destination Side */}
                        <div className="bg-[#121214] border border-[#4a4a4a] rounded-md p-2">
                          <div className="text-[12px] text-[#a9a9a9] font-sans font-medium mb-1">
                            Destination ({destinationCollectionName})
                          </div>
                          <div className="flex items-center gap-1.5 text-white">
                            {(item.destHex || (item.status === 'SUCCESSFUL' && item.sourceHex)) && (
                              <div
                                className="w-2.5 h-2.5 rounded-[2px] border border-white/20 shrink-0"
                                style={{
                                  backgroundColor: item.destHex || (item.status === 'SUCCESSFUL' ? item.sourceHex : undefined),
                                }}
                              />
                            )}
                            <span className="truncate text-[14px]">
                              {item.destValue || item.destHex || (item.status === 'SUCCESSFUL' ? (item.sourceValue || item.sourceHex) : '—')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Technical Meta (Variable Path & Resolved Type) */}
                      <div className="flex items-center justify-between text-[11px] text-[#71717A] px-1 font-mono">
                        <span className="truncate max-w-[70%]" title={item.name}>Path: {item.name}</span>
                        <span>Type: {item.resolvedType}</span>
                      </div>
                    </div>
                  )}
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

        {failedCount > 0 && onRetryFailed && (
          <button
            type="button"
            onClick={onRetryFailed}
            className="bg-[#2E1114] hover:bg-[#3D171B] border border-[#541C21] text-[#F87171] font-medium text-[13px] h-10 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <span>Retry Failed</span>
            <span className="bg-[#5C2128] text-white text-[11px] font-bold px-1.5 py-0.2 rounded-full">
              {failedCount}
            </span>
          </button>
        )}

        {failedCount > 0 && !onRetryFailed && (
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
