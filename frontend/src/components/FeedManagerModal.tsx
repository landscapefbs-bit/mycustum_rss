import React, { useState, useEffect } from 'react';
import { X, GripVertical, Trash2, Save } from 'lucide-react';
import type { Feed } from '../App';

type FeedManagerModalProps = {
  onClose: () => void;
  onFeedsUpdated: () => void;
};

export default function FeedManagerModal({ onClose, onFeedsUpdated }: FeedManagerModalProps) {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchFeeds();
  }, []);

  const fetchFeeds = async () => {
    try {
      const res = await fetch('/api/feeds');
      const data = await res.json();
      if (data) setFeeds(data);
    } catch (e) {
      console.error("Failed to fetch feeds", e);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newFeeds = [...feeds];
    const draggedItem = newFeeds[draggedIndex];
    newFeeds.splice(draggedIndex, 1);
    newFeeds.splice(index, 0, draggedItem);
    
    setDraggedIndex(index);
    setFeeds(newFeeds);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("このフィードと関連するすべての記事を削除しますか？")) return;
    try {
      await fetch(`/api/feeds/${id}`, { method: 'DELETE' });
      setFeeds(feeds.filter(f => f.ID !== id));
      onFeedsUpdated();
    } catch (e) {
      console.error("Failed to delete feed", e);
    }
  };

  const handleIntervalChange = async (id: number, interval: number) => {
    try {
      await fetch(`/api/feeds/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fetch_interval: interval })
      });
      setFeeds(feeds.map(f => f.ID === id ? { ...f, FetchInterval: interval } : f));
    } catch (e) {
      console.error("Failed to update interval", e);
    }
  };

  const handleRetentionChange = async (id: number, days: number) => {
    try {
      await fetch(`/api/feeds/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retention_days: days })
      });
      setFeeds(feeds.map(f => f.ID === id ? { ...f, RetentionDays: days } : f));
    } catch (e) {
      console.error("Failed to update retention days", e);
    }
  };

  const saveOrder = async () => {
    try {
      const order = feeds.map(f => f.ID);
      await fetch('/api/feeds/order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
      });
      onFeedsUpdated();
      onClose();
    } catch (e) {
      console.error("Failed to save order", e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">フィード管理</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
          {feeds.length === 0 ? (
            <p className="text-slate-500 text-sm">フィードがありません</p>
          ) : (
            feeds.map((feed, index) => (
              <div 
                key={feed.ID}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                className={`flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border ${draggedIndex === index ? 'border-indigo-500 opacity-50' : 'border-slate-200 dark:border-slate-700'} transition-all`}
              >
                <div className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
                  <GripVertical size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                    {feed.Title || feed.URL}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0 flex-wrap justify-end">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">自動取得:</label>
                    <select 
                      value={feed.FetchInterval || 60}
                      onChange={(e) => handleIntervalChange(feed.ID, parseInt(e.target.value))}
                      className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none text-slate-700 dark:text-slate-200"
                    >
                      <option value="0">手動のみ</option>
                      <option value="15">15分</option>
                      <option value="60">1時間</option>
                      <option value="360">6時間</option>
                      <option value="1440">24時間</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">残存期間:</label>
                    <select 
                      value={feed.RetentionDays || 0}
                      onChange={(e) => handleRetentionChange(feed.ID, parseInt(e.target.value))}
                      className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none text-slate-700 dark:text-slate-200"
                    >
                      <option value="0">無期限</option>
                      <option value="1">1日</option>
                      <option value="3">3日</option>
                      <option value="7">1週間</option>
                      <option value="14">2週間</option>
                    </select>
                  </div>
                  <button onClick={() => handleDelete(feed.ID)} className="text-slate-400 hover:text-red-500 transition-colors ml-2" title="削除">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
          <button 
            onClick={saveOrder}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
          >
            <Save size={16} />
            保存して閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
