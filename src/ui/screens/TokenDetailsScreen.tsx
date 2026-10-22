import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  MoreHorizontal,
  Copy,
  Check,
  Link2,
  Plus,
  Hash,
  Type as TypeIcon,
  ToggleLeft,
} from 'lucide-react';
import type { TokenItem } from '../../shared/messages';
import { BackButton } from '../components/BackButton';
import { copyToClipboard } from '../utils/clipboard';
import { formatHexColor } from '../utils/color';

interface TokenDetailsScreenProps {
  token: TokenItem;
  activeModeId?: string;
  onBack: () => void;
  isSelected: boolean;
  onToggleSelect: () => void;
  onCopy: (text: string, id: string, notifyMessage?: string) => void;
  copiedId: string | null;
}

export const TokenDetailsScreen: React.FC<TokenDetailsScreenProps> = ({
  token,
  activeModeId,
  onBack,
  isSelected,
  onToggleSelect,
  onCopy,
  copiedId,
}) => {
  const [showToast, setShowToast] = useState(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Determine active mode value
  const modeKeys = Object.keys(token.valuesByMode);
  const resolvedModeId =
    activeModeId && activeModeId !== 'ALL' && token.valuesByMode[activeModeId]
      ? activeModeId
      : modeKeys[0];
  const activeModeVal = token.valuesByMode[resolvedModeId];

  // Type display string
  const typeLabel =
    token.resolvedType === 'COLOR'
      ? 'Color'
      : token.resolvedType === 'FLOAT'
        ? 'Number'
        : token.resolvedType === 'STRING'
          ? 'String'
          : token.resolvedType === 'BOOLEAN'
            ? 'Boolean'
            : token.resolvedType;

  // Primary large value to display
  const displayBigValue =
    (token.resolvedType === 'COLOR' && formatHexColor(activeModeVal)) ||
    (token.resolvedType === 'COLOR' && activeModeVal?.colorHex) ||
    activeModeVal?.colorHex ||
    activeModeVal?.formattedValue ||
    String(activeModeVal?.value ?? '');

  // Extract strictly the hex code for color tokens, without anything extra
  const hexToCopy = useMemo(() => {
    if (token.resolvedType === 'COLOR') {
      const formatted = formatHexColor(activeModeVal);
      if (formatted) return formatted;
      for (const mv of Object.values(token.valuesByMode)) {
        const f = formatHexColor(mv);
        if (f) return f;
      }
    }
    // Direct colorHex on active mode
    if (activeModeVal?.colorHex) {
      const match = activeModeVal.colorHex.match(/#[0-9a-fA-F]{3,8}/);
      if (match) return match[0].toUpperCase();
      return activeModeVal.colorHex.trim().toUpperCase();
    }
    // Scan all modes for a colorHex
    for (const mv of Object.values(token.valuesByMode)) {
      if (mv.colorHex) {
        const match = mv.colorHex.match(/#[0-9a-fA-F]{3,8}/);
        if (match) return match[0].toUpperCase();
      }
    }
    // Scan candidate strings for hex pattern
    const candidates = [
      activeModeVal?.formattedValue,
      String(activeModeVal?.value ?? ''),
      displayBigValue,
    ];
    for (const c of candidates) {
      if (c) {
        const match = c.match(/#[0-9a-fA-F]{3,8}/);
        if (match) return match[0].toUpperCase();
      }
    }
    return displayBigValue.trim();
  }, [token, activeModeVal, displayBigValue]);

  const isCopied = copiedId === `detail-${token.id}` || showToast;

  const handleCopy = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    copyToClipboard(hexToCopy);
    onCopy(hexToCopy, `detail-${token.id}`, 'Copied to clipboard');
    setShowToast(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setShowToast(false);
    }, 2000);
  };

  // Check aliases across modes
  const aliasMode = Object.values(token.valuesByMode).find((mv) => mv.isAlias);

  return (
    <div className="flex flex-col h-full bg-[#000000] text-white select-none font-sans">
      {/* Top Navigation Bar */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-transparent shrink-0">
        <BackButton onClick={onBack} />

        <button
          type="button"
          className="text-[#8E8E93] hover:text-white transition-colors cursor-pointer p-0.5"
          title="More options"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Hero / Token Identification */}
        <div className="px-5 pt-2 pb-4">
          {/* Row 1: Swatch / Icon + Token Name + Type */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {token.resolvedType === 'COLOR' ? (
                <div
                  className="w-4 h-4 rounded-[3px] shrink-0"
                  style={{
                    backgroundColor:
                      activeModeVal?.colorRgba || activeModeVal?.colorHex || '#6366F1',
                  }}
                />
              ) : token.resolvedType === 'FLOAT' ? (
                <Hash className="w-4 h-4 text-[#8E8E93] shrink-0" />
              ) : token.resolvedType === 'STRING' ? (
                <TypeIcon className="w-4 h-4 text-[#8E8E93] shrink-0" />
              ) : (
                <ToggleLeft className="w-4 h-4 text-[#8E8E93] shrink-0" />
              )}
              <h1 className="text-[16px] font-medium text-white tracking-normal truncate">
                {token.name}
              </h1>
            </div>

            <span className="text-[14px] font-normal text-[#8E8E93] shrink-0">
              {typeLabel}
            </span>
          </div>

          {/* Row 2: Big Value + Copy Button */}
          <div className="flex items-center justify-between gap-3 mt-1.5">
            <div
              onClick={handleCopy}
              className="text-[20px] font-semibold text-white tracking-tight truncate cursor-pointer hover:text-neutral-200 transition-colors"
              title="Click to copy hex code"
            >
              {displayBigValue}
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="w-8 h-8 rounded-lg bg-[#141414] border border-[#292929] hover:border-[#48484A] flex items-center justify-center text-[#8E8E93] hover:text-white transition-colors cursor-pointer shrink-0"
              title="Copy hex code"
            >
              {isCopied ? (
                <Check className="w-4 h-4 text-white" />
              ) : (
                <Copy className="w-4 h-4 text-white" />
              )}
            </button>
          </div>

          {/* Row 3: Subtitle / Source info */}
          <p className="text-[13px] font-normal text-[#636366] mt-1.5">
            {token.description || 'Sample token · Not connected to file data'}
          </p>
        </div>

        {/* Section 1: Properties */}
        <div className="mt-4">
          <h2 className="text-[15px] font-medium text-[#999999] mb-1 px-5">Properties</h2>
          <div className="px-5 divide-y divide-[#292929]">
            <div className="py-3 flex items-center justify-between">
              <span className="text-[14px] font-normal text-[#999999]">Collection</span>
              <span className="text-[14px] font-normal text-[#F5F5F5]">
                {token.collectionName || 'Default'}
              </span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <span className="text-[14px] font-normal text-[#999999]">Mode</span>
              <span className="text-[14px] font-normal text-[#F5F5F5]">
                {activeModeVal?.modeName || 'Default'}
              </span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <span className="text-[14px] font-normal text-[#999999]">Type</span>
              <span className="text-[14px] font-normal text-[#F5F5F5]">{typeLabel}</span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <span className="text-[14px] font-normal text-[#999999]">Value</span>
              <span className="text-[14px] font-normal text-[#F5F5F5]">
                {activeModeVal?.formattedValue ||
                  activeModeVal?.colorHex ||
                  String(activeModeVal?.value ?? '')}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Mode values */}
        <div className="mt-6">
          <h2 className="text-[15px] font-medium text-[#999999] mb-1 px-5">Mode values</h2>
          <div className="px-5 divide-y divide-[#292929]">
            {Object.values(token.valuesByMode).map((mv) => (
              <div key={mv.modeId} className="py-3 flex items-center justify-between">
                <span className="text-[14px] font-normal text-[#999999]">{mv.modeName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-normal text-[#F5F5F5]">
                    {mv.formattedValue || mv.colorHex || String(mv.value ?? '')}
                  </span>
                  {token.resolvedType === 'COLOR' && (mv.colorRgba || mv.colorHex) && (
                    <div
                      className="w-3 h-3 rounded-[3px] shrink-0"
                      style={{ backgroundColor: mv.colorRgba || mv.colorHex }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Aliases */}
        <div className="mt-6">
          <h2 className="text-[13px] font-normal text-[#8E8E93] mb-2 px-5">Aliases</h2>
          <div className="px-5 pb-4 border-b border-[#2C2C2E]/60">
            {aliasMode ? (
              <div>
                <div className="flex items-center gap-2 text-white text-[14px] font-medium">
                  <Link2 className="w-4 h-4 text-[#8E8E93] shrink-0" />
                  <span>{aliasMode.aliasTargetName || aliasMode.formattedValue}</span>
                </div>
                <p className="text-[13px] font-normal text-[#8E8E93] mt-1 pl-6">
                  Linked from collection{' '}
                  {aliasMode.aliasTargetCollection || token.collectionName}
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 text-white text-[14px] font-medium">
                  <Link2 className="w-4 h-4 text-[#8E8E93] shrink-0" />
                  <span>No aliases</span>
                </div>
                <p className="text-[13px] font-normal text-[#8E8E93] mt-1 pl-6">
                  This sample uses a direct{' '}
                  {token.resolvedType === 'COLOR' ? 'color' : 'token'} value.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: References */}
        <div className="mt-6">
          <h2 className="text-[13px] font-normal text-[#8E8E93] mb-2 px-5">References</h2>
          <div className="px-5 pb-4 border-b border-[#2C2C2E]/60">
            <div className="text-[14px] font-medium text-white">
              Reference data unavailable
            </div>
            <p className="text-[13px] font-normal text-[#8E8E93] mt-1">
              Usage is shown only when verified.
            </p>
          </div>
        </div>

        {/* Help Note */}
        <div className="px-5 pt-4 pb-6 text-[13px] font-normal text-[#636366] leading-relaxed">
          Explorer keeps your search, filters, scroll position and selection.
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="shrink-0 bg-[#000000]/95 backdrop-blur-md border-t border-[#2C2C2E] p-5">
        <button
          type="button"
          onClick={onToggleSelect}
          className={`w-full py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-[14px] transition-colors cursor-pointer shadow-sm active:scale-[0.99] ${isSelected
            ? 'bg-[#1C1C1E] border border-[#3A3A3C] text-white hover:bg-[#2C2C2E]'
            : 'bg-white text-black hover:bg-neutral-200'
            }`}
        >
          {isSelected ? (
            <>
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Added to Migration Plan</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add to Migration Plan</span>
            </>
          )}
        </button>
      </div>

      {/* Minimal 'Copied to clipboard' Floating Toast */}
      {/* {showToast && (
        <div
          style={{ zIndex: 99999 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#202023] border border-[#3A3A3D] text-white text-[12px] font-medium px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 pointer-events-none select-none transition-all duration-150"
        >
          <span>Copied to clipboard</span>
        </div>
      )} */}
    </div>
  );
};
