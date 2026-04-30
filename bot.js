require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const token = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = '7988765012';

// polling: false — c'est server.js qui démarre le polling
const bot = new TelegramBot(token, { polling: true });

const HISTORY_FILE = './historial.json';

function loadHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE));
  } catch {
    return [];
  }
}

function saveHistory(data) {
  const history = loadHistory();
  history.push(data);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

module.exports = { bot, ADMIN_CHAT_ID, saveHistory };
