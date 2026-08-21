'use client';

import React, { useState } from 'react';
import { PromptPost } from '@/types/prompt';
import { useApp } from '@/context/AppContext';
import Image from 'next/image';
import { Sparkles, Copy, Check } from 'lucide-react';
import { PersonalizationEngine } from '@/lib/personalization';

export const PromptCard = ({ post }: { post: PromptPost }) => {
  const { setSelectedPost, toggleBookmark, bookmarkedIds, copyPromptToClipboard, tasteProfile, setCurrentView } = useApp();
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
    sessionStorage.setItem('auraprompt_studio_preload', post.promptText);
    setCurrentView('studio-tool');
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
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-300 pointer-events-none" />

        {/* Top Left AI Match Badge (Subtle on hover or when high affinity) */}
        <div className="absolute top-2.5 left-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md text-white text-[10px] font-black flex items-center gap-1 shadow-md">
            <Sparkles className="w-2.5 h-2.5 text-[#ff4763]" />
            <span>{scoreData.matchPercentage}% Match</span>
          </div>
        </div>

        {/* Top Right Save Button (White on hover) */}
        <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto">
          <button
            onClick={handleBookmark}
            className={`px-4 py-2 rounded-full text-xs font-bold shadow-lg transition-all transform active:scale-95 ${
              isBookmarked
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                : 'bg-white hover:bg-neutral-100 text-neutral-900 shadow-xl'
            }`}
            title={isBookmarked ? 'Saved to board' : 'Save Pin'}
          >
            {isBookmarked ? 'Saved' : 'Save'}
          </button>
        </div>

        {/* Bottom Quick Copy & Generate Buttons on Hover */}
        <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-full bg-white text-neutral-900 hover:bg-neutral-100 backdrop-blur-md text-[11px] font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-1"
              title="Quick Copy Prompt"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>

            <button
              onClick={handleGenerateImagePrompt}
              className="px-3 py-1.5 rounded-full bg-white text-neutral-900 hover:bg-neutral-100 backdrop-blur-md text-[11px] font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-1"
              title="Generate Image with this prompt"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#E60023]" />
              <span>Generate</span>
            </button>
          </div>

          {post.aiTool && (
            <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-bold truncate max-w-[100px]">
              {post.aiTool}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};
