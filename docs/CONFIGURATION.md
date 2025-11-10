# Configuration Guide

This guide explains how to configure the Midjourney Proxy application.

## Configuration Methods

The application supports two configuration methods:

1. **YAML Configuration File** (`src/config/default.yaml`) - Recommended for local development
2. **Environment Variables** - Recommended for Docker and cloud deployments

Environment variables take precedence over YAML configuration.

## Quick Start Configuration

### Minimum Required Configuration

To get started, you need at least these Discord credentials:

**Option 1: Using YAML file** (`src/config/default.yaml`):
```yaml
mj:
  discord:
    guildId: YOUR_GUILD_ID
    channelId: YOUR_CHANNEL_ID
    userToken: YOUR_USER_TOKEN
```

**Option 2: Using Environment Variables**:
```bash
export MJ_DISCORD_GUILD_ID=YOUR_GUILD_ID
export MJ_DISCORD_CHANNEL_ID=YOUR_CHANNEL_ID
export MJ_DISCORD_USER_TOKEN=YOUR_USER_TOKEN
```

### How to Get Discord Credentials

1. **Guild ID (Server ID)**: Your Discord server ID
2. **Channel ID**: The Discord channel ID where Midjourney bot is active
3. **User Token**: Your Discord user token

See [Discord Parameters Guide](./discord-params.md) for detailed instructions.

## Complete Configuration Reference

### Server Configuration

```yaml
server:
  port: 8080              # Server port (default: 8080)
  contextPath: /mj        # API context path (default: /mj)
```

**Environment Variables:**
- `PORT` - Server port (overrides `server.port`)

### Discord Account Configuration

#### Single Account (Basic)

```yaml
mj:
  discord:
    guildId: "123456789012345678"      # Discord server (guild) ID
    channelId: "123456789012345678"     # Discord channel ID
    userToken: "your_discord_token"    # Discord user token
    userAgent: "Mozilla/5.0..."        # Optional: Custom user agent
    enable: true                        # Enable this account
    coreSize: 3                         # Concurrent task limit per account
    queueSize: 10                       # Maximum queue size
    timeoutMinutes: 5                   # Task timeout in minutes
```

**Environment Variables:**
- `MJ_DISCORD_GUILD_ID` - Discord guild ID
- `MJ_DISCORD_CHANNEL_ID` - Discord channel ID
- `MJ_DISCORD_USER_TOKEN` - Discord user token

#### Multiple Accounts (Account Pool)

```yaml
mj:
  discord:
    guildId: "123456789012345678"
    channelId: "123456789012345678"
    userToken: "token1"
    enable: true
    coreSize: 3
  accounts:
    - guildId: "123456789012345678"
      channelId: "987654321098765432"
      userToken: "token2"
      enable: true
      coreSize: 3
    - guildId: "123456789012345678"
      channelId: "111111111111111111"
      userToken: "token3"
      enable: true
      coreSize: 5
```

### Task Storage Configuration

```yaml
mj:
  taskStore:
    type: in_memory      # Storage type: 'in_memory' or 'redis'
    timeout: 30d         # Task expiration time (e.g., '30d', '7d', '24h')
```

**Environment Variables:**
- `MJ_TASK_STORE_TYPE` - Storage type (`in_memory` or `redis`)
- `MJ_TASK_STORE_TIMEOUT` - Task expiration (e.g., `30d`, `7d`, `24h`)
- `REDIS_URL` - Redis connection URL (required if using Redis)

**Examples:**
- `30d` = 30 days
- `7d` = 7 days
- `24h` = 24 hours
- `60m` = 60 minutes

### Load Balancing Configuration

```yaml
mj:
  accountChooseRule: BestWaitIdleRule  # Rule: 'BestWaitIdleRule' or 'RoundRobinRule'
```

**Environment Variables:**
- `MJ_ACCOUNT_CHOOSE_RULE` - Load balancing rule (`BestWaitIdleRule` or `RoundRobinRule`)

**Rules:**
- `BestWaitIdleRule` (default): Selects account with least waiting tasks
- `RoundRobinRule`: Rotates through accounts in order

### API Authentication

```yaml
mj:
  apiSecret: "your-secret-key"  # Optional: API key for authentication
```

**Environment Variables:**
- `MJ_API_SECRET` - API secret key

If set, include header `mj-api-secret: your-secret-key` in all API requests.

### Translation Configuration

#### No Translation (Default)

```yaml
mj:
  translateWay: null  # No translation
```

#### Baidu Translation

```yaml
mj:
  translateWay: BAIDU
  baiduTranslate:
    appid: "your_baidu_appid"
    appSecret: "your_baidu_app_secret"
```

**Environment Variables:**
- `MJ_TRANSLATE_WAY` - Translation method (`NULL`, `BAIDU`, `GPT`)
- `MJ_BAIDU_TRANSLATE_APPID` - Baidu Translate App ID
- `MJ_BAIDU_TRANSLATE_APP_SECRET` - Baidu Translate App Secret

#### GPT Translation

```yaml
mj:
  translateWay: GPT
  openai:
    gptApiUrl: "https://api.openai.com/v1"  # Optional: Custom API URL
    gptApiKey: "sk-your-openai-api-key"
    timeout: 30s
    model: gpt-3.5-turbo
    maxTokens: 2048
    temperature: 0
```

**Environment Variables:**
- `MJ_OPENAI_GPT_API_KEY` - OpenAI API key
- `MJ_OPENAI_GPT_API_URL` - Custom OpenAI API URL (optional)

### Proxy Configuration

