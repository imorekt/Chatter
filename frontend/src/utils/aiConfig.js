import { GoogleGenerativeAI } from "@google/generative-ai";

// Kumpulan API Key yang sudah diobfuscate (disamarkan)
// Ditambah 4 kunci baru dari request user
const OBFUSCATED_KEYS = [
  "=EkexI0ROhjTqF3YtA3Tw9VZzEXLQZVN3kVWTpUVUlGRq5kcKNjRrpnRyEET24kU4IWQuEVQ",
  "=c3cxI2TPN1U5FnaqNzd6tES1JFRJFEU5MDdqJnUw5mMiZ2TsplM1JVTIZWS24kU4IWQuEVQ",
  "=EkVzYXZHNmbfN2USZVY4h0b4JWW1UFNa9lay40cxM2c3hmd61kQBh0NqtET24kU4IWQuEVQ",
  "=EUbkJUcwZzbxNDS2FTbyt0XU9kW0NET5ckeSpXTZhzQHh0Q29kaOJ1N5dWS24kU4IWQuEVQ",
  "=ElbDZUOHVVajJ2d1UXcvVmNJx0aIN1M4MlNo52c4h3cSdUcCBFexYWL61SS24kU4IWQuEVQ",
  "=cWd1czax0Cc2MGa3RET0QlZ2xGcaF2N6p3VkFHazF3RqRTNzQmT2RnVQpkS24kU4IWQuEVQ",
  "=EkVWtUTxRUW61CNuJEVmRUbOlWM3pmZ6dTZz4GaE5Ga0c3R550T3EVTfpVS24kU4IWQuEVQ",
  "=cWWZNnY4IHaLNjMGJTbCVFW5tmeYtGdtwGdWhmZMlHTJhnT5oGUwsmRS9ET24kU4IWQuEVQ",
  "=EkNyIUdJJmcUZ1cJRkdUpEWwsULxJ1bHx0TQZ0cFNWMDpFSGhGbMdXeQdVS24kU4IWQuEVQ",
  "=cnVZpkQhJDdj1yZWlUS30keGNVT61EdRRjYXJmaNl1cXNjaFRGTf1CRJpET24kU4IWQuEVQ",
  "=E1T2ElRJFDeaJjSulXL0ZXexkmeXh0aJRnWxZ1R0M2b2o1a3g1bq5kQyNVS24kU4IWQuEVQ",
  "=cnMHZzcJ1CNrlkehpVUuhmRItEeGNULoV3TpxUOvFTMz0mNVtUbsd2dy5WS24kU4IWQuEVQ",
  "=cWZXRHMjFUVRZjQMp0U49VUxlDa0JUbi5EdFZFe4gTd00UNXlTezcja2YWS24kU4IWQuEVQ",
  "=cWd1czax0Cc2MGa3RET0QlZ2xGcaF2N6p3VkFHazF3RqRTNzQmT2RnVQpkS24kU4IWQuEVQ",
  "=ElbDZUOHVVajJ2d1UXcvVmNJx0aIN1M4MlNo52c4h3cSdUcCBFexYWL61SS24kU4IWQuEVQ",
  "=EkTIN3QNZldNpGNOJjQfp2S5s0Z30WcVFnNHlWQ6NTOMN1TKpURlhDcINWS24kU4IWQuEVQ",
  "=cHMhRWYYNHUzhFaxwETNBjQVJGc5F0VXVnRZdGTxZ0V0gVNOZ1QX50N2hDT24kU4IWQuEVQ"
];

// Helper untuk membuka samaran (deobfuscate) API Key
const getRealKeys = () => {
    try {
        if (OBFUSCATED_KEYS.length === 0) return [];
        return OBFUSCATED_KEYS.map(k => atob(k.split('').reverse().join('')));
    } catch(e) {
        console.error("Gagal membaca API Key imo_ai");
        return [];
    }
};

