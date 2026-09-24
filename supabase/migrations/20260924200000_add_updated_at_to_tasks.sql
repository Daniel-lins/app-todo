-- Migration: 20260924200000_add_updated_at_to_tasks.sql
-- Description: Adiciona coluna updated_at na tabela tasks para controle de sincronização e concorrência

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
