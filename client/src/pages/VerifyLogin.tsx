/**
 * 新设备登录等待确认页面
 * 当新设备登录时，需要旧设备确认才能完成登录
 * 此页面在新设备上显示，轮询检查旧设备是否已同意
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@/components/ui/spinner";

export default function VerifyLogin() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "expired" | "not_found">("pending");
  const [countdown, setCountdown] = useState(60);

  // 从URL获取参数
  const params = new URLSearchParams(window.location.search);
  const requestId = params.get("pendingLogin") || "";
  const userId = parseInt(params.get("userId") || "0");

  // 轮询检查登录状态
  const { data: loginStatus } = trpc.auth.checkLoginStatus.useQuery(
    { requestId, userId },
    { 
      enabled: !!requestId && !!userId && status === "pending",
      refetchInterval: 2000, // 每2秒检查一次
    }
  );

  // 确认登录mutation
  const confirmLogin = trpc.auth.confirmLogin.useMutation({
    onSuccess: () => {
      // 登录成功，跳转到首页
      window.location.href = "/";
    },
    onError: () => {
      setStatus("expired");
    },
  });

  // 监听状态变化
  useEffect(() => {
    if (!loginStatus) return;
    
    if (loginStatus.status === "approved") {
      setStatus("approved");
      // 自动确认登录
      confirmLogin.mutate({ requestId, userId });
    } else if (loginStatus.status === "rejected") {
      setStatus("rejected");
    } else if (loginStatus.status === "expired" || loginStatus.status === "not_found") {
      setStatus(loginStatus.status);
    }
  }, [loginStatus]);

  // 倒计时
  useEffect(() => {
    if (status !== "pending") return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  // 超时自动通过后刷新
  useEffect(() => {
    if (countdown === 0 && status === "pending") {
      // 超时后再检查一次
      setTimeout(() => {
        if (status === "pending") {
          confirmLogin.mutate({ requestId, userId });
        }
      }, 2000);
    }
  }, [countdown, status]);

  if (status === "rejected") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-6">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-xl font-bold mb-2">登录被拒绝</h1>
          <p className="text-gray-400 mb-6">
            您的账号在其他设备上拒绝了此次登录请求。
          </p>
          <button
            onClick={() => setLocation("/")}
            className="px-6 py-3 bg-blue-600 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  if (status === "expired" || status === "not_found") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-6">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">⏰</div>
          <h1 className="text-xl font-bold mb-2">请求已过期</h1>
          <p className="text-gray-400 mb-6">
            登录请求已过期，请重新登录。
          </p>
          <button
            onClick={() => setLocation("/")}
            className="px-6 py-3 bg-blue-600 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            重新登录
          </button>
        </div>
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-6">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-xl font-bold mb-2">登录已确认</h1>
          <p className="text-gray-400">正在进入游戏...</p>
          <Spinner className="mt-4" />
        </div>
      </div>
    );
  }

  // 等待中
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-6">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">📱</div>
        <h1 className="text-xl font-bold mb-2">等待设备确认</h1>
        <p className="text-gray-400 mb-4">
          您的账号正在其他设备上登录中，请在原设备上确认此次登录。
        </p>
        <div className="flex items-center justify-center gap-2 mb-6">
          <Spinner />
          <span className="text-sm text-gray-500">
            等待确认中... {countdown > 0 ? `(${countdown}s)` : "超时自动通过"}
          </span>
        </div>
        <p className="text-xs text-gray-600">
          如果60秒内未收到确认，将自动允许登录。
        </p>
      </div>
    </div>
  );
}
