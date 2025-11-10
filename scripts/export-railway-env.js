#!/usr/bin/env node

/**
 * Export Railway environment variables from config
 * Generates commands to set environment variables in Railway
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function exportRailwayEnv() {
  const configPath = path.join(__dirname, '../src/config/default.yaml');
  
  if (!fs.existsSync(configPath)) {
    console.error('❌ Config file not found: ' + configPath);
    process.exit(1);
  }
  
  const fileContents = fs.readFileSync(configPath, 'utf8');
  const config = yaml.load(fileContents);
  
  console.log('# Railway Environment Variables\n');
  console.log('# Copy and paste these into Railway dashboard or use Railway CLI\n');
  console.log('# Required Variables:\n');
  
  // Discord configuration
  if (config.mj?.discord?.guildId) {
    console.log(`MJ_DISCORD_GUILD_ID=${config.mj.discord.guildId}`);
  }
  
  if (config.mj?.discord?.channelId) {
    console.log(`MJ_DISCORD_CHANNEL_ID=${config.mj.discord.channelId}`);
  }
  
  if (config.mj?.discord?.userToken) {
    console.log(`MJ_DISCORD_USER_TOKEN=${config.mj.discord.userToken}`);
  }
  
  // API Secret
  if (config.mj?.apiSecret) {
    console.log(`\n# API Security\n`);
    console.log(`MJ_API_SECRET=${config.mj.apiSecret}`);
  }
  
  // Server configuration
  if (config.server?.port) {
    console.log(`\n# Server Configuration (Optional)\n`);
    console.log(`PORT=${config.server.port}`);
  }
  
  // Task store
  if (config.mj?.taskStore?.type) {
    console.log(`\n# Task Store Configuration (Optional)\n`);
    console.log(`MJ_TASK_STORE_TYPE=${config.mj.taskStore.type}`);
  }
  
  if (config.mj?.taskStore?.timeout) {
    console.log(`MJ_TASK_STORE_TIMEOUT=${config.mj.taskStore.timeout}`);
  }
  
  // Translation
  if (config.mj?.translateWay && config.mj.translateWay !== 'null' && config.mj.translateWay !== null) {
    console.log(`\n# Translation Configuration (Optional)\n`);
    console.log(`MJ_TRANSLATE_WAY=${config.mj.translateWay}`);
    
    if (config.mj.translateWay === 'BAIDU') {
      if (config.mj?.baiduTranslate?.appid) {
        console.log(`MJ_BAIDU_TRANSLATE_APPID=${config.mj.baiduTranslate.appid}`);
      }
      if (config.mj?.baiduTranslate?.appSecret) {
        console.log(`MJ_BAIDU_TRANSLATE_APP_SECRET=${config.mj.baiduTranslate.appSecret}`);
      }
    } else if (config.mj.translateWay === 'GPT') {
      if (config.mj?.openai?.gptApiKey) {
        console.log(`MJ_OPENAI_GPT_API_KEY=${config.mj.openai.gptApiKey}`);
      }
      if (config.mj?.openai?.gptApiUrl) {
        console.log(`MJ_OPENAI_GPT_API_URL=${config.mj.openai.gptApiUrl}`);
      }
    }
  }
  
  // Notify hook
  if (config.mj?.notifyHook) {
    console.log(`\n# Notifications (Optional)\n`);
    console.log(`MJ_NOTIFY_HOOK=${config.mj.notifyHook}`);
  }
  
  // Load balancing
  if (config.mj?.accountChooseRule) {
    console.log(`\n# Load Balancing (Optional)\n`);
    console.log(`MJ_ACCOUNT_CHOOSE_RULE=${config.mj.accountChooseRule}`);
  }
  
  console.log('\n# Railway CLI Commands:\n');
  console.log('# railway variables set MJ_DISCORD_GUILD_ID=' + (config.mj?.discord?.guildId || 'your_guild_id'));
  console.log('# railway variables set MJ_DISCORD_CHANNEL_ID=' + (config.mj?.discord?.channelId || 'your_channel_id'));
  console.log('# railway variables set MJ_DISCORD_USER_TOKEN=' + (config.mj?.discord?.userToken ? config.mj.discord.userToken.substring(0, 20) + '...' : 'your_token'));
  if (config.mj?.apiSecret) {
    console.log('# railway variables set MJ_API_SECRET=' + config.mj.apiSecret.substring(0, 20) + '...');
  }
}

if (require.main === module) {
  exportRailwayEnv();
}

module.exports = { exportRailwayEnv };

