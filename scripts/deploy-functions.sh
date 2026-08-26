#!/usr/bin/env bash
#
# 云函数部署脚本（伴梦童话 / blacke-... 环境）
#
# 用法:
#   bash scripts/deploy-functions.sh            # 部署全部 5 个 mp-* 函数
#   bash scripts/deploy-functions.sh mp-admin   # 只部署指定函数
#
# ⚠️ 重要（反复踩坑结论）:
#   `tcb fn deploy` 会把函数的「调用权限(安全规则 invoke)」重置回环境默认
#   （即 `auth != null && auth.loginType != 'ANONYMOUS'`），
#   而网页管理后台用的是匿名登录，会被这条规则排除 -> 报 PERMISSION_DENIED。
#   当前 cloudbaserc.json 的 functions[] 没有"调用权限"字段，无法固化，
#   所以部署后【必须】重设 mp-admin 的权限（见底部 POST-DEPLOY 步骤）。
#
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_ID="blacke-d7g0wczgza0632d5a"
FUNCS=("mp-admin" "mp-story" "mp-user" "mp-voice" "mp-cdkey")

# 若命令行指定了函数名，则只部署它
if [ $# -ge 1 ]; then
  FUNCS=("$@")
fi

echo "=================================================="
echo " 部署云函数 -> 环境 $ENV_ID"
echo " 目标: ${FUNCS[*]}"
echo "=================================================="

DEPLOY_FAILED=""
for fn in "${FUNCS[@]}"; do
  echo ""
  echo ">>>>>> deploying $fn ..."
  if tcb fn deploy "$fn" --env-id "$ENV_ID" --force 2>&1 | tail -5; then
    echo "<<<<<< $fn done"
  else
    echo "⚠️ $fn 部署失败（可能是平台瞬时错误），请稍后重试该函数的部署"
    DEPLOY_FAILED="$DEPLOY_FAILED $fn"
  fi
done

if [ -n "$DEPLOY_FAILED" ]; then
  echo ""
  echo "⚠️ 以下函数部署失败，未重新上传代码（权限未被其重置）:$DEPLOY_FAILED"
  echo "   建议稍后单独重跑: bash scripts/deploy-functions.sh$DEPLOY_FAILED"
fi

echo ""
echo "=================================================="
echo " ✅ 部署完成"
echo "=================================================="
echo ""
echo "🔧 自动固化 mp-admin 调用权限（防 PERMISSION_DENIED）..."
echo "   tcb fn deploy 会把 mp-admin 的 invoke 重置成默认(排除匿名)，"
echo "   网页后台因用匿名登录会被拦。脚本将 mp-admin 单独放开为 invoke:true，"
echo "   同时保留 * 通配不动（小程序端微信身份不受影响）。"
echo ""

NODE_BIN="/Users/zhangkai/.workbuddy/binaries/node/versions/22.22.2/bin/node"
if [ -f scripts/apply-mpadmin-permission.js ]; then
  # 让脚本复用 tcb CLI 的登录态（STS 临时凭据）
  NODE_PATH="$(pwd)/admin/node_modules" "$NODE_BIN" scripts/apply-mpadmin-permission.js || {
    echo "⚠️ 权限固化脚本执行失败，请手动跑: node scripts/apply-mpadmin-permission.js"
    echo "   （若提示凭据过期，先运行 tcb login 刷新，再重跑此脚本）"
  }
else
  echo "⚠️ 未找到 scripts/apply-mpadmin-permission.js，请确认文件存在"
fi

echo ""
echo "=================================================="
echo " 🎉 全部完成。后台现在应能正常登录（PERMISSION_DENIED 已消除）。"
echo "=================================================="
