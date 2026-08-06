-- ==========================================
-- QASHLY DATABASE MASTER SCHEMA & SECURITY
-- Target DBMS: Supabase / PostgreSQL (12+)
-- Includes: Tables, Indexes, Seed Admin, RLS Security Policies
-- ==========================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', 'public', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;

-- ------------------------------------------
-- 1. CREATE TABLES
-- ------------------------------------------

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(10) DEFAULT 'admin' NOT NULL CHECK (role IN ('admin', 'user')),
    password_hash VARCHAR(255) NOT NULL,
    security_question VARCHAR(255),
    security_answer_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_frozen BOOLEAN DEFAULT FALSE,
    base_currency VARCHAR(3) DEFAULT 'KWD',
    permissions JSONB DEFAULT '{"savingsPots": true, "budgets": true, "transactions": true, "multiAccount": true}'::jsonb
);

-- TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('expense', 'income')),
    currency VARCHAR(3) NOT NULL CHECK (currency IN ('KWD', 'INR')),
    amount NUMERIC(12, 3) NOT NULL CHECK (amount > 0),
    merchant VARCHAR(64) NOT NULL,
    date DATE NOT NULL,
    category VARCHAR(40) NOT NULL,
    account_method VARCHAR(40) DEFAULT 'KNET / Debit Card' NOT NULL,
    notes VARCHAR(220),
    reconciled BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- BUDGETS TABLE
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(3) NOT NULL CHECK (currency IN ('KWD', 'INR')),
    category VARCHAR(40) NOT NULL,
    limit_amount NUMERIC(12, 3) DEFAULT 0.000 NOT NULL CHECK (limit_amount >= 0),
    CONSTRAINT unique_user_currency_category UNIQUE (user_id, currency, category)
);

-- SAVINGS POTS TABLE
CREATE TABLE IF NOT EXISTS savings_pots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(40) NOT NULL,
    target_amount NUMERIC(12, 3) NOT NULL CHECK (target_amount > 0),
    current_amount NUMERIC(12, 3) DEFAULT 0.000 NOT NULL CHECK (current_amount >= 0),
    currency VARCHAR(3) NOT NULL CHECK (currency IN ('KWD', 'INR'))
);

-- USER ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS user_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    type VARCHAR(20) DEFAULT 'checking',
    currency VARCHAR(3) DEFAULT 'KWD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- USER SESSIONS TABLE
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ------------------------------------------
-- 2. INDEX OPTIMIZATIONS
-- ------------------------------------------
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (lower(username));
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_savings_pots_user ON savings_pots (user_id);

-- ------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) & POLICIES
-- ------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_pots ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow access to users" ON users;
CREATE POLICY "Allow access to users" ON users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow access to transactions" ON transactions;
CREATE POLICY "Allow access to transactions" ON transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow access to budgets" ON budgets;
CREATE POLICY "Allow access to budgets" ON budgets FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow access to savings_pots" ON savings_pots;
CREATE POLICY "Allow access to savings_pots" ON savings_pots FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow access to user_accounts" ON user_accounts;
CREATE POLICY "Allow access to user_accounts" ON user_accounts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow access to user_sessions" ON user_sessions;
CREATE POLICY "Allow access to user_sessions" ON user_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------
-- 4. SEED PRIMARY ADMIN ACCOUNT
-- ------------------------------------------
INSERT INTO users (id, username, name, role, password_hash, security_question, security_answer_hash, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'admin',
    'Admin',
    'admin',
    'b90707af3eb863de0f8e8a04156c279fbb8fee53eae979b9e40a2261fe42f6e9',
    'What is the name of your organization?',
    'b08b754291965a5e5d69ab21eaa8268a8baffe7a6d2ff9f0ce036978c359b292',
    CURRENT_TIMESTAMP
) ON CONFLICT (username) DO NOTHING;
