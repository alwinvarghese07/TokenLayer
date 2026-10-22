import React from 'react';
import { Folder, SlidersHorizontal, ArrowRight, History } from 'lucide-react';
import type { TokenCollection, TokenItem } from '../../shared/messages';

interface HomeScreenProps {
  collections: TokenCollection[];
  tokens: TokenItem[];
  loading: boolean;
  onExplore: () => void;
  onStartMigration: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  collections,
  tokens,
  loading,
  onExplore,
  onStartMigration,
}) => {
  const collectionCount = collections.length;
  const variableCount = tokens.length;
  const modeCount = collections.reduce((acc, col) => acc + col.modes.length, 0);

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
          <h2 className="text-[13px] font-medium text-neutral-400 mb-3.5">
            Recent activity
          </h2>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#1C1C1F] border border-neutral-800/80 flex items-center justify-center shrink-0 text-neutral-400 shadow-sm">
              <History className="w-4 h-4 text-neutral-400 stroke-[1.8]" />
            </div>
            <div className="pt-0.5">
              <h3 className="text-[14px] font-medium text-neutral-200">
                No migrations yet
              </h3>
              <p className="text-[12px] text-neutral-400 mt-0.5 leading-relaxed">
                Your migrations will appear here once you get started.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
