#!/bin/bash
# ============================================================
# AnimesDigital Addon para Stremio
# Script de inicialização
# ============================================================

PORT=${PORT:-7000}
export PORT

echo ""
echo "🎌 AnimesDigital Addon para Stremio"
echo "======================================"
echo ""

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale em: https://nodejs.org"
    exit 1
fi

# Verificar se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
    echo ""
fi

echo "🚀 Iniciando servidor na porta $PORT..."
echo ""
node server.js
