import { GoogleGenerativeAI } from "@google/generative-ai";

// Kumpulan API Key yang sudah diobfuscate (disamarkan)
// Untuk menambahkan kunci baru, gunakan script encode_keys.js di folder ChatApp
const OBFUSCATED_KEYS = [
  "=EkexI0ROhjTqF3YtA3Tw9VZzEXLQZVN3kVWTpUVUlGRq5kcKNjRrpnRyEET24kU4IWQuEVQ"
];

// Helper untuk membuka samaran (deobfuscate) API Key
const getRealKeys = () => {
    try {
        if (OBFUSCATED_KEYS.length === 0) return [];
        return OBFUSCATED_KEYS.map(k => atob(k.split('').reverse().join('')));
    } catch(e) {
        console.error("Gagal membaca API Key ImoAI");
        return [];
    }
};

const getApiKeyForChat = (chatContext) => {
    const keys = getRealKeys();
    if (keys.length === 0) return null;
    
    // Algoritma Hash sederhana untuk memastikan 1 chat room selalu mendapat 1 API Key yang sama
    let hash = 0;
    for (let i = 0; i < chatContext.length; i++) {
        const char = chatContext.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    
    const index = Math.abs(hash) % keys.length;
    return keys[index];
};

export const callImoAI = async (chatContext, messageHistory, newPrompt) => {
    const apiKey = getApiKeyForChat(chatContext);
    if (!apiKey) {
        return "🤖 Mohon maaf, API Key ImoAI belum dikonfigurasi di sistem.";
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Menggunakan model Gemini 1.5 Pro
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        
        // Konversi riwayat pesan ke format Gemini
        const history = messageHistory.map(msg => ({
            role: msg.sender === 'ImoAI' ? 'model' : 'user',
            parts: [{ text: msg.text }]
        }));

        const chat = model.startChat({
            history: history,
            generationConfig: {
                maxOutputTokens: 2000,
            },
        });

        const result = await chat.sendMessage([{text: newPrompt}]);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("ImoAI Error:", error);
        return "🤖 Maaf, ImoAI sedang mengalami gangguan jaringan atau API Limit.";
    }
};
