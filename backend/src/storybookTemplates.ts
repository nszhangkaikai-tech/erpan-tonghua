export interface StoryCharacterInput {
  name?: string;
  role?: string;
  personality?: string;
  customDescription?: string;
}

export interface StoryPromptInput {
  templateId?: string;
  theme: string;
  educationalGoal: string;
  scene: string;
  age: number;
  duration: string;
  characters: StoryCharacterInput[];
}

export interface StoryVisualStyle {
  medium: string;
  palette: string;
  lighting: string;
  characterContinuity: string;
}

export interface StorybookTemplateDefinition {
  id: string;
  name: string;
  cover: string;
  ageGroup: string;
  theme: string;
  educationalGoal: string;
  scene: string;
  mainCharacter: { name: string; role: string; personality: string };
  duration: 'short' | 'medium' | 'long';
  description: string;
  isRecommended: boolean;
  useCount: number;
  visualStyle: StoryVisualStyle;
  coverPromptSeed: string;
  contentPromptSeed: string;
  chapterBeats: string[];
  coverPrompt?: string;
}

interface ThemeProfile {
  mood: string;
  palette: string;
  arc: string;
}

interface SceneProfile {
  setting: string;
  details: string;
}

const THEME_PROFILES: Record<string, ThemeProfile> = {
  睡前安抚: { mood: '安全、宁静、被温柔陪伴', palette: '月光蓝、奶油白、柔和薰衣草紫', arc: '从轻微不安走向安心入睡' },
  勇敢自信: { mood: '明亮、鼓舞、充满成长感', palette: '天空蓝、暖橙、彩虹黄', arc: '从犹豫退缩走向勇敢尝试' },
  友情人际: { mood: '温暖、热闹、彼此支持', palette: '草木绿、珊瑚橙、晴天蓝', arc: '从误会或独处走向理解与合作' },
  情绪管理: { mood: '柔和、包容、帮助孩子认识自己', palette: '雾霾蓝、蜜桃粉、薄荷绿', arc: '从情绪波动走向表达和调节' },
  习惯养成: { mood: '轻快、游戏化、积极有序', palette: '柠檬黄、青草绿、奶油橙', arc: '从拖延或混乱走向稳定的小习惯' },
  认知启蒙: { mood: '好奇、清晰、充满发现', palette: '湖水蓝、明黄、珊瑚红', arc: '从提出问题走向观察、理解和发现' },
  '勇敢与自信': { mood: '明亮、鼓舞、充满成长感', palette: '天空蓝、暖橙、彩虹黄', arc: '从犹豫退缩走向勇敢尝试' },
  '分享与友爱': { mood: '温暖、热闹、彼此支持', palette: '草木绿、珊瑚橙、晴天蓝', arc: '从独占或误会走向理解与分享' },
  想象力开发: { mood: '奇妙、开阔、充满探索欲', palette: '深海蓝、星光金、紫罗兰', arc: '从一个好奇念头走向想象中的新世界' },
};

const SCENE_PROFILES: Record<string, SceneProfile> = {
  静谧森林: { setting: '安静的森林小径、柔软苔藓和会发光的树叶', details: '萤火虫、弯月、蘑菇小屋和轻轻摇曳的树枝' },
  温馨家庭: { setting: '有暖灯、软垫和熟悉物品的温暖家中', details: '亲子拥抱、绘本、毛毯、窗边月光和一杯温牛奶' },
  太空星球: { setting: '漂浮着星尘和小行星的梦幻太空站与彩色星球', details: '玻璃舷窗、友善外星朋友、火箭、星环和发光控制台' },
  海底世界: { setting: '阳光穿过海水的蓝色海底王国', details: '珊瑚、海草、泡泡、贝壳小屋和温柔的海洋伙伴' },
  魔法城堡: { setting: '有会发光的拱门和云朵花园的童话城堡', details: '彩色旗帜、魔法书、圆形塔楼、星星尘埃和友善守卫' },
  恐龙乐园: { setting: '阳光明亮、植被茂盛的安全恐龙乐园', details: '高大的蕨类植物、温和的恐龙伙伴、果实和小溪' },
  彩虹山谷: { setting: '被彩虹和云朵环绕的开阔山谷', details: '彩虹桥、飞舞的风筝、柔软草坡和闪光溪流' },
  '孩子的温馨卧室': { setting: '充满玩具、绘本和暖灯的孩子卧室', details: '收纳箱、软绵绵的床、星星贴纸和窗外的晚霞' },
  神奇苹果庄园: { setting: '果树成荫、阳光温暖的神奇庄园', details: '金色苹果、木栅栏、果篮、松鼠伙伴和微风' },
  浩瀚太空港: { setting: '热闹又安全的儿童太空港', details: '小火箭、星际行李箱、彩色星球和闪烁指示灯' },
  '蓝色海洋深处': { setting: '宁静明亮的深海珊瑚王国', details: '海洋节彩灯、贝壳舞台、鱼群和会唱歌的海草' },
};

