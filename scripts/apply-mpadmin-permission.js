#!/usr/bin/env node
/**
 * 固化 mp-admin 云函数调用权限（invoke: true），避免 `tcb fn deploy` 把函数安全规则
 * 重置回默认的「排除匿名登录」导致管理后台网页端 PERMISSION_DENIED。
 *
 * 原理：复用本地 tcb CLI 的登录态（~/.config/.cloudbase/auth.json 中的 STS 临时凭据），
 * 用标准腾讯云 TC3-HMAC-SHA256 签名调用 tcb 服务 2018-06-08 的 ModifyResourcePermission 接口。
 * 同时保留 `*` 通配规则（小程序端微信身份调用不受影响），仅把 mp-admin 放开。
 *
 * 用法：node scripts/apply-mpadmin-permission.js
 * 依赖：每次 `tcb fn deploy` 之后调用（部署会刷新 tcb 登录态，凭据随即有效）。
 */

const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const ENV_ID = 'blacke-d7g0wczgza0632d5a';
const FUNCTION_NAME = 'mp-admin';
const REGION = process.env.TCB_REGION || 'ap-shanghai';
const SERVICE = 'tcb';
const ACTION = 'ModifyResourcePermission';
const VERSION = '2018-06-08';
const HOST = 'tcb.tencentcloudapi.com';

// 目标安全规则：保留 * 通配（小程序端微信身份），单独放开 mp-admin（网页后台匿名登录）
const SECURITY_RULE = JSON.stringify({
  '*': { invoke: 'auth != null && auth.loginType != \'ANONYMOUS\'' },
  [FUNCTION_NAME]: { invoke: true },
});

function loadCredentials() {
  const paths = [
    process.env.HOME + '/.config/.cloudbase/auth.json',
    process.env.HOME + '/.cloudbase/auth.json',
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      const o = JSON.parse(fs.readFileSync(p, 'utf8'));
      const c = o.credential || o;
      if (c.tmpSecretId && c.tmpSecretKey) {
        return {
          secretId: c.tmpSecretId,
          secretKey: c.tmpSecretKey,
          token: c.tmpToken || '',
          expired: c.tmpExpired || 0,
          file: p,
        };
      }
    }
  }
  throw new Error('未找到 tcb 登录态凭据，请先运行 `tcb login`');
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}
function hmac(key, data, encoding = 'utf8') {
  return crypto.createHmac('sha256', key).update(data, encoding).digest();
}
function getDate(timestamp) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function sign(timestamp, payloadStr, creds) {
  const method = 'POST';
  const path = '/';
  const querystring = '';
  const headers = `content-type:application/json\nhost:${HOST}\n`;
  const signedHeaders = 'content-type;host';
  const payloadHash = sha256Hex(payloadStr);
  const canonicalRequest = `${method}\n${path}\n${querystring}\n${headers}\n${signedHeaders}\n${payloadHash}`;

  const date = getDate(timestamp);
  const stringToSign =
    `TC3-HMAC-SHA256\n${timestamp}\n${date}/${SERVICE}/tc3_request\n` + sha256Hex(canonicalRequest);

  const kDate = hmac(`TC3${creds.secretKey}`, date);
  const kService = hmac(kDate, SERVICE);
  const kSigning = hmac(kService, 'tc3_request');
  const signature = hmac(kSigning, stringToSign).toString('hex');

  return `TC3-HMAC-SHA256 Credential=${creds.secretId}/${date}/${SERVICE}/tc3_request, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

function requestTC3(action, payload, creds) {
  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const payloadStr = JSON.stringify(payload);
    const authorization = sign(timestamp, payloadStr, creds);

    const headers = {
      'Content-Type': 'application/json',
      Host: HOST,
      'X-TC-Action': action,
      'X-TC-Region': REGION,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Version': VERSION,
      Authorization: authorization,
    };
    if (creds.token) headers['X-TC-Token'] = creds.token;

    const body = Buffer.from(payloadStr, 'utf8');
    const req = https.request(
      { hostname: HOST, path: '/', method: 'POST', headers, timeout: 60000 },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('响应解析失败: ' + data.slice(0, 200)));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('请求超时')));
    req.on('error', (e) => reject(e));
    req.write(body);
    req.end();
  });
}

async function main() {
  const creds = loadCredentials();
  const now = Date.now();
  if (creds.expired && now > creds.expired) {
    console.error('[warn] tcb 临时凭据可能已过期（' + new Date(creds.expired).toISOString() + '），请先运行 `tcb login` 刷新后再试');
    process.exit(2);
  }

  console.log('[info] 正在设置 ' + FUNCTION_NAME + ' 的调用权限 (invoke: true) ...');
  const setRes = await requestTC3(ACTION, {
    EnvId: ENV_ID,
    ResourceType: 'function',
    Resource: FUNCTION_NAME,
    Permission: 'CUSTOM',
    SecurityRule: SECURITY_RULE,
  }, creds);

  if (setRes.Response && setRes.Response.Error) {
    console.error('[error] ModifyResourcePermission 失败:', JSON.stringify(setRes.Response.Error));
    process.exit(1);
  }
  console.log('[ok] ModifyResourcePermission 返回:', JSON.stringify(setRes.Response));

  // 自校验：查询当前规则，确认 mp-admin 已为 true
  console.log('[info] 校验当前函数安全规则 ...');
  const getRes = await requestTC3('DescribeResourcePermission', {
    EnvId: ENV_ID,
    ResourceType: 'function',
    Resources: [FUNCTION_NAME],
  }, creds);

  if (getRes.Response && getRes.Response.Error) {
    console.error('[warn] 校验查询失败（设置已提交）:', JSON.stringify(getRes.Response.Error));
  } else {
    const rule = getRes.Response && (getRes.Response.Permission || getRes.Response.Data);
    console.log('[verify] 当前规则:', JSON.stringify(rule));
    const list = rule && rule.PermissionList;
    const secRaw = list && list[0] && list[0].SecurityRule;
    let confirmed = false;
    if (secRaw) {
      try {
        const sec = JSON.parse(secRaw);
        confirmed = sec['mp-admin'] && sec['mp-admin'].invoke === true;
      } catch (e) {
        confirmed = secRaw.includes('"mp-admin"') && secRaw.includes('true');
      }
    }
    if (confirmed) {
      console.log('[ok] mp-admin invoke 已确认为 true，后台 PERMISSION_DENIED 已消除');
    } else {
      console.log('[warn] 未能从返回中确认 mp-admin:true，请到控制台「云函数-权限」复查');
    }
  }
}

main().catch((e) => {
  console.error('[fatal]', e.message);
  process.exit(1);
});
