import React, { useState, useEffect } from "react";
import { Phone, Database, Cpu, Terminal, Sparkles, RefreshCw, Layers } from "lucide-react";
import WeChatSimulator from "./components/WeChatSimulator";
import AdminDashboard from "./components/AdminDashboard";

interface APILog {
  timestamp: string;
  method: string;
  url: string;
  status: 'pending' | 'success' | 'error';
  payload?: any;
}

export default function App() {
  // Master active view: 'simulator' | 'dashboard'
  const [activeView, setActiveView] = useState<'simulator' | 'dashboard'>("simulator");
  const [db, setDb] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [apiLogs, setApiLogs] = useState<APILog[]>([]);

  // Push an API log entry for the debugger terminal
  const logAPI = (method: string, url: string, payload?: any, status: 'pending' | 'success' | 'error' = 'pending') => {
    const newLog: APILog = {
      timestamp: new Date().toLocaleTimeString(),
      method,
      url,
      status,
      payload
    };
    setApiLogs(prev => [newLog, ...prev.slice(0, 19)]); // Keep last 20 logs
  };

  // Fetch complete DB State from server
  const fetchDB = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const start = Date.now();
      const res = await fetch("/api/db");
      const data = await res.json();
      setDb(data);
      if (!isSilent) {
        logAPI("GET", "/api/db", null, "success");
      }
    } catch (e) {
      console.error("Failed to fetch database state", e);
      logAPI("GET", "/api/db", null, "error");
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDB();
    // Poll silently every 10 seconds to keep views perfectly synchronized
    const interval = setInterval(() => fetchDB(true), 10000);
    return () => clearInterval(interval);
  }, []);

  // --- API Mutators ---

  const handleUpdateProfile = async (profile: any) => {
    logAPI("POST", "/api/profile", profile, "pending");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile)
      });
      const data = await res.json();
      logAPI("POST", "/api/profile", data, "success");
      return data;
    } catch (e) {
      logAPI("POST", "/api/profile", e, "error");
      throw e;
    }
  };

  const handleCloneVoice = async (voiceData: { name: string; speakerType: string; recordDuration: number }) => {
    logAPI("POST", "/api/voice/clone", voiceData, "pending");
    try {
      const res = await fetch("/api/voice/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(voiceData)
      });
      const data = await res.json();
      if (res.ok) {
        logAPI("POST", "/api/voice/clone", data, "success");
      } else {
        logAPI("POST", "/api/voice/clone", data, "error");
      }
      return data;
    } catch (e) {
      logAPI("POST", "/api/voice/clone", e, "error");
      throw e;
    }
  };

  const handleDeleteVoice = async (id: string) => {
    logAPI("POST", "/api/voice/delete", { id }, "pending");
    try {
      const res = await fetch("/api/voice/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      logAPI("POST", "/api/voice/delete", data, "success");
      return data;
    } catch (e) {
      logAPI("POST", "/api/voice/delete", e, "error");
      throw e;
    }
  };

  const handleGenerateStoryText = async (data: { theme: string; educationalGoal: string; scene: string; mainCharacter: any; mainCharacters?: any[]; duration: string; age: number; isRetry: boolean; retryCount?: number }) => {
    logAPI("POST", "/api/story/generate-text", data, "pending");
    try {
      const res = await fetch("/api/story/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (res.ok) {
        logAPI("POST", "/api/story/generate-text", { title: result.story?.title }, "success");
      } else {
        logAPI("POST", "/api/story/generate-text", result, "error");
      }
      return result;
    } catch (e) {
      logAPI("POST", "/api/story/generate-text", e, "error");
      throw e;
    }
  };

  const handleGenerateStoryAudio = async (data: { story: any; voiceId: string; voiceMode: string; theme: string; educationalGoal: string; scene: string; mainCharacterName: string; duration: string; targetAge: number; bgmType?: string }) => {
    logAPI("POST", "/api/story/generate-audio", { title: data.story?.title, voiceId: data.voiceId }, "pending");
    try {
      const res = await fetch("/api/story/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      logAPI("POST", "/api/story/generate-audio", { id: result.savedStory?.id }, "success");
      return result;
    } catch (e) {
      logAPI("POST", "/api/story/generate-audio", e, "error");
      throw e;
    }
  };

  const handleSaveStoryToggle = async (id: string, type: 'favorite' | 'diary') => {
    logAPI("POST", "/api/story/save-toggle", { id, type }, "pending");
    try {
      const res = await fetch("/api/story/save-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type })
      });
      const result = await res.json();
      logAPI("POST", "/api/story/save-toggle", result, "success");
      return result;
    } catch (e) {
      logAPI("POST", "/api/story/save-toggle", e, "error");
      throw e;
    }
  };

  const handleDeleteStory = async (id: string) => {
    logAPI("POST", "/api/story/delete", { id }, "pending");
    try {
      const res = await fetch("/api/story/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const result = await res.json();
      logAPI("POST", "/api/story/delete", result, "success");
      return result;
    } catch (e) {
      logAPI("POST", "/api/story/delete", e, "error");
      throw e;
    }
  };

  const handleRenameStory = async (id: string, title: string) => {
    logAPI("POST", "/api/story/rename", { id, title }, "pending");
    try {
      const res = await fetch("/api/story/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title })
      });
      const result = await res.json();
      logAPI("POST", "/api/story/rename", result, "success");
      return result;
    } catch (e) {
      logAPI("POST", "/api/story/rename", e, "error");
      throw e;
    }
  };

  const handleRedeemCDKey = async (code: string) => {
    logAPI("POST", "/api/cdkey/redeem", { code }, "pending");
    try {
      const res = await fetch("/api/cdkey/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const result = await res.json();
      if (res.ok) {
        logAPI("POST", "/api/cdkey/redeem", result, "success");
      } else {
        logAPI("POST", "/api/cdkey/redeem", result, "error");
      }
      return result;
    } catch (e) {
      logAPI("POST", "/api/cdkey/redeem", e, "error");
      throw e;
    }
  };

  const handleBindReferral = async (code: string) => {
    logAPI("POST", "/api/referral/bind", { code }, "pending");
    try {
      const res = await fetch("/api/referral/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const result = await res.json();
      if (res.ok) {
        logAPI("POST", "/api/referral/bind", result, "success");
      } else {
        logAPI("POST", "/api/referral/bind", result, "error");
      }
      return result;
    } catch (e) {
      logAPI("POST", "/api/referral/bind", e, "error");
      throw e;
    }
  };

  const handleReadAllNotifications = async () => {
    logAPI("POST", "/api/notifications/read-all", null, "pending");
    try {
      const res = await fetch("/api/notifications/read-all", { method: "POST" });
      const result = await res.json();
      logAPI("POST", "/api/notifications/read-all", result, "success");
      return result;
    } catch (e) {
      logAPI("POST", "/api/notifications/read-all", e, "error");
      throw e;
    }
  };

  const handleDeleteNotification = async (id: string) => {
    logAPI("POST", "/api/notifications/delete", { id }, "pending");
    try {
      const res = await fetch("/api/notifications/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const result = await res.json();
      logAPI("POST", "/api/notifications/delete", result, "success");
      return result;
    } catch (e) {
      logAPI("POST", "/api/notifications/delete", e, "error");
      throw e;
    }
  };

  // --- Admin Specific Mutators ---

  const handleAdminResetDb = async () => {
    logAPI("POST", "/api/admin/reset", null, "pending");
    try {
      const res = await fetch("/api/admin/reset", { method: "POST" });
      const result = await res.json();
      logAPI("POST", "/api/admin/reset", result, "success");
      return result;
    } catch (e) {
      logAPI("POST", "/api/admin/reset", e, "error");
      throw e;
    }
  };

  const handleAdminAddTemplate = async (tpl: any) => {
    logAPI("POST", "/api/admin/template/add", tpl, "pending");
    try {
      const res = await fetch("/api/admin/template/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tpl)
      });
      const result = await res.json();
      logAPI("POST", "/api/admin/template/add", result, "success");
      return result;
    } catch (e) {
      logAPI("POST", "/api/admin/template/add", e, "error");
      throw e;
    }
  };

  const handleAdminDeleteTemplate = async (id: string) => {
    logAPI("POST", "/api/admin/template/delete", { id }, "pending");
    try {
      const res = await fetch("/api/admin/template/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const result = await res.json();
      logAPI("POST", "/api/admin/template/delete", result, "success");
      return result;
    } catch (e) {
      logAPI("POST", "/api/admin/template/delete", e, "error");
      throw e;
    }
  };

  const handleAdminToggleTemplateRecommend = async (id: string) => {
    logAPI("POST", "/api/admin/template/toggle-recommend", { id }, "pending");
    try {
      const res = await fetch("/api/admin/template/toggle-recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const result = await res.json();
      logAPI("POST", "/api/admin/template/toggle-recommend", result, "success");
      return result;
    } catch (e) {
      logAPI("POST", "/api/admin/template/toggle-recommend", e, "error");
      throw e;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col font-sans selection:bg-zinc-900 selection:text-white">
      
      {/* Top Universal Controller Bar */}
      <nav className="bg-white border-b border-zinc-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-950 flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
            伴
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-zinc-900">伴梦童话 有声绘本系统</h1>
            <p className="text-[10px] text-zinc-400 font-medium">WeChat Mini Program Prototype & Operations Backend Panel</p>
          </div>
        </div>

        {/* Big Dual Toggles Switch */}
        <div className="flex bg-zinc-100 rounded-xl p-1 border border-zinc-200">
          <button
            onClick={() => setActiveView("simulator")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeView === 'simulator' ? 'bg-zinc-950 text-white shadow-sm scale-[1.02]' : 'text-zinc-500 hover:text-zinc-900'}`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>📱 微信小程序手机模拟器</span>
          </button>
          
          <button
            onClick={() => setActiveView("dashboard")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeView === 'dashboard' ? 'bg-zinc-950 text-white shadow-sm scale-[1.02]' : 'text-zinc-500 hover:text-zinc-900'}`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>💻 运营管理中台后台</span>
          </button>
        </div>
      </nav>

      {/* Main Layout Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left/Main workspace (Active View) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-50 flex flex-col justify-center items-center">
          
          {loading && !db ? (
            <div className="flex flex-col items-center gap-3 py-24 select-none">
              <RefreshCw className="w-8 h-8 text-zinc-950 animate-spin" />
              <span className="text-xs text-zinc-500 font-medium">正在读取伴梦云端数据，请稍候...</span>
            </div>
          ) : (
            <div className="w-full h-full max-w-6xl flex justify-center items-center">
              {activeView === "simulator" ? (
                <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 w-full">
                  
                  {/* Phone Simulator view */}
                  <div className="shrink-0">
                    <WeChatSimulator 
                      db={db}
                      refreshDb={() => fetchDB(true)}
                      onUpdateProfile={handleUpdateProfile}
                      onCloneVoice={handleCloneVoice}
                      onDeleteVoice={handleDeleteVoice}
                      onGenerateStoryText={handleGenerateStoryText}
                      onGenerateStoryAudio={handleGenerateStoryAudio}
                      onSaveStoryToggle={handleSaveStoryToggle}
                      onDeleteStory={handleDeleteStory}
                      onRenameStory={handleRenameStory}
                      onRedeemCDKey={handleRedeemCDKey}
                      onBindReferral={handleBindReferral}
                      onReadAllNotifications={handleReadAllNotifications}
                      onDeleteNotification={handleDeleteNotification}
                    />
                  </div>

                  {/* API Side Logger panel for Simulator mode */}
                  <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col h-[650px] overflow-hidden justify-between shadow-xs">
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 border-b border-zinc-100 pb-2">
                        <Terminal className="w-4 h-4 text-zinc-900" />
                        <span className="text-xs font-bold text-zinc-800">全栈 API 请求监控终端 (后台通信)</span>
                      </div>
                      
                      <p className="text-[10px] text-zinc-500 leading-normal">
                        当您在左侧模拟手机中进行<b>微信登录、克隆声音、自定义故事、兑换卡密或邀请好友</b>时，全栈系统的 Express 端点将与后台进行实时 JSON 通信：
                      </p>

                      <div className="space-y-2 overflow-y-auto h-[480px] pr-1 wechat-screen-scrollbar">
                        {apiLogs.length === 0 ? (
                          <div className="text-center py-12 text-zinc-400 text-[10px] select-none italic">
                            等待小程序网络调用...
                          </div>
                        ) : (
                          apiLogs.map((log, idx) => (
                            <div key={idx} className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-100 text-[10px] font-mono space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-zinc-900 font-bold">{log.method} {log.url}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${log.status === 'success' ? 'bg-green-100 text-green-700' : log.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-500 animate-pulse'}`}>
                                  {log.status.toUpperCase()}
                                </span>
                              </div>
                              <div className="text-zinc-400 text-[9px] flex justify-between">
                                <span>Timestamp: {log.timestamp}</span>
                              </div>
                              {log.payload && (
                                <pre className="text-zinc-600 text-[8px] bg-white p-1.5 rounded overflow-x-auto max-h-16 wechat-screen-scrollbar border border-zinc-100 mt-1">
                                  {JSON.stringify(log.payload, null, 2)}
                                </pre>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="text-[9px] text-zinc-400 text-center border-t border-zinc-100 pt-2 flex items-center justify-center gap-1">
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Node.js / Express Web 容器服务器在 <b>PORT: 3000</b> 侦听运行</span>
                    </div>
                  </div>

                </div>
              ) : (
                /* Admin Dashboard view */
                <div className="w-full h-full">
                  <AdminDashboard 
                    db={db}
                    refreshDb={() => fetchDB(true)}
                    onAdminResetDb={handleAdminResetDb}
                    onAdminAddTemplate={handleAdminAddTemplate}
                    onAdminDeleteTemplate={handleAdminDeleteTemplate}
                    onAdminToggleTemplateRecommend={handleAdminToggleTemplateRecommend}
                    onAdminRedeemCDKey={handleRedeemCDKey}
                  />
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
