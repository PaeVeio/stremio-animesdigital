# 🎌 AnimesDigital Addon para Stremio

Addon não-oficial para o Stremio que busca streams diretamente do site [AnimesDigital.org](https://animesdigital.org/), com episódios corretamente numerados e atualização automática de novos episódios.

---

## ✨ Funcionalidades

- **Catálogos por gênero**: Ação, Aventura, Comédia, Romance, Fantasia, Dublado e Recentes
- **Busca de animes**: Pesquise qualquer anime disponível no site
- **Episódios numerados**: Todos os episódios exibidos com numeração correta (S01E01, S01E02, ...)
- **Atualização automática**: Novos episódios são detectados automaticamente (cache de 15 minutos)
- **Dois players**: Player 1 (HLS/m3u8 em FHD) e Player 2 como fallback
- **Metadados completos**: Poster, sinopse, gêneros, ano e estúdio

---

## 📋 Requisitos

- [Node.js](https://nodejs.org/) versão 16 ou superior
- [Stremio](https://www.stremio.com/) instalado

---

## 🚀 Instalação e Uso

### Passo 1 — Clonar/Baixar o projeto

```bash
# Se tiver git:
git clone <url-do-repositorio>
cd stremio-animesdigital

# Ou extraia o arquivo ZIP baixado
```

### Passo 2 — Instalar dependências

```bash
npm install
```

### Passo 3 — Iniciar o servidor

```bash
# Opção 1: Script de inicialização
./start.sh

# Opção 2: npm
npm start

# Opção 3: node direto
node server.js
```

O servidor iniciará na porta **7000** por padrão.

Para usar outra porta:
```bash
PORT=8080 node server.js
```

### Passo 4 — Instalar no Stremio

1. Abra o **Stremio**
2. Vá em **Configurações** (ícone de engrenagem)
3. Clique em **Addons**
4. Clique em **"Community Addons"** ou cole diretamente no campo de URL:
   ```
   http://localhost:7000/manifest.json
   ```
5. Clique em **"Install"**

---

## 🌐 Uso em Rede Local (outros dispositivos)

Para acessar o addon de outros dispositivos na mesma rede (ex: TV, celular):

1. Descubra o IP da sua máquina:
   ```bash
   # Linux/Mac
   ip addr show | grep "inet "
   
   # Windows
   ipconfig
   ```

2. Use o IP no lugar de `localhost`:
   ```
   http://192.168.1.100:7000/manifest.json
   ```

---

## 🐳 Docker (opcional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 7000
CMD ["node", "server.js"]
```

```bash
docker build -t stremio-animesdigital .
docker run -p 7000:7000 stremio-animesdigital
```

---

## ⚙️ Configuração

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `7000` | Porta do servidor HTTP |

---

## 🗂️ Estrutura do Projeto

```
stremio-animesdigital/
├── server.js      # Servidor HTTP (ponto de entrada)
├── addon.js       # Definição do addon Stremio (handlers)
├── scraper.js     # Scraper do AnimesDigital.org
├── package.json   # Dependências Node.js
├── start.sh       # Script de inicialização
└── README.md      # Este arquivo
```

---

## 🔄 Atualização Automática de Episódios

O addon usa um sistema de cache inteligente:

| Recurso | Tempo de Cache |
|---------|---------------|
| Catálogo / Recentes | 5 minutos |
| Lista de animes por gênero | 30 minutos |
| Metadados + episódios de um anime | 15 minutos |
| Streams de um episódio | 5 minutos |

Quando o cache expira, o addon busca automaticamente os dados atualizados do site, garantindo que novos episódios apareçam sem necessidade de reiniciar o servidor.

---

## 📡 Endpoints da API

| Endpoint | Descrição |
|----------|-----------|
| `GET /manifest.json` | Manifesto do addon |
| `GET /catalog/series/{catalogId}.json` | Lista de animes |
| `GET /catalog/series/{catalogId}/search={query}.json` | Busca |
| `GET /meta/series/{id}.json` | Metadados + episódios |
| `GET /stream/series/{id}.json` | Streams do episódio |

---

## ⚠️ Aviso Legal

Este addon é um projeto não-oficial e independente. Ele não armazena nenhum conteúdo de vídeo — apenas redireciona para os streams já disponíveis publicamente no site AnimesDigital.org. O uso é de responsabilidade do usuário.

---

## 🛠️ Tecnologias

- [stremio-addon-sdk](https://github.com/Stremio/stremio-addon-sdk) — SDK oficial do Stremio
- [axios](https://axios-http.com/) — Requisições HTTP
- [cheerio](https://cheerio.js.org/) — Parser HTML/scraping
- [node-cache](https://github.com/node-cache/node-cache) — Cache em memória
