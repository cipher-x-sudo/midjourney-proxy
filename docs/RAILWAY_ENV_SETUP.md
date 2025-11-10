# Railway Environment Variables Setup Guide

This guide explains how to configure environment variables in Railway for your Midjourney Proxy deployment.

## Quick Setup

### Step 1: Access Railway Dashboard

1. Go to https://railway.app
2. Log in to your account
3. Select your project (or create a new one)
4. Click on your service

### Step 2: Add Environment Variables

1. Click on the **Variables** tab in your service
2. Click **New Variable** to add each variable
3. Add the following variables:

## Required Environment Variables

### Discord Configuration (Required)

```
MJ_DISCORD_GUILD_ID=your_guild_id
MJ_DISCORD_CHANNEL_ID=your_channel_id
MJ_DISCORD_USER_TOKEN=your_discord_token
```

### API Security (Recommended)

```
MJ_API_SECRET=your-generated-api-secret
```

### Server Configuration (Optional)

```
PORT=8080
```

## Complete Environment Variables List

### Discord Configuration

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `MJ_DISCORD_GUILD_ID` | Discord server (guild) ID | ✅ Yes | `123456789012345678` |
| `MJ_DISCORD_CHANNEL_ID` | Discord channel ID | ✅ Yes | `123456789012345678` |
| `MJ_DISCORD_USER_TOKEN` | Discord user token | ✅ Yes | `your_discord_token` |

### API Security

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `MJ_API_SECRET` | API secret for authentication | ⚠️ Recommended | `your-generated-api-secret` |

### Task Store Configuration

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `MJ_TASK_STORE_TYPE` | Storage type: `in_memory` or `redis` | ❌ No | `redis` |
| `MJ_TASK_STORE_TIMEOUT` | Task expiration time | ❌ No | `30d` |
| `REDIS_URL` | Redis connection URL (if using Redis) | ⚠️ If Redis | `redis://redis:6379` |

### Load Balancing

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `MJ_ACCOUNT_CHOOSE_RULE` | Load balancing rule | ❌ No | `BestWaitIdleRule` |

### Translation Configuration

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `MJ_TRANSLATE_WAY` | Translation method: `NULL`, `BAIDU`, `GPT` | ❌ No | `GPT` |
| `MJ_BAIDU_TRANSLATE_APPID` | Baidu Translate App ID | ⚠️ If Baidu | `your_app_id` |
| `MJ_BAIDU_TRANSLATE_APP_SECRET` | Baidu Translate App Secret | ⚠️ If Baidu | `your_app_secret` |
| `MJ_OPENAI_GPT_API_KEY` | OpenAI API key | ⚠️ If GPT | `sk-your-key` |
| `MJ_OPENAI_GPT_API_URL` | Custom OpenAI API URL | ❌ No | `https://api.openai.com/v1` |

### Notifications

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `MJ_NOTIFY_HOOK` | Webhook URL for notifications | ❌ No | `https://your-webhook.com` |

### Server Configuration

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `PORT` | Server port | ❌ No | `8080` |

## Step-by-Step Railway Setup

### Method 1: Using Railway Dashboard (Recommended)

1. **Navigate to Variables Tab**
   - Go to your Railway project
   - Click on your service
   - Click on the **Variables** tab

2. **Add Required Variables**
   - Click **New Variable**
   - Enter variable name (e.g., `MJ_DISCORD_GUILD_ID`)
   - Enter variable value
   - Click **Add**

3. **Repeat for All Variables**
   - Add all required variables listed above
   - Add any optional variables you need

4. **Deploy**
   - Railway will automatically redeploy when you add variables
   - Check the deployment logs to verify configuration

### Method 2: Using Railway CLI

1. **Install Railway CLI**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Link Your Project**
   ```bash
   railway link
   ```

4. **Set Environment Variables**
   ```bash
   railway variables set MJ_DISCORD_GUILD_ID=your_guild_id
   railway variables set MJ_DISCORD_CHANNEL_ID=your_channel_id
   railway variables set MJ_DISCORD_USER_TOKEN=your_token
   railway variables set MJ_API_SECRET=your_api_secret
   ```

5. **View All Variables**
   ```bash
   railway variables
   ```

### Method 3: Using railway.json (Not Recommended for Secrets)

You can also set non-sensitive variables in `railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "node dist/server.js",
    "healthcheckPath": "/mj/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "variables": {
      "PORT": "8080",
      "MJ_TASK_STORE_TYPE": "in_memory"
    }
  }
}
```

⚠️ **Warning:** Never commit secrets to `railway.json` or Git!

## Example: Complete Railway Setup

### 1. Basic Setup (Minimum Required)

```bash
MJ_DISCORD_GUILD_ID=your_guild_id
MJ_DISCORD_CHANNEL_ID=your_channel_id
MJ_DISCORD_USER_TOKEN=your_discord_token
MJ_API_SECRET=your-generated-api-secret
```

### 2. Production Setup (With Redis)

