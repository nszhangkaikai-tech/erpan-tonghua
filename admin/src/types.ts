// 后台各集合的松散类型定义（字段可能因环境 .add() 丢字段而不完整，页面需做兜底）
export interface UserDoc {
  _id?: string;
  openid?: string;
  nickname?: string;
  avatar?: string;
  createdAt?: string;
  lastActiveAt?: string;
  children?: any[];
  quota?: { total?: number; used?: number; resetAt?: string };
  [k: string]: any;
}

export interface StoryDoc {
  _id?: string;
  title?: string;
  openid?: string;
  status?: string;
  createdAt?: string;
  cover?: string;
  [k: string]: any;
}

export interface VoiceDoc {
  _id?: string;
  name?: string;
  openid?: string;
  status?: string;
  createdAt?: string;
  audioUrl?: string;
  [k: string]: any;
}

export interface CdkeyDoc {
  _id?: string;
  code?: string;
  type?: string;
  quota?: number;
  used?: boolean;
  status?: string;
  expiresAt?: string;
  [k: string]: any;
}

export interface TemplateDoc {
  _id?: string;
  id?: string;
  name?: string;
  ageGroup?: string;
  theme?: string;
  educationalGoal?: string;
  scene?: string;
  description?: string;
  mainCharacter?: {
    name?: string;
    role?: string;
    personality?: string;
  };
  duration?: string;
  cover?: string;
  aiPrompt?: string;
  isRecommended?: boolean;
  useCount?: number;
  [k: string]: any;
}

export interface NotifDoc {
  _id?: string;
  title?: string;
  body?: string;
  content?: string;
  type?: string;
  openid?: string;
  isRead?: boolean;
  read?: boolean;
  status?: string;
  createdAt?: string;
  [k: string]: any;
}

export interface AdminDoc {
  _id?: string;
  username?: string;
  createdAt?: string;
  [k: string]: any;
}
