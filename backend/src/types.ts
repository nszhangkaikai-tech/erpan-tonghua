export interface ChildProfile {
  nickname: string;
  age: number;
  gender: 'boy' | 'girl' | 'other';
  interests: string[];
  parentName: string;
  bedTime: string;
}

export interface VoiceClone {
  id: string;
  name: string;
  isReady: boolean;
  usageCount: number;
  createTime: string;
  recordDuration: number; // in seconds
  sampleUrl?: string;
  speakerType: 'father' | 'mother' | 'grandfather' | 'grandmother' | 'custom';
}

export interface StoryTemplate {
  id: string;
  name: string;
  cover: string;
  ageGroup: string;
  theme: string;
  educationalGoal: string;
  scene: string;
  mainCharacter: {
    name: string;
    role: string;
    personality: string;
  };
  duration: 'short' | 'medium' | 'long';
  description: string;
  isRecommended: boolean;
  useCount: number;
  visualStyle?: string;
  coverPromptSeed?: string;
  contentPromptSeed?: string;
  chapterBeats?: string[];
}

export interface StoryChapter {
  chapterNumber: number;
  title: string;
  text: string;
  imageUrl: string; // Base64 inline image or stock illustration
  imagePrompt?: string;
}

export interface UserStory {
  id: string;
  title: string;
  abstract: string;
  chapters: StoryChapter[];
  coverUrl: string;
  isAudioReady: boolean;
  voiceId: string;
  voiceMode: 'single' | 'multi' | 'narrator_ai';
  createTime: string;
  isSavedToDiary: boolean;
  isFavorite: boolean;
  theme: string;
  educationalGoal: string;
  scene: string;
  mainCharacterName: string;
  duration: 'short' | 'medium' | 'long';
  targetAge: number;
  bgmType?: string;
  coverPrompt?: string;
  templateId?: string;
  visualStyle?: string;
}

export interface CDKeyCard {
  code: string;
  type: 'times' | 'vip';
  value: number; // times amount or vip days
  isUsed: boolean;
  usedBy?: string;
  usedTime?: string;
  channel: string;
  createdAt: string;
}

export interface InvitationRecord {
  id: string;
  referrerId: string; // The person who shared their code
  referredId: string; // The person who joined
  referredName: string;
  status: 'pending' | 'success'; // 'success' when referred user generates first story
  rewardValue: number; // e.g., 2 story generation times
  createdAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  content: string;
  type: 'system' | 'story' | 'voice' | 'card' | 'referral';
  isRead: boolean;
  createdAt: string;
}

export interface AppUserRights {
  freeVoiceClonesRemaining: number;
  storyGenerationsRemaining: number;
  isVip: boolean;
  vipExpiry?: string;
  inviteCode: string;
  usedInviteCode?: string;
}

export interface SystemStats {
  todayNewUsers: number;
  todayActiveUsers: number;
  profileCompletedCount: number;
  voiceClonedCount: number;
  textStoriesGenerated: number;
  audioStoriesGenerated: number;
  storiesPlayedCount: number;
  storiesSavedCount: number;
  cdkeysRedeemedCount: number;
  vipsActivatedCount: number;
  invitesBoundCount: number;
  invitesCompletedCount: number;
}
