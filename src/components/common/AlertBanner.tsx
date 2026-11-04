import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface AlertBannerProps {
  message: string | null;
  onClose: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="bg-[#FCE8E9] border-l-4 border-[#D7262E] text-[#93171D] p-4 rounded-r shadow-sm flex items-start justify-between mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[#D7262E] shrink-0 mt-0.5" />
        <div className="text-sm font-medium leading-relaxed">
          {message}
        </div>
      </div>
      <button
        onClick={onClose}
        className="text-[#93171D] hover:text-[#D7262E] p-1 -mr-1 rounded transition-colors"
        aria-label="Tutup notifikasi"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
