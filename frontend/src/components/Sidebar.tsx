import { useEffect, useState } from 'react';
import { Rss, Star, Clock, Plus, Inbox, Sun, Moon, Settings, X, Save, Trash2, RefreshCw } from 'lucide-react';
import type { Feed } from '../App';
import FeedManagerModal from './FeedManagerModal';

type SidebarProps = {
  selectedFeedId: number | null;
  onSelectFeed: (id: number | null) => void;
};

export type ShareTemplate = {
  id: string;
  name: string;
  template: string;
};

export default function Sidebar({ selectedFeedId, onSelectFeed }: SidebarProps) {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [isDark, setIsDark] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFeedManager, setShowFeedManager] = useState(false);
  const [refreshingFeeds, setRefreshingFeeds] = useState<Set<number>>(new Set());
  
  const [recommendLimit, setRecommendLimit] = useState<number>(() => {
    const saved = localStorage.getItem('myrss_recommend_limit');
    return saved ? parseInt(saved, 10) : 5;
  });
  
  const [templates, setTemplates] = useState<ShareTemplate[]>(() => {
    const saved = localStorage.getItem('myrss_share_templates');
    if (saved) return JSON.parse(saved);
    const legacy = localStorage.getItem('shareTemplate');
    if (legacy) return [{ id: Date.now().toString(), name: 'デフォルト', template: legacy }];
    return [{ id: '1', name: 'デフォルト', template: "【{{title}}】\n{{url}}\n\n{{summary}}" }];
  });

  const saveSettings = () => {
    localStorage.setItem('myrss_share_templates', JSON.stringify(templates));
    localStorage.setItem('myrss_recommend_limit', recommendLimit.toString());
    setShowSettings(false);
  };

  const addTemplate = () => {
    setTemplates([...templates, { id: Date.now().toString(), name: '新規テンプレート', template: '' }]);
  };

  const updateTemplate = (id: string, field: 'name' | 'template', value: string) => {
    setTemplates(templates.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const deleteTemplate = (id: string) => {
    if (templates.length <= 1) {
      alert('最低1つのテンプレートが必要です');
      return;
    }
    setTemplates(templates.filter(t => t.id !== id));
  };

  useEffect(() => {
    // Check system preference on load
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
    
    fetchFeeds();
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const fetchFeeds = async () => {
    try {
      const res = await fetch('/api/feeds');
      const data = await res.json();
      if (data) setFeeds(data);
    } catch (e) {
      console.error("Failed to fetch feeds", e);
    }
  };

  const handleAddFeed = async () => {
    const url = prompt("追加するRSSフィードのURLを入力してください:");
    if (!url) return;
    try {
      await fetch('/api/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ URL: url })
      });
      fetchFeeds(); // Refresh feeds
    } catch (e) {
      console.error("Failed to add feed", e);
      alert("フィードの追加に失敗しました。");
    }
  };

  const handleRefreshFeed = async (e: React.MouseEvent, feedId: number) => {
    e.stopPropagation();
    if (refreshingFeeds.has(feedId)) return;
    
    setRefreshingFeeds(prev => new Set(prev).add(feedId));
    try {
      await fetch(`/api/feeds/${feedId}/refresh`, { method: 'POST' });
      fetchFeeds();
    } catch (e) {
      console.error("Failed to refresh feed", e);
    } finally {
      setRefreshingFeeds(prev => {
        const next = new Set(prev);
        next.delete(feedId);
        return next;
      });
    }
  };

  return (
    <div className="w-64 sm:w-72 flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
      <div className="flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
          <Rss size={28} strokeWidth={2.5} />
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">MyRSS</h1>
        </div>
        <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors">
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1">
        <NavItem 
          icon={<Inbox size={18} />} 
          label="すべての記事" 
          active={selectedFeedId === null} 
          onClick={() => onSelectFeed(null)} 
        />
        <NavItem 
          icon={<Star size={18} />} 
          label="お気に入り" 
          active={selectedFeedId === -1} // dummy for star
          onClick={() => onSelectFeed(-1)} 
        />
        <NavItem 
          icon={<Clock size={18} />} 
          label="後で読む" 
          active={selectedFeedId === -2} // dummy
          onClick={() => onSelectFeed(-2)} 
        />
        <NavItem 
          icon={<Sparkles size={18} className="text-amber-500" />} 
          label="おすすめ記事 (AI)" 
          active={selectedFeedId === -3} 
          onClick={() => onSelectFeed(-3)} 
        />

        <div className="pt-6 pb-2">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">購読中</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowFeedManager(true)} className="hover:text-indigo-500 transition-colors" title="フィード管理">
                <Settings size={14} className="text-slate-400 hover:text-indigo-500" />
              </button>
              <button onClick={handleAddFeed} className="hover:text-indigo-500 transition-colors" title="フィード追加">
                <Plus size={16} className="text-slate-400 hover:text-indigo-500" />
              </button>
            </div>
          </div>
        </div>

        {feeds.map(feed => (
          <div key={feed.ID} className="group flex items-center pr-2">
            <div className="flex-1">
              <NavItem 
                icon={<div className="w-2 h-2 rounded-full bg-indigo-400 ml-1 mr-1" />} 
                label={
                  <div className="flex items-center justify-between w-full">
                    <span className="truncate">{feed.Title || feed.URL}</span>
                    {(feed.UnreadCount || 0) > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-bold">
                        {feed.UnreadCount}
                      </span>
                    )}
                  </div>
                } 
                active={selectedFeedId === feed.ID} 
                onClick={() => onSelectFeed(feed.ID)} 
              />
            </div>
            <button 
              onClick={(e) => handleRefreshFeed(e, feed.ID)}
              className={`p-1.5 transition-all rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 ${refreshingFeeds.has(feed.ID) ? 'opacity-100 animate-spin text-indigo-500' : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-500'}`}
              title="再取得"
              disabled={refreshingFeeds.has(feed.ID)}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        ))}
      </nav>
      
      {showFeedManager && (
        <FeedManagerModal 
          onClose={() => setShowFeedManager(false)} 
          onFeedsUpdated={fetchFeeds} 
        />
      )}
      
      <div className="mt-auto pt-4 px-2 flex items-center justify-between text-xs text-slate-400">
        <span>Syncing automatically...</span>
        <button onClick={() => setShowSettings(true)} className="hover:text-indigo-500 transition-colors p-1" title="設定">
          <Settings size={16} />
        </button>
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">共有設定</h3>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  メッセージブロックのテンプレート
                </label>
                <button onClick={addTemplate} className="flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700">
                  <Plus size={14} /> 追加
                </button>
              </div>

              {templates.map((t, index) => (
                <div key={t.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      value={t.name}
                      onChange={(e) => updateTemplate(t.id, 'name', e.target.value)}
                      className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100 font-medium"
                      placeholder="テンプレート名 (例: Slack用)"
                    />
                    <button onClick={() => deleteTemplate(t.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="削除">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <textarea 
                    value={t.template}
                    onChange={(e) => updateTemplate(t.id, 'template', e.target.value)}
                    className="w-full h-24 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-900 dark:text-slate-100"
                    placeholder="利用可能な変数: {{title}}, {{url}}, {{summary}}, {{tags}}, {{date}}"
                  />
                </div>
              ))}
              
              <p className="text-xs text-slate-500 leading-relaxed">
                利用可能な変数:<br/>
                <code className="text-indigo-500">{"{{title}}"}</code>, <code className="text-indigo-500">{"{{url}}"}</code>, <code className="text-indigo-500">{"{{summary}}"}</code>, <code className="text-indigo-500">{"{{tags}}"}</code>, <code className="text-indigo-500">{"{{date}}"}</code>
              </p>
              
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  AIおすすめ記事の表示件数
                </label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="1" max="20" step="1" 
                    value={recommendLimit}
                    onChange={(e) => setRecommendLimit(parseInt(e.target.value, 10))}
                    className="flex-1 accent-indigo-500"
                  />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300 w-12 text-center">
                    {recommendLimit} 件
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  過去のお気に入り傾向をAIが分析し、未読記事の中から指定した件数のおすすめ記事をピックアップします。
                </p>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button 
                onClick={saveSettings}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Save size={16} />
                保存して閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium ${
        active 
          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' 
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
