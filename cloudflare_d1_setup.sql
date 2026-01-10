
-- 《无尽虚空：迷宫》 Cloudflare D1 环境初始化脚本

-- 1. 用户表：存储极简账号信息
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 存档表：玩家唯一存档，INSERT OR REPLACE 实现覆盖
CREATE TABLE IF NOT EXISTS game_saves (
    user_id INTEGER PRIMARY KEY,
    save_data TEXT NOT NULL, -- 存储整个序列化的游戏状态 JSON
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 3. 英雄榜与统计表：成功过关后记录
CREATE TABLE IF NOT EXISTS clear_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    clear_time_seconds REAL NOT NULL,
    monster_kills INTEGER NOT NULL,
    -- 扩展字段：使用 JSON 字符串存储未来可能增加的任何统计（如“拾取物品数”、“受伤次数”等）
    extra_stats TEXT DEFAULT '{}', 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 索引：加速排行榜查询
CREATE INDEX IF NOT EXISTS idx_clear_time ON clear_records(clear_time_seconds);
