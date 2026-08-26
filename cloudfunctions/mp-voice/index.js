// 云函数 mp-voice：声音克隆与删除
// action: clone（上传录音→安全校验→额度扣减→StepFun 克隆→存库→通知）
//        delete（删除克隆声音）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const {
  getOpenid, ensureUser, getUserState,
  getRights, setRights, recordQuota,
  addVoice, deleteVoice, listVoices,
  getSensitiveConfig, pushAuditLog,
  getStats, incrStats, addNotification,
} = require('./common/db');
const { runSafetyCheck, genId, genSafetyAuditLog } = require('./common/util');
const { cloneVoice, logApiCall } = require('./common/stepfun');

// 从云存储下载录音 buffer（SSRF 安全：仅限本环境 fileID）
async function downloadRecording(fileID) {
  if (!fileID || !fileID.startsWith('cloud://')) return null;
  try {
    const res = await cloud.downloadFile({ fileID });
    return res.fileContent; // Buffer
  } catch (err) {
    console.error('[mp-voice] download recording failed:', err.message);
    return null;
  }
}

async function cloneVoiceAction(openid, body) {
  const { name, speakerType, recordDuration, fileID, text } = body;
  if (!name || !speakerType) {
    return { error: '缺少声音昵称或类型参数' };
  }

  // 昵称安全校验
  const sensitive = await getSensitiveConfig();
  const hit = runSafetyCheck(name, sensitive);
  if (hit && hit.blocked) {
    await pushAuditLog(genSafetyAuditLog('input_check', name, hit.category, hit.categoryName, 'intercept',
      hit.word, '', `录制克隆声音昵称含有敏感词『${hit.word}』(类别:${hit.categoryName})，已被强制拦截。`));
    return {
      error: `⚠️ 伴梦安全守护防御：您录制声音时起的昵称中含有 [${hit.categoryName}] 相关的敏感词汇（『${hit.word}』），已被系统安全拦截。本次录制未扣除克隆次数，请换一个温暖的昵称再试一次哦！`,
    };
  }

  // 额度扣减
  const userState = await getUserState(openid);
  const rights = userState.rights;
  let quotaType = 'voice_clone';
  let quotaReason = '声音克隆';
  let quotaConsumed = false;
  if (rights.freeVoiceClonesRemaining > 0) {
    rights.freeVoiceClonesRemaining -= 1;
    quotaConsumed = true;
  } else if (rights.storyGenerationsRemaining > 0) {
    rights.storyGenerationsRemaining -= 1;
    quotaType = 'story_generation';
    quotaReason = '声音克隆(消耗故事额度)';
    quotaConsumed = true;
  } else if (!rights.isVip) {
    return { error: '您的克隆次数与故事额度已不足，请先兑换激活码或邀请好友！' };
  }
  if (quotaConsumed) {
    await setRights(openid, rights);
    await recordQuota(openid, {
      resourceType: quotaType,
      amount: -1,
      reason: quotaReason,
      balanceAfter: quotaType === 'voice_clone' ? rights.freeVoiceClonesRemaining : rights.storyGenerationsRemaining,
    });
  }

  const refundQuota = async () => {
    if (!quotaConsumed) return;
    if (quotaType === 'voice_clone') rights.freeVoiceClonesRemaining += 1;
    else rights.storyGenerationsRemaining += 1;
    await setRights(openid, rights);
    await recordQuota(openid, {
      resourceType: quotaType,
      amount: 1,
      reason: `${quotaReason}失败返还`,
      balanceAfter: quotaType === 'voice_clone' ? rights.freeVoiceClonesRemaining : rights.storyGenerationsRemaining,
    });
  };

  // StepFun 克隆必须返回真实 voice_id；失败时返还额度，不保存模拟声音。
  let stepfunVoiceId = '';
  let stepfunSucceeded = false;
  let detailMsg = '';

  const audioBuf = await downloadRecording(fileID);
  if (!audioBuf) {
    await refundQuota();
    logApiCall('/api/voice/clone', 'POST', 400, 'Stepfun Voice Clone', 0, 0, '录音文件读取失败，额度已返还');
    return { error: '录音文件读取失败，请重新录制后再试', retryable: true };
  }

  const result = await cloneVoice(audioBuf, name, text);
  stepfunVoiceId = result.voiceId;
  stepfunSucceeded = result.succeeded;
  detailMsg = stepfunSucceeded
    ? `已成功在阶跃星辰（stepaudio-2.5-tts）平台克隆该声音，获得专属 Voice ID: ${result.voiceId}`
    : result.error || 'StepFun 未返回有效音色 ID';

  if (!stepfunSucceeded || !stepfunVoiceId) {
    await refundQuota();
    logApiCall('/api/voice/clone', 'POST', 400, 'Stepfun Voice Clone', 0, 0, `${detailMsg}；额度已返还`);
    // 透传真实错误信息（截断过长内容），方便定位根因
    const shortDetail = detailMsg.length > 80 ? detailMsg.slice(0, 80) + '…' : detailMsg;
    const needsUpdate = /更新|版本/.test(detailMsg);
    const formatError = !needsUpdate && /webm|file_format|格式|音频|INVALID_AUDIO_FILE|invalid.*audio/i.test(detailMsg);
    return {
      error: needsUpdate
        ? detailMsg
        : formatError
          ? `${shortDetail}`
          : `克隆失败: ${shortDetail}`,
      retryable: true,
    };
  }

  const newVoice = {
    id: genId('voice'),
    name,
    isReady: true,
    usageCount: 0,
    createTime: new Date().toISOString(),
    recordDuration: Number(recordDuration) || 30,
    speakerType,
    stepfunVoiceId,
    stepfunSucceeded,
    fileID: fileID || '',
  };

  await addVoice({ openid, ...newVoice });
  await incrStats('voiceClonedCount', 1);

  const notif = {
    id: genId('notif'),
    title: `『${name}』声源克隆成功！`,
    content: `您的专属声音『${name}』已准备完毕，现在可以使用该克隆声音开始创作独一无二的有声童话了。`,
    type: 'voice',
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  await addNotification(openid, notif);

  logApiCall(
    '/api/voice/clone',
    'POST',
    200,
    stepfunSucceeded ? 'Stepfun Voice Clone (stepaudio-2.5-tts)' : 'Voice Cloner Simulator',
    stepfunSucceeded ? 1800 : 450,
    0,
    detailMsg
  );

  const ns = await listVoices(openid);
  return { success: true, voice: newVoice, rights, notifications: ns };
}

async function deleteVoiceAction(openid, body) {
  const { id } = body;
  if (!id) return { error: '缺少声音 id' };
  const ok = await deleteVoice(openid, id);
  const ns = await listVoices(openid);
  return { success: ok, voiceClones: ns };
}

exports.main = async (event, context) => {
  const openid = getOpenid(context);
  if (!openid) return { error: '身份缺失' };
  const { action } = event;
  try {
    switch (action) {
      case 'clone':
        return await cloneVoiceAction(openid, event);
      case 'delete':
        return await deleteVoiceAction(openid, event);
      default:
        return { error: 'unknown action: ' + action };
    }
  } catch (err) {
    console.error('[mp-voice] error:', err);
    return { error: err.message || 'server error' };
  }
};
