#!/usr/bin/env node

/**
 * Test configuration script
 * Validates that all required configuration is present and correct
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const http = require('http');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkConfig() {
  log('\n=== Configuration Test ===\n', 'cyan');
  
  const configPath = path.join(__dirname, '../src/config/default.yaml');
  let config;
  
  try {
    if (!fs.existsSync(configPath)) {
      log('❌ Config file not found: ' + configPath, 'red');
      return false;
    }
    
    const fileContents = fs.readFileSync(configPath, 'utf8');
    config = yaml.load(fileContents);
    log('✅ Config file loaded successfully', 'green');
  } catch (error) {
    log('❌ Failed to load config file: ' + error.message, 'red');
    return false;
  }
  
  let allValid = true;
  
  // Check server configuration
  log('\n--- Server Configuration ---', 'blue');
  if (config.server?.port) {
    log(`✅ Port: ${config.server.port}`, 'green');
  } else {
    log('⚠️  Port not set (using default: 8080)', 'yellow');
  }
  
  if (config.server?.contextPath) {
    log(`✅ Context Path: ${config.server.contextPath}`, 'green');
  } else {
    log('⚠️  Context Path not set (using default: /mj)', 'yellow');
  }
  
  // Check Discord configuration
  log('\n--- Discord Configuration ---', 'blue');
  const discord = config.mj?.discord;
  
  if (discord?.guildId) {
    log(`✅ Guild ID: ${discord.guildId}`, 'green');
  } else {
    log('❌ Guild ID is missing', 'red');
    allValid = false;
  }
  
  if (discord?.channelId) {
    log(`✅ Channel ID: ${discord.channelId}`, 'green');
  } else {
    log('❌ Channel ID is missing', 'red');
    allValid = false;
  }
  
  if (discord?.userToken) {
    const tokenPreview = discord.userToken.substring(0, 20) + '...';
    log(`✅ User Token: ${tokenPreview}`, 'green');
    
    // Basic token validation
    if (discord.userToken.length < 50) {
      log('⚠️  Token seems too short, may be invalid', 'yellow');
    }
  } else {
    log('❌ User Token is missing', 'red');
    allValid = false;
  }
  
  if (discord?.enable !== undefined) {
    log(`✅ Enable: ${discord.enable}`, discord.enable ? 'green' : 'yellow');
  }
  
  if (discord?.coreSize) {
    log(`✅ Core Size: ${discord.coreSize}`, 'green');
  }
  
  // Check API Secret
  log('\n--- API Security ---', 'blue');
  if (config.mj?.apiSecret) {
    const secretPreview = config.mj.apiSecret.substring(0, 20) + '...';
    log(`✅ API Secret: ${secretPreview}`, 'green');
    
    if (config.mj.apiSecret.length < 32) {
      log('⚠️  API Secret is short, consider using a longer secret (32+ characters)', 'yellow');
    }
  } else {
    log('⚠️  API Secret not set (API will be unprotected)', 'yellow');
  }
  
  // Check task store
  log('\n--- Task Store Configuration ---', 'blue');
  const taskStore = config.mj?.taskStore;
  if (taskStore?.type) {
    log(`✅ Task Store Type: ${taskStore.type}`, 'green');
    
    if (taskStore.type === 'redis') {
      log('⚠️  Redis is configured but REDIS_URL environment variable may be needed', 'yellow');
    }
  }
  
  if (taskStore?.timeout) {
    log(`✅ Task Timeout: ${taskStore.timeout}`, 'green');
  }
  
  // Check translation
  log('\n--- Translation Configuration ---', 'blue');
  const translateWay = config.mj?.translateWay;
  if (translateWay === null || translateWay === 'null' || !translateWay) {
    log('✅ Translation: Disabled', 'green');
  } else if (translateWay === 'BAIDU') {
    log('✅ Translation: Baidu', 'green');
    if (!config.mj?.baiduTranslate?.appid || !config.mj?.baiduTranslate?.appSecret) {
      log('⚠️  Baidu translation credentials may be missing', 'yellow');
    }
  } else if (translateWay === 'GPT') {
    log('✅ Translation: GPT', 'green');
    if (!config.mj?.openai?.gptApiKey) {
      log('⚠️  GPT API key may be missing', 'yellow');
    }
  }
  
  // Check accounts
  log('\n--- Account Pool ---', 'blue');
  const accounts = config.mj?.accounts || [];
  if (accounts.length > 0) {
    log(`✅ Additional Accounts: ${accounts.length}`, 'green');
  } else {
    log('ℹ️  Using single account configuration', 'cyan');
  }
  
  log('\n=== Configuration Test Complete ===\n', 'cyan');
  
  if (allValid) {
    log('✅ All required configuration is present!', 'green');
    return true;
  } else {
    log('❌ Some required configuration is missing', 'red');
    return false;
  }
}

function testServer(port = 8080, contextPath = '/mj') {
  return new Promise((resolve) => {
    log('\n=== Testing Server Connection ===\n', 'cyan');
    
    const healthPath = `${contextPath}/health`;
    const options = {
      hostname: 'localhost',
      port: port,
      path: healthPath,
      method: 'GET',
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          log(`✅ Health check successful: ${healthPath}`, 'green');
          try {
            const response = JSON.parse(data);
            log(`✅ Response: ${JSON.stringify(response)}`, 'green');
            resolve(true);
          } catch (e) {
            log(`⚠️  Response received but not JSON: ${data}`, 'yellow');
            resolve(true);
          }
        } else {
          log(`❌ Health check failed: ${res.statusCode}`, 'red');
          log(`Response: ${data}`, 'red');
          resolve(false);
        }
      });
    });
    
    req.on('error', (error) => {
      log(`❌ Connection error: ${error.message}`, 'red');
      log('⚠️  Make sure the server is running on port ' + port, 'yellow');
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      log('❌ Request timeout', 'red');
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

async function main() {
  const configValid = checkConfig();
  
  if (!configValid) {
    log('\n⚠️  Please fix the configuration issues above before testing the server', 'yellow');
    process.exit(1);
  }
  
  // Test server if it's running
  const args = process.argv.slice(2);
  const testServerFlag = args.includes('--test-server') || args.includes('-t');
  
  if (testServerFlag) {
    await testServer();
  } else {
    log('\n💡 Tip: Run with --test-server flag to test server connection', 'cyan');
    log('   Example: node scripts/test-config.js --test-server\n', 'cyan');
  }
  
  log('\n✅ Configuration test completed!\n', 'green');
}

if (require.main === module) {
  main().catch((error) => {
    log('❌ Error: ' + error.message, 'red');
    process.exit(1);
  });
}

module.exports = { checkConfig, testServer };

