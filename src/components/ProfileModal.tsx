'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  User, 
  Mail, 
  LogOut, 
  Award, 
  Clock, 
  Users, 
  Flame, 
  Loader2, 
  CheckCircle2, 
  Edit3,
  Sparkles
} from 'lucide-react';
import { UserProfile, TaskGroup } from '../types/todo';
import { createClient } from '../utils/supabase/client';

export const AVATAR_PRESETS = [
  { id: 'rocket', emoji: '🚀', label: 'Explorador', bg: 'from-blue-600 to-indigo-600' },
  { id: 'zap', emoji: '⚡', label: 'Ágil', bg: 'from-amber-500 to-orange-600' },
  { id: 'wizard', emoji: '🧙‍♂️', label: 'Foco Supremo', bg: 'from-purple-600 to-violet-700' },
  { id: 'owl', emoji: '🦉', label: 'Sábio', bg: 'from-emerald-600 to-teal-700' },
  { id: 'robot', emoji: '🤖', label: 'Produtivo', bg: 'from-cyan-600 to-blue-700' },
  { id: 'lion', emoji: '🦁', label: 'Líder', bg: 'from-yellow-500 to-amber-600' },
  { id: 'target', emoji: '🎯', label: 'Focado', bg: 'from-rose-600 to-red-600' },
  { id: 'star', emoji: '✨', label: 'Criativo', bg: 'from-fuchsia-600 to-pink-600' },
];

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  groups: TaskGroup[];
  onUpdateProfile: (displayName: string, avatarUrl: string) => Promise<void>;
  onSignOut: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  groups,
  onUpdateProfile,
  onSignOut,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('rocket');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setSelectedAvatar(profile.avatarUrl || 'rocket');
    }
  }, [profile, isOpen]);

  if (!isOpen || !profile) return null;

  const currentPreset = AVATAR_PRESETS.find((a) => a.id === selectedAvatar) || AVATAR_PRESETS[0];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setErrorMsg('O nome de exibição não pode ficar vazio.');
      return;
    }
    setErrorMsg(null);
    setIsSaving(true);
    try {
      await onUpdateProfile(displayName.trim(), selectedAvatar);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch {
      setErrorMsg('Não foi possível salvar o perfil. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const focusHours = Math.floor((profile.focusMinutes || 0) / 60);
  const focusRemainderMinutes = (profile.focusMinutes || 0) % 60;
  const focusTimeDisplay = focusHours > 0 
    ? `${focusHours}h ${focusRemainderMinutes}m` 
    : `${focusRemainderMinutes}m`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0f1422] rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-2xl shadow-black/40 overflow-hidden">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Profile Info */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-6 border-b border-zinc-200/80 dark:border-zinc-800/80">
          <div className={`w-20 h-20 rounded-3xl bg-gradient-to-tr ${currentPreset.bg} flex items-center justify-center text-3xl shadow-xl shadow-indigo-500/20 shrink-0 transform transition-transform hover:scale-105`}>
            {currentPreset.emoji}
          </div>

          <div className="text-center sm:text-left flex-1 min-w-0">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {profile.displayName || 'Usuário'}
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <Sparkles className="w-3 h-3" /> Membro
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-center sm:justify-start gap-1.5 mt-1 truncate">
              <Mail className="w-3.5 h-3.5" />
              <span>{profile.email}</span>
            </p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center justify-center sm:justify-start gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Conta sincronizada no Supabase
            </p>
          </div>
        </div>

        {/* Personal Analytics Grid */}
        <div className="grid grid-cols-3 gap-3 my-6">
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 text-center">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-1.5">
              <Award className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-zinc-900 dark:text-zinc-100">
              {profile.completedTasksCount || 0}
            </div>
            <div className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
              Tarefas Concluídas
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 text-center">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-1.5">
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-zinc-900 dark:text-zinc-100">
              {focusTimeDisplay}
            </div>
            <div className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
              Tempo de Foco
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 text-center">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-1.5">
              <Users className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-zinc-900 dark:text-zinc-100">
              {groups.length}
            </div>
            <div className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
              Grupos Ativos
            </div>
          </div>
        </div>

        {/* Edit Profile Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-2">
              Escolha seu Avatar:
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedAvatar(preset.id)}
                  title={preset.label}
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg transition-all ${
                    selectedAvatar === preset.id
                      ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-[#0f1422] scale-110 shadow-md'
                      : 'bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-800 opacity-80 hover:opacity-100'
                  }`}
                >
                  {preset.emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
              Nome de Exibição
            </label>
            <div className="relative">
              <Edit3 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                required
                maxLength={40}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Como prefere ser chamado?"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-500 dark:text-rose-400 font-medium">
              {errorMsg}
            </p>
          )}

          {saveSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Perfil atualizado com sucesso!</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4 stroke-[2.5]" />
              )}
              <span>Salvar Alterações</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSignOut();
                onClose();
              }}
              className="py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-rose-50 hover:text-rose-600 dark:bg-zinc-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-zinc-700 dark:text-zinc-300 font-semibold text-sm transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Desconectar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
