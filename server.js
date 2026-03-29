'use strict';

const { serveHTTP } = require('stremio-addon-sdk');
const addonInterface = require('./addon');

const PORT = process.env.PORT || 7000;

serveHTTP(addonInterface, { port: PORT });

console.log(`\n🎌 AnimesDigital Addon para Stremio rodando!`);
console.log(`📡 Endereço local: http://localhost:${PORT}/manifest.json`);
console.log(`\n📋 Para instalar no Stremio:`);
console.log(`   1. Abra o Stremio`);
console.log(`   2. Vá em Configurações > Addons`);
console.log(`   3. Clique em "Community Addons"`);
console.log(`   4. Cole a URL: http://localhost:${PORT}/manifest.json`);
console.log(`   5. Clique em "Install"\n`);
