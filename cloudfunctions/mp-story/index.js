// 云函数 mp-story：故事文本生成 / 有声故事生成（异步任务）/ 收藏改名删除
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const {
  getOpenid, ensureUser, getUserState, getRights, setRights,
  listVoices, addStory, getStory, updateStory, deleteStory,
  addNotification, listNotifications, recordQuota, incrStats, addJob, getJob, getJobRaw, updateJob, addAsset,
  getSensitiveConfig, pushAuditLog, queryAll, getStoryConfig,
  getAuthorById, getAuthors,
} = require('./common/db');
const { generateText: stepfunGenerateText, generateImage, synthesizeSpeech, logApiCall } = require('./common/stepfun');
const { processCoverImage, processChapterImage, resolveUrls } = require('./common/storage');
const { getBgmList } = require('./common/bgm');
const { runSafetyCheck, getChildFriendlyReplacement, genId, genSafetyAuditLog, sha256Hex } = require('./common/util');
const { buildStoryTextPrompt, buildCoverImagePrompt, buildChapterImagePrompt, getStorybookTemplate, STORYBOOK_TEMPLATE_CATALOG, ensureStoryConfig } =
  require('./common/storybook');

// 离线兜底故事（与 sever.ts generateFallbackStory 一致）
// 注意：此分支仅在 AI 文本/图像服务全部不可用时触发；封面与章节图一律留空，绝不使用库存图伪装成 AI 输出
function generateFallbackStory(theme, educationalGoal, scene, charName, duration, age) {
  const isCustomLong = duration && duration.startsWith('long_');
  const chapterCount = duration === 'short' ? 3 : duration === 'medium' ? 4 : 5;
  const titles = ['第一章：神奇的冒险起程', '第二章：遇到奇妙的新朋友', '第三章：发现神秘的线索', '第四章：智慧与勇气的考验', '第五章：满载而归的甜梦'];
  const storyTemplates = {
    '睡前安抚': [
      `今天晚上格外宁静，在温暖的${scene}里，可爱的小${charName}伸了个懒腰。夜空中洒满了亮晶晶的星星屑，像给大地盖上了一层软绵绵的毯子。${charName}想给今晚入睡的小伙伴找一个最温和的梦，于是它带上了一只金色的小网兜，轻轻划起了梦境的小木船。`,
      `划呀划，${charName}在云朵后面遇到了一只发光的小睡熊。小睡熊正用呼噜声吹着彩色的泡泡，每个泡泡里都装着一段甜甜的歌声。${charName}小心翼翼地捧起一个草莓味的唱歌泡泡。小睡熊笑着说：『把这个带去，听了的孩子都会快乐地睡着哦。』`,
      `${charName}又在夜航的终点，在月亮婆婆慈祥的注视下，把温热的月光星星揉进云絮里。它对熟睡中的孩子耳语：『不用怕黑，晚风是我的歌，星光是我的眼，我们会一直陪伴着你入睡。』宝贝翻了个身，抱紧小熊，香甜地进入了梦乡。`,
    ],
    '勇敢与自信': [
      `在美丽的${scene}中，小主角${charName}有一个大大的梦想。尽管它总是觉得自己不够完美、有点胆怯，但面对同伴们的期待，它握紧拳头，决定在今天开启勇敢的探索之旅。风在耳边呼呼作响，像是在说：『${charName}，你一定可以做到的！』`,
      `在半路上，山谷的吊桥断了。大家都害怕得不敢向前，只有${charName}仔细地观察。它发现旁边的坚固藤蔓可以荡过去！它克服了心里的恐惧，深吸一口气，带头拉着藤蔓划过了彩虹深渊。大家纷纷欢呼，${charName}的胸膛挺得高高的，它发现原来自己如此勇敢。`,
      `战胜困难的${charName}不仅找到了宝藏，更收获了沉甸甸的自信。它微笑着告诉大家，真正的勇敢不是不害怕，而是害怕的时候依然能坚持。今天它成功实现了『${educationalGoal}』的目标，也给所有小朋友带来了无比的勇气。`,
    ],
  };
  const defaultStoryLines = storyTemplates[theme] || [
    `在神奇的${scene}里，居住着开朗活泼的${charName}。今天它要达成一个了不起的教育目标：『${educationalGoal}』！它带上自己的奇思妙想，向着未知的彩虹山谷深处进发，脚步轻快，周围的花儿都在为它起舞。`,
    `在旅途中，${charName}遇到了一个神奇的彩虹松鼠。松鼠在树上蹦蹦跳跳，正在为寻找一颗迷路的橡果发愁。${charName}开动脑筋，用树叶做了一个滑梯，成功帮松鼠拿到了橡果。松鼠感激地拍拍手，告诉它：只要心怀善意，到处都是魔法。`,
    `终于，${charName}回到了最初的起点，圆满达成了它的任务。大家都为它欢呼，夸奖它是个聪明、懂得『${educationalGoal}』的优秀宝宝。夜色渐深，${charName}钻进温暖的被窝，闭上眼睛，为自己和全天下的小朋友祈祷一个奇妙温暖的美梦。`,
  ];
  const chapters = Array.from({ length: chapterCount }).map((_, index) => ({
    chapterNumber: index + 1,
    title: titles[index] || `第${index + 1}章：精彩继续`,
    text: defaultStoryLines[index] || defaultStoryLines[defaultStoryLines.length - 1],
    imageUrl: '',
    imagePrompt: `A children's storybook illustration showing ${charName} in the style of soft digital pastel in ${scene} scene.`,
  }));
  return {
    title: `神奇${theme}之：${charName}的${scene}奇遇记`,
    abstract: `这是一个专为${age}岁宝宝定制的《${theme}》故事，在美丽的《${scene}》里，通过主角《${charName}》的生动冒险，潜移默化地引导孩子学习《${educationalGoal}》，具有极强的陪伴感和温情。`,
    chapters,
    coverUrl: '',
  };
}

