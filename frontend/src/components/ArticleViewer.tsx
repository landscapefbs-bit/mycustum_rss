import { useEffect, useState } from 'react';
import { ExternalLink, Star, Share, Trash2, Clock, Link, MessageSquare, X, Copy } from 'lucide-react';
import type { Article } from '../App';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { ShareTemplate } from './Sidebar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ArticleViewerProps = {
  article: Article | null;
};

export default function ArticleViewer({ article }: ArticleViewerProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [previewMsg, setPreviewMsg] = useState<string | null>(null);

  const getTemplates = (): ShareTemplate[] => {
    const saved = localStorage.getItem('shareTemplates');
    if (saved) return JSON.parse(saved);
    const legacy = localStorage.getItem('shareTemplate');
    if (legacy) return [{ id: '1', name: 'デフォルト', template: legacy }];
    return [{ id: '1', name: 'デフォルト', template: "【{{title}}】\n{{url}}\n\n{{summary}}" }];
  };

  useEffect(() => {
    if (article) {
      setIsFavorite(article.IsFavorite);
      setIsSaved(article.IsSaved);

      if (!article.IsRead) {
        // Mark as read after 2 seconds
        const timer = setTimeout(() => {
          fetch(`http://localhost:8080/api/articles/${article.ID}/read`, { method: 'PUT' });
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [article]);

  const toggleFavorite = async () => {
    if (!article) return;
    try {
      await fetch(`/api/articles/${article.ID}/favorite`, { method: 'PUT' });
      const updated = { ...article, IsFavorite: !article.IsFavorite };
      onArticleUpdate(updated);
    } catch (e) { console.error(e); }
  };

  const toggleSaved = async () => {
    if (!article) return;
    try {
      await fetch(`/api/articles/${article.ID}/saved`, { method: 'PUT' });
      const updated = { ...article, IsSaved: !article.IsSaved };
      onArticleUpdate(updated);
    } catch (e) { console.error(e); }
  };

  const copyUrl = () => {
    if (!article) return;
    navigator.clipboard.writeText(article.URL);
    alert('URLをコピーしました');
    setShowShareMenu(false);
  };

  const openPreview = (t: ShareTemplate) => {
    if (!article) return;
    const dateStr = format(new Date(article.PublishedAt), 'yyyy年M月d日 HH:mm', { locale: ja });
    const msg = t.template
      .replace(/{{title}}/g, article.Title || '')
      .replace(/{{url}}/g, article.URL || '')
      .replace(/{{summary}}/g, article.Summary || '')
      .replace(/{{tags}}/g, article.Tags || '')
      .replace(/{{date}}/g, dateStr);
    
    setPreviewMsg(msg);
    setShowShareMenu(false);
  };

  const executeCopy = () => {
    if (previewMsg) {
      navigator.clipboard.writeText(previewMsg);
      alert('コピーしました！');
      setPreviewMsg(null);
    }
  };

  if (!article) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center text-slate-400 flex flex-col items-center">
          <div className="w-16 h-16 mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <ExternalLink size={24} className="text-slate-300 dark:text-slate-600" />
          </div>
          <p>記事を選択して読み始める</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden relative">
      {/* Top Toolbar */}
      <div className="h-16 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-4 text-slate-500">
          <button 
            onClick={toggleFavorite}
            className={`p-2 rounded-full transition-colors ${isFavorite ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-500/20' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`} 
            title="お気に入り"
          >
            <Star size={20} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          <button 
            onClick={toggleSaved}
            className={`p-2 rounded-full transition-all duration-200 ${isSaved ? 'text-white bg-indigo-600 dark:bg-indigo-500 shadow-md scale-105' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`} 
            title="後で読む"
          >
            <Clock size={20} strokeWidth={isSaved ? 2.5 : 2} />
          </button>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
          <a href={article.URL} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" title="ブラウザで開く">
            <ExternalLink size={20} />
          </a>
        </div>
        <div className="flex items-center gap-2 text-slate-500 relative">
          <button 
            onClick={() => setShowShareMenu(!showShareMenu)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" 
            title="共有"
          >
            <Share size={20} />
          </button>
          
          {showShareMenu && (
            <div className="absolute right-10 top-12 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-50">
              <button onClick={copyUrl} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <Link size={16} />
                <span>URLのみコピー</span>
              </button>
              <div className="px-4 py-2 text-xs font-semibold text-slate-400 bg-slate-50 dark:bg-slate-900 border-y border-slate-100 dark:border-slate-700">
                テンプレートで共有
              </div>
              <div className="max-h-48 overflow-y-auto">
                {getTemplates().map(t => (
                  <button key={t.id} onClick={() => openPreview(t)} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                    <MessageSquare size={16} className="text-indigo-500" />
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button className="p-2 hover:bg-red-50 text-red-400 hover:text-red-500 dark:hover:bg-red-500/10 rounded-full transition-colors ml-2" title="削除">
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Share Preview Modal */}
      {previewMsg !== null && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">プレビューの確認</h3>
              <button onClick={() => setPreviewMsg(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-6">
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 dark:text-slate-300">
                {previewMsg}
              </pre>
            </div>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setPreviewMsg(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
              >
                キャンセル
              </button>
              <button 
                onClick={executeCopy}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Copy size={16} />
                コピーする
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Article Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-2xl mx-auto px-8 py-12">
          <div className="mb-10">
            <div className="flex items-center gap-3 text-sm text-slate-500 mb-4 font-medium">
              <span className="text-indigo-600 dark:text-indigo-400">{(article as any).Feed?.Title}</span>
              <span>•</span>
              <time>{format(new Date(article.PublishedAt), 'yyyy年M月d日 HH:mm', { locale: ja })}</time>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white leading-tight mb-6">
              {article.Title}
            </h1>
            
            {article.Summary && (
              <div className="bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 p-5 rounded-2xl mb-8">
                <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">AI Summary</h4>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">{article.Summary}</p>
                {article.Tags && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {article.Tags.split(/[,、]/).map((tag, i) => tag.trim() ? (
                      <span key={i} className="px-2.5 py-1 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 text-xs rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">
                        #{tag.trim()}
                      </span>
                    ) : null)}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="prose prose-slate dark:prose-invert prose-lg max-w-none prose-a:text-indigo-600 dark:prose-a:text-indigo-400 hover:prose-a:text-indigo-500 leading-relaxed [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-xl [&_img]:my-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {article.Content || '本文が取得できませんでした。'}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
