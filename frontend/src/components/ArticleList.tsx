import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { CheckCircle2, Sparkles, Search, SlidersHorizontal, X, Calendar } from 'lucide-react';
import type { Article } from '../App';

type ArticleListProps = {
  feedId: number | null;
  selectedArticleId?: number;
  onSelectArticle: (article: Article) => void;
};

export default function ArticleList({ feedId, selectedArticleId, onSelectArticle }: ArticleListProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Search states
  const [showFilters, setShowFilters] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [tags, setTags] = useState('');
  const [dateQuery, setDateQuery] = useState('');

  useEffect(() => {
    // Debounce search slightly
    const timer = setTimeout(() => {
      fetchArticles();
    }, 300);
    return () => clearTimeout(timer);
  }, [feedId, keyword, tags, dateQuery]);

  const parseDateQuery = (input: string) => {
    if (!input) return { dates: '', dateFrom: '', dateTo: '' };
    
    const now = new Date();
    let dates: string[] = [];
    let dateFrom = '';
    let dateTo = '';

    const formatYMD = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const getRelativeDate = (num: number, unit: string) => {
      const d = new Date(now);
      if (unit.includes('日')) d.setDate(d.getDate() - num);
      else if (unit.includes('週')) d.setDate(d.getDate() - num * 7);
      else if (unit.includes('ヶ月') || unit.includes('月')) d.setMonth(d.getMonth() - num);
      else if (unit.includes('年')) d.setFullYear(d.getFullYear() - num);
      return d;
    };

    if (input.includes('今日')) {
      dateFrom = formatYMD(now);
      dateTo = formatYMD(now);
    } else if (input.includes('昨日')) {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      dateFrom = formatYMD(yest);
      dateTo = formatYMD(yest);
    } else if (input.match(/(\d+)\s*(日前|週間前|ヶ月前|年前)から\s*(\d+)\s*(日前|週間前|ヶ月前|年前)まで/)) {
      const m = input.match(/(\d+)\s*(日前|週間前|ヶ月前|年前)から\s*(\d+)\s*(日前|週間前|ヶ月前|年前)まで/);
      if (m) {
        // Usually "X days ago" is chronologically earlier than "Y days ago" if X > Y
        const d1 = getRelativeDate(parseInt(m[1]), m[2]);
        const d2 = getRelativeDate(parseInt(m[3]), m[4]);
        // Swap if needed
        if (d1 > d2) {
          dateFrom = formatYMD(d2);
          dateTo = formatYMD(d1);
        } else {
          dateFrom = formatYMD(d1);
          dateTo = formatYMD(d2);
        }
      }
    } else if (input.match(/(\d+)\s*(日前|週間前|ヶ月前|年前)まで/)) {
       const m = input.match(/(\d+)\s*(日前|週間前|ヶ月前|年前)まで/);
       if(m) dateTo = formatYMD(getRelativeDate(parseInt(m[1]), m[2]));
    } else if (input.match(/(\d+)\s*(日前|週間前|ヶ月前|年前)から|以降/)) {
       const m = input.match(/(\d+)\s*(日前|週間前|ヶ月前|年前)/);
       if(m) dateFrom = formatYMD(getRelativeDate(parseInt(m[1]), m[2]));
    } else if (input.match(/(\d+)\s*(日前|週間前|ヶ月前|年前)/)) {
      const m = input.match(/(\d+)\s*(日前|週間前|ヶ月前|年前)/);
      if (m) {
        dateFrom = formatYMD(getRelativeDate(parseInt(m[1]), m[2]));
        dateTo = dateFrom; 
      }
    } else if (input.includes(',')) {
      dates = input.split(',').map(s => {
        let ds = s.trim();
        if (ds.length === 8 && !ds.includes('-')) {
          ds = `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}`;
        }
        return ds;
      });
    } else {
      let ds = input.trim();
      if (ds.length === 8 && !ds.includes('-')) {
        ds = `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}`;
        dateFrom = ds;
        dateTo = ds;
      } else {
        // Assume it might be a partial string or valid YYYY-MM-DD
        if (ds.length >= 10) {
          dateFrom = ds.slice(0, 10);
          dateTo = ds.slice(0, 10);
        }
      }
    }

    return { dates: dates.join(','), dateFrom, dateTo };
  };

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (feedId !== null) params.append('feed_id', feedId.toString());
      if (keyword) params.append('keyword', keyword);
      if (tags) params.append('tags', tags);
      
      let parsed = parseDateQuery(dateQuery);
      
      // Fallback to AI parsing if local parser couldn't figure it out
      if (dateQuery && !parsed.dates && !parsed.dateFrom && !parsed.dateTo) {
        try {
          const aiRes = await fetch(`http://localhost:8080/api/parse-date?q=${encodeURIComponent(dateQuery)}`);
          if (aiRes.ok) {
            const data = await aiRes.json();
            parsed = { dates: data.Dates || '', dateFrom: data.DateFrom || '', dateTo: data.DateTo || '' };
          }
        } catch (e) {
          console.error("AI date parse failed", e);
        }
      }

      if (parsed.dates) params.append('dates', parsed.dates);
      if (parsed.dateFrom) params.append('date_from', parsed.dateFrom);
      if (parsed.dateTo) params.append('date_to', parsed.dateTo);

      let url = `http://localhost:8080/api/articles?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data) setArticles(data);
    } catch (e) {
      console.error("Failed to fetch articles", e);
    }
    setLoading(false);
  };

  const getFeedTitle = () => {
    if (feedId === null) return "すべての記事";
    if (feedId === -1) return "お気に入り";
    if (feedId === -2) return "後で読む";
    if (articles.length > 0) return (articles[0] as any).Feed?.Title + "の記事" || "フィードの記事";
    return "フィードの記事";
  };

  return (
    <div className="w-80 sm:w-96 flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
      <div className="border-b border-slate-100 dark:border-slate-800/60 backdrop-blur-md bg-white/70 dark:bg-slate-900/70 sticky top-0 z-20 flex flex-col">
        <div className="p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate max-w-[200px]">
              {getFeedTitle()}
            </h2>
            <p className="text-xs text-slate-500 mt-1">{articles.length} 件の記事</p>
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-full transition-colors ${showFilters ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' : 'hover:bg-slate-100 text-slate-500 dark:hover:bg-slate-800'}`}
          >
            <SlidersHorizontal size={20} />
          </button>
        </div>

        {/* Accordion Search UI */}
        {showFilters && (
          <div className="px-4 pb-4 space-y-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="キーワード検索..." 
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100"
              />
              {keyword && (
                <button onClick={() => setKeyword('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="relative">
              <input 
                type="text" 
                placeholder="タグ (例: AI, ニュース)" 
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="relative flex items-center">
              <input 
                type="text" 
                placeholder="日時指定 (例: 20260501, 1週間前)" 
                value={dateQuery}
                onChange={(e) => setDateQuery(e.target.value)}
                className="w-full pl-3 pr-10 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100"
              />
              <div className="absolute right-2 text-slate-400 pointer-events-none">
                <Calendar size={18} />
              </div>
              <input 
                type="date" 
                onChange={(e) => {
                  const val = e.target.value.replace(/-/g, '');
                  setDateQuery(prev => prev ? prev + ', ' + val : val);
                  e.target.value = ''; // Reset so it can be clicked again
                }}
                className="absolute right-2 w-6 h-6 opacity-0 cursor-pointer"
                title="カレンダーから選択"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {loading ? (
          <div className="p-8 text-center text-slate-400">読み込み中...</div>
        ) : articles.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center text-slate-400">
            <CheckCircle2 size={32} className="mb-3 text-slate-300 dark:text-slate-700" />
            <p>新しい記事はありません</p>
          </div>
        ) : (
          articles.map(article => (
            <button
              key={article.ID}
              onClick={() => onSelectArticle(article)}
              className={`w-full text-left p-4 rounded-2xl transition-all duration-300 border ${
                selectedArticleId === article.ID
                  ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/30 shadow-sm'
                  : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800/50 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                <span className="truncate max-w-[120px] font-medium text-indigo-600/80 dark:text-indigo-400/80">
                  {/* Assuming Feed is preloaded */}
                  {(article as any).Feed?.Title || "RSS"}
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                <time>{formatDistanceToNow(new Date(article.PublishedAt), { addSuffix: true, locale: ja })}</time>
              </div>
              
              <h3 className={`font-semibold text-[15px] leading-snug mb-2 ${article.IsRead ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                {!article.IsRead && (
                  <span className="inline-block align-middle mr-2 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-extrabold rounded uppercase tracking-wider shadow-sm">New</span>
                )}
                {article.Title}
              </h3>
              
              {article.Summary && (
                <div className="flex gap-2 items-start text-xs text-slate-600 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/30 p-2 rounded-lg">
                  <Sparkles size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="line-clamp-2 leading-relaxed">{article.Summary}</p>
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
