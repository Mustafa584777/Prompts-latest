import { Category, PromptPost, SiteSettings, UserAccount, AIHistoryItem } from '@/types/prompt';
import { INITIAL_CATEGORIES, INITIAL_SETTINGS } from './initial-data';

const STORAGE_KEY_BOOKMARKS = 'auraprompt_user_bookmarks';
const STORAGE_KEY_LIKES = 'auraprompt_user_likes';
const STORAGE_KEY_USER_ACCOUNT = 'auraprompt_user_account';
const STORAGE_KEY_AI_HISTORY = 'auraprompt_ai_history';

export const StorageService = {
  // Bookmarks (Client local user preference)
  getBookmarkedIds: (): string[] => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_BOOKMARKS);
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  },

  toggleBookmark: (id: string): boolean => {
    const current = StorageService.getBookmarkedIds();
    let updated: string[];
    let isBookmarked: boolean;

    if (current.includes(id)) {
      updated = current.filter((item) => item !== id);
      isBookmarked = false;
    } else {
      updated = [...current, id];
      isBookmarked = true;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(updated));
    }
    return isBookmarked;
  },

  // Likes (Client local user preference)
  getLikedIds: (): string[] => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_LIKES);
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  },

  toggleLikeLocal: (id: string): boolean => {
    const current = StorageService.getLikedIds();
    let updated: string[];
    let isLiked: boolean;

    if (current.includes(id)) {
      updated = current.filter((item) => item !== id);
      isLiked = false;
    } else {
      updated = [...current, id];
      isLiked = true;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_LIKES, JSON.stringify(updated));
    }
    return isLiked;
  },

  // Admin Auth Helpers
  authenticateAdmin: (email: string, pass: string): boolean => {
    const validEmail = 'admin@trendinggeminiprompts.com';
    const validPass = 'admin123';

    if (
      (email.toLowerCase() === validEmail.toLowerCase() || email.toLowerCase() === 'admin') &&
      pass === validPass
    ) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('auraprompt_auth', 'true');
        localStorage.setItem(
          'auraprompt_user',
          JSON.stringify({
            id: 'admin-1',
            name: 'Administrator',
            email: validEmail,
            role: 'Administrator',
            avatar:
              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
          })
        );
      }
      return true;
    }
    return false;
  },

  getCurrentUser: () => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('auraprompt_user');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return null;
  },

  logoutAdmin: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auraprompt_auth');
      localStorage.removeItem('auraprompt_user');
    }
  },

  // Regular End-User Account (for saving History, Syncing Pins & Taste)
  getUserAccount: (): UserAccount | null => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_USER_ACCOUNT);
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error('Error reading user account:', e);
      }
    }
    return null;
  },

  saveUserAccount: (account: UserAccount): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_USER_ACCOUNT, JSON.stringify(account));
    }
  },

  logoutUserAccount: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_USER_ACCOUNT);
    }
  },

  // AI Generation & Extraction History
  getAiHistory: (userId?: string): AIHistoryItem[] => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_AI_HISTORY);
        if (saved) {
          const items: AIHistoryItem[] = JSON.parse(saved);
          if (userId) {
            return items.filter((it) => !it.userId || it.userId === userId);
          }
          return items;
        }
      } catch (e) {
        console.error('Error reading AI history:', e);
      }
    }
    return [];
  },

  saveAiHistoryItem: (item: AIHistoryItem): AIHistoryItem[] => {
    const current = StorageService.getAiHistory();
    // Prepend new item and keep up to 100 entries
    const updated = [item, ...current.filter((it) => it.id !== item.id)].slice(0, 100);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_AI_HISTORY, JSON.stringify(updated));
    }
    return updated;
  },

  deleteAiHistoryItem: (id: string): AIHistoryItem[] => {
    const current = StorageService.getAiHistory();
    const updated = current.filter((it) => it.id !== id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_AI_HISTORY, JSON.stringify(updated));
    }
    return updated;
  },

  clearAiHistory: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_AI_HISTORY);
    }
  },

  // Persistent Reference Photo
  getPersistentRefImage: (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auraprompt_persistent_ref_image');
    }
    return null;
  },

  savePersistentRefImage: (url: string | null): void => {
    if (typeof window !== 'undefined') {
      if (url) {
        localStorage.setItem('auraprompt_persistent_ref_image', url);
      } else {
        localStorage.removeItem('auraprompt_persistent_ref_image');
      }
    }
  },

  // Prompt Requests
  getPromptRequests: (): any[] => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('auraprompt_prompt_requests');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      {
        id: 'req_1',
        userId: 'u_mock1',
        userName: 'Aura Master',
        userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
        requestText: 'Cyberpunk Tokyo street vendor at night with hyper-detailed ramen steam and neon reflections',
        category: 'Cyberpunk',
        status: 'completed',
        createdAt: Date.now() - 3600000 * 4,
        likesCount: 14,
      },
      {
        id: 'req_2',
        userId: 'u_mock2',
        userName: 'Elena Art',
        userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
        requestText: 'Ethereal fantasy floating island with crystal waterfall and golden hour volumetric fog',
        category: 'Fantasy & Magic',
        status: 'in_progress',
        createdAt: Date.now() - 3600000 * 12,
        likesCount: 8,
      },
    ];
  },

  savePromptRequest: (request: any): any[] => {
    const current = StorageService.getPromptRequests();
    const updated = [request, ...current];
    if (typeof window !== 'undefined') {
      localStorage.setItem('auraprompt_prompt_requests', JSON.stringify(updated));
    }
    return updated;
  },

  getLeaderboardUsers: (): any[] => {
    return [
      { id: 'lb_1', name: 'Sophia Vision', username: '@sophia_ai', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80', points: 42, requestsMade: 4 },
      { id: 'lb_2', name: 'Alex Prompt', username: '@alex_prompt', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80', points: 35, requestsMade: 3 },
      { id: 'lb_3', name: 'Maya Creator', username: '@maya_art', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80', points: 28, requestsMade: 2 },
      { id: 'lb_4', name: 'Liam Render', username: '@liam_3d', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80', points: 19, requestsMade: 1 },
    ];
  },
};
