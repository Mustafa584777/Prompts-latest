'use client';

import React from 'react';
import { AppProvider, useApp } from '@/context/AppContext';
import { Header } from '@/components/public/Header';
import { HeroSection } from '@/components/public/HeroSection';
import { ToolFilterBar } from '@/components/public/ToolFilterBar';
import { PromptGrid } from '@/components/public/PromptGrid';
import { PromptDetailModal } from '@/components/public/PromptDetailModal';
import { BookmarksDrawer } from '@/components/public/BookmarksDrawer';
import { Footer } from '@/components/public/Footer';
import { SEOContentSection } from '@/components/public/SEOContentSection';
import { ToastNotification } from '@/components/public/ToastNotification';
import { BottomNav } from '@/components/public/BottomNav';
import { TasteProfileModal } from '@/components/public/TasteProfileModal';
import { UserDashboard } from '@/components/public/UserDashboard';
import { AIStudioTool } from '@/components/public/AIStudioTool';
import { UserAuthModal } from '@/components/public/UserAuthModal';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminLoginModal } from '@/components/admin/AdminLoginModal';
import { SearchExploreModal } from '@/components/public/SearchExploreModal';

function MainApp() {
  const { currentView } = useApp();

  if (currentView === 'admin') {
    return (
      <>
        <AdminLayout />
        <AdminLoginModal />
        <ToastNotification />
      </>
    );
  }

  if (currentView === 'user-dashboard') {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans transition-colors flex flex-col">
        <UserDashboard />
        <PromptDetailModal />
        <BookmarksDrawer />
        <SearchExploreModal />
        <TasteProfileModal />
        <UserAuthModal />
        <AdminLoginModal />
        <ToastNotification />
        <BottomNav />
      </div>
    );
  }

  if (currentView === 'studio-tool') {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans transition-colors flex flex-col">
        <Header />
        <AIStudioTool />
        <PromptDetailModal />
        <BookmarksDrawer />
        <SearchExploreModal />
        <TasteProfileModal />
        <UserAuthModal />
        <AdminLoginModal />
        <ToastNotification />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans transition-colors flex flex-col pb-20 sm:pb-8">
      <Header />
      <HeroSection />
      <ToolFilterBar />
      <PromptGrid />
      <SEOContentSection />
      <Footer />

      {/* Pinterest Mobile Bottom Navigation */}
      <BottomNav />

      {/* Global Modals & Overlays */}
      <SearchExploreModal />
      <PromptDetailModal />
      <BookmarksDrawer />
      <TasteProfileModal />
      <UserAuthModal />
      <AdminLoginModal />
      <ToastNotification />
    </div>
  );
}

export default function Page() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
