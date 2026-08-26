import React, { useState, useEffect, useRef } from "react";
import { 
  BookOpen, Mic, User, Gift, Bell, Play, Pause, ChevronLeft, ChevronRight, 
  RotateCcw, Sparkles, Check, ArrowRight, Trash2, Heart, Volume2, Plus, 
  Search, Clock, Compass, Share2, Info, Moon, Award, Ticket, Edit3, MessageSquare, AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ChildProfile, VoiceClone, StoryTemplate, UserStory, AppNotification } from "../types";
import { VectorIllustration } from "./VectorIllustration";

interface WeChatSimulatorProps {
  db: any;
  refreshDb: () => void;
  onUpdateProfile: (profile: any) => Promise<any>;
  onCloneVoice: (voiceData: { name: string; speakerType: string; recordDuration: number }) => Promise<any>;
  onDeleteVoice: (id: string) => Promise<any>;
  onGenerateStoryText: (data: { theme: string; educationalGoal: string; scene: string; mainCharacter: any; mainCharacters?: any[]; duration: string; age: number; isRetry: boolean; retryCount?: number }) => Promise<any>;
  onGenerateStoryAudio: (data: { story: any; voiceId: string; voiceMode: string; theme: string; educationalGoal: string; scene: string; mainCharacterName: string; duration: string; targetAge: number; bgmType?: string }) => Promise<any>;
  onSaveStoryToggle: (id: string, type: 'favorite' | 'diary') => Promise<any>;
  onDeleteStory: (id: string) => Promise<any>;
  onRenameStory: (id: string, title: string) => Promise<any>;
  onRedeemCDKey: (code: string) => Promise<any>;
  onBindReferral: (code: string) => Promise<any>;
  onReadAllNotifications: () => Promise<any>;
  onDeleteNotification: (id: string) => Promise<any>;
}

