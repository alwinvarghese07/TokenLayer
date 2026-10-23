import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Palette,
  Hash,
  Type as TypeIcon,
  ToggleLeft,
  X,
  ArrowRight,
  Check,
  List,
  LayoutGrid,
  Copy,
} from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { TokenDetailsScreen } from './TokenDetailsScreen';
import type {
  TokenCollection,
  TokenItem,
  TokenModeValue,
  TokenResolvedType,
} from '../../shared/messages';
import { formatHexColor } from '../utils/color';
import {
  buildTokenTree,
  getVariantName,
  parseTokenPath,
  type TokenTreeNode,
} from '../utils/tokenTree';

interface ExplorerScreenProps {
  collections: TokenCollection[];
  tokens: TokenItem[];
  loading: boolean;
  docName: string;
  onBack: () => void;
  onRefresh?: () => void;
  onStartMigration: (selectedIds: string[]) => void;
  onCopy: (text: string, id: string, notifyMessage?: string) => void;
  copiedId: string | null;
}

interface CollectionSubgroup {
  collectionId: string;
  collectionName: string;
  treeNodes: TokenTreeNode[];
  tokens: TokenItem[];
}

interface TokenGroup {
  id: string;
  name: string;
  type: TokenResolvedType | 'MIXED';
  totalTokensCount: number;
  collectionSubgroups: CollectionSubgroup[];
}