const DEFAULT_STYLE: StoryVisualStyle = {
  medium: 'soft digital watercolor picture-book illustration, rounded shapes, gentle paper texture',
  palette: 'warm pastel colors with clear subject separation',
  lighting: 'soft cinematic light with a comforting glow',
  characterContinuity: 'keep the same face, outfit, colors, proportions and accessories for every appearance',
};

const COVER_SEED = 'a memorable central composition with one clear focal character, an inviting atmosphere, layered depth, and a beautiful storybook sense of wonder';
const CONTENT_SEED = 'show the concrete action and emotional beat of this chapter, with a readable foreground, a supportive middle ground, and scene details that move the story forward';

const CURATED_STORYBOOK_TEMPLATE_CATALOG: StorybookTemplateDefinition[] = [
  {
    id: 'tpl_bedtime_family', name: '月光下的晚安抱抱', cover: '/public/storage/tpl_bedtime_family-v1.webp', ageGroup: '2-5岁', theme: '睡前安抚', educationalGoal: '情绪放松', scene: '温馨家庭', mainCharacter: { name: '团团', role: '需要晚安陪伴的小熊', personality: '温柔敏感，喜欢听故事' }, duration: 'short', description: '把睡前的小小不安变成一个温暖的晚安仪式，让孩子在熟悉的家中安心入睡。', isRecommended: true, useCount: 0,
    visualStyle: { ...DEFAULT_STYLE, palette: '月光蓝、奶油白、柔和薰衣草紫', lighting: '窗边月光与床头暖灯交织的柔和夜景' }, coverPromptSeed: COVER_SEED, contentPromptSeed: CONTENT_SEED, chapterBeats: ['准备晚安仪式', '发现并表达不安', '在陪伴中放松入睡']
  },
  {
    id: 'tpl_courage_castle', name: '城堡里的第一步', cover: '/public/storage/tpl_courage_castle-v1.webp', ageGroup: '4-7岁', theme: '勇敢自信', educationalGoal: '面对困难不退缩', scene: '魔法城堡', mainCharacter: { name: '勇勇', role: '第一次参加任务的小骑士', personality: '认真善良，偶尔会紧张' }, duration: 'medium', description: '小骑士在朋友的鼓励下迈出第一步，理解勇敢不是不害怕，而是愿意试一试。', isRecommended: true, useCount: 0,
    visualStyle: { ...DEFAULT_STYLE, palette: '天空蓝、暖橙、彩虹黄', lighting: '明亮的晨光和魔法星尘' }, coverPromptSeed: COVER_SEED, contentPromptSeed: CONTENT_SEED, chapterBeats: ['接受小任务', '遇到需要尝试的难题', '用自己的方法完成挑战', '把勇气分享给朋友']
  },
  {
    id: 'tpl_friendship_undersea', name: '海底王国的分享日', cover: '/public/storage/tpl_friendship_undersea-v1.webp', ageGroup: '3-6岁', theme: '友情人际', educationalGoal: '学会分享', scene: '海底世界', mainCharacter: { name: '泡泡', role: '喜欢收集贝壳的小海马', personality: '聪明可爱，正在学习倾听' }, duration: 'medium', description: '一场海底分享日让小海马学会倾听伙伴、表达需要，并和朋友一起找到更好的办法。', isRecommended: true, useCount: 0,
    visualStyle: { ...DEFAULT_STYLE, palette: '草木绿、珊瑚橙、晴天蓝', lighting: '清透的海水光束和温暖珊瑚光' }, coverPromptSeed: COVER_SEED, contentPromptSeed: CONTENT_SEED, chapterBeats: ['遇到分享难题', '听见朋友的心情', '一起寻找解决办法', '体会分享后的快乐']
  },
  {
    id: 'tpl_emotion_forest', name: '森林里的心情天气', cover: '/public/storage/tpl_emotion_forest-v1.webp', ageGroup: '3-6岁', theme: '情绪管理', educationalGoal: '识别情绪', scene: '静谧森林', mainCharacter: { name: '芽芽', role: '会观察心情的小鹿', personality: '细腻好奇，愿意慢慢表达' }, duration: 'short', description: '小鹿把心情比作天气，在森林伙伴的陪伴下学会发现、说出并照顾自己的感受。', isRecommended: true, useCount: 0,
    visualStyle: { ...DEFAULT_STYLE, palette: '雾霾蓝、蜜桃粉、薄荷绿', lighting: '穿过树叶的柔和晨光与情绪色彩' }, coverPromptSeed: COVER_SEED, contentPromptSeed: CONTENT_SEED, chapterBeats: ['察觉心情变化', '给情绪找到名字', '用呼吸和倾诉让心情变轻']
  },
  {
    id: 'tpl_habits_dinosaur', name: '恐龙乐园的滴答任务', cover: '/public/storage/tpl_habits_dinosaur-v1.webp', ageGroup: '3-6岁', theme: '习惯养成', educationalGoal: '规律作息', scene: '恐龙乐园', mainCharacter: { name: '滴滴', role: '爱把事情留到最后的小恐龙', personality: '活泼热心，需要一点提醒' }, duration: 'short', description: '小恐龙用游戏化的小任务安排一天，逐渐发现规律作息能让每天都更轻松好玩。', isRecommended: true, useCount: 0,
    visualStyle: { ...DEFAULT_STYLE, palette: '柠檬黄、青草绿、奶油橙', lighting: '明亮晴朗的日间阳光' }, coverPromptSeed: COVER_SEED, contentPromptSeed: CONTENT_SEED, chapterBeats: ['发现时间被打乱', '把习惯变成闯关任务', '完成一项小习惯', '享受有秩序的一天']
  },
  {
    id: 'tpl_cognition_space', name: '星球上的颜色旅行', cover: '/public/storage/tpl_cognition_space-v1.webp', ageGroup: '3-6岁', theme: '认知启蒙', educationalGoal: '颜色认知', scene: '太空星球', mainCharacter: { name: '星星', role: '喜欢观察颜色的小宇航员', personality: '好奇专注，善于提问' }, duration: 'short', description: '跟着小宇航员穿梭彩色星球，在观察、比较和寻找的过程中认识身边的颜色。', isRecommended: true, useCount: 0,
    visualStyle: { ...DEFAULT_STYLE, palette: '湖水蓝、明黄、珊瑚红', lighting: '星光与彩色星球反射出的清晰柔光' }, coverPromptSeed: COVER_SEED, contentPromptSeed: CONTENT_SEED, chapterBeats: ['发现颜色线索', '比较不同颜色', '把颜色和物品联系起来']
  },
];

