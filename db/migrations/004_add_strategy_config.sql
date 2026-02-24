-- Migration: Add strategy configuration table
-- Description: Stores strategy-specific trading parameters (product mapping, quantity multiplier, etc.)

CREATE TABLE IF NOT EXISTS strategy_config (
    id SERIAL PRIMARY KEY,
    strategy_name VARCHAR(50) UNIQUE NOT NULL,
    
    -- 商品映射設定
    source_product VARCHAR(20) NOT NULL,  -- 訊號中的商品代碼
    target_product VARCHAR(20) NOT NULL,  -- 實際下單的商品代碼
    
    -- 數量設定
    quantity_multiplier INTEGER DEFAULT 1 CHECK (quantity_multiplier > 0),  -- 口數倍數
    max_position INTEGER DEFAULT 10,  -- 最大持倉口數
    
    -- 下單參數設定
    order_type VARCHAR(1) DEFAULT 'L' CHECK (order_type IN ('L', 'M', 'P')),  -- 單別: L=限價, M=市價, P=範圍市價
    order_condition VARCHAR(1) DEFAULT 'R' CHECK (order_condition IN ('I', 'R', 'F')),  -- 委託條件: R=ROD, I=IOC, F=FOK
    dtrade VARCHAR(1) DEFAULT 'N' CHECK (dtrade IN ('Y', 'N')),  -- 當沖: Y=是, N=否
    
    -- 進場設定
    entry_order_type VARCHAR(1) DEFAULT 'L',  -- 進場單別
    entry_order_condition VARCHAR(1) DEFAULT 'R',  -- 進場委託條件
    
    -- 出場設定
    exit_order_type VARCHAR(1) DEFAULT 'M',  -- 出場單別
    exit_order_condition VARCHAR(1) DEFAULT 'I',  -- 出場委託條件
    
    -- 帳號設定
    account VARCHAR(50),  -- 使用的帳號 (若為空則使用環境變數)
    sub_account VARCHAR(10) DEFAULT '',  -- 子帳號
    
    -- 狀態
    enabled BOOLEAN DEFAULT TRUE,  -- 是否啟用此策略
    
    -- 備註
    description TEXT,  -- 策略說明
    
    -- 時間戳記
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 建立索引
CREATE INDEX idx_strategy_config_name ON strategy_config(strategy_name);
CREATE INDEX idx_strategy_config_enabled ON strategy_config(enabled);

-- 插入預設策略設定範例
INSERT INTO strategy_config (
    strategy_name, 
    source_product, 
    target_product, 
    quantity_multiplier,
    order_type,
    entry_order_type,
    exit_order_type,
    exit_order_condition,
    description
) VALUES 
(
    'TXF_vivi',
    'TXFF5',
    'TXFF5',
    1,
    'L',
    'L',
    'M',
    'I',
    '預設策略：大台轉大台，1倍口數'
),
(
    'TXF_vivi_mini',
    'TXFF5',
    'MXFF5',
    2,
    'L',
    'L',
    'M',
    'I',
    '大台訊號轉小台：訊號1口 = 實際2口小台'
),
(
    'TXF_vivi_3x',
    'TXFF5',
    'TXFF5',
    3,
    'L',
    'L',
    'M',
    'I',
    '大台3倍口數：訊號1口 = 實際3口'
)
ON CONFLICT (strategy_name) DO NOTHING;

-- 新增訊號歷史記錄表
CREATE TABLE IF NOT EXISTS signal_history (
    id SERIAL PRIMARY KEY,
    strategy_name VARCHAR(50) NOT NULL,
    
    -- 訊號內容
    signal_type VARCHAR(20) NOT NULL,  -- 訊號類型: long_entry, long_exit, short_entry, short_exit
    signal_product VARCHAR(20),  -- 訊號商品代碼
    signal_quantity INTEGER,  -- 訊號數量
    signal_price FLOAT,  -- 訊號價格
    signal_note VARCHAR(50),  -- 訊號備註
    
    -- 實際下單資訊
    actual_product VARCHAR(20),  -- 實際下單商品
    actual_quantity INTEGER,  -- 實際下單數量
    actual_bs VARCHAR(1),  -- 實際買賣別
    
    -- 處理結果
    status VARCHAR(20) NOT NULL,  -- 處理狀態: processed, ignored, failed
    order_id VARCHAR(50),  -- 關聯的訂單ID
    error_message TEXT,  -- 錯誤訊息
    
    -- 原始資料
    raw_payload JSONB,  -- 原始 webhook payload
    
    -- 時間戳記
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (strategy_name) REFERENCES strategy_config(strategy_name) ON DELETE CASCADE
);

-- 建立索引
CREATE INDEX idx_signal_history_strategy ON signal_history(strategy_name);
CREATE INDEX idx_signal_history_created_at ON signal_history(created_at DESC);
CREATE INDEX idx_signal_history_status ON signal_history(status);
