import { db } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { Category, PromptPost, SiteSettings, SearchQueryItem } from '@/types/prompt';
import { INITIAL_CATEGORIES, INITIAL_SETTINGS } from './initial-data';

const POSTS_COLLECTION = 'posts';
const CATEGORIES_COLLECTION = 'categories';
const SETTINGS_COLLECTION = 'settings';
const TAGS_COLLECTION = 'tags';
const SEARCH_QUERIES_COLLECTION = 'search_queries';
const SETTINGS_DOC_ID = 'site_settings';
const TAGS_DOC_ID = 'site_tags';

const DEFAULT_TAGS = [
  'Portrait', '35mm', 'Cinematic', 'Street Photography', 'Fashion',
  'Monochrome', 'Tokyo', 'Cyberpunk', 'Studio Ghibli', 'Japandi',
  'Architecture', '3D Render', 'Pixar', 'Underwater', 'Logo', 'Minimalist'
];

const CATEGORY_COLORS = [
  { color: '#E60023', badgeBg: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800' },
  { color: '#3B82F6', badgeBg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800' },
  { color: '#8B5CF6', badgeBg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800' },
  { color: '#EC4899', badgeBg: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/50 dark:text-pink-300 dark:border-pink-800' },
  { color: '#10B981', badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800' },
  { color: '#F59E0B', badgeBg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800' },
  { color: '#6366F1', badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800' },
  { color: '#06B6D4', badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800' },
];

function cleanData<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = cleanData(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

export const ServerStorage = {
  // Posts
  getAllPosts: async (includeDrafts = true): Promise<PromptPost[]> => {
    try {
      const snapshot = await getDocs(collection(db, POSTS_COLLECTION));
      let posts = snapshot.docs.map(doc => doc.data() as PromptPost);
      const normalized = posts.map((p) => ({
        ...p,
        author: {
          name: 'tool.reelz',
          avatar: '/logo.png',
          role: 'Author',
        },
      }));
      return includeDrafts ? normalized : normalized.filter((p) => p.status === 'published');
    } catch (err) {
      console.error('Error in getAllPosts:', err);
      return [];
    }
  },

  getPostBySlug: async (slug: string): Promise<PromptPost | undefined> => {
    const posts = await ServerStorage.getAllPosts(true);
    return posts.find((p) => p.slug === slug || p.id === slug);
  },

  getPostById: async (id: string): Promise<PromptPost | undefined> => {
    try {
      const docSnap = await getDoc(doc(db, POSTS_COLLECTION, id));
      if (docSnap.exists()) return docSnap.data() as PromptPost;
      return undefined;
    } catch (err) {
      console.error('Error in getPostById:', err);
      return undefined;
    }
  },

  savePost: async (post: PromptPost): Promise<PromptPost> => {
    const now = new Date().toISOString();
    const id = post.id || `prompt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const docRef = doc(db, POSTS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    let savedPost: PromptPost;

    if (docSnap.exists()) {
      const existing = docSnap.data() as PromptPost;
      savedPost = {
        ...post,
        id,
        author: {
          name: 'tool.reelz',
          avatar: '/logo.png',
          role: 'Author',
        },
        updatedAt: now,
        publishedAt: post.status === 'published' && !existing.publishedAt
            ? now
            : existing.publishedAt || (post.status === 'published' ? now : undefined),
      };
    } else {
      savedPost = {
        ...post,
        id,
        author: {
          name: 'tool.reelz',
          avatar: '/logo.png',
          role: 'Author',
        },
        createdAt: post.createdAt || now,
        updatedAt: now,
        publishedAt: post.status === 'published' ? (post.publishedAt || now) : undefined,
        viewsCount: post.viewsCount || 0,
        copiesCount: post.copiesCount || 0,
        likesCount: post.likesCount || 0,
      };
    }

    await setDoc(docRef, cleanData(savedPost));

    // Auto-create category in Firestore if it doesn't already exist (Requirement 2)
    if (savedPost.category && savedPost.category.trim()) {
      try {
        const catName = savedPost.category.trim();
        const existingCats = await ServerStorage.getAllCategories();
        const exists = existingCats.some(
          (c) => c.name.toLowerCase() === catName.toLowerCase()
        );

        if (!exists) {
          const cleanSlug = catName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') || `cat-${Date.now()}`;
          
          const paletteIndex = Math.floor(Math.random() * CATEGORY_COLORS.length);
          const palette = CATEGORY_COLORS[paletteIndex];

          const newCategory: Category = {
            id: `cat-${cleanSlug}-${Date.now().toString(36)}`,
            name: catName,
            slug: cleanSlug,
            iconName: 'Sparkles',
            description: `Curated collection of ${catName} copy-paste AI photo prompts.`,
            color: palette.color,
            badgeBg: palette.badgeBg,
            count: 1,
          };

          await ServerStorage.saveCategory(newCategory);
        }
      } catch (catErr) {
        console.warn('Auto-creating category during savePost notice:', catErr);
      }
    }

    return savedPost;
  },

  deletePost: async (id: string): Promise<boolean> => {
    const docRef = doc(db, POSTS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return false;
    await deleteDoc(docRef);
    return true;
  },

  restorePosts: async (incomingPosts: PromptPost[], mode: 'merge' | 'replace' = 'merge'): Promise<PromptPost[]> => {
    try {
      if (mode === 'replace') {
        const snapshot = await getDocs(collection(db, POSTS_COLLECTION));
        for (const docItem of snapshot.docs) {
          await deleteDoc(doc(db, POSTS_COLLECTION, docItem.id));
        }
      }

      const now = new Date().toISOString();
      for (const p of incomingPosts) {
        if (!p.title || !p.promptText) continue;
        const id = p.id || `prompt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const restoredPost: PromptPost = {
          id,
          title: p.title,
          slug: p.slug || p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          category: p.category || 'General',
          aiTool: p.aiTool || 'ChatGPT',
          promptText: p.promptText,
          negativePrompt: p.negativePrompt || '',
          imageUrl: p.imageUrl || '',
          imageAlt: p.imageAlt || p.title,
          imageFileName: p.imageFileName,
          additionalImages: Array.isArray(p.additionalImages) ? p.additionalImages : [],
          parameters: p.parameters || {},
          variables: Array.isArray(p.variables) ? p.variables : [],
          articleContent: p.articleContent || '',
          tags: Array.isArray(p.tags) ? p.tags : [],
          status: p.status === 'draft' ? 'draft' : 'published',
          isFeatured: !!p.isFeatured,
          isTrending: !!p.isTrending,
          viewsCount: typeof p.viewsCount === 'number' ? p.viewsCount : 0,
          copiesCount: typeof p.copiesCount === 'number' ? p.copiesCount : 0,
          likesCount: typeof p.likesCount === 'number' ? p.likesCount : 0,
          author: {
            name: 'tool.reelz',
            avatar: '/logo.png',
            role: 'Author',
          },
          seo: p.seo || {
            metaTitle: p.title,
            metaDescription: (p.promptText || '').substring(0, 155),
            focusKeyword: p.category || 'AI Prompt',
          },
          createdAt: p.createdAt || now,
          updatedAt: now,
          publishedAt: p.publishedAt || (p.status === 'draft' ? undefined : now),
        };

        await setDoc(doc(db, POSTS_COLLECTION, id), cleanData(restoredPost));
      }

      return await ServerStorage.getAllPosts(true);
    } catch (err) {
      console.error('Error in restorePosts:', err);
      throw err;
    }
  },

  incrementCopyCount: async (id: string): Promise<void> => {
    const post = await ServerStorage.getPostById(id);
    if (post) {
      post.copiesCount = (post.copiesCount || 0) + 1;
      await ServerStorage.savePost(post);
    }
  },

  incrementViewCount: async (id: string): Promise<void> => {
    const post = await ServerStorage.getPostById(id);
    if (post) {
      post.viewsCount = (post.viewsCount || 0) + 1;
      await ServerStorage.savePost(post);
    }
  },

  toggleLike: async (id: string): Promise<number> => {
    const post = await ServerStorage.getPostById(id);
    if (!post) return 0;
    post.likesCount = Math.max(0, (post.likesCount || 0) + 1);
    await ServerStorage.savePost(post);
    return post.likesCount;
  },

  // Categories
  getAllCategories: async (): Promise<Category[]> => {
    const snapshot = await getDocs(collection(db, CATEGORIES_COLLECTION));
    let cats = snapshot.docs.map(doc => doc.data() as Category);
    if (cats.length === 0) {
      // Seed initial
      for (const c of INITIAL_CATEGORIES) {
        await setDoc(doc(db, CATEGORIES_COLLECTION, c.id), c);
      }
      cats = INITIAL_CATEGORIES;
    }
    const posts = await ServerStorage.getAllPosts(false);
    return cats.map((cat) => ({
      ...cat,
      count: posts.filter((p) => p.category?.toLowerCase() === cat.name?.toLowerCase()).length,
    }));
  },

  saveCategory: async (category: Category): Promise<Category> => {
    const id = category.id || `cat-${Date.now()}`;
    const newCat = { ...category, id };
    await setDoc(doc(db, CATEGORIES_COLLECTION, id), cleanData(newCat));
    return newCat;
  },

  deleteCategory: async (id: string): Promise<boolean> => {
    const docRef = doc(db, CATEGORIES_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return false;
    await deleteDoc(docRef);
    return true;
  },

  // Search Queries Tracking (Requirement 3: Real User Searches)
  recordSearchQuery: async (rawQuery: string): Promise<void> => {
    const queryText = rawQuery.trim().toLowerCase();
    if (!queryText || queryText.length < 2) return;

    try {
      const slug = queryText.replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      const docRef = doc(db, SEARCH_QUERIES_COLLECTION, slug);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as SearchQueryItem;
        await setDoc(docRef, {
          query: rawQuery.trim(),
          count: (data.count || 1) + 1,
          lastSearched: Date.now(),
        });
      } else {
        await setDoc(docRef, {
          query: rawQuery.trim(),
          count: 1,
          lastSearched: Date.now(),
        });
      }
    } catch (err) {
      console.warn('Error recording search query:', err);
    }
  },

  getTopSearchQueries: async (limitCount = 12): Promise<SearchQueryItem[]> => {
    try {
      const snapshot = await getDocs(collection(db, SEARCH_QUERIES_COLLECTION));
      let items: SearchQueryItem[] = snapshot.docs.map(doc => doc.data() as SearchQueryItem);

      if (items.length === 0) {
        // Default popular initial queries
        const defaultQueries = [
          'Cyberpunk neon portrait',
          'Cinematic golden hour',
          'Vintage 35mm film',
          'Anime masterpiece',
          'Minimalist aesthetic logo',
          'Hyperrealistic 8K model',
          'Moody luxury portrait',
          'Unreal Engine 3D render',
          'Japandi aesthetic living room',
          'Dark academia aesthetic',
        ];
        return defaultQueries.map((q, i) => ({
          query: q,
          count: 50 - i * 3,
          lastSearched: Date.now(),
        }));
      }

      items.sort((a, b) => (b.count || 0) - (a.count || 0));
      return items.slice(0, limitCount);
    } catch (err) {
      console.warn('Error fetching search queries:', err);
      return [];
    }
  },

  // Settings
  getSettings: async (): Promise<SiteSettings> => {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as SiteSettings;
      }
      await setDoc(docRef, cleanData(INITIAL_SETTINGS));
      return INITIAL_SETTINGS;
    } catch (err) {
      console.error('Error in getSettings:', err);
      return INITIAL_SETTINGS;
    }
  },

  saveSettings: async (newSettings: Partial<SiteSettings>): Promise<SiteSettings> => {
    const current = await ServerStorage.getSettings();
    const updated = { ...current, ...newSettings };
    await setDoc(doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID), cleanData(updated));
    return updated;
  },

  // Tags
  getAllTags: async (): Promise<string[]> => {
    const docRef = doc(db, TAGS_COLLECTION, TAGS_DOC_ID);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().tags || DEFAULT_TAGS;
    }
    await setDoc(docRef, { tags: DEFAULT_TAGS });
    return DEFAULT_TAGS;
  },

  addTag: async (tag: string): Promise<string[]> => {
    const cleanTag = tag.trim().replace(/^#/, '');
    if (!cleanTag) return await ServerStorage.getAllTags();
    const current = await ServerStorage.getAllTags();
    if (current.some((t) => t.toLowerCase() === cleanTag.toLowerCase())) {
      return current;
    }
    const updated = [cleanTag, ...current];
    await setDoc(doc(db, TAGS_COLLECTION, TAGS_DOC_ID), { tags: updated });
    return updated;
  },

  deleteTag: async (tag: string): Promise<string[]> => {
    const current = await ServerStorage.getAllTags();
    const filtered = current.filter((t) => t.toLowerCase() !== tag.toLowerCase());
    await setDoc(doc(db, TAGS_COLLECTION, TAGS_DOC_ID), { tags: filtered });
    return filtered;
  },
};