const COMBINATION_THEMES = ['睡前安抚', '勇敢自信', '友情人际', '情绪管理', '习惯养成', '认知启蒙'] as const;
const COMBINATION_SCENES = ['静谧森林', '温馨家庭', '太空星球', '海底世界', '魔法城堡', '恐龙乐园'] as const;

const THEME_GOALS: Record<string, string[]> = {
  睡前安抚: ['情绪放松', '独立入睡'],
  勇敢自信: ['面对困难不退缩', '尝试新事物'],
  友情人际: ['学会分享', '团队合作'],
  情绪管理: ['识别情绪', '表达感受'],
  习惯养成: ['规律作息', '整理玩具'],
  认知启蒙: ['颜色认知', '自然探索'],
};

const SCENE_CHARACTERS: Record<string, { name: string; role: string; personality: string }> = {
  静谧森林: { name: '芽芽', role: '会发光的小鹿', personality: '细腻好奇，喜欢发现温柔的小事' },
  温馨家庭: { name: '团团', role: '爱听故事的小熊', personality: '亲切依赖，愿意和家人分享心情' },
  太空星球: { name: '星星', role: '好奇的小宇航员', personality: '勇敢专注，喜欢提出问题' },
  海底世界: { name: '泡泡', role: '善良的小海马', personality: '活泼热心，愿意帮助朋友' },
  魔法城堡: { name: '奇奇', role: '学习魔法的小学徒', personality: '想象力丰富，遇到困难会坚持' },
  恐龙乐园: { name: '果果', role: '爱探索的小恐龙', personality: '精力充沛，正在学习安排自己的时间' },
};