// 将故事中所有 cloud:// fileID 解析为临时 URL
async function resolveStoryUrls(story) {
  if (!story) return story;
  const ids = [];
  if (story.coverUrl && story.coverUrl.startsWith('cloud://')) ids.push(story.coverUrl);
  (story.chapters || []).forEach(ch => {
    if (ch.imageUrl && ch.imageUrl.startsWith('cloud://')) ids.push(ch.imageUrl);
    if (ch.audioUrl && ch.audioUrl.startsWith('cloud://')) ids.push(ch.audioUrl);
    (ch.audioUrls || []).forEach(u => { if (u && u.startsWith('cloud://')) ids.push(u); });
  });
  if (ids.length === 0) return story;
  const map = await resolveUrls(ids);
  if (story.coverUrl && map[story.coverUrl]) story.coverUrl = map[story.coverUrl];
  (story.chapters || []).forEach(ch => {
    if (ch.imageUrl && map[ch.imageUrl]) ch.imageUrl = map[ch.imageUrl];
    if (ch.audioUrl && map[ch.audioUrl]) ch.audioUrl = map[ch.audioUrl];
    if (ch.audioUrls && ch.audioUrls.length) ch.audioUrls = ch.audioUrls.map(u => map[u] || u);
  });
  return story;
}

// StepFun stepaudio-2.5-tts 单次输入硬上限 1000 字符；留余量用 950
const TTS_CHAR_LIMIT = 950;

// 把长文本按句末标点切分为 ≤limit 字符的片段（不截断词语）。
// 单句超长则按 limit 硬切，避免一次性超长请求被 StepFun 拒绝（20 分钟故事单章常超 1000 字）。
function splitTextByLimit(text, limit = TTS_CHAR_LIMIT) {
  if (!text || text.length === 0) return [];
  if (text.length <= limit) return [text];
  const segs = [];
  let cur = '';
  const parts = text.split(/(?<=[。！？；…\n.!?;])/);
  for (const p of parts) {
    if ((cur + p).length > limit) {
      if (cur) { segs.push(cur); cur = ''; }
      if (p.length > limit) {
        for (let i = 0; i < p.length; i += limit) segs.push(p.slice(i, i + limit));
      } else {
        cur = p;
      }
    } else {
      cur += p;
    }
  }
  if (cur) segs.push(cur);
  return segs.filter(Boolean);
}

