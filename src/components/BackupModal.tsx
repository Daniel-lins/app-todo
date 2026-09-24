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
  Layers
} from 'lucide-react';
import { TodoItem } from '../types/todo';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  todos: TodoItem[];
  onImport: (imported: TodoItem[], mode: 'replace' | 'merge') => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  todos,
  onImport,
}) => {
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [fileData, setFileData] = useState<TodoItem[] | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Export handler
  const handleExport = () => {
    try {
      const dataStr = JSON.stringify(todos, null, 2);
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
      setSuccessMsg('Backup exportado com sucesso!');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch {
      setError('Erro ao gerar arquivo de exportação.');
    }
  };

  // File selection handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccessMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          throw new Error('O arquivo deve conter uma lista JSON de tarefas.');
        }
        if (parsed.length > 0 && (!parsed[0].title || typeof parsed[0].title !== 'string')) {
          throw new Error('Formato de tarefas inválido.');
        }
        setFileData(parsed as TodoItem[]);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Arquivo JSON inválido.';
        setError(message);
        setFileData(null);
      }
    };
    reader.readAsText(file);
  };

  // Execute import
  const handleConfirmImport = () => {
    if (!fileData) return;
    try {
      onImport(fileData, importMode);
      setSuccessMsg(`${fileData.length} tarefas importadas com sucesso!`);
      setFileData(null);
      setFileName('');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1200);
    } catch {
      setError('Falha ao processar a importação.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden transition-all text-zinc-900 dark:text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Central de Backup</h3>
              <p className="text-xs text-zinc-400">Exporte ou restaure suas tarefas em formato JSON</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback banners */}
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Section 1: Export */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 mb-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Exportar Dados
              </span>
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5">
                Salvar todas as {todos.length} tarefas atuais
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">Gera um arquivo .json seguro no seu computador.</p>
            </div>
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95"
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
            Carregue um arquivo .json gerado previamente pelo AppToDo.
          </p>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />

          {!fileData ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-6 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl hover:border-purple-500 dark:hover:border-purple-400 flex flex-col items-center justify-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
            >
              <Upload className="w-6 h-6" />
              <span className="text-xs font-medium">Clique para selecionar o arquivo .json</span>
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <FileJson className="w-4 h-4 text-purple-500 flex-shrink-0" />
                  <span className="font-semibold truncate">{fileName}</span>
                  <span className="text-zinc-400 font-normal">({fileData.length} tarefas)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFileData(null);
                    setFileName('');
                  }}
                  className="text-zinc-400 hover:text-rose-500 ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Mode Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                  Como deseja importar?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setImportMode('merge')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                      importMode === 'merge'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <div className="font-bold">Mesclar</div>
                    <div className="text-[11px] font-normal opacity-80 mt-0.5">Mantém as atuais e soma as novas</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                      importMode === 'replace'
                        ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <div className="font-bold text-rose-500">Substituir</div>
                    <div className="text-[11px] font-normal opacity-80 mt-0.5">Apaga a lista atual e coloca o backup</div>
                  </button>
                </div>
              </div>

              {/* Action */}
              <button
                type="button"
                onClick={handleConfirmImport}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Confirmar Importação de {fileData.length} Tarefas</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
