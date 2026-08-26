// 微信小程序云开发（CloudBase）云函数
// 目录位置: /cloudfunctions/generateStory/index.js
// 
// 本云函数直接对接 Stepfun（阶跃星辰）大模型，为小程序前端提供个性化有声童话故事文本生成服务。
// 部署时请在微信开发者工具中“云开发-云函数”控制台配置环境变量：
// - STEPFUN_API_KEY: 您的阶跃星辰 API 密钥
// - STEPFUN_MODEL: 默认使用 "step-3.7-flash" 以获得最佳故事创意与词汇优化

const cloud = require('wx-server-sdk');
const axios = require('axios');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 云函数入口函数
exports.main = async (event, context) => {
  const { 
    theme, 
    educationalGoal, 
    scene, 
    mainCharacters, 
    duration, 
    age 
  } = event;

  // 获取微信云开发后台配置的阶跃星辰 API 密钥，亦可设置 fallback 默认密钥
  const STEPFUN_API_KEY = process.env.STEPFUN_API_KEY || "YOUR_STEPFUN_API_KEY";
  const STEPFUN_MODEL = process.env.STEPFUN_MODEL || "step-3.7-flash";

  if (!STEPFUN_API_KEY || STEPFUN_API_KEY === "YOUR_STEPFUN_API_KEY") {
    return {
      success: false,
      error: "未在云开发控制台中配置有效的 STEPFUN_API_KEY 环境变量。"
    };
  }

  // 构建故事主人公的主题描述
  let charactersPrompt = "";
  let primaryCharName = "宝贝";

  if (Array.isArray(mainCharacters) && mainCharacters.length > 0) {
    primaryCharName = mainCharacters.map(c => c.name || "宝贝").filter(Boolean).join("和") || "小宝贝";
    charactersPrompt = mainCharacters.map((char, index) => {
      const num = index + 1;
      if (char.isCustomDescription) {
        return `角色 #${num} (完全自定义主人公描述): 名字叫 "${char.name || "无名"}"，描述: "${char.customDescription || "一个神秘可爱的小伙伴"}".`;
      } else {
        return `角色 #${num}: 名字叫 "${char.name || "无名"}"，种族/身份是 "${char.role || "小角色"}"，性格特征是 "${char.personality || "活泼可爱"}".`;
      }
    }).join("\n");
  } else {
    charactersPrompt = `主角名字叫 "${primaryCharName}"，种族/身份是 "勇敢的探险家"，性格特征是 "聪明活泼".`;
  }

  // 匹配生成的故事时长篇幅
  let durationDesc = "";
  let expectedChapters = 3;
  if (duration === "short") {
    durationDesc = "短篇 (约3分钟，包含3个章节，每个章节约100-150字)";
    expectedChapters = 3;
  } else if (duration === "medium") {
    durationDesc = "中篇 (约5分钟，包含4个章节，每个章节约150-180字)";
    expectedChapters = 4;
  } else if (duration && duration.startsWith("long_")) {
    const mins = duration.split("_")[1]?.replace("m", "") || "10";
    durationDesc = `长篇 (自定义时长为 ${mins} 分钟，包含5个章节，请让每个章节文字更长、生动细致，包含约250-350字)`;
    expectedChapters = 5;
  } else {
    durationDesc = "长篇 (约8分钟，包含5个章节，每个章节约180-220字)";
    expectedChapters = 5;
  }

  // 严格要求返回 JSON 格式
  const systemPrompt = `You are an expert children's fairy tale book author. Write in Chinese. 
You will write a structured storybook tailored for a kid of age ${age}.
Target educational goal: ${educationalGoal}. Theme: ${theme}. Setting: ${scene}.
Main characters information:
${charactersPrompt}

Length should match "${durationDesc}" duration option. Please return exactly ${expectedChapters} chapters.
Keep language warm, highly descriptive, safe, and positive. Make sure it provides gentle, peaceful sleeping rhythm or active confidence rhythm depending on theme.
IMPORTANT: You MUST return a JSON object with this exact structure:
{
  "title": "String - creative story name in Chinese",
  "abstract": "String - 1-2 sentence description summarizing the story charm",
  "chapters": [
    {
      "chapterNumber": number,
      "title": "String - chapter title",
      "text": "String - around 120-180 Chinese characters for this chapter",
      "imagePrompt": "String - descriptive image prompt in English for generating illustrations (soft watercolor cartoon childbook style, cute, simple details, high contrast, safe for children)"
    }
  ]
}`;

  try {
    // 1. 调用 step-3.7-flash 进行文本生成与提示词优化
    const response = await axios.post('https://api.stepfun.com/v1/chat/completions', {
      model: STEPFUN_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请立即开始创作关于主题《${theme}》的精彩童话故事《${primaryCharName}在${scene}的奇遇》` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.75
    }, {
      headers: {
        'Authorization': `Bearer ${STEPFUN_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30秒超时
    });

    const choice = response.data.choices[0];
    const rawContent = choice.message.content.trim();
    const parsed = JSON.parse(rawContent);

    // 2. 调用 step-image-edit-2 绘制高品质故事封面
    let coverUrl = "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=500&q=80";
    try {
      console.log(`[CloudBase] Generating cover image using step-image-edit-2 for story: ${parsed.title}`);
      const imgResponse = await axios.post('https://api.stepfun.com/v1/images/generations', {
        model: "step-image-edit-2",
        prompt: `A beautiful watercolor children's book cover illustration for a story titled "${parsed.title}". ${parsed.abstract}. Soft lighting, cute pastel style, highly engaging for children, no text or words on image.`,
        size: "1024x1024",
        n: 1
      }, {
        headers: {
          'Authorization': `Bearer ${STEPFUN_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      if (imgResponse.data && imgResponse.data.data && imgResponse.data.data[0] && imgResponse.data.data[0].url) {
        coverUrl = imgResponse.data.data[0].url;
        console.log(`[CloudBase] Cover image generated successfully: ${coverUrl}`);
      }
    } catch (imgError) {
      console.error('[CloudBase] Stepfun Cover Image generation failed, fallback to stock image:', imgError.message);
    }

    // 云开发插画配图占位及兜底
    const illustrationStockImages = [
      "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=500&q=80",
      "https://images.unsplash.com/photo-1495107334309-fcf20504a5ab?w=500&q=80",
      "https://images.unsplash.com/photo-1415604930972-5bc40a5953d8?w=500&q=80",
      "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=500&q=80",
      "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=500&q=80"
    ];

    const generatedStory = {
      title: parsed.title,
      abstract: parsed.abstract,
      coverUrl: coverUrl,
      chapters: parsed.chapters.map((ch, idx) => ({
        ...ch,
        imageUrl: illustrationStockImages[idx % illustrationStockImages.length]
      }))
    };

    return {
      success: true,
      story: generatedStory
    };

  } catch (error) {
    console.error('Stepfun Cloud Function call failed:', error);
    return {
      success: false,
      error: error.response && error.response.data ? JSON.stringify(error.response.data) : error.message
    };
  }
};