export default function WeChatSimulator({
  db,
  refreshDb,
  onUpdateProfile,
  onCloneVoice,
  onDeleteVoice,
  onGenerateStoryText,
  onGenerateStoryAudio,
  onSaveStoryToggle,
  onDeleteStory,
  onRenameStory,
  onRedeemCDKey,
  onBindReferral,
  onReadAllNotifications,
  onDeleteNotification
}: WeChatSimulatorProps) {
  // Mini program navigation states: 'welcome' | 'profile_setup' | 'tab_home' | 'tab_studio' | 'tab_my' | 'wizard' | 'text_wait' | 'text_preview' | 'audio_wait' | 'player' | 'diary'
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem("banmeng_is_logged_in") === "true";
  });
  const [page, setPage] = useState<string>(() => {
    const logged = localStorage.getItem("banmeng_is_logged_in") === "true";
    return logged ? "tab_home" : "welcome";
  });
  const [toast, setToast] = useState<string | null>(null);
  
  // WeChat Login Simulation states
  const [showWeChatAuth, setShowWeChatAuth] = useState<boolean>(false);
  const [wechatNickname, setWechatNickname] = useState<string>("微信用户");
  const [wechatAvatar, setWechatAvatar] = useState<string>("🧸");
  
  // Safety Intercept and Rewrite States
  const [safetyBlockedData, setSafetyBlockedData] = useState<{ message: string; word: string; categoryName: string } | null>(null);
  const [safetyRewriteData, setSafetyRewriteData] = useState<{ message: string; word: string; categoryName: string; originalInput: string; suggestedReplacement: string } | null>(null);

  // Profile fields
  const [profileForm, setProfileForm] = useState<ChildProfile>({
    nickname: db?.profile?.nickname || "",
    age: db?.profile?.age || 4,
    gender: db?.profile?.gender || "boy",
    interests: db?.profile?.interests || [],
    parentName: db?.profile?.parentName || "",
    bedTime: db?.profile?.bedTime || "21:00"
  });

  // Sync profileForm once db loads
  useEffect(() => {
    if (db?.profile) {
      setProfileForm({ ...db.profile });
    }
  }, [db]);

  // Voice recording mock state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [recordedVoiceName, setRecordedVoiceName] = useState("");
  const [recordSpeaker, setRecordSpeaker] = useState<string>("mother");
  const recordingInterval = useRef<any>(null);

  // CDKey state
  const [cdkeyCode, setCdkeyCode] = useState("");
  const [referralCode, setReferralCode] = useState("");

  // Story wizard states
  const [selectedTemplate, setSelectedTemplate] = useState<StoryTemplate | null>(null);
  const [wizardStep, setWizardStep] = useState(1); // 1: Choose mode, 2: Theme/Goal, 3: Scene/Char, 4: Duration/Voice, 5: Summary
  const [wizardTheme, setWizardTheme] = useState("睡前安抚");
  const [wizardGoal, setWizardGoal] = useState("克服怕黑恐惧");
  const [wizardScene, setWizardScene] = useState("静谧森林");
  const [charName, setCharName] = useState("");
  const [charRole, setCharRole] = useState("");
  const [charPersonality, setCharPersonality] = useState("");
  
  // Custom theme and scene state
  const [customThemeInput, setCustomThemeInput] = useState("");
  const [customSceneInput, setCustomSceneInput] = useState("");
  const [customGoalInput, setCustomGoalInput] = useState("");

  // Multiple characters support
  const [wizardCharacters, setWizardCharacters] = useState<Array<{
    id: string;
    name: string;
    role: string;
    personality: string;
    customDescription: string;
    isCustomDescription: boolean;
  }>>([
    { id: "char_default", name: "", role: "小熊", personality: "调皮活泼", customDescription: "", isCustomDescription: false }
  ]);

  const [wizardDuration, setWizardDuration] = useState<'short' | 'medium' | 'long'>("short");
  const [longCustomMinutes, setLongCustomMinutes] = useState<number>(10);
  const [wizardVoiceId, setWizardVoiceId] = useState("");
  const [wizardVoiceMode, setWizardVoiceMode] = useState<'single' | 'multi' | 'narrator_ai'>("single");
  const [wizardBgmType, setWizardBgmType] = useState<string>("none"); // 'none' | 'soft_noise' | 'rain' | 'waves' | 'wind'

  // Sync wizardVoiceId when db loads or state becomes empty/invalid
  useEffect(() => {
    if (db?.voiceClones && db.voiceClones.length > 0) {
      const exists = db.voiceClones.some((v: any) => v.id === wizardVoiceId);
      if (!exists || !wizardVoiceId) {
        setWizardVoiceId(db.voiceClones[0].id);
      }
    } else {
      setWizardVoiceId("");
    }
  }, [db, wizardVoiceId]);

  // Story intermediate generated text
  const [generatedTextStory, setGeneratedTextStory] = useState<any>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Background Audio Wait simulation states
  const [audioWaitProgress, setAudioWaitProgress] = useState(0);
  const [audioWaitStage, setAudioWaitStage] = useState<'queued' | 'tts_generating' | 'mixing' | 'ready'>('queued');

  useEffect(() => {
    if (page !== "audio_wait") {
      setAudioWaitProgress(0);
      setAudioWaitStage('queued');
      return;
    }

    let interval = setInterval(() => {
      setAudioWaitProgress(prev => {
        const next = prev + Math.floor(Math.random() * 8) + 2;
        if (next >= 100) {
          clearInterval(interval);
          return 99; // Cap at 99 until finished
        }
        
        // Update stage based on progress
        if (next < 25) {
          setAudioWaitStage('queued');
        } else if (next < 70) {
          setAudioWaitStage('tts_generating');
        } else {
          setAudioWaitStage(wizardBgmType === 'none' ? 'ready' : 'mixing');
        }
        
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [page, wizardBgmType]);

  // Active Story Player states
  const [activeStory, setActiveStory] = useState<UserStory | null>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerProgress, setPlayerProgress] = useState(0);
  const [sleepTimer, setSleepTimer] = useState<number | null>(null); // minutes
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null); // seconds
  const playerInterval = useRef<any>(null);

  // Search/Filter for diary
  const [diarySearch, setDiarySearch] = useState("");
  const [diaryFilter, setDiaryFilter] = useState<string>("all"); // 'all' | 'favorite' | 'bedtime' | 'courage'
  const [storyRenameId, setStoryRenameId] = useState<string | null>(null);
  const [storyRenameTitle, setStoryRenameTitle] = useState("");

  // Config maintenance states
  const [maintenanceTab, setMaintenanceTab] = useState<'themes_goals' | 'scenes'>("themes_goals");
  const [newThemeName, setNewThemeName] = useState("");
  const [editingThemeIndex, setEditingThemeIndex] = useState<number | null>(null);
  const [editingThemeValue, setEditingThemeValue] = useState("");
  const [selectedThemeForGoals, setSelectedThemeForGoals] = useState("");
  const [newGoalName, setNewGoalName] = useState("");
  const [editingGoalIndex, setEditingGoalIndex] = useState<number | null>(null);
  const [editingGoalValue, setEditingGoalValue] = useState("");
  const [newSceneName, setNewSceneName] = useState("");
  const [editingSceneIndex, setEditingSceneIndex] = useState<number | null>(null);
  const [editingSceneValue, setEditingSceneValue] = useState("");

  // Template search/filter states
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateThemeFilter, setTemplateThemeFilter] = useState("all");

  // Notification center visible
  const [showNotifications, setShowNotifications] = useState(false);

  // Notification stats badge
  const unreadCount = db?.notifications?.filter((n: any) => !n.isRead).length || 0;

  // Show customized toast
  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Sleep timer ticker
  useEffect(() => {
    let interval: any;
    if (timerRemaining !== null && timerRemaining > 0 && isPlaying) {
      interval = setInterval(() => {
        setTimerRemaining(prev => {
          if (prev !== null && prev <= 1) {
            setIsPlaying(false);
            triggerToast("😴 睡眠定时结束，已自动为您关闭播放。");
            return null;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRemaining, isPlaying]);

  const [activeBgmType, setActiveBgmType] = useState<string>("none");

  // Web Audio BGM Synthesizer Refs
  const bgmAudioCtxRef = useRef<AudioContext | null>(null);
  const bgmSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const bgmLfoNodeRef = useRef<OscillatorNode | null>(null);
  const bgmGainNodeRef = useRef<GainNode | null>(null);

  // Synchronize activeBgmType when activeStory changes
  useEffect(() => {
    if (activeStory) {
      setActiveBgmType(activeStory.bgmType || "none");
    } else {
      setActiveBgmType("none");
    }
  }, [activeStory]);

  // Web Audio Synthesizer logic
  useEffect(() => {
    // If not playing, or bgm is none, stop the background sound
    if (!isPlaying || activeBgmType === "none" || page !== "player") {
      stopBgm();
      return;
    }

    // Play/start background noise
    playBgm(activeBgmType);

    return () => {
      stopBgm();
    };

    function stopBgm() {
      try {
        if (bgmSourceNodeRef.current) {
          bgmSourceNodeRef.current.stop();
          bgmSourceNodeRef.current.disconnect();
          bgmSourceNodeRef.current = null;
        }
        if (bgmLfoNodeRef.current) {
          bgmLfoNodeRef.current.stop();
          bgmLfoNodeRef.current.disconnect();
          bgmLfoNodeRef.current = null;
        }
        if (bgmGainNodeRef.current) {
          bgmGainNodeRef.current.disconnect();
          bgmGainNodeRef.current = null;
        }
      } catch (e) {
        console.warn("Error stopping BGM:", e);
      }
    }

    function playBgm(type: string) {
      stopBgm();
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        
        const ctx = bgmAudioCtxRef.current || new AudioContextClass();
        bgmAudioCtxRef.current = ctx;

        if (ctx.state === "suspended") {
          ctx.resume();
        }

        const bufferSize = 4 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        if (type === "soft_noise") {
          // Brown noise
          let lastOut = 0.0;
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 3.5;
          }
          const source = ctx.createBufferSource();
          source.buffer = noiseBuffer;
          source.loop = true;

          const gain = ctx.createGain();
          gain.gain.value = 0.08; // quiet, bedtime safe

          source.connect(gain);
          gain.connect(ctx.destination);

          source.start(0);
          bgmSourceNodeRef.current = source;
          bgmGainNodeRef.current = gain;

        } else if (type === "rain") {
          // Pink-filtered noise for rain
          let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
            b6 = white * 0.115926;
            output[i] *= 0.12;
          }
          const source = ctx.createBufferSource();
          source.buffer = noiseBuffer;
          source.loop = true;

          const gain = ctx.createGain();
          gain.gain.value = 0.06; // soft rain

          source.connect(gain);
          gain.connect(ctx.destination);

          source.start(0);
          bgmSourceNodeRef.current = source;
          bgmGainNodeRef.current = gain;

        } else if (type === "waves") {
          // Ocean waves: brown noise modulated by slow 0.08Hz LFO
          let lastOut = 0.0;
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            output[i] = (lastOut + (0.015 * white)) / 1.015;
            lastOut = output[i];
            output[i] *= 4.5;
          }
          const source = ctx.createBufferSource();
          source.buffer = noiseBuffer;
          source.loop = true;

          const waveGain = ctx.createGain();
          waveGain.gain.value = 0.05; // base wave volume

          const lfo = ctx.createOscillator();
          lfo.frequency.value = 0.08; // 12 seconds per wave

          const lfoGain = ctx.createGain();
          lfoGain.gain.value = 0.03; // modulation depth

          lfo.connect(lfoGain);
          lfoGain.connect(waveGain.gain); // modulate the gain
          
          source.connect(waveGain);
          waveGain.connect(ctx.destination);

          lfo.start(0);
          source.start(0);

          bgmSourceNodeRef.current = source;
          bgmLfoNodeRef.current = lfo;
          bgmGainNodeRef.current = waveGain;

        } else if (type === "wind") {
          // Forest wind: bandpass filtered noise modulated by slow 0.05Hz LFO
          let lastOut = 0.0;
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 3.0;
          }
          const source = ctx.createBufferSource();
          source.buffer = noiseBuffer;
          source.loop = true;

          const filter = ctx.createBiquadFilter();
          filter.type = "bandpass";
          filter.Q.value = 1.5;
          filter.frequency.value = 450; // base wind frequency

          const lfo = ctx.createOscillator();
          lfo.frequency.value = 0.05; // very slow whistling

          const lfoGain = ctx.createGain();
          lfoGain.gain.value = 150; // modulate filter center

          lfo.connect(lfoGain);
          lfoGain.connect(filter.frequency);

          const gain = ctx.createGain();
          gain.gain.value = 0.07; // soft wind

          source.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);

          lfo.start(0);
          source.start(0);

          bgmSourceNodeRef.current = source;
          bgmLfoNodeRef.current = lfo;
          bgmGainNodeRef.current = gain;
        }
      } catch (e) {
        console.error("Web Audio Play BGM Error:", e);
      }
    }
  }, [isPlaying, activeBgmType, page]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync real audio playback and progression
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setPlayerProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      if (currentChapterIndex < (activeStory?.chapters?.length || 0) - 1) {
        setCurrentChapterIndex(prevIdx => prevIdx + 1);
        setPlayerProgress(0);
      } else {
        setIsPlaying(false);
        triggerToast("🎉 故事播放完了，宝贝睡个好觉吧！");
        setPlayerProgress(100);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentChapterIndex, activeStory]);

  // Handle playing/pausing of actual audio
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    const currentChapter = activeStory?.chapters?.[currentChapterIndex];

    if (currentChapter?.audioUrl) {
      // If src changed, set new source
      if (audio.src !== window.location.origin + currentChapter.audioUrl && !audio.src.endsWith(currentChapter.audioUrl)) {
        audio.src = currentChapter.audioUrl;
        audio.load();
      }
      if (isPlaying) {
        audio.play().catch(e => {
          console.warn("Audio auto-play failed, waiting for user interaction:", e);
        });
      } else {
        audio.pause();
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, currentChapterIndex, activeStory]);

  // Player ticker
  useEffect(() => {
    const currentChapter = activeStory?.chapters?.[currentChapterIndex];
    if (currentChapter?.audioUrl) {
      // Skip simulated progression, real audio handles it
      return;
    }

    if (isPlaying && activeStory) {
      playerInterval.current = setInterval(() => {
        setPlayerProgress(prev => {
          if (prev >= 100) {
            // Next chapter or repeat
            if (currentChapterIndex < activeStory.chapters.length - 1) {
              setCurrentChapterIndex(prevIdx => prevIdx + 1);
              return 0;
            } else {
              // Finished story
              setIsPlaying(false);
              triggerToast("🎉 故事播放完了，宝贝睡个好觉吧！");
              return 100;
            }
          }
          return prev + 2; // increments
        });
      }, 800);
    } else {
      clearInterval(playerInterval.current);
    }
    return () => clearInterval(playerInterval.current);
  }, [isPlaying, currentChapterIndex, activeStory]);

  // Voice recording handlers
  const startRecording = () => {
    setIsRecording(true);
    setRecordSec(0);
    recordingInterval.current = setInterval(() => {
      setRecordSec(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    clearInterval(recordingInterval.current);
    setIsRecording(false);
  };

  const handleCreateVoice = async () => {
    if (!recordedVoiceName.trim()) {
      triggerToast("⚠️ 请先给克隆的声音起个名字！");
      return;
    }
    if (recordSec < 5) {
      triggerToast("⚠️ 录音时间太短，请至少录制5秒！");
      return;
    }

    try {
      const res = await onCloneVoice({
        name: recordedVoiceName,
        speakerType: recordSpeaker,
        recordDuration: recordSec
      });
      if (res.success) {
        triggerToast("✨ 声音克隆成功！");
        setRecordedVoiceName("");
        setRecordSec(0);
        refreshDb();
      }
    } catch (e: any) {
      triggerToast(e.message || "克隆失败");
    }
  };

  // Profile Save
  const handleSaveProfile = async () => {
    if (!profileForm.nickname.trim()) {
      triggerToast("⚠️ 请输入孩子的昵称！");
      return;
    }
    try {
      const res = await onUpdateProfile(profileForm);
      if (res.success) {
        triggerToast("💾 孩子资料保存成功！");
        setPage("tab_home");
        refreshDb();
      }
    } catch (e) {
      triggerToast("保存资料失败");
    }
  };

  // Apply template
  const handleApplyTemplate = (tpl: StoryTemplate) => {
    setSelectedTemplate(tpl);
    setWizardTheme(tpl.theme);
    setWizardGoal(tpl.educationalGoal);
    setWizardScene(tpl.scene);
    setCustomThemeInput("");
    setCustomSceneInput("");
    setCustomGoalInput("");
    setCharName(tpl.mainCharacter.name);
    setCharRole(tpl.mainCharacter.role);
    setCharPersonality(tpl.mainCharacter.personality);
    setWizardCharacters([
      {
        id: "char_default",
        name: tpl.mainCharacter.name,
        role: tpl.mainCharacter.role,
        personality: tpl.mainCharacter.personality,
        customDescription: "",
        isCustomDescription: false
      }
    ]);
    setWizardDuration(tpl.duration);
    setWizardStep(4); // Skip to choose voice/duration
    setPage("wizard");
  };

  const handleStartCustomWizard = () => {
    setSelectedTemplate(null);
    setWizardTheme("睡前安抚");
    setWizardGoal("克服怕黑恐惧");
    setWizardScene("静谧森林");
    setCustomThemeInput("");
    setCustomSceneInput("");
    setCustomGoalInput("");
    setCharName("");
    setCharRole("小探险家");
    setCharPersonality("勇敢聪明");
    setWizardCharacters([
      { id: "char_1", name: "", role: "小探险家", personality: "勇敢聪明", customDescription: "", isCustomDescription: false }
    ]);
    setWizardDuration("short");
    setWizardStep(1); // Mode selection
    setPage("wizard");
  };

  // Generate text story
  const handleGenerateStoryTextFlow = async () => {
    // Determine age
    const childAge = db?.profile?.age || 4;

    setPage("text_wait");
    try {
      const finalTheme = wizardTheme === '自定义' ? (customThemeInput.trim() || "奇妙故事") : wizardTheme;
      const finalGoal = (wizardTheme === '自定义' || wizardGoal === '自定义') ? (customGoalInput.trim() || "健康快乐成长") : wizardGoal;
      const finalScene = wizardScene === '自定义' ? (customSceneInput.trim() || "神秘场景") : wizardScene;

      const res = await onGenerateStoryText({
        theme: finalTheme,
        educationalGoal: finalGoal,
        scene: finalScene,
        mainCharacter: {
          name: wizardCharacters[0]?.name || "淘淘",
          role: wizardCharacters[0]?.isCustomDescription ? "自定义角色" : (wizardCharacters[0]?.role || "小主角"),
          personality: wizardCharacters[0]?.isCustomDescription ? "独特个性" : (wizardCharacters[0]?.personality || "活泼可爱")
        },
        mainCharacters: wizardCharacters, // Pass full multi characters list
        duration: wizardDuration === 'long' ? `long_${longCustomMinutes}m` : wizardDuration,
        age: childAge,
        isRetry: retryCount > 0,
        retryCount: retryCount
      });

      if (res.success) {
        setGeneratedTextStory(res.story);
        setPage("text_preview");
        refreshDb();
      } else if (res.safetyBlocked) {
        setSafetyBlockedData({
          message: res.message,
          word: res.word,
          categoryName: res.categoryName
        });
        setPage("wizard");
        refreshDb();
      } else if (res.safetyRewriteSuggestion) {
        setSafetyRewriteData({
          message: res.message,
          word: res.word,
          categoryName: res.categoryName,
          originalInput: res.originalInput,
          suggestedReplacement: res.suggestedReplacement
        });
        setPage("wizard");
        refreshDb();
      } else {
        triggerToast(res.error || "❌ 生成文本失败，请稍后重试");
        setPage("tab_home");
      }
    } catch (err: any) {
      triggerToast(err.message || "故事灵感塞车了，请重试！");
      setPage("tab_home");
    }
  };

  // Secondary retry handle
  const handleRegenerateTextStory = async () => {
    const newCount = retryCount + 1;
    setRetryCount(newCount);
    
    // Check if free retry already used
    if (newCount > 1 && db?.rights?.storyGenerationsRemaining <= 0 && !db?.rights?.isVip) {
      triggerToast("⚠️ 故事余额不足，重新生成需要消耗1次额度！");
      return;
    }

    await handleGenerateStoryTextFlow();
  };

  // Story sound synthesizer flow
  const handleSynthesizeStoryAudio = async () => {
    setPage("audio_wait");
    try {
      const selectedVoiceId = wizardVoiceId || db?.voiceClones?.[0]?.id || "voice_default_mom";
      const childAge = db?.profile?.age || 4;

      const finalTheme = wizardTheme === '自定义' ? (customThemeInput.trim() || "奇妙故事") : wizardTheme;
      const finalGoal = (wizardTheme === '自定义' || wizardGoal === '自定义') ? (customGoalInput.trim() || "健康快乐成长") : wizardGoal;
      const finalScene = wizardScene === '自定义' ? (customSceneInput.trim() || "神秘场景") : wizardScene;

      const charNameList = wizardCharacters.map(c => c.name || "宝贝").filter(Boolean).join("和");

      const res = await onGenerateStoryAudio({
        story: generatedTextStory,
        voiceId: selectedVoiceId,
        voiceMode: wizardVoiceMode,
        theme: finalTheme,
        educationalGoal: finalGoal,
        scene: finalScene,
        mainCharacterName: charNameList || "宝贝",
        duration: wizardDuration === 'long' ? `long_${longCustomMinutes}m` : wizardDuration,
        targetAge: childAge,
        bgmType: wizardBgmType
      });

      if (res.success) {
        setActiveStory(res.savedStory);
        setCurrentChapterIndex(0);
        setPlayerProgress(0);
        setIsPlaying(true);
        setPage("player");
        setRetryCount(0); // Reset
        refreshDb();
        triggerToast("🎵 有声绘本生成完毕，开始温馨播放！");
      }
    } catch (e) {
      triggerToast("有声合成出错");
      setPage("text_preview");
    }
  };

  // Toggle favorite / diary
  const handleToggleFav = async (id: string) => {
    try {
      const res = await onSaveStoryToggle(id, 'favorite');
      if (res.success) {
        refreshDb();
        triggerToast(res.story.isFavorite ? "❤️ 已加入收藏夹" : "💔 已取消收藏");
      }
    } catch (e) {
      triggerToast("收藏失败");
    }
  };

  const handleToggleDiary = async (id: string) => {
    try {
      const res = await onSaveStoryToggle(id, 'diary');
      if (res.success) {
        refreshDb();
        triggerToast(res.story.isSavedToDiary ? "📖 已保存到故事日记" : "🗑️ 已移出故事日记");
      }
    } catch (e) {
      triggerToast("操作失败");
    }
  };

  // Rename Story
  const handleRenameSubmit = async (id: string) => {
    if (!storyRenameTitle.trim()) return;
    try {
      const res = await onRenameStory(id, storyRenameTitle);
      if (res.success) {
        setStoryRenameId(null);
        refreshDb();
        triggerToast("✏️ 故事名称修改成功！");
      }
    } catch (e) {
      triggerToast("修改失败");
    }
  };

  // Delete Story
  const handleDeleteStoryFlow = async (id: string) => {
    if (confirm("确定要彻底删除该故事吗？此操作无法恢复哦。")) {
      try {
        await onDeleteStory(id);
        refreshDb();
        triggerToast("🗑️ 故事删除成功");
      } catch (e) {
        triggerToast("删除出错");
      }
    }
  };

  // Redeem code card
  const handleRedeemCode = async () => {
    if (!cdkeyCode.trim()) {
      triggerToast("请输入卡密兑换码！");
      return;
    }
    try {
      const res = await onRedeemCDKey(cdkeyCode);
      if (res.success) {
        triggerToast("🎉 卡密兑换成功！");
        setCdkeyCode("");
        refreshDb();
      }
    } catch (err: any) {
      triggerToast(err.error || err.message || "兑换码无效或已过期");
    }
  };

  // Bind referral invite
  const handleBindReferralCode = async () => {
    if (!referralCode.trim()) {
      triggerToast("请输入推荐人邀请码！");
      return;
    }
    try {
      const res = await onBindReferral(referralCode);
      if (res.success) {
        triggerToast("🤝 绑定成功！获赠2次创作额度！");
        setReferralCode("");
        refreshDb();
      }
    } catch (err: any) {
      triggerToast(err.error || err.message || "绑定失败");
    }
  };

  // Read notifications
  const handleOpenNotifications = async () => {
    setShowNotifications(true);
    try {
      await onReadAllNotifications();
      refreshDb();
    } catch (e) {}
  };

  // Play a story immediately from Diary list
  const handlePlayStoryFromDiary = (story: UserStory) => {
    setActiveStory(story);
    setCurrentChapterIndex(0);
    setPlayerProgress(0);
    setIsPlaying(true);
    setPage("player");
    // increment play stats on backend
    fetch("/api/stats/play", { method: "POST" }).then(() => refreshDb()).catch(() => {});
  };

  // Filtered stories in diary
  const filteredStories = db?.userStories?.filter((s: UserStory) => {
    const matchesSearch = s.title.toLowerCase().includes(diarySearch.toLowerCase()) || 
                          s.abstract.toLowerCase().includes(diarySearch.toLowerCase());
    
    if (diaryFilter === "all") return matchesSearch && s.isSavedToDiary;
    if (diaryFilter === "favorite") return matchesSearch && s.isFavorite;
    if (diaryFilter === "bedtime") return matchesSearch && s.theme === "睡前安抚" && s.isSavedToDiary;
    if (diaryFilter === "courage") return matchesSearch && s.theme === "勇敢与自信" && s.isSavedToDiary;
    return matchesSearch;
  }) || [];

  // Dynamic Theme, Goals, and Scenes options from database config with local fallbacks
  const THEME_OPTIONS = db?.config?.themes || ["睡前安抚", "勇敢与自信", "习惯养成", "分享与友爱", "想象力开发"];
  const EDUCATIONAL_GOAL_OPTIONS: Record<string, string[]> = db?.config?.educationalGoals || {
    "睡前安抚": ["克服怕黑恐惧", "独立安静入睡", "养成睡前卫生习惯", "自我情绪安抚"],
    "勇敢与自信": ["拥抱独特自我", "勇于尝试新事物", "敢于承认错误", "克服登台恐惧"],
    "习惯养成": ["玩具物归原位", "主动刷牙洗脸", "拒绝拖拉磨蹭", "讲卫生懂礼貌"],
    "分享与友爱": ["体会分享的加倍快乐", "乐于帮助同伴", "学会道歉与原谅", "不自私懂体贴"],
    "想象力开发": ["探索浩瀚宇宙", "认识森林奇迹", "神奇物种探险", "发明魔法小屋"]
  };
  const SCENE_OPTIONS = db?.config?.scenes || ["静谧森林", "彩虹山谷", "温馨卧室", "孩子的幼儿园", "蓝色海洋深处", "浩瀚太空港", "神奇魔法城堡"];

  const handleSaveConfig = async (nextThemes: string[], nextGoals: Record<string, string[]>, nextScenes: string[]) => {
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themes: nextThemes,
          educationalGoals: nextGoals,
          scenes: nextScenes
        })
      });
      if (res.ok) {
        refreshDb();
        triggerToast("✓ 配置已同步到后台");
      } else {
        triggerToast("⚠️ 保存配置失败");
      }
    } catch (e) {
      triggerToast("⚠️ 网络连接错误");
    }
  };

  const handleAddTheme = () => {
    const trimmed = newThemeName.trim();
    if (!trimmed) {
      triggerToast("⚠️ 主题名称不能为空");
      return;
    }
    if (THEME_OPTIONS.includes(trimmed)) {
      triggerToast("⚠️ 该主题已存在");
      return;
    }
    const updatedThemes = [...THEME_OPTIONS, trimmed];
    const updatedGoals = { ...EDUCATIONAL_GOAL_OPTIONS, [trimmed]: [] };
    setNewThemeName("");
    handleSaveConfig(updatedThemes, updatedGoals, SCENE_OPTIONS);
  };

  const handleDeleteTheme = (themeToDelete: string) => {
    if (confirm(`确定要删除主题“${themeToDelete}”吗？这将同时删除其下的教育目标！`)) {
      const updatedThemes = THEME_OPTIONS.filter(t => t !== themeToDelete);
      const updatedGoals = { ...EDUCATIONAL_GOAL_OPTIONS };
      delete updatedGoals[themeToDelete];
      if (selectedThemeForGoals === themeToDelete) {
        setSelectedThemeForGoals("");
      }
      handleSaveConfig(updatedThemes, updatedGoals, SCENE_OPTIONS);
    }
  };

  const handleStartEditTheme = (index: number, val: string) => {
    setEditingThemeIndex(index);
    setEditingThemeValue(val);
  };

  const handleSaveEditTheme = (oldVal: string) => {
    const trimmed = editingThemeValue.trim();
    if (!trimmed) {
      triggerToast("⚠️ 主题名称不能为空");
      return;
    }
    if (THEME_OPTIONS.includes(trimmed) && trimmed !== oldVal) {
      triggerToast("⚠️ 该主题已存在");
      return;
    }
    const updatedThemes = [...THEME_OPTIONS];
    const index = THEME_OPTIONS.indexOf(oldVal);
    if (index !== -1) {
      updatedThemes[index] = trimmed;
    }
    const updatedGoals = { ...EDUCATIONAL_GOAL_OPTIONS };
    updatedGoals[trimmed] = updatedGoals[oldVal] || [];
    if (trimmed !== oldVal) {
      delete updatedGoals[oldVal];
    }
    if (selectedThemeForGoals === oldVal) {
      setSelectedThemeForGoals(trimmed);
    }
    setEditingThemeIndex(null);
    handleSaveConfig(updatedThemes, updatedGoals, SCENE_OPTIONS);
  };

  const handleAddGoal = (theme: string) => {
    const trimmed = newGoalName.trim();
    if (!trimmed) {
      triggerToast("⚠️ 教育目标名称不能为空");
      return;
    }
    const currentGoals = EDUCATIONAL_GOAL_OPTIONS[theme] || [];
    if (currentGoals.includes(trimmed)) {
      triggerToast("⚠️ 该目标已存在");
      return;
    }
    const updatedGoals = {
      ...EDUCATIONAL_GOAL_OPTIONS,
      [theme]: [...currentGoals, trimmed]
    };
    setNewGoalName("");
    handleSaveConfig(THEME_OPTIONS, updatedGoals, SCENE_OPTIONS);
  };

  const handleDeleteGoal = (theme: string, goalToDelete: string) => {
    const currentGoals = EDUCATIONAL_GOAL_OPTIONS[theme] || [];
    const updatedGoals = {
      ...EDUCATIONAL_GOAL_OPTIONS,
      [theme]: currentGoals.filter(g => g !== goalToDelete)
    };
    handleSaveConfig(THEME_OPTIONS, updatedGoals, SCENE_OPTIONS);
  };

  const handleStartEditGoal = (index: number, val: string) => {
    setEditingGoalIndex(index);
    setEditingGoalValue(val);
  };

  const handleSaveEditGoal = (theme: string, oldVal: string) => {
    const trimmed = editingGoalValue.trim();
    if (!trimmed) {
      triggerToast("⚠️ 目标名称不能为空");
      return;
    }
    const currentGoals = EDUCATIONAL_GOAL_OPTIONS[theme] || [];
    if (currentGoals.includes(trimmed) && trimmed !== oldVal) {
      triggerToast("⚠️ 该目标已存在");
      return;
    }
    const updatedGoalsList = [...currentGoals];
    const index = currentGoals.indexOf(oldVal);
    if (index !== -1) {
      updatedGoalsList[index] = trimmed;
    }
    const updatedGoals = {
      ...EDUCATIONAL_GOAL_OPTIONS,
      [theme]: updatedGoalsList
    };
    setEditingGoalIndex(null);
    handleSaveConfig(THEME_OPTIONS, updatedGoals, SCENE_OPTIONS);
  };

  const handleAddScene = () => {
    const trimmed = newSceneName.trim();
    if (!trimmed) {
      triggerToast("⚠️ 场景名称不能为空");
      return;
    }
    if (SCENE_OPTIONS.includes(trimmed)) {
      triggerToast("⚠️ 该场景已存在");
      return;
    }
    const updatedScenes = [...SCENE_OPTIONS, trimmed];
    setNewSceneName("");
    handleSaveConfig(THEME_OPTIONS, EDUCATIONAL_GOAL_OPTIONS, updatedScenes);
  };

  const handleDeleteScene = (sceneToDelete: string) => {
    if (confirm(`确定要删除场景“${sceneToDelete}”吗？`)) {
      const updatedScenes = SCENE_OPTIONS.filter(s => s !== sceneToDelete);
      handleSaveConfig(THEME_OPTIONS, EDUCATIONAL_GOAL_OPTIONS, updatedScenes);
    }
  };

  const handleStartEditScene = (index: number, val: string) => {
    setEditingSceneIndex(index);
    setEditingSceneValue(val);
  };

  const handleSaveEditScene = (oldVal: string) => {
    const trimmed = editingSceneValue.trim();
    if (!trimmed) {
      triggerToast("⚠️ 场景名称不能为空");
      return;
    }
    if (SCENE_OPTIONS.includes(trimmed) && trimmed !== oldVal) {
      triggerToast("⚠️ 该场景已存在");
      return;
    }
    const updatedScenes = [...SCENE_OPTIONS];
    const index = SCENE_OPTIONS.indexOf(oldVal);
    if (index !== -1) {
      updatedScenes[index] = trimmed;
    }
    setEditingSceneIndex(null);
    handleSaveConfig(THEME_OPTIONS, EDUCATIONAL_GOAL_OPTIONS, updatedScenes);
  };

  return (
    <div className="relative w-full flex justify-center items-center py-6">
      
      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 10 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 z-50 bg-zinc-950 text-white text-xs px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 border border-zinc-800 max-w-[280px]"
          >
            <Sparkles className="w-4 h-4 text-zinc-300 animate-spin" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Smartphone Shell Container */}
      <div className="relative w-[345px] h-[720px] bg-zinc-100 rounded-[48px] p-3 shadow-2xl border border-zinc-200/80">
        
        {/* Smartphone Inner Screen Bezel */}
        <div className="relative w-full h-full bg-zinc-50 rounded-[36px] overflow-hidden flex flex-col border border-zinc-200/80 shadow-inner">
          
          {/* iOS Top Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[22px] bg-zinc-950 rounded-b-[14px] z-50 flex justify-between px-4 items-center">
            {/* Camera */}
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-800/80 border border-zinc-700/30"></div>
            {/* Speaker line */}
            <div className="w-12 h-1 bg-zinc-800 rounded-full"></div>
          </div>

          {/* Mini Program Status Bar */}
          <div className="w-full h-11 bg-zinc-50 px-5 pt-4 flex justify-between items-center text-[10px] font-semibold text-zinc-500 z-40 select-none">
            <span>09:41</span>
            <div className="flex items-center gap-1.5">
              <span>5G</span>
              <Volume2 className="w-3 h-3 text-zinc-400" />
              <div className="w-5 h-2.5 border border-zinc-300 rounded-sm p-0.5 flex items-center">
                <div className="w-full h-full bg-zinc-800 rounded-2xs"></div>
              </div>
            </div>
          </div>

          {/* Mini Program Header Title Bar */}
          <div className="w-full h-12 bg-white border-b border-zinc-100 px-4 flex justify-between items-center z-40 shrink-0">
            <div className="flex items-center gap-1">
              {page !== "tab_home" && page !== "tab_studio" && page !== "tab_my" && page !== "welcome" && (
                <button 
                  onClick={() => {
                    if (page === "wizard" && wizardStep > 1) {
                      setWizardStep(prev => prev - 1);
                    } else if (page === "text_preview") {
                      setPage("wizard");
                      setWizardStep(4);
                    } else if (page === "player") {
                      setPage("diary");
                    } else if (page === "template_list") {
                      setPage("tab_home");
                    } else if (page === "config_maintenance") {
                      setPage("tab_my");
                    } else if (page === "profile_setup") {
                      if (db?.profile?.nickname) {
                        setPage("tab_my");
                      } else {
                        setPage("welcome");
                      }
                    } else {
                      setPage("tab_home");
                    }
                  }} 
                  className="p-1 text-zinc-700 hover:bg-zinc-100 rounded-full transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <span className="text-sm font-bold text-zinc-900 tracking-tight">
                {page === "welcome" && "微信登录 🔑"}
                {page === "tab_home" && "伴梦童话 📱"}
                {page === "tab_studio" && "声音录音室 🎙️"}
                {page === "tab_my" && "我的伴梦空间 🧸"}
                {page === "wizard" && `有声绘本定制 (步骤 ${wizardStep}/5)`}
                {page === "text_wait" && "AI 童话大作生成中..."}
                {page === "text_preview" && "AI 童话绘本预览 📖"}
                {page === "audio_wait" && "亲子有声转码合成中..."}
                {page === "player" && "星夜陪伴播放器 💤"}
                {page === "diary" && "宝宝故事日记 📁"}
                {page === "template_list" && "推荐绘本模板库 📚"}
                {page === "config_maintenance" && "故事配置库维护 ⚙️"}
              </span>
            </div>

            {/* WeChat Top Right Action Button Capsule */}
            <div className="flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200/80 transition px-2.5 py-1 rounded-full border border-zinc-200">
              <button onClick={handleOpenNotifications} className="relative p-0.5 text-zinc-700 hover:opacity-80">
                <Bell className="w-3.5 h-3.5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[7px] w-3 h-3 rounded-full flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
              <div className="w-[1px] h-3 bg-zinc-200"></div>
              <button onClick={() => setPage("tab_home")} className="p-0.5 text-zinc-700 hover:opacity-80">
                <Compass className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Mini Program View Content Area (Scrollable) */}
          <div className="flex-1 overflow-y-auto wechat-screen-scrollbar flex flex-col bg-zinc-50 relative">
            
            {/* --- WELCOME / LOGIN VIEW --- */}
            {page === "welcome" && (
              <div className="flex-1 flex flex-col justify-between p-6 text-center select-none bg-white relative">
                <div className="my-auto space-y-5">
                  <div className="w-16 h-16 bg-zinc-950 rounded-3xl mx-auto shadow-sm flex items-center justify-center text-white text-3xl font-bold tracking-tight">
                    梦
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-zinc-900">伴梦童话</h1>
                    <p className="text-xs text-zinc-500 mt-1">让爱与陪伴，留在每一个睡前故事里</p>
                  </div>
                  <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200/60 text-left text-xs text-zinc-600 space-y-2">
                    <p>✨ <b>AI个性化绘本</b>：为孩子定制专属教育主题与故事场景</p>
                    <p>🎙️ <b>亲子声音克隆</b>：仅录音30秒，即刻合成爸爸妈妈温暖的声音</p>
                    <p>💤 <b>星夜陪伴播放</b>：独家星空播放器，沉浸伴眠体验</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <button 
                    onClick={() => setShowWeChatAuth(true)} 
                    className="w-full bg-[#07C160] hover:bg-[#06ad56] active:scale-[0.99] text-white py-3 px-4 rounded-xl text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <span className="text-base">💬</span> 微信一键快速登录
                  </button>
                  <p className="text-[9px] text-zinc-400">登录即代表您已同意《伴梦用户协议》和《儿童信息保护政策》</p>
                </div>

                {/* --- WECHAT AUTHORIZATION POPUP MODAL --- */}
                {showWeChatAuth && (
                  <div className="absolute inset-0 bg-black/60 z-50 flex flex-col justify-end text-left">
                    {/* Backdrop closer */}
                    <div className="flex-1" onClick={() => setShowWeChatAuth(false)}></div>
                    
                    {/* WeChat Bottom Sheet */}
                    <div className="bg-white rounded-t-3xl p-5 space-y-4 shadow-xl border-t border-zinc-150">
                      <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-[#07C160] rounded-sm flex items-center justify-center text-white text-[10px] font-bold">微</div>
                          <span className="text-[11px] font-bold text-zinc-800">微信授权登录</span>
                        </div>
                        <button 
                          onClick={() => setShowWeChatAuth(false)}
                          className="text-zinc-400 hover:text-zinc-600 text-xs font-bold p-1"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <h4 className="text-xs font-extrabold text-zinc-900">伴梦童话 申请使用：</h4>
                          <p className="text-[10px] text-zinc-500">您的微信公开信息（昵称、头像）以用于个性化家长称呼及同步绘本记录</p>
                        </div>

                        {/* Nickname and Avatar selectors */}
                        <div className="bg-zinc-50 p-3.5 rounded-2xl border border-zinc-150 space-y-3">
                          {/* Avatar chooser */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-600 font-medium">选择微信头像</span>
                            <div className="flex gap-1.5">
                              {["🧸", "🦊", "🐰", "🐱", "🐥", "🌟"].map(avatar => (
                                <button
                                  key={avatar}
                                  type="button"
                                  onClick={() => setWechatAvatar(avatar)}
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all border ${
                                    wechatAvatar === avatar ? 'bg-zinc-900 border-zinc-950 scale-110 shadow-xs' : 'bg-white border-zinc-200 hover:bg-zinc-100'
                                  }`}
                                >
                                  {avatar}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Nickname input */}
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs text-zinc-600 font-medium shrink-0">自定义昵称</span>
                            <input
                              type="text"
                              value={wechatNickname}
                              onChange={e => setWechatNickname(e.target.value)}
                              placeholder="请输入微信昵称"
                              className="flex-1 bg-white border border-zinc-200 rounded-lg px-2.5 py-1 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 font-bold"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Accept / Reject Buttons */}
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowWeChatAuth(false);
                            triggerToast("❌ 已取消微信授权登录");
                          }}
                          className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 py-2.5 rounded-xl text-xs font-bold transition-all"
                        >
                          拒绝
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            // Success Login Action
                            localStorage.setItem("banmeng_is_logged_in", "true");
                            setIsLoggedIn(true);
                            setShowWeChatAuth(false);
                            
                            // Sync names to parent profile names if they are empty
                            const updatedForm = {
                              ...profileForm,
                              parentName: wechatNickname || "淘淘家长"
                            };
                            setProfileForm(updatedForm);
                            await onUpdateProfile(updatedForm);

                            // Determine routing
                            if (!db?.profile?.nickname) {
                              setPage("profile_setup");
                            } else {
                              setPage("tab_home");
                            }
                            triggerToast("🎉 微信登录成功");
                            refreshDb();
                          }}
                          className="bg-[#07C160] hover:bg-[#06ad56] text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs"
                        >
                          允许
                        </button>
                      </div>
                      <p className="text-[8px] text-center text-zinc-400">授权登录即代表您已同意《伴梦用户协议》</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --- CHILD PROFILE COMPILING --- */}
            {page === "profile_setup" && (
              <div className="p-5 space-y-4">
                <div className="bg-zinc-100 p-4 rounded-2xl border border-zinc-200/60 text-xs text-zinc-700 space-y-1 shadow-xs">
                  <span className="font-bold flex items-center gap-1 text-zinc-900"><Sparkles className="w-3.5 h-3.5 text-zinc-600 animate-pulse" /> 为什么要完善宝贝资料？</span>
                  <p className="text-zinc-500 leading-relaxed">我们将根据孩子的年龄、性别及兴趣偏好，优化生成故事的文字难度与价值引导，真正做到因材施教。</p>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-zinc-900 mb-1">宝贝小名 / 昵称</label>
                    <input 
                      type="text" 
                      placeholder="如：淘淘、沐沐"
                      value={profileForm.nickname}
                      onChange={e => setProfileForm({ ...profileForm, nickname: e.target.value })}
                      className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 text-zinc-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-900 mb-1">宝贝年龄</label>
                      <select 
                        value={profileForm.age} 
                        onChange={e => setProfileForm({ ...profileForm, age: parseInt(e.target.value) })}
                        className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900"
                      >
                        {[2,3,4,5,6,7,8,9].map(a => <option key={a} value={a}>{a} 岁</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-900 mb-1">宝贝性别</label>
                      <div className="flex bg-white rounded-xl border border-zinc-200 p-0.5">
                        <button 
                          onClick={() => setProfileForm({ ...profileForm, gender: "boy" })} 
                          className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${profileForm.gender === 'boy' ? 'bg-zinc-950 text-white shadow-xs' : 'text-zinc-500'}`}
                        >
                          小王子
                        </button>
                        <button 
                          onClick={() => setProfileForm({ ...profileForm, gender: "girl" })} 
                          className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${profileForm.gender === 'girl' ? 'bg-zinc-950 text-white shadow-xs' : 'text-zinc-500'}`}
                        >
                          小公主
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-900 mb-1">家长称呼</label>
                    <input 
                      type="text" 
                      placeholder="如：淘淘妈妈、糖糖爸爸"
                      value={profileForm.parentName}
                      onChange={e => setProfileForm({ ...profileForm, parentName: e.target.value })}
                      className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-900 mb-1">常用播放时间 (睡前)</label>
                    <input 
                      type="time" 
                      value={profileForm.bedTime}
                      onChange={e => setProfileForm({ ...profileForm, bedTime: e.target.value })}
                      className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-900 mb-1">宝贝兴趣偏好 (多选)</label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {["森林动物", "宇宙探险", "积木组装", "魔法城堡", "深海奥秘", "机械交通", "恐龙王国"].map(interest => {
                        const isSel = profileForm.interests.includes(interest);
                        return (
                          <button
                            key={interest}
                            onClick={() => {
                              const next = isSel 
                                ? profileForm.interests.filter(i => i !== interest)
                                : [...profileForm.interests, interest];
                              setProfileForm({ ...profileForm, interests: next });
                            }}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-medium border transition ${isSel ? 'bg-zinc-100 border-zinc-900 text-zinc-950 font-bold' : 'bg-white border-zinc-200 text-zinc-500'}`}
                          >
                            {interest}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={handleSaveProfile} 
                    className="w-full bg-zinc-950 hover:bg-zinc-900 text-white py-2.5 rounded-xl text-xs font-bold shadow-sm transition"
                  >
                    完善信息，开启伴梦之旅
                  </button>
                </div>
              </div>
            )}

            {/* --- HOME PAGE VIEW --- */}
            {page === "tab_home" && (
              <div className="p-4 space-y-4 flex-1">
                
                {/* Welcome Card */}
                <div className="relative overflow-hidden rounded-3xl p-4 text-white shadow-md bg-[url('https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=600&q=80')] bg-cover bg-center">
                  {/* Cozy dark overlay to make text pop with dreamy glow */}
                  <div className="absolute inset-0 bg-zinc-950/50 backdrop-blur-[0.5px]"></div>
                  
                  {/* Content wrapper */}
                  <div className="relative z-10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center text-xs shadow-sm">
                        🧸
                      </div>
                      <div>
                        <h4 className="text-xs text-zinc-200 font-medium">
                          下午好，{db?.profile?.parentName || "淘淘妈妈"}
                        </h4>
                        <h3 className="text-sm font-extrabold tracking-tight text-white drop-shadow-xs">
                          为孩子定制专属的声画有声绘本吧
                        </h3>
                      </div>
                    </div>
                    
                    {/* Quota display */}
                    <div className="mt-4 pt-3 border-t border-white/15 flex justify-between items-center text-[11px]">
                      <div className="flex gap-4">
                        <div>
                          <span className="text-zinc-200">故事额度：</span>
                          <span className="font-extrabold text-white">{db?.rights?.isVip ? "无限" : `${db?.rights?.storyGenerationsRemaining || 0} 次`}</span>
                        </div>
                        <div>
                          <span className="text-zinc-200">克隆次数：</span>
                          <span className="font-extrabold text-white">{db?.rights?.freeVoiceClonesRemaining || 0} 次</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => setPage("tab_my")}
                        className="bg-white/90 hover:bg-white text-zinc-950 px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all hover:scale-[1.02] active:scale-95 shadow-sm"
                      >
                        充值/兑换
                      </button>
                    </div>
                  </div>
                </div>

                {/* Main Story Customization Big Button */}
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleStartCustomWizard}
                    className="bg-white hover:bg-zinc-50 p-4 rounded-3xl border border-zinc-200/80 shadow-xs text-left flex flex-col justify-between h-28 relative group transition overflow-hidden"
                  >
                    <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-900">
                      <Sparkles className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-zinc-900">AI 自由定制</h3>
                      <p className="text-[9px] text-zinc-400 mt-1">自主编辑主角、场景与教育目标</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setPage("diary")}
                    className="bg-white hover:bg-zinc-50 p-4 rounded-3xl border border-zinc-200/80 shadow-xs text-left flex flex-col justify-between h-28 relative group transition overflow-hidden"
                  >
                    <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-900">
                      <BookOpen className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-zinc-900">故事日记本</h3>
                      <p className="text-[9px] text-zinc-400 mt-1">查看所有保存的童话绘本</p>
                    </div>
                  </button>
                </div>

                {/* Continue Playing Banner */}
                {db?.userStories?.length > 0 && (
                  <div className="bg-zinc-100 p-3 rounded-2xl border border-zinc-200/50 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 shadow-3xs border border-zinc-200/45">
                        <VectorIllustration 
                          theme={db.userStories[0].theme} 
                          title={db.userStories[0].title} 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div className="overflow-hidden">
                        <span className="text-[10px] text-zinc-500 font-bold block">最近播放 🔊</span>
                        <span className="text-xs font-bold text-zinc-900 truncate block">{db.userStories[0].title}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handlePlayStoryFromDiary(db.userStories[0])}
                      className="w-8 h-8 bg-zinc-950 hover:bg-zinc-900 rounded-full flex items-center justify-center text-white shrink-0 transition-colors"
                    >
                      <Play className="w-4 h-4 fill-current ml-0.5 text-white" />
                    </button>
                  </div>
                )}

                {/* Popular Templates Zone */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-zinc-900 flex items-center gap-1">✨ 伴梦推荐绘本模板</span>
                    <button 
                      onClick={() => setPage("template_list")}
                      className="text-[10px] text-zinc-900 font-bold hover:underline flex items-center gap-0.5"
                    >
                      查看全部 <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  
                  <div className="space-y-2.5">
                    {db?.templates?.slice(0, 4).map((tpl: StoryTemplate) => (
                      <div 
                        key={tpl.id} 
                        className="bg-white p-3 rounded-2xl border border-zinc-200/60 flex gap-3 hover:shadow-xs transition"
                      >
                        <div className="w-16 h-20 rounded-lg overflow-hidden bg-zinc-50 flex-shrink-0 shadow-3xs border border-zinc-100">
                          <VectorIllustration 
                            theme={tpl.theme} 
                            title={tpl.name} 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-zinc-900 leading-snug">{tpl.name}</span>
                              <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-800 text-[8px] font-bold rounded-md">{tpl.ageGroup}</span>
                            </div>
                            <p className="text-[9px] text-zinc-500 line-clamp-2 mt-1 leading-normal">{tpl.description}</p>
                          </div>
                          
                          <div className="flex justify-between items-center pt-1.5">
                            <span className="text-[8px] text-zinc-400">🔥 {tpl.useCount} 位宝贝已听</span>
                            <button 
                              onClick={() => handleApplyTemplate(tpl)}
                              className="bg-zinc-950 hover:bg-zinc-900 text-white text-[9px] px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-0.5"
                            >
                              套用模板 <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Invitation rewards promotion */}
                <div 
                  onClick={() => setPage("tab_my")}
                  className="bg-zinc-100 hover:bg-zinc-200/50 p-3.5 rounded-2xl border border-zinc-200 flex justify-between items-center cursor-pointer transition"
                >
                  <div className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-zinc-900" />
                    <div>
                      <span className="text-xs font-bold text-zinc-900 block">分享邀请有礼 🧸</span>
                      <span className="text-[9px] text-zinc-400 block">新老用户双方均可得 2 次故事生成福利</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-900" />
                </div>

              </div>
            )}

            {/* --- STUDIO VIEW (VOICE MANAGEMENT) --- */}
            {page === "tab_studio" && (
              <div className="p-4 space-y-4 flex-1">
                <div className="bg-zinc-100 p-4 rounded-2xl border border-zinc-200/60 space-y-2">
                  <span className="text-xs font-bold text-zinc-900 flex items-center gap-1">🎙️ 声音克隆系统说明</span>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    伴梦有声克隆基于业内顶尖的深度合成模型，仅需录制一段约<b>30秒</b>的故事散句，即可完美还原家庭成员独一无二的音色、情感和讲故事的节奏，给孩子最本真的睡前陪伴。
                  </p>
                  <span className="text-[9px] text-zinc-600 font-semibold block">⚠️ 提示：克隆非本人声音前，请确保已获得本人的确认授权。</span>
                </div>

                {/* Recorder Mock Interface */}
                <div className="bg-white p-4 rounded-3xl border border-zinc-200/80 shadow-xs space-y-4">
                  <span className="text-xs font-bold text-zinc-900 block">创建新的家庭声音 🎧</span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-1">说话人性别/身份</label>
                      <select 
                        value={recordSpeaker} 
                        onChange={e => setRecordSpeaker(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                      >
                        <option value="mother">妈妈</option>
                        <option value="father">爸爸</option>
                        <option value="grandmother">奶奶/外婆</option>
                        <option value="grandfather">爷爷/外公</option>
                        <option value="custom">其他声音</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-1">给声音起个名字</label>
                      <input 
                        type="text" 
                        placeholder="如：妈妈的温柔讲故事声音"
                        value={recordedVoiceName}
                        onChange={e => setRecordedVoiceName(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                      />
                    </div>
                  </div>

                  {/* Text card prompt to read */}
                  <div className="bg-zinc-50 p-3 rounded-xl border border-dashed border-zinc-200 space-y-1">
                    <span className="text-[9px] text-zinc-400 block font-bold">请对准话筒朗读以下示范文本（维持30秒）：</span>
                    <p className="text-xs text-zinc-900 leading-relaxed font-medium">
                      『从前有一片静谧的森林，树梢上挂着弯弯的小月亮。小刺猬轻轻钻出被子，看着草叶上的小水珠，心里想：原来，黑夜里也有这么温柔可爱的梦境呀...』
                    </p>
                  </div>

                  {/* Active Recording State */}
                  {isRecording ? (
                    <div className="flex flex-col items-center py-2 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                        <span className="text-xs font-bold text-red-600">录音中：{recordSec} 秒</span>
                      </div>
                      
                      {/* Wave Animation */}
                      <div className="flex items-end gap-1 h-6 pt-1">
                        {[1,2,3,4,3,2,4,5,3,4,1,3,4,5,2,3].map((h, i) => (
                          <div 
                            key={i} 
                            style={{ height: `${h * 4}px` }} 
                            className="w-[3px] bg-red-500 rounded-full animate-bounce"
                          ></div>
                        ))}
                      </div>

                      <button 
                        onClick={stopRecording}
                        className="bg-zinc-950 hover:bg-zinc-900 text-white font-bold text-xs px-4 py-1.5 rounded-full transition"
                      >
                        完成并停止
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <button 
                        onClick={startRecording}
                        className="bg-zinc-950 hover:bg-zinc-900 text-white font-bold text-xs px-5 py-2.5 rounded-full transition flex items-center gap-1.5 shadow-sm"
                      >
                        <Mic className="w-4 h-4" />
                        开始录音克隆 (免费)
                      </button>
                    </div>
                  )}

                  {/* Confirm generate block when stop recording */}
                  {!isRecording && recordSec > 0 && (
                    <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 text-center space-y-2.5">
                      <p className="text-xs text-zinc-900 font-bold">🎙️ 录制成功：已录制 {recordSec} 秒散句！</p>
                      <div className="flex gap-2 justify-center">
                        <button 
                          onClick={() => { setRecordSec(0); setRecordedVoiceName(""); }}
                          className="bg-white border border-zinc-200 text-zinc-700 text-xs px-3 py-1.5 rounded-lg font-bold"
                        >
                          重录
                        </button>
                        <button 
                          onClick={handleCreateVoice}
                          className="bg-zinc-950 hover:bg-zinc-900 text-white text-xs px-4 py-1.5 rounded-lg font-bold shadow-sm"
                        >
                          确认克隆声音
                        </button>
                      </div>
                    </div>
                  )}

                </div>

                {/* Saved voices list */}
                <div>
                  <span className="text-xs font-bold text-zinc-900 block mb-2 font-bold">已保存的家庭声音 ({db?.voiceClones?.length || 0})</span>
                  
                  <div className="space-y-2">
                    {db?.voiceClones?.map((v: VoiceClone) => (
                      <div key={v.id} className="bg-white p-3 rounded-2xl border border-zinc-200/60 flex items-center justify-between shadow-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-800">
                            <Volume2 className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-zinc-900 block">{v.name}</span>
                            <div className="flex items-center gap-2 mt-0.5 text-[9px] text-zinc-400">
                              <span>角色：{v.speakerType === 'mother' ? '妈妈' : v.speakerType === 'father' ? '爸爸' : '其他'}</span>
                              <span>•</span>
                              <span>已用于故事：{v.usageCount} 次</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={async () => {
                              if (confirm("确定要删除克隆的声音吗？")) {
                                await onDeleteVoice(v.id);
                                refreshDb();
                                triggerToast("🗑️ 声音已删除");
                              }
                            }}
                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-stone-50 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* --- MY PROFILE VIEW --- */}
            {page === "tab_my" && (
              <div className="p-4 space-y-4 flex-1">
                
                {/* User Rights summary */}
                <div className="bg-white p-4 rounded-3xl border border-zinc-200/80 shadow-xs space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-zinc-950 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-sm">
                      {db?.profile?.nickname?.charAt(0) || "淘"}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-zinc-900 block">{db?.profile?.parentName || "淘淘家长"}</span>
                      <div className="flex items-center gap-1 text-[9px] text-zinc-400 mt-0.5">
                        <span>绑定宝宝：{db?.profile?.nickname || "无"}</span>
                        <span>•</span>
                        <span>{db?.profile?.age || "无"} 岁</span>
                      </div>
                    </div>
                  </div>

                  {/* Quotas panel */}
                  <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-zinc-100">
                    <div className="bg-zinc-50 p-2.5 rounded-2xl border border-zinc-200/60 text-center">
                      <span className="text-[10px] text-zinc-400 block">绘本生成额度</span>
                      <span className="text-base font-bold text-zinc-900 block mt-0.5">
                        {db?.rights?.isVip ? "无限次 (VIP)" : `${db?.rights?.storyGenerationsRemaining || 0} 次`}
                      </span>
                    </div>

                    <div className="bg-zinc-50 p-2.5 rounded-2xl border border-zinc-200/60 text-center">
                      <span className="text-[10px] text-zinc-400 block">声音克隆余额</span>
                      <span className="text-base font-bold text-zinc-900 block mt-0.5">
                        {db?.rights?.freeVoiceClonesRemaining || 0} 次
                      </span>
                    </div>
                  </div>

                  {db?.rights?.isVip && (
                    <div className="bg-zinc-900 p-2.5 rounded-xl border border-zinc-800 flex items-center gap-2 text-xs text-white">
                      <Award className="w-4 h-4 text-zinc-300 shrink-0 animate-pulse" />
                      <span>VIP尊享会员有效至：{new Date(db?.rights?.vipExpiry || "").toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {/* Redeem Voucher Card */}
                <div className="bg-white p-4 rounded-3xl border border-zinc-200/80 shadow-xs space-y-3">
                  <span className="text-xs font-bold text-zinc-900 flex items-center gap-1">🔑 兑换卡密激活码</span>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">
                    在小红书、微信等官方社群获得的纸质或电子版次数券、月卡礼包卡密，请在下方输入激活兑换：
                  </p>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="请输入8位卡密, 如 STORY88"
                      value={cdkeyCode}
                      onChange={e => setCdkeyCode(e.target.value)}
                      className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 text-zinc-900 font-mono uppercase"
                    />
                    <button 
                      onClick={handleRedeemCode}
                      className="bg-zinc-950 hover:bg-zinc-900 text-white text-xs px-4 py-2 rounded-xl font-bold shrink-0 shadow-sm transition-colors"
                    >
                      兑换
                    </button>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap pt-1 text-[9px] text-zinc-400">
                    <span>提示码：<b>STORY88</b> (10次卡), <b>VIPMONTH</b> (30天VIP)</span>
                  </div>
                </div>

                {/* Referral campaign binding */}
                <div className="bg-white p-4 rounded-3xl border border-zinc-200/80 shadow-xs space-y-3">
                  <span className="text-xs font-bold text-zinc-900 flex items-center gap-1">🎁 绑定好友邀请码</span>
                  <p className="text-[10px] text-zinc-400">
                    输入好友的专属推荐邀请码。绑定后双方均可获赠 <b>2 次</b> 故事生成额度！
                  </p>

                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="请输入邀请码，如 BMTH-8888"
                      value={referralCode}
                      onChange={e => setReferralCode(e.target.value)}
                      className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 text-zinc-900"
                      disabled={!!db?.rights?.usedInviteCode}
                    />
                    <button 
                      onClick={handleBindReferralCode}
                      className="bg-zinc-950 hover:bg-zinc-900 text-white text-xs px-4 py-2 rounded-xl font-bold shrink-0 shadow-sm transition-colors"
                      disabled={!!db?.rights?.usedInviteCode}
                    >
                      {db?.rights?.usedInviteCode ? "已绑定" : "绑定"}
                    </button>
                  </div>

                  {db?.rights?.usedInviteCode && (
                    <span className="text-[10px] text-zinc-600 font-semibold block">✓ 已绑定推荐人：{db.rights.usedInviteCode}</span>
                  )}

                  {/* My own referral code to share */}
                  <div className="bg-zinc-50 p-3 rounded-2xl border border-zinc-200/60 flex justify-between items-center mt-2">
                    <div>
                      <span className="text-[9px] text-zinc-400 block font-bold">我的专属邀请码（长按复制）：</span>
                      <span className="text-sm font-extrabold text-zinc-900 tracking-wider font-mono">{db?.rights?.inviteCode || "BMTH-XXXX"}</span>
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(db?.rights?.inviteCode || "");
                        triggerToast("📋 专属邀请码已复制，快发给好友吧！");
                      }}
                      className="bg-white border border-zinc-200 text-zinc-900 hover:bg-zinc-50 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
                    >
                      复制
                    </button>
                  </div>
                </div>

                {/* Edit profile link and details */}
                <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-xs overflow-hidden text-xs">
                  <button 
                    onClick={() => setPage("profile_setup")}
                    className="w-full text-left p-3.5 hover:bg-zinc-50 border-b border-zinc-100 flex justify-between items-center text-zinc-900 transition-colors"
                  >
                    <span>修改宝宝成长资料 🧸</span>
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  </button>
                  <button 
                    onClick={() => {
                      alert("伴梦童话微信小程序原型 MVP 版 v1.1.0\n结合 Gemini API 与声音克隆的个性化有声绘本陪伴应用。");
                    }}
                    className="w-full text-left p-3.5 hover:bg-zinc-50 border-b border-zinc-100 flex justify-between items-center text-zinc-900 transition-colors"
                  >
                    <span>关于伴梦童话 ℹ️</span>
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm("确定要安全退出当前微信登录吗？")) {
                        localStorage.setItem("banmeng_is_logged_in", "false");
                        setIsLoggedIn(false);
                        setPage("welcome");
                        triggerToast("🚪 已安全退出登录");
                      }
                    }}
                    className="w-full text-left p-3.5 hover:bg-red-50 text-red-600 flex justify-between items-center transition-colors"
                  >
                    <span className="font-semibold">退出微信登录 🚪</span>
                    <ChevronRight className="w-4 h-4 text-red-400" />
                  </button>
                </div>

              </div>
            )}
            {page === "wizard" && (
              <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
                
                {/* Steps Headers */}
                <div className="flex justify-between items-center px-4 shrink-0">
                  {[1,2,3,4,5].map(step => (
                    <div key={step} className="flex items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${wizardStep === step ? 'bg-zinc-950 text-white shadow-sm font-bold' : 'bg-zinc-100 text-zinc-400'}`}>
                        {step}
                      </div>
                      {step < 5 && <div className={`w-6 h-0.5 ${wizardStep > step ? 'bg-zinc-950' : 'bg-zinc-100'}`}></div>}
                    </div>
                  ))}
                </div>

                <div className="flex-1 py-4 flex flex-col justify-start">
                  
                  {/* STEP 1: Mode choice */}
                  {wizardStep === 1 && (
                    <div className="space-y-4">
                      <span className="text-sm font-bold text-zinc-900 block text-center mb-1">请选择定制创作方式</span>
                      
                      <button 
                        onClick={() => setWizardStep(2)}
                        className="w-full bg-white hover:bg-zinc-50 p-4 rounded-3xl border border-zinc-200/80 text-left space-y-1.5 transition block shadow-xs"
                      >
                        <span className="text-xs font-bold text-zinc-900 block">✍️ 自定义新创作</span>
                        <p className="text-[10px] text-zinc-500 leading-normal">
                          完全自由选择或手动输入故事主题、教养痛点、故事场景及主角设定，由 AI 极速为你编写专属绘本。
                        </p>
                      </button>

                      <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200/60 text-[11px] text-zinc-600 leading-relaxed">
                        <span className="font-bold text-zinc-900 block mb-1">💡 什么是套用模板？</span>
                        您也可以直接回到首页选择“套用模板”，直接套用推荐的故事，再通过简单的微调和克隆音色直接一键生成有声故事。
                      </div>
                    </div>
                  )}

                  {/* STEP 2: Theme and Goal selection */}
                  {wizardStep === 2 && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-900 mb-1.5">1. 选择故事主题 🪐</label>
                        <div className="flex flex-wrap gap-2">
                          {THEME_OPTIONS.map(opt => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                setWizardTheme(opt);
                                // Default first goal
                                setWizardGoal(EDUCATIONAL_GOAL_OPTIONS[opt]?.[0] || "");
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${wizardTheme === opt ? 'bg-zinc-950 border-zinc-950 text-white font-bold shadow-xs' : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                            >
                              {opt}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setWizardTheme("自定义");
                              setWizardGoal("自定义");
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${wizardTheme === '自定义' ? 'bg-zinc-950 border-zinc-950 text-white font-bold shadow-xs' : 'bg-orange-50/60 border-orange-200 text-orange-600 hover:bg-orange-100/50'}`}
                          >
                            ✏️ 自定义主题
                          </button>
                        </div>
                      </div>

                      {wizardTheme === "自定义" && (
                        <div className="p-3 bg-orange-50/40 rounded-2xl border border-orange-100 space-y-2.5">
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-700 mb-1">输入自定义主题：</label>
                            <input 
                              type="text"
                              placeholder="例如：财商教育、克服挑食、安全防范"
                              value={customThemeInput}
                              onChange={e => setCustomThemeInput(e.target.value)}
                              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-700 mb-1">输入自定义故事教育目标：</label>
                            <input 
                              type="text"
                              placeholder="例如：不乱花钱、按时吃饭不偏食、不跟陌生人走"
                              value={customGoalInput}
                              onChange={e => setCustomGoalInput(e.target.value)}
                              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                            />
                          </div>
                        </div>
                      )}

                      {wizardTheme !== "自定义" && (
                        <div>
                          <label className="block text-xs font-bold text-zinc-900 mb-1.5">2. 定制教育目标 (故事导向) 🧸</label>
                          <div className="flex flex-col gap-2">
                            {(EDUCATIONAL_GOAL_OPTIONS[wizardTheme] || []).map(goal => (
                              <button
                                key={goal}
                                type="button"
                                onClick={() => setWizardGoal(goal)}
                                className={`w-full text-left p-2.5 rounded-xl text-xs font-medium border transition flex items-center justify-between ${wizardGoal === goal ? 'bg-zinc-100 border-zinc-300 text-zinc-900 font-bold' : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                              >
                                <span>{goal}</span>
                                {wizardGoal === goal && <Check className="w-4 h-4 text-zinc-900" />}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setWizardGoal("自定义")}
                              className={`w-full text-left p-2.5 rounded-xl text-xs font-medium border transition flex items-center justify-between ${wizardGoal === "自定义" ? 'bg-zinc-100 border-zinc-300 text-zinc-900 font-bold' : 'bg-orange-50/40 border-orange-200 text-orange-600 hover:bg-orange-100/50'}`}
                            >
                              <span>✏️ 自定义教育目标...</span>
                              {wizardGoal === "自定义" && <Check className="w-4 h-4 text-zinc-900" />}
                            </button>
                          </div>

                          {wizardGoal === "自定义" && (
                            <div className="mt-2.5 p-3 bg-orange-50/40 rounded-2xl border border-orange-100">
                              <label className="block text-[10px] font-bold text-zinc-700 mb-1">输入自定义教育目标：</label>
                              <input 
                                type="text"
                                placeholder="如：学会如何向别人大声打招呼"
                                value={customGoalInput}
                                onChange={e => setCustomGoalInput(e.target.value)}
                                className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 3: Scene and Characters custom */}
                  {wizardStep === 3 && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-900 mb-1.5">1. 选择故事发生场景 🏕️</label>
                        <div className="flex flex-wrap gap-2">
                          {SCENE_OPTIONS.map(scene => (
                            <button
                              key={scene}
                              type="button"
                              onClick={() => setWizardScene(scene)}
                              className={`px-3 py-1.5 rounded-full text-[11px] font-medium border transition ${wizardScene === scene ? 'bg-zinc-950 border-zinc-950 text-white font-bold' : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                            >
                              {scene}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setWizardScene("自定义")}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-medium border transition ${wizardScene === '自定义' ? 'bg-zinc-950 border-zinc-950 text-white font-bold' : 'bg-orange-50/60 border-orange-200 text-orange-600 hover:bg-orange-100/50'}`}
                          >
                            ✏️ 自定义场景
                          </button>
                        </div>
                        {wizardScene === "自定义" && (
                          <div className="mt-2.5 p-3 bg-orange-50/40 rounded-2xl border border-orange-100">
                            <label className="block text-[10px] font-bold text-zinc-700 mb-1">输入自定义故事场景：</label>
                            <input 
                              type="text"
                              placeholder="例如：糖果王国、太空城堡、彩虹滑梯"
                              value={customSceneInput}
                              onChange={e => setCustomSceneInput(e.target.value)}
                              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="block text-xs font-bold text-zinc-900">2. 主人公设定 (支持多个主人公) 🦊</label>
                          {wizardCharacters.length < 4 && (
                            <button
                              type="button"
                              onClick={() => {
                                setWizardCharacters([
                                  ...wizardCharacters,
                                  {
                                    id: "char_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
                                    name: "",
                                    role: "小松鼠",
                                    personality: "可爱懂事",
                                    customDescription: "",
                                    isCustomDescription: false
                                  }
                                ]);
                              }}
                              className="flex items-center gap-1 text-[10px] font-bold text-zinc-950 bg-zinc-100 hover:bg-zinc-200 px-2 py-1 rounded-lg border border-zinc-200 transition"
                            >
                              <Plus className="w-3 h-3" />
                              添加角色
                            </button>
                          )}
                        </div>

                        <div className="space-y-3.5 max-h-[190px] overflow-y-auto pr-1 wechat-screen-scrollbar">
                          {wizardCharacters.map((char, index) => (
                            <div key={char.id} className="relative p-3.5 bg-white rounded-2xl border border-zinc-200 space-y-3 shadow-3xs">
                              {/* Character Header */}
                              <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
                                <span className="text-[11px] font-extrabold text-zinc-950 flex items-center gap-1.5">
                                  👤 主人公 #{index + 1}
                                  {index === 0 && <span className="text-[8px] bg-zinc-950 text-white font-bold px-1.5 py-0.5 rounded">主导</span>}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {/* Toggle button for custom description */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...wizardCharacters];
                                      updated[index].isCustomDescription = !updated[index].isCustomDescription;
                                      setWizardCharacters(updated);
                                    }}
                                    className={`text-[8px] px-1.5 py-0.5 rounded border font-bold transition ${char.isCustomDescription ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-zinc-50 border-zinc-200 text-zinc-500'}`}
                                  >
                                    {char.isCustomDescription ? '✍️ 切换常规' : '📝 完全自定义描述'}
                                  </button>
                                  {wizardCharacters.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setWizardCharacters(wizardCharacters.filter(c => c.id !== char.id));
                                      }}
                                      className="text-zinc-300 hover:text-red-500 transition p-1"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Character Name / Nickname */}
                              <div>
                                <label className="block text-[9px] font-bold text-zinc-400 mb-1">名字/昵称</label>
                                <input 
                                  type="text" 
                                  placeholder="如: 刺刺, 皮皮"
                                  value={char.name}
                                  onChange={e => {
                                    const updated = [...wizardCharacters];
                                    updated[index].name = e.target.value;
                                    setWizardCharacters(updated);
                                  }}
                                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                                />
                              </div>

                              {char.isCustomDescription ? (
                                /* Fully Custom Description */
                                <div>
                                  <label className="block text-[9px] font-bold text-zinc-400 mb-1">完全自定义主人公描述</label>
                                  <textarea 
                                    rows={2}
                                    placeholder="输入任意自定义角色背景或相貌描述..."
                                    value={char.customDescription}
                                    onChange={e => {
                                      const updated = [...wizardCharacters];
                                      updated[index].customDescription = e.target.value;
                                      setWizardCharacters(updated);
                                    }}
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950 resize-none leading-normal"
                                  />
                                </div>
                              ) : (
                                /* Standard Category Inputs */
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[9px] font-bold text-zinc-400 mb-1">种族/身份</label>
                                    <input 
                                      type="text" 
                                      placeholder="如: 怕黑的小刺猬"
                                      value={char.role}
                                      onChange={e => {
                                        const updated = [...wizardCharacters];
                                        updated[index].role = e.target.value;
                                        setWizardCharacters(updated);
                                      }}
                                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-bold text-zinc-400 mb-1">性格特征</label>
                                    <input 
                                      type="text" 
                                      placeholder="如: 善良懂事"
                                      value={char.personality}
                                      onChange={e => {
                                        const updated = [...wizardCharacters];
                                        updated[index].personality = e.target.value;
                                        setWizardCharacters(updated);
                                      }}
                                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: Duration and voice selection */}
                  {wizardStep === 4 && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-900 mb-1.5">1. 选择期望播放时长 ⏳</label>
                        <div className="flex bg-zinc-50 rounded-xl border border-zinc-200 p-0.5">
                          {(['short', 'medium', 'long'] as const).map(d => (
                            <button
                              key={d}
                              onClick={() => setWizardDuration(d)}
                              className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition ${wizardDuration === d ? 'bg-zinc-950 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
                            >
                              {d === 'short' ? '短篇(约3分)' : d === 'medium' ? '中篇(约5分)' : '长篇(可自定义)'}
                            </button>
                          ))}
                        </div>
                        {wizardDuration === 'long' && (
                          <div className="mt-2.5 p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-zinc-500 font-bold">设定长篇时长：</span>
                              <span className="font-extrabold text-[11px] text-zinc-950 bg-white border border-zinc-200 px-2 py-0.5 rounded-lg shadow-2xs">
                                {longCustomMinutes} 分钟 <span className="text-[9px] text-zinc-400 font-normal">(不超过30分钟)</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <input 
                                type="range" 
                                min="6" 
                                max="30" 
                                value={longCustomMinutes}
                                onChange={e => {
                                  const val = parseInt(e.target.value);
                                  setLongCustomMinutes(val);
                                }}
                                className="flex-1 accent-zinc-950 h-1 bg-zinc-200 rounded-lg cursor-pointer"
                              />
                              <div className="flex items-center gap-1 shrink-0">
                                <input 
                                  type="number"
                                  min="6"
                                  max="30"
                                  value={longCustomMinutes}
                                  onChange={e => {
                                    let val = parseInt(e.target.value);
                                    if (isNaN(val)) return;
                                    if (val > 30) val = 30;
                                    if (val < 1) val = 1;
                                    setLongCustomMinutes(val);
                                  }}
                                  onBlur={() => {
                                    if (longCustomMinutes < 6) {
                                      setLongCustomMinutes(6);
                                    }
                                  }}
                                  className="w-10 bg-white border border-zinc-200 rounded-lg py-0.5 text-center text-[11px] font-bold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                                />
                                <span className="text-[10px] text-zinc-500 font-medium">分钟</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-zinc-900">2. 选择讲故事配音 🔊</label>
                        
                        <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                          {db?.voiceClones && db.voiceClones.length > 0 ? (
                            db.voiceClones.map((voice: VoiceClone) => (
                              <button
                                key={voice.id}
                                onClick={() => setWizardVoiceId(voice.id)}
                                className={`text-left p-2.5 rounded-2xl border transition flex items-center justify-between ${wizardVoiceId === voice.id ? 'bg-zinc-100 border-zinc-300 text-zinc-950 font-bold' : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                              >
                                <div className="flex items-center gap-2">
                                  <Volume2 className="w-4 h-4 text-zinc-800" />
                                  <div>
                                    <span className="text-xs block">{voice.name}</span>
                                    <span className="text-[9px] text-zinc-400 block">性别/类型：{voice.speakerType === 'mother' ? '妈妈' : '爸爸'}</span>
                                  </div>
                                </div>
                                {wizardVoiceId === voice.id && <Check className="w-4 h-4 text-zinc-900 animate-pulse" />}
                              </button>
                            ))
                          ) : (
                            <div className="text-center py-4 bg-zinc-50 rounded-2xl border border-zinc-200/60 p-3">
                              <p className="text-[10px] text-zinc-400 mb-2">💡 暂无保存的家庭声音，请先去克隆声音</p>
                              <button
                                type="button"
                                onClick={() => setPage("tab_studio")}
                                className="inline-block bg-zinc-900 active:scale-95 text-white text-[10px] px-3 py-1.5 rounded-lg font-bold hover:bg-zinc-800 transition-all"
                              >
                                立即去录制克隆 🎙️
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-900 mb-1">3. 有声发声模式 🎭</label>
                        <select 
                          value={wizardVoiceMode} 
                          onChange={e => setWizardVoiceMode(e.target.value as any)}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                        >
                          <option value="single">单一声音讲完整故事</option>
                          <option value="multi">不同角色使用不同声音</option>
                          <option value="narrator_ai">家长声音作为旁白，AI 声音作为角色声音</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-900 mb-1">4. 伴梦背景音 (白噪音) 🌙</label>
                        <select 
                          value={wizardBgmType} 
                          onChange={e => setWizardBgmType(e.target.value)}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                        >
                          <option value="none">关闭背景音</option>
                          <option value="soft_noise">柔和白噪音 💤</option>
                          <option value="rain">窗外淅淅沥沥雨声 🌧️</option>
                          <option value="waves">海浪拍打沙滩声 🌊</option>
                          <option value="wind">松林山谷微风声 🍃</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* STEP 5: Summary display */}
                  {wizardStep === 5 && (
                    <div className="space-y-4">
                      <span className="text-sm font-bold text-zinc-900 block text-center mb-1">📝 确认绘本定制需求</span>

                      <div className="bg-white p-4 rounded-3xl border border-zinc-200/80 shadow-xs space-y-2.5 text-xs text-zinc-900">
                        <div className="flex justify-between border-b border-zinc-100 pb-1.5">
                          <span className="text-zinc-400">故事主题</span>
                          <span className="font-bold">{wizardTheme === '自定义' ? `自定义 (${customThemeInput || '未填写'})` : wizardTheme}</span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-100 pb-1.5">
                          <span className="text-zinc-400">教养引导目标</span>
                          <span className="font-bold text-zinc-950">{(wizardTheme === '自定义' || wizardGoal === '自定义') ? `自定义 (${customGoalInput || '未填写'})` : wizardGoal}</span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-100 pb-1.5">
                          <span className="text-zinc-400">故事场景</span>
                          <span className="font-bold">{wizardScene === '自定义' ? `自定义 (${customSceneInput || '未填写'})` : wizardScene}</span>
                        </div>
                        <div className="border-b border-zinc-100 pb-1.5 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-zinc-400 font-medium">主角人设 ({wizardCharacters.length}个角色)</span>
                            <span className="font-bold">详细设定</span>
                          </div>
                          <div className="bg-zinc-50 rounded-lg p-2 space-y-1 text-[10px]">
                            {wizardCharacters.map((c, idx) => (
                              <div key={c.id} className="text-zinc-600 flex justify-between">
                                <span>角色 {idx+1}: {c.name || "宝贝"}</span>
                                <span>{c.isCustomDescription ? "完全自定义" : `${c.role} (${c.personality})`}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex justify-between border-b border-zinc-100 pb-1.5">
                          <span className="text-zinc-400">故事篇幅/配音</span>
                          <span className="font-bold">
                            {wizardDuration === 'short' ? '短篇(约3分)' : wizardDuration === 'medium' ? '中篇(约5分)' : `长篇(自定义 ${longCustomMinutes}分)`} / 
                            {db?.voiceClones?.find((v: any) => v.id === wizardVoiceId)?.name || "妈妈的温柔声"}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-100 pb-1.5">
                          <span className="text-zinc-400">有声发声模式</span>
                          <span className="font-bold">
                            {wizardVoiceMode === 'single' ? '单一声音' : wizardVoiceMode === 'multi' ? '不同角色不同声音' : '家长旁白+AI角色'}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-100 pb-1.5">
                          <span className="text-zinc-400">伴梦背景音 (白噪音)</span>
                          <span className="font-bold">
                            {wizardBgmType === 'none' ? '关闭背景音' : wizardBgmType === 'soft_noise' ? '柔和白噪音' : wizardBgmType === 'rain' ? '窗外雨声' : wizardBgmType === 'waves' ? '海浪拍打' : '松林微风'}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 text-zinc-500 text-[10px]">
                          <span>适合宝宝年龄</span>
                          <span className="font-bold">{db?.profile?.age || 4} 岁</span>
                        </div>
                      </div>

                      <div className="bg-zinc-100 p-3 rounded-xl border border-zinc-200 text-[10px] text-zinc-600 text-center font-medium">
                        🔥 本次操作将扣除 <b>1 次</b> 故事生成额度。
                      </div>
                    </div>
                  )}

                </div>

                {/* Wizard footer buttons */}
                <div className="flex gap-2.5 pt-4 shrink-0 border-t border-zinc-100">
                  {wizardStep > 1 && (
                    <button 
                      onClick={() => setWizardStep(prev => prev - 1)}
                      className="bg-white border border-zinc-200 text-zinc-700 text-xs px-4 py-2.5 rounded-xl font-bold hover:bg-zinc-50 transition-colors"
                    >
                      上一步
                    </button>
                  )}
                  
                  {wizardStep < 5 ? (
                    <button 
                      onClick={() => {
                        if (wizardStep === 4) {
                          const voiceCount = db?.voiceClones?.length || 0;
                          if (voiceCount === 0) {
                            triggerToast("⚠️ 请先克隆并保存至少一个家庭声音！");
                            return;
                          }
                        }
                        setWizardStep(prev => prev + 1);
                      }}
                      className="flex-1 bg-zinc-950 hover:bg-zinc-900 text-white text-xs py-2.5 rounded-xl font-bold shadow-sm transition flex items-center justify-center gap-1"
                    >
                      继续下一步 <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button 
                      onClick={handleGenerateStoryTextFlow}
                      className="flex-1 bg-zinc-950 hover:bg-zinc-900 text-white text-xs py-2.5 rounded-xl font-bold shadow-sm transition flex items-center justify-center gap-1"
                    >
                      🪄 开始生成文本故事
                    </button>
                  )}
                </div>

              </div>
            )}





            {/* --- TEXT STORY WAIT SCREEN --- */}
            {page === "text_wait" && (
              <div className="flex-1 flex flex-col justify-center items-center p-6 text-center space-y-6 bg-zinc-50/50">
                <div className="relative">
                  <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center animate-pulse">
                    <BookOpen className="w-10 h-10 text-zinc-600 animate-spin" />
                  </div>
                  <Sparkles className="absolute -top-1 -right-1 w-6 h-6 text-zinc-500 animate-bounce" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-zinc-900">AI 正在为您全力构思童话中...</h3>
                  <p className="text-[10px] text-zinc-500 leading-normal max-w-[240px]">
                    Gemini 正在根据您的定制需求：【主题：{wizardTheme}，主角：{charName || "宝宝"}】精心组织大纲和每一章节。
                  </p>
                </div>

                {/* Simulating steps log */}
                <div className="w-full bg-amber-50/50 border border-amber-100/50 p-4 rounded-2xl text-left text-[10px] text-amber-800 space-y-2 shadow-xs">
                  <p className="font-extrabold flex items-center gap-1.5 text-amber-950">
                    <span className="animate-pulse text-amber-500">✨</span> 伴梦星夜精灵童话编织预测：
                  </p>
                  <p className="flex items-start gap-1.5 leading-relaxed">
                    <span className="shrink-0 text-amber-500">🪄</span>
                    <span><b>今日成长大魔法</b>：悄悄往故事里注入了一颗【{wizardGoal}】的亮晶晶勇气魔法糖果！</span>
                  </p>
                  <p className="flex items-start gap-1.5 leading-relaxed">
                    <span className="shrink-0 text-amber-500">🧪</span>
                    <span><b>梦境温度与配方</b>：已调节至最适宜的 {db?.profile?.age || 4} 岁温度，让天马行空的想象化作温柔的小河。</span>
                  </p>
                  <p className="animate-pulse flex items-start gap-1.5 leading-relaxed text-amber-900 font-semibold">
                    <span className="shrink-0 text-amber-500">🌟</span>
                    <span><b>星夜预言家悄悄话</b>：这一次，听故事的宝宝会在温馨与感动中甜甜睡去哦。</span>
                  </p>
                </div>
              </div>
            )}

            {/* --- TEXT PREVIEW PAGE --- */}
            {page === "text_preview" && generatedTextStory && (
              <div className="p-4 space-y-4 flex-1 flex flex-col justify-between bg-zinc-50/10">
                
                <div className="space-y-4 flex-1">
                  
                  {/* Story Cover Photo card */}
                  <div className="relative w-full h-36 rounded-3xl overflow-hidden shadow-xs border border-zinc-200">
                    <VectorIllustration 
                      theme={generatedTextStory.theme} 
                      title={generatedTextStory.title} 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex flex-col justify-end p-3.5">
                      <span className="text-[10px] bg-zinc-950 text-white font-extrabold px-1.5 py-0.5 rounded-md self-start mb-1 shadow-2xs">
                        AI 绘本成果 🌟
                      </span>
                      <h2 className="text-sm font-extrabold text-white tracking-tight">{generatedTextStory.title}</h2>
                    </div>
                  </div>

                  {/* Abstract summary */}
                  <div className="bg-zinc-50 p-3 rounded-2xl border border-zinc-200/60 text-xs text-zinc-600 leading-relaxed">
                    <b>故事概要</b>：{generatedTextStory.abstract}
                  </div>

                  {/* Chapters Carousel/List */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-zinc-900 block">📖 绘本章节内容预览 ({generatedTextStory.chapters?.length}章)</span>
                    
                    <div className="space-y-2.5">
                      {generatedTextStory.chapters?.map((ch: any) => (
                        <div key={ch.chapterNumber} className="bg-white p-3.5 rounded-3xl border border-zinc-200/60 space-y-2 text-xs shadow-2xs">
                          <div className="flex justify-between items-center text-zinc-400 text-[10px] font-bold">
                            <span>CHAPTER {ch.chapterNumber}</span>
                            <span>{ch.title}</span>
                          </div>
                          
                          <p className="text-zinc-700 leading-relaxed text-[11px] font-medium">{ch.text}</p>
                          
                          {/* Section picture illustration */}
                          <div className="relative w-full h-24 rounded-2xl overflow-hidden border border-zinc-100">
                            <VectorIllustration 
                              theme={generatedTextStory.theme} 
                              title={`${ch.title} ${ch.text}`} 
                              className="w-full h-full object-cover" 
                            />
                            <div className="absolute bottom-1.5 right-1.5 bg-black/60 px-1.5 py-0.5 rounded-md text-[8px] text-white">
                              AI 插图 {ch.chapterNumber}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Preview Action buttons footer */}
                <div className="pt-4 shrink-0 border-t border-zinc-200/80 space-y-2">
                  <div className="flex gap-2">
                    <button 
                      onClick={handleRegenerateTextStory}
                      className="bg-white border border-zinc-200 text-zinc-900 text-xs px-3 py-2.5 rounded-xl font-bold hover:bg-zinc-50 transition"
                    >
                      🔄 重新生成 ({retryCount === 0 ? "免费1次" : "扣1次"})
                    </button>

                    <button 
                      onClick={handleSynthesizeStoryAudio}
                      className="flex-1 bg-zinc-950 hover:bg-zinc-900 text-white text-xs py-2.5 rounded-xl font-bold shadow-sm transition flex items-center justify-center gap-1"
                    >
                      满意，合成有声故事 🔊
                    </button>
                  </div>
                  <p className="text-[8px] text-zinc-400 text-center">生成有声不会消耗您的故事次数，声音将使用您录制的专属声色。</p>
                </div>

              </div>
            )}

            {/* --- AUDIO SYNTHESIS WAIT SCREEN --- */}
            {page === "audio_wait" && (
              <div className="flex-1 flex flex-col justify-between p-5 bg-zinc-50 overflow-y-auto wechat-screen-scrollbar">
                <div className="flex-1 flex flex-col justify-center items-center p-2 text-center space-y-5">
                  <div className="relative">
                    <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center">
                      <Mic className="w-10 h-10 text-zinc-600 animate-bounce" />
                    </div>
                    <Volume2 className="absolute -top-1 -right-1 w-6 h-6 text-zinc-500 animate-ping" />
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-zinc-900">亲子有声转码合成中...</h3>
                    <p className="text-[10px] text-zinc-500 leading-normal max-w-[240px]">
                      伴梦童话正在将克隆声线：【{db?.voiceClones?.find((v: any) => v.id === wizardVoiceId)?.name || "妈妈的温柔声"}】完美与 AI 童话融合！
                    </p>
                  </div>

                  {/* Progress bar simulation */}
                  <div className="w-full space-y-1.5">
                    <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden">
                      <div 
                        style={{ width: `${audioWaitProgress}%` }}
                        className="bg-zinc-950 h-full rounded-full transition-all duration-300"
                      ></div>
                    </div>
                    <div className="flex justify-between items-center text-[8px] text-zinc-400 font-mono">
                      <span>合成进度</span>
                      <span>{audioWaitProgress}%</span>
                    </div>
                  </div>

                  <div className="p-3 bg-white border border-zinc-200/80 rounded-2xl w-full text-center shadow-3xs">
                    <p className="text-[10px] text-zinc-700 font-medium leading-relaxed">
                      {audioWaitStage === 'queued' && (
                        <span>🕒 <b>排队中 (queued)</b>：正在准备旁白，调配最温暖舒适的梦境温度...</span>
                      )}
                      {audioWaitStage === 'tts_generating' && (
                        <span>✨ <b>生成旁白 (tts_generating)</b>：正在合成故事旁白，完美拟真克隆声线中...</span>
                      )}
                      {audioWaitStage === 'mixing' && (
                        <span>🎵 <b>加入白噪音 (mixing)</b>：正在混音，融合所选的【{wizardBgmType === 'soft_noise' ? '柔和白噪音' : wizardBgmType === 'rain' ? '窗外雨声' : wizardBgmType === 'waves' ? '海浪沙滩' : '松林微风'}】...</span>
                      )}
                      {audioWaitStage === 'ready' && (
                        <span>✅ <b>整理内容 (ready)</b>：已成功生成，正在整理绘本章节音频与插图...</span>
                      )}
                    </p>
                  </div>

                  {/* Realtime compilation info board */}
                  <div className="w-full bg-white border border-zinc-200/80 p-3.5 rounded-2xl text-left space-y-2.5 shadow-3xs">
                    <span className="text-[10px] font-bold text-zinc-900 block border-b border-zinc-100 pb-1">⚡ 实时有声合成状态</span>
                    <div className="space-y-1.5 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">正在生成故事</span>
                        <span className="font-bold text-zinc-900 truncate max-w-[150px]">{generatedTextStory?.title}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">选用声音声线</span>
                        <span className="font-bold text-zinc-900">{db?.voiceClones?.find((v: any) => v.id === wizardVoiceId)?.name || "妈妈的声色"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">声音搭配模式</span>
                        <span className="font-bold text-zinc-900">{wizardVoiceMode === 'single' ? '单一声音' : wizardVoiceMode === 'multi' ? '角色分音' : '旁白+AI角色'}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-zinc-100">
                        <span className="text-zinc-400">当前选用背景音</span>
                        <span className="font-bold text-zinc-950 bg-zinc-100 px-1.5 py-0.5 rounded-md">
                          {wizardBgmType === 'none' ? '关闭背景音' : wizardBgmType === 'soft_noise' ? '柔和白噪音' : wizardBgmType === 'rain' ? '窗外雨声' : wizardBgmType === 'waves' ? '海浪拍沙' : '松林微风'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Inline Background sound selection */}
                  <div className="w-full bg-zinc-100/50 p-3 rounded-2xl border border-zinc-200/60 space-y-2 text-left">
                    <span className="text-[9px] font-bold text-zinc-500 block">✨ 想中途换个背景音(白噪音)？可在下方直接调整：</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { key: 'none', label: '📴 关闭背景音' },
                        { key: 'soft_noise', label: '💤 柔和白噪音' },
                        { key: 'rain', label: '🌧️ 窗外雨声' },
                        { key: 'waves', label: '🌊 海浪拍沙' },
                        { key: 'wind', label: '🍃 松林微风' }
                      ].map(bgm => (
                        <button
                          key={bgm.key}
                          onClick={() => {
                            setWizardBgmType(bgm.key);
                            triggerToast(`🎵 已切换背景音为: ${bgm.label}`);
                          }}
                          className={`py-1 px-2 rounded-lg text-[9px] font-bold transition text-center ${wizardBgmType === bgm.key ? 'bg-zinc-950 text-white shadow-3xs' : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'}`}
                        >
                          {bgm.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- IMMERSION AUDIO PLAYER VIEW --- */}
            {page === "player" && activeStory && (
              <div className="flex-1 flex flex-col justify-between p-5 bg-zinc-50">
                <audio ref={audioRef} className="hidden" />
                
                {/* Upper Details */}
                <div className="space-y-4 flex-1 flex flex-col justify-center">
                  
                  {/* Big illustration box */}
                  <div className="relative w-56 h-56 rounded-[28px] overflow-hidden shadow-sm mx-auto border-4 border-white/80">
                    <VectorIllustration 
                      theme={activeStory.theme} 
                      title={`${activeStory.title} ${activeStory.chapters[currentChapterIndex]?.title || ""}`} 
                      className="w-full h-full object-cover" 
                    />
                    
                    {/* Speaker badge overlay */}
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-xl text-[8px] text-white font-bold flex flex-col items-start gap-0.5">
                      <div className="flex items-center gap-1">
                        <Volume2 className="w-2.5 h-2.5 text-zinc-300" />
                        <span>{db?.voiceClones?.find((v: any) => v.id === activeStory.voiceId)?.name || "妈妈的声音"}</span>
                      </div>
                      <div className="text-[7px] text-zinc-300/95 font-medium leading-none">
                        模式: {activeStory.voiceMode === 'single' ? '单一声音' : activeStory.voiceMode === 'multi' ? '不同角色不同声音' : '家长旁白+AI角色'}
                      </div>
                    </div>

                    <div className="absolute bottom-2 right-2 bg-zinc-950/90 text-white text-[8px] font-bold px-2 rounded-full py-0.5">
                      第 {currentChapterIndex + 1}/{activeStory.chapters.length} 章节
                    </div>
                  </div>

                  <div className="text-center space-y-1">
                    <h2 className="text-sm font-bold text-zinc-900 tracking-tight">{activeStory.title}</h2>
                    <span className="text-[10px] text-zinc-600 font-bold bg-zinc-200/55 px-2 py-0.5 rounded-md">
                      🎯 教育目标：{activeStory.educationalGoal}
                    </span>
                  </div>

                  {/* Audio text script (subtitle) scroll block */}
                  <div className="bg-white p-3.5 rounded-2xl border border-zinc-200/60 h-20 overflow-y-auto wechat-screen-scrollbar text-center flex flex-col justify-center items-center">
                    <p className="text-[11px] text-zinc-600 font-medium leading-relaxed">
                      {activeStory.chapters[currentChapterIndex]?.text}
                    </p>
                  </div>

                  {/* Progress slide */}
                  <div className="space-y-1 pt-2">
                    <div className="relative w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden">
                      <div 
                        style={{ width: `${playerProgress}%` }} 
                        className="bg-zinc-950 h-full rounded-full transition-all duration-300"
                      ></div>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-zinc-400 font-mono">
                      {(() => {
                        const getStoryMins = (s: any) => {
                          if (!s || !s.duration) return 3;
                          if (s.duration === "short") return 3;
                          if (s.duration === "medium") return 5;
                          if (s.duration.startsWith("long_")) {
                            const m = parseInt(s.duration.split("_")[1]);
                            return isNaN(m) ? 10 : m;
                          }
                          return 8;
                        };
                        const totalMins = getStoryMins(activeStory);
                        const totalSecs = totalMins * 60;
                        const elapsedSecs = Math.floor((playerProgress / 100) * totalSecs);
                        const formatTime = (secs: number) => {
                          const m = Math.floor(secs / 60);
                          const s = secs % 60;
                          return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                        };
                        return (
                          <>
                            <span>{formatTime(elapsedSecs)}</span>
                            <span>{formatTime(totalSecs)}</span>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                </div>

                {/* Player Controls Panel */}
                <div className="pt-4 shrink-0 space-y-3.5">
                  <div className="flex justify-center items-center gap-6">
                    
                    {/* Previous Chapter button */}
                    <button 
                      onClick={() => {
                        if (currentChapterIndex > 0) {
                          setCurrentChapterIndex(prev => prev - 1);
                          setPlayerProgress(0);
                        } else {
                          triggerToast("已经是第一章啦");
                        }
                      }}
                      className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    {/* Play / Pause Toggle button */}
                    <button 
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="w-12 h-12 bg-zinc-950 hover:bg-zinc-900 text-white rounded-full flex items-center justify-center shadow-md transition"
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      )}
                    </button>

                    {/* Next Chapter button */}
                    <button 
                      onClick={() => {
                        if (currentChapterIndex < activeStory.chapters.length - 1) {
                          setCurrentChapterIndex(prev => prev + 1);
                          setPlayerProgress(0);
                        } else {
                          triggerToast("已经是最后一章啦");
                        }
                      }}
                      className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Live Background sound / Bedtime White Noise Panel */}
                  <div className="bg-zinc-100/80 p-2 rounded-2xl border border-zinc-200/50 space-y-1.5 text-left">
                    <div className="flex justify-between items-center text-[9px] font-bold text-zinc-500 px-1">
                      <span className="flex items-center gap-1">🌙 伴梦白噪音：<b>{activeBgmType === 'none' ? '关闭' : activeBgmType === 'soft_noise' ? '柔和白噪音' : activeBgmType === 'rain' ? '窗外雨声' : activeBgmType === 'waves' ? '海浪拍沙' : '松林微风'}</b></span>
                      <span className="text-[8px] text-zinc-400 font-medium">伴眠安全音量 💤</span>
                    </div>
                    <div className="flex gap-1 overflow-x-auto pb-0.5 wechat-screen-scrollbar">
                      {[
                        { key: 'none', label: '📴 关闭' },
                        { key: 'soft_noise', label: '💤 噪音' },
                        { key: 'rain', label: '🌧️ 雨声' },
                        { key: 'waves', label: '🌊 海浪' },
                        { key: 'wind', label: '🍃 微风' }
                      ].map(bgm => (
                        <button
                          key={bgm.key}
                          onClick={() => {
                            setActiveBgmType(bgm.key);
                            triggerToast(`🎵 已无缝切换白噪音为: ${bgm.label}`);
                          }}
                          className={`py-1 px-2 rounded-lg text-[9px] font-bold transition shrink-0 ${activeBgmType === bgm.key ? 'bg-zinc-950 text-white shadow-3xs' : 'bg-white text-zinc-600 border border-zinc-200/60 hover:bg-zinc-50'}`}
                        >
                          {bgm.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Timing & Actions bar */}
                  <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-zinc-200/60 text-[10px] text-zinc-600 shadow-2xs">
                    
                    {/* Sleep timing trigger button */}
                    <div className="flex items-center gap-1">
                      <Moon className="w-3.5 h-3.5 text-zinc-700" />
                      <select 
                        value={sleepTimer || ""}
                        onChange={e => {
                          const val = e.target.value ? parseInt(e.target.value) : null;
                          setSleepTimer(val);
                          setTimerRemaining(val ? val * 60 : null);
                          if (val) triggerToast(`⏰ 已开启 ${val} 分钟睡眠定时`);
                        }}
                        className="bg-transparent font-bold text-zinc-900 focus:outline-none"
                      >
                        <option value="">定时关</option>
                        <option value="5">5分钟</option>
                        <option value="15">15分钟</option>
                        <option value="30">30分钟</option>
                        <option value="60">60分钟</option>
                      </select>
                      {timerRemaining !== null && (
                        <span className="text-[9px] text-zinc-600 bg-zinc-100 px-1 py-0.5 rounded font-mono">
                          {Math.floor(timerRemaining / 60)}:{String(timerRemaining % 60).padStart(2, '0')}
                        </span>
                      )}
                    </div>

                    <button 
                      onClick={() => handleToggleFav(activeStory.id)}
                      className="flex items-center gap-1 font-bold text-zinc-800"
                    >
                      <Heart className={`w-3.5 h-3.5 ${activeStory.isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
                      <span>收藏故事</span>
                    </button>

                    <button 
                      onClick={() => {
                        triggerToast("📋 故事分享卡片已复制，去微信发给亲人吧！");
                      }}
                      className="flex items-center gap-1 font-bold text-zinc-800"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>分享给好友</span>
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* --- DIARY PAGE VIEW --- */}
            {page === "diary" && (
              <div className="p-4 space-y-4 flex-1 flex flex-col bg-zinc-50/10">
                
                {/* Search / Filter elements */}
                <div className="space-y-2 shrink-0">
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="搜索宝宝的专属童话..."
                      value={diarySearch}
                      onChange={e => setDiarySearch(e.target.value)}
                      className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none text-zinc-900"
                    />
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-2.5" />
                  </div>

                  {/* Horizontal list of filters */}
                  <div className="flex gap-1.5 overflow-x-auto wechat-screen-scrollbar py-0.5">
                    {[
                      { key: 'all', label: '全部故事' },
                      { key: 'favorite', label: '我的收藏 ❤️' },
                      { key: 'bedtime', label: '睡前安抚 🌙' },
                      { key: 'courage', label: '勇敢自信 🦁' }
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => setDiaryFilter(f.key)}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg border shrink-0 transition ${diaryFilter === f.key ? 'bg-zinc-950 text-white border-zinc-950' : 'bg-white border-zinc-200 text-zinc-500'}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid Stories Content */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 wechat-screen-scrollbar">
                  {filteredStories.length === 0 ? (
                    <div className="text-center py-12 space-y-2 select-none">
                      <span className="text-3xl">📖</span>
                      <h3 className="text-xs font-bold text-zinc-900">这里还没有专属绘本故事哦</h3>
                      <p className="text-[10px] text-zinc-400">快去首页点击“自由定制”，创作宝宝的第一部有声绘本吧！</p>
                    </div>
                  ) : (
                    filteredStories.map((s: UserStory) => (
                      <div 
                        key={s.id} 
                        className="bg-white p-3 rounded-2xl border border-zinc-200/60 flex gap-3 group relative hover:shadow-xs transition"
                      >
                        <div className="w-14 h-18 rounded-xl overflow-hidden bg-zinc-100 flex-shrink-0 border border-zinc-100 shadow-3xs">
                          <VectorIllustration 
                            theme={s.theme} 
                            title={s.title} 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                        <div className="flex-1 flex flex-col justify-between overflow-hidden">
                          <div>
                            {storyRenameId === s.id ? (
                              <div className="flex gap-1 items-center">
                                <input 
                                  type="text" 
                                  value={storyRenameTitle} 
                                  onChange={e => setStoryRenameTitle(e.target.value)}
                                  className="border border-zinc-200 rounded text-xs px-1.5 py-0.5 w-full bg-zinc-50 text-zinc-900"
                                />
                                <button 
                                  onClick={() => handleRenameSubmit(s.id)}
                                  className="bg-zinc-950 text-white p-1 rounded hover:bg-zinc-900 text-[10px] font-bold"
                                >
                                  保存
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-zinc-900 truncate block leading-snug">{s.title}</span>
                                <button 
                                  onClick={() => { setStoryRenameId(s.id); setStoryRenameTitle(s.title); }}
                                  className="text-zinc-400 hover:text-zinc-900"
                                >
                                  <Edit3 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )}

                            <p className="text-[9px] text-zinc-500 leading-normal line-clamp-2 mt-0.5">{s.abstract}</p>
                          </div>

                          <div className="flex justify-between items-center pt-1.5 border-t border-zinc-100 mt-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[8px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-bold">
                                {s.theme}
                              </span>
                              <span className="text-[8px] text-zinc-400">
                                {new Date(s.createTime).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleToggleFav(s.id)}
                                className="p-1 hover:bg-zinc-50 rounded"
                              >
                                <Heart className={`w-3.5 h-3.5 ${s.isFavorite ? 'fill-red-500 text-red-500' : 'text-zinc-300'}`} />
                              </button>
                              <button 
                                onClick={() => handleDeleteStoryFlow(s.id)}
                                className="p-1 hover:bg-zinc-50 text-zinc-300 hover:text-red-500 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handlePlayStoryFromDiary(s)}
                                className="w-6 h-6 bg-zinc-950 hover:bg-zinc-900 text-white rounded-full flex items-center justify-center shadow-xs"
                              >
                                <Play className="w-3 h-3 fill-current ml-0.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>
            )}

            {/* --- TEMPLATE LIST PAGE VIEW --- */}
            {page === "template_list" && (
              <div className="p-4 space-y-4 flex-1 flex flex-col bg-zinc-50/10">
                {/* Search / Filter elements */}
                <div className="space-y-2 shrink-0">
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="搜索推荐绘本模板..."
                      value={templateSearch}
                      onChange={e => setTemplateSearch(e.target.value)}
                      className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none text-zinc-900 shadow-2xs"
                    />
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-2.5" />
                  </div>

                  {/* Horizontal list of filters */}
                  <div className="flex gap-1.5 overflow-x-auto wechat-screen-scrollbar py-0.5">
                    <button
                      onClick={() => setTemplateThemeFilter("all")}
                      className={`px-3 py-1 text-[10px] font-bold rounded-full border shrink-0 transition ${templateThemeFilter === 'all' ? 'bg-zinc-950 border-zinc-950 text-white' : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                    >
                      全部主题
                    </button>
                    {THEME_OPTIONS.map(theme => (
                      <button
                        key={theme}
                        onClick={() => setTemplateThemeFilter(theme)}
                        className={`px-3 py-1 text-[10px] font-bold rounded-full border shrink-0 transition ${templateThemeFilter === theme ? 'bg-zinc-950 border-zinc-950 text-white' : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                      >
                        {theme}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Templates Scroll Zone */}
                <div className="flex-1 space-y-3 overflow-y-auto pr-0.5">
                  {(() => {
                    const filteredTemplates = db?.templates?.filter((tpl: StoryTemplate) => {
                      const matchesSearch = tpl.name.toLowerCase().includes(templateSearch.toLowerCase()) || 
                                            tpl.description.toLowerCase().includes(templateSearch.toLowerCase());
                      const matchesTheme = templateThemeFilter === "all" || tpl.theme === templateThemeFilter;
                      return matchesSearch && matchesTheme;
                    }) || [];

                    if (filteredTemplates.length === 0) {
                      return (
                        <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
                          <Compass className="w-8 h-8 text-zinc-300 stroke-[1.5]" />
                          <span className="text-xs font-medium text-zinc-400">没有找到匹配的绘本模板</span>
                        </div>
                      );
                    }

                    return filteredTemplates.map((tpl: StoryTemplate) => (
                      <div 
                        key={tpl.id} 
                        className="bg-white p-3.5 rounded-2xl border border-zinc-200/80 flex gap-3 shadow-xs hover:shadow-sm transition"
                      >
                        <div className="w-18 h-24 rounded-xl overflow-hidden bg-zinc-50 flex-shrink-0 border border-zinc-100 shadow-3xs">
                          <VectorIllustration 
                            theme={tpl.theme} 
                            title={tpl.name} 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-zinc-900 leading-snug">{tpl.name}</span>
                              <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-800 text-[8px] font-bold rounded-md">{tpl.ageGroup}</span>
                              <span className="px-1.5 py-0.5 bg-orange-50 text-orange-700 text-[8px] font-bold rounded-md">{tpl.theme}</span>
                            </div>
                            <p className="text-[9px] text-zinc-500 line-clamp-2 mt-1 leading-normal">{tpl.description}</p>
                            
                            <div className="mt-1 flex flex-wrap gap-1 text-[8px] text-zinc-400">
                              <span>🎯 目标：{tpl.educationalGoal}</span>
                              <span>•</span>
                              <span>🌄 场景：{tpl.scene}</span>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center pt-2 border-t border-zinc-50 mt-1">
                            <span className="text-[8px] text-zinc-400">🔥 {tpl.useCount} 位宝贝已听</span>
                            <button 
                              onClick={() => handleApplyTemplate(tpl)}
                              className="bg-zinc-950 hover:bg-zinc-900 text-white text-[9px] px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 shadow-2xs"
                            >
                              套用此模板 <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* --- CONFIG MAINTENANCE PAGE VIEW --- */}
            {page === "config_maintenance" && (
              <div className="p-4 space-y-4 flex-1 flex flex-col bg-zinc-50/10 min-h-0">
                {/* Custom Subheader Tabs */}
                <div className="flex border-b border-zinc-200 shrink-0">
                  {(['themes_goals', 'scenes'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => {
                        setMaintenanceTab(tab);
                        setEditingThemeIndex(null);
                        setEditingGoalIndex(null);
                        setEditingSceneIndex(null);
                      }}
                      className={`flex-1 py-2 text-xs font-bold text-center border-b-2 -mb-[2px] transition-colors ${maintenanceTab === tab ? 'border-zinc-950 text-zinc-950' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}
                    >
                      {tab === 'themes_goals' && "主题与教育目标"}
                      {tab === 'scenes' && "故事场景"}
                    </button>
                  ))}
                </div>

                {/* Tab: Themes & Goals combined */}
                {maintenanceTab === "themes_goals" && (
                  <div className="flex-1 flex flex-col space-y-3 min-h-0">
                    
                    {/* Part A: Themes Master Section */}
                    <div className="bg-white p-3 rounded-2xl border border-zinc-200/80 shadow-xs space-y-2.5 shrink-0">
                      <div className="flex justify-between items-center">
                        <label className="block text-[10px] font-bold text-zinc-700">1. 故事主题管理 🪐</label>
                        <span className="text-[8px] text-zinc-400 font-medium">点击选中主题即可配置对应目标</span>
                      </div>

                      {/* Add Theme Input Group */}
                      <div className="flex gap-1.5 bg-zinc-50 p-2 rounded-xl border border-zinc-100">
                        <input
                          type="text"
                          placeholder="新主题，如：安全教育..."
                          value={newThemeName}
                          onChange={e => setNewThemeName(e.target.value)}
                          className="flex-1 bg-white border border-zinc-200 rounded-lg px-2.5 py-1 text-xs text-zinc-900 focus:outline-none"
                        />
                        <button
                          onClick={handleAddTheme}
                          className="bg-zinc-950 hover:bg-zinc-900 text-white px-3 py-1 rounded-lg text-xs font-bold transition shadow-2xs shrink-0"
                        >
                          添加
                        </button>
                      </div>

                      {/* Themes Scroll List */}
                      <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-0.5 wechat-screen-scrollbar">
                        {THEME_OPTIONS.map((theme, idx) => {
                          const activeTheme = selectedThemeForGoals || THEME_OPTIONS[0] || "";
                          const isSelected = activeTheme === theme;
                          return (
                            <div
                              key={theme}
                              onClick={() => {
                                setSelectedThemeForGoals(theme);
                                setEditingThemeIndex(null);
                                setEditingGoalIndex(null);
                              }}
                              className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition cursor-pointer ${
                                isSelected 
                                  ? 'bg-zinc-900 border-zinc-950 text-white shadow-xs' 
                                  : 'bg-zinc-50/50 border-zinc-200/60 text-zinc-900 hover:bg-zinc-100/50'
                              }`}
                            >
                              {editingThemeIndex === idx ? (
                                <div className="flex-1 flex gap-1.5 items-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    value={editingThemeValue}
                                    onChange={e => setEditingThemeValue(e.target.value)}
                                    className="flex-1 bg-white border border-zinc-200 text-zinc-900 rounded-lg px-2 py-0.5 text-xs focus:outline-none"
                                  />
                                  <button
                                    onClick={() => handleSaveEditTheme(theme)}
                                    className="text-[10px] text-green-500 font-bold px-1.5 py-0.5 hover:bg-zinc-800 rounded transition"
                                  >
                                    确定
                                  </button>
                                  <button
                                    onClick={() => setEditingThemeIndex(null)}
                                    className="text-[10px] text-zinc-400 font-bold px-1.5 py-0.5 hover:bg-zinc-800 rounded transition"
                                  >
                                    取消
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-amber-400 animate-pulse' : 'bg-zinc-400'}`}></span>
                                    <span className="text-xs font-bold truncate">{theme}</span>
                                    <span className={`text-[8px] px-1 rounded font-mono ${isSelected ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-200/80 text-zinc-500'}`}>
                                      {EDUCATIONAL_GOAL_OPTIONS[theme]?.length || 0} 目标
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => handleStartEditTheme(idx, theme)}
                                      className={`p-1 rounded transition ${isSelected ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-zinc-200/60 text-zinc-400 hover:text-zinc-700'}`}
                                      title="修改名称"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTheme(theme)}
                                      className={`p-1 rounded transition ${isSelected ? 'hover:bg-zinc-800 text-zinc-400 hover:text-red-400' : 'hover:bg-zinc-200/60 text-zinc-400 hover:text-red-600'}`}
                                      title="删除"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Part B: Goals Detail Section for selected Theme */}
                    {(() => {
                      const activeTheme = selectedThemeForGoals || THEME_OPTIONS[0] || "";
                      if (!activeTheme) return null;

                      const goals = EDUCATIONAL_GOAL_OPTIONS[activeTheme] || [];

                      return (
                        <div className="bg-white p-3 rounded-2xl border border-zinc-200/80 shadow-xs flex-1 flex flex-col min-h-0 space-y-2.5">
                          <div className="border-b border-zinc-100 pb-1.5 flex justify-between items-center shrink-0">
                            <label className="block text-[10px] font-bold text-zinc-700">
                              2.「{activeTheme}」的教育目标 🎯
                            </label>
                            <span className="text-[8px] text-zinc-400 font-semibold bg-zinc-100 px-1.5 py-0.5 rounded-md">
                              共 {goals.length} 个
                            </span>
                          </div>

                          {/* Add Goal Input Group */}
                          <div className="flex gap-1.5 bg-zinc-50 p-2 rounded-xl border border-zinc-100 shrink-0">
                            <input
                              type="text"
                              placeholder="新目标，如：克服怕黑恐惧..."
                              value={newGoalName}
                              onChange={e => setNewGoalName(e.target.value)}
                              className="flex-1 bg-white border border-zinc-200 rounded-lg px-2.5 py-1 text-xs text-zinc-900 focus:outline-none"
                            />
                            <button
                              onClick={() => handleAddGoal(activeTheme)}
                              className="bg-zinc-950 hover:bg-zinc-900 text-white px-3 py-1 rounded-lg text-xs font-bold transition shadow-2xs shrink-0"
                            >
                              添加
                            </button>
                          </div>

                          {/* Goals Scroll List */}
                          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 wechat-screen-scrollbar min-h-0">
                            {goals.length === 0 ? (
                              <div className="py-8 text-center text-zinc-400 text-[10px] font-medium select-none">
                                💡 该主题下暂无定制目标，请在上方添加
                              </div>
                            ) : (
                              goals.map((goal, idx) => (
                                <div
                                  key={goal}
                                  className="bg-zinc-50 p-2 rounded-xl border border-zinc-200/60 flex items-center justify-between gap-2 shadow-2xs hover:border-zinc-300 transition"
                                >
                                  {editingGoalIndex === idx ? (
                                    <div className="flex-1 flex gap-1.5 items-center">
                                      <input
                                        type="text"
                                        value={editingGoalValue}
                                        onChange={e => setEditingGoalValue(e.target.value)}
                                        className="flex-1 bg-white border border-zinc-200 rounded-lg px-2 py-0.5 text-xs text-zinc-900 focus:outline-none"
                                      />
                                      <button
                                        onClick={() => handleSaveEditGoal(activeTheme, goal)}
                                        className="text-[10px] text-green-600 font-bold px-1.5 py-0.5 hover:bg-green-50 rounded transition"
                                      >
                                        确定
                                      </button>
                                      <button
                                        onClick={() => setEditingGoalIndex(null)}
                                        className="text-[10px] text-zinc-400 font-bold px-1.5 py-0.5 hover:bg-zinc-50 rounded transition"
                                      >
                                        取消
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0"></span>
                                        <span className="text-xs font-bold text-zinc-800 truncate">{goal}</span>
                                      </div>
                                      <div className="flex items-center gap-0.5 shrink-0">
                                        <button
                                          onClick={() => handleStartEditGoal(idx, goal)}
                                          className="p-1 hover:bg-zinc-200/60 text-zinc-400 hover:text-zinc-700 rounded transition"
                                          title="修改目标"
                                        >
                                          <Edit3 className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteGoal(activeTheme, goal)}
                                          className="p-1 hover:bg-zinc-200/60 text-zinc-400 hover:text-red-600 rounded transition"
                                          title="删除"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Tab: Scenes */}
                {maintenanceTab === "scenes" && (
                  <div className="flex-1 flex flex-col space-y-3 min-h-0">
                    {/* Add Scene Input Group */}
                    <div className="bg-white p-3.5 rounded-2xl border border-zinc-200/80 shadow-xs space-y-2">
                      <label className="block text-[10px] font-bold text-zinc-700">添加故事场景 🌄</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="输入新场景，如：未来太空港..."
                          value={newSceneName}
                          onChange={e => setNewSceneName(e.target.value)}
                          className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                        />
                        <button
                          onClick={handleAddScene}
                          className="bg-zinc-950 hover:bg-zinc-900 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs"
                        >
                          添加
                        </button>
                      </div>
                    </div>

                    {/* Scenes Scroll List */}
                    <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                      <span className="text-[10px] font-bold text-zinc-400 block px-1">已有故事场景 ({SCENE_OPTIONS.length})</span>
                      {SCENE_OPTIONS.map((scene, idx) => (
                        <div
                          key={scene}
                          className="bg-white p-3 rounded-2xl border border-zinc-200/60 flex items-center justify-between gap-2 shadow-2xs hover:border-zinc-300 transition"
                        >
                          {editingSceneIndex === idx ? (
                            <div className="flex-1 flex gap-1.5 items-center">
                              <input
                                type="text"
                                value={editingSceneValue}
                                onChange={e => setEditingSceneValue(e.target.value)}
                                className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1 text-xs text-zinc-900 focus:outline-none"
                              />
                              <button
                                onClick={() => handleSaveEditScene(scene)}
                                className="text-xs text-green-600 font-bold px-2 py-1 hover:bg-green-50 rounded transition"
                              >
                                确定
                              </button>
                              <button
                                onClick={() => setEditingSceneIndex(null)}
                                className="text-xs text-zinc-400 font-bold px-2 py-1 hover:bg-zinc-50 rounded transition"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                                <span className="text-xs font-bold text-zinc-900">{scene}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleStartEditScene(idx, scene)}
                                  className="p-1.5 hover:bg-zinc-50 text-zinc-400 hover:text-zinc-700 rounded transition"
                                  title="修改名称"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteScene(scene)}
                                  className="p-1.5 hover:bg-zinc-50 text-zinc-400 hover:text-red-600 rounded transition"
                                  title="删除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* WeChat Sticky Tab Bar Navigator */}
          {page !== "welcome" && page !== "profile_setup" && (
            <div className="w-full h-14 bg-white border-t border-zinc-200/80 flex justify-around items-center shrink-0 z-40 select-none pb-1.5">
              {[
                { id: "tab_home", label: "首页", icon: Compass },
                { id: "tab_studio", label: "录音室", icon: Mic },
                { id: "tab_my", label: "我的", icon: User }
              ].map(tab => {
                const Icon = tab.icon;
                const isSel = page === tab.id || (tab.id === 'tab_home' && (page === 'wizard' || page === 'text_wait' || page === 'text_preview' || page === 'audio_wait' || page === 'player' || page === 'diary'));
                return (
                  <button 
                    key={tab.id}
                    onClick={() => {
                      // Close notification drawer
                      setShowNotifications(false);
                      setPage(tab.id);
                    }}
                    className={`flex flex-col items-center gap-1 w-16 py-1 transition-all ${isSel ? 'text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-600'}`}
                  >
                    <Icon className="w-4.5 h-4.5" />
                    <span className="text-[9px] leading-none">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* WeChat Slide-Up Notification Center Drawer */}
          <AnimatePresence>
            {showNotifications && (
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                className="absolute inset-0 bg-zinc-50 z-50 flex flex-col"
              >
                {/* Drawer Header */}
                <div className="p-4 border-b border-zinc-200/80 flex justify-between items-center shrink-0">
                  <span className="text-xs font-bold text-zinc-900 flex items-center gap-1">🔔 通知消息中心</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        onReadAllNotifications().then(() => refreshDb());
                        triggerToast("✓ 已全部标记为已读");
                      }}
                      className="text-[9px] text-zinc-600 font-semibold"
                    >
                      全部已读
                    </button>
                    <span className="text-zinc-200">|</span>
                    <button 
                      onClick={() => setShowNotifications(false)}
                      className="text-[9px] text-zinc-900 font-bold"
                    >
                      关闭
                    </button>
                  </div>
                </div>

                {/* Drawer notifications content */}
                <div className="flex-1 overflow-y-auto wechat-screen-scrollbar p-4 space-y-2.5">
                  {db?.notifications?.length === 0 ? (
                    <div className="text-center py-12 text-zinc-400 text-xs">
                      暂无通知消息
                    </div>
                  ) : (
                    db.notifications.map((n: AppNotification) => (
                      <div 
                        key={n.id} 
                        className={`p-3 rounded-2xl border relative transition shadow-2xs ${n.isRead ? 'bg-white border-zinc-100 opacity-60' : 'bg-white border-zinc-200 shadow-2xs'}`}
                      >
                        {!n.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 absolute top-2 right-2"></span>
                        )}
                        <h4 className="text-xs font-bold text-zinc-900 leading-tight pr-4">{n.title}</h4>
                        <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{n.content}</p>
                        <div className="flex justify-between items-center pt-2 mt-2 border-t border-zinc-100 text-[8px] text-zinc-400">
                          <span>类型：{n.type === 'system' ? '系统安全' : n.type === 'story' ? '绘本创作' : '声音克隆'}</span>
                          <span>{new Date(n.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Safety Block Alert Modal */}
          <AnimatePresence>
            {safetyBlockedData && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-5 select-none"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 15 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 15 }}
                  className="bg-white rounded-3xl p-6 w-full max-w-[280px] text-center border border-zinc-200 shadow-xl space-y-4 font-sans"
                >
                  <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6 shrink-0" />
                  </div>
                  
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-extrabold text-zinc-900">
                      「伴梦守护」发现敏感词
                    </h3>
                    <p className="text-[10px] text-red-600 font-bold bg-red-50 py-1 px-2 rounded-lg">
                      类别: {safetyBlockedData.categoryName} (包含「{safetyBlockedData.word}」)
                    </p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed pt-1.5">
                      为了给宝宝保持纯净、温柔、无暴力危险的童话视听环境，该词已被系统自动拦截防御。本次生成不扣除您的故事次数或声音克隆额度。
                    </p>
                  </div>

                  <button
                    onClick={() => setSafetyBlockedData(null)}
                    className="w-full bg-zinc-950 hover:bg-zinc-800 text-white text-[10px] font-bold py-2.5 px-4 rounded-xl transition"
                  >
                    我知道了，换个温暖的词组
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Safety Rewrite Suggestions Modal */}
          <AnimatePresence>
            {safetyRewriteData && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-5 select-none"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 15 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 15 }}
                  className="bg-white rounded-3xl p-6 w-full max-w-[280px] text-left border border-zinc-200 shadow-xl space-y-4 font-sans"
                >
                  <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                    <Sparkles className="w-5 h-5 shrink-0" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-xs font-extrabold text-zinc-900 text-center">
                      ✨ 伴梦温馨安全改写建议
                    </h3>
                    <p className="text-[10px] text-zinc-400 text-center leading-relaxed">
                      您的设定中含有词汇『{safetyRewriteData.word}』（属于：{safetyRewriteData.categoryName}），对宝宝而言有些许敏感或不安。
                    </p>
                    
                    <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100 space-y-1">
                      <span className="text-[9px] text-zinc-400 font-bold block">我们建议改写为：</span>
                      <p className="text-[11px] text-zinc-700 font-bold leading-relaxed">
                        {safetyRewriteData.suggestedReplacement}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setSafetyRewriteData(null)}
                      className="flex-1 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 text-[10px] font-bold py-2 rounded-xl transition text-center"
                    >
                      不改了
                    </button>
                    <button
                      onClick={() => {
                        // Automatically replace user input in Wizard forms!
                        if (customThemeInput.includes(safetyRewriteData.word)) {
                          setCustomThemeInput(customThemeInput.replace(new RegExp(safetyRewriteData.word, "g"), safetyRewriteData.suggestedReplacement));
                        } else if (customGoalInput.includes(safetyRewriteData.word)) {
                          setCustomGoalInput(customGoalInput.replace(new RegExp(safetyRewriteData.word, "g"), safetyRewriteData.suggestedReplacement));
                        } else if (customSceneInput.includes(safetyRewriteData.word)) {
                          setCustomSceneInput(customSceneInput.replace(new RegExp(safetyRewriteData.word, "g"), safetyRewriteData.suggestedReplacement));
                        } else {
                          // Default action: append or replace custom theme
                          setCustomThemeInput(safetyRewriteData.suggestedReplacement);
                          setWizardTheme("自定义");
                        }
                        setSafetyRewriteData(null);
                        triggerToast("✓ 设定已自动一键净化改写！");
                      }}
                      className="flex-1 bg-zinc-950 hover:bg-zinc-800 text-white text-[10px] font-bold py-2 rounded-xl transition text-center shadow-xs"
                    >
                      一键替换净化
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* iOS Bottom Navigation Bar Slider */}
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1.5 bg-stone-900 rounded-full z-50"></div>

        </div>
      </div>

    </div>
  );
}