```bash
MJ_DISCORD_GUILD_ID=your_guild_id
MJ_DISCORD_CHANNEL_ID=your_channel_id
MJ_DISCORD_USER_TOKEN=your_discord_token
MJ_API_SECRET=your-generated-api-secret
MJ_TASK_STORE_TYPE=redis
REDIS_URL=redis://your-redis-url:6379
PORT=8080
```

### 3. With GPT Translation

```bash
MJ_DISCORD_GUILD_ID=your_guild_id
MJ_DISCORD_CHANNEL_ID=your_channel_id
MJ_DISCORD_USER_TOKEN=your_discord_token
MJ_API_SECRET=your-generated-api-secret
MJ_TRANSLATE_WAY=GPT
MJ_OPENAI_GPT_API_KEY=sk-your-openai-api-key
```

## Testing Your Configuration

### 1. Check Railway Logs

After deploying, check the Railway logs:
1. Go to your Railway service
2. Click on the **Deployments** tab
3. Click on the latest deployment
4. Check the logs for:
   - `Server listening on http://0.0.0.0:8080/mj`
   - `Current available account count [1]` (or higher)

### 2. Test Health Endpoint

```bash
curl https://your-app.railway.app/mj/health
```

Expected response:
```json
{"status":"ok"}
```

### 3. Test API Endpoint (With Secret)

```bash
curl -X POST https://your-app.railway.app/mj/submit/imagine \
  -H "Content-Type: application/json" \
  -H "mj-api-secret: your-api-secret" \
  -d '{
    "prompt": "a beautiful landscape",
    "notifyHook": "https://your-webhook.com"
  }'
```

## Troubleshooting

### Issue: "Current available account count [0]"

**Possible causes:**
1. Discord credentials are incorrect
2. Discord token is expired or invalid
3. Environment variables are not set correctly

**Solution:**
1. Verify all Discord environment variables are set
2. Check Railway logs for authentication errors
3. Verify Discord token is valid and not expired
4. Ensure `MJ_DISCORD_GUILD_ID`, `MJ_DISCORD_CHANNEL_ID`, and `MJ_DISCORD_USER_TOKEN` are correct

### Issue: Health Check Failing

**Possible causes:**
1. Server not starting
2. Port configuration incorrect
3. Health endpoint not accessible

**Solution:**
1. Check Railway logs for startup errors
2. Verify `PORT` environment variable matches Railway's expected port
3. Check that the health endpoint is accessible at `/mj/health`

### Issue: 401 Unauthorized Error

**Possible causes:**
1. API secret not set in Railway
2. API secret mismatch between client and server
3. Header name incorrect

**Solution:**
1. Verify `MJ_API_SECRET` is set in Railway
2. Ensure the `mj-api-secret` header is included in requests
3. Verify the secret value matches exactly

### Issue: Environment Variables Not Applied

**Possible causes:**
1. Variables not saved correctly
2. Service not redeployed after adding variables
3. Variable names have typos

**Solution:**
1. Double-check variable names (case-sensitive)
2. Ensure variables are saved in Railway dashboard
3. Trigger a new deployment or wait for automatic redeployment
4. Check Railway logs to see which variables are being used

## Security Best Practices

1. **Never Commit Secrets to Git**
   - Always use environment variables for secrets
   - Never commit `default.yaml` with secrets
   - Use Railway's secret management

2. **Use Strong API Secrets**
   - Generate secrets using: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Use at least 32 characters (256 bits)

3. **Rotate Secrets Regularly**
   - Change API secrets periodically
   - Update Discord tokens if compromised
   - Update all clients when rotating secrets

4. **Use Railway's Secret Protection**
   - Railway automatically masks secret values in logs
   - Use Railway's environment variable encryption

5. **Limit Access**
   - Only give access to trusted team members
   - Use Railway's team permissions
   - Audit who has access to environment variables

## Verifying Configuration

After setting up environment variables in Railway:

1. **Check Deployment Logs**
   - Look for: `Server listening on http://0.0.0.0:8080/mj`
   - Look for: `Current available account count [1]` or higher

2. **Test Health Endpoint**
   ```bash
   curl https://your-app.railway.app/mj/health
   ```

3. **Test API Endpoint**
   ```bash
   curl -X POST https://your-app.railway.app/mj/submit/imagine \
     -H "Content-Type: application/json" \
     -H "mj-api-secret: your-api-secret" \
     -d '{"prompt": "test"}'
   ```

## Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [Configuration Guide](./CONFIGURATION.md)
- [API Secret Guide](./API_SECRET_GUIDE.md)
- [API Documentation](./api.md)

## Quick Reference: Railway CLI Commands

```bash
# Login to Railway
railway login

# Link project
railway link

# Set environment variable
railway variables set VARIABLE_NAME=value

# Get environment variable
railway variables get VARIABLE_NAME

# List all variables
railway variables

# Remove environment variable
railway variables unset VARIABLE_NAME

# View logs
railway logs

# Open Railway dashboard
railway open
```

