import app, { ensureLogin } from './cloud';
import { getToken, clearToken } from './auth';

export interface AdminResp {
  success?: boolean;
  error?: string;
  [key: string]: any;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (isRecord(error) && typeof error.message === 'string') return error.message;
  return '';
}

// 统一调用 mp-admin 云函数；自动附加管理员令牌。
// 若令牌过期，服务端返回 { error: '管理员令牌无效或已过期' }，此处清令牌并踢回登录页。
export async function callAdmin(action: string, data: Record<string, any> = {}): Promise<AdminResp> {
  try {
    if (action !== 'login') {
      await ensureLogin();
    }
    const token = getToken();
    if (action !== 'login' && !token) {
      clearToken();
      window.location.hash = '#/login';
      return { success: false, error: '管理员登录状态已失效，请重新登录' };
    }

    const response: unknown = await app.callFunction({
      name: 'mp-admin',
      data: { action, ...(token ? { adminToken: token } : {}), ...data },
    });
    const responseRecord = isRecord(response) ? response : {};
    const resultValue = responseRecord.result;
    const result: AdminResp = isRecord(resultValue)
      ? (resultValue as AdminResp)
      : (responseRecord as AdminResp);

    if (result.error === '管理员令牌无效或已过期') {
      clearToken();
      window.location.hash = '#/login';
    }
    return result;
  } catch (error: unknown) {
    const detail = getErrorMessage(error);
    return {
      success: false,
      error: detail ? `后台请求失败：${detail}` : '后台请求失败，请稍后重试',
    };
  }
}
