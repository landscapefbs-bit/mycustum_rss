import { useState } from 'react';
import Sidebar from './components/Sidebar';
import ArticleList from './components/ArticleList';
import ArticleViewer from './components/ArticleViewer';

export type Article = {
  ID: number;
  FeedID: number;
  Title: string;
  URL: string;
  Content: string;
  Summary: string;
  Tags: string;
  PublishedAt: string;
  IsRead: boolean;
  IsFavorite: boolean;
  IsSaved: boolean;
  IsArchived: boolean;
};

export type Feed = {
  ID: number;
  Title: string;
  URL: string;
  Description: string;
  SortOrder: number;
  FetchInterval: number;
  RetentionDays: number;
  UnreadCount?: number;
};

export default function App() {
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-300">
      <Sidebar 
        selectedFeedId={selectedFeedId} 
        onSelectFeed={(id) => { setSelectedFeedId(id); setSelectedArticle(null); }} 
      />
      
      <div className="flex flex-1 overflow-hidden shadow-2xl z-10 sm:rounded-l-3xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
        <ArticleList 
          feedId={selectedFeedId} 
          selectedArticleId={selectedArticle?.ID}
          onSelectArticle={(article) => setSelectedArticle(article)} 
        />
        
        <ArticleViewer article={selectedArticle} />
      </div>
    </div>
  );
}
