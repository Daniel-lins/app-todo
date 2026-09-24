'use client';

import React, { useState } from 'react';
import { 
  X, 
  Users, 
  Plus, 
  Key, 
  Copy, 
  Check, 
  Trash2, 
  LogOut, 
  Crown, 
  Sparkles, 
  Loader2, 
  AlertCircle,
  FolderOpen,
  ArrowRight
} from 'lucide-react';
import { TaskGroup, GroupMember } from '../types/todo';
import { useAccessibleModal } from '../hooks/useAccessibleModal';

const GROUP_COLORS = [
  { name: 'Índigo', value: '#4f46e5' },
  { name: 'Esmeralda', value: '#10b981' },
  { name: 'Violeta', value: '#8b5cf6' },
  { name: 'Âmbar', value: '#f59e0b' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Ciano', value: '#06b6d4' },
];

interface GroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: TaskGroup[];
  currentGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  onCreateGroup: (name: string, description?: string, color?: string) => Promise<TaskGroup>;
  onJoinGroup: (code: string) => Promise<{ success: boolean; message: string }>;
  onLeaveGroup: (groupId: string) => Promise<void>;
  onDeleteGroup: (groupId: string) => Promise<void>;
  onFetchMembers: (groupId: string) => Promise<GroupMember[]>;
  isLoggedIn: boolean;
  onOpenAuth: () => void;
}

