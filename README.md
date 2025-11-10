# Exho BOT 智慧LLM AI機器人

<p align="center">
  <a href="https://discord.gg/umKvqHj4DC">
    <img src="https://img.shields.io/discord/1212823415204085770?color=7289DA&label=Support&logo=discord&style=for-the-badge" alt="Discord">
  </a>
</p>

[English](README_en.md) | 中文

---

## 🌟 簡介
Exho 是一個多模態智慧 LLM AI 機器人，支援文字與圖片輸入，能與使用者互動、分析圖片、回答問題，甚至輔助程式開發與創意內容生成。  
它完全基於雲端 LLM（如 Cohere AI），無需本地模型即可運作，為 Discord、Telegram 或網頁使用者提供即時智能體驗。

---

## 🚀 主要功能
- **智慧對話**：自然語言理解與回應，模擬多種角色語氣。
- **圖片理解**：分析圖片內容、辨識文字、生成描述。
- **程式輔助**：撰寫程式範例、協助 Debug、提供建議。
- **多模型切換**：可依需求自動選擇最適合的 LLM 模型。
- **互動遊戲**：簡單文字遊戲、冒險、互動問答。
- **多模態整合**：文字＋圖片＋語音（未來擴充）模式。

---

## 🛠 安裝與部署
```bash
# 克隆倉庫
git clone https://github.com/kairo0916/ai-exho-discord-bot.git
cd exho-bot

# 安裝依賴
npm install

# 啟動機器人
node bot.js
```

## ⚙️ 設定

請按照以下步驟設定您的機器人實例。

### 步驟 1：設定 `.env` 檔案

將 `.env Example` 檔案重新命名為 `.env` 並填入所需的值。

```env
# .env

DISCORD_TOKEN=Discord-Bot-Token
COHERE_API_KEY=Cohere-api-key
URL_CHECK_API_KEY=可省略
IP_LOOKUP_API_KEY=可省略
GEMINI_API_KEY=Gemini-api-key

ADMIN_ROLE_IDS=管理員身分組數字ID

MEMORY_LIMIT=AI上下文數值，例 50

TEXT_MODEL=command-r-03-2025
VISION_MODEL=gemini-2.0-flash

BOT_VERSION=V1
SERVER_LINK=你的支援群連結

DEV_USER=開發者1號使用者ID,開發者2號使用者ID（以此類推）

BAN_CHANNEL=封鎖通知的頻道ID

PREFIX_REPLY=是否開啟回文指令
PREFIX=回文指令前綴，例填：$ 就是長這樣：$status

PTERO_API_KEY=Pterodactyl面板使用者API Key
PTERO_URL=Pterodactyl面板連結，請包含 https:// http://
SERVER_ID=Pterodactyl伺服器ID

REDIS_HOST=Redis伺服器IP
REDIS_PORT=Redis伺服器端口
REDIS_PASS=Redis伺服器密碼

DB_USER=MairaDB使用者名稱
DB_NAME=MairaDB名稱
DB_HOST=MairaDB伺服器IP
DB_PORT=MairaDB伺服器端口
DB_POOL_MAX=MairaDB連線最大數量，例如 20
```
