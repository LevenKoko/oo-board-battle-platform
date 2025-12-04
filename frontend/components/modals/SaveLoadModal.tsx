import React from 'react';
import { Save, Upload, Cloud, HardDrive, X } from 'lucide-react';

interface SaveLoadModalProps {
  type: 'save' | 'load';
  isOpen: boolean;
  onClose: () => void;
  onLocalAction: () => void; 
  onCloudAction: () => void; 
}

export const SaveLoadModal: React.FC<SaveLoadModalProps> = ({ 
    type, isOpen, onClose, onLocalAction, onCloudAction 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
        </button>
        
        <div className="p-8 text-center">
            <h2 className="text-2xl font-serif font-bold text-white mb-2">
                {type === 'save' ? 'Save Game' : 'Load Game'}
            </h2>
            <p className="text-slate-400 mb-8">Choose where you want to {type} from.</p>
            
            <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={onLocalAction}
                    className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-700 hover:bg-slate-600 rounded-xl transition-all border border-slate-600 hover:border-teal-500 group"
                >
                    <HardDrive className="w-10 h-10 text-teal-400 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-white">Local File</span>
                    <span className="text-xs text-slate-400">JSON on your device</span>
                </button>

                <button 
                    onClick={onCloudAction}
                    className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-700 hover:bg-slate-600 rounded-xl transition-all border border-slate-600 hover:border-blue-500 group"
                >
                    <Cloud className="w-10 h-10 text-blue-400 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-white">Cloud Replays</span>
                    <span className="text-xs text-slate-400">Your online account</span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