export const GroupsModal: React.FC<GroupsModalProps> = ({
  isOpen,
  onClose,
  groups,
  currentGroupId,
  onSelectGroup,
  onCreateGroup,
  onJoinGroup,
  onLeaveGroup,
  onDeleteGroup,
  onFetchMembers,
  isLoggedIn,
  onOpenAuth,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'join'>('list');
  const [selectedGroupDetails, setSelectedGroupDetails] = useState<TaskGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Create Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#4f46e5');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Join Form State
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinResult, setJoinResult] = useState<{ success: boolean; message: string } | null>(null);

  // Feedback State
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Hook de acessibilidade
  const { modalRef } = useAccessibleModal({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  const handleOpenGroupDetails = (group: TaskGroup) => {
    setSelectedGroupDetails(group);
    setLoadingMembers(true);
    onFetchMembers(group.id)
      .then((m) => setMembers(m))
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const created = await onCreateGroup(name.trim(), description.trim() || undefined, color);
      setName('');
      setDescription('');
      setActiveTab('list');
      handleOpenGroupDetails(created);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar grupo.';
      setCreateError(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setIsJoining(true);
    setJoinResult(null);
    try {
      const res = await onJoinGroup(inviteCode.trim());
      setJoinResult(res);
      if (res.success) {
        setInviteCode('');
        setTimeout(() => {
          setActiveTab('list');
          setJoinResult(null);
        }, 1500);
      }
    } catch {
      setJoinResult({ success: false, message: 'Erro ao tentar entrar no grupo.' });
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveOrDelete = async (group: TaskGroup) => {
    const isOwner = group.role === 'owner';
    const confirmMsg = isOwner
      ? `Tem certeza que deseja excluir o grupo "${group.name}"? Todas as tarefas deste grupo serão apagadas.`
      : `Deseja realmente sair do grupo "${group.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      if (isOwner) {
        await onDeleteGroup(group.id);
      } else {
        await onLeaveGroup(group.id);
      }
      setSelectedGroupDetails(null);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="groups-modal-title"
        className="relative w-full max-w-xl bg-white dark:bg-[#0f1422] rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-2xl shadow-black/40 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar grupos"
          className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 id="groups-modal-title" className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              Grupos Compartilhados
              <Sparkles className="w-4 h-4 text-amber-500" />
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Colabore em tarefas, projetos e metas em equipe em tempo real
            </p>
          </div>
        </div>

        {!isLoggedIn ? (
          /* Not Logged In Prompt */
          <div className="py-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Conecte sua conta para usar Grupos
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
              Para criar grupos compartilhados e convidar amigos ou equipe com código de acesso, faça login na sua conta da nuvem.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAuth();
              }}
              className="mt-6 py-2.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs shadow-md shadow-indigo-500/25 transition-all hover:scale-105 min-h-[40px]"
            >
              Entrar ou Criar Conta
            </button>
          </div>
        ) : (
          /* Logged In Content */
          <>
            {/* Tabs */}
            <div 
              role="tablist" 
              aria-label="Navegação de grupos"
              className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900/80 rounded-2xl mb-6"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'list' && !selectedGroupDetails}
                onClick={() => {
                  setActiveTab('list');
                  setSelectedGroupDetails(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all min-h-[38px] ${
                  activeTab === 'list' && !selectedGroupDetails
                    ? 'bg-white dark:bg-[#151c2e] text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                Meus Grupos ({groups.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'create'}
                onClick={() => {
                  setActiveTab('create');
                  setSelectedGroupDetails(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 min-h-[38px] ${
                  activeTab === 'create'
                    ? 'bg-white dark:bg-[#151c2e] text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                Criar Grupo
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'join'}
                onClick={() => {
                  setActiveTab('join');
                  setSelectedGroupDetails(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 min-h-[38px] ${
                  activeTab === 'join'
                    ? 'bg-white dark:bg-[#151c2e] text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                Entrar com Código
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {/* Group Details Sub-View */}
              {selectedGroupDetails ? (
                <div className="space-y-5">
                  <button
                    type="button"
                    onClick={() => setSelectedGroupDetails(null)}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 min-h-[36px]"
                  >
                    ← Voltar para lista de grupos
                  </button>

                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-md"
                          style={{ backgroundColor: selectedGroupDetails.color }}
                        >
                          {selectedGroupDetails.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                            {selectedGroupDetails.name}
                          </h3>
                          {selectedGroupDetails.description && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                              {selectedGroupDetails.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        selectedGroupDetails.role === 'owner'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}>
                        {selectedGroupDetails.role === 'owner' ? 'Proprietário' : 'Membro'}
                      </span>
                    </div>

                    {/* Invite Code Box */}
                    <div className="mt-4 p-3 rounded-xl bg-white dark:bg-[#131929] border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                      <div>
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                          Código de Convite
                        </span>
                        <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                          {selectedGroupDetails.inviteCode}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(selectedGroupDetails.inviteCode)}
                        aria-label="Copiar código de convite"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors min-h-[36px]"
                      >
                        {copiedCode === selectedGroupDetails.inviteCode ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Switch to this group button */}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectGroup(selectedGroupDetails.id);
                        onClose();
                      }}
                      className="w-full mt-4 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all min-h-[40px]"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>Abrir Espaço Deste Grupo</span>
                    </button>
                  </div>

                  {/* Members List */}
                  <div>
                    <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                      Membros do Grupo ({members.length})
                    </h4>
                    {loadingMembers ? (
                      <div className="py-4 flex items-center justify-center text-zinc-400 text-xs gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                        <span>Carregando membros...</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {members.map((m) => (
                          <div
                            key={m.id}
                            className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/70 dark:border-zinc-800/70 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                                {(m.displayName || m.email || 'M').substring(0, 1).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate block">
                                  {m.displayName || m.email}
                                </span>
                                {m.displayName && (
                                  <span className="text-[10px] text-zinc-400 truncate block">
                                    {m.email}
                                  </span>
                                )}
                              </div>
                            </div>

                            {m.role === 'owner' ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full shrink-0">
                                <Crown className="w-3 h-3" /> Dono
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full shrink-0">
                                Membro
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Danger Zone: Leave or Delete Group */}
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleLeaveOrDelete(selectedGroupDetails)}
                      className="w-full py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 font-semibold text-xs flex items-center justify-center gap-2 transition-colors min-h-[40px]"
                    >
                      {selectedGroupDetails.role === 'owner' ? (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>Excluir Grupo e Apagar Tarefas</span>
                        </>
                      ) : (
                        <>
                          <LogOut className="w-4 h-4" />
                          <span>Sair do Grupo</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : activeTab === 'list' ? (
                /* Groups List */
                <div className="space-y-3">
                  {/* Semantic Button for Personal Tasks (substitui a div clicável) */}
                  <button
                    type="button"
                    onClick={() => {
                      onSelectGroup(null);
                      onClose();
                    }}
                    aria-label="Abrir Minhas Tarefas (Espaço Pessoal)"
                    aria-pressed={currentGroupId === null}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between min-h-[44px] ${
                      currentGroupId === null
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-500/40 shadow-sm'
                        : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200/80 dark:border-zinc-800/80 hover:border-indigo-500/30 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                        <FolderOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          Minhas Tarefas (Pessoal)
                        </h3>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Seu espaço privado individual
                        </p>
                      </div>
                    </div>

                    {currentGroupId === null && (
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                        Ativo
                      </span>
                    )}
                  </button>

                  {groups.length === 0 ? (
                    <div className="py-8 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Você ainda não participa de nenhum grupo compartilhado.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('create')}
                        className="mt-3 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline min-h-[36px]"
                      >
                        + Criar seu primeiro grupo
                      </button>
                    </div>
                  ) : (
                    groups.map((group) => {
                      const isCurrent = currentGroupId === group.id;
                      return (
                        <div
                          key={group.id}
                          className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                            isCurrent
                              ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-500/40 shadow-sm'
                              : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
                          }`}
                        >
                          {/* Semantic Button for Selecting Group (substitui a div clicável) */}
                          <button
                            type="button"
                            onClick={() => {
                              onSelectGroup(group.id);
                              onClose();
                            }}
                            aria-label={`Abrir grupo: ${group.name}`}
                            aria-pressed={isCurrent}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left min-h-[40px]"
                          >
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0"
                              style={{ backgroundColor: group.color }}
                            >
                              {group.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                {group.name}
                              </h3>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                                {group.description || `Código: ${group.inviteCode}`}
                              </p>
                            </div>
                          </button>

                          <div className="flex items-center gap-2 shrink-0">
                            {isCurrent && (
                              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                                Ativo
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenGroupDetails(group)}
                              aria-label={`Gerenciar membros do grupo ${group.name}`}
                              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
                              title="Gerenciar membros e convite"
                            >
                              <Users className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : activeTab === 'create' ? (
                /* Create Group Form */
                <form onSubmit={handleCreateSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="group-create-name" className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                      Nome do Grupo *
                    </label>
                    <input
                      id="group-create-name"
                      type="text"
                      required
                      placeholder="Ex: Projeto App, Trabalho, Estudos..."
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="group-create-desc" className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                      Descrição (Opcional)
                    </label>
                    <input
                      id="group-create-desc"
                      type="text"
                      placeholder="Objetivo ou informações para os membros"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label id="group-color-picker-label" className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-2">
                      Cor de Identificação
                    </label>
                    <div 
                      role="group"
                      aria-labelledby="group-color-picker-label"
                      className="flex items-center gap-2"
                    >
                      {GROUP_COLORS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setColor(c.value)}
                          aria-label={`Cor ${c.name}`}
                          aria-pressed={color === c.value}
                          className={`w-7 h-7 rounded-full transition-transform min-h-[36px] min-w-[36px] flex items-center justify-center ${
                            color === c.value
                              ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-[#0f1422] scale-110'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c.value }}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>

                  {createError && (
                    <div role="alert" aria-live="assertive" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{createError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isCreating}
                    className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-60 min-h-[44px]"
                  >
                    {isCreating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                    )}
                    <span>Criar e Ativar Grupo</span>
                  </button>
                </form>
              ) : (
                /* Join Group Form */
                <form onSubmit={handleJoinSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="group-invite-code-input" className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                      Código de Convite do Grupo
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        id="group-invite-code-input"
                        type="text"
                        required
                        placeholder="Ex: TODO-7K9P"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        className="w-full pl-10 pr-4 py-2.5 uppercase font-mono tracking-wider rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                      Peça o código de convite ao criador do grupo.
                    </p>
                  </div>

                  {joinResult && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                        joinResult.success
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {joinResult.success ? (
                        <Check className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{joinResult.message}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isJoining}
                    className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-60 min-h-[44px]"
                  >
                    {isJoining ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Key className="w-4 h-4" />
                    )}
                    <span>Entrar no Grupo</span>
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
