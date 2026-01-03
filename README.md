# 🧠 延时记 (Remember Later)

> 一个基于艾宾浩斯遗忘曲线的个人复习与记忆辅助工具。
> 拒绝遗忘，科学规划每一次复习。

![License](https://img.shields.io/badge/license-CC%20BY--NC--SA%204.0-lightgrey.svg)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Stack](https://img.shields.io/badge/stack-React%20%7C%20Node.js%20%7C%20MySQL-blue)

## 📖 项目简介

**延时记** 是一款轻量级的间隔重复记忆（Spaced Repetition）应用。与传统的死记硬背不同，它允许用户自定义复习策略（如艾宾浩斯曲线、考前突击模式等），并根据算法自动规划每一天的复习任务。

本项目适合个人部署，用于考研、语言学习或日常知识管理。

## ✨ 核心功能

* **自定义记忆算法**：内置艾宾浩斯、每日打卡、考前突击等多种策略，支持完全自定义间隔。
* **智能日历视图**：直观展示未来每一天的复习压力，自动预测复习节点。
* **错题/知识库管理**：支持增删改查，支持“毕业”机制（掌握后不再提醒或降低频率）。
* **游戏化体验**：包含等级系统（Lv.0 - Lv.15+）、连胜统计、毕业荣誉。
* **复习历史追踪**：详细记录每一次复习的结果和时间点。
* **防呆设计**：支持推迟复习、逾期自动降级惩罚等灵活设置。

## 🛠️ 技术栈

**前端 (Frontend)**
* React 19
* Vite
* React Router v7
* Lucide React (图标库)
* Day.js (日期处理)

**后端 (Backend)**
* Node.js
* Express
* MySQL (mysql2)
* JWT (鉴权) & Bcryptjs (加密)

## 🚀 部署指南 (Self-Hosting)

如果你想在自己的服务器或本地电脑上运行此项目，请按照以下步骤操作。

### 1. 环境准备
* Node.js (v16+)
* MySQL (v5.7 或 v8.0+)
* Git

### 2. 数据库设置
请登录你的 MySQL 数据库，创建一个名为 `remember_later`（或其他名字）的数据库，并执行以下 SQL 语句建立表结构：

```sql
CREATE DATABASE IF NOT EXISTS remember_later;
USE remember_later;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户设置表 (存储自定义策略)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id INT PRIMARY KEY,
  profiles JSON,
  default_id VARCHAR(50),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 题目/知识点表
CREATE TABLE IF NOT EXISTS questions (
  id BIGINT PRIMARY KEY, -- 前端生成的 ID
  user_id INT NOT NULL,
  content TEXT,
  streak INT DEFAULT 0,
  setting_id VARCHAR(50),
  next_review_date DATE,
  history JSON,
  is_graduated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

```

### 3. 后端配置与启动

1. 进入后端目录：
```bash
cd backend

```


2. 安装依赖：
```bash
npm install

```


3. 创建配置文件 `.env`：
在 `backend` 目录下新建 `.env` 文件，填入以下内容：
```env
PORT=3001
JWT_SECRET=你的超级复杂的密钥字符串

# 数据库配置
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=你的数据库密码
DB_NAME=remember_later

```


4. 启动后端：
```bash
npm start

```


*看到 "🚀 后端服务器运行在: http://localhost:3001" 即表示成功。*

### 4. 前端配置与启动

1. 进入前端目录：
```bash
cd frontend

```


2. 安装依赖：
```bash
npm install

```


3. 启动开发服务器：
```bash
npm run dev

```


4. 打开浏览器访问 `http://localhost:5173` 即可开始使用。

> **注意**：如果部署到生产环境，请运行 `npm run build` 打包前端，并将生成的 `dist` 目录托管到 Nginx 或静态资源服务器，同时确保反向代理正确指向后端 API。

## ⚠️ 版权与许可 (License)

本项目采用 **[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh)** 协议进行许可。

**这意味着：**

* ✅ **署名**：你可以自由复制、分发、修改本项目，但必须保留原作者信息。
* ✅ **相同方式共享**：如果你修改了本项目，必须使用相同的协议发布。
* ❌ **非商业性使用**：**严禁将本项目用于任何商业用途**（包括但不限于付费服务、内置广告、企业内部闭源部署等）。

**免责声明：**
本项目仅供学习和个人使用，作者不对因软件使用导致的数据丢失或其他问题承担任何责任。

---

Made with ❤️ by RoyalGraceMouth
