/** 管理员登录页面 */
import { useState } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, LogIn, Shield } from "lucide-react";
import { toast } from "sonner";

const BG_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663286442691/PcTA5UMUHYgGBBmnDjVX7Q/admin-login-bg-muXScYaUbYgBctzMt8s2Zo.webp";

export default function StaffLogin() {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("请输入用户名和密码");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "登录失败");
        return;
      }
      toast.success(`欢迎回来，${data.user.name}`);
      navigate("/admin");
      window.location.reload();
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-end"
      style={{
        backgroundImage: `url(${BG_URL})`,
        backgroundSize: "cover",
        backgroundPosition: "center left",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Right-side login panel */}
      <div className="relative z-10 w-full max-w-sm mr-[8vw] my-8">
        {/* Glassmorphism card */}
        <div
          className="rounded-2xl p-8 shadow-2xl"
          style={{
            background: "rgba(8, 15, 35, 0.85)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
            boxShadow: "0 0 40px rgba(59, 130, 246, 0.15), 0 25px 50px rgba(0,0,0,0.5)",
          }}
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{
                background: "linear-gradient(135deg, #1e40af 0%, #eab308 100%)",
                boxShadow: "0 0 20px rgba(234, 179, 8, 0.4)",
              }}
            >
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1
              className="text-2xl font-bold"
              style={{
                background: "linear-gradient(90deg, #60a5fa, #eab308)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Vera 管理后台
            </h1>
            <p className="text-sm mt-1" style={{ color: "rgba(148,163,184,0.8)" }}>
              员工安全登录
            </p>
          </div>

          {/* Divider */}
          <div
            className="h-px mb-6"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent)",
            }}
          />

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "rgba(148,163,184,0.9)" }}>
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入员工账号"
                className="w-full px-4 py-3 rounded-xl text-white placeholder:text-slate-500 focus:outline-none transition-all"
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.3)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(59, 130, 246, 0.7)";
                  e.currentTarget.style.boxShadow = "0 0 10px rgba(59,130,246,0.2), inset 0 1px 3px rgba(0,0,0,0.3)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(59, 130, 246, 0.3)";
                  e.currentTarget.style.boxShadow = "inset 0 1px 3px rgba(0,0,0,0.3)";
                }}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "rgba(148,163,184,0.9)" }}>
                密码
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full px-4 py-3 pr-12 rounded-xl text-white placeholder:text-slate-500 focus:outline-none transition-all"
                  style={{
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.3)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.border = "1px solid rgba(59, 130, 246, 0.7)";
                    e.currentTarget.style.boxShadow = "0 0 10px rgba(59,130,246,0.2), inset 0 1px 3px rgba(0,0,0,0.3)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.border = "1px solid rgba(59, 130, 246, 0.3)";
                    e.currentTarget.style.boxShadow = "inset 0 1px 3px rgba(0,0,0,0.3)";
                  }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "rgba(148,163,184,0.6)" }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              style={{
                background: loading
                  ? "rgba(30,64,175,0.5)"
                  : "linear-gradient(135deg, #1d4ed8 0%, #eab308 100%)",
                color: "white",
                boxShadow: loading ? "none" : "0 0 20px rgba(59,130,246,0.3)",
                transform: "scale(1)",
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>登录</span>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate("/")}
              className="text-xs transition-colors"
              style={{ color: "rgba(100,116,139,0.8)" }}
            >
              ← 返回首页
            </button>
          </div>
        </div>

        {/* Bottom glow */}
        <div
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-1 rounded-full blur-sm"
          style={{ background: "linear-gradient(90deg, transparent, #3b82f6, #eab308, transparent)" }}
        />
      </div>
    </div>
  );
}
