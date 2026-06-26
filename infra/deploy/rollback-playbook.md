# Blue-green + service worker rollback playbook

## API (Render)

1. Deploy green service (`coreknot-api-staging`) with health checks green
2. Run `npm run test:e2e:public` against green URL
3. Switch Render traffic / promote preview
4. On failure: revert deploy in Render dashboard (< 2 min MTTR target)

## Client (Vercel)

1. Preview deploy from branch
2. Verify Lighthouse PWA + offline E2E
3. Promote to production
4. On failure: instant rollback to prior deployment in Vercel

## Service worker

1. Set `SW_KILL_SWITCH=true` on API
2. Clients call `/api/v1/sync/sw-killswitch` and unregister
3. Ship fixed SW with new `registerType: prompt` flow
4. Clear `SW_KILL_SWITCH` after adoption
