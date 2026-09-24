'use client';

import React, { useState, useRef } from 'react';
import { 
  X, 
  Check, 
  Mail, 
  LogOut, 
  Award, 
  Clock, 
  Users, 
  Loader2, 
  CheckCircle2, 
  Edit3,
  Sparkles
} from 'lucide-react';
import { UserProfile, TaskGroup } from '../types/todo';
import { useAccessibleModal } from '../hooks/useAccessibleModal';
import { AVATAR_PRESETS } from '../utils/todoConstants';

export { AVATAR_PRESETS } from '../utils/todoConstants';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  groups: TaskGroup[];
  onUpdateProfile: (displayName: string, avatarUrl: string) => Promise<void>;
  onSignOut: () => void;
}

const ProfileModalContent: React.FC<Omit<ProfileModalProps, 'profile'> & { profile: UserProfile }> = ({
  isOpen,
  onClose,
  profile,
  groups,
  onUpdateProfile,
  onSignOut,
}) => {
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [selectedAvatar, setSelectedAvatar] = useState(profile.avatarUrl || 'rocket');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Hook de acessibilidade: contenção de foco, foco inicial e devolução ao fechar
  const { modalRef } = useAccessibleModal({
    isOpen,
    onClose,
    initialFocusRef: nameInputRef,
  });

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
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao atualizar perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-zinc-900 dark:text-zinc-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h2 id="profile-modal-title" className="text-lg font-bold">
              Meu Perfil & Desempenho
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de perfil"
            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header Profile Identity */}
          <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${currentPreset.bg} flex items-center justify-center text-3xl shadow-md shrink-0`}>
              {currentPreset.emoji}
            </div>
            <div className="text-center sm:text-left overflow-hidden">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {profile.displayName || 'Usuário Sem Nome'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-center sm:justify-start gap-1.5 mt-1 truncate">
                <Mail className="w-3.5 h-3.5" />
                <span>{profile.email}</span>
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center justify-center sm:justify-start gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Conta sincronizada na nuvem
              </p>
            </div>
          </div>

          {/* Personal Analytics Grid */}
          <div className="grid grid-cols-3 gap-3 my-6">
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 text-center">
              <div className="flex items-center justify-center text-indigo-500 mb-1">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="block text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {profile.completedTasksCount || 0}
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Concluídas
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 text-center">
              <div className="flex items-center justify-center text-rose-500 mb-1">
                <Clock className="w-5 h-5" />
              </div>
              <span className="block text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {profile.focusMinutes || 0}m
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Foco Pomodoro
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 text-center">
              <div className="flex items-center justify-center text-emerald-500 mb-1">
                <Users className="w-5 h-5" />
              </div>
              <span className="block text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {groups.length}
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Grupos
              </span>
            </div>
          </div>

          {/* Edit Profile Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar Informações</span>
            </h4>

            {errorMsg && (
              <div
                role="alert"
                aria-live="assertive"
                className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs"
              >
                {errorMsg}
              </div>
            )}

            {saveSuccess && (
              <div
                role="status"
                aria-live="polite"
                className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Perfil atualizado com sucesso!</span>
              </div>
            )}

            <div>
              <label
                htmlFor="profile-display-name-input"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                Nome de Exibição
              </label>
              <input
                id="profile-display-name-input"
                ref={nameInputRef}
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Como prefere ser chamado?"
                maxLength={40}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                Escolha seu Avatar
              </label>
              <div className="grid grid-cols-4 gap-2.5">
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedAvatar(preset.id)}
                    aria-pressed={selectedAvatar === preset.id}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all ${
                      selectedAvatar === preset.id
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/30'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
                    }`}
                  >
                    <span className="text-2xl mb-1">{preset.emoji}</span>
                    <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 truncate max-w-full">
                      {preset.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Account Actions Section */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              <span>Ações da Conta</span>
            </h4>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSignOut();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Desconectar desta Conta</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  groups,
  onUpdateProfile,
  onSignOut,
}) => {
  if (!isOpen || !profile) return null;

  return (
    <ProfileModalContent
      key={profile.id}
      isOpen={isOpen}
      onClose={onClose}
      profile={profile}
      groups={groups}
      onUpdateProfile={onUpdateProfile}
      onSignOut={onSignOut}
    />
  );
};
