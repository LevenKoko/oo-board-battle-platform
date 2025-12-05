
<div align="center">

# ♟️ Zenith Board Battle Platform
### 面向对象大作业 · 第二阶段 (Phase II)

[![Python](https://img.shields.io/badge/Python-3.10-blue?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Realtime-red)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)

**一个架构优雅、功能完备的在线棋类对战平台，支持五子棋、围棋与黑白棋。**

[👀 在线演示 (Live Demo)](https://go.leven.fun) • [📺 演示视频](https://cloud.tsinghua.edu.cn/f/88b1f53d900842e7b317/) • [📄 设计报告](report.md)

</div>

---

## 📖 项目简介 (Introduction)

本项目旨在通过严格的 **面向对象 (Object-Oriented)** 设计思想，构建一个高内聚、低耦合的分布式对战系统。在第二阶段的迭代中，我们成功引入了 **实时在线对战**、**进阶 AI 策略** 以及 **复杂的房间管理系统**，攻克了断线重连、状态同步等分布式系统的经典难题。

## ✨ 核心功能 (Key Features)

### 🎮 多元化棋局体验
*   **五子棋 (Gomoku)**: 标准规则，经典对弈。
*   **围棋 (Go)**: 实现提子、气数计算与 Pass 机制。
*   **黑白棋 (Reversi)**: 复杂的夹击翻转算法与无子可下判定。

### ⚔️ 实时在线对战系统 (Online Multiplayer)
*   **房间大厅 (Lobby)**: 实时刷新的房间列表，支持创建、加入、搜索。
*   **准备大厅**: 进房后的缓冲区，支持 **阵营选择 (Switch Side)** 协商与 **准备 (Ready)** 确认。
*   **毫秒级同步**: 基于 WebSocket 的全双工通信，落子、悔棋、投降即时广播。
*   **断线保护**: 
    *   **幽灵连接复活**: 短暂断网或刷新页面后，自动恢复房间状态。
    *   **自动销毁**: 玩家全部离开后，房间自动清理，释放资源。

### 🤖 智能 AI 对手
*   **多级难度**:
    *   **Easy (Greedy)**: 基于当前盘面的贪心评估。
    *   **Medium (Minimax)**: 带有 Alpha-Beta 剪枝的博弈树搜索。
    *   **Hard (MCTS)**: 针对黑白棋优化的蒙特卡洛树搜索（基础版）。
*   **灵活配置**: 支持人机对战，甚至 **AI vs AI** 的自我博弈演示。

### 📼 存档与回放 (Save & Replay)
*   **云端存档**: 对战中途可随时保存棋局到云端，稍后在练习模式中加载继续。
*   **自动归档**: 在线对局结束后，系统自动保存回放记录。
*   **本地导入导出**: 支持标准 JSON 格式的棋谱分享。

---

## 🛠️ 技术架构 (Architecture)

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | **React + Vite** | 使用 TypeScript 构建强类型组件，TailwindCSS 负责现代化 UI。 |
| **Backend** | **FastAPI** | 高性能异步框架，完美适配 WebSocket 长连接场景。 |
| **Core Logic** | **Python (OO)** | 纯 Python 实现的领域模型 (Domain Model)，解耦于 HTTP 框架。 |
| **Persistence** | **MySQL + SQLAlchemy** | 利用 MySQL JSON 字段存储复杂的棋局历史数据。 |

### 设计模式应用
*   **策略模式 (Strategy)**: 封装不同难度的 AI 算法。
*   **模板方法 (Template Method)**: 抽象通用的游戏流程 (Move -> Check -> Switch)。
*   **单例模式 (Singleton)**: 确保 `GameController` 全局唯一，保证状态一致性。

---

## 🚀 快速开始 (Getting Started)

### 环境要求
*   Python 3.10+
*   Node.js 16+
*   MySQL Server

### 1. 启动后端 (Backend)

```bash
# 进入项目根目录
cd oo-board-battle-platform

# 1. 创建并激活虚拟环境 (推荐)
conda create -n oo-project python=3.10
conda activate oo-project

# 2. 安装依赖
pip install -r backend/requirements.txt

# 3. 配置数据库
# 修改 backend/database.py 中的 SQLALCHEMY_DATABASE_URL
# 确保 MySQL 服务已启动并创建了数据库 board_battle_db

# 4. 初始化数据库表结构
python reset_db.py

# 5. 启动服务器
uvicorn board_battle_project.backend.main:app --reload --port 8000
```

### 2. 启动前端 (Frontend)

```bash
# 进入前端目录
cd frontend

# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 即可开始对战！

---

## 📂 项目结构

```
oo-board-battle-platform/
├── backend/                 # FastAPI 后端
│   ├── ai/                  # AI 策略实现 (Strategy Pattern)
│   ├── game/                # 游戏核心逻辑 (Template Method)
│   ├── controller.py        # 全局控制器 (Singleton)
│   ├── connection_manager.py# WebSocket 广播管理
│   ├── main.py              # API 路由与 WebSocket 端点
│   └── models.py            # Pydantic 数据模型
├── frontend/                # React 前端
│   ├── src/components/      # UI 组件 (Board, Lobby, Controls)
│   ├── src/services/        # API 通信服务
│   └── src/types.ts         # 类型定义
└── report.md                # 详细设计报告
```

---

<div align="center">
    Developed with ❤️ by Leven & Koko
</div>