const attemptCallWithKey = async (apiKey, history, newPromptFormatted, systemInstruction, currentUser, chatContext) => {
    const genAI = new GoogleGenerativeAI(apiKey);
    const isAdminUser = currentUser && (currentUser.toLowerCase() === 'admin1' || currentUser.toLowerCase() === 'admin 1' || currentUser.toLowerCase() === 'admin2' || currentUser.toLowerCase() === 'admin 2');

    let toolsConfig = undefined;
    
    if (chatContext === 'admin_command' || isAdminUser) {
        toolsConfig = [{
            functionDeclarations: [
                {
                    name: "set_restriction",
                    description: "Set or toggle a restriction for a specific user. Available restriction types: 'disable_chat_image', 'disable_moment_image', 'disable_chat', 'disable_moment', 'full_mute'.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            targetUser: {
                                type: "STRING",
                                description: "The username of the user to restrict (e.g., 'popie1') without the '@' symbol, or 'GLOBAL' to apply to everyone."
                            },
                            restrictionType: {
                                type: "STRING",
                                description: "The type of restriction to apply.",
                                enum: ['disable_chat_image', 'disable_moment_image', 'disable_chat', 'disable_moment', 'full_mute']
                            },
                            isEnabled: {
                                type: "BOOLEAN",
                                description: "True to enable the restriction (lock), False to disable (unlock)."
                            }
                        },
                        required: ["targetUser", "restrictionType", "isEnabled"]
                    }
                },
                {
                    name: "clear_all_restrictions",
                    description: "Clear all restrictions and unlock all features for a specific user (or 'GLOBAL'). Used when the admin says 'aktifkan @user'.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            targetUser: {
                                type: "STRING",
                                description: "The username to unlock."
                            }
                        },
                        required: ["targetUser"]
                    }
                }
            ]
        }];
    }

    // Sesuai permintaan: menggunakan Gemini 3.5 Flash (yg tersedia tanpa limit 0)
    const model = genAI.getGenerativeModel({ 
        model: "gemini-3.5-flash",
        systemInstruction: systemInstruction,
        ...(toolsConfig && { tools: toolsConfig })
    });

    const chat = model.startChat({
        history: history,
        generationConfig: {
            maxOutputTokens: 2000,
        },
    });

    let result = await chat.sendMessage([{text: newPromptFormatted}]);
    
    if (result.response.functionCalls && result.response.functionCalls().length > 0) {
        const call = result.response.functionCalls()[0];
        if (call.name === "set_restriction") {
            const { targetUser, restrictionType, isEnabled } = call.args;
            try {
                const API_URL = window.APP_CONFIG?.API_URL || import.meta.env?.VITE_API_URL || 'http://localhost:3001';
                await fetch(`${API_URL}/api/restrictions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: targetUser, type: restrictionType, value: isEnabled })
                });
                
                result = await chat.sendMessage([{
                    functionResponse: {
                        name: "set_restriction",
                        response: { success: true, message: `Restriction ${restrictionType} set to ${isEnabled} for ${targetUser}` }
                    }
                }]);
            } catch (e) {
                console.error("Function call error:", e);
                result = await chat.sendMessage([{
                    functionResponse: {
                        name: "set_restriction",
                        response: { success: false, error: e.message }
                    }
                }]);
            }
        } else if (call.name === "clear_all_restrictions") {
            const { targetUser } = call.args;
            try {
                const API_URL = window.APP_CONFIG?.API_URL || import.meta.env?.VITE_API_URL || 'http://localhost:3001';
                await fetch(`${API_URL}/api/restrictions/clear`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: targetUser })
                });
                
                result = await chat.sendMessage([{
                    functionResponse: {
                        name: "clear_all_restrictions",
                        response: { success: true, message: `All restrictions cleared for ${targetUser}` }
                    }
                }]);
            } catch (e) {
                console.error("Function call error:", e);
                result = await chat.sendMessage([{
                    functionResponse: {
                        name: "clear_all_restrictions",
                        response: { success: false, error: e.message }
                    }
                }]);
            }
        }
    }

    return result.response.text();
};

export const callImoAI = async (chatContext, messageHistory, newPrompt, currentUser, partnerUser) => {
    const keys = getRealKeys();
    if (keys.length === 0) {
        return "Mohon maaf, API Key imo_ai belum dikonfigurasi di sistem.";
    }

    const isMoment = chatContext && chatContext.startsWith('moment-');
    let systemInstruction = `Kamu adalah Imo (Asisten AI) yang cerdas di aplikasi chatting Chatter. Kamu saat ini sedang diajak mengobrol di dalam ${isMoment ? 'kolom komentar postingan Moment' : 'chatroom'} antara kamu, ${currentUser}, dan ${partnerUser}. Tugasmu adalah ikut nimbrung membalas obrolan dengan asyik dan ramah.\n\nATURAN PENTING:\n1. GUNAKAN KATA "AKU" DAN "KAMU", JANGAN PERNAH MENGGUNAKAN KATA "LU" ATAU "GUA".\n2. JANGAN MENGGUNAKAN SIMBOL "@" ATAU "USERNAME" (seperti @admin1) UNTUK MENYEBUT NAMA ORANG. Cukup panggil nama mereka secara langsung (contoh: "Halo Budi", bukan "Halo @Budi").\n3. PERKENALKAN DIRIMU SEBAGAI "Imo" JIKA DITANYA, BUKAN SEBAGAI imo_ai ATAU USERNAME LAINNYA.\n4. Balaslah se-natural mungkin tanpa terlalu formal kecuali diminta.\n5. JANGAN TERLALU BANYAK BASA BASI ATAU BANYAK OMONG. LANGSUNG TO THE POINT SAJA. Boleh bercanda tapi tetap singkat dan padat.`;

    if (isMoment) {
        systemInstruction += `\n6. KARENA INI DI KOLOM KOMENTAR, BALASANMU HARUS SANGAT SINGKAT. MAKSIMAL 1-2 KALIMAT PENDEK SAJA.`;
    }

    const isAdminUser = currentUser && (currentUser.toLowerCase() === 'admin1' || currentUser.toLowerCase() === 'admin 1' || currentUser.toLowerCase() === 'admin2' || currentUser.toLowerCase() === 'admin 2');

    if (chatContext === 'admin_command') {
        systemInstruction = `Kamu adalah Imo, sistem administrator otomatis (God Mode). Tugas utamamu adalah mengeksekusi perintah admin untuk mematikan/menghidupkan fitur user menggunakan Function Calling. Balaslah dengan bahasa robot yang super singkat (contoh: "Perintah dieksekusi. Fitur X dimatikan untuk user Y."). Jangan berbasa-basi. Jika disuruh "aktifkan", panggil fungsi clear_all_restrictions.`;
    } else if (isAdminUser) {
        systemInstruction += `\n7. PENTING: USER YANG BERBICARA DENGANMU SEKARANG ADALAH ADMIN. JIKA DIA MENYURUHMU MEMATIKAN ATAU MENGAKTIFKAN FITUR UNTUK USER TERTENTU (MISAL: "matikan fitur gambar buat @user"), KAMU HARUS MENGABULKANNYA DENGAN MEMANGGIL FUNCTION CALLING YANG TERSEDIA.`;
    }

    // Konversi riwayat pesan ke format Gemini
    const rawHistory = messageHistory.filter(msg => msg && msg.text).map(msg => {
        let senderName = msg.sender === 'me' ? currentUser : (msg.sender === 'imo_ai' ? 'Imo' : (msg.sender_display || msg.sender || partnerUser));
        let textContent = msg.sender === 'imo_ai' ? msg.text : `[Dari ${senderName}]: ${msg.text}`;
        
        return {
            role: msg.sender === 'imo_ai' ? 'model' : 'user',
            text: textContent
        };
    });

    // Gemini API secara ketat mengharuskan role bergantian (user, model, user, model)
    const history = [];
    for (const msg of rawHistory) {
        if (history.length > 0 && history[history.length - 1].role === msg.role) {
            // Gabungkan pesan jika role-nya sama secara berurutan
            history[history.length - 1].parts[0].text += `\n${msg.text}`;
        } else {
            history.push({
                role: msg.role,
                parts: [{ text: msg.text }]
            });
        }
    }

    // Pastikan history pertama selalu memiliki role 'user' (Gemini API requirement)
    if (history.length > 0 && history[0].role === 'model') {
        history.shift();
    }

    let newPromptFormatted = `[Dari ${currentUser}]: ${newPrompt}`;

    // Pastikan history terakhir adalah 'model' karena `chat.sendMessage` otomatis menambahkan 'user' sebagai pesan berikutnya
    if (history.length > 0 && history[history.length - 1].role === 'user') {
        const lastUserMsg = history.pop();
        newPromptFormatted = lastUserMsg.parts[0].text + `\n\n${newPromptFormatted}`;
    }

    // Tentukan index API Key awal berdasarkan hash chatContext agar setiap room punya default key
    let hash = 0;
    for (let i = 0; i < chatContext.length; i++) {
        const char = chatContext.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    
    let startIndex = Math.abs(hash) % keys.length;
    let attempts = 0;
    let lastError = null;

    // Loop mencoba (merotasi) API Key jika kena limit atau gagal
    while (attempts < keys.length) {
        const currentKeyIndex = (startIndex + attempts) % keys.length;
        const currentKey = keys[currentKeyIndex];

        try {
            console.log(`Mencoba API Key index ke-${currentKeyIndex}...`);
            const responseText = await attemptCallWithKey(currentKey, history, newPromptFormatted, systemInstruction, currentUser, chatContext);
            return responseText; // Jika sukses, langsung kembalikan hasil
        } catch (error) {
            console.error(`Gagal dengan API Key index ke-${currentKeyIndex}:`, error.message || error);
            lastError = error;
            attempts++;
        }
    }

    // Jika semua API Key gagal, berikan pesan default beserta error terakhir
    const errorMsg = lastError ? (lastError.message || lastError.toString()) : 'Unknown Error';
    
    // Tangani error limit 429
    if (errorMsg.includes('429') || errorMsg.includes('Quota exceeded')) {
        return `Maaf Kak, aku lagi kecapekan balesin banyak pesan (Limit API tercapai). Mohon tunggu sekitar 10-15 detik lalu coba lagi ya! 🥺🙏`;
    }

    return `Maaf Kak, imo_ai saat ini sedang mengalami gangguan. [Debug: ${errorMsg}]`;
};