function buildCombinationTemplate(theme: string, scene: string, index: number): StorybookTemplateDefinition {
  const character = SCENE_CHARACTERS[scene];
  const goal = THEME_GOALS[theme][index % THEME_GOALS[theme].length];
  const themeProfile = getThemeProfile(theme);
  const sceneProfile = getSceneProfile(scene);
  const duration = theme === '睡前安抚' || theme === '情绪管理' || theme === '认知启蒙' ? 'short' : 'medium';
  const id = `tpl_${theme}_${scene}`;
  return {
    id,
    name: `${scene}的${character.name}${theme}魔法`,
    cover: 'https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=500&q=80',
    ageGroup: theme === '认知启蒙' ? '3-6岁' : '3-7岁',
    theme,
    educationalGoal: goal,
    scene,
    mainCharacter: character,
    duration,
    description: `在${scene}里，${character.name}遇到一个和“${theme}”有关的小难题。它和伙伴一起探索${sceneProfile.details}，用温柔又有趣的方式学会${goal}。`,
    isRecommended: index === 0,
    useCount: 0,
    visualStyle: { ...DEFAULT_STYLE, palette: themeProfile.palette, lighting: '柔和明亮、突出角色表情的童话光线' },
    coverPromptSeed: `${COVER_SEED}; make the ${theme} mood clearly visible in the ${scene} setting, with a cute magical visual hook`,
    contentPromptSeed: `${CONTENT_SEED}; use ${sceneProfile.details} as concrete props and show the ${theme} growth beat through the character's action`,
    chapterBeats: [
      `在${scene}中发现${theme}主题的小线索`,
      `遇到需要${goal}的具体情节`,
      `和伙伴一起尝试一个可行办法`,
      `用行动完成成长并回到温暖的情绪落点`,
    ],
  };
}

const GENERATED_COMBINATION_TEMPLATES = COMBINATION_THEMES.flatMap(theme =>
  COMBINATION_SCENES.map((scene, index) => buildCombinationTemplate(theme, scene, index)),
);

export const STORYBOOK_TEMPLATE_CATALOG: StorybookTemplateDefinition[] = [
  ...CURATED_STORYBOOK_TEMPLATE_CATALOG,
  ...GENERATED_COMBINATION_TEMPLATES.filter(item => !CURATED_STORYBOOK_TEMPLATE_CATALOG.some(curated => curated.theme === item.theme && curated.scene === item.scene)),
];

function getThemeProfile(theme: string): ThemeProfile {
  return THEME_PROFILES[theme] || { mood: '温暖、好奇、适合亲子共读', palette: '柔和明亮的儿童绘本色彩', arc: '从一个小问题走向温暖的发现' };
}

function getSceneProfile(scene: string): SceneProfile {
  return SCENE_PROFILES[scene] || { setting: `充满想象力的${scene}`, details: '柔和的光线、可爱的伙伴和安全有趣的小细节' };
}

function getPrimaryCharacter(input: StoryPromptInput) {
  const first = input.characters[0] || {};
  return {
    name: first.name || '小宝贝',
    role: first.role || '勇敢可爱的探险家',
    personality: first.personality || '聪明、善良、富有好奇心',
  };
}

export function getStorybookTemplate(input: StoryPromptInput): StorybookTemplateDefinition {
  const matched = input.templateId ? STORYBOOK_TEMPLATE_CATALOG.find(item => item.id === input.templateId) : undefined;
  const themeProfile = getThemeProfile(input.theme);
  const sceneProfile = getSceneProfile(input.scene);
  const character = getPrimaryCharacter(input);

  if (matched) {
    return { ...matched, theme: input.theme || matched.theme, educationalGoal: input.educationalGoal || matched.educationalGoal, scene: input.scene || matched.scene };
  }

  const compatible = STORYBOOK_TEMPLATE_CATALOG.find(item => item.theme === input.theme && item.scene === input.scene);
  if (compatible) {
    return { ...compatible, educationalGoal: input.educationalGoal || compatible.educationalGoal };
  }

  return {
    id: 'tpl_dynamic',
    name: `${input.theme}·${input.scene}绘本`,
    cover: '',
    ageGroup: `${input.age}岁`,
    theme: input.theme,
    educationalGoal: input.educationalGoal,
    scene: input.scene,
    mainCharacter: character,
    duration: input.duration.startsWith('long_') ? 'long' : (input.duration as 'short' | 'medium' | 'long'),
    description: `围绕${input.theme}主题，在${input.scene}中帮助孩子${input.educationalGoal}。`,
    isRecommended: false,
    useCount: 0,
    visualStyle: { ...DEFAULT_STYLE, palette: themeProfile.palette, lighting: '柔和、有层次且突出角色表情的儿童友好光线' },
    coverPromptSeed: COVER_SEED,
    contentPromptSeed: CONTENT_SEED,
    chapterBeats: [themeProfile.arc, `在${sceneProfile.setting}中遇到具体情节`, `通过行动完成${input.educationalGoal}`, '回到安全温暖的情绪落点'],
  };
}

