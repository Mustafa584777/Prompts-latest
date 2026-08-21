'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { PromptPost } from '@/types/prompt';
import { useApp } from '@/context/AppContext';
import {
  X,
  Copy,
  Check,
  Bookmark,
  Sparkles,
  Share2,
  Calendar,
  Eye,
  HelpCircle,
  ArrowLeft,
  Heart,
  Layers,
  ChevronRight,
  Maximize2,
  Loader2,
  Sliders,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { PersonalizationEngine } from '@/lib/personalization';

export const PromptDetailModal = () => {
  const {
    selectedPost,
    setSelectedPost,
    copyPromptToClipboard,
    toggleBookmark,
    toggleLike,
    bookmarkedIds,
    posts,
    tasteProfile,
    showToast,
    setCurrentView,
  } = useApp();

  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedPinId, setCopiedPinId] = useState<string | null>(null);
  const [displayedCount, setDisplayedCount] = useState<number>(15);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [showFullImageModal, setShowFullImageModal] = useState<boolean>(false);

  // AI Prompt Variations state
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [aiVariations, setAiVariations] = useState<{
    style: string;
    description: string;
    prompt: string;
  }[] | null>(null);
  const [prevPostId, setPrevPostId] = useState<string | null>(null);

  const currentPostId = selectedPost?.id ?? null;
  // Reset variations state when active post changes during render
  if (currentPostId !== prevPostId) {
    setPrevPostId(currentPostId);
    setAiVariations(null);
    setIsGeneratingVariations(false);
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  // Reset scroll and manage body scroll lock
  useEffect(() => {
    if (selectedPost) {
      if (containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      // Lock background body scroll
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedPost]);

  // Recommendation engine: Personalized Category, Tag & Taste-based matching with strict deduplication
  const allRecommendedPins = useMemo(() => {
    if (!selectedPost) return [];

    const seenUrls = new Set<string>();
    const seenIds = new Set<string>();

    if (selectedPost.id) seenIds.add(selectedPost.id);
    if (selectedPost.imageUrl) seenUrls.add(selectedPost.imageUrl);

    const otherPublished = posts.filter((p) => {
      if (p.id === selectedPost.id || p.status !== 'published') return false;
      if (p.imageUrl && seenUrls.has(p.imageUrl)) return false;
      return true;
    });

    // 1. Scored matching based on content relevance + personalized taste profile
    const targetTags = new Set((selectedPost.tags || []).map((t) => t.toLowerCase()));
    const targetCategory = selectedPost.category?.toLowerCase();

    const scored = otherPublished.map((post) => {
      let score = 0;
      if (post.category?.toLowerCase() === targetCategory) {
        score += 15;
      }
      if (post.tags) {
        post.tags.forEach((tag) => {
          if (targetTags.has(tag.toLowerCase())) {
            score += 8;
          }
        });
      }
      if (post.aiTool === selectedPost.aiTool) {
        score += 3;
      }

      // Add AI Taste Profile personalization score
      const tasteScore = PersonalizationEngine.scorePrompt(post, tasteProfile, bookmarkedIds).score;
      score += Math.round(tasteScore / 4);

      // slight boost for popularity
      score += Math.min((post.viewsCount || 0) / 2000, 5);
      score += Math.min((post.copiesCount || 0) / 1000, 5);

      return { post, score };
    });

    // Sort by relevance score descending
    scored.sort((a, b) => b.score - a.score);
    const relevantList = scored.map((item) => item.post);

    // Combine relevant items and deduplicate strictly
    const combined: PromptPost[] = [];

    relevantList.forEach((p) => {
      if (
        !seenIds.has(p.id) &&
        (!p.imageUrl || !seenUrls.has(p.imageUrl))
      ) {
        seenIds.add(p.id);
        if (p.imageUrl) seenUrls.add(p.imageUrl);
        combined.push(p);
      }
    });

    return combined;
  }, [selectedPost, posts, tasteProfile, bookmarkedIds]);

  const hasMorePins = displayedCount < allRecommendedPins.length;

  // Infinite scroll loader trigger
  const loadMorePins = useCallback(() => {
    if (isLoadingMore || !hasMorePins) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setDisplayedCount((prev) => prev + 10);
      setIsLoadingMore(false);
    }, 300);
  }, [isLoadingMore, hasMorePins]);

  // Intersection observer for bottom sentinel
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    if (!sentinel || !selectedPost || !hasMorePins) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMorePins();
        }
      },
      { root: containerRef.current, threshold: 0.1, rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [selectedPost, loadMorePins, displayedCount, hasMorePins]);

  if (!selectedPost) return null;

  const isBookmarked = bookmarkedIds.includes(selectedPost.id);

  const handleCopyMasterPrompt = () => {
    copyPromptToClipboard(selectedPost.promptText, selectedPost.id);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleQuickCopyPin = (e: React.MouseEvent, pin: PromptPost) => {
    e.stopPropagation();
    copyPromptToClipboard(pin.promptText, pin.id);
    setCopiedPinId(pin.id);
    setTimeout(() => setCopiedPinId(null), 2000);
  };

  const handleShare = async () => {
    const shareData = {
      title: selectedPost.title,
      text: `Check out this photo prompt: ${selectedPost.title}`,
      url: window.location.href,
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showToast('Link copied to clipboard!');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        await navigator.clipboard.writeText(window.location.href);
        showToast('Link copied to clipboard!');
      }
    }
  };

  const handleGenerateVariations = async () => {
    if (!selectedPost) return;
    setIsGeneratingVariations(true);
    try {
      const tasteSummary = PersonalizationEngine.getTasteSummary(tasteProfile);
      const res = await fetch('/api/gemini/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'prompt_variations',
          currentPost: selectedPost,
          profile: tasteSummary,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAiVariations(data.data);
      }
    } catch (e) {
      console.error('Failed to generate variations:', e);
      showToast('Could not generate variations right now');
    } finally {
      setIsGeneratingVariations(false);
    }
  };

  const handleSelectPin = (pin: PromptPost) => {
    setSelectedPost(pin);
    setDisplayedCount(15);
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Strictly non-repeating visible pins list
  const visiblePins = allRecommendedPins.slice(0, displayedCount);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 overflow-y-auto bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors flex flex-col animate-fade-in"
      id="pinterest-fullscreen-view"
    >
      {/* Top Pinterest-Style Navigation Bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-3 sm:px-6 lg:px-8 py-3 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-b border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        {/* Left: Back to explore button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedPost(null)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs sm:text-sm transition-all shadow-sm group"
            id="back-to-prompts-btn"
            title="Back to all prompts"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden sm:inline">Explore Prompts</span>
          </button>

          <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-neutral-400">
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
              {selectedPost.category}
            </span>
          </div>
        </div>

        {/* Center/Right: Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Copy in Navbar */}
          <button
            onClick={handleCopyMasterPrompt}
            className={`flex items-center gap-1.5 px-3.5 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold shadow-md transition-all ${
              copiedPrompt
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100'
            }`}
            title="Copy Master Prompt"
          >
            {copiedPrompt ? (
              <>
                <Check className="w-4 h-4" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Prompt</span>
              </>
            )}
          </button>

          {/* Generate Image Button */}
          <button
            onClick={() => {
              sessionStorage.setItem('auraprompt_studio_preload', selectedPost.promptText);
              setSelectedPost(null);
              setCurrentView('studio-tool');
            }}
            className="flex items-center gap-1.5 px-3.5 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold shadow-md bg-[#E60023] hover:bg-[#ad081b] text-white transition-all"
            title="Generate Image with this Prompt"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate Image</span>
          </button>

          {/* Pinterest Red Save Button */}
          <button
            onClick={() => toggleBookmark(selectedPost.id)}
            className={`flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold shadow-sm transition-all ${
              isBookmarked
                ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900'
                : 'bg-[#E60023] hover:bg-[#ad081b] text-white shadow-[#E60023]/20'
            }`}
            title={isBookmarked ? 'Saved to collection' : 'Save Pin'}
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
            <span>{isBookmarked ? 'Saved' : 'Save'}</span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="p-2.5 rounded-full bg-[#efefef] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-[#e2e2e2] dark:hover:bg-neutral-700 transition-colors"
            title="Share Prompt Link"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Close Button */}
          <button
            onClick={() => setSelectedPost(null)}
            className="p-2.5 rounded-full bg-[#efefef] hover:bg-[#e2e2e2] dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 hover:text-neutral-900 dark:hover:text-white transition-colors"
            title="Close View"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-12">
        {/* Pinterest Master Pin Card */}
        <section className="bg-white dark:bg-neutral-900 rounded-[28px] sm:rounded-[36px] shadow-2xl border border-neutral-200/80 dark:border-neutral-800 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
            {/* Left Column: Natural High-Resolution Photo Showcase */}
            <div className="lg:col-span-7 bg-neutral-950 flex flex-col justify-center items-center p-3 sm:p-6 lg:p-8 relative group min-h-[360px] sm:min-h-[480px]">
              {selectedPost.imageUrl ? (
                <div className="relative w-full h-full min-h-[340px] sm:min-h-[460px] max-h-[720px] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center">
                  <Image
                    src={selectedPost.imageUrl}
                    alt={selectedPost.imageAlt || selectedPost.title}
                    width={1200}
                    height={1200}
                    className="w-full h-auto max-h-[720px] object-contain rounded-2xl sm:rounded-3xl"
                    referrerPolicy="no-referrer"
                    priority
                  />

                  {/* Expand Fullscreen Overlay Icon */}
                  <button
                    onClick={() => setShowFullImageModal(true)}
                    className="absolute bottom-4 right-4 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all shadow-lg opacity-90 hover:scale-105"
                    title="View Full Resolution Image"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="w-full aspect-[4/3] flex items-center justify-center bg-neutral-900 text-neutral-400">
                  <Sparkles className="w-12 h-12 opacity-30" />
                </div>
              )}
            </div>

            {/* Right Column: Pin Details & Master Prompt Box */}
            <div className="lg:col-span-5 p-5 sm:p-8 lg:p-9 flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                {/* Author Badge & Category Row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 shadow-sm">
                      <Image
                        src="/logo.webp"
                        alt="tool.reelz"
                        fill
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                          tool.reelz
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          PRO
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Curated Master Prompts
                      </p>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {selectedPost.category}
                  </span>
                </div>

                {/* Pin Title */}
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-neutral-900 dark:text-white leading-tight tracking-tight">
                    {selectedPost.title}
                  </h1>

                  {/* Metadata Stats */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400 mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {new Date(selectedPost.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      <span>{(selectedPost.viewsCount || 0) + 120} views</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Copy className="w-3.5 h-3.5" />
                      <span>{selectedPost.copiesCount || 0} copies</span>
                    </span>
                  </div>
                </div>

                {/* Master Copyable Prompt Box */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                      <Sparkles className="w-4 h-4 text-red-600 dark:text-red-400" />
                      <span>Master Copy-Paste Prompt</span>
                    </div>

                    <Link
                      href="/blog/how-to-use-photo-prompts"
                      className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>How to use?</span>
                    </Link>
                  </div>

                  <div className="relative rounded-2xl bg-neutral-950 text-neutral-100 p-4 sm:p-5 font-mono text-xs sm:text-sm leading-relaxed border border-neutral-800 shadow-inner group">
                    <p className="whitespace-pre-wrap select-all selection:bg-red-600 selection:text-white max-h-[220px] overflow-y-auto">
                      {selectedPost.promptText}
                    </p>

                    <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between gap-3">
                      <span className="text-[11px] text-neutral-400 font-sans">
                        {selectedPost.promptText.length} chars
                      </span>

                      <button
                        onClick={handleCopyMasterPrompt}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold shadow-md transition-all ${
                          copiedPrompt
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#E60023] hover:bg-[#ad081b] text-white shadow-[#E60023]/30'
                        }`}
                        id="modal-copy-prompt-btn-inner"
                      >
                        {copiedPrompt ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Prompt</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* AI-Powered Variations Generator */}
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[#E60023]/10 text-[#E60023] flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-neutral-900 dark:text-white">
                        AI Personal Variations
                      </span>
                    </div>

                    <button
                      onClick={handleGenerateVariations}
                      disabled={isGeneratingVariations}
                      className="px-3 py-1 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-[11px] font-bold hover:opacity-90 transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                      {isGeneratingVariations ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 text-[#E60023]" />
                          <span>{aiVariations ? 'Regenerate' : 'Generate 3 Styles'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {aiVariations && aiVariations.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {aiVariations.map((v, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700/80 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-neutral-900 dark:text-white">
                              {v.style}
                            </span>
                            <button
                              onClick={() => copyPromptToClipboard(v.prompt)}
                              className="text-[11px] font-bold text-[#E60023] hover:underline flex items-center gap-1"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </button>
                          </div>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            {v.description}
                          </p>
                          <p className="text-[11px] font-mono text-neutral-800 dark:text-neutral-200 bg-neutral-50 dark:bg-neutral-950 p-2 rounded-lg line-clamp-2">
                            {v.prompt}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tags */}
                {selectedPost.tags && selectedPost.tags.length > 0 && (
                  <div className="pt-2 flex flex-wrap items-center gap-1.5">
                    {selectedPost.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-medium text-neutral-600 dark:text-neutral-300"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Help Banner */}
              <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-xl bg-blue-600 text-white">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                      New to AI Photo Prompts?
                    </h4>
                    <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
                      Learn how to copy and run prompts with step-by-step settings.
                    </p>
                  </div>
                </div>

                <Link
                  href="/blog/how-to-use-photo-prompts"
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
                >
                  Read Guide
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Pinterest "More to explore" / "More Prompts" Masonry Image Grid */}
        <section className="space-y-6 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>More to explore</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400">
                  {selectedPost.category}
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                Visual photo prompts with matching aesthetics & tags. Click any image to open.
              </p>
            </div>

            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Infinite Visual Feed
            </span>
          </div>

          {/* Pinterest Responsive Masonry Columns (Images Only) */}
          <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4 space-y-4">
            {visiblePins.map((pin) => {
              const isPinBookmarked = bookmarkedIds.includes(pin.id);
              const isCopied = copiedPinId === pin.id;

              return (
                <div
                  key={pin.id}
                  onClick={() => handleSelectPin(pin)}
                  className="break-inside-avoid group relative rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-200 dark:bg-neutral-900 cursor-pointer shadow-sm hover:shadow-2xl transition-all duration-300 border border-neutral-200/60 dark:border-neutral-800/80"
                  id={`masonry-pin-${pin.id}`}
                >
                  {/* Photo Pin Image */}
                  {pin.imageUrl && (
                    <Image
                      src={pin.imageUrl}
                      alt={pin.imageAlt || pin.title}
                      width={800}
                      height={1000}
                      className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500 select-none pointer-events-none"
                      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
                      draggable={false}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    />
                  )}

                  {/* Dark Vignette Overlay on Hover */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-3 pointer-events-none">
                    {/* Top Actions: White Generate Button (Left) & White Save Button (Right) */}
                    <div className="flex items-center justify-between w-full pointer-events-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (typeof window !== 'undefined') {
                            sessionStorage.setItem('auraprompt_studio_preload', pin.promptText);
                          }
                          setSelectedPost(null);
                          setCurrentView('studio-tool');
                          showToast('Loaded prompt into AI Studio Image Generator!');
                        }}
                        className="px-2.5 py-1 rounded-full bg-white hover:bg-neutral-100 text-neutral-900 text-[10px] font-bold shadow-md transition-transform hover:scale-105 flex items-center gap-1"
                        title="Generate Image with this prompt"
                      >
                        <Sparkles className="w-3 h-3 text-[#E60023]" />
                        <span>Generate</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        {/* Quick Copy in White */}
                        <button
                          type="button"
                          onClick={(e) => handleQuickCopyPin(e, pin)}
                          className="p-1.5 rounded-full bg-white hover:bg-neutral-100 text-neutral-900 shadow-md transition-all hover:scale-105"
                          title="Quick Copy Prompt"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        {/* Save in White */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBookmark(pin.id);
                          }}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold shadow-md transition-all hover:scale-105 flex items-center gap-1 ${
                            isPinBookmarked
                              ? 'bg-white text-[#E60023]'
                              : 'bg-white hover:bg-neutral-100 text-neutral-900'
                          }`}
                          title={isPinBookmarked ? 'Saved to collection' : 'Save Pin'}
                        >
                          <Bookmark className={`w-3 h-3 ${isPinBookmarked ? 'fill-[#E60023] text-[#E60023]' : ''}`} />
                          <span>{isPinBookmarked ? 'Saved' : 'Save'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Bottom Info: Category & Title */}
                    <div className="pointer-events-auto">
                      <span className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md text-[9px] font-bold text-white mb-1 inline-block">
                        {pin.category}
                      </span>
                      <p className="text-xs font-bold text-white line-clamp-2 leading-snug drop-shadow-md">
                        {pin.title}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Infinite Scroll Sentinel & Loader */}
          {hasMorePins ? (
            <div ref={bottomSentinelRef} className="py-10 flex flex-col items-center justify-center text-center">
              {isLoadingMore ? (
                <div className="flex items-center gap-2.5 text-xs font-bold text-neutral-500 dark:text-neutral-400">
                  <div className="w-5 h-5 border-2 border-[#E60023] border-t-transparent rounded-full animate-spin" />
                  <span>Loading more visual prompts...</span>
                </div>
              ) : (
                <button
                  onClick={loadMorePins}
                  className="px-6 py-2.5 rounded-full bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 transition-colors shadow-xs"
                >
                  Load More Pins
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-10 px-4 mt-6 border-t border-neutral-200/70 dark:border-neutral-800/70 max-w-md mx-auto">
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-medium">
                You&apos;ve reached the end of our prompt collection. Come back later for more posts.
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Full-Screen Image Lightbox Modal */}
      {showFullImageModal && selectedPost.imageUrl && (
        <div
          onClick={() => setShowFullImageModal(false)}
          className="fixed inset-0 z-60 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
        >
          <button
            onClick={() => setShowFullImageModal(false)}
            className="absolute top-5 right-5 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="relative max-w-5xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <Image
              src={selectedPost.imageUrl}
              alt={selectedPost.imageAlt || selectedPost.title}
              width={1600}
              height={1600}
              className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}
    </div>
  );
};
