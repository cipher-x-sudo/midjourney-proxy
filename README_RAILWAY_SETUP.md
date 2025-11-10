# Quick Railway Setup Guide

## Your Configuration is Ready! ✅

Your configuration has been tested and is ready for Railway deployment.

## Quick Steps

### 1. Test Your Configuration (Already Done ✅)

```bash
npm run test:config
```

**Result:** All configuration validated successfully!

### 2. Export Railway Environment Variables

```bash
npm run export:railway-env
```

This will show you the exact environment variables to set in Railway.

### 3. Set Up Railway

#### Option A: Railway Dashboard (Easiest)

1. Go to https://railway.app
2. Select your project → Your service → **Variables** tab
3. Add these variables (from `npm run export:railway-env`):

```
MJ_DISCORD_GUILD_ID=your_guild_id
MJ_DISCORD_CHANNEL_ID=your_channel_id
MJ_DISCORD_USER_TOKEN=your_discord_token
MJ_API_SECRET=your_api_secret
```

#### Option B: Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# Set variables (use output from npm run export:railway-env)
railway variables set MJ_DISCORD_GUILD_ID=your_guild_id
railway variables set MJ_DISCORD_CHANNEL_ID=your_channel_id
railway variables set MJ_DISCORD_USER_TOKEN=your_discord_token
railway variables set MJ_API_SECRET=your_api_secret
```

### 4. Verify Deployment

1. Check Railway logs for:
   - `Server listening on http://0.0.0.0:8080/mj`
   - `Current available account count [1]`

2. Test health endpoint:
   ```bash
   curl https://your-app.railway.app/mj/health
   ```

## Important Notes

⚠️ **Security:**
- Never commit `src/config/default.yaml` with secrets to Git
- Always use environment variables in Railway
- Your Discord token should only be in Railway, not in Git

## Full Documentation

- [Testing and Railway Setup Guide](./docs/TESTING_AND_RAILWAY_SETUP.md)
- [Railway Environment Variables Setup](./docs/RAILWAY_ENV_SETUP.md)
- [Configuration Guide](./docs/CONFIGURATION.md)
- [API Secret Guide](./docs/API_SECRET_GUIDE.md)

## Need Help?

1. Run `npm run test:config` to validate configuration
2. Run `npm run export:railway-env` to get Railway variables
3. Check Railway logs for deployment status
4. See [Troubleshooting](./docs/TESTING_AND_RAILWAY_SETUP.md#troubleshooting)

