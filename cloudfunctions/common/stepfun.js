// StepFun（阶跃星辰）API 封装：文本 / 图片 / 语音合成 / 声音克隆
// 仅在云函数内调用（密钥配置在云函数环境变量，绝不暴露到前端）。
const { genId, sha256Hex, isValidAudioBuffer, audioFormatFromBuffer } = require('./util');

const STEP_PLAN_BASE = 'https://api.stepfun.com/step_plan/v1';
const FILE_BASE = 'https://api.stepfun.com/v1';
const TEXT_MODEL = process.env.STEPFUN_MODEL || 'step-3.7-flash';

function getKey() {
  const key = process.env.STEPFUN_API_KEY;
  if (!key || key === 'MY_STEPFUN_API_KEY') return null;
  return key;
}

async function generateText(systemPrompt, titleHint) {
  const key = getKey();
  if (!key) return null;
  try {
    const response = await fetch(`${STEP_PLAN_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请立即开始创作关于${titleHint}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.75,
      }),
    });
    if (!response.ok) throw new Error(`Stepfun text ${response.status}`);
    const result = await response.json();
    const rawText = result.choices[0].message.content.trim();
    return JSON.parse(rawText);
  } catch (err) {
    console.error('[Stepfun] text failed:', err.message);
    return null;
  }
}

async function generateImage(prompt, size = '1024x1024') {
  const key = getKey();
  if (!key) return null;
  try {
    const response = await fetch(`${STEP_PLAN_BASE}/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'step-image-edit-2', prompt, size, n: 1 }),
    });
    if (!response.ok) throw new Error(`Stepfun image ${response.status}`);
    const result = await response.json();
    if (result.data && result.data[0] && result.data[0].url) return result.data[0].url;
    return null;
  } catch (err) {
    console.error('[Stepfun] image failed:', err.message);
    return null;
  }
}

// 返回音频 buffer（MP3/WAV/...）或 null
async function synthesizeSpeech(text, voiceParam) {
  const key = getKey();
  if (!key) return null;
  try {
    const response = await fetch(`${STEP_PLAN_BASE}/audio/speech`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'stepaudio-2.5-tts', input: text, voice: voiceParam }),
    });
    if (!response.ok) throw new Error(`Stepfun speech ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    if (!isValidAudioBuffer(buf) || buf.length > 12 * 1024 * 1024) return null;
    return buf;
  } catch (err) {
    console.error('[Stepfun] speech failed:', err.message);
    return null;
  }
}

// 声音克隆：传入音频 buffer（wav/mp3），返回 { voiceId, succeeded }
async function cloneVoice(audioBuffer, name) {
  const key = getKey();
  if (!key) return { voiceId: 'clon_simulated_' + Date.now(), succeeded: false };
  try {
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    formData.append('file', blob, 'voice_ref.wav');
    formData.append('name', name || 'voice');
    const response = await fetch(`${STEP_PLAN_BASE}/audio/voices`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: formData,
    });
    if (response.ok) {
      const result = await response.json();
      if (result.voice_id) {
        return { voiceId: result.voice_id, succeeded: true };
      }
    }
    return { voiceId: 'clon_simulated_' + Date.now(), succeeded: false };
  } catch (err) {
    console.error('[Stepfun] clone failed:', err.message);
    return { voiceId: 'clon_simulated_' + Date.now(), succeeded: false };
  }
}

function logApiCall(route, method, status, service, latencyMs, tokens, message) {
  console.log(`[API] ${route} ${method} -> ${status} [${service}] ${latencyMs}ms ${tokens}tok :: ${message}`);
}

module.exports = {
  getKey,
  generateText,
  generateImage,
  synthesizeSpeech,
  cloneVoice,
  logApiCall,
};