// ============ 文本生成 ============
async function generateText(openid, event) {
  const { theme, educationalGoal, scene, mainCharacter, duration, age, isRetry, templateId, targetAgeRange, authorId } = event;
  await ensureStoryConfig(); // 保证生成前已从数据库加载最新主题/场景配置（方案 B 单一数据源）
  const userState = await getUserState(openid);
  const sensitive = await getSensitiveConfig();
  // 解析故事作者（后台可维护；不存在时回退为默认风格，不影响生成）
  const author = authorId ? await getAuthorById(authorId) : null;

  // 输入安全校验（按字段独立扫描，便于前端一键改写定位）
  const mainCharacters = event.mainCharacters || (mainCharacter ? [mainCharacter] : []);
  const inputFields = [
    { path: 'theme', value: theme || '' },
    { path: 'educationalGoal', value: educationalGoal || '' },
    { path: 'scene', value: scene || '' },
  ];
  mainCharacters.forEach((char, idx) => {
    inputFields.push({ path: `mainCharacters[${idx}].name`, value: char.name || '' });
    inputFields.push({ path: `mainCharacters[${idx}].role`, value: char.role || '' });
    inputFields.push({ path: `mainCharacters[${idx}].personality`, value: char.personality || '' });
    inputFields.push({ path: `mainCharacters[${idx}].customDescription`, value: char.customDescription || '' });
  });
  const inputsToScan = inputFields.map(f => f.value).filter(Boolean).join(' ');
  let inputSafety = null;
  let hitField = null;
  for (const field of inputFields) {
    if (!field.value) continue;
    const hit = runSafetyCheck(field.value, sensitive);
    if (hit) { inputSafety = hit; hitField = field; break; }
  }
  if (inputSafety) {
    await pushAuditLog(genSafetyAuditLog('input_check', inputsToScan, inputSafety.category, inputSafety.categoryName, inputSafety.blocked ? 'intercept' : 'rewrite',
      inputSafety.word, inputSafety.replacedText,
      `用户设定含敏感词『${inputSafety.word}』，处理方式：${inputSafety.blocked ? '直接拦截' : '儿童友好改写建议'}`));
    if (inputSafety.blocked) {
      return { safetyBlocked: true, category: inputSafety.category, categoryName: inputSafety.categoryName, word: inputSafety.word,
        fieldPath: hitField.path, originalValue: hitField.value,
        message: `⚠️ 伴梦儿童安全守护拦截：检测到您输入的故事设定包含 [${inputSafety.categoryName}] 相关的敏感词汇（『${inputSafety.word}』），已被系统安全拦截。本次生成不消耗额度，请使用绿色、温馨、适合儿童的词汇重试！` };
    } else if (inputSafety.rewrite) {
      return { safetyRewriteSuggestion: true, category: inputSafety.category, categoryName: inputSafety.categoryName, word: inputSafety.word,
        fieldPath: hitField.path, originalValue: hitField.value, replacedValue: inputSafety.replacedText,
        message: `✨ 伴梦温馨安全改写建议：我们发现您的故事设定中包含了词汇『${inputSafety.word}』（涉及：${inputSafety.categoryName}），可能对宝宝有些敏感不适。我们温馨建议您将设定改写为：【${inputSafety.suggestion}】，让故事更温和、治愈和正能量。本次生成不扣除您的故事额度哦！` };
    }
  }

  // 额度校验
  const rights = userState.rights;
  if (!rights.isVip && rights.storyGenerationsRemaining <= 0) {
    return { error: '您当前的故事额度已用尽。请前往兑换激活码或邀请好友获得奖励！' };
  }

  // 扣额度
  let consumed = false;
  if (!rights.isVip) {
    if (isRetry) {
      if (event.retryCount && event.retryCount > 1) {
        rights.storyGenerationsRemaining -= 1; consumed = true;
        await recordQuota(openid, { id: genId('qle'), userId: openid, resourceType: 'story_generation', amount: -1, reason: '文本故事生成(重试)', balanceAfter: rights.storyGenerationsRemaining, createdAt: new Date().toISOString() });
      }
    } else {
      rights.storyGenerationsRemaining -= 1; consumed = true;
      await recordQuota(openid, { id: genId('qle'), userId: openid, resourceType: 'story_generation', amount: -1, reason: '文本故事生成', balanceAfter: rights.storyGenerationsRemaining, createdAt: new Date().toISOString() });
    }
    await setRights(openid, rights);
  }

  let charactersPrompt = '';
  let primaryCharName = '淘淘';
  if (mainCharacters.length > 0) {
    primaryCharName = mainCharacters.map(c => c.name || '宝贝').filter(Boolean).join('和') || '小宝贝';
    charactersPrompt = mainCharacters.map((char, index) => {
      const num = index + 1;
      if (char.isCustomDescription) return `角色 #${num} (完全自定义主人公描述): 名字叫 "${char.name || '无名主人公'}"，描述: "${char.customDescription || '一个神秘可爱的小伙伴'}".`;
      return `角色 #${num}: 名字叫 "${char.name || '无名主人公'}"，种族/身份是 "${char.role || '小角色'}"，性格特征是 "${char.personality || '活泼可爱'}"`;
    }).join('\n');
  } else {
    const charName = mainCharacter?.name || '小宝贝';
    const charRole = mainCharacter?.role || '勇敢的探险家';
    const charPersonality = mainCharacter?.personality || '聪明活泼';
    primaryCharName = charName;
    charactersPrompt = `主角名字叫 "${charName}"，种族/身份是 "${charRole}"，性格特征是 "${charPersonality}"`;
  }

  let durationDesc = '';
  let expectedChapters = 3;
  if (duration === 'short') { durationDesc = '短篇 (约3分钟，包含3个章节，每个章节约100-150字)'; expectedChapters = 3; }
  else if (duration === 'medium') { durationDesc = '中篇 (约5分钟，包含4个章节，每个章节约150-180字)'; expectedChapters = 4; }
  else if (duration && duration.startsWith('long_')) {
    const mins = duration.split('_')[1]?.replace('m', '') || '10';
    durationDesc = `长篇 (自定义时长为 ${mins} 分钟，包含5个章节，请让每个章节文字更长、生动细致，包含约250-350字)`; expectedChapters = 5;
  } else { durationDesc = '长篇 (约8分钟，包含5个章节，每个章节约180-220字)'; expectedChapters = 5; }

  const storyPromptInput = { templateId, theme: theme || '睡前安抚', educationalGoal: educationalGoal || '情绪放松', scene: scene || '温馨家庭', age: Number(age) || 4, duration: duration || 'short', characters: mainCharacters, targetAgeRange: targetAgeRange || '', authorId: authorId || '', authorName: author?.name || '', authorIdentity: author?.identity || '', authorStyle: author?.style || '' };
  const storybookTemplate = getStorybookTemplate(storyPromptInput);
  const systemPrompt = buildStoryTextPrompt(storyPromptInput, storybookTemplate, expectedChapters, durationDesc);

  // 提示词二次安全校验
  const promptSafety = runSafetyCheck(systemPrompt, sensitive);
  if (promptSafety && promptSafety.blocked) {
    await pushAuditLog(genSafetyAuditLog('prompt_check', systemPrompt, promptSafety.category, promptSafety.categoryName, 'intercept',
      promptSafety.word, '', `系统整合提示词中包含敏感词『${promptSafety.word}』，触发二次防御自动拦截。`));
    if (!rights.isVip && consumed) {
      rights.storyGenerationsRemaining += 1;
      await recordQuota(openid, { id: genId('qle'), userId: openid, resourceType: 'refund', amount: 1, reason: '安全拦截退款(提示词)', balanceAfter: rights.storyGenerationsRemaining, createdAt: new Date().toISOString() });
      await setRights(openid, rights);
    }
    return { safetyBlocked: true, category: promptSafety.category, categoryName: promptSafety.categoryName, word: promptSafety.word,
      message: `⚠️ 伴梦二次系统防护：系统生成的绘本大模型提示词中包含不适合儿童的词汇（『${promptSafety.word}』），已被系统强制拦截防御。不扣除额度！` };
  }

  let generatedStory = await stepfunGenerateText(systemPrompt, `主题《${theme}》的精彩童话故事《${primaryCharName}在${scene}的奇遇记》`);

  // 封面图与内页图提示词：独立策略（封面=焦点角色/整体氛围；内页=当前章节动作/情节推进）
  if (generatedStory) {
    // 封面：只有 StepFun 真实生成成功才写入 coverUrl；绝不用库存图伪装成 AI 输出
    // 封面：必须 AI 生成，重试 3 次（绝不用库存图兜底）
    let coverUrl = '';
    for (let attempt = 1; attempt <= 3 && !coverUrl; attempt++) {
      const u = await generateImage(buildCoverImagePrompt(storyPromptInput, { title: generatedStory.title, abstract: generatedStory.abstract }, storybookTemplate));
      if (u) coverUrl = u;
    }
    generatedStory.coverUrl = coverUrl;  // 失败留空，generateAudio 阶段用 coverPrompt 补救
    generatedStory.chapters = generatedStory.chapters.map((ch, idx) => ({
      ...ch,
      imagePrompt: buildChapterImagePrompt(storyPromptInput, ch, storybookTemplate),
      // 内页图：只在真实生成后回填，默认空，绝不把库存图伪装成 AI 输出
      imageUrl: '',
    }));
    generatedStory.coverPrompt = buildCoverImagePrompt(storyPromptInput, { title: generatedStory.title, abstract: generatedStory.abstract }, storybookTemplate);
    generatedStory.templateId = storybookTemplate.id;
    generatedStory.visualStyle = storybookTemplate.visualStyle;
    // 作者与适用年龄随草稿透传至有声生成阶段（落库字段）
    generatedStory.authorId = storyPromptInput.authorId;
    generatedStory.authorName = storyPromptInput.authorName;
    generatedStory.targetAgeRange = storyPromptInput.targetAgeRange;
  }

  // 最终兜底
  if (!generatedStory) {
    generatedStory = generateFallbackStory(theme, educationalGoal, scene, primaryCharName, duration, age);
    logApiCall('/api/story/generate-text', 'POST', 200, 'Offline Fallback', 220, 0, 'Used offline fallback generator');
  }

  // 生成内容二次安全校验
  if (generatedStory) {
    let textToScan = (generatedStory.title || '') + ' ' + (generatedStory.abstract || '');
    (generatedStory.chapters || []).forEach(ch => { textToScan += ' ' + (ch.title || '') + ' ' + (ch.text || ''); });
    const outputSafety = runSafetyCheck(textToScan, sensitive);
    if (outputSafety) {
      await pushAuditLog(genSafetyAuditLog('post_check', textToScan, outputSafety.category, outputSafety.categoryName, outputSafety.blocked ? 'intercept' : 'rewrite',
        outputSafety.word, outputSafety.replacedText, `生成故事含敏感词『${outputSafety.word}』，触发二次安全防护。`));
      if (outputSafety.blocked) {
        if (!rights.isVip && consumed) {
          rights.storyGenerationsRemaining += 1;
          await recordQuota(openid, { id: genId('qle'), userId: openid, resourceType: 'refund', amount: 1, reason: '安全拦截退款(生成内容)', balanceAfter: rights.storyGenerationsRemaining, createdAt: new Date().toISOString() });
          await setRights(openid, rights);
        }
        return { safetyBlocked: true, category: outputSafety.category, categoryName: outputSafety.categoryName, word: outputSafety.word,
          message: `⚠️ 伴梦生成内容安全防御拦截：大模型生成的故事内容中意外包含涉及 [${outputSafety.categoryName}] 的敏感词汇（『${outputSafety.word}』）。该故事已被彻底拦截，不予保存、展示或播放。本次生成不扣除次数！` };
      } else if (outputSafety.rewrite) {
        const wordRegex = new RegExp(outputSafety.word, 'gi');
        generatedStory.title = (generatedStory.title || '').replace(wordRegex, '温暖小故事');
        generatedStory.abstract = (generatedStory.abstract || '').replace(wordRegex, '一个充满温馨和爱的小伙伴冒险故事');
        generatedStory.chapters = generatedStory.chapters.map(ch => ({
          ...ch,
          title: (ch.title || '').replace(wordRegex, '温暖的小瞬间'),
          text: (ch.text || '').replace(wordRegex, '开心地手拉手唱歌做游戏'),
        }));
      }
    }
  }

  // 清洗 AI 生成内容中的 undefined 模板残留
  if (generatedStory) {
    const clean = s => (s || '').replace(/undefined/g, '').replace(/\s{2,}/g, ' ').trim();
    generatedStory.title = clean(generatedStory.title) || '未命名故事';
    generatedStory.abstract = clean(generatedStory.abstract);
    (generatedStory.chapters || []).forEach(ch => {
      ch.title = clean(ch.title);
      ch.text = clean(ch.text);
    });
  }

  await incrStats('textStoriesGenerated', 1);
  const newRights = await getRights(openid);
  return { success: true, story: generatedStory, rights: newRights, consumed };
}

