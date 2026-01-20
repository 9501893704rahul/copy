-- Supabase Schema for AI Paper Review
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    polar_subscription_id TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Reviews table (optional - for storing review history)
CREATE TABLE IF NOT EXISTS reviews (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    review_data JSONB
);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- Format: YYYY-MM
    review_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, month)
);

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;

-- Subscriptions policies
CREATE POLICY "Users can view own subscription" ON subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Reviews policies
CREATE POLICY "Users can view own reviews" ON reviews
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reviews" ON reviews
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews" ON reviews
    FOR DELETE USING (auth.uid() = user_id);

-- Usage policies
CREATE POLICY "Users can view own usage" ON usage
    FOR SELECT USING (auth.uid() = user_id);

-- Function to increment usage count
CREATE OR REPLACE FUNCTION increment_usage(p_user_id UUID)
RETURNS void AS $$
DECLARE
    current_month TEXT := to_char(NOW(), 'YYYY-MM');
BEGIN
    INSERT INTO usage (user_id, month, review_count)
    VALUES (p_user_id, current_month, 1)
    ON CONFLICT (user_id, month)
    DO UPDATE SET 
        review_count = usage.review_count + 1,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current month usage
CREATE OR REPLACE FUNCTION get_monthly_usage(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    current_month TEXT := to_char(NOW(), 'YYYY-MM');
    count INTEGER;
BEGIN
    SELECT review_count INTO count
    FROM usage
    WHERE user_id = p_user_id AND month = current_month;
    
    RETURN COALESCE(count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
