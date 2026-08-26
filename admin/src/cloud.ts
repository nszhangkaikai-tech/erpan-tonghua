import cloudbase from '@cloudbase/js-sdk';

// 与 miniprogram/app.tsx、cloudfunctions 的 envId 保持一致
export const ENV_ID = 'blacke-d7g0wczgza0632d5a';

const app = cloudbase.init({
  env: ENV_ID,
  persistence: 'local',
});

export default app;

// 浏览器端调用云函数需要一个登录态；匿名登录最轻量。
// 若控制台未开启「匿名登录」，callFunction 可能受限——部署时需在 CloudBase 控制台开启。
export async function ensureLogin(): Promise<void> {
  try {
    const auth = app.auth();
    if (typeof (auth as any).hasLoginState === 'function' && (auth as any).hasLoginState()) {
      return;
    }
    await auth.signInAnonymously();
  } catch (e) {
    // 匿名登录未开启时忽略，callFunction 仍可能可用（取决于函数权限配置）
    console.warn('[cloud] anonymous login skipped:', e);
  }
}
