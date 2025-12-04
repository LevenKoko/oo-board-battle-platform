import React from 'react';

interface ExitSavePromptProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void; // Yes, Save & Exit
    onDeny: () => void; // No, just Exit
}

export const ExitSavePrompt: React.FC<ExitSavePromptProps> = ({ isOpen, onClose, onConfirm, onDeny }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center">
                <h3 className="text-xl font-bold text-white mb-4">Leave Game?</h3>
                <p className="text-slate-400 mb-6">Do you want to save this game to your Replays before leaving?</p>
                <div className="flex gap-3 justify-center">
                    <button onClick={onDeny} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">
                        Don't Save
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg">
                        Save & Leave
                    </button>
                </div>
                <button onClick={onClose} className="mt-4 text-slate-500 text-sm hover:text-slate-300">Cancel</button>
            </div>
        </div>
    );
};
