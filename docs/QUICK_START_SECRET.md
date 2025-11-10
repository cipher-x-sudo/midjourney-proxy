# Quick Start: Creating an API Secret

## Step 1: Generate a Secret

Run this command to generate a secure random secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example output:**
```
4752204de413f152bc48768ccc1f155288fb6ff7e18e18d7b168757121847340
```

## Step 2: Configure the Secret

### Option A: Environment Variable (Recommended)

```bash
export MJ_API_SECRET="4752204de413f152bc48768ccc1f155288fb6ff7e18e18d7b168757121847340"
```

### Option B: YAML File (Local Development Only)

Edit `src/config/default.yaml`:

```yaml
mj:
  apiSecret: "4752204de413f152bc48768ccc1f155288fb6ff7e18e18d7b168757121847340"
```

⚠️ **Warning:** Never commit secrets to Git!

## Step 3: Use the Secret in API Requests

Include the secret in the `mj-api-secret` header:

```bash
curl -X POST http://localhost:8080/mj/submit/imagine \
  -H "Content-Type: application/json" \
  -H "mj-api-secret: 4752204de413f152bc48768ccc1f155288fb6ff7e18e18d7b168757121847340" \
  -d '{"prompt": "a beautiful landscape"}'
```

## That's It! 

Your API is now protected. Requests without the correct secret will return `401 Unauthorized`.

For more details, see [API Secret Guide](./API_SECRET_GUIDE.md).

