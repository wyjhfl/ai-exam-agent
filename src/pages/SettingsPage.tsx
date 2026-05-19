import { useEffect, useState } from "react";
import { Settings, Eye, EyeOff, Loader2, CheckCircle, XCircle, Info } from "lucide-react";
import { useUserStore } from "@/stores/userStore";
import { fetchLLMConfig, updateLLMConfig, testLLMConfig, resetLLMConfig } from "@/services/api";
import { toast } from "sonner";

export default function SettingsPage() {
  const { userId } = useUserStore();
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetchLLMConfig(userId)
      .then((data) => {
        setIsCustom(data.is_custom);
        setBaseUrl(data.base_url || "");
        setModel(data.model || "");
        setApiKey("");
        setLoaded(true);
      })
      .catch(() => toast.error("加载配置失败"));
  }, [userId]);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const config: Record<string, string> = {};
      if (apiKey) config.api_key = apiKey;
      if (baseUrl) config.base_url = baseUrl;
      if (model) config.model = model;
      const data = await updateLLMConfig(userId, config);
      setIsCustom(data.is_custom);
      setApiKey("");
      toast.success("配置已保存");
    } catch {
      toast.error("保存失败");
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!userId) return;
    setTesting(true);
    setTestResult(null);
    try {
      const data = await testLLMConfig(userId);
      setTestResult({ success: data.success, message: data.message });
    } catch {
      setTestResult({ success: false, message: "测试请求失败" });
    }
    setTesting(false);
  };

  const handleReset = async () => {
    if (!userId) return;
    try {
      await resetLLMConfig(userId);
      setIsCustom(false);
      setApiKey("");
      setBaseUrl("");
      setModel("");
      setTestResult(null);
      toast.success("已恢复使用全局默认配置");
    } catch {
      toast.error("恢复失败");
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 md:p-6 overflow-y-auto space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">设置</h2>
      </div>

      <div className="rounded-lg border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">AI 模型配置</h3>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              isCustom
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isCustom ? "使用自定义配置" : "使用全局默认"}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">API Key</label>
            <div className="relative mt-1">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={isCustom ? "已配置（留空保持不变）" : "留空使用全局默认"}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent"
              >
                {showKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="例如 https://api.openai.com/v1"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="例如 gpt-4o-mini, deepseek-chat"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
            />
          </div>
        </div>

        {testResult && (
          <div
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
              testResult.success
                ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
            }`}
          >
            {testResult.success ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
            {testResult.message}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleTest}
            disabled={testing}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50 flex items-center gap-1.5"
          >
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
            测试连接
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
            保存配置
          </button>
          <button
            onClick={handleReset}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent text-muted-foreground"
          >
            恢复默认
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">配置说明</h3>
        </div>
        <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
          <li>支持所有 OpenAI 兼容 API（OpenAI、DeepSeek、通义千问、智谱、小米 MiMo 等）</li>
          <li>配置后所有 AI 功能（对话、出题、批改等）将使用您的 API</li>
          <li>留空则使用系统默认 API</li>
          <li>API Key 仅存储在本地服务器，不会上传到第三方</li>
        </ul>
      </div>
    </div>
  );
}
