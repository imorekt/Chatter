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

// Fungsi untuk mencoba memanggil AI dengan API Key tertentu
const attemptCallWithKey = async (apiKey, history, newPromptFormatted, systemInstruction) => {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Sesuai permintaan: menggunakan Gemini 3.5 Flash (yg tersedia tanpa limit 0)
    const model = genAI.getGenerativeModel({ 
        model: "gemini-3.5-flash",
        systemInstruction: systemInstruction 
    });

    const chat = model.startChat({
        history: history,
        generationConfig: {
            maxOutputTokens: 2000,
        },
    });

    const result = await chat.sendMessage([{text: newPromptFormatted}]);
    const response = await result.response;
    return response.text();
};

export const callImoAI = async (chatContext, messageHistory, newPrompt, currentUser, partnerUser) => {
    const keys = getRealKeys();
    if (keys.length === 0) {
        return "Mohon maaf, API Key imo_ai belum dikonfigurasi di sistem.";
    }

    const isMoment = chatContext && chatContext.startsWith('moment-');
    let systemInstruction = `Kamu adalah Imo (Asisten AI) yang cerdas di aplikasi chatting Chatter. Kamu saat ini sedang diajak mengobrol di dalam ${isMoment ? 'kolom komentar postingan Moment' : 'chatroom'} antara kamu, ${currentUser}, dan ${partnerUser}. Tugasmu adalah ikut nimbrung membalas obrolan dengan asyik dan ramah.\n\nATURAN PENTING:\n1. GUNAKAN KATA "AKU" DAN "KAMU", JANGAN PERNAH MENGGUNAKAN KATA "LU" ATAU "GUA".\n2. JANGAN MENGGUNAKAN SIMBOL "@" ATAU "USERNAME" (seperti @admin1) UNTUK MENYEBUT NAMA ORANG. Cukup panggil nama mereka secara langsung (contoh: "Halo Budi", bukan "Halo @Budi").\n3. PERKENALKAN DIRIMU SEBAGAI "Imo" JIKA DITANYA, BUKAN SEBAGAI imo_ai ATAU USERNAME LAINNYA.\n4. Balaslah se-natural mungkin tanpa terlalu formal kecuali diminta.`;

    if (isMoment) {
        systemInstruction += `\n5. KARENA INI DI KOLOM KOMENTAR, BALASANMU HARUS SANGAT SINGKAT, PADAT, DAN LANGSUNG TO THE POINT. JANGAN PANJANG LEBAR.`;
    }

    // Konversi riwayat pesan ke format Gemini
    const history = messageHistory.map(msg => {
        let senderName = msg.sender === 'me' ? currentUser : (msg.sender === 'imo_ai' ? 'Imo' : (msg.sender_display || msg.sender || partnerUser));
        let textContent = msg.sender === 'imo_ai' ? msg.text : `[Dari ${senderName}]: ${msg.text}`;
        
        return {
            role: msg.sender === 'imo_ai' ? 'model' : 'user',
            parts: [{ text: textContent }]
        };
    });

    const newPromptFormatted = `[Dari ${currentUser}]: ${newPrompt}`;

    // Tentukan index API Key awal berdasarkan hash chatContext agar setiap room punya default key
    let hash = 0;
    for (let i = 0; i < chatContext.length; i++) {
        const char = chatContext.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    
    let startIndex = Math.abs(hash) % keys.length;
    let attempts = 0;

    // Loop mencoba (merotasi) API Key jika kena limit atau gagal
    while (attempts < keys.length) {
        const currentKeyIndex = (startIndex + attempts) % keys.length;
        const currentKey = keys[currentKeyIndex];

        try {
            console.log(`Mencoba API Key index ke-${currentKeyIndex}...`);
            const responseText = await attemptCallWithKey(currentKey, history, newPromptFormatted, systemInstruction);
            return responseText; // Jika sukses, langsung kembalikan hasil
        } catch (error) {
            console.error(`Gagal dengan API Key index ke-${currentKeyIndex}:`, error.message);
            // Lanjut ke API Key berikutnya (rotasi) jika gagal (karena limit dll)
            attempts++;
        }
    }

    // Jika semua API Key di-loop tapi gagal
    return "Maaf Kak, imo_ai saat ini sedang mengalami gangguan. Silakan coba lagi nanti ya :)";
};

