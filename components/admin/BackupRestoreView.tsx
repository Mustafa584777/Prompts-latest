'use client';

import React, { useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { PromptPost } from '@/types/prompt';
import {
  Download,
  Upload,
  Database,
  FileCheck,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  FileJson,
  Layers,
  Sparkles,
  ArrowRight,
  Trash2,
  Eye,
  Info
} from 'lucide-react';
import Image from 'next/image';

export const BackupRestoreView = () => {
  const { posts, restorePromptCards, showToast, refreshData } = useApp();

  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [parsedBackup, setParsedBackup] = useState<{
    version?: string;
    exportedAt?: string;
    totalPrompts: number;
    posts: PromptPost[];
    filename?: string;
  } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Export only Prompt Cards locally as JSON
  const handleDownloadBackup = async () => {
    try {
      setIsExporting(true);
      // Fetch fresh all posts or use context posts
      const res = await fetch('/api/backup', { cache: 'no-store' });
      let backupData;

      if (res.ok) {
        backupData = await res.json();
      } else {
        backupData = {
          version: '1.0',
          backupType: 'prompts_only',
          exportedAt: new Date().toISOString(),
          site: 'tool.reelz',
          totalPrompts: posts.length,
          posts: posts,
        };
      }

      // Generate local downloadable JSON file
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `prompts-backup-${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      showToast(`Prompt cards backup downloaded successfully! (${backupData.totalPrompts || posts.length} prompts)`);
    } catch (err: any) {
      console.error('Export failed:', err);
      showToast('Failed to download backup');
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Parse uploaded JSON file
  const handleFileSelect = (file: File) => {
    setParseError(null);
    if (!file.name.endsWith('.json')) {
      setParseError('Please upload a valid .json backup file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text);

        // Intelligently extract and normalize posts from any JSON backup format
        let rawList: any[] = [];
        if (Array.isArray(json)) {
          rawList = json;
        } else if (json && typeof json === 'object') {
          if (Array.isArray(json.posts)) rawList = json.posts;
          else if (Array.isArray(json.prompts)) rawList = json.prompts;
          else if (Array.isArray(json.data)) rawList = json.data;
          else if (Array.isArray(json.items)) rawList = json.items;
          else if (Array.isArray(json.cards)) rawList = json.cards;
          else if (Array.isArray(json.records)) rawList = json.records;
          else {
            rawList = Object.values(json).filter((v: any) => v && typeof v === 'object' && (v.prompt || v.promptText || v.title));
          }
        }

        const validPosts: PromptPost[] = rawList
          .map((item: any, idx: number) => {
            if (!item || typeof item !== 'object') return null;
            const promptText = (item.promptText || item.prompt || item.text || item.content || item.body || item.description || '').toString().trim();
            const title = (item.title || item.name || item.heading || item.subject || (promptText ? promptText.slice(0, 45) : `Prompt #${idx + 1}`)).toString().trim();

            if (!promptText && !title) return null;

            const id = (item.id || item._id || `prompt-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`).toString();
            const category = (item.category || item.cat || (Array.isArray(item.categories) ? item.categories[0] : null) || 'General').toString();
            const aiTool = (item.aiTool || item.tool || item.model || 'ChatGPT').toString();
            const imageUrl = (item.imageUrl || item.image || item.img || item.thumbnail || item.photo || '').toString();
            
            let tags: string[] = [];
            if (Array.isArray(item.tags)) {
              tags = item.tags.map((t: any) => String(t).trim()).filter(Boolean);
            } else if (typeof item.tags === 'string') {
              tags = item.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
            }
            if (tags.length === 0) tags = ['AI Prompt'];

            return {
              id,
              title: title || 'Untitled Prompt',
              slug: item.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
              category,
              aiTool,
              promptText: promptText || title,
              negativePrompt: (item.negativePrompt || item.negative || '').toString(),
              imageUrl,
              imageAlt: (item.imageAlt || title).toString(),
              imageFileName: item.imageFileName,
              additionalImages: Array.isArray(item.additionalImages) ? item.additionalImages : [],
              parameters: typeof item.parameters === 'object' && item.parameters ? item.parameters : {},
              variables: Array.isArray(item.variables) ? item.variables : [],
              articleContent: (item.articleContent || item.article || '').toString(),
              tags,
              status: item.status === 'draft' ? 'draft' : 'published',
              isFeatured: Boolean(item.isFeatured),
              isTrending: Boolean(item.isTrending),
              viewsCount: Number(item.viewsCount) || 0,
              copiesCount: Number(item.copiesCount) || 0,
              likesCount: Number(item.likesCount) || 0,
              createdAt: item.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              publishedAt: item.publishedAt || new Date().toISOString(),
            } as PromptPost;
          })
          .filter((p): p is PromptPost => p !== null && p.title.length > 0 && p.promptText.length > 0);

        if (validPosts.length === 0) {
          setParseError('The uploaded file does not contain any recognizable prompt cards.');
          setParsedBackup(null);
          return;
        }

        setParsedBackup({
          version: json.version || '1.0',
          exportedAt: json.exportedAt || new Date().toISOString(),
          totalPrompts: validPosts.length,
          posts: validPosts,
          filename: file.name,
        });
        showToast(`Loaded ${validPosts.length} prompts from ${file.name}`);
      } catch (err: any) {
        console.error('JSON parse error:', err);
        setParseError('Failed to parse JSON file. Ensure the file contains valid JSON formatting.');
        setParsedBackup(null);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // 3. Perform the Restore
  const handleExecuteRestore = async () => {
    if (!parsedBackup || parsedBackup.posts.length === 0) return;

    if (restoreMode === 'replace') {
      const confirmReplace = window.confirm(
        `Are you sure you want to REPLACE ALL current prompts with ${parsedBackup.totalPrompts} prompts from this backup? All existing prompts in Firestore will be replaced.`
      );
      if (!confirmReplace) return;
    }

    setIsRestoring(true);
    try {
      await restorePromptCards(parsedBackup.posts, restoreMode);
      setParsedBackup(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error(err);
    } finally {
      setIsRestoring(false);
    }
  };

  const publishedCount = posts.filter((p) => p.status === 'published').length;
  const draftCount = posts.filter((p) => p.status === 'draft').length;

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-neutral-900 dark:text-white flex items-center gap-2.5">
            <Database className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            <span>Prompt Cards Backup & Restore</span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Download local JSON backups of prompt cards or restore them directly into your Firestore database.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshData()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-semibold transition-colors"
            title="Refresh database from cloud"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Cloud DB</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Export on Left, Import on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Download Local Backup */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Download Local Backup
                </h3>
                <p className="text-xs text-neutral-500">
                  Export only prompt cards as a standalone JSON file
                </p>
              </div>
            </div>

            {/* Current Database Summary Card */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800/80 space-y-3">
              <div className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                <span>Current Live Prompts</span>
                <span className="text-blue-600 dark:text-blue-400 font-extrabold text-sm">{posts.length}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800">
                  <span className="text-neutral-500 block">Published</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">{publishedCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800">
                  <span className="text-neutral-500 block">Drafts</span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold text-sm">{draftCount}</span>
                </div>
              </div>

              <div className="text-[11px] text-neutral-500 flex items-start gap-1.5 pt-1">
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                <span>
                  Backup contains all prompt text, images, categories, AI tools, tags, and stats.
                </span>
              </div>
            </div>

            <button
              onClick={handleDownloadBackup}
              disabled={isExporting || posts.length === 0}
              className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-98"
              id="download-backup-btn"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Generating JSON File...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Prompts Backup (.json)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Restore From Local JSON */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Restore Prompts from Backup
                </h3>
                <p className="text-xs text-neutral-500">
                  Upload a previously downloaded JSON file to restore prompt cards
                </p>
              </div>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all text-center cursor-pointer flex flex-col items-center justify-center space-y-3 ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-neutral-300 dark:border-neutral-700 hover:border-blue-400 bg-neutral-50/50 dark:bg-neutral-950/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />

              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <FileJson className="w-6 h-6" />
              </div>

              <div>
                <p className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white">
                  Click to select or drag & drop backup JSON file
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Accepts <code className="text-blue-500 font-mono">prompts-backup-*.json</code>
                </p>
              </div>
            </div>

            {/* Error Message */}
            {parseError && (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{parseError}</span>
              </div>
            )}

            {/* Backup Preview & Restore Actions */}
            {parsedBackup && (
              <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-4 animate-fade-in">
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-500" />
                    <span className="font-bold text-xs text-neutral-900 dark:text-white">
                      {parsedBackup.filename}
                    </span>
                  </div>
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    {parsedBackup.totalPrompts} Prompts Found
                  </span>
                </div>

                {/* Restore Mode Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
                    Select Restore Strategy
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRestoreMode('merge')}
                      className={`p-3 rounded-xl text-left border text-xs transition-all ${
                        restoreMode === 'merge'
                          ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/50 text-blue-900 dark:text-blue-100 font-bold'
                          : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-blue-600" />
                        <span>Merge / Add to Existing</span>
                      </div>
                      <p className="text-[10px] font-normal text-neutral-500 mt-1">
                        Preserves existing prompts and updates/adds imported ones.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRestoreMode('replace')}
                      className={`p-3 rounded-xl text-left border text-xs transition-all ${
                        restoreMode === 'replace'
                          ? 'border-red-600 bg-red-50/80 dark:bg-red-950/50 text-red-900 dark:text-red-100 font-bold'
                          : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        <span>Clean & Replace All</span>
                      </div>
                      <p className="text-[10px] font-normal text-neutral-500 mt-1">
                        Wipes current collection and restores exact backup.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Preview of first 3 prompts */}
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                    Backup Sample Preview
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {parsedBackup.posts.slice(0, 4).map((p, idx) => (
                      <div
                        key={p.id || idx}
                        className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 text-xs"
                      >
                        {p.imageUrl ? (
                          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 relative bg-neutral-800">
                            <Image
                              src={p.imageUrl}
                              alt={p.title}
                              fill
                              className="object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-800 shrink-0 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-neutral-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-neutral-900 dark:text-white truncate">
                            {p.title}
                          </p>
                          <span className="text-[10px] text-neutral-500">{p.category} • {p.aiTool}</span>
                        </div>
                      </div>
                    ))}
                    {parsedBackup.posts.length > 4 && (
                      <p className="text-[10px] text-neutral-400 italic text-center py-1">
                        + {parsedBackup.posts.length - 4} more prompt cards in backup
                      </p>
                    )}
                  </div>
                </div>

                {/* Execute Restore Button */}
                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setParsedBackup(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="px-4 py-2 rounded-xl bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleExecuteRestore}
                    disabled={isRestoring}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 ${
                      restoreMode === 'replace'
                        ? 'bg-red-600 hover:bg-red-700 shadow-red-600/30'
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                    }`}
                  >
                    {isRestoring ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Restoring to Cloud Database...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {restoreMode === 'replace'
                            ? `Replace All & Restore ${parsedBackup.totalPrompts} Prompts`
                            : `Merge & Restore ${parsedBackup.totalPrompts} Prompts`}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
