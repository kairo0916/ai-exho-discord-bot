# Exho BOT LLM AIBot

<p align="center">
  <a href="https://discord.gg/umKvqHj4DC">
    <img src="https://img.shields.io/discord/1212823415204085770?color=7289DA&label=Support%20Server&logo=discord&style=for-the-badge" alt="Discord">
  </a>
</p>

**[Traditional Chinese](README.md) | [English](README_en.md)**

---

## 🌟 Introduction
**Exho** is a multimodal intelligent LLM AI bot that supports both text and image input.  
It can interact naturally with users, analyze images, answer questions, assist with coding, and generate creative content.  
It is entirely powered by cloud-based LLMs (such as Cohere AI), requiring no local models to operate, providing real-time intelligent experiences on Discord.

---

## 🚀 Main Features
- **Smart Conversation**: Understands and responds naturally, capable of imitating various tones or personalities.  
- **Image Understanding**: Analyzes image content, recognizes text, and generates descriptions.  
- **Coding Assistant**: Writes example code, helps debug, and provides suggestions.  
- **Multi-Model Switching**: Automatically selects the most suitable LLM model based on the situation.  
- **Interactive Games**: Simple text-based games, adventures, and interactive Q&A.  
- **Multimodal Integration**: Text + Image + Voice (planned for future expansion).

---

## 📲 Feature Showcase

![alt text](image/chat.jpg)
![alt text](image/search.jpg)
![alt text](image/image.jpg)

---

## 🔧 Getting Started

### 🖥️ System Requirements

*   **Basic Dependencies:**
    *   [Node.js 18+](https://nodejs.org/en/download)
    *   [Discord.js](https://discord.js.org/) (install using `npm install discord.js`)
    *   [`package.json`]
*   **Memory Requirements:**
    *   **RAM**: At least **500MB** recommended.

---

## 🛠 Installation & Deployment
```bash
# Run each command line by line
# Clone the repository
git clone https://github.com/kairo0916/ai-exho-discord-bot.git
cd exho-bot

# Install dependencies
npm install

# Start the bot
node bot.js
```

---

## ⚙️ Configuration

**Please follow the steps below to configure your bot.**

### Step 1: Configure the `.env` file

Rename `.env.Example` to `.env` and fill in the required values.

```env
# .env

DISCORD_TOKEN=Discord-Bot-Token
DISCORD_BOT_ID=Discord-Bot-Id
DISCORD_SECURE_KEY=Discord-Bot-Secure-Key

COHERE_API_KEY=Cohere-api-key

URL_CHECK_API_KEY=Optional
IP_LOOKUP_API_KEY=Optional

GEMINI_API_KEY=Gemini-api-key

SEARCH_API_KEY=Optional, search function is disabled if not filled in. SEARCH_ENGINE_ID=Optional, search function is disabled if not filled in.

# ============================

ADMIN_ROLE_IDS=Admin-role-ID-numbers

MEMORY_LIMIT=AI-context-limit, e.g. 50

TEXT_MODEL=command-r-03-2025
VISION_MODEL=gemini-2.0-flash

BOT_VERSION=V1
SERVER_LINK=Your-support-server-link

DEV_USER=Developer1-UserID,Developer2-UserID (and so on)

BAN_CHANNEL=Channel-ID-for-ban-notifications

PREFIX_REPLY=Enable-prefix-command-reply
PREFIX=Prefix-symbol, e.g. fill in $ so it becomes like: $status

PTERO_API_KEY=Pterodactyl-Panel-User-API-Key
PTERO_URL=Pterodactyl-Panel-URL (include https:// or http://)
SERVER_ID=Pterodactyl-Server-ID

REDIS_HOST=Redis-Server-IP
REDIS_PORT=Redis-Server-Port
REDIS_PASS=Redis-Server-Password

DB_USER=MariaDB-Username
DB_NAME=MariaDB-Database-Name
DB_HOST=MariaDB-Server-IP
DB_PORT=MariaDB-Server-Port
DB_POOL_MAX=Maximum-connection-pool, e.g. 20
```

---

### Step 2: Check your `./data` folder

**Please make sure the following files exist and contain the specified content.**

1. `banlist.json` = `[]`  
2. `report_time.json` = `{}`  
3. `last_status_message.json` = `{}`  
4. `marriage.json` = `{}`  
5. `used_command.txt` = no need to write anything, it’s automatically updated by the bot — but make sure the file exists.

---

### Step 3: Start the Bot

**After configuration, start the bot using the command below:**

```bash
node bot.js
```

---

### 📝 Note:

**You can update the bot anytime using:**

```bash
node update.js
```

---

## ℹ️ Feature Overview

**Here’s a summary of the bot’s current capabilities:**

---

### 🧠 Smart Brain
* **Description:** Uses Cohere AI for conversation, supporting context memory, long-term recall, and natural responses.

---

### 🌐 Web Search
* **Description: Performs Google searches using the Google Custom JSON API and provides analyzed results.**

---

### 👤 Memory System
* **Description: Saves long-term interactions between users and the bot to enhance contextual understanding.**

---

### 🖼️ Image Analysis
* **Description: Uses the Gemini 2.0 Flash model to analyze images. (Requires `GEMINI_API_KEY`)  
  You can modify the vision model in your `.env` file under the `VISION_MODEL` field.**

---

## The current feature set is limited — contributions and feedback are always welcome! 👍

---

### This project is protected under the MIT License.
