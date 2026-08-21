'use client';

import React, { useState } from 'react';
import { PromptPost } from '@/types/prompt';
import { useApp } from '@/context/AppContext';
import Image from 'next/image';
import { Sparkles, Copy, Check, Bookmark } from 'lucide-react';
import { PersonalizationEngine } from '@/lib/personalization';

export const PromptCard = ({ post }: { post: PromptPost }) => {
  const { setSelectedPost, toggleBookmark, bookmarkedIds, copyPromptToClipboard, tasteProfile, setCurrentView, showToast } = useApp();
  const [copied, setCopied] = useState(false);
  const isBookmarked = bookmarkedIds.includes(post.id);

  const scoreData = PersonalizationEngine.scorePrompt(post, tasteProfile, bookmarkedIds);

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleBookmark(post.id);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyPromptToClipboard(post.promptText, post.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateImagePrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('auraprompt_studio_preload', post.promptText);
    }
    setCurrentView('studio-tool');
    showToast('Loaded prompt into AI Studio Image Generator!');
  };

  return (
    <article
      onClick={() => setSelectedPost(post)}
      className="group relative mb-3.5 break-inside-avoid rounded-[20px] sm:rounded-[24px] overflow-hidden bg-neutral-100 dark:bg-neutral-900 cursor-pointer shadow-xs hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 select-none"
      id={`prompt-pin-${post.id}`}
      title={`${post.title} (${scoreData.matchPercentage}% Match for your taste)`}
    >
      {/* Pin Image Container */}
      <div className="relative w-full overflow-hidden">
        {post.imageUrl ? (
          <Image
            src={post.imageUrl}
            alt={post.imageAlt || post.title}
            width={600}
            height={800}
            className="w-full h-auto object-cover group-hover:scale-102 transition-transform duration-500 ease-out"
            referrerPolicy="no-referrer"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            loading="lazy"
          />
        ) : (
          <div className="w-full aspect-[3/4] flex items-center justify-center bg-gradient-to-tr from-neutral-800 to-neutral-900 text-neutral-400">
            <Sparkles className="w-8 h-8 opacity-40" />
          </div>
        )}

        {/* Pinterest Dark Hover Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 pointer-events-none" />

        {/* Top Floating Action Bar on Hover: Generate (Left) & Save (Right) in White Colour */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto">
          {/* Generate Icon Button in White */}
          <button
            type="button"
            onClick={handleGenerateImagePrompt}
            className="px-3 py-1.5 rounded-full bg-white hover:bg-neutral-100 text-neutral-900 text-xs font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-1.5"
            title="Open in AI Studio Prompt to Image Generator"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#E60023]" />
            <span>Generate</span>
          </button>

          {/* Save Icon Button in White */}
          <button
            type="button"
            onClick={handleBookmark}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-1.5 ${
              isBookmarked
                ? 'bg-white text-[#E60023] ring-1 ring-[#E60023]/20'
                : 'bg-white hover:bg-neutral-100 text-neutral-900'
            }`}
            title={isBookmarked ? 'Saved in your collection' : 'Save prompt to collection'}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-[#E60023] text-[#E60023]' : 'text-neutral-900'}`} />
            <span>{isBookmarked ? 'Saved' : 'Save'}</span>
          </button>
        </div>

        {/* Bottom Bar on Hover: Copy Button & AI Tool Badge */}
        <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-full bg-white hover:bg-neutral-100 text-neutral-900 text-xs font-bold shadow-md hover:scale-105 transition-transform flex items-center gap-1.5"
            title="Copy ready prompt"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-neutral-900" />
                <span>Copy</span>
              </>
            )}
          </button>

          {post.aiTool && (
            <span className="px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md text-white text-[10px] font-bold truncate max-w-[110px] shadow-sm">
              {post.aiTool}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};
