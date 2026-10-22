import React from 'react';
import { ArrowLeft } from 'lucide-react';

export interface BackButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({
  onClick,
  label = 'Back',
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-[#8E8E93] hover:text-white transition-colors cursor-pointer text-[13px] font-normal leading-normal select-none ${className}`}
    >
      <ArrowLeft className="w-3.5 h-3.5 stroke-[2] shrink-0" />
      <span className="text-[13px] font-normal leading-normal">{label}</span>
    </button>
  );
};
