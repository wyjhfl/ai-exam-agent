import { useEffect, useState } from "react";
import { Users, ThumbsUp, MessageCircle, Plus, X, Loader2, ChevronLeft } from "lucide-react";
import { useUserStore } from "@/stores/userStore";
import { fetchCommunityPosts, fetchCommunityPost, communityShare, likeCommunityPost, commentCommunityPost } from "@/services/api";
import { toast } from "sonner";

interface Post {
  id: number;
  user_id: number;
  username: string;
  title: string;
  content: string;
  item_type: string;
  subject: string;
  likes: number;
  comment_count: number;
  created_at: string;
}

interface Comment {
  id: number;
  user_id: number;
  username: string;
  content: string;
  created_at: string;
}

interface PostDetail extends Post {
  comments: Comment[];
}

const SUBJECTS = ["全部", "政治", "英语", "数学"];
const TYPE_LABELS: Record<string, string> = {
  wrong_question: "错题",
  experience: "经验",
  note: "笔记",
};

function CommunityPage() {
  const { userId } = useUserStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [postDetail, setPostDetail] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("数学");
  const [selectedType, setSelectedType] = useState("experience");
  const [submitting, setSubmitting] = useState(false);
  const [commentText, setCommentText] = useState("");

  const loadPosts = async () => {
    setLoading(true);
    try {
      const data = await fetchCommunityPosts(subjectFilter || undefined, typeFilter || undefined);
      setPosts(data.posts || []);
    } catch {
      toast.error("加载社区帖子失败");
    }
    setLoading(false);
  };

  const loadPostDetail = async (postId: number) => {
    try {
      const data = await fetchCommunityPost(postId);
      setPostDetail(data);
      setSelectedPostId(postId);
    } catch {
      toast.error("加载详情失败");
    }
  };

  useEffect(() => {
    loadPosts();
  }, [subjectFilter, typeFilter]);

  const handleShare = async () => {
    if (!userId || !newTitle.trim() || !newContent.trim()) return;
    setSubmitting(true);
    try {
      await communityShare(newTitle, newContent, selectedType, selectedSubject);
      toast.success("分享成功！");
      setShowForm(false);
      setNewTitle("");
      setNewContent("");
      loadPosts();
    } catch {
      toast.error("分享失败");
    }
    setSubmitting(false);
  };

  const handleLike = async (postId: number) => {
    try {
      await likeCommunityPost(postId);
      if (postDetail && selectedPostId === postId) {
        setPostDetail({ ...postDetail, likes: postDetail.likes + 1 });
      }
      loadPosts();
    } catch {
      toast.error("点赞失败");
    }
  };

  const handleComment = async () => {
    if (!userId || !commentText.trim() || !selectedPostId) return;
    try {
      await commentCommunityPost(selectedPostId, commentText);
      setCommentText("");
      loadPostDetail(selectedPostId);
    } catch {
      toast.error("评论失败");
    }
  };

  if (selectedPostId && postDetail) {
    return (
      <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-4">
        <button onClick={() => { setSelectedPostId(null); setPostDetail(null); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> 返回列表
        </button>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs">{postDetail.subject}</span>
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs">{TYPE_LABELS[postDetail.item_type] || postDetail.item_type}</span>
            <span className="text-xs text-muted-foreground ml-auto">{postDetail.username} · {new Date(postDetail.created_at).toLocaleDateString()}</span>
          </div>
          <h2 className="text-lg font-semibold">{postDetail.title}</h2>
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{postDetail.content}</div>
          <div className="flex items-center gap-4 pt-2 border-t border-border">
            <button onClick={() => handleLike(postDetail.id)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
              <ThumbsUp className="h-4 w-4" /> {postDetail.likes}
            </button>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <MessageCircle className="h-4 w-4" /> {postDetail.comments?.length || 0}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">评论</h3>
          {postDetail.comments?.map((c) => (
            <div key={c.id} className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span className="font-medium text-foreground">{c.username}</span>
                <span>{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm">{c.content}</p>
            </div>
          ))}
          {(!postDetail.comments || postDetail.comments.length === 0) && (
            <p className="text-sm text-muted-foreground">暂无评论</p>
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleComment()}
            placeholder="写评论..."
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button onClick={handleComment} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">
            发送
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" />
          备考社区
        </h2>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "取消" : "发帖"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUBJECTS.map((s) => (
          <button key={s} onClick={() => setSubjectFilter(s)} className={`px-3 py-1 rounded-full text-xs transition-colors ${subjectFilter === s ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/80"}`}>
            {s}
          </button>
        ))}
        <div className="h-4 w-px bg-border mx-1" />
        {Object.entries(TYPE_LABELS).map(([k, v]) => (
          <button key={k} onClick={() => setTypeFilter(k)} className={`px-3 py-1 rounded-full text-xs transition-colors ${typeFilter === k ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/80"}`}>
            {v}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="标题" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="分享你的备考经验、错题或笔记..." rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          <div className="flex items-center gap-3">
            <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-sm">
              <option value="政治">政治</option>
              <option value="英语">英语</option>
              <option value="数学">数学</option>
            </select>
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-sm">
              <option value="wrong_question">错题</option>
              <option value="experience">经验</option>
              <option value="note">笔记</option>
            </select>
            <button onClick={handleShare} disabled={submitting} className="ml-auto rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1">
              {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              发布
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : posts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">暂无帖子，来发第一帖吧！</div>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <div key={p.id} onClick={() => loadPostDetail(p.id)} className="rounded-lg border border-border p-4 hover:bg-accent/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs">{p.subject}</span>
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs">{TYPE_LABELS[p.item_type] || p.item_type}</span>
                <span className="text-xs text-muted-foreground ml-auto">{p.username} · {new Date(p.created_at).toLocaleDateString()}</span>
              </div>
              <h3 className="font-medium text-sm mb-1">{p.title}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2">{p.content}</p>
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><ThumbsUp className="h-3 w-3" /> {p.likes}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><MessageCircle className="h-3 w-3" /> {p.comment_count}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CommunityPage;
