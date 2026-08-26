# WorkBuddy today handoff: Earbud Fairy Tales production launch

## Goal

Finish and verify today: a real, accessible Earbud Fairy Tales (耳畔童话) WeChat Mini Program and a real, accessible visual admin console. The result must support normal front-end use and administrator data maintenance through the real CloudBase environment. Do not call this complete until build, deployment, endpoint, permission, and key UI-flow evidence exists.

## Source of truth

- Formal source: `/Users/zhangkai/Desktop/小程序/新项目`
- `/Users/zhangkai/Documents/微信小程序项目` is currently a CloudBase blank template. Do not continue developing there or mix the two trees.
- If a migration is unavoidable, first compare the complete file lists and make one directory the only build/deploy source.
- Do not modify `backend/src/data.json`.
- Never call `admin/reset`.

## Fixed deployment configuration

- Mini Program AppID: `wx231962cec75efb9e`
- CloudBase environment: `blacke-d7g0wczgza0632d5a`
- Product name: `耳畔童话`
- No production front-end request may depend on `localhost:3000`.
- Keep all API keys and admin credentials only in CloudBase function/service environment variables. Never put secrets in source, front-end bundles, seed data, or chat messages.

## Required implementation

1. Deploy and verify `mp-user`, `mp-story`, `mp-voice`, `mp-cdkey`, and `mp-admin`. `mp-seed` may be used once for test data only, then delete or disable it.
2. Reconcile `docs/sql.md` and `docs/api.md` with the actual NoSQL collections, indexes, actions, and permissions.
3. Ordinary users must not read `admins`, `adminSessions`, `sensitiveWordsConfig`, `apiStats`, or redemption-code management data.
4. The admin console must really support administrator login, statistics, template create/edit/recommend/unpublish, user/story/generation/resource queries, and security-audit handling. Deploy it to a reachable CloudBase static-hosting address. The root URL must return HTTP 200; do not leave a `dist`-root 404.
5. Fix launch blockers: minimum user-data response; admin auth for config mutation; atomic duplicate-safe redemption and invitation binding; audio generation returns a job ID and runs asynchronously; narration-only flow must not wait for FFmpeg/BGM mixing; white noise defaults to `none` and is played independently by the client; image compression must actually re-encode the image instead of only changing the extension; cover and inner-page prompts must be separate strategies, and inner pages must not permanently pretend stock images are AI output.
6. Preserve the agreed UI fixes: vector icons instead of emoji placeholders, bottom navigation on every applicable page including the picture-book generation flow, notification placement, input-box and keyboard adaptation, and the latest Earbud Fairy Tales copy/theme.

## Required verification evidence

- Read and record the actual CloudBase environment, deployed function list, collections, indexes, and permissions.
- Mini Program type-check and `build:weapp` pass.
- Admin project `npm build` and tests pass.
- Minimal real calls pass for login, home, templates, text generation, generation-job status, player/diary, voice upload/clone, redemption/invitation; cross-user access must fail.
- Admin login and maintenance operations pass: template create/edit/recommend/unpublish, user/task/resource views, security audit resolution.
- Regression-check home, all bottom navigation, recording-room input and keyboard, picture-book wizard, cover/inner images, actual compressed image size, audio playback, and independent white-noise playback.

## Final report required

Report the single source directory, deployment time/version for each function, collections/indexes/permissions, front-end URL, admin URL, passed checks, failed checks, and remaining launch blockers. If any required evidence is missing, report the project as not yet launched.
