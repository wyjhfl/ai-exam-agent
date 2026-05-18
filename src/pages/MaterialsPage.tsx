import { useEffect, useState, useRef, useCallback } from "react";
import { Upload, Trash2, RefreshCw, FileText, File, FolderOpen, Loader2, Search, Download, BookOpen, ExternalLink } from "lucide-react";
import { useUserStore } from "@/stores/userStore";
import { uploadFile, fetchUploads, deleteUpload, reindexUpload, searchResources, downloadResource, generateFromUrl } from "@/services/api";
import { toast } from "sonner";

interface UploadedFile {
  file_id: string;
  filename: string;
  size: number;
  modified: string;
  indexed: boolean;
}

interface SearchResult {
  title: string;
  url: string;
  description: string;
  source_domain: string;
}

const SUBJECTS = ["全部", "政治", "英语", "数学"];
const FILE_TYPES = ["教辅资料", "历年真题", "模拟卷", "习题集"];
const ALLOWED_EXTS = [".pdf", ".docx", ".doc", ".txt", ".md"];

function MaterialsPage() {
  const { userId } = useUserStore();
  const [activeTab, setActiveTab] = useState<"files" | "search">("files");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [subjectFilter, setSubjectFilter] = useState("全部");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState("数学");
  const [selectedFileType, setSelectedFileType] = useState("教辅资料");
  const [dragOver, setDragOver] = useState(false);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchSubject, setSearchSubject] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const [generatingUrl, setGeneratingUrl] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await fetchUploads(userId);
      setFiles(data.files || []);
    } catch {
      toast.error("加载文件列表失败");
    }
  }, [userId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !userId) return;
    const file = fileList[0];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      toast.error(`不支持的格式: ${ext}，支持: ${ALLOWED_EXTS.join(", ")}`);
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadFile(userId, selectedSubject, selectedFileType, file, setProgress);
      toast.success(`上传成功！${result.filename} (${result.chunks} 个文本块)`);
      loadFiles();
    } catch (e: any) {
      toast.error(e.message || "上传失败");
    }
    setUploading(false);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (fileId: string) => {
    if (!userId) return;
    try {
      await deleteUpload(userId, fileId);
      toast.success("文件已删除");
      loadFiles();
    } catch {
      toast.error("删除失败");
    }
  };

  const handleReindex = async (fileId: string) => {
    if (!userId) return;
    setReindexingId(fileId);
    try {
      const result = await reindexUpload(userId, fileId);
      toast.success(`重新索引完成，${result.chunks} 个文本块`);
      loadFiles();
    } catch {
      toast.error("重新索引失败");
    }
    setReindexingId(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await searchResources(searchQuery, searchSubject || undefined);
      setSearchResults(data.results || []);
      if (data.error) toast.error(data.error);
    } catch {
      toast.error("搜索失败");
    }
    setSearching(false);
  };

  const handleDownload = async (url: string, _domain: string) => {
    if (!userId) return;
    setDownloadingUrl(url);
    try {
      const result = await downloadResource(url, userId, searchSubject || "数学", "教辅资料");
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`下载成功！${result.filename} (${result.chunks} 个文本块)`);
        setActiveTab("files");
        loadFiles();
      }
    } catch {
      toast.error("下载失败");
    }
    setDownloadingUrl(null);
  };

  const handleGenerateFromUrl = async (url: string) => {
    setGeneratingUrl(url);
    try {
      const result = await generateFromUrl(url, searchSubject || "数学", "single_choice", 5);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`成功生成 ${result.total} 道题目`);
      }
    } catch {
      toast.error("生成题目失败");
    }
    setGeneratingUrl(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredFiles = subjectFilter === "全部"
    ? files
    : files.filter((f) => f.filename.includes(subjectFilter) || f.file_id.includes(subjectFilter));

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          资料管理
        </h2>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("files")}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${activeTab === "files" ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/80"}`}
          >
            我的文件
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={`px-3 py-1 rounded-md text-sm transition-colors flex items-center gap-1 ${activeTab === "search" ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/80"}`}
          >
            <Search className="h-3.5 w-3.5" />
            在线搜索
          </button>
        </div>
      </div>

      {activeTab === "files" && (
        <>
          <div className="flex gap-1">
            {SUBJECTS.map((s) => (
              <button
                key={s}
                onClick={() => setSubjectFilter(s)}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                  subjectFilter === s ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/80"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt,.md"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">拖拽文件到此处或点击选择</p>
            <p className="text-xs text-muted-foreground mt-1">支持 PDF、DOCX、DOC、TXT、MD 格式</p>

            <div className="flex items-center justify-center gap-3 mt-4" onClick={(e) => e.stopPropagation()}>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {["政治", "英语", "数学"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={selectedFileType}
                onChange={(e) => setSelectedFileType(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {FILE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {uploading && (
              <div className="mt-4">
                <div className="w-full bg-accent rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">上传中... {progress}%</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">已上传文件 ({filteredFiles.length})</h3>
            {filteredFiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">暂无上传文件</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {filteredFiles.map((f) => (
                  <div key={f.file_id} className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors">
                    <div className="mt-0.5">
                      {f.filename.endsWith(".pdf") ? (
                        <FileText className="h-5 w-5 text-red-500" />
                      ) : (
                        <File className="h-5 w-5 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.filename}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{formatSize(f.size)}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(f.modified).toLocaleDateString()}
                        </span>
                        {f.indexed ? (
                          <span className="text-xs text-green-600">已索引</span>
                        ) : (
                          <span className="text-xs text-amber-600">未索引</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleReindex(f.file_id)}
                        disabled={reindexingId === f.file_id}
                        className="p-1.5 rounded hover:bg-accent transition-colors"
                        title="重新索引"
                      >
                        {reindexingId === f.file_id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(f.file_id)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
            <p>知识库状态：共 {files.length} 个文件 · {files.filter((f) => f.indexed).length} 个已索引</p>
          </div>
        </>
      )}

      {activeTab === "search" && (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="搜索考研资料，如：高等数学极限"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={searchSubject}
              onChange={(e) => setSearchSubject(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-2 text-sm"
            >
              <option value="">全部科目</option>
              <option value="数学">数学</option>
              <option value="英语">英语</option>
              <option value="政治">政治</option>
            </select>
            <button
              onClick={handleSearch}
              disabled={searching}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              搜索
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">找到 {searchResults.length} 个结果</p>
              {searchResults.map((r, i) => (
                <div key={i} className="rounded-lg border border-border p-3 space-y-2 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start gap-2">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline flex-1 line-clamp-2"
                    >
                      {r.title}
                      <ExternalLink className="inline h-3 w-3 ml-1" />
                    </a>
                  </div>
                  {r.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{r.source_domain}</span>
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => handleDownload(r.url, r.source_domain)}
                        disabled={downloadingUrl === r.url}
                        className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20 disabled:opacity-50"
                      >
                        {downloadingUrl === r.url ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                        下载并索引
                      </button>
                      <button
                        onClick={() => handleGenerateFromUrl(r.url)}
                        disabled={generatingUrl === r.url}
                        className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs hover:bg-accent/80 disabled:opacity-50"
                      >
                        {generatingUrl === r.url ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
                        生成题目
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {searchResults.length === 0 && !searching && searchQuery && (
            <div className="text-center py-8 text-muted-foreground text-sm">输入关键词搜索考研相关资料</div>
          )}
        </>
      )}
    </div>
  );
}

export default MaterialsPage;
