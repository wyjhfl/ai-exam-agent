import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, BookMarked, MessageSquare, FolderOpen, X } from "lucide-react";
import { globalSearch } from "@/services/api";
import { useUserStore } from "@/stores/userStore";

interface SearchResult {
  type: string;
  title: string;
  snippet: string;
  id: number;
  created_at: string | null;
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

const typeFilters = [
  { key: "all", label: "全部" },
  { key: "questions", label: "题目" },
  { key: "chats", label: "对话" },
  { key: "materials", label: "资料" },
];

const typeIcons: Record<string, typeof BookMarked> = {
  question: BookMarked,
  chat: MessageSquare,
  material: FolderOpen,
};

const typeRoutes: Record<string, string> = {
  question: "/quiz",
  chat: "/chat",
  material: "/materials",
};

function SearchModal({ open, onClose }: SearchModalProps) {
  const navigate = useNavigate();
  const { userId } = useUserStore();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setType("all");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }
      if (e.key === "Enter" && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, selectedIndex]);

  useEffect(() => {
    if (!query.trim() || !userId) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await globalSearch(query, type);
        setResults(data.results || []);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, type, userId]);

  const handleSelect = (item: SearchResult) => {
    const route = typeRoutes[item.type] || "/";
    navigate(route);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-lg bg-card border border-border rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索题目、对话、资料..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex gap-1 px-4 py-2 border-b border-border">
          {typeFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setType(f.key)}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                type === f.key ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="max-h-72 overflow-y-auto">
          {loading && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">搜索中...</div>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">未找到相关结果</div>
          )}
          {!loading && !query.trim() && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">输入关键词开始搜索</div>
          )}
          {!loading &&
            results.map((item, i) => {
              const Icon = typeIcons[item.type] || Search;
              return (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleSelect(item)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                    i === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.snippet}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {item.type === "question" ? "题目" : item.type === "chat" ? "对话" : "资料"}
                  </span>
                </button>
              );
            })}
        </div>

        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
          <span>↑↓ 导航</span>
          <span>↵ 选择</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  );
}

export default SearchModal;
