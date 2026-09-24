'use client';

import React, { useState, useRef } from 'react';
import { 
  Download, 
  Upload, 
  FileJson, 
  X, 
  Check, 
  AlertCircle, 
  RefreshCw,
  AlertTriangle,
  Loader2,
  Layers,
  CheckCircle2,
  ShieldCheck,
  Info
} from 'lucide-react';
import { TodoItem } from '../types/todo';
import {
  validateAndParseBackupFile,
  generateBackupData,
  BackupValidationResult,
  MAX_BACKUP_FILE_SIZE_BYTES,
  MAX_TASKS_PER_BACKUP
} from '../utils/backupService';
import { useAccessibleModal } from '../hooks/useAccessibleModal';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  todos: TodoItem[];
  spaceName: string;
  onImport: (imported: TodoItem[], mode: 'replace' | 'merge') => Promise<void> | void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  todos,
  spaceName,
  onImport,
}) => {
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showReplaceWarning, setShowReplaceWarning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hook de acessibilidade: foco inicial, contenção de foco (focus trap) e devolução de foco
  const { modalRef } = useAccessibleModal({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  // Exportação com formato versionado (V2), livre de credenciais e tokens
  const handleExport = () => {
    try {
      const dataStr = generateBackupData(todos, spaceName);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().split('T')[0];
      const link = document.createElement('a');
      link.href = url;
      link.download = `apptodo_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccessMsg(`Backup de ${todos.length} tarefas exportado com sucesso no formato V2!`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch {
      setError('Erro ao gerar arquivo de exportação.');
    }
  };

  // Carregamento e validação exaustiva do arquivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccessMsg(null);
    setShowReplaceWarning(false);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BACKUP_FILE_SIZE_BYTES) {
      setError(`O arquivo excede o limite máximo permitido de 5 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      setValidationResult(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = validateAndParseBackupFile(text, todos);

        if (!result.valid) {
          setError(result.error || 'Arquivo de backup inválido.');
          setValidationResult(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        setValidationResult(result);
        setError(null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Falha ao processar o arquivo de backup.';
        setError(message);
        setValidationResult(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setError('Erro de leitura do arquivo.');
      setValidationResult(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  const handleResetFile = () => {
    setValidationResult(null);
    setFileName('');
    setError(null);
    setShowReplaceWarning(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Execução da importação com espera obrigatória e sem falso sucesso
  const handleConfirmImport = async (forceConfirmed = false) => {
    if (!validationResult || !validationResult.valid || validationResult.todos.length === 0) return;

    // Se o modo for substituir e ainda não houve confirmação explícita
    if (importMode === 'replace' && !forceConfirmed && todos.length > 0) {
      setShowReplaceWarning(true);
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      // Aguarda estritamente a conclusão da persistência (local e nuvem)
      await onImport(validationResult.todos, importMode);
      setSuccessMsg(
        `${validationResult.totalTasks} tarefas ${importMode === 'replace' ? 'substituídas' : 'mescladas'} com sucesso em ${spaceName}!`
      );
      handleResetFile();
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1400);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao sincronizar dados do backup.';
      setError(`Erro durante a importação: ${msg}. Os dados anteriores foram preservados.`);
      // NUNCA exibe mensagem de sucesso se ocorrer falha!
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-modal-title"
        className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden transition-all text-zinc-900 dark:text-zinc-100 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h3 id="backup-modal-title" className="text-lg font-bold">Central de Backup</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Espaço ativo: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{spaceName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar central de backup"
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback banners */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2 shrink-0"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 shrink-0"
          >
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="overflow-y-auto space-y-4 pr-1 -mr-1">
          {/* Section 1: Export */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Exportar Dados (v2)
                </span>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5">
                  Salvar todas as {todos.length} tarefas de {spaceName}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 inline" />
                  Formato seguro versionado, sem tokens ou credenciais.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95 shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Exportar</span>
              </button>
            </div>
          </div>

          {/* Section 2: Import */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Importar / Restaurar
            </span>
            <p className="text-xs text-zinc-400 mt-1 mb-3">
              Suporta backups versionados (v2) e legados (v1) de até {MAX_TASKS_PER_BACKUP} tarefas.
            </p>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />

            {!validationResult ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-6 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl hover:border-purple-500 dark:hover:border-purple-400 flex flex-col items-center justify-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
              >
                <Upload className="w-6 h-6" />
                <span className="text-xs font-medium">Clique para selecionar o arquivo .json</span>
                <span className="text-[11px] text-zinc-400">Validação completa de todas as tarefas e subtarefas</span>
              </button>
            ) : (
              <div className="space-y-4">
                {/* File Info Header */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <FileJson className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    <span className="font-semibold truncate">{fileName}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300">
                      {validationResult.version === 2 ? 'Backup v2' : 'Backup v1 (Legado)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetFile}
                    className="text-zinc-400 hover:text-rose-500 ml-2 p-1"
                    title="Remover arquivo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Prévia Completa do Backup */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
                  <div className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                      Prévia do Arquivo
                    </span>
                    <span className="text-[11px] font-normal text-zinc-400">
                      Destino: <strong className="text-indigo-600 dark:text-indigo-400">{spaceName}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                      <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        {validationResult.totalTasks}
                      </div>
                      <div className="text-[10px] text-zinc-400">Tarefas Válidas</div>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                      <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        {validationResult.totalSubTasks}
                      </div>
                      <div className="text-[10px] text-zinc-400">Subtarefas</div>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                      <div className={`font-bold text-sm ${validationResult.conflictsWithExisting > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {validationResult.conflictsWithExisting}
                      </div>
                      <div className="text-[10px] text-zinc-400">Conflitos de ID</div>
                    </div>
                  </div>

                  {/* Informações detalhadas sobre resolução de conflitos */}
                  {validationResult.conflictsWithExisting > 0 && importMode === 'merge' && (
                    <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                      <span>
                        {validationResult.conflictsWithExisting} tarefa(s) já existem com o mesmo identificador neste espaço. Ao mesclar, os itens importados receberão IDs novos exclusivos, garantindo que nada seja sobrescrito.
                      </span>
                    </div>
                  )}

                  {validationResult.duplicateIdsFound > 0 && (
                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[11px] flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-500" />
                      <span>
                        {validationResult.duplicateIdsFound} ID(s) repetidos dentro do próprio arquivo foram normalizados automaticamente.
                      </span>
                    </div>
                  )}
                </div>

                {/* Seleção do Modo de Importação */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                    Ação para o espaço <span className="text-purple-600 dark:text-purple-400">{spaceName}</span>:
                  </label>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label="Modo de importação">
                    <button
                      type="button"
                      onClick={() => {
                        setImportMode('merge');
                        setShowReplaceWarning(false);
                      }}
                      aria-pressed={importMode === 'merge'}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                        importMode === 'merge'
                          ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <div className="font-bold">Mesclar (Seguro)</div>
                      <div className="text-[11px] font-normal opacity-80 mt-0.5">
                        Mantém as {todos.length} tarefas atuais e soma as {validationResult.totalTasks} novas
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setImportMode('replace')}
                      aria-pressed={importMode === 'replace'}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                        importMode === 'replace'
                          ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <div className="font-bold text-rose-500">Substituir</div>
                      <div className="text-[11px] font-normal opacity-80 mt-0.5">
                        Remove as tarefas atuais deste espaço e insere o backup
                      </div>
                    </button>
                  </div>
                </div>

                {/* Confirmação Explícita para Substituição */}
                {showReplaceWarning && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>Confirmação Explícita de Substituição</span>
                    </div>
                    <p className="leading-relaxed">
                      Você está prestes a substituir os dados do espaço <strong className="underline">{spaceName}</strong>. 
                      Todas as <strong className="font-bold">{todos.length} tarefas existentes</strong> neste espaço serão removidas e substituídas pelas <strong className="font-bold">{validationResult.totalTasks} tarefas</strong> do backup.
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Isolamento garantido: outros espaços, outros grupos ou contas não serão afetados.
                    </p>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => setShowReplaceWarning(false)}
                        className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold text-xs hover:bg-zinc-200/50 dark:hover:bg-zinc-800 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleConfirmImport(true)}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/25 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        <span>Confirmar Substituição</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Botão de Ação Principal */}
                {!showReplaceWarning && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleConfirmImport(false)}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    <span>
                      {importMode === 'replace'
                        ? `Revisar e Substituir por ${validationResult.totalTasks} Tarefas`
                        : `Importar e Mesclar ${validationResult.totalTasks} Tarefas`}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
