-- Migration: Add JSONB preferences to profiles table
-- This allows storing flexible user settings (notifications, privacy, etc.) without altering the table schema for each toggle.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;