export function buildStoryTextPrompt(input: StoryPromptInput, template: StorybookTemplateDefinition, expectedChapters: number, durationDesc: string): string {
  const scene = getSceneProfile(input.scene);
  const theme = getThemeProfile(input.theme);
  const characters = input.characters.map((char, index) => `角色 #${index + 1}：${char.name || '无名小伙伴'}，身份/角色：${char.role || '小伙伴'}，性格：${char.personality || '活泼可爱'}${char.customDescription ? `，补充描述：${char.customDescription}` : ''}`).join('\n');
  return `You are an expert children's picture-book author. Write in Chinese for a ${input.age}-year-old child.
主题：${input.theme}；教育目标：${input.educationalGoal}；场景：${input.scene}。
整体情绪：${theme.mood}。场景设定：${scene.setting}，可使用${scene.details}作为安全、可爱的画面细节。
角色设定：
${characters || '主角是一位勇敢可爱的小宝贝。'}
模板叙事节奏：${template.chapterBeats.join(' → ')}。
时长要求：${durationDesc}，请严格返回 ${expectedChapters} 个章节。
保持语言温暖、具体、积极，避免说教，让教育目标通过角色的选择和行动自然呈现。
只返回 JSON，不要 Markdown 代码块，结构必须是：
{"title":"中文故事名","abstract":"1-2句故事简介","chapters":[{"chapterNumber":1,"title":"章节标题","text":"章节正文"}]}
注意：这里仅生成故事文字，不生成封面提示词，也不生成内页图片提示词。图片提示词由系统使用独立策略生成。`;
}

export function buildCoverImagePrompt(
  input: StoryPromptInput,
  story: { title: string; abstract: string },
  template: StorybookTemplateDefinition,
): string {
  const theme = getThemeProfile(input.theme);
  const scene = getSceneProfile(input.scene);
  const character = getPrimaryCharacter(input);
  return `Create an attractive portrait children's picture-book COVER, not an interior page.
Story title concept: ${story.title}. Story premise: ${story.abstract}.
Theme: ${input.theme}; overall atmosphere: ${theme.mood}; setting: ${scene.setting}.
Main character: ${character.name}, ${character.role}, ${character.personality}.
Cover strategy: ${template.coverPromptSeed}; establish one memorable focal character and the overall story mood, with an inviting composition, clear silhouette, layered depth, and a visual hook that makes a child want to open the book.
Visual style: ${template.visualStyle.medium}; palette: ${template.visualStyle.palette}; lighting: ${template.visualStyle.lighting}.
Do not depict a specific chapter event. Keep the character design consistent for future pages: ${template.visualStyle.characterContinuity}.
No text, no title, no letters, no logo, no watermark, no scary or violent elements.`;
}

export function buildTemplateCoverPrompt(template: StorybookTemplateDefinition): string {
  return `Create a portrait children's picture-book template cover for the theme "${template.theme}" in the setting "${template.scene}".
Template concept: ${template.name}. Educational direction: ${template.educationalGoal}.
Main character: ${template.mainCharacter.name}, ${template.mainCharacter.role}, ${template.mainCharacter.personality}.
Cover composition: ${template.coverPromptSeed}; show the whole-book atmosphere and a clear lovable focal character, with magical depth and an inviting sense of adventure. Do not depict a specific chapter event.
Visual style: ${template.visualStyle.medium}; palette: ${template.visualStyle.palette}; lighting: ${template.visualStyle.lighting}.
Keep the character design clean and reusable for interior pages: ${template.visualStyle.characterContinuity}.
No text, no title, no letters, no logo, no watermark, no scary or violent elements.`;
}

export function buildChapterImagePrompt(
  input: StoryPromptInput,
  chapter: { chapterNumber: number; title: string; text: string },
  template: StorybookTemplateDefinition,
): string {
  const scene = getSceneProfile(input.scene);
  const character = getPrimaryCharacter(input);
  return `Create an interior children's picture-book illustration for chapter ${chapter.chapterNumber}, not a cover.
Chapter title: ${chapter.title}.
Chapter action and emotional beat: ${chapter.text}.
Setting: ${scene.setting}; supporting details: ${scene.details}.
Content-page strategy: ${template.contentPromptSeed}; focus on the concrete action, character expression, and plot progression in this chapter rather than summarizing the whole story.
Main character: ${character.name}, ${character.role}. Preserve the exact design from the cover: ${template.visualStyle.characterContinuity}.
Match the cover's visual language with ${template.visualStyle.medium}; use palette ${template.visualStyle.palette} and lighting ${template.visualStyle.lighting}.
Use a readable landscape or square story-page composition with foreground action and a calm, safe background.
No text, no title, no letters, no logo, no watermark, no scary or violent elements.`;
}