// ============ 有声故事生成（同步完成） ============
async function generateAudio(openid, event) {
  const { story, voiceId, voiceMode, theme, educationalGoal, scene, mainCharacterName, duration, targetAge, bgmType } = event;
  if (!story) return { error: 'No story data provided.' };
  // 作者/适用年龄优先取草稿故事自身携带（generateText 已写入），否则回退 event 级
  const authorId = story?.authorId || event.authorId || '';
  const authorName = story?.authorName || event.authorName || '';
  const targetAgeRange = story?.targetAgeRange || event.targetAgeRange || '';
  const userState = await getUserState(openid);
  // 清洗标题中的 undefined / 模板残留（AI 偶发模板变量未填充）
  const rawTitle = (story.title || '未命名故事').replace(/undefined/g, '').replace(/\s{2,}/g, ' ').trim();
  const storyTitle = rawTitle || '未命名故事';
  const inputHash = sha256Hex((story.chapters || []).map(c => c.text || '').join('\n') + '|' + (voiceId || ''));

  // 去重：仅当已存在「音频真正就绪」的同参数故事才返回缓存。
  // 失败的(401等)或「有图无音」(isAudioReady:false)的故事绝不能当缓存返回，
  // 否则用户重新生成相同参数会一直拿到没声音的旧故事。
  const jobs = await queryAll('generationJobs', { openid });
  const audioReadyJob = jobs.find(j => j.inputHash === inputHash && j.status === 'ready' && j.resultStoryId);
  if (audioReadyJob) {
    const cachedStory = await getStory(openid, audioReadyJob.resultStoryId);
    if (cachedStory && cachedStory.isAudioReady) {
      const resolved = await resolveStoryUrls(cachedStory);
      return { success: true, deduplicated: true, jobId: audioReadyJob._id, jobStatus: 'ready', savedStory: resolved, voiceClones: userState.voiceClones, notifications: userState.notifications };
    }
  }
  const running = jobs.find(j => j.inputHash === inputHash && !['ready', 'failed'].includes(j.status));
  if (running) {
    return { success: true, inProgress: true, jobStatus: running.status, jobId: running.id };
  }

  // 扣声纹使用次数
  if (voiceId) {
    const voice = (userState.voiceClones || []).find(v => v.id === voiceId);
    if (voice) voice.usageCount = (voice.usageCount || 0) + 1;
  }

  const storyId = 'story_' + Date.now();
  const job = {
    _id: genId('job'), openid, inputHash, storyTitle, storyAbstract: story.abstract || '',
    coverUrl: story.coverUrl || '', chapters: [...(story.chapters || [])],
    voiceId: voiceId || 'voice_default_mom', voiceMode: voiceMode || 'single', bgmType: bgmType || 'none',
    theme: theme || '睡前安抚', educationalGoal: educationalGoal || '习惯养成', scene: scene || '家庭卧室',
    mainCharacterName: mainCharacterName || '主角', duration: duration || 'short', targetAge: targetAge || 4,
    targetAgeRange, authorId, authorName,
    status: 'queued', progress: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  await addJob(job);

  try {
    // 1. 封面图：必须 AI 生成，绝不用库存图兜底
    job.status = 'compressing'; job.progress = 10; await updateJob(job._id, { status: job.status, progress: job.progress });
    let finalCoverUrl = '';
    // 优先用 generateText 阶段已生成的封面 URL；缺失则用 coverPrompt 现场 AI 重新生成（重试 3 次）
    let coverSourceUrl = (typeof story.coverUrl === 'string' && /^https?:\/\//i.test(story.coverUrl)) ? story.coverUrl : null;
    if (!coverSourceUrl && story.coverPrompt) {
      for (let attempt = 1; attempt <= 3 && !coverSourceUrl; attempt++) {
        const u = await generateImage(story.coverPrompt);
        if (u) coverSourceUrl = u;
      }
    }
    if (coverSourceUrl) {
      for (let attempt = 1; attempt <= 3 && !finalCoverUrl; attempt++) {
        const cover = await processCoverImage(coverSourceUrl, openid);
        if (cover.status === 'ready') finalCoverUrl = cover.fileID;
      }
    }
    // 2. 章节图（必须 AI 生成 + 上传云存储，重试 3 次）
    const processedChapters = await Promise.all((story.chapters || []).map(async ch => {
      let imageUrl = ch.imageUrl || '';
      // 2a. 若 imageUrl 为空但有 imagePrompt（generateText 已构建），调用 StepFun 生成章节插图
      if (!imageUrl && ch.imagePrompt) {
        for (let attempt = 1; attempt <= 3 && !imageUrl; attempt++) {
          const aiUrl = await generateImage(ch.imagePrompt);
          if (aiUrl) imageUrl = aiUrl;
        }
      }
      // 2b. 有 https URL 则上传到云存储（统一走 processChapterImage，失败重试）
      if (/^https?:\/\//i.test(imageUrl)) {
        for (let attempt = 1; attempt <= 3 && /^https?:\/\//i.test(imageUrl); attempt++) {
          const img = await processChapterImage(imageUrl, openid);
          if (img.status === 'ready') { imageUrl = img.fileID; break; }
        }
      }
      return { ...ch, imageUrl };
    }));
    job.progress = 25; await updateJob(job._id, { progress: job.progress });

    // 3. 确定 StepFun 音色（必须为 StepFun 真实 voice-id，见 platform.stepfun.com 音色列表）
    //    默认：妈妈温柔女声 wenrounvsheng；爸爸：磁性男声 cixingnansheng
    let voiceParam = 'wenrounvsheng';
    const activeClone = (userState.voiceClones || []).find(v => v.id === voiceId);
    if (activeClone) {
      if (activeClone.stepfunSucceeded && activeClone.stepfunVoiceId) voiceParam = activeClone.stepfunVoiceId;
      else if (activeClone.speakerType === 'father') voiceParam = 'cixingnansheng';
    } else if (voiceId === 'voice_default_dad') voiceParam = 'cixingnansheng';

    // 4. TTS 合成（每章按 ≤1000 字符再细切，逐段合成上传；单段/单章失败不影响其他）
    job.status = 'tts_generating'; job.progress = 40; await updateJob(job._id, { status: job.status, progress: job.progress });
    let succeededCount = 0;
    let failedChapters = [];
    const totalChapters = processedChapters.length;
    const storage = require('./common/storage');
    const audioChapters = await Promise.all(processedChapters.map(async (chapter, idx) => {
      const segments = splitTextByLimit(chapter.text || '', TTS_CHAR_LIMIT);
      if (segments.length === 0) {
        failedChapters.push(idx + 1);
        return chapter;
      }
      console.log(`[TTS] Chapter ${idx + 1}/${totalChapters}, textLen=${(chapter.text || '').length}, segments=${segments.length}`);
      const segFileIDs = [];
      let chapterSize = 0;
      // 单章内逐段串行，避免触发 StepFun 并发限流
      for (let s = 0; s < segments.length; s++) {
        try {
          const buf = await synthesizeSpeech(segments[s], voiceParam);
          if (!buf) { console.error(`[TTS] Chapter ${idx + 1} seg ${s + 1} null buffer`); continue; }
          const filename = `${storyId}_ch_${idx}_seg_${s}.mp3`;
          const cloudPath = `audio/${openid}/${filename}`;
          const fileID = await storage.uploadBuffer(buf, cloudPath);
          const audioAsset = { id: 'aud_' + Date.now() + '_' + idx + '_' + s, openid, kind: 'audio', storageKey: cloudPath, fileID, mimeType: 'audio/mpeg', sizeBytes: buf.length, status: 'ready', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          await addAsset(audioAsset);
          segFileIDs.push(fileID);
          chapterSize += buf.length;
        } catch (segErr) {
          console.error(`[TTS] Chapter ${idx + 1} seg ${s + 1} exception:`, segErr.message);
        }
      }
      if (segFileIDs.length === 0) {
        failedChapters.push(idx + 1);
        return chapter;
      }
      succeededCount++;
      return { ...chapter, audioUrl: segFileIDs[0], audioUrls: segFileIDs, audioAssetId: null, audioSizeBytes: chapterSize };
    }));
    job.progress = 75; await updateJob(job._id, { progress: job.progress });

    const allReady = audioChapters.length > 0 && audioChapters.every(ch => (ch.audioUrls && ch.audioUrls.length > 0) || !!ch.audioUrl);
    const completeStory = {
      _id: storyId, openid, title: storyTitle, abstract: story.abstract, chapters: audioChapters,
      coverUrl: finalCoverUrl, isAudioReady: allReady, voiceId: voiceId || 'voice_default_mom',
      voiceMode: voiceMode || 'single', createTime: new Date().toISOString(), isSavedToDiary: true, isFavorite: false,
      theme: theme || '睡前安抚', educationalGoal: educationalGoal || '习惯养成', scene: scene || '家庭卧室',
      mainCharacterName: mainCharacterName || '主角', duration: duration || 'short', targetAge: targetAge || 4, bgmType: bgmType || 'none',
      targetAgeRange, authorId, authorName,
    };
    await addStory(completeStory);
    await incrStats('audioStoriesGenerated', 1);
    await incrStats('storiesSavedCount', 1);
    // 绘本图必须全部 AI 生成成功（封面 + 每一章），否则整体 failed（用户要求：绝不用库存图兜底）
    // 配音(TTS)失败仅影响声音，不影响「可看」
    const coverOk = !!finalCoverUrl;
    const chaptersOk = (story.chapters || []).length > 0 && processedChapters.every(ch => !!ch.imageUrl);
    const visualOk = coverOk && chaptersOk;
    job.status = visualOk ? 'ready' : 'failed'; job.resultStoryId = storyId; job.progress = 100; job.updatedAt = new Date().toISOString();
    await updateJob(job._id, { status: job.status, resultStoryId: storyId, progress: 100, updatedAt: job.updatedAt });

    // 仅「图 + 配音」全部成功时发通知；图缺失或配音失败均不发（避免误导用户）
    if (allReady && visualOk) {
      await addNotification(openid, {
        id: 'notif_' + Date.now(), title: `专属有声故事《${storyTitle}》已入库`,
        content: '已成功生成所有章节音频，保存在宝宝的故事日记本中。',
        type: 'story', isRead: false, createdAt: new Date().toISOString(),
      });
    }
    const finalSvc = succeededCount > 0 ? `Stepfun stepaudio-2.5-tts (${succeededCount}个章节)` : 'Cosmic TTS v2 Synthesizer';
    logApiCall('/api/story/generate-audio', 'POST', 200, finalSvc, succeededCount > 0 ? 1500 + succeededCount * 300 : 820, succeededCount * 120, `TTS合成完成，配音章节数: ${succeededCount}`);

    const resolved = await resolveStoryUrls(completeStory);
    return { success: true, inProgress: true, jobId: job._id, jobStatus: job.status, savedStory: resolved, voiceClones: userState.voiceClones, notifications: await listNotifications(openid) };
  } catch (err) {
    job.status = 'failed'; job.errorMessage = err.message || 'Unknown error'; job.progress = 100; job.updatedAt = new Date().toISOString();
    await updateJob(job._id, { status: job.status, errorMessage: job.errorMessage, progress: 100, updatedAt: job.updatedAt });
    // 区分超时 vs 业务错误：CloudBase 超时错误特征
    const isTimeout = /timeout|TimeLimitExceeded|Task timed out/i.test(err.message);
    return {
      success: false,
      error: isTimeout
        ? '故事太长导致合成超时（24分钟故事需要更多时间），请点击"重新合成"重试'
        : '音频生成失败：' + (err.message || 'unknown'),
      isTimeout: !!isTimeout,
    };
  }
}

async function audioStatus(openid, jobId) {
  const job = await getJob(openid, jobId);
  if (!job) return { error: '音频任务不存在' };
  const progressByStatus = { queued: 0, compressing: 25, tts_generating: 60, mixing: 90, ready: 100, failed: 100 };
  let story;
  if (job.status === 'ready' && job.resultStoryId) {
    story = await getStory(openid, job.resultStoryId);
    if (story) story = await resolveStoryUrls(story);
  }
  return {
    success: true, jobId: job._id, status: job.status,
    progress: job.progress ?? progressByStatus[job.status] ?? 0, error: job.errorMessage, story,
  };
}

exports.main = async (event, context) => {
  const { action } = event;
  // 公开接口：BGM 列表无需登录即可获取（仅元数据 + 云存储解析出的 HTTP 临时 URL）
  if (action === 'getBgmList') return await getBgmList();
  const openid = getOpenid(context);
  if (!openid) return { error: '身份缺失' };
  try {
    switch (action) {
      case 'getStoryConfig':
        return await getStoryConfig();
      case 'getAuthors':
        return { success: true, authors: await getAuthors() };
      case 'getBgmList':
        return await getBgmList();
      case 'generateText':
        return await generateText(openid, event);
      case 'generateAudio':
        return await generateAudio(openid, event);
      case 'audioStatus':
        return await audioStatus(openid, event.jobId);
      case 'saveToggle': {
        const story = await getStory(openid, event.id);
        if (!story) return { error: '故事不存在' };
        const patch = event.type === 'favorite' ? { isFavorite: !story.isFavorite } : { isSavedToDiary: !story.isSavedToDiary };
        const updated = await updateStory(openid, event.id, patch);
        return { success: true, story: updated };
      }
      case 'rename': {
        const updated = await updateStory(openid, event.id, { title: event.title });
        return { success: true, story: updated };
      }
      case 'delete': {
        const ok = await deleteStory(openid, event.id);
        return { success: ok };
      }
      default:
        return { error: 'unknown action: ' + action };
    }
  } catch (err) {
    console.error('[mp-story] error:', err);
    return { error: err.message || 'server error' };
  }
};
