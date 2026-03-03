const { GoogleGenerativeAI } = require('@google/generative-ai');
const systemPrompt = require('./systemPrompt');

let genAI = null;

function getGenAI() {
  if (!genAI && process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

// Detect language from text (simple heuristic)
function detectLanguage(text) {
  const patterns = {
    japanese: /[\u3040-\u309f\u30a0-\u30ff]/,
    chinese: /[\u4e00-\u9fff]/,
    korean: /[\uac00-\ud7af\u1100-\u11ff]/,
    arabic: /[\u0600-\u06ff]/,
    russian: /[\u0400-\u04ff]/,
    hindi: /[\u0900-\u097f]/,
    spanish: /[áéíóúñü¿¡]/i,
    french: /[àâäçéèêëîïôùûüÿœæ]/i,
    german: /[äöüß]/i,
    portuguese: /[ãõç]/i,
    italian: /[àèéìíîòóùú]/i
  };

  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) {
      return lang;
    }
  }
  return 'english';
}

// Add language instruction to prompt
function getLanguageInstruction(lang) {
  const instructions = {
    japanese: 'Respond in Japanese.',
    chinese: 'Respond in Chinese (Simplified).',
    korean: 'Respond in Korean.',
    arabic: 'Respond in Arabic.',
    russian: 'Respond in Russian.',
    hindi: 'Respond in Hindi.',
    spanish: 'Respond in Spanish.',
    french: 'Respond in French.',
    german: 'Respond in German.',
    portuguese: 'Respond in Portuguese.',
    italian: 'Respond in Italian.'
  };
  return instructions[lang] || '';
}

async function sendToGemini(messages, userMessage) {
  const ai = getGenAI();
  
  if (!ai) {
    return {
      success: false,
      response: "AURIA is connecting... please try again.",
      languageCode: 'english'
    };
  }

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Detect language from user message
    const languageCode = detectLanguage(userMessage);
    const langInstruction = getLanguageInstruction(languageCode);
    
    // Build conversation history for context
    const conversationHistory = messages.map(msg => {
      const role = msg.role === 'auria' ? 'AURIA' : 'User';
      return `${role}: ${msg.content}`;
    }).join('\n\n');
    
    // Construct the full prompt
    let fullPrompt = systemPrompt;
    if (langInstruction) {
      fullPrompt += `\n\n${langInstruction}`;
    }
    
    if (conversationHistory) {
      fullPrompt += `\n\n--- Previous Conversation ---\n${conversationHistory}\n--- End of History ---`;
    }
    
    fullPrompt += `\n\n---\nUser's latest message: ${userMessage}\n\nAURIA:`;

    const result = await model.generateContent(fullPrompt);
    const response = result.response.text();
    
    return {
      success: true,
      response: response,
      languageCode: languageCode
    };
  } catch (error) {
    console.error('Gemini API Error:', error.message);
    return {
      success: false,
      response: "AURIA is connecting... please try again.",
      languageCode: 'english'
    };
  }
}

module.exports = {
  sendToGemini,
  detectLanguage
};
