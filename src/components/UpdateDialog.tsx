import { Download, X, Tag } from "lucide-react";

interface UpdateDialogProps {
  open: boolean;
  onClose: () => void;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
}

function UpdateDialog({ open, onClose, currentVersion, latestVersion, releaseNotes, downloadUrl }: UpdateDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">发现新版本</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">当前版本</span>
            <span className="font-mono">v{currentVersion}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">最新版本</span>
            <span className="font-mono font-medium text-primary">v{latestVersion}</span>
          </div>

          {releaseNotes && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">更新日志</p>
              <div className="rounded-md bg-muted p-3 text-xs leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                {releaseNotes}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 p-4 border-t border-border">
          {downloadUrl && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Download className="h-4 w-4" />
              前往下载
            </a>
          )}
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent transition-colors"
          >
            稍后再说
          </button>
        </div>
      </div>
    </div>
  );
}

export default UpdateDialog;
