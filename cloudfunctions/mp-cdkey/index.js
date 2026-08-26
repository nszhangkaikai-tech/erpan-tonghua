// 云函数 mp-cdkey：激活码兑换 + 邀请绑定
// action: redeem（校验卡密→发放权益→通知）
//        bind（绑定邀请码→双方奖励→记录）
const {
  getOpenid, getUserState, setRights, getRights,
  recordQuota, getCdkeyDoc, markCdkeyUsedAtomic, getUserByInviteCode,
  getStats, incrStats, addNotification, addInvitationRecord,
  listNotifications, queryAll,
} = require('./common/db');
const { genId } = require('./common/util');

async function redeem(openid, body) {
  const { code } = body;
  if (!code) return { error: '请输入有效的激活码！' };

  const userState = await getUserState(openid);
  const normCode = code.trim().toUpperCase();
  const card = await getCdkeyDoc(normCode);
  if (!card) return { error: '该激活码不存在，请核对后再试！' };

  // 原子兑换：仅当 isUsed=false 时置位，并发重复兑换只会成功一次
  const locked = await markCdkeyUsedAtomic(normCode, openid);
  if (!locked) return { error: '该激活码已被兑换使用过！' };

  const rights = userState.rights;
  if (card.type === 'times') {
    rights.storyGenerationsRemaining += card.value;
    await recordQuota(openid, { resourceType: 'cdkey_times', amount: card.value, reason: `CDKey兑换:${card.code}`, balanceAfter: rights.storyGenerationsRemaining });
  } else if (card.type === 'vip') {
    rights.isVip = true;
    const currentExpiry = rights.vipExpiry ? new Date(rights.vipExpiry) : new Date();
    currentExpiry.setDate(currentExpiry.getDate() + card.value);
    rights.vipExpiry = currentExpiry.toISOString();
  }
  await setRights(openid, rights);

  await incrStats('cdkeysRedeemedCount', 1);
  if (card.type === 'vip') await incrStats('vipsActivatedCount', 1);

  const textVal = card.type === 'times' ? `${card.value}次故事生成额度` : `${card.value}天VIP尊享会员`;
  const notif = {
    id: genId('notif'),
    title: '激活码兑换成功！',
    content: `恭喜您成功兑换由【${card.channel}】发放的卡密，获得【${textVal}】！权益已立即充值到账。`,
    type: 'card',
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  await addNotification(openid, notif);

  const ns = await listNotifications(openid);
  return { success: true, rights, notifications: ns, message: `兑换成功，获得${textVal}` };
}

async function bind(openid, body) {
  const { inviteCode } = body;
  if (!inviteCode) return { error: '请输入邀请码！' };

  const userState = await getUserState(openid);
  const rights = userState.rights;
  const upper = inviteCode.trim().toUpperCase();

  if (upper === rights.inviteCode) return { error: '您不能绑定自己的邀请码！' };
  if (rights.usedInviteCode) return { error: '您已绑定过邀请关系，无法重复绑定！' };

  // 通过邀请码找到真实推荐人 openid（而非仅存邀请码字符串）
  const referrer = await getUserByInviteCode(upper);

  rights.usedInviteCode = upper;
  await setRights(openid, rights);

  await incrStats('invitesBoundCount', 1);

  // 绑定方奖励
  rights.storyGenerationsRemaining += 2;
  await setRights(openid, rights);
  await recordQuota(openid, { resourceType: 'invite_reward', amount: 2, reason: '邀请绑定奖励', balanceAfter: rights.storyGenerationsRemaining });

  // 推荐人奖励（双方奖励）：必须用真实推荐人 openid 发放
  if (referrer && referrer._id !== openid) {
    const rRights = referrer.rights || { freeVoiceClonesRemaining: 5, storyGenerationsRemaining: 3, isVip: false, inviteCode: '' };
    rRights.storyGenerationsRemaining = (rRights.storyGenerationsRemaining || 0) + 2;
    await setRights(referrer._id, rRights);
    await recordQuota(referrer._id, { resourceType: 'invite_reward_referrer', amount: 2, reason: `邀请绑定奖励(推荐人)`, balanceAfter: rRights.storyGenerationsRemaining });
    await incrStats('invitesCompletedCount', 1);
  } else {
    await incrStats('invitesCompletedCount', 1);
  }

  const record = {
    id: genId('invite_rec'),
    referrerId: referrer ? referrer._id : upper,
    referredId: openid,
    referredName: userState.user.profile?.parentName || '淘淘妈妈',
    status: 'success',
    rewardValue: 2,
    createdAt: new Date().toISOString(),
  };
  await addInvitationRecord(record);

  const notif = {
    id: genId('notif'),
    title: '绑定邀请码成功！双方获赠福利',
    content: `您已成功绑定推荐人邀请码【${upper}】，您和好友均已获赠【2次故事生成额度】！`,
    type: 'referral',
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  await addNotification(openid, notif);

  const ns = await listNotifications(openid);
  const invites = await queryAll('invitationRecords', { referredId: openid });
  return { success: true, rights, invitationRecords: invites, notifications: ns };
}

exports.main = async (event, context) => {
  const openid = getOpenid(context);
  if (!openid) return { error: '身份缺失' };
  const { action } = event;
  try {
    switch (action) {
      case 'redeem':
        return await redeem(openid, event);
      case 'bind':
        return await bind(openid, event);
      default:
        return { error: 'unknown action: ' + action };
    }
  } catch (err) {
    console.error('[mp-cdkey] error:', err);
    return { error: err.message || 'server error' };
  }
};
