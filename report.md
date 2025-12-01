# 棋类对战平台设计与实现报告

<style>
.report-container { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
.section-title { border-bottom: 2px solid #2c3e50; padding-bottom: 10px; margin-top: 30px; color: #2c3e50; }
.subsection-title { color: #34495e; margin-top: 20px; }
.highlight-box { background-color: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin: 15px 0; }
.rule-box { background-color: #fff3cd; border: 1px solid #ffeeba; padding: 10px; border-radius: 5px; margin-bottom: 10px; }
.rule-title { font-weight: bold; color: #856404; }
</style>

<div class="report-container">

## 1. 项目概述 (Project Overview)

本项目旨在基于面向对象编程 (OOP) 思想，构建一个高扩展性、前后端分离的通用棋类对战平台。项目核心采用 Python 3 实现后端逻辑，通过 FastAPI 提供 RESTful 服务，前端采用 React 框架构建现代化交互界面。

系统设计严格遵循**开闭原则 (Open-Closed Principle)**，确保能够灵活扩展新的棋类游戏（如五子棋、围棋），同时保持核心架构的稳定性。

### 1.1 设计目标
*   **面向对象封装**：将棋盘、玩家、规则逻辑高度抽象化。
*   **逻辑与表现分离**：后端仅负责游戏状态的维护与规则判定，不依赖任何具体的前端实现。
*   **状态一致性**：通过统一的 `GameState` 模型和存档机制，确保前后端及持久化存储的数据一致性。

---

### 1.2 项目文件结构 (File Structure)
本项目遵循严格的工程化目录规范，前后端代码完全隔离。

```text
board_battle_project/
├── backend/                # Python 后端核心
│   ├── main.py             # FastAPI 入口与路由
│   ├── models.py           # Pydantic 数据模型 (GameState, MoveResult)
│   └── game/               # 游戏逻辑包
│       ├── base.py         # 抽象基类 (AbstractGame, AbstractBoard)
│       ├── controller.py   # 游戏控制器 (Singleton)
│       ├── go.py           # 围棋逻辑实现
│       └── gomoku.py       # 五子棋逻辑实现
└── frontend/               # React 前端
    ├── src/
    │   ├── components/     # UI 组件 (Board, GameControls)
    │   ├── services/       # API 通信服务 (api.ts)
    │   └── types.ts        # TypeScript 类型定义
    └── package.json        # 依赖配置
```

---

## 2. 棋类规则定义 (Game Rules Specification)

本平台目前支持五子棋 (Gomoku) 与围棋 (Go) 两种经典棋类。所有后端逻辑均基于以下规则严格实现。

### 2.1 五子棋 (Gomoku)
五子棋是一种两人对弈的纯策略型棋类游戏，规则简单但变化无穷。

<div class="highlight-box">
    <strong>胜利条件：</strong>
    在横、竖、斜（主对角线或副对角线）任意方向上，率先形成连续 <strong>5 个或以上</strong> 同色棋子的一方获胜。
</div>

*   **棋盘**：标准 15x15 网格（本项目支持 8x8 至 19x19 动态配置）。
*   **落子**：黑白双方交替落子，黑方先行。
*   **限制**：本项目暂不实现“三三禁手”等复杂职业规则，采用无禁手规则。
*   **平局**：若棋盘填满且无一方达成五连，则判定为平局。

### 2.2 围棋 (Go)
围棋规则远比五子棋复杂，本项目实现了基于“气 (Liberties)”与“提子 (Capturing)”的核心子集。

<div class="highlight-box">
    <strong>核心机制：</strong>
    基于“气”的生存法则。棋子必须至少有一口“气”才能留在棋盘上，否则将被提走。
</div>

#### 2.2.1 关键概念
1.  **气 (Liberties)**：一个棋子或一组相连棋子（棋链/Group）周围直接相邻的空交叉点。
2.  **棋链 (Group)**：颜色相同且在水平或垂直方向紧密相邻的棋子集合。它们共享“气”，同生共死。

#### 2.2.2 落子与提子规则
*   **基本落子**：黑白交替，落子点必须为空且在棋盘范围内。
*   **提子 (Capturing)**：
    <div class="rule-box">
        <span class="rule-title">规则：</span> 当一方落子后，使得对方的一块棋子的“气”变为 0，则该块棋子被立即“提走”（从棋盘移除），并计入俘虏数。
    </div>
*   **自杀禁手 (Suicide Move)**：
    <div class="rule-box">
        <span class="rule-title">规则：</span> 禁止在落子后，己方棋链气数为 0，且未提走任何对方棋子的情况下落子。这被称为“自杀”。（注：如果落子后虽然自己没气，但提走了对方棋子，则该落子合法）。
    </div>

#### 2.2.3 终局与胜负 (Simplified)
*   **虚着 (Pass)**：玩家可选择放弃当前回合落子。
*   **终局判断**：当双方连续进行虚着（黑方Pass -> 白方Pass）时，游戏结束。
*   **胜负计算**：采用简化版数地法 + 提子数。
    *   得分 = (围住的空地数) + (提子数) + (Komi/贴目，通常白棋+6.5)。
    *   *注：为了作业可行性，地盘判定采用简化算法：仅计算完全被单一颜色包围的空地区域。*

</div>
<div class="report-container">

## 3. 系统架构与 API 设计 (System Architecture & API Design)

本项目采用经典的三层架构模式：**前端 (Presentation Layer)**、**后端 API (Application Layer)** 和 **核心业务逻辑 (Domain Layer)**。这种分离确保了各层的解耦，提升了系统的可维护性、可扩展性和团队协作效率。

### 3.1 总体架构
<div class="highlight-box">
    <strong>设计哲学：</strong> 后端作为**无状态的计算引擎**，仅根据前端请求处理游戏逻辑和状态变更，并将结果返回。前端则负责**有状态的用户界面**，维护 UI 状态并渲染后端提供的游戏数据。
</div>
<img src="C:\Users\LENOVO\SynologyDrive\Graduation\Course\Objective\Final_Project\report\image-20251201223511281.png" alt="image-20251201223511281" style="zoom:35%;" />

<div class="subsection-title">数据流向：</div>
1.  **用户操作**：玩家通过前端 UI（如点击棋盘，点击按钮）发起游戏操作。
2.  **前端服务**：`ApiClient` (services/api.ts) 将用户操作封装为 HTTP 请求。
3.  **后端 API**：`FastAPIApp` (main.py) 接收请求，通过路由分发给相应的处理函数。
4.  **游戏控制器**：`GameCtrl` (game/controller.py) 根据 `gameId` 查找对应的游戏实例，并调用其核心逻辑方法。
5.  **核心游戏逻辑**：`GameLogic` (game/gomoku.py, game/go.py) 执行具体的落子、规则判断（如提子、胜负），更新游戏状态。
6.  **结果返回**：游戏状态 (`GameState` Pydantic 模型) 从 `GameLogic` -> `GameCtrl` -> `FastAPIApp` 逐层返回，最终以 JSON 格式响应给前端。
7.  **前端更新**：`ApiClient` 接收响应，更新前端的 `gameState`，`UI Components` 重新渲染。

### 3.2 API 接口规范 (RESTful API Specification)
后端通过 FastAPI 提供一套标准的 RESTful API。所有接口均返回 JSON 格式数据，并严格遵循 `board_battle_project/backend/models.py` 中定义的 Pydantic 模型进行请求体校验和响应序列化。

**Base URL:** `/api/game`

| 方法   | 路径                 | 功能说明                 | 请求体 (`Request Body`)                    | 响应体 (`Response Body`)                   | HTTP 状态码 |
| :----- | :------------------- | :----------------------- | :----------------------------------------- | :----------------------------------------- | :---------- |
| `POST` | `/start`             | 启动新游戏               | `GameConfig` (gameType, boardSize)         | `StartGameResponse` (gameId, state)        | `200 OK`    |
| `POST` | `/load`              | 加载游戏状态             | `LoadGameRequest` (config, state, timestamp) | `StartGameResponse` (gameId, state)        | `200 OK`    |
| `POST` | `/{gameId}/move`     | 玩家落子                 | `MakeMoveRequest` (x, y)                   | `MoveResult` (success, state, error?)      | `200 OK`    |
| `POST` | `/{gameId}/undo`     | 悔棋一步                 | 无                                         | `SimpleGameResponse` (state)               | `200 OK`    |
| `POST` | `/{gameId}/pass`     | 玩家虚着                 | `PlayerRequest` (player)                   | `SimpleGameResponse` (state)               | `200 OK`    |
| `POST` | `/{gameId}/resign`   | 玩家认输                 | `PlayerRequest` (player)                   | `SimpleGameResponse` (state)               | `200 OK`    |
| `GET`  | `/{gameId}/state`    | 获取当前游戏状态         | 无                                         | `GameState`                                | `200 OK`    |

<div class="subsection-title">错误处理：</div>
所有 API 接口在遇到业务逻辑错误（如非法落子）或系统错误时，会返回相应的 HTTP 错误状态码（如 `400 Bad Request`, `404 Not Found`, `422 Unprocessable Entity`），并在响应体中包含 `detail` 字段提供具体的错误信息。

</div>
<div class="report-container">

## 4. 面向对象设计与设计模式 (OOP & Design Patterns)

本系统并非简单的函数堆砌，而是基于严谨的面向对象设计原则构建。通过抽象基类、多态和设计模式的运用，系统实现了高内聚、低耦合的代码结构。

### 4.1 核心类设计与继承体系
系统的核心逻辑由 `AbstractGame` 和 `AbstractBoard` 定义，具体游戏（围棋、五子棋）通过继承实现差异化逻辑。

#### 4.1.1 抽象基类 (Abstract Base Classes)
*   **`AbstractBoard`**: 封装了底层的网格存储 (`_grid`) 和基础操作（如 `is_valid_coordinate`, `get_stone`）。
    *   *封装性体现*：外部无法直接修改 `_grid`，必须通过 `place_stone` 等方法操作，保证了数据安全性。
*   **`AbstractGame`**: 定义了游戏生命周期的标准接口 (`make_move`, `undo_last_move`, `check_game_over`)。
    *   *模板方法模式*：基类定义了 `get_state` 的通用逻辑，而将 `_create_board` 和 `make_move` 的具体实现留给子类，这体现了“模板方法”的思想。

#### 4.1.2 具体实现类 (Concrete Classes)
*   **`GomokuGame` (继承 `AbstractGame`)**:
    *   实现了五子连珠的胜利判定算法。
    *   禁用 `pass_turn`（五子棋不允许虚着）。
*   **`GoGame` (继承 `AbstractGame`)**:
    *   引入了“气”与“提子”的复杂逻辑。
    *   维护 `prisoners` 状态。
    *   实现了 `pass_turn` 和基于虚着的终局判定。

<img src="C:\Users\LENOVO\SynologyDrive\Graduation\Course\Objective\Final_Project\report\image-20251201223640513.png" alt="image-20251201223640513" style="zoom:33%;" />

### 4.2 SOLID 原则的应用
1.  **单一职责原则 (SRP)**:
    *   `Board` 类仅负责网格状态和边界检查。
    *   `Game` 类仅负责规则判定和流程控制。
    *   `GameController` 仅负责管理游戏实例的生命周期。
2.  **开闭原则 (OCP)**:
    *   系统对扩展开放：若要添加“国际象棋”，只需继承 `AbstractGame` 并实现规则，无需修改现有的 `GameController` 或 API 代码。
    *   系统对修改封闭：核心的 API 路由和控制器逻辑不依赖于具体游戏类型。
3.  **里氏替换原则 (LSP)**:
    *   `GomokuGame` 和 `GoGame` 可以无缝替换 `AbstractGame` 出现在任何需要游戏实例的地方（如 `GameController._active_games` 字典中）。

### 4.3 设计模式的应用

<div class="highlight-box">
    <strong>1. 单例模式 (Singleton Pattern)</strong>
    <br>
    <strong>应用类：</strong> <code>GameController</code>
    <br>
    <strong>目的：</strong> 确保整个应用程序生命周期中，只有一个控制器实例在管理所有活跃的游戏。这避免了状态分散，保证了游戏 ID 的唯一性和检索的一致性。
</div>

<div class="highlight-box">
    <strong>2. 工厂方法模式 (Factory Method Pattern)</strong>
    <br>
    <strong>应用方法：</strong> <code>GameController.create_game(type, size)</code>
    <br>
    <strong>目的：</strong> 客户端（API 层）不需要知道具体游戏类的构造细节。只需传入枚举类型 <code>GameType.GO</code>，工厂方法就会自动实例化 <code>GoGame</code> 并返回其抽象引用。这降低了层与层之间的耦合。
</div>

</div>

<div class="report-container">

## 5. 关键算法与实现细节 (Key Algorithms & Implementation)

本章深入解析后端核心逻辑的具体实现，重点阐述围棋中基于图搜索（DFS/BFS）的气数计算与提子算法，以及五子棋的线性扫描算法。

### 5.1 围棋核心算法 (Go Algorithms)
围棋逻辑的难点在于判定棋子的“死活”和处理“自杀”禁手。这本质上是一个连通分量（Connected Components）的搜索问题。

#### 5.1.1 棋链查找 (Finding Connected Groups)
为了判断一颗棋子的气，首先必须找到它所属的整个棋链。我们使用 **深度优先搜索 (DFS)** 来实现：
*   **输入**：棋盘 `grid`，起始坐标 `(x, y)`，目标颜色 `player`。
*   **过程**：
    1.  创建一个 `stack` 并压入起始点。
    2.  使用 `visited` 集合记录已访问节点。
    3.  循环弹出节点，检查其上下左右四个相邻点。
    4.  若相邻点颜色相同且未访问，则压入 `stack`。
*   **输出**：包含所有相连同色棋子的坐标集合 `Set[Tuple[int, int]]`。

```python
# 核心代码片段：基于 DFS 的连通分量搜索
def _get_connected_stones(self, x: int, y: int) -> Set[Tuple[int, int]]:
    target_player = self.board.get_stone(x, y)
    connected = set()
    stack = [(x, y)]
    while stack:
        cx, cy = stack.pop()
        if (cx, cy) in connected: continue
        connected.add((cx, cy))
        # 遍历上下左右四个方向
        for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            nx, ny = cx + dx, cy + dy
            if (self.board.is_valid_coordinate(nx, ny) and 
                self.board.get_stone(nx, ny) == target_player):
                stack.append((nx, ny))
    return connected
```

#### 5.1.2 气数计算 (Calculating Liberties)
在获得棋链后，气数计算变得直观：
*   遍历棋链中的每一个棋子。
*   检查每个棋子周围的四个相邻点。
*   若相邻点为 `None` (空)，则将其加入 `liberties` 集合。
*   **关键点**：使用 `Set` 存储气，自动去重（多个棋子可能共享同一个气）。

#### 5.1.3 提子逻辑与原子性 (Capturing & Atomicity)
提子必须是一个**原子操作**，且需要处理“落子后可能先提走对方，从而避免自己无气（自杀）”的情况。

**算法流程 (`make_move`)：**
1.  **试落子 (Trial Move)**：在内存中复制当前棋盘，尝试将棋子放入 `(x, y)`。
2.  **检查对手 (Check Opponent)**：
    *   遍历 `(x, y)` 四周的对手棋子。
    *   对每一块对手棋链计算气数。
    *   若某块棋链气数为 0，则执行 **提子**（从棋盘移除该链所有棋子），并记录提子数。
3.  **检查自身 (Check Self)**：
    *   计算当前落子所在棋链的气数。
    *   若气数为 0 且 **未提走任何对手棋子**：判定为 **自杀禁手 (Suicide)**，回滚棋盘，返回非法操作。
    *   若气数为 0 但 **提走了对手**：合法操作（“提子解禁”）。
4.  **提交 (Commit)**：若通过上述检查，更新真实棋盘，记录历史状态。

### 5.2 五子棋算法 (Gomoku Algorithms)
五子棋的判定相对简单，采用 **中心辐射扫描法**。

*   **触发时机**：每次落子 `(x, y)` 后立即检查。
*   **方向向量**：定义四个方向 `[(1,0), (0,1), (1,1), (1,-1)]`（横、竖、正斜、反斜）。
*   **扫描过程**：
    1.  对每个方向 `(dx, dy)`：
    2.  向正方向 `(x+dx, y+dy)` 延伸，计数同色棋子，直到边界或异色。
    3.  向反方向 `(x-dx, y-dy)` 延伸，计数同色棋子。
    4.  若 `正向计数 + 反向计数 + 1 (自身) >= 5`，则判定获胜。

### 5.3 悔棋实现 (Undo Mechanism)
为了实现可靠的悔棋，系统维护了一个 **状态栈 (`history`)**。
*   `history` 是一个 `List[BoardGrid]`，存储了每一步落子**后**的完整棋盘快照。
*   **悔棋操作**：
    1.  检查栈长度（至少需保留初始空盘）。
    2.  `pop` 出栈顶元素（当前状态）。
    3.  读取新的栈顶元素作为当前棋盘。
    4.  切换 `current_player`。
*   *优点*：以空间换时间，实现简单且不易出错（无需编写复杂的逆向操作逻辑）。

</div>

<div class="report-container">

## 6. UML 建模 (UML Modeling)

为了更直观地展示系统的结构和行为，我们使用 PlantUML 绘制了类图和关键业务流程的时序图。

### 6.1 系统类图 (Class Diagram)
下图展示了后端核心类之间的静态关系，清晰地体现了继承、组合和关联关系。

<img src="C:\Users\LENOVO\SynologyDrive\Graduation\Course\Objective\Final_Project\report\image-20251201223716925.png" alt="image-20251201223716925" style="zoom:33%;" />

### 6.2 游戏状态流转图 (State Diagram)
下图展示了游戏在不同阶段的状态变迁逻辑。

<img src="C:\Users\LENOVO\SynologyDrive\Graduation\Course\Objective\Final_Project\report\image-20251201224658187.png" alt="image-20251201224658187" style="zoom:33%;" />

### 6.3 落子操作时序图 (Sequence Diagram: Make Move)
下图展示了从客户端发起“落子”请求到后端处理并返回结果的完整时序流程。

<img src="C:\Users\LENOVO\SynologyDrive\Graduation\Course\Objective\Final_Project\report\image-20251201223745226.png" alt="image-20251201223745226" style="zoom:50%;" />

</div>

<div class="report-container">

## 7. 测试场景与验证 (Test Scenarios & Verification)

为了验证系统逻辑的正确性，我们设计了以下针对性的测试用例，覆盖了核心规则的边界情况。

### 7.1 场景一：围棋提子逻辑 (Go Capture)
**目标**：验证落子后能正确识别无气的敌方棋子并将其移除。

**测试输入**：
1.  **初始状态**：棋盘中央，白子被黑子包围，仅剩上方一口气。
    ```text
       B
    B  W  .
       B
    ```
2.  **操作**：黑方落子于白子上方 `(x, y)`。

**预期结果**：
*   白子气数降为 0，被提走。
*   黑方落子成功，且俘虏数 +1。
*   棋盘状态更新为：
    ```text
       B
    B  .  B
       B
    ```

**实际 API 响应验证**：
```json
// POST /move response
{
  "success": true,
  "state": {
    "grid": [ ... [null, "BLACK", null] ... ], // 中间位置变为空
    "prisoners": { "BLACK": 1, "WHITE": 0 },
    "message": "BLACK's turn. Captured 1 stones."
  }
}
```

### 7.2 场景二：围棋自杀禁手 (Go Suicide)
**目标**：验证系统能识别并阻止“自杀”行为。

**测试输入**：
1.  **初始状态**：黑子被白子完全包围，内部有一个空眼。
    ```text
       W
    W  .  W
       W
    ```
2.  **操作**：黑方试图填入该眼。

**预期结果**：
*   黑方落子后，气数为 0，且未提走任何白子。
*   操作被判定为非法。

**实际 API 响应验证**：
```json
// POST /move response
{
  "success": false,
  "error": "Invalid move: Suicide move (no liberties and no captures)."
}
```

### 7.3 场景三：五子棋五连胜 (Gomoku Win)
**目标**：验证水平方向五连珠的胜利判定。

**测试输入**：
1.  **初始状态**：黑方在第 10 行已连落 4 子 `(0,10), (1,10), (2,10), (3,10)`。
2.  **操作**：黑方落子于 `(4, 10)`。

**预期结果**：
*   系统检测到横向 5 子相连。
*   游戏结束，黑方获胜。

**实际 API 响应验证**：
```json
{
  "success": true,
  "state": {
    "isGameOver": true,
    "winner": "BLACK",
    "message": "BLACK wins!"
  }
}
```

### 7.4 场景四：围棋“提子解禁” (Go: Capture to Live)
**目标**：验证“看似自杀但实际提子”的特殊合法操作。此逻辑体现了原子性操作的重要性。

**测试输入**：
1.  **初始状态**：黑棋包围了一颗白子，但白子占据了黑棋唯一的“眼位”关键点。
    ```text
       B
    B  W  B
       B
    ```
    场景：假设中心点为空，四周是白子。黑方下在中心，虽无气，但若能提走旁边白子，则合法。
2.  **操作**：黑方落子于无气点，但该落子使相邻白子气数归零。

**预期结果**：
*   判定为合法移动（非自杀）。
*   白子被移除，黑子保留。
*   提子数更新。

**实际 API 响应验证**：
```json
{
  "success": true,
  "state": {
    "prisoners": { "BLACK": 1, "WHITE": 0 },
    "message": "BLACK's turn. Captured 1 stones."
  }
}
```

### 7.5 场景五：五子棋斜向获胜 (Gomoku: Diagonal Win)
**目标**：验证中心辐射扫描算法在对角线方向的正确性。

**测试输入**：
1.  **初始状态**：黑棋在 `(5,5), (6,6), (7,7), (8,8)` 形成四连。
2.  **操作**：黑棋落子 `(9,9)`。

**预期结果**：
*   后端检测到 `(1, 1)` 方向累计计数达到 5。
*   判定黑方胜利。

### 7.6 场景六：悔棋功能验证 (Undo Operation)
**目标**：验证状态栈 `history` 的回滚机制，确保没有“脏数据”残留。

**测试流程**：
1.  **Step 1**：黑方落子 `(10, 10)`。
    *   State: `grid[10][10] = BLACK`, `history.len = 2`
2.  **Step 2**：调用 `/undo` 接口。
    *   State: `grid[10][10] = null`, `currentPlayer = BLACK`, `history.len = 1`
3.  **Step 3**：黑方落子 `(5, 5)`。

**预期结果**：
*   悔棋后，棋盘恢复如初，`lastMove` 被清除。
*   再次落子不会受到之前已撤销落子的影响。

## 8. 总结 (Conclusion)

本项目成功实现了一个基于 Python 面向对象设计的通用棋类对战平台。
1.  **架构层面**：前后端分离架构清晰，RESTful API 接口规范，支持跨平台客户端接入。
2.  **设计层面**：充分运用了继承、多态、封装等 OOP 原则，结合单例、工厂等设计模式，保证了代码的可维护性与扩展性。
3.  **功能层面**：完整实现了五子棋与围棋（含提子、气数计算）的核心规则，具备存档、悔棋等实用功能。

未来工作中，可进一步引入网络对战（基于 WebSocket）、AI 对战（基于 Minimax 或 MCTS）以及更复杂的围棋规则（如打劫判定），将平台打造得更加完善。

</div>
