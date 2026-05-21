import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Timer } from "lucide-react";
import { startFocus, completeFocus, fetchTodayFocus } from "@/services/api";
import { useUserStore } from "@/stores/userStore";
import { toast } from "sonner";

const DURATIONS = [15, 25, 45, 60];
const SUBJECTS = ["数学", "英语", "政治", "专业课"];

type FocusState = "idle" | "running" | "paused";

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.8);
  } catch {
    // Web Audio API not available
  }
}

function FocusPage() {
  const { userId } = useUserStore();
  const [duration, setDuration] = useState(25);
  const [subject, setSubject] = useState("数学");
  const [state, setState] = useState<FocusState>("idle");
  const [remaining, setRemaining] = useState(25 * 60);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const totalSeconds = duration * 60;
  const progress = (totalSeconds - remaining) / totalSeconds;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const loadTodayStats = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await fetchTodayFocus();
      setTodayMinutes(data.total_minutes);
      setTodayCount(data.count);
    } catch {
      // ignore
    }
  }, [userId]);

  useEffect(() => {
    loadTodayStats();
  }, [loadTodayStats]);

  useEffect(() => {
    if (state === "running") {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            handleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state]);

  const handleStart = async () => {
    if (!userId) {
      toast.error("请先登录");
      return;
    }
    try {
      const data = await startFocus(subject, duration);
      setSessionId(data.session_id);
      startTimeRef.current = Date.now();
      setRemaining(duration * 60);
      setState("running");
    } catch {
      toast.error("启动专注失败");
    }
  };

  const handleComplete = async () => {
    setState("idle");
    playNotificationSound();
    toast.success("专注完成！休息一下吧 🎉");

    if (sessionId) {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 60000);
      const actualDuration = Math.min(elapsed, duration);
      try {
        await completeFocus(sessionId, actualDuration);
      } catch {
        // ignore
      }
      setSessionId(null);
    }
    loadTodayStats();
  };

  const handlePause = () => setState("paused");
  const handleResume = () => setState("running");

  const handleReset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState("idle");
    setRemaining(duration * 60);
    setSessionId(null);
  };

  const handleDurationChange = (newDuration: number) => {
    if (state !== "idle") return;
    setDuration(newDuration);
    setRemaining(newDuration * 60);
  };

  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full flex flex-col items-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
          <Timer className="h-6 w-6" />
          番茄专注
        </h1>
        <p className="text-muted-foreground mt-1">专注学习，高效备考</p>
      </div>

      <div className="relative w-64 h-64 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 260 260">
          <circle
            cx="130"
            cy="130"
            r="120"
            fill="none"
            stroke="currentColor"
            className="text-muted/20"
            strokeWidth="8"
          />
          <circle
            cx="130"
            cy="130"
            r="120"
            fill="none"
            stroke="currentColor"
            className="text-primary"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-mono font-bold tabular-nums">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
          <span className="text-sm text-muted-foreground mt-1">
            {state === "idle" ? "准备开始" : state === "running" ? "专注中..." : "已暂停"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {DURATIONS.map((d) => (
          <button
            key={d}
            onClick={() => handleDurationChange(d)}
            disabled={state !== "idle"}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              duration === d
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-accent"
            } ${state !== "idle" ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {d}分钟
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {SUBJECTS.map((s) => (
          <button
            key={s}
            onClick={() => state === "idle" && setSubject(s)}
            disabled={state !== "idle"}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              subject === s
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-accent"
            } ${state !== "idle" ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {state === "idle" && (
          <button
            onClick={handleStart}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Play className="h-5 w-5" />
            开始专注
          </button>
        )}
        {state === "running" && (
          <button
            onClick={handlePause}
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-3 text-white hover:bg-amber-600 transition-colors"
          >
            <Pause className="h-5 w-5" />
            暂停
          </button>
        )}
        {state === "paused" && (
          <button
            onClick={handleResume}
            className="flex items-center gap-2 rounded-lg bg-green-500 px-6 py-3 text-white hover:bg-green-600 transition-colors"
          >
            <Play className="h-5 w-5" />
            继续
          </button>
        )}
        {state !== "idle" && (
          <button
            onClick={handleReset}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-3 hover:bg-accent transition-colors"
          >
            <RotateCcw className="h-5 w-5" />
            重置
          </button>
        )}
      </div>

      <div className="rounded-lg border border-border p-4 w-full max-w-md text-center">
        <p className="text-sm text-muted-foreground">
          今日已专注{" "}
          <span className="font-bold text-foreground">
            {Math.floor(todayMinutes / 60)}小时{todayMinutes % 60}分钟
          </span>
          ，共{" "}
          <span className="font-bold text-foreground">{todayCount}</span>{" "}
          次
        </p>
      </div>
    </div>
  );
}

export default FocusPage;
