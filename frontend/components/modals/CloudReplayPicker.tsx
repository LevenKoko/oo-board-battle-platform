import React, { useEffect, useState } from 'react';
import { MatchInfo } from '../../types';
import { ReplayService } from '../../services/api';
import { X, Cloud } from 'lucide-react';

interface CloudReplayPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (matchId: number) => void;
}

export const CloudReplayPicker: React.FC<CloudReplayPickerProps> = ({ isOpen, onClose, onSelect }) => {
    const [replays, setReplays] = useState<MatchInfo[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            ReplayService.fetchMyReplays().then(res => {
                // Filter for saves that are likely continuable (no result or SAVED status if we exposed status)
                // Since backend returns MatchInfo which has 'result', we can check if result is null or "SAVED" (if mapped)
                // The backend `save_replay` sets result=None if live.
                const liveReplays = res.matches.filter(r => !r.result || r.result === 'null'); 
                setReplays(liveReplays);
                setLoading(false);
            }).catch(() => setLoading(false));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <Cloud className="w-5 h-5 text-blue-400" /> Select Cloud Save
                    </h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loading ? <p className="text-slate-400 text-center">Loading...</p> : (
                        replays.length === 0 ? <p className="text-slate-500 text-center">No live saves found.</p> :
                        replays.map(r => (
                            <div key={r.id} 
                                onClick={() => onSelect(r.id)}
                                className="p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-blue-500"
                            >
                                <div className="flex justify-between">
                                    <span className="font-bold text-white">{r.gameType}</span>
                                    <span className="text-xs bg-slate-600 px-2 py-0.5 rounded text-slate-300">#{r.id}</span>
                                </div>
                                <div className="text-xs text-slate-400 mt-1">
                                    {r.startTime} • Saved
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
