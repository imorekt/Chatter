const fs = require('fs');

// Masukkan API Key Gemini Pro mentah Abang di dalam array ini:
const rawKeys = [
  "ISI_API_KEY_1_DI_SINI",
  // "ISI_API_KEY_2_DI_SINI",
  // "ISI_API_KEY_3_DI_SINI",
];

console.log("Memproses dan menyamarkan API Key...\n");

const obfuscatedKeys = rawKeys.map(k => {
    // 1. Convert to Base64
    const b64 = Buffer.from(k).toString('base64');
    // 2. Reverse string
    return b64.split('').reverse().join('');
});

console.log("=== HASIL OBFUSCATE (COPY KODE DI BAWAH INI) ===\n");

let output = `const OBFUSCATED_KEYS = [\n`;
obfuscatedKeys.forEach(k => {
    output += `  "${k}",\n`;
});
output += `];\n`;

console.log(output);
console.log("Silakan timpa array OBFUSCATED_KEYS di file: frontend/src/utils/aiConfig.js dengan hasil di atas.\n");
