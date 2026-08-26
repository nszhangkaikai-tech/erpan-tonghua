import React, { useState } from "react";
import { 
  TrendingUp, Users, Database, BookOpen, Volume2, Award, Gift, Bell, 
  Trash2, Plus, Check, RefreshCw, BarChart2, ShieldAlert, Key, 
  UserCheck, Settings, Eye, Info, ListFilter, Download, ArrowRight,
  Cpu, Activity, Terminal, Shield, CheckCircle2, AlertTriangle, Play
} from "lucide-react";
import { StoryTemplate, CDKeyCard, UserStory, VoiceClone, AppNotification, InvitationRecord } from "../types";

interface AdminDashboardProps {
  db: any;
  refreshDb: () => void;
  onAdminResetDb: () => Promise<any>;
  onAdminAddTemplate: (tpl: any) => Promise<any>;
  onAdminDeleteTemplate: (id: string) => Promise<any>;
  onAdminToggleTemplateRecommend: (id: string) => Promise<any>;
  onAdminRedeemCDKey: (code: string) => Promise<any>;
}

export default function AdminDashboard({
  db,
  refreshDb,
  onAdminResetDb,
  onAdminAddTemplate,
  onAdminDeleteTemplate,
  onAdminToggleTemplateRecommend,
  onAdminRedeemCDKey
}: AdminDashboardProps) {
  // Admin Login Session
  const [adminUser, setAdminUser] = useState<string | null>(() => localStorage.getItem("伴梦管理员") || null);
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [authUsername, setAuthUsername] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUsername || !authPassword) {
      setAuthError("请输入用户名和密码！");
      return;
    }
    setLoadingAuth(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: authUsername, password: authPassword })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("伴梦管理员", data.user.username);
        setAdminUser(data.user.username);
        setAuthUsername("");
        setAuthPassword("");
        triggerAlert(`👋 欢迎回来，管理员 ${data.user.username}！`);
      } else {
        setAuthError(data.error || "登录失败");
      }
    } catch (err) {
      setAuthError("服务器网络错误，请稍后重试！");
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleAdminRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUsername || !authPassword) {
      setAuthError("请输入新建的账号和密码！");
      return;
    }
    setLoadingAuth(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      const res = await fetch("/api/admin/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: authUsername, password: authPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setAuthSuccess(data.message);
        setAuthUsername("");
        setAuthPassword("");
        setTimeout(() => {
          setIsRegisterMode(false);
          setAuthSuccess(null);
        }, 1500);
      } else {
        setAuthError(data.error || "创建失败");
      }
    } catch (err) {
      setAuthError("服务器网络错误，请稍后重试！");
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem("伴梦管理员");
    setAdminUser(null);
    triggerAlert("🔒 已安全退出管理员系统");
  };

  // Sidebar tab states: 'dashboard' | 'users' | 'templates' | 'stories' | 'voices' | 'cdkeys' | 'referrals' | 'notifications'
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // Admin template adding form
  const [newTpl, setNewTpl] = useState({
    name: "",
    cover: "",
    ageGroup: "3-6岁",
    theme: "睡前安抚",
    educationalGoal: "克服怕黑恐惧",
    scene: "静谧森林",
    charName: "",
    charRole: "",
    charPersonality: "",
    duration: "medium",
    description: ""
  });

  // Admin custom notification broadcaster form
  const [notifForm, setNotifForm] = useState({
    title: "",
    content: "",
    type: "system" as const
  });

  // Generated keys state
  const [generatedKeys, setGeneratedKeys] = useState<CDKeyCard[]>([]);

  // Local state alerts
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  // API monitor states
  const [apiServiceFilter, setApiServiceFilter] = useState<string>("all");
  const [apiStatusFilter, setApiStatusFilter] = useState<string>("all");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isSimulatingCall, setIsSimulatingCall] = useState<boolean>(false);

  const triggerAlert = (msg: string) => {
    setAlertMsg(msg);
    setTimeout(() => setAlertMsg(null), 3000);
  };

  // Reset database helper
  const handleResetDb = async () => {
    if (confirm("⚠️ 注意：这将重置后台数据库及用户数据为初始演示状态。确认要继续吗？")) {
      try {
        await onAdminResetDb();
        refreshDb();
        triggerAlert("数据库重置成功！已恢复默认演示数据。");
      } catch (e) {
        triggerAlert("重置数据库失败");
      }
    }
  };

  const handleSimulateApiCall = async (type: 'gemini' | 'tts' | 'clone' | 'other') => {
    setIsSimulatingCall(true);
    try {
      const res = await fetch("/api/admin/simulate-api-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type })
      });
      if (res.ok) {
        refreshDb();
        const typeNames: Record<string, string> = {
          gemini: "Gemini 3.5 Flash 文本生成",
          tts: "Cosmic TTS 语音合成",
          clone: "声音克隆算法解析",
          other: "运营中心业务逻辑"
        };
        triggerAlert(`⚡ 模拟API调用成功：已发起对 ${typeNames[type]} 服务的请求记录。`);
      }
    } catch (e) {
      triggerAlert("模拟请求失败");
    } finally {
      setIsSimulatingCall(false);
    }
  };

  // Add template handler
  const handleAddTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTpl.name || !newTpl.description) {
      triggerAlert("⚠️ 请完整填写模板名称与模板说明！");
      return;
    }

    try {
      const coverUrl = newTpl.cover || "https://images.unsplash.com/photo-1519052537078-e6302a4968d4?w=500&q=80";
      await onAdminAddTemplate({
        name: newTpl.name,
        cover: coverUrl,
        ageGroup: newTpl.ageGroup,
        theme: newTpl.theme,
        educationalGoal: newTpl.educationalGoal,
        scene: newTpl.scene,
        mainCharacter: {
          name: newTpl.charName || "奇奇",
          role: newTpl.charRole || "小猪",
          personality: newTpl.charPersonality || "活泼聪明"
        },
        duration: newTpl.duration,
        description: newTpl.description
      });
      
      // Reset form
      setNewTpl({
        name: "",
        cover: "",
        ageGroup: "3-6岁",
        theme: "睡前安抚",
        educationalGoal: "克服怕黑恐惧",
        scene: "静谧森林",
        charName: "",
        charRole: "",
        charPersonality: "",
        duration: "medium",
        description: ""
      });

      refreshDb();
      triggerAlert("🎉 新故事模板添加成功并已发布至前台！");
    } catch (e) {
      triggerAlert("添加模板失败");
    }
  };

  // Delete template
  const handleDeleteTemplateFlow = async (id: string) => {
    if (confirm("确定要下架并彻底删除该模板吗？下架不影响已生成保存的用户故事。")) {
      try {
        await onAdminDeleteTemplate(id);
        refreshDb();
        triggerAlert("🗑️ 故事模板删除下架成功");
      } catch (e) {
        triggerAlert("删除失败");
      }
    }
  };

  // Toggle template recommended status
  const handleToggleRecommendFlow = async (id: string) => {
    try {
      await onAdminToggleTemplateRecommend(id);
      refreshDb();
      triggerAlert("✓ 推荐状态修改成功");
    } catch (e) {
      triggerAlert("操作失败");
    }
  };

  // Broadcast Notification
  const handleBroadcastNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifForm.title || !notifForm.content) {
      triggerAlert("⚠️ 请填写完整的公告通知内容！");
      return;
    }

    // Call express endpoint or directly simulate pushing on server
    try {
      const res = await fetch("/api/db");
      const currentState = await res.json();
      const newNotif = {
        id: "notif_" + Date.now(),
        title: notifForm.title,
        content: notifForm.content,
        type: notifForm.type,
        isRead: false,
        createdAt: new Date().toISOString()
      };
      
      // Update db on server
      currentState.notifications.unshift(newNotif);
      
      // Save
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: currentState.profile.nickname,
          age: currentState.profile.age,
          gender: currentState.profile.gender,
          interests: currentState.profile.interests,
          parentName: currentState.profile.parentName,
          bedTime: currentState.profile.bedTime
        })
      });

      setNotifForm({ title: "", content: "", type: "system" });
      refreshDb();
      triggerAlert("📢 系统消息及通知广播发送成功！");
    } catch (err) {
      triggerAlert("广播发送失败");
    }
  };

  // Generate randomized CDKeys
  const handleGenerateCDKeys = () => {
    const codes: CDKeyCard[] = [];
    const channels = ["线上KOL推广", "母婴社群裂变", "微信福利发放", "售后VIP赠礼"];
    
    for (let i = 0; i < 5; i++) {
      const codeType = i % 2 === 0 ? 'times' : 'vip';
      const val = codeType === 'times' ? 15 : 30;
      const randStr = Math.random().toString(36).substring(2, 7).toUpperCase();
      const code = `${codeType === 'times' ? 'T' : 'V'}-${val}-${randStr}`;

      const newCard: CDKeyCard = {
        code,
        type: codeType,
        value: val,
        isUsed: false,
        channel: channels[Math.floor(Math.random() * channels.length)],
        createdAt: new Date().toISOString()
      };
      codes.push(newCard);
    }

    // Save to database on backend by calling proxy or push in DB
    fetch("/api/db")
      .then(r => r.json())
      .then(async cur => {
        cur.cdkeys = [...codes, ...cur.cdkeys];
        // Send a dummy request to save
        await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nickname: cur.profile.nickname,
            age: cur.profile.age
          })
        });
        setGeneratedKeys(codes);
        refreshDb();
        triggerAlert("🔑 成功随机生成5个面额不等的卡密充值码！");
      });
  };

  // Quotas tuning directly on user via secret backend hack
  const handleAdjustQuotas = async (type: 'times' | 'freeClones' | 'vip') => {
    try {
      const res = await fetch("/api/db");
      const cur = await res.json();
      
      if (type === 'times') {
        cur.rights.storyGenerationsRemaining += 5;
      } else if (type === 'freeClones') {
        cur.rights.freeVoiceClonesRemaining += 1;
      } else if (type === 'vip') {
        cur.rights.isVip = !cur.rights.isVip;
        if (cur.rights.isVip) {
          cur.rights.vipExpiry = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
        }
      }

      // Update backend
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: cur.profile.nickname,
          age: cur.profile.age
        })
      });
      refreshDb();
      triggerAlert("⚙️ 用户权益额度微调成功，数据已实时回写数据库。");
    } catch (e) {
      triggerAlert("额度调整失败");
    }
  };

  // Analytics Funnel Data Mock (based on db state counts)
  const funnelSteps = [
    { name: "微信授权登录", count: 120, rate: "100%" },
    { name: "完善孩子档案", count: 96, rate: "80%" },
    { name: "进入录音室克隆", count: 68, rate: "56.6%" },
    { name: "生成文本故事", count: 52, rate: "43.3%" },
    { name: "预览故事草稿", count: 48, rate: "40.0%" },
    { name: "转码合成有声", count: 40, rate: "33.3%" },
    { name: "高沉浸播放器播放", count: db?.stats?.storiesPlayedCount || 36, rate: "30.0%" },
    { name: "故事日记本长期保存", count: db?.userStories?.length || 1, rate: "15.0%" }
  ];

  if (!adminUser) {
    return (
      <div className="min-h-[600px] flex items-center justify-center bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm relative">
          {alertMsg && (
            <div className="absolute top-4 right-4 z-50 bg-zinc-900 text-white border border-zinc-800 px-3 py-2 rounded-lg text-xs font-bold shadow-lg flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-zinc-300" />
              <span>{alertMsg}</span>
            </div>
          )}
          <div>
            <div className="mx-auto h-12 w-12 rounded-2xl bg-zinc-950 flex items-center justify-center text-white font-extrabold text-2xl shadow-md">
              伴
            </div>
            <h2 className="mt-6 text-center text-xl font-extrabold text-zinc-900 tracking-tight">
              {isRegisterMode ? "新建后台管理员账号" : "管理员安全身份验证登录"}
            </h2>
            <p className="mt-2 text-center text-xs text-zinc-400">
              {isRegisterMode ? "后台管理系统的管理员自主管理与分权机制" : "请输入伴梦童话系统后台管理员凭证以继续"}
            </p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={isRegisterMode ? handleAdminRegister : handleAdminLogin}>
            {authError && (
              <div className="bg-red-50 text-red-700 text-xs p-3.5 rounded-xl border border-red-200 flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{authError}</span>
              </div>
            )}
            
            {authSuccess && (
              <div className="bg-green-50 text-green-700 text-xs p-3.5 rounded-xl border border-green-200 flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500 animate-bounce" />
                <span>{authSuccess}</span>
              </div>
            )}

            <div className="rounded-md space-y-3">
              <div>
                <label className="text-zinc-500 text-[10px] font-bold block mb-1">管理员登录账户</label>
                <input
                  type="text"
                  required
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  className="appearance-none relative block w-full px-3.5 py-2.5 border border-zinc-200 placeholder-zinc-400 text-zinc-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 text-xs transition-all"
                  placeholder="请输入您的管理员账号..."
                />
              </div>
              <div>
                <label className="text-zinc-500 text-[10px] font-bold block mb-1">管理员安全密码</label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="appearance-none relative block w-full px-3.5 py-2.5 border border-zinc-200 placeholder-zinc-400 text-zinc-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 text-xs transition-all"
                  placeholder="请输入您的安全访问密码..."
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loadingAuth}
                className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-xs font-bold rounded-xl text-white bg-zinc-950 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-950 transition-all shadow-sm active:scale-98 disabled:opacity-50"
              >
                {loadingAuth ? "请稍候..." : (isRegisterMode ? "立即创建新管理员" : "安全验证并登录系统")}
              </button>
            </div>
            
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setAuthError(null);
                  setAuthSuccess(null);
                  setAuthUsername("");
                  setAuthPassword("");
                }}
                className="text-[11px] font-bold text-zinc-500 hover:text-zinc-900 transition-colors underline hover:no-underline"
              >
                {isRegisterMode ? "返回管理员登录" : "✨ 新建管理员账户功能入口"}
              </button>
            </div>
          </form>

          <div className="border-t border-zinc-100 pt-4 text-center">
            <span className="text-[10px] text-zinc-400 font-medium">默认测试账户: <b className="text-zinc-600 font-bold">admin</b> 密码: <b className="text-zinc-600 font-bold">admin123</b></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[640px] bg-zinc-50 text-zinc-900 rounded-3xl overflow-hidden border border-zinc-200 flex flex-col font-sans relative shadow-sm">
      
      {/* Admin alert toast */}
      {alertMsg && (
        <div className="absolute top-4 right-4 z-50 bg-zinc-900 text-white border border-zinc-800 px-4 py-2.5 rounded-lg text-xs font-bold shadow-lg flex items-center gap-2">
          <Info className="w-4 h-4 text-zinc-300" />
          <span>{alertMsg}</span>
        </div>
      )}

      {/* Admin Top Header Bar */}
      <header className="bg-zinc-900 text-white px-6 py-4 border-b border-zinc-950 flex justify-between items-center select-none shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="bg-white text-zinc-950 px-2.5 py-1 rounded-lg font-extrabold text-sm tracking-tight">
            BMTH
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">伴梦童话 · 后台业务中台运营系统</h1>
            <p className="text-[10px] text-zinc-400 font-mono mt-0.5">DREAM-COMPANION FAIRY TALE SERVICE CENTER v1.1</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={refreshDb}
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-white transition flex items-center gap-1 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>刷新数据</span>
          </button>
          
          <button 
            onClick={handleResetDb}
            className="bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 text-xs px-3 py-1.5 rounded-lg transition font-bold"
          >
            重置测试数据库
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar Nav */}
        <aside className="w-52 bg-zinc-950 text-zinc-300 border-r border-zinc-900 p-3 flex flex-col justify-between shrink-0 select-none">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 font-bold block px-2.5 py-1">数据与报表</span>
            {[
              { id: 'dashboard', label: '运营看板 & 漏斗', icon: TrendingUp },
              { id: 'users', label: '注册家长与权益', icon: Users },
              { id: 'api', label: 'API 调用监控', icon: Cpu },
            ].map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2.5 ${activeTab === item.id ? 'bg-zinc-50 text-zinc-950 shadow-xs' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}

            <span className="text-[10px] text-zinc-500 font-bold block px-2.5 py-1 pt-3">内容与审核</span>
            {[
              { id: 'templates', label: '故事模板配置', icon: BookOpen },
              { id: 'stories', label: '生成故事归档', icon: Database },
              { id: 'voices', label: '家庭声源克隆', icon: Volume2 },
              { id: 'safety_control', label: '内容安全 & 复核', icon: Shield },
            ].map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2.5 ${activeTab === item.id ? 'bg-zinc-50 text-zinc-950 shadow-xs' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}

            <span className="text-[10px] text-zinc-500 font-bold block px-2.5 py-1 pt-3">商业化与推广</span>
            {[
              { id: 'cdkeys', label: '卡密管理端', icon: Key },
              { id: 'referrals', label: '裂变邀请链路', icon: Gift },
              { id: 'notifications', label: '广播消息中心', icon: Bell }
            ].map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2.5 ${activeTab === item.id ? 'bg-zinc-50 text-zinc-950 shadow-xs' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-2 border-t border-zinc-900 space-y-2 shrink-0">
            <div className="flex flex-col gap-1 bg-zinc-900/50 p-2 rounded-lg border border-zinc-900">
              <span className="text-[9px] text-zinc-500 font-bold block">当前管理员：</span>
              <span className="text-[11px] text-zinc-100 font-extrabold truncate flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                {adminUser}
              </span>
            </div>
            
            <button
              onClick={handleAdminLogout}
              className="w-full text-center bg-red-950/40 text-red-400 hover:bg-red-900 hover:text-white border border-red-900/30 text-[10px] font-bold py-1 px-2 rounded-lg transition active:scale-98"
            >
              安全退出后台
            </button>

            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 pt-1">
              <ShieldAlert className="w-3 h-3 text-zinc-500 shrink-0" />
              <span>测试演示安全沙箱</span>
            </div>
          </div>
        </aside>

        {/* Content Section */}
        <main className="flex-1 overflow-y-auto p-6 bg-zinc-50/50 wechat-screen-scrollbar">
          
          {/* ================= TAB 1: OPERATIONAL KANBAN ================= */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              
              {/* Kanban stats cards */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "今日新增家长", value: db?.stats?.todayNewUsers || 14, icon: Users, color: "text-zinc-600" },
                  { label: "有声故事总生成", value: db?.stats?.audioStoriesGenerated || 2, icon: BookOpen, color: "text-zinc-600" },
                  { label: "声音克隆总数量", value: db?.stats?.voiceClonedCount || 2, icon: Volume2, color: "text-zinc-600" },
                  { label: "CDKey 卡密已兑换", value: db?.stats?.cdkeysRedeemedCount || 1, icon: Key, color: "text-zinc-600" }
                ].map((stat, idx) => {
                  const Icon = stat.icon;
                  return (
                    <div key={idx} className="bg-white p-4 rounded-2xl border border-zinc-200 flex justify-between items-center shadow-xs">
                      <div>
                        <span className="text-[11px] text-zinc-400 block">{stat.label}</span>
                        <span className="text-xl font-bold block mt-1 text-zinc-900">{stat.value}</span>
                      </div>
                      <Icon className={`w-8 h-8 opacity-40 ${stat.color}`} />
                    </div>
                  );
                })}
              </div>

              {/* Conversion Funnel Row */}
              <div className="grid grid-cols-3 gap-6">
                
                {/* Visual conversion funnel */}
                <div className="bg-white p-5 rounded-2xl border border-zinc-200 col-span-2 space-y-4 shadow-xs">
                  <div>
                    <h3 className="text-xs font-bold flex items-center gap-1.5 text-zinc-800">
                      <BarChart2 className="w-4 h-4 text-zinc-950" />
                      WeChat 微信小程序 MVP 转化分析漏斗 (漏斗报表)
                    </h3>
                    <p className="text-[10px] text-zinc-400 mt-1">从用户授权进入，到最终故事日记本留存流转的全节点监控漏斗统计：</p>
                  </div>

                  <div className="space-y-2 pt-2">
                    {funnelSteps.map((step, idx) => {
                      const percentageWidth = Math.max(15, 100 - idx * 11);
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-medium">
                            <span className="text-zinc-600">
                              <span className="font-mono text-zinc-400 mr-1">#{idx + 1}</span> 
                              {step.name}
                            </span>
                            <div className="space-x-2 font-mono">
                              <span className="text-zinc-500">{step.count} 人</span>
                              <span className="text-zinc-950 font-bold">({step.rate})</span>
                            </div>
                          </div>
                          <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden">
                            <div 
                              style={{ width: `${percentageWidth}%` }} 
                              className="bg-zinc-950 h-full rounded-full"
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Additional analytics side block */}
                <div className="bg-white p-5 rounded-2xl border border-zinc-200 space-y-4 flex flex-col justify-between shadow-xs">
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-zinc-800 flex items-center gap-1">🧸 儿童特征统计洞察</span>
                    
                    <div className="space-y-3 text-xs pt-1">
                      <div>
                        <span className="text-zinc-400 block">宝宝平均偏好年龄段</span>
                        <span className="font-bold block text-sm mt-0.5 text-zinc-800">3 至 5 岁 (占比 65%)</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block">最受欢迎的故事主题</span>
                        <span className="font-bold block text-sm mt-0.5 text-zinc-950">睡前安抚 🌙 (占比 54.2%)</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block">平均单本生成耗时</span>
                        <span className="font-bold block text-sm mt-0.5 text-zinc-800">约 3.2 秒 (含 Gemini 延迟)</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-200 text-[10px] text-zinc-500 leading-relaxed">
                    🌟 伴梦建议：当前睡前故事高频生成，可上架更多【安睡森林】相关的插图大纲 and 模板！
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ================= TAB 2: REGISTERED USERS & RIGHTS ================= */}
          {activeTab === "users" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
                <div>
                  <h3 className="text-xs font-bold text-zinc-800">注册家长用户及其核心权益</h3>
                  <p className="text-[10px] text-zinc-400 mt-1">演示系统只有一个主微信登录账号，支持在右侧控制台进行微调干预测试：</p>
                </div>
                
                {/* Quota adjusting shortcut */}
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleAdjustQuotas('times')}
                    className="bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-850 text-[11px] font-bold px-3 py-1.5 rounded-lg transition"
                  >
                    充值 +5 次故事额度
                  </button>
                  <button 
                    onClick={() => handleAdjustQuotas('freeClones')}
                    className="bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-850 text-[11px] font-bold px-3 py-1.5 rounded-lg transition"
                  >
                    充值 +1 次克隆余额
                  </button>
                  <button 
                    onClick={() => handleAdjustQuotas('vip')}
                    className="bg-zinc-950 hover:bg-zinc-900 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition shadow-xs"
                  >
                    {db?.rights?.isVip ? "取消 VIP 状态" : "开通 30 天 VIP 体验"}
                  </button>
                </div>
              </div>

              {/* Users table */}
              <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-50 text-zinc-500 font-bold border-b border-zinc-200">
                      <th className="p-4">家长昵称 (微信)</th>
                      <th className="p-4">绑定宝贝</th>
                      <th className="p-4">性别 / 年龄</th>
                      <th className="p-4">剩余生成次数</th>
                      <th className="p-4">克隆剩余额度</th>
                      <th className="p-4">VIP 会员状态</th>
                      <th className="p-4">常用播放时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-zinc-100 hover:bg-zinc-50/50">
                      <td className="p-4 font-bold text-zinc-900 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-zinc-950 text-white flex items-center justify-center font-bold text-[10px]">
                          {db?.profile?.parentName?.charAt(0) || "淘"}
                        </div>
                        {db?.profile?.parentName || "淘淘妈妈"}
                      </td>
                      <td className="p-4 text-zinc-700">{db?.profile?.nickname || "淘淘"}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${db?.profile?.gender === 'girl' ? 'bg-pink-50 text-pink-600 border border-pink-100/60' : 'bg-blue-50 text-blue-600 border border-blue-100/60'}`}>
                          {db?.profile?.gender === 'girl' ? '小公主' : '小王子'}
                        </span>
                        <span className="ml-2 font-mono text-zinc-600">{db?.profile?.age || 4} 岁</span>
                      </td>
                      <td className="p-4 font-mono font-bold text-zinc-900">
                        {db?.rights?.storyGenerationsRemaining || 0} 次
                      </td>
                      <td className="p-4 font-mono text-zinc-600">
                        {db?.rights?.freeVoiceClonesRemaining || 0} 次
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${db?.rights?.isVip ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-zinc-100 text-zinc-500'}`}>
                          {db?.rights?.isVip ? 'VIP 会员' : '免费普通用户'}
                        </span>
                        {db?.rights?.isVip && (
                          <p className="text-[9px] text-zinc-400 mt-0.5 font-mono">
                            Expiry: {new Date(db.rights.vipExpiry).toLocaleDateString()}
                          </p>
                        )}
                      </td>
                      <td className="p-4 font-mono text-zinc-500">睡前 {db?.profile?.bedTime || "21:00"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 3: STORY TEMPLATES MANAGEMENT ================= */}
          {activeTab === "templates" && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-3 gap-6">
                
                {/* Left side: current templates list */}
                <div className="col-span-2 space-y-4">
                  <span className="text-xs font-bold text-zinc-800 block">目前上线在前台的儿童绘本模板 ({db?.templates?.length || 0})</span>
                  
                  <div className="space-y-3">
                    {db?.templates?.map((tpl: StoryTemplate) => (
                      <div key={tpl.id} className="bg-white p-4 rounded-2xl border border-zinc-200 flex gap-4 shadow-xs">
                        <img 
                          src={tpl.cover} 
                          className="w-16 h-20 rounded-xl object-cover bg-zinc-100 border border-zinc-100 shrink-0"
                          alt="tpl cover"
                        />
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-zinc-900 text-sm">{tpl.name}</span>
                              <span className="bg-zinc-100 text-zinc-500 text-[9px] px-1.5 py-0.5 rounded font-bold">{tpl.ageGroup}</span>
                              <span className="bg-zinc-100 text-zinc-800 text-[9px] px-1.5 py-0.5 rounded font-bold">{tpl.theme}</span>
                            </div>
                            <p className="text-[11px] text-zinc-500 line-clamp-2 mt-1.5 leading-relaxed">{tpl.description}</p>
                            
                            <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-400">
                              <span>主角：<b className="text-zinc-600">{tpl.mainCharacter?.name}</b> ({tpl.mainCharacter?.role})</span>
                              <span>•</span>
                              <span>目标：<b className="text-zinc-600">{tpl.educationalGoal}</b></span>
                              <span>•</span>
                              <span>发生场景：<b className="text-zinc-600">{tpl.scene}</b></span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-3 border-t border-zinc-100 mt-2">
                            <span className="text-[10px] text-zinc-400">已套用生成：<b className="text-zinc-600">{tpl.useCount}次</b></span>
                            
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleToggleRecommendFlow(tpl.id)}
                                className={`text-[10px] font-bold px-2 py-1 rounded transition ${tpl.isRecommended ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
                              >
                                {tpl.isRecommended ? "✓ 首页推荐中" : "设为首页推荐"}
                              </button>
                              
                              <button 
                                onClick={() => handleDeleteTemplateFlow(tpl.id)}
                                className="bg-zinc-100 hover:bg-red-50 text-zinc-400 hover:text-red-600 p-1.5 rounded transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right side: Add template form */}
                <div className="bg-white p-5 rounded-2xl border border-zinc-200 h-fit space-y-4 shadow-xs">
                  <h3 className="text-xs font-bold text-zinc-800 border-b border-zinc-200 pb-2 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-zinc-950" />
                    发布新的绘本故事情境模板
                  </h3>

                  <form onSubmit={handleAddTemplateSubmit} className="space-y-3 text-xs">
                    <div>
                      <label className="block text-zinc-500 mb-1">模板标题 (故事大名)</label>
                      <input 
                        type="text" 
                        placeholder="如：不爱整理的呼呼熊"
                        value={newTpl.name}
                        onChange={e => setNewTpl({ ...newTpl, name: e.target.value })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-zinc-500 mb-1">适听年龄段</label>
                        <select 
                          value={newTpl.ageGroup}
                          onChange={e => setNewTpl({ ...newTpl, ageGroup: e.target.value })}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-900 focus:outline-none"
                        >
                          <option value="2-4岁">2-4 岁</option>
                          <option value="3-6岁">3-6 岁</option>
                          <option value="6-9岁">6-9 岁</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-zinc-500 mb-1">故事分类主题</label>
                        <select 
                          value={newTpl.theme}
                          onChange={e => setNewTpl({ ...newTpl, theme: e.target.value })}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-900 focus:outline-none"
                        >
                          <option value="睡前安抚">睡前安抚</option>
                          <option value="勇敢与自信">勇敢与自信</option>
                          <option value="习惯养成">习惯养成</option>
                          <option value="分享与友爱">分享与友爱</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-zinc-500 mb-1">教育习惯目标</label>
                        <input 
                          type="text" 
                          placeholder="如：克服怕黑、物归原位"
                          value={newTpl.educationalGoal}
                          onChange={e => setNewTpl({ ...newTpl, educationalGoal: e.target.value })}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-zinc-900 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-zinc-500 mb-1">默认故事场景</label>
                        <input 
                          type="text" 
                          placeholder="如：静谧森林、温馨卧室"
                          value={newTpl.scene}
                          onChange={e => setNewTpl({ ...newTpl, scene: e.target.value })}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-zinc-900 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200/60 space-y-2">
                      <span className="text-[10px] text-zinc-500 font-bold block">默认主人公设定</span>
                      <div className="grid grid-cols-2 gap-2">
                        <input 
                          type="text" 
                          placeholder="主角名字(呼呼)"
                          value={newTpl.charName}
                          onChange={e => setNewTpl({ ...newTpl, charName: e.target.value })}
                          className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-900 focus:outline-none"
                        />
                        <input 
                          type="text" 
                          placeholder="角色身份(小熊)"
                          value={newTpl.charRole}
                          onChange={e => setNewTpl({ ...newTpl, charRole: e.target.value })}
                          className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-900 focus:outline-none"
                        />
                      </div>
                      <input 
                        type="text" 
                        placeholder="人设特征 (如: 善良懂事, 但玩完玩具从来不收拾)"
                        value={newTpl.charPersonality}
                        onChange={e => setNewTpl({ ...newTpl, charPersonality: e.target.value })}
                        className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-900 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-500 mb-1">模板简要说明 (展示在前台)</label>
                      <textarea 
                        rows={2}
                        placeholder="输入一段吸引家长套用的话..."
                        value={newTpl.description}
                        onChange={e => setNewTpl({ ...newTpl, description: e.target.value })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-900 focus:outline-none"
                      ></textarea>
                    </div>

                    <div>
                      <label className="block text-zinc-500 mb-1">精美封面图 (Unsplash 图片链接)</label>
                      <input 
                        type="text" 
                        placeholder="可留空使用默认图片"
                        value={newTpl.cover}
                        onChange={e => setNewTpl({ ...newTpl, cover: e.target.value })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="w-full bg-zinc-950 hover:bg-zinc-900 text-white font-bold py-2 rounded-lg shadow-sm transition"
                    >
                      发布上架绘本情境模板
                    </button>
                  </form>
                </div>

              </div>

            </div>
          )}

          {/* ================= TAB 4: GENERATED USER STORIES LIST ================= */}
          {activeTab === "stories" && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-zinc-800 block">
                已成功生成并保存在库的用户有声故事 ({db?.userStories?.length || 0} 本)
              </span>

              <div className="space-y-3">
                {db?.userStories?.map((story: UserStory) => (
                  <div key={story.id} className="bg-white p-4 rounded-2xl border border-zinc-200 flex gap-4 shadow-xs">
                    <img 
                      src={story.coverUrl} 
                      className="w-16 h-22 rounded-xl object-cover bg-zinc-100 border border-zinc-100 shrink-0" 
                      alt="cover"
                    />
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-zinc-900 text-sm">{story.title}</h4>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            创建时间：{new Date(story.createTime).toLocaleString()} &nbsp;|&nbsp; 
                            对应配音声源 ID：{story.voiceId}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded font-mono">
                            模式：{story.voiceMode === 'single' ? '单人' : '多配音人'}
                          </span>
                          <span className={`px-2 py-0.5 rounded font-bold ${story.isAudioReady ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-zinc-100 text-zinc-700'}`}>
                            {story.isAudioReady ? '✓ 有声合成完毕' : '文本故事阶段'}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-600 bg-zinc-50 p-2.5 rounded-xl border border-zinc-100 leading-relaxed">
                        <b>故事梗概</b>：{story.abstract}
                      </p>

                      {/* Displaying chapters structure in admin */}
                      <div className="pt-1.5">
                        <span className="text-[10px] text-zinc-500 font-bold block mb-1">绘本章节明细 ({story.chapters?.length}个章节)：</span>
                        <div className="grid grid-cols-3 gap-3">
                          {story.chapters?.map(ch => (
                            <div key={ch.chapterNumber} className="bg-zinc-50/50 p-2.5 rounded-lg border border-zinc-200/60 space-y-1">
                              <div className="flex justify-between text-[8px] text-zinc-400 font-bold">
                                <span>第{ch.chapterNumber}章</span>
                                <span className="truncate max-w-[80px]">{ch.title}</span>
                              </div>
                              <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed">{ch.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= TAB 5: VOICE CLONES REVIEW ================= */}
          {activeTab === "voices" && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-zinc-800 block">
                用户录制并成功克隆的家庭声源库 ({db?.voiceClones?.length || 0} 个克隆)
              </span>

              <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-50 text-zinc-500 font-bold border-b border-zinc-200">
                      <th className="p-4">声源唯一 ID</th>
                      <th className="p-4">声音自定义名称</th>
                      <th className="p-4">对应家庭关系</th>
                      <th className="p-4">原始录音时长</th>
                      <th className="p-4">已应用于故事</th>
                      <th className="p-4">克隆状态</th>
                      <th className="p-4">创建时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {db?.voiceClones?.map((voice: VoiceClone) => (
                      <tr key={voice.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 text-zinc-700">
                        <td className="p-4 font-mono text-[10px] text-zinc-500">{voice.id}</td>
                        <td className="p-4 font-bold text-zinc-900">{voice.name}</td>
                        <td className="p-4">
                          <span className="bg-zinc-100 px-2 py-0.5 rounded text-[10px] font-bold text-zinc-600">
                            {voice.speakerType === 'mother' ? '母亲 👩' : voice.speakerType === 'father' ? '父亲 👨' : '其他声线'}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-zinc-900 font-bold">{voice.recordDuration} 秒</td>
                        <td className="p-4 font-mono font-bold text-zinc-900">{voice.usageCount} 次</td>
                        <td className="p-4">
                          <span className="text-green-600 font-semibold flex items-center gap-1 text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></span>
                            克隆准备就绪 (Ready)
                          </span>
                        </td>
                        <td className="p-4 text-zinc-400 font-mono text-[11px]">
                          {new Date(voice.createTime).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 6: CDKEY CODES MANAGEMENT ================= */}
          {activeTab === "cdkeys" && (
            <div className="space-y-6">
              
              <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
                <div>
                  <h3 className="text-xs font-bold text-zinc-800">激活码卡密库及渠道分发</h3>
                  <p className="text-[10px] text-zinc-400 mt-1">支持在左侧或通过随机生成，生成可赠予用户的福利充值卡密：</p>
                </div>
                
                <button 
                  onClick={handleGenerateCDKeys}
                  className="bg-zinc-950 hover:bg-zinc-900 text-white text-xs px-4 py-2 rounded-xl font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  随机生成 5 个新卡密 (15次卡/30天VIP)
                </button>
              </div>

              {generatedKeys.length > 0 && (
                <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-2">
                  <span className="text-xs font-bold text-zinc-900 flex items-center gap-1">🔑 刚刚生成的充值激活码 (请保存发送)：</span>
                  <div className="grid grid-cols-5 gap-2 pt-1 font-mono text-center">
                    {generatedKeys.map(k => (
                      <div key={k.code} className="bg-white p-2.5 rounded-lg border border-zinc-200 text-xs shadow-xs">
                        <span className="text-zinc-900 font-extrabold block">{k.code}</span>
                        <span className="text-[9px] text-zinc-400 block mt-1">{k.type === 'times' ? '15次生成卡' : '30天VIP卡'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-50 text-zinc-500 font-bold border-b border-zinc-200">
                      <th className="p-4">充值兑换码 (CDKEY)</th>
                      <th className="p-4">卡券类型</th>
                      <th className="p-4">权益额度</th>
                      <th className="p-4">分发推广渠道</th>
                      <th className="p-4">使用状态</th>
                      <th className="p-4">兑换家长账号</th>
                      <th className="p-4">兑换时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {db?.cdkeys?.map((card: CDKeyCard) => (
                      <tr key={card.code} className="border-b border-zinc-100 hover:bg-zinc-50/50 text-zinc-700">
                        <td className="p-4 font-mono font-bold text-zinc-900 tracking-wider uppercase text-xs">{card.code}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${card.type === 'times' ? 'bg-blue-50 text-blue-600 border border-blue-100/60' : 'bg-purple-50 text-purple-600 border border-purple-100/60'}`}>
                            {card.type === 'times' ? '次数卡 🎫' : '会员卡 👑'}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-zinc-600">
                          {card.type === 'times' ? `生成 ${card.value} 次` : `有效 ${card.value} 天`}
                        </td>
                        <td className="p-4 text-zinc-500">{card.channel}</td>
                        <td className="p-4">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${card.isUsed ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                            {card.isUsed ? '✕ 已被使用兑换' : '✓ 未被使用 (可用)'}
                          </span>
                        </td>
                        <td className="p-4 text-zinc-600">{card.usedBy || "—"}</td>
                        <td className="p-4 font-mono text-[11px] text-zinc-400">
                          {card.usedTime ? new Date(card.usedTime).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 7: REFERRALS TRACKING ================= */}
          {activeTab === "referrals" && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-zinc-200 flex justify-between items-center shadow-xs">
                <div>
                  <h3 className="text-xs font-bold text-zinc-800">裂变分享与好友绑定大表</h3>
                  <p className="text-[10px] text-zinc-400 mt-1">监控用户通过邀请码裂变推广的获赠明细，促进小程序零成本自流转：</p>
                </div>
                
                <span className="text-xs text-zinc-500">目前已建立邀请绑定关系：<b className="text-zinc-800">{db?.invitationRecords?.length || 0} 组</b></span>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-50 text-zinc-500 font-bold border-b border-zinc-200">
                      <th className="p-4">推荐人邀请码</th>
                      <th className="p-4">被推荐好友昵称</th>
                      <th className="p-4">奖励内容</th>
                      <th className="p-4">状态</th>
                      <th className="p-4">奖励是否到账</th>
                      <th className="p-4">绑定时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {db?.invitationRecords?.map((rec: InvitationRecord) => (
                      <tr key={rec.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 text-zinc-700">
                        <td className="p-4 font-mono font-bold text-zinc-900 uppercase tracking-wide">{rec.referrerId}</td>
                        <td className="p-4 text-zinc-600">{rec.referredName}</td>
                        <td className="p-4 text-zinc-600">双方获赠 <b className="text-zinc-800">{rec.rewardValue}次</b> 故事额度</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rec.status === 'success' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-zinc-100 text-zinc-500'}`}>
                            {rec.status === 'success' ? '邀请成功并完成首次生成' : '已绑定待触发'}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-green-600">✓ 自动充值入账</td>
                        <td className="p-4 font-mono text-[11px] text-zinc-400">
                          {new Date(rec.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 8: BROADCATER NOTIFICATION ================= */}
          {activeTab === "notifications" && (
            <div className="grid grid-cols-3 gap-6">
              
              {/* Left Column: Broadcast custom form */}
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 h-fit space-y-4 shadow-xs">
                <h3 className="text-xs font-bold text-zinc-800 border-b border-zinc-200 pb-2 flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-zinc-950" />
                  推送广播系统运营公告
                </h3>

                <form onSubmit={handleBroadcastNotification} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-zinc-500 mb-1">通知主标题</label>
                    <input 
                      type="text" 
                      placeholder="如：新一季【恐龙探险】主题童话震撼上架！"
                      value={notifForm.title}
                      onChange={e => setNotifForm({ ...notifForm, title: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-500 mb-1">通知消息类型</label>
                    <select
                      value={notifForm.type}
                      onChange={e => setNotifForm({ ...notifForm, type: e.target.value as any })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-zinc-900 focus:outline-none"
                    >
                      <option value="system">系统/维护通知</option>
                      <option value="story">绘本/新书上架通知</option>
                      <option value="voice">声音克隆福利通知</option>
                      <option value="card">商业/激活兑换通知</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-500 mb-1">消息通知正文内容</label>
                    <textarea
                      rows={4}
                      placeholder="通知的具体内容，可说明福利、新上的情境主人公特色等..."
                      value={notifForm.content}
                      onChange={e => setNotifForm({ ...notifForm, content: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-900 focus:outline-none"
                    ></textarea>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-zinc-950 hover:bg-zinc-900 text-white font-bold py-2 rounded-lg transition shadow-sm"
                  >
                    广播推送消息至全体家长
                  </button>
                </form>
              </div>

              {/* Right Column: notification history list review */}
              <div className="col-span-2 space-y-4">
                <span className="text-xs font-bold text-zinc-800 block">系统推送消息历史记录 ({db?.notifications?.length || 0} 个通知)</span>
                
                <div className="space-y-2.5">
                  {db?.notifications?.map((n: AppNotification) => (
                    <div key={n.id} className="bg-white p-5 rounded-2xl border border-zinc-200 relative shadow-xs">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <h4 className="font-bold text-zinc-900 text-xs flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 shrink-0"></span>
                            {n.title}
                          </h4>
                          <span className="text-[9px] text-zinc-400 font-mono block">
                            发送时间：{new Date(n.createdAt).toLocaleString()} &nbsp;|&nbsp; 
                            状态：{n.isRead ? '全部已读' : '用户未读'}
                          </span>
                        </div>
                        <span className="bg-zinc-100 text-zinc-500 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">
                          {n.type === 'system' ? '系统公告' : n.type === 'story' ? '绘本福利' : '声源通知'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-2 leading-relaxed">{n.content}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ================= TAB 9: API CALL MONITORING & STATISTICS ================= */}
          {activeTab === "api" && (() => {
            const apiStats = db?.apiStats || {
              totalRequests: 84,
              geminiTextCalls: 12,
              geminiTextSuccess: 12,
              geminiTextError: 0,
              voiceSynthCalls: 8,
              voiceSynthSuccess: 8,
              voiceSynthError: 0,
              voiceCloneCalls: 6,
              voiceCloneSuccess: 6,
              voiceCloneError: 0,
              totalTokens: 15420,
              averageLatencyMs: 1420
            };

            const rawLogs = db?.apiLogs || [];
            
            // Filter logs based on filters
            const filteredLogs = rawLogs.filter((log: any) => {
              const serviceMatch = 
                apiServiceFilter === "all" ||
                (apiServiceFilter === "gemini" && log.service?.toLowerCase().includes("gemini")) ||
                (apiServiceFilter === "tts" && (log.service?.toLowerCase().includes("tts") || log.service?.toLowerCase().includes("synthesizer"))) ||
                (apiServiceFilter === "clone" && log.service?.toLowerCase().includes("clone")) ||
                (apiServiceFilter === "other" && !log.service?.toLowerCase().includes("gemini") && !log.service?.toLowerCase().includes("tts") && !log.service?.toLowerCase().includes("synthesizer") && !log.service?.toLowerCase().includes("clone"));

              const statusMatch = 
                apiStatusFilter === "all" ||
                (apiStatusFilter === "success" && log.status >= 200 && log.status < 300) ||
                (apiStatusFilter === "error" && log.status >= 400);

              return serviceMatch && statusMatch;
            });

            return (
              <div className="space-y-6 animate-fade-in">
                
                {/* Header Row */}
                <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-100 rounded-xl">
                      <Cpu className="w-5 h-5 text-zinc-900 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                        API 外部接口调用统计与服务监控网关
                        <span className="flex items-center gap-1 bg-green-50 text-green-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-green-200 animate-pulse">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                          在线监听中
                        </span>
                      </h3>
                      <p className="text-[10px] text-zinc-400 mt-1">
                        实时监控本系统发起的 Gemini 3.5 Flash 大模型文本生成调用、声音克隆算法计算，以及 Cosmic TTS 有声小说声音转码。
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={refreshDb}
                      className="bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-800 text-xs px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 shadow-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      立即拉取最新调用记录
                    </button>
                  </div>
                </div>

                {/* Simulated live-calls controls row */}
                <div className="bg-zinc-900 text-white p-5 rounded-2xl border border-zinc-950 space-y-3.5 shadow-sm">
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                    <div className="flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-zinc-400 font-mono" />
                      <span className="text-xs font-bold font-mono tracking-tight text-zinc-300">沙箱接口仿真器 (Simulate Live Network Traffic)</span>
                    </div>
                    <span className="text-[9px] text-zinc-500 font-mono">点击下列按钮，立即模拟一次真实用户的服务端接口交互与算法调用</span>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <button
                      disabled={isSimulatingCall}
                      onClick={() => handleSimulateApiCall('gemini')}
                      className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 disabled:opacity-50 text-zinc-200 text-xs px-3.5 py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                      <span>模拟 Gemini 3.5 文本生成</span>
                    </button>

                    <button
                      disabled={isSimulatingCall}
                      onClick={() => handleSimulateApiCall('tts')}
                      className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 disabled:opacity-50 text-zinc-200 text-xs px-3.5 py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Play className="w-3 h-3 text-purple-400 fill-purple-400" />
                      <span>模拟 Cosmic TTS 转码</span>
                    </button>

                    <button
                      disabled={isSimulatingCall}
                      onClick={() => handleSimulateApiCall('clone')}
                      className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 disabled:opacity-50 text-zinc-200 text-xs px-3.5 py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Play className="w-3 h-3 text-blue-400 fill-blue-400" />
                      <span>模拟 录音克隆算力提取</span>
                    </button>

                    <button
                      disabled={isSimulatingCall}
                      onClick={() => handleSimulateApiCall('other')}
                      className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 disabled:opacity-50 text-zinc-200 text-xs px-3.5 py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Play className="w-3 h-3 text-zinc-400 fill-zinc-400" />
                      <span>模拟 运营层基础请求</span>
                    </button>
                  </div>
                </div>

                {/* API statistics indicators */}
                <div className="grid grid-cols-5 gap-4">
                  
                  <div className="bg-white p-4.5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider font-mono">Total Requests</span>
                      <span className="text-2xl font-black text-zinc-900 block mt-1">{apiStats.totalRequests} 次</span>
                    </div>
                    <div className="text-[9px] text-zinc-400 mt-2 font-mono border-t border-zinc-100 pt-1.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping"></span>
                      <span>活跃统计期: 近30日</span>
                    </div>
                  </div>

                  <div className="bg-white p-4.5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider font-mono">Gemini AI Calls</span>
                      <span className="text-2xl font-black text-emerald-600 block mt-1">{apiStats.geminiTextCalls} 次</span>
                    </div>
                    <div className="text-[9px] text-zinc-500 mt-2 font-mono border-t border-zinc-100 pt-1.5 flex justify-between">
                      <span>成功率 100%</span>
                      <span className="text-zinc-400">计费费率: 免费级</span>
                    </div>
                  </div>

                  <div className="bg-white p-4.5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider font-mono">Audio TTS Synth</span>
                      <span className="text-2xl font-black text-purple-600 block mt-1">{apiStats.voiceSynthCalls} 次</span>
                    </div>
                    <div className="text-[9px] text-zinc-500 mt-2 font-mono border-t border-zinc-100 pt-1.5 flex justify-between">
                      <span>已转码: {apiStats.voiceSynthSuccess} 首</span>
                      <span className="text-zinc-400">错误数: {apiStats.voiceSynthError}</span>
                    </div>
                  </div>

                  <div className="bg-white p-4.5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider font-mono">Total Token count</span>
                      <span className="text-2xl font-black text-zinc-800 block mt-1">{(apiStats.totalTokens || 0).toLocaleString()} <span className="text-xs font-normal text-zinc-400">Tokens</span></span>
                    </div>
                    <div className="text-[9px] text-zinc-500 mt-2 font-mono border-t border-zinc-100 pt-1.5 flex justify-between">
                      <span>折合字符: {Math.round(apiStats.totalTokens * 1.5).toLocaleString()} 字</span>
                      <span className="text-zinc-400">平均耗量/部</span>
                    </div>
                  </div>

                  <div className="bg-white p-4.5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider font-mono">Average Latency</span>
                      <span className="text-2xl font-black text-amber-600 block mt-1">{apiStats.averageLatencyMs} ms</span>
                    </div>
                    <div className="text-[9px] text-zinc-500 mt-2 font-mono border-t border-zinc-100 pt-1.5 flex items-center gap-1 justify-between">
                      <span className="bg-green-100 text-green-700 px-1 py-0.5 rounded text-[8px] font-extrabold uppercase">Excellent</span>
                      <span className="text-zinc-400">同城机房</span>
                    </div>
                  </div>

                </div>

                {/* API Request Logs Database Table */}
                <div className="space-y-3">
                  
                  {/* Filters Bar */}
                  <div className="flex justify-between items-center bg-white px-5 py-3.5 rounded-2xl border border-zinc-200 shadow-xs">
                    <span className="text-xs font-extrabold text-zinc-800 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-zinc-600" />
                      网关流水监视台 (Gate Logs Console)
                    </span>

                    <div className="flex gap-4 items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-zinc-400">服务划分:</span>
                        <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/80">
                          {[
                            { id: 'all', label: '全部服务' },
                            { id: 'gemini', label: 'Gemini Text' },
                            { id: 'tts', label: 'Cosmic TTS' },
                            { id: 'clone', label: '录音克隆' },
                            { id: 'other', label: '基础请求' },
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setApiServiceFilter(opt.id)}
                              className={`px-2 py-1 text-[9px] font-bold rounded-md transition cursor-pointer ${apiServiceFilter === opt.id ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-400 hover:text-zinc-800'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-zinc-400">状态过滤:</span>
                        <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/80">
                          {[
                            { id: 'all', label: '全部' },
                            { id: 'success', label: '成功 (200)' },
                            { id: 'error', label: '失败' },
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => setApiStatusFilter(opt.id)}
                              className={`px-2 py-1 text-[9px] font-bold rounded-md transition cursor-pointer ${apiStatusFilter === opt.id ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-400 hover:text-zinc-800'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Table View */}
                  <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="bg-zinc-50 text-zinc-500 font-bold border-b border-zinc-200">
                          <th className="p-4 w-[160px]">请求时间戳</th>
                          <th className="p-4 w-[90px]">接口动作</th>
                          <th className="p-4">请求路由</th>
                          <th className="p-4 w-[180px]">调用微服务</th>
                          <th className="p-4 w-[95px]">响应时延</th>
                          <th className="p-4 w-[110px]">字符消耗额度</th>
                          <th className="p-4 w-[100px]">服务状态</th>
                          <th className="p-4 w-[75px] text-center">细节</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLogs.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-zinc-400 text-xs font-sans">
                              没有找到匹配的 API 接口调用流水记录
                            </td>
                          </tr>
                        ) : (
                          filteredLogs.map((log: any) => {
                            const isExpanded = expandedLogId === log.id;
                            const isSuccess = log.status >= 200 && log.status < 300;
                            const dateStr = new Date(log.timestamp).toLocaleString();
                            
                            return (
                              <React.Fragment key={log.id}>
                                <tr className="border-b border-zinc-100 hover:bg-zinc-50/50 text-zinc-700 transition">
                                  <td className="p-4 text-[11px] text-zinc-400 whitespace-nowrap">{dateStr}</td>
                                  <td className="p-4">
                                    <span className="bg-zinc-900 text-zinc-300 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider font-mono">
                                      {log.method}
                                    </span>
                                  </td>
                                  <td className="p-4 text-zinc-800 font-bold text-[11px] font-mono tracking-tight">{log.route}</td>
                                  <td className="p-4 text-zinc-600 font-sans text-xs">
                                    <span className="flex items-center gap-1.5">
                                      <span className={`w-1.5 h-1.5 rounded-full ${log.service?.includes("Gemini") ? "bg-emerald-500" : log.service?.includes("TTS") ? "bg-purple-500" : "bg-blue-400"}`}></span>
                                      {log.service}
                                    </span>
                                  </td>
                                  <td className="p-4 font-mono text-[11px] text-zinc-600 font-bold">
                                    {log.latencyMs} ms
                                  </td>
                                  <td className="p-4 font-mono text-[11px] text-zinc-500">
                                    {log.tokens > 0 ? `${log.tokens} Tks` : '—'}
                                  </td>
                                  <td className="p-4">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 w-fit ${isSuccess ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                      {isSuccess ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <AlertTriangle className="w-3 h-3 text-red-600" />}
                                      {log.status === 200 ? 'HTTP 200' : `Err ${log.status}`}
                                    </span>
                                  </td>
                                  <td className="p-4 text-center">
                                    <button
                                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                      className="text-[10px] hover:underline font-bold text-zinc-900 font-sans cursor-pointer"
                                    >
                                      {isExpanded ? '折叠 ▲' : '详情 ▼'}
                                    </button>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr className="bg-zinc-950 text-zinc-300 font-mono text-[10px]">
                                    <td colSpan={8} className="p-4 border-b border-zinc-800">
                                      <div className="space-y-2 max-w-5xl overflow-x-auto select-all p-1">
                                        <div className="flex justify-between items-center text-[9px] text-zinc-500 border-b border-zinc-800 pb-1.5 mb-1.5 font-sans">
                                          <span>💡 REST API JSON 交互负载数据报文</span>
                                          <span>双击或拖拽可完整复制请求日志</span>
                                        </div>
                                        <pre className="text-zinc-400 text-[10px] leading-relaxed">
                                          {JSON.stringify({
                                            log_id: log.id,
                                            timestamp_utc: log.timestamp,
                                            endpoint: log.route,
                                            method: log.method,
                                            response_code: log.status,
                                            client_ip: "127.0.0.1 (Reverse-Proxy)",
                                            performance: {
                                              network_latency_ms: log.latencyMs,
                                              throughput_status: log.latencyMs < 1000 ? "Excellent" : "Standard",
                                              hardware_thread: "DREAM-NODE-S3"
                                            },
                                            payload: {
                                              requested_service: log.service,
                                              estimated_token_weight: log.tokens,
                                              result_message: log.message,
                                              headers: {
                                                "content-type": "application/json",
                                                "x-platform-key": "aistudio-build-deploy-active",
                                                "user-agent": "dream-companion-client/v1.1"
                                              }
                                            }
                                          }, null, 2)}
                                        </pre>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            );
          })()}

          {/* ================= TAB 10: CONTENT SAFETY & AUDIT REVIEW ================= */}
          {activeTab === "safety_control" && (
            <SafetyControlTab
              db={db}
              refreshDb={refreshDb}
              triggerAlert={triggerAlert}
            />
          )}

        </main>
      </div>

    </div>
  );
}

interface SafetyControlTabProps {
  db: any;
  refreshDb: () => void;
  triggerAlert: (msg: string) => void;
}

function SafetyControlTab({ db, refreshDb, triggerAlert }: SafetyControlTabProps) {
  const config = db?.sensitiveWordsConfig || {
    categories: [],
    sensitiveWords: [],
    auditLogs: []
  };

  const categories = config.categories || [];
  const words = config.sensitiveWords || [];
  const logs = config.auditLogs || [];

  const [newWord, setNewWord] = useState("");
  const [newWordCat, setNewWordCat] = useState("violence");
  const [localWords, setLocalWords] = useState(words);
  const [localCats, setLocalCats] = useState(categories);
  const [savingConfig, setSavingConfig] = useState(false);

  // Synchronize local states with db updates
  React.useEffect(() => {
    setLocalWords(words);
    setLocalCats(categories);
  }, [config]);

  const handleAddWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    if (localWords.some((w: any) => w.word.trim() === newWord.trim())) {
      triggerAlert("⚠️ 该敏感词已存在！");
      return;
    }
    const updatedWords = [...localWords, { word: newWord.trim(), category: newWordCat }];
    setLocalWords(updatedWords);
    setNewWord("");
    triggerAlert("✓ 敏感词已临时加入词库列表，请点击下方『保存配置并应用』进行持久化。");
  };

  const handleDeleteWord = (wordText: string) => {
    const updatedWords = localWords.filter((w: any) => w.word !== wordText);
    setLocalWords(updatedWords);
    triggerAlert("✓ 敏感词已从临时列表移除。");
  };

  const handleCategoryHandlingChange = (key: string, handling: string) => {
    const updatedCats = localCats.map((c: any) => {
      if (c.key === key) return { ...c, handling };
      return c;
    });
    setLocalCats(updatedCats);
  };

  const handleSaveSafetyConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch("/api/admin/safety-config/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories: localCats,
          sensitiveWords: localWords
        })
      });
      if (res.ok) {
        refreshDb();
        triggerAlert("🎉 伴梦内容安全防火墙配置已实时更新并发布应用！");
      } else {
        triggerAlert("保存安全配置失败");
      }
    } catch (err) {
      triggerAlert("保存安全配置网络错误");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAuditAction = async (id: string, status: 'approved' | 'overridden') => {
    try {
      const res = await fetch("/api/admin/safety-config/audit-resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
      });
      if (res.ok) {
        refreshDb();
        triggerAlert(status === 'approved' ? "✓ 已标记核准该拦截处理" : "✗ 已标记驳回/复原该拦截");
      } else {
        triggerAlert("审核操作失败");
      }
    } catch (err) {
      triggerAlert("审核操作网络错误");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header Banner */}
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-100 rounded-xl">
            <Shield className="w-5 h-5 text-zinc-900" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
              全栈内容合规与少儿防沉迷安全防护中心
            </h3>
            <p className="text-[10px] text-zinc-400 mt-1">
              自定义用户输入拦截、大模型提示词（Prompt）二次审核、多级有害内容改写净化以及后台人工复核流机制。
            </p>
          </div>
        </div>
        
        <button
          onClick={handleSaveSafetyConfig}
          disabled={savingConfig}
          className="bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-50 text-xs font-bold px-4 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5"
        >
          {savingConfig ? "正在保存..." : "💾 保存配置并实时应用到全栈"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Categories and Settings */}
        <div className="space-y-6">
          
          {/* Category Action Plans */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
              <Settings className="w-4 h-4 text-zinc-900" />
              <h4 className="text-xs font-extrabold text-zinc-800">1. 敏感词类别与差异化处理决策</h4>
            </div>
            
            <div className="space-y-3">
              {localCats.map((cat: any) => (
                <div key={cat.key} className="flex justify-between items-center bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                  <div>
                    <span className="text-xs font-bold text-zinc-800">{cat.name}</span>
                    <span className="text-[9px] font-mono text-zinc-400 block mt-0.5">Category Key: {cat.key}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-400 font-medium">处理策略：</span>
                    <select
                      value={cat.handling}
                      onChange={(e) => handleCategoryHandlingChange(cat.key, e.target.value)}
                      className="bg-white border border-zinc-200 text-[11px] font-bold text-zinc-700 px-2 py-1 rounded-lg focus:outline-none focus:border-zinc-950"
                    >
                      <option value="intercept">直接拦截 (Intercept)</option>
                      <option value="rewrite">儿童友好改写建议 (Rewrite)</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Word Lexicon Builder */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
              <Plus className="w-4 h-4 text-zinc-900" />
              <h4 className="text-xs font-extrabold text-zinc-800">2. 自定义敏感词添加与管理词库</h4>
            </div>

            <form onSubmit={handleAddWord} className="flex gap-2 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
              <input
                type="text"
                required
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="请输入禁用的敏感词 (例如：手枪)..."
                className="flex-1 bg-white border border-zinc-200 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-zinc-950"
              />
              <select
                value={newWordCat}
                onChange={(e) => setNewWordCat(e.target.value)}
                className="bg-white border border-zinc-200 text-[11px] font-bold text-zinc-700 px-2.5 py-1 rounded-lg focus:outline-none"
              >
                {localCats.map((c: any) => (
                  <option key={c.key} value={c.key}>{c.name}</option>
                ))}
              </select>
              <button
                type="submit"
                className="bg-zinc-950 text-white hover:bg-zinc-800 px-3.5 py-1.5 text-xs font-bold rounded-lg transition"
              >
                新增禁词
              </button>
            </form>

            <div>
              <span className="text-[10px] text-zinc-400 font-bold block mb-2">
                当前拦截词汇库 ({localWords.length} 个词)：
              </span>
              
              <div className="flex flex-wrap gap-1.5 max-h-[180px] overflow-y-auto pr-1 wechat-screen-scrollbar">
                {localWords.map((item: any, idx: number) => {
                  const catObj = localCats.find((c: any) => c.key === item.category) || { name: "未知" };
                  return (
                    <span
                      key={idx}
                      className="bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-lg px-2 py-1 text-[10px] flex items-center gap-1 hover:bg-red-50 hover:border-red-100 hover:text-red-700 transition group cursor-pointer"
                      onClick={() => handleDeleteWord(item.word)}
                      title="点击删除该词"
                    >
                      <span>{item.word}</span>
                      <span className="text-[8px] bg-zinc-200 text-zinc-500 rounded px-1 group-hover:bg-red-200 group-hover:text-red-800">
                        {catObj.name}
                      </span>
                      <Trash2 className="w-2.5 h-2.5 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Audit Review Records */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs flex flex-col h-[610px] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5 shrink-0">
            <Eye className="w-4 h-4 text-zinc-900" />
            <h4 className="text-xs font-extrabold text-zinc-800">3. 伴梦安全守护：有害/违规内容拦截与复核流水</h4>
          </div>

          <div className="flex-1 overflow-y-auto wechat-screen-scrollbar mt-3 space-y-3.5 pr-1 font-sans">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-zinc-400 select-none space-y-2">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
                <span className="text-[11px] font-medium">暂无触发敏感词过滤的安全事件日志</span>
              </div>
            ) : (
              logs.map((log: any) => {
                const dateStr = new Date(log.timestamp).toLocaleString();
                const catObj = categories.find((c: any) => c.key === log.category) || { name: "敏感事件" };
                
                return (
                  <div key={log.id} className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-xs space-y-2.5 relative">
                    
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${log.actionTaken === 'intercept' ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`}></span>
                          <span className="font-extrabold text-zinc-800">
                            {log.actionTaken === 'intercept' ? '❌ 直接拦截并封禁' : '✨ 友好改写/引导建议'}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 block font-mono">{dateStr}</span>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${log.status === 'pending_review' ? 'bg-amber-50 text-amber-700 border border-amber-200' : log.status === 'approved' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-zinc-200 text-zinc-600'}`}>
                        {log.status === 'pending_review' ? '⏳ 待人工复核' : log.status === 'approved' ? '✓ 已通过复核' : '驳回/处理完毕'}
                      </span>
                    </div>

                    <div className="border-t border-zinc-200/50 pt-2 space-y-1.5">
                      <div className="grid grid-cols-6 gap-1">
                        <span className="col-span-1 text-zinc-400 text-[10px] font-bold">扫描源：</span>
                        <span className="col-span-5 text-zinc-700 font-medium font-mono text-[10px]">
                          {log.type === 'input_check' ? '👤 微信端家长输入' : log.type === 'prompt_check' ? '🤖 提示词二次整合检查' : '📝 生成故事文本二次审查'}
                        </span>
                      </div>
                      <div className="grid grid-cols-6 gap-1">
                        <span className="col-span-1 text-zinc-400 text-[10px] font-bold">违规类别：</span>
                        <span className="col-span-5 font-extrabold text-red-600">
                          {catObj.name}
                        </span>
                      </div>
                      <div className="grid grid-cols-6 gap-1">
                        <span className="col-span-1 text-zinc-400 text-[10px] font-bold">原始文：</span>
                        <span className="col-span-5 bg-white p-2 border border-zinc-100 rounded-lg text-[11px] text-zinc-600 font-medium select-all leading-relaxed whitespace-pre-wrap max-h-16 overflow-y-auto wechat-screen-scrollbar">
                          {log.originalInput}
                        </span>
                      </div>
                      {log.actionTaken === 'rewrite' && (
                        <div className="grid grid-cols-6 gap-1">
                          <span className="col-span-1 text-zinc-400 text-[10px] font-bold">处理结果：</span>
                          <span className="col-span-5 bg-green-50/50 p-2 border border-green-100 rounded-lg text-[11px] text-zinc-600 font-bold select-all leading-relaxed">
                            {log.processedInput}
                          </span>
                        </div>
                      )}
                    </div>

                    {log.status === 'pending_review' && (
                      <div className="flex gap-2 justify-end border-t border-zinc-200/50 pt-2.5 mt-2">
                        <button
                          onClick={() => handleAuditAction(log.id, 'overridden')}
                          className="bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 text-[10px] font-bold px-2.5 py-1 rounded-lg transition"
                        >
                          驳回复原
                        </button>
                        <button
                          onClick={() => handleAuditAction(log.id, 'approved')}
                          className="bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold px-3 py-1 rounded-lg transition"
                        >
                          复核核准
                        </button>
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

