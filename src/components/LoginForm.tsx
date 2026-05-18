import { useState } from "react";
import { useUserStore } from "@/stores/userStore";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";

function LoginForm() {
  const { login, register } = useUserStore();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("请输入用户名和密码");
      return;
    }
    if (password.length < 4) {
      toast.error("密码至少4位");
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        await login(username, password);
        toast.success("登录成功");
      } else {
        await register(username, password);
        toast.success("注册成功");
      }
    } catch {
      // error handled by interceptor
    }
    setLoading(false);
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 rounded-xl border border-border bg-card">
        <div className="text-center space-y-2">
          <BookOpen className="h-10 w-10 mx-auto text-primary" />
          <h1 className="text-xl font-bold">AI 考研备考智能体</h1>
          <p className="text-sm text-muted-foreground">{isLogin ? "登录你的账号" : "注册新账号"}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="请输入用户名"
            />
          </div>
          <div>
            <label className="text-sm font-medium">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="请输入密码"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "处理中..." : isLogin ? "登录" : "注册"}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? "没有账号？" : "已有账号？"}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:underline ml-1"
          >
            {isLogin ? "注册" : "登录"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default LoginForm;