```yaml
mj:
  proxy:
    host: "proxy.example.com"  # Proxy host
    port: 8080                  # Proxy port
```

### Notification Configuration

```yaml
mj:
  notifyHook: "https://your-webhook-url.com"  # Webhook URL for notifications
  notifyPoolSize: 10                          # Notification pool size
```

**Environment Variables:**
- `MJ_NOTIFY_HOOK` - Webhook URL for task notifications

### Logging Configuration

```yaml
logging:
  level: info  # Log level: 'debug', 'info', 'warn', 'error'
```

## Docker Configuration Examples

### Basic Docker Run

```bash
docker run -p 8080:8080 \
  -e MJ_DISCORD_GUILD_ID=your_guild_id \
  -e MJ_DISCORD_CHANNEL_ID=your_channel_id \
  -e MJ_DISCORD_USER_TOKEN=your_token \
  midjourney-proxy
```

### Docker with Redis

```bash
docker run -p 8080:8080 \
  -e MJ_DISCORD_GUILD_ID=your_guild_id \
  -e MJ_DISCORD_CHANNEL_ID=your_channel_id \
  -e MJ_DISCORD_USER_TOKEN=your_token \
  -e MJ_TASK_STORE_TYPE=redis \
  -e REDIS_URL=redis://redis:6379 \
  midjourney-proxy
```

### Docker with API Secret

```bash
docker run -p 8080:8080 \
  -e MJ_DISCORD_GUILD_ID=your_guild_id \
  -e MJ_DISCORD_CHANNEL_ID=your_channel_id \
  -e MJ_DISCORD_USER_TOKEN=your_token \
  -e MJ_API_SECRET=your-secret-key \
  midjourney-proxy
```

### Docker with GPT Translation

```bash
docker run -p 8080:8080 \
  -e MJ_DISCORD_GUILD_ID=your_guild_id \
  -e MJ_DISCORD_CHANNEL_ID=your_channel_id \
  -e MJ_DISCORD_USER_TOKEN=your_token \
  -e MJ_TRANSLATE_WAY=GPT \
  -e MJ_OPENAI_GPT_API_KEY=sk-your-key \
  midjourney-proxy
```

## Docker Compose Configuration

See `docker-compose.yml` for a complete example with Redis:

```yaml
services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - MJ_DISCORD_GUILD_ID=your_guild_id
      - MJ_DISCORD_CHANNEL_ID=your_channel_id
      - MJ_DISCORD_USER_TOKEN=your_token
      - MJ_TASK_STORE_TYPE=redis
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

## Railway/Railway Configuration

For Railway deployment, set environment variables in the Railway dashboard:

1. Go to your Railway project
2. Navigate to Variables tab
3. Add the following variables:
   - `MJ_DISCORD_GUILD_ID`
   - `MJ_DISCORD_CHANNEL_ID`
   - `MJ_DISCORD_USER_TOKEN`
   - `MJ_API_SECRET` (optional)
   - `MJ_TASK_STORE_TYPE` (optional, default: `in_memory`)
   - `REDIS_URL` (if using Redis)

## Configuration Priority

Configuration is loaded in this order (later overrides earlier):

1. Default values (hardcoded)
2. YAML file (`src/config/default.yaml`)
3. Environment variables (highest priority)

## Example: Complete Configuration File

```yaml
server:
  port: 8080
  contextPath: /mj

logging:
  level: info

mj:
  taskStore:
    type: in_memory
    timeout: 30d
  
  accountChooseRule: BestWaitIdleRule
  
  discord:
    guildId: "123456789012345678"
    channelId: "123456789012345678"
    userToken: "your_discord_token"
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    enable: true
    coreSize: 3
    queueSize: 10
    timeoutMinutes: 5
  
  accounts: []
  
  proxy:
    host: 
    port: 
  
  translateWay: null
  
  apiSecret: "your-api-secret-key"
  
  notifyHook: 
  notifyPoolSize: 10
  
  baiduTranslate:
    appid: 
    appSecret: 
  
  openai:
    gptApiUrl: 
    gptApiKey: 
    timeout: 30s
    model: gpt-3.5-turbo
    maxTokens: 2048
    temperature: 0
```

## Troubleshooting

### Common Issues

1. **"Current available account count [0]"**
   - Check that `guildId`, `channelId`, and `userToken` are correctly set
   - Verify Discord token is valid and not expired
   - Check that `enable: true` is set for the account

2. **Tasks not being processed**
   - Verify WebSocket connection is established
   - Check account is enabled and has valid credentials
   - Review logs for connection errors

3. **Translation not working**
   - Verify `translateWay` is set correctly (`BAIDU` or `GPT`)
   - Check API keys are valid (for Baidu/GPT)
   - Ensure translation service credentials are correct

4. **Redis connection issues**
   - Verify `REDIS_URL` is correct
   - Check Redis server is running and accessible
   - Ensure network connectivity between app and Redis

## Security Best Practices

1. **Never commit secrets to Git**
   - Use environment variables for sensitive data
   - Add `src/config/default.yaml` to `.gitignore` if it contains secrets
   - Use secret management services in production

2. **Use API Secret**
   - Always set `apiSecret` in production
   - Include `mj-api-secret` header in all API requests

3. **Protect Discord Token**
   - Discord tokens are sensitive - treat them like passwords
   - Rotate tokens if compromised
   - Use environment variables, not YAML files, for tokens

## Additional Resources

- [API Documentation](./api.md)
- [Discord Parameters Guide](./discord-params.md)
- [Docker Deployment Guide](./docker-start.md)
- [Railway Deployment Guide](./railway-start.md)