export const ExplorerScreen: React.FC<ExplorerScreenProps> = ({
  collections,
  tokens,
  loading,
  onBack,
  onStartMigration,
  onCopy,
  copiedId,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Default to 'ALL' collections
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('ALL');

  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedModeId, setSelectedModeId] = useState<string>('ALL');
  const [selectedTokenIds, setSelectedTokenIds] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [collapsedSubgroups, setCollapsedSubgroups] = useState<Set<string>>(new Set());
  const [inspectedToken, setInspectedToken] = useState<TokenItem | null>(null);
  const [openDropdown, setOpenDropdown] = useState<'collection' | 'type' | 'mode' | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'swatch'>('list');
  const [hoveredSwatch, setHoveredSwatch] = useState<{
    token: TokenItem;
    hex: string;
    rect: DOMRect;
  } | null>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openDropdown]);

  // Available modes across all collections or selected collection
  const availableModes = useMemo(() => {
    const map = new Map<string, string>();
    const targetCols =
      selectedCollectionId === 'ALL'
        ? collections
        : collections.filter((c) => c.id === selectedCollectionId);

    targetCols.forEach((col) => {
      col.modes.forEach((m) => {
        if (!map.has(m.name)) {
          map.set(m.name, m.modeId);
        }
      });
    });
    return Array.from(map.entries()).map(([name, modeId]) => ({ name, modeId }));
  }, [collections, selectedCollectionId]);

  // Filtered tokens
  const filteredTokens = useMemo(() => {
    return tokens.filter((token) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        token.name.toLowerCase().includes(q) ||
        token.description.toLowerCase().includes(q) ||
        token.collectionName.toLowerCase().includes(q);

      const matchesCollection =
        selectedCollectionId === 'ALL' || token.collectionId === selectedCollectionId;

      const matchesType =
        selectedType === 'ALL' || token.resolvedType === selectedType;

      return matchesSearch && matchesCollection && matchesType;
    });
  }, [tokens, searchQuery, selectedCollectionId, selectedType]);

  // Group tokens cleanly:
  // - Show one parent group per variable-name prefix (e.g. Colors, Spacing, Fg).
  // - Inside each parent group, variables are separated into collectionSubgroups,
  //   each having its nested treeNodes representing the original group hierarchy.
  const groupedTokens: TokenGroup[] = useMemo(() => {
    const groupsMap = new Map<
      string,
      {
        id: string;
        name: string;
        type: TokenResolvedType | 'MIXED';
        collectionMap: Map<string, { collectionId: string; collectionName: string; tokens: TokenItem[] }>;
        totalTokensCount: number;
      }
    >();

    filteredTokens.forEach((token) => {
      const { categoryName, categoryId } = parseTokenPath(token);

      if (!groupsMap.has(categoryId)) {
        groupsMap.set(categoryId, {
          id: categoryId,
          name: categoryName,
          type: token.resolvedType,
          collectionMap: new Map(),
          totalTokensCount: 0,
        });
      }

      const grp = groupsMap.get(categoryId)!;
      grp.totalTokensCount += 1;

      const colId = token.collectionId || 'unknown';
      if (!grp.collectionMap.has(colId)) {
        grp.collectionMap.set(colId, {
          collectionId: colId,
          collectionName: token.collectionName || 'Default Collection',
          tokens: [],
        });
      }
      grp.collectionMap.get(colId)!.tokens.push(token);
    });

    const colOrderMap = new Map<string, number>();
    collections.forEach((col, idx) => colOrderMap.set(col.id, idx));

    const sortPriority: Record<string, number> = {
      colors: 1,
      spacing: 2,
      typography: 3,
      radius: 4,
      borders: 5,
      shadows: 6,
      booleans: 7,
    };

    return Array.from(groupsMap.values())
      .map((g) => {
        const sortedSubgroups: CollectionSubgroup[] = Array.from(g.collectionMap.values())
          .map((sub) => ({
            collectionId: sub.collectionId,
            collectionName: sub.collectionName,
            tokens: sub.tokens,
            treeNodes: buildTokenTree(sub.tokens),
          }))
          .sort((a, b) => {
            const orderA = colOrderMap.get(a.collectionId) ?? 99;
            const orderB = colOrderMap.get(b.collectionId) ?? 99;
            if (orderA !== orderB) return orderA - orderB;
            return a.collectionName.localeCompare(b.collectionName);
          });

        return {
          id: g.id,
          name: g.name,
          type: g.type,
          totalTokensCount: g.totalTokensCount,
          collectionSubgroups: sortedSubgroups,
        };
      })
      .sort((a, b) => {
        const rawCategoryA = a.name.toLowerCase();
        const rawCategoryB = b.name.toLowerCase();
        const prioA = sortPriority[rawCategoryA] || 99;
        const prioB = sortPriority[rawCategoryB] || 99;
        if (prioA !== prioB) return prioA - prioB;
        return a.name.localeCompare(b.name);
      });
  }, [filteredTokens, collections]);

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleSubgroupCollapse = (nodeId: string) => {
    setCollapsedSubgroups((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const toggleTokenSelection = (tokenId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTokenIds((prev) => {
      const next = new Set(prev);
      if (next.has(tokenId)) next.delete(tokenId);
      else next.add(tokenId);
      return next;
    });
  };

  const getActiveModeVal = (token: TokenItem): TokenModeValue | undefined => {
    const modeKeys = Object.keys(token.valuesByMode);
    const activeModeKey =
      selectedModeId !== 'ALL' && token.valuesByMode[selectedModeId]
        ? selectedModeId
        : modeKeys[0];
    return token.valuesByMode[activeModeKey];
  };

  const handleCopyHex = (token: TokenItem, modeVal?: TokenModeValue, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const hex = formatHexColor(modeVal) || modeVal?.colorHex || '';
    if (hex) {
      onCopy(hex, token.id, `Copied ${hex}`);
    }
  };

  const handleCopyValue = (token: TokenItem, val: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (val) {
      onCopy(val, token.id, `Copied ${val}`);
    }
  };

  const renderTokenRow = (token: TokenItem) => {
    const isSelected = selectedTokenIds.has(token.id);
    const modeVal = getActiveModeVal(token);
    const hexText = formatHexColor(modeVal) || modeVal?.colorHex;

    return (
      <div
        key={token.id}
        onClick={() => setInspectedToken(token)}
        title={token.name}
        className="px-2.5 py-1.5 flex items-center justify-between text-[13px] hover:bg-[#17171A] transition-colors cursor-pointer group"
      >
        {/* Checkbox and Token Name */}
        <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
          <button
            type="button"
            onClick={(e) => toggleTokenSelection(token.id, e)}
            aria-label={isSelected ? `Deselect ${token.name}` : `Select ${token.name}`}
            className={`w-3.5 h-3.5 rounded-[2px] border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${isSelected
                ? 'bg-white border-white text-black'
                : 'border-[#3A3A3C] bg-transparent hover:border-[#636366]'
              }`}
          >
            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
          </button>

          <span
            className="text-[14px] font-medium text-[#F4F4F5] truncate tracking-normal"
            title={token.name}
          >
            {getVariantName(token)}
          </span>
        </div>

        {/* Value Preview and Trailing Chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Color Preview: Hex text + Square color box */}
          {token.resolvedType === 'COLOR' && hexText && (
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-mono text-[#8E8E93]">
                {hexText}
              </span>
              <div
                className="w-3.5 h-3.5 rounded-[2px] shrink-0 border border-white/10"
                style={{
                  backgroundColor: modeVal?.colorRgba || hexText,
                }}
              />
            </div>
          )}

          {/* Number / Spacing Preview */}
          {token.resolvedType === 'FLOAT' && (
            <div className="flex items-center gap-1 text-[13px] font-normal text-[#8E8E93]">
              <Hash className="w-3.5 h-3.5 text-[#8E8E93] stroke-[1.8]" />
              <span>
                {modeVal?.formattedValue}
                {token.name.toLowerCase().includes('weight') ? '' : 'px'}
              </span>
            </div>
          )}

          {/* Typography / String Preview */}
          {token.resolvedType === 'STRING' && (
            <div className="flex items-center gap-1 text-[13px] font-normal text-[#8E8E93]">
              <TypeIcon className="w-3.5 h-3.5 text-[#8E8E93] stroke-[1.8]" />
              <span className="truncate max-w-[90px]">
                {modeVal?.formattedValue}
              </span>
            </div>
          )}

          {/* Boolean Preview */}
          {token.resolvedType === 'BOOLEAN' && (
            <span className="text-[13px] font-normal text-[#8E8E93]">
              {modeVal?.formattedValue}
            </span>
          )}

          <ChevronRight className="w-3.5 h-3.5 text-[#48484A] group-hover:text-[#8E8E93] transition-colors stroke-[1.8]" />
        </div>
      </div>
    );
  };

  const renderSwatchGroup = (groupTokens: TokenItem[]) => {
    const colorTokens = groupTokens.filter((t) => t.resolvedType === 'COLOR');
    const nonColorTokens = groupTokens.filter((t) => t.resolvedType !== 'COLOR');

    return (
      <div className="p-2 space-y-2">
        {/* COLOR Tokens: Compact Square Swatches */}
        {colorTokens.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(28px,1fr))] gap-1.5">
            {colorTokens.map((token) => {
              const isSelected = selectedTokenIds.has(token.id);
              const modeVal = getActiveModeVal(token);
              const hexVal = formatHexColor(modeVal) || modeVal?.colorHex || '#000000';
              const isCopied = copiedId === token.id;

              return (
                <div
                  key={token.id}
                  onClick={() => setInspectedToken(token)}
                  onMouseEnter={(e) => {
                    setHoveredSwatch({
                      token,
                      hex: hexVal,
                      rect: e.currentTarget.getBoundingClientRect(),
                    });
                  }}
                  onMouseLeave={() => setHoveredSwatch(null)}
                  aria-label={`${getVariantName(token)}: ${hexVal}`}
                  className={`relative aspect-square rounded-[4px] overflow-hidden border transition-all cursor-pointer group/swatch ${isSelected
                      ? 'border-white ring-1 ring-white/70 shadow-xs'
                      : 'border-[#262629] hover:border-white/50'
                    }`}
                >
                  {/* Checkerboard background for transparency */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `
                        linear-gradient(45deg, #1C1C1E 25%, transparent 25%),
                        linear-gradient(-45deg, #1C1C1E 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #1C1C1E 75%),
                        linear-gradient(-45deg, transparent 75%, #1C1C1E 75%)
                      `,
                      backgroundSize: '6px 6px',
                      backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px',
                      backgroundColor: '#121214',
                    }}
                  />

                  {/* Color Fill */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundColor: modeVal?.colorRgba || hexVal,
                    }}
                  />

                  {/* Selection Checkbox (top-left) */}
                  <button
                    type="button"
                    onClick={(e) => toggleTokenSelection(token.id, e)}
                    title={isSelected ? 'Deselect token' : 'Select token'}
                    aria-label={isSelected ? `Deselect ${token.name}` : `Select ${token.name}`}
                    className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-[1px] border flex items-center justify-center transition-all cursor-pointer ${isSelected
                        ? 'bg-white border-white text-black opacity-100 z-10'
                        : 'border-white/60 bg-black/60 opacity-0 group-hover/swatch:opacity-100 hover:border-white z-10'
                      }`}
                  >
                    {isSelected && <Check className="w-2 h-2 stroke-[3]" />}
                  </button>

                  {/* Quick Copy Action (bottom-right) */}
                  <button
                    type="button"
                    onClick={(e) => handleCopyHex(token, modeVal, e)}
                    title="Copy hex code"
                    aria-label={`Copy hex code for ${token.name}`}
                    className={`absolute bottom-0.5 right-0.5 p-0.5 rounded bg-black/75 hover:bg-black text-white/80 hover:text-white transition-all cursor-pointer z-10 ${isCopied
                        ? 'opacity-100'
                        : 'opacity-0 group-hover/swatch:opacity-100'
                      }`}
                  >
                    {isCopied ? (
                      <Check className="w-2 h-2 text-emerald-400 stroke-[2.5]" />
                    ) : (
                      <Copy className="w-2 h-2 stroke-[2]" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* NON-COLOR Tokens: Compact Representation (FLOAT, STRING, BOOLEAN) */}
        {nonColorTokens.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5">
            {nonColorTokens.map((token) => {
              const isSelected = selectedTokenIds.has(token.id);
              const modeVal = getActiveModeVal(token);
              const isCopied = copiedId === token.id;

              let displayVal = modeVal?.formattedValue || String(modeVal?.value ?? '');
              if (token.resolvedType === 'FLOAT' && !token.name.toLowerCase().includes('weight')) {
                displayVal = `${displayVal}px`;
              }

              return (
                <div
                  key={token.id}
                  onClick={() => setInspectedToken(token)}
                  title={`${token.name}\n${displayVal}\n${token.collectionName}`}
                  className={`relative flex items-center justify-between py-1.5 px-2 rounded-md border transition-all cursor-pointer group/tile min-h-[34px] ${isSelected
                      ? 'border-white/60 bg-[#1A1A1E]'
                      : 'border-[#222225] bg-[#141416] hover:border-[#3A3A3D] hover:bg-[#1A1A1D]'
                    }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => toggleTokenSelection(token.id, e)}
                      aria-label={isSelected ? `Deselect ${token.name}` : `Select ${token.name}`}
                      className={`w-3.5 h-3.5 rounded-[1px] border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${isSelected
                          ? 'bg-white border-white text-black'
                          : 'border-[#3A3A3C] bg-transparent hover:border-[#636366]'
                        }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </button>

                    {/* Token Info */}
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-[13px] font-medium text-white truncate leading-tight"
                        title={token.name}
                      >
                        {getVariantName(token)}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-[#8E8E93] truncate mt-0.5 leading-tight">
                        {token.resolvedType === 'FLOAT' && (
                          <Hash className="w-3 h-3 shrink-0 stroke-[1.8] text-[#8E8E93]" />
                        )}
                        {token.resolvedType === 'STRING' && (
                          <TypeIcon className="w-3 h-3 shrink-0 stroke-[1.8] text-[#8E8E93]" />
                        )}
                        {token.resolvedType === 'BOOLEAN' && (
                          <ToggleLeft className="w-3 h-3 shrink-0 stroke-[1.8] text-[#8E8E93]" />
                        )}
                        <span className="truncate">{displayVal}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick copy on hover */}
                  <button
                    type="button"
                    onClick={(e) => handleCopyValue(token, displayVal, e)}
                    title="Copy value"
                    aria-label={`Copy value for ${token.name}`}
                    className={`p-1 rounded hover:bg-white/10 text-[#8E8E93] hover:text-white transition-opacity shrink-0 cursor-pointer ${isCopied ? 'opacity-100' : 'opacity-0 group-hover/tile:opacity-100'
                      }`}
                  >
                    {isCopied ? (
                      <Check className="w-3 h-3 text-emerald-400 stroke-[2.5]" />
                    ) : (
                      <Copy className="w-3 h-3 stroke-[2]" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderTokenTreeNode = (node: TokenTreeNode): React.ReactNode => {
    // If it's a direct token container under root without a named subgroup
    if (node.id === '__direct__') {
      return (
        <div key={node.id}>
          {viewMode === 'list' ? (
            <div className="divide-y divide-[#1E1E22]">
              {node.directTokens.map((token) => renderTokenRow(token))}
            </div>
          ) : (
            renderSwatchGroup(node.directTokens)
          )}
        </div>
      );
    }

    const isCollapsed = collapsedSubgroups.has(node.id);

    return (
      <div key={node.id} className="transition-all">
        {/* Subgroup Header */}
        <div
          onClick={() => toggleSubgroupCollapse(node.id)}
          className={`px-2.5 py-1.5 flex items-center justify-between text-neutral-200 cursor-pointer transition-colors select-none ${node.depth === 0
              ? 'bg-[#151518] hover:bg-[#1A1A1E] border-t border-[#1E1E22] first:border-t-0'
              : 'bg-[#141417] hover:bg-[#19191D] rounded-[4px] border border-[#1E1E22]/80'
            }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#71717A] transition-transform duration-200 shrink-0 ${isCollapsed ? '-rotate-90' : 'rotate-0'
                }`}
            />
            <span className="text-[13px] font-semibold text-[#E4E4E7] tracking-tight truncate">
              {node.name}
            </span>
          </div>
          <span className="text-[11px] font-medium text-[#71717A] bg-[#1E1E22] px-1.5 py-0.5 rounded leading-none">
            {node.totalCount}
          </span>
        </div>

        {/* Subgroup Content */}
        {!isCollapsed && (
          <div className={node.depth >= 1 ? 'mt-0.5 mb-1' : ''}>
            {/* Direct tokens in this subgroup (e.g. variants 0, 50, 100...) */}
            {node.directTokens.length > 0 && (
              viewMode === 'list' ? (
                <div className="divide-y divide-[#1E1E22] border-t border-[#1E1E22]/50 my-1">
                  {node.directTokens.map((token) => renderTokenRow(token))}
                </div>
              ) : (
                <div className={node.depth >= 1 ? 'py-1' : 'pt-1'}>
                  {renderSwatchGroup(node.directTokens)}
                </div>
              )
            )}

            {/* Recursively render child groups */}
            {node.children.length > 0 && (
              <div
                className={
                  node.depth === 0
                    ? 'space-y-1.5 p-1.5'
                    : 'pl-2 ml-1 border-l border-[#5a5a5a] space-y-1 my-1'
                }
              >
                {node.children.map((childNode) => renderTokenTreeNode(childNode))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0D0D0E] text-white font-sans select-none overflow-hidden relative">
      {/* Top Navigation & Title */}
      <div className="px-4 pt-3.5 pb-2 shrink-0">
        <BackButton onClick={onBack} />

        <h1 className="text-[22px] font-semibold text-white tracking-tight leading-tight mt-1.5">
          Explore tokens
        </h1>
        <p className="text-[13px] font-normal text-[#8E8E93] mt-0.5 leading-normal">
          Browse and inspect your variables.
        </p>

        {/* Search Bar */}
        <div className="mt-2 relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717A]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tokens..."
            className="w-full h-[34px] bg-[#141416] border border-[#242427] rounded-md pl-8.5 pr-7 text-[13px] font-normal text-white placeholder:text-[#52525B] focus:outline-none focus:border-[#48484A] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 3 Dropdown Filters: Collection, Type, Mode */}
        <div ref={filterBarRef} className="grid grid-cols-3 gap-1.5 mt-2 relative z-30">
          {/* Collection Filter */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown((prev) => (prev === 'collection' ? null : 'collection'))}
              className={`w-full h-[34px] bg-[#141416] border rounded-md px-2.5 text-[13px] font-normal text-white flex items-center justify-between cursor-pointer transition-colors ${openDropdown === 'collection'
                ? 'border-[#48484A] bg-[#1A1A1E]'
                : selectedCollectionId !== 'ALL'
                  ? 'border-[#48484A]'
                  : 'border-[#242427] hover:border-[#3A3A3D]'
                }`}
            >
              <span className="truncate pr-1">
                {selectedCollectionId === 'ALL'
                  ? 'All collections'
                  : collections.find((c) => c.id === selectedCollectionId)?.name || 'Collection'}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#71717A] shrink-0 transition-transform duration-150 ${openDropdown === 'collection' ? 'rotate-180' : 'rotate-0'
                  }`}
              />
            </button>

            {openDropdown === 'collection' && (
              <div className="absolute top-[calc(100%+3px)] left-0 min-w-full w-max max-w-[210px] bg-[#141416] border border-[#242427] rounded-md shadow-2xl py-0.5 z-50 overflow-hidden">
                <div className="max-h-52 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCollectionId('ALL');
                      setOpenDropdown(null);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-[13.5px] font-normal transition-colors cursor-pointer ${selectedCollectionId === 'ALL'
                      ? 'bg-[#242424] text-white font-medium'
                      : 'text-[#C7C7CC] hover:bg-[#1E1E1E] hover:text-white'
                      }`}
                  >
                    All collections
                  </button>

                  {collections.map((col) => {
                    const isSelected = selectedCollectionId === col.id;
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => {
                          setSelectedCollectionId(col.id);
                          setOpenDropdown(null);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-[13.5px] font-normal transition-colors cursor-pointer truncate ${isSelected
                          ? 'bg-[#242424] text-white font-medium'
                          : 'text-[#C7C7CC] hover:bg-[#1E1E1E] hover:text-white'
                          }`}
                      >
                        {col.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Type Filter */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown((prev) => (prev === 'type' ? null : 'type'))}
              className={`w-full h-[34px] bg-[#141416] border rounded-md px-2.5 text-[13px] font-normal text-white flex items-center justify-between cursor-pointer transition-colors ${openDropdown === 'type'
                ? 'border-[#48484A] bg-[#1A1A1E]'
                : selectedType !== 'ALL'
                  ? 'border-[#48484A]'
                  : 'border-[#242427] hover:border-[#3A3A3D]'
                }`}
            >
              <span className="truncate pr-1">
                {selectedType === 'ALL'
                  ? 'Type'
                  : selectedType === 'COLOR'
                    ? 'Color'
                    : selectedType === 'FLOAT'
                      ? 'Number'
                      : selectedType === 'STRING'
                        ? 'String'
                        : selectedType === 'BOOLEAN'
                          ? 'Boolean'
                          : 'Type'}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#71717A] shrink-0 transition-transform duration-150 ${openDropdown === 'type' ? 'rotate-180' : 'rotate-0'
                  }`}
              />
            </button>

            {openDropdown === 'type' && (
              <div className="absolute top-[calc(100%+3px)] left-1/2 -translate-x-1/2 min-w-full w-max max-w-[190px] bg-[#141416] border border-[#242427] rounded-md shadow-2xl py-0.5 z-50 overflow-hidden">
                <div className="p-1 space-y-0.5">
                  {[
                    { id: 'ALL', label: 'All types' },
                    { id: 'COLOR', label: 'Color', icon: <Palette className="w-3.5 h-3.5 text-[#999999]" /> },
                    { id: 'FLOAT', label: 'Number', icon: <Hash className="w-3.5 h-3.5 text-[#999999]" /> },
                    { id: 'STRING', label: 'String', icon: <TypeIcon className="w-3.5 h-3.5 text-[#999999]" /> },
                    { id: 'BOOLEAN', label: 'Boolean', icon: <ToggleLeft className="w-3.5 h-3.5 text-[#999999]" /> },
                  ].map((item) => {
                    const isSelected = selectedType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedType(item.id);
                          setOpenDropdown(null);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-[13.5px] font-normal flex items-center gap-2 transition-colors cursor-pointer ${isSelected
                          ? 'bg-[#242424] text-white font-medium'
                          : 'text-[#C7C7CC] hover:bg-[#1E1E1E] hover:text-white'
                          }`}
                      >
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Mode Filter */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown((prev) => (prev === 'mode' ? null : 'mode'))}
              className={`w-full h-[34px] bg-[#141416] border rounded-md px-2.5 text-[13px] font-normal text-white flex items-center justify-between cursor-pointer transition-colors ${openDropdown === 'mode'
                ? 'border-[#48484A] bg-[#1A1A1E]'
                : selectedModeId !== 'ALL'
                  ? 'border-[#48484A]'
                  : 'border-[#242427] hover:border-[#3A3A3D]'
                }`}
            >
              <span className="truncate pr-1">
                {selectedModeId === 'ALL'
                  ? 'Mode'
                  : availableModes.find((m) => m.modeId === selectedModeId)?.name || 'Mode'}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#71717A] shrink-0 transition-transform duration-150 ${openDropdown === 'mode' ? 'rotate-180' : 'rotate-0'
                  }`}
              />
            </button>

            {openDropdown === 'mode' && (
              <div className="absolute top-[calc(100%+3px)] right-0 min-w-full w-max max-w-[200px] bg-[#141416] border border-[#242427] rounded-md shadow-2xl py-0.5 z-50 overflow-hidden">
                <div className="max-h-52 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedModeId('ALL');
                      setOpenDropdown(null);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-[13.5px] font-normal transition-colors cursor-pointer ${selectedModeId === 'ALL'
                      ? 'bg-[#242424] text-white font-medium'
                      : 'text-[#C7C7CC] hover:bg-[#1E1E1E] hover:text-white'
                      }`}
                  >
                    All modes
                  </button>

                  {availableModes.map((m) => {
                    const isSelected = selectedModeId === m.modeId;
                    return (
                      <button
                        key={m.modeId || m.name}
                        type="button"
                        onClick={() => {
                          setSelectedModeId(m.modeId);
                          setOpenDropdown(null);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-[13.5px] font-normal transition-colors cursor-pointer truncate ${isSelected
                          ? 'bg-[#242424] text-white font-medium'
                          : 'text-[#C7C7CC] hover:bg-[#1E1E1E] hover:text-white'
                          }`}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Counter Header and View Switcher Toggle */}
        <div className="flex items-center justify-between mt-2 mb-1">
          <div className="text-[13px] font-medium text-[#71717A]">
            {filteredTokens.length} variables
          </div>

          <div
            className="flex items-center bg-[#141416] border border-[#242427] rounded-md p-0.5"
            role="group"
            aria-label="Display mode"
          >
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              title="List view"
              aria-pressed={viewMode === 'list'}
              className={`p-1 rounded-[4px] transition-colors cursor-pointer ${viewMode === 'list'
                  ? 'bg-[#242428] text-white shadow-xs'
                  : 'text-[#71717A] hover:text-[#C7C7CC]'
                }`}
            >
              <List className="w-3.5 h-3.5 stroke-[2]" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('swatch')}
              aria-label="Swatch view"
              title="Swatch view"
              aria-pressed={viewMode === 'swatch'}
              className={`p-1 rounded-[4px] transition-colors cursor-pointer ${viewMode === 'swatch'
                  ? 'bg-[#242428] text-white shadow-xs'
                  : 'text-[#71717A] hover:text-[#C7C7CC]'
                }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 stroke-[2]" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Token List: Accordion Groups */}
      <div
        onScroll={() => {
          if (hoveredSwatch) setHoveredSwatch(null);
        }}
        className="flex-1 overflow-y-auto px-3.5 pb-14 custom-scrollbar"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-[#8E8E93] space-y-2">
            <div className="w-4 h-4 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
            <p className="text-[13px] font-normal">Loading variables...</p>
          </div>
        ) : filteredTokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-4">
            <p className="text-[14px] font-medium text-white">No variables found</p>
            <p className="text-[13px] font-normal text-[#8E8E93] mt-1">
              Try adjusting your search query or filters.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {groupedTokens.map((group) => {
              const isCollapsed = collapsedGroups.has(group.id);
              const isAllCollections = selectedCollectionId === 'ALL';

              return (
                <div
                  key={group.id}
                  className="bg-[#121214] border border-[#222225] rounded-md overflow-hidden"
                >
                  {/* Group Header */}
                  <div
                    onClick={() => toggleGroupCollapse(group.id)}
                    className="px-2.5 py-1.5 bg-[#18181B] flex items-center justify-between text-neutral-200 cursor-pointer hover:bg-[#202024] transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-[#71717A] transition-transform duration-200 shrink-0 ${isCollapsed ? '-rotate-90' : 'rotate-0'
                          }`}
                      />
                      <span className="text-[14px] font-semibold text-[#F4F4F5] truncate">
                        {group.name}
                      </span>
                    </div>

                    <span className="text-[12px] font-medium text-[#71717A] bg-[#222225] px-1.5 py-0.5 rounded leading-none">
                      {group.totalTokensCount}
                    </span>
                  </div>

                  {/* Group Content */}
                  {!isCollapsed && (
                    <div>
                      {isAllCollections ? (
                        /* When ALL collections selected: separate by actual Figma collection with subtle subheadings */
                        group.collectionSubgroups.map((subgroup, subIdx) => (
                          <div key={subgroup.collectionId}>
                            {/* Subtle collection subheading */}
                            <div
                              className={`px-2.5 py-1 bg-[#141416] flex items-center justify-between select-none ${subIdx > 0 ? 'border-t border-[#1E1E22]' : ''
                                }`}
                            >
                              <span className="text-[12px] font-medium text-[#A1A1AA]">
                                {subgroup.collectionName}
                              </span>
                              <span className="text-[11px] font-normal text-[#71717A]">
                                {subgroup.tokens.length}
                              </span>
                            </div>

                            {/* Hierarchical Subgroups & Variants */}
                            <div className="border-t border-[#1E1E22]/40 divide-y divide-[#1E1E22]/40">
                              {subgroup.treeNodes.map((node) => renderTokenTreeNode(node))}
                            </div>
                          </div>
                        ))
                      ) : (
                        /* When specific collection selected: render hierarchical subgroups & variants directly */
                        <div className="divide-y divide-[#1E1E22]/40">
                          {group.collectionSubgroups.map((subgroup) => (
                            <React.Fragment key={subgroup.collectionId}>
                              {subgroup.treeNodes.map((node) => renderTokenTreeNode(node))}
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Helper Caption */}
            <div className="pt-2 text-[12px] font-normal text-[#71717A] leading-normal px-0.5">
              <p>
                Showing {filteredTokens.length} sample tokens · Open a row to inspect
              </p>
              <p>Selections stay while you browse.</p>
            </div>
          </div>
        )}
      </div>

      {/* Floating Tooltip for Swatch View */}
      {hoveredSwatch && (
        <div
          style={{
            position: 'fixed',
            left: Math.max(
              60,
              Math.min(
                window.innerWidth - 60,
                hoveredSwatch.rect.left + hoveredSwatch.rect.width / 2
              )
            ),
            transform: 'translateX(-50%)',
            top:
              hoveredSwatch.rect.top > 54
                ? hoveredSwatch.rect.top - 50
                : hoveredSwatch.rect.bottom + 6,
          }}
          className="z-50 pointer-events-none w-max max-w-[180px] bg-[#18181B] border border-[#2E2E34] rounded-md px-2.5 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.7),0_1px_2px_rgba(0,0,0,0.5)] flex flex-col items-center"
        >
          {/* Subtle pointer arrow */}
          {hoveredSwatch.rect.top > 54 ? (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#18181B] border-r border-b border-[#2E2E34] rotate-45" />
          ) : (
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#18181B] border-l border-t border-[#2E2E34] rotate-45" />
          )}

          {/* Value / Variant Name */}
          <span className="text-[12px] font-semibold text-white leading-tight truncate max-w-full">
            {getVariantName(hoveredSwatch.token)}
          </span>

          {/* Hex Code */}
          <span className="text-[11px] font-mono text-[#D4D4D8] font-medium tracking-wide leading-none mt-1">
            {hoveredSwatch.hex}
          </span>
        </div>
      )}

      {/* Sticky Bottom Bar for Migration Planning */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#0D0D0E]/95 backdrop-blur-md border-t border-[#222225] px-3.5 py-2 flex items-center justify-between z-10">
        <span className="text-[14px] font-normal text-[#E4E4E7]">
          {selectedTokenIds.size} selected
        </span>

        <button
          onClick={() => onStartMigration(Array.from(selectedTokenIds))}
          disabled={selectedTokenIds.size === 0}
          className="bg-white hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-[13px] h-8 px-3.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer active:scale-[0.99]"
        >
          <span>Plan migration</span>
          <ArrowRight className="w-3.5 h-3.5 stroke-[2.2]" />
        </button>
      </div>

      {/* Full-screen Token Details Page */}
      {inspectedToken && (
        <div className="fixed inset-0 z-50 bg-[#000000]">
          <TokenDetailsScreen
            token={inspectedToken}
            activeModeId={selectedModeId}
            onBack={() => setInspectedToken(null)}
            isSelected={selectedTokenIds.has(inspectedToken.id)}
            onToggleSelect={() => {
              setSelectedTokenIds((prev) => {
                const next = new Set(prev);
                if (next.has(inspectedToken.id)) next.delete(inspectedToken.id);
                else next.add(inspectedToken.id);
                return next;
              });
            }}
            onCopy={onCopy}
            copiedId={copiedId}
          />
        </div>
      )}
    </div>
  );
};
