-- Migration: add phone column to orders table
-- Date: 2026-05-19

BEGIN;

-- Add phone column (non-nullable with default empty string)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';

COMMIT;
