import { create } from 'zustand';
import { Supertag, FieldDefinition, TagCategoryGroup, PRESET_CATEGORY_IDS } from '@/types';
import { generateId, debounce } from '@/utils/helpers';
import { TAG_COLORS } from '@/utils/mockData';
import { categoriesApi, settingsApi, SETTING_KEYS, AuthenticationError } from '@/services/api';

// ============================================================================
// 预设分类数据（仅作为默认值，实际数据从数据库加载）
// ============================================================================

// 仅保留"未分类"作为系统默认分类
const createDefaultCategories = (): Record<string, TagCategoryGroup> => {
  const now = Date.now();
  return {
    [PRESET_CATEGORY_IDS.UNCATEGORIZED]: {
      id: PRESET_CATEGORY_IDS.UNCATEGORIZED,
      name: '未分类',
      icon: '📁',
      color: '#9CA3AF',
      description: '尚未归类的标签',
      isSystem: true,
      order: 999,
      createdAt: now,
      updatedAt: now,
    },
  };
};

// ============================================================================
// Store 类型定义
// ============================================================================

interface SupertagStoreState {
  supertags: Record<string, Supertag>;
  categories: Record<string, TagCategoryGroup>;
  recentTags: string[];
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

interface SupertagStoreActions {
  // 功能标签操作（同步到 API）
  addSupertag: (name: string, color?: string, categoryId?: string, parentId?: string | null) => Promise<string | null>;
  updateSupertag: (id: string, updates: Partial<Supertag>) => Promise<void>;
  deleteSupertag: (id: string) => Promise<boolean>;
  
  // 分类操作（同步到数据库）
  addCategory: (name: string, icon?: string, color?: string) => Promise<string>;
  updateCategory: (id: string, updates: Partial<TagCategoryGroup>) => Promise<void>;
  deleteCategory: (id: string) => Promise<boolean>;
  reorderCategories: (categoryIds: string[]) => Promise<void>;
  
  // 标签分类关联
  moveTagToCategory: (tagId: string, categoryId: string) => void;
  getTagsByCategory: (categoryId: string) => Supertag[];
  reorderTagsInCategory: (categoryId: string, tagIds: string[]) => void;
  
  // 最近使用标签追踪（同步到数据库）
  trackTagUsage: (tagId: string) => void;
  getRecentTags: (limit?: number) => string[];
  clearRecentTags: () => void;
  
  // 字段操作（同步到 API）
  addFieldDefinition: (supertagId: string, field: Omit<FieldDefinition, 'id'>) => Promise<void>;
  updateFieldDefinition: (supertagId: string, fieldId: string, updates: Partial<FieldDefinition>) => Promise<void>;
  removeFieldDefinition: (supertagId: string, fieldId: string) => Promise<void>;
  
  // API 数据加载
  loadFromAPI: () => Promise<void>;
  syncToAPI: (supertag: Supertag) => Promise<void>;
  
  // 工具函数
  getAllCategories: () => TagCategoryGroup[];
  getCategory: (id: string) => TagCategoryGroup | undefined;

  /** v2.1: 获取某标签的直接子标签列表 */
  getChildren: (tagId: string) => Supertag[];
  /** v2.1: 获取某标签的所有后代标签 ID（含自身），用于多态查询 */
  getDescendantIds: (tagId: string) => string[];
  /** v2.1: 获取合并继承后的字段定义 */
  getResolvedFieldDefinitions: (tagId: string) => FieldDefinition[];
  
  /** AI 生成字段定义 */
  generateSchemaFields: (tagId: string) => Promise<FieldDefinition[]>;
}

type SupertagStore = SupertagStoreState & SupertagStoreActions;

const mergeFieldDefinitionsWithInheritance = (
  parentDefs: FieldDefinition[] = [],
  ownDefs: FieldDefinition[] = []
): FieldDefinition[] => {
  const merged = new Map<string, FieldDefinition>();

  parentDefs.forEach((field) => {
    merged.set(field.key, { ...field, inherited: true });
  });

  ownDefs.forEach((field) => {
    merged.set(field.key, { ...field, inherited: false });
  });

  return Array.from(merged.values());
};

// 防抖保存最近使用标签到数据库
const debouncedSaveRecentTags = debounce(async (recentTags: string[]) => {
  try {
    await settingsApi.set(SETTING_KEYS.RECENT_TAGS, recentTags);
  } catch (error) {
    // 认证失败静默处理
    if (error instanceof AuthenticationError) {
      console.warn('[supertagStore] 认证失败，无法保存最近使用标签');
    } else {
      console.error('[supertagStore] 保存最近使用标签失败:', error);
    }
  }
}, 1000);

// ============================================================================
// Store 实现
// ============================================================================

export const useSupertagStore = create<SupertagStore>((set, get) => ({
  supertags: {},
  categories: createDefaultCategories(),
  recentTags: [],
  isLoading: false,
  isInitialized: false,
  error: null,

  // ============================================
  // API 数据加载
  // ============================================
  loadFromAPI: async () => {
    set({ isLoading: true, error: null });
    
    try {
      // 并行加载标签、分类和最近使用标签
      const [supertagsResponse, categoriesData, recentTagsData] = await Promise.all([
        fetch('/api/supertags').then(res => res.json()),
        categoriesApi.getAll().catch((error) => {
          // 认证错误不静默处理
          if (error instanceof AuthenticationError) throw error;
          console.error('[supertagStore] 加载分类失败:', error);
          return [];
        }),
        settingsApi.get<string[]>(SETTING_KEYS.RECENT_TAGS).catch((error) => {
          // 认证错误不静默处理
          if (error instanceof AuthenticationError) throw error;
          console.error('[supertagStore] 加载最近标签失败:', error);
          return null;
        }),
      ]);
      
      if (!supertagsResponse.success) {
        throw new Error(supertagsResponse.error || '获取标签失败');
      }
      
      // 将标签数组转换为 Record 格式
      const supertagsRecord: Record<string, Supertag> = {};
      (supertagsResponse.data as Supertag[]).forEach(tag => {
        supertagsRecord[tag.id] = tag;
      });
      
      // 将分类数组转换为 Record 格式，并合并默认分类
      const defaultCategories = createDefaultCategories();
      const categoriesRecord: Record<string, TagCategoryGroup> = { ...defaultCategories };
      categoriesData.forEach(cat => {
        categoriesRecord[cat.id] = cat;
      });
      
      // 如果数据库中没有"未分类"，需要创建它
      if (!categoriesData.find(c => c.id === PRESET_CATEGORY_IDS.UNCATEGORIZED)) {
        try {
          await categoriesApi.create({
            id: PRESET_CATEGORY_IDS.UNCATEGORIZED,
            name: '未分类',
            icon: '📁',
            color: '#9CA3AF',
            description: '尚未归类的标签',
            order: 999,
          });
        } catch {
          // 忽略创建失败（可能已存在）
        }
      }
      
      set({ 
        supertags: supertagsRecord,
        categories: categoriesRecord,
        recentTags: Array.isArray(recentTagsData) ? recentTagsData : [],
        isLoading: false, 
        isInitialized: true,
        error: null,
      });
      
      console.log(`[supertagStore] 从 API 加载了 ${Object.keys(supertagsRecord).length} 个标签, ${Object.keys(categoriesRecord).length} 个分类`);
    } catch (error) {
      // 认证失败需要重新抛出，让调用方处理（重定向到登录页）
      if (error instanceof AuthenticationError) {
        set({ 
          isLoading: false, 
          error: '认证失败，请重新登录',
          isInitialized: false,
        });
        throw error;
      }
      
      // 其他错误记录并标记已初始化
      console.error('[supertagStore] API 加载失败:', error);
      
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : '加载失败',
        isInitialized: true,
      });
    }
  },

  syncToAPI: async (supertag) => {
    try {
      const response = await fetch(`/api/supertags/${supertag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: supertag.name,
          color: supertag.color,
          icon: supertag.icon,
          description: supertag.description,
          categoryId: supertag.categoryId,
          order: supertag.order,
          parentId: supertag.parentId,
          fieldDefinitions: supertag.fieldDefinitions,
          templateContent: supertag.templateContent,
        }),
      });
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }
      
      // 更新本地状态，使用 API 返回的 resolvedFieldDefinitions
      set(state => ({
        supertags: {
          ...state.supertags,
          [supertag.id]: {
            ...state.supertags[supertag.id],
            ...result.data,
          }
        }
      }));
    } catch (error) {
      console.error('[supertagStore] 同步到 API 失败:', error);
    }
  },

  // ============================================
  // 功能标签操作（同步到 API）
  // ============================================
  addSupertag: async (name, color, categoryId, parentId) => {
    const selectedColor = color || TAG_COLORS[Object.keys(get().supertags).length % TAG_COLORS.length];
    const targetCategoryId = categoryId || PRESET_CATEGORY_IDS.UNCATEGORIZED;
    
    try {
      const response = await fetch('/api/supertags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          color: selectedColor,
          categoryId: targetCategoryId,
          parentId: parentId ?? null,
          fieldDefinitions: [],
        }),
      });
      
      const result = await response.json();
      
      // 检查认证错误
      if (response.status === 401 || result.code === 'SESSION_EXPIRED' || result.code === 'UNAUTHORIZED') {
        console.error('[supertagStore] 认证失败，会话可能已过期');
        throw new AuthenticationError(result.error || '用户会话已过期，请重新登录');
      }
      
      if (!result.success) {
        console.error('创建标签失败:', result.error);
        return null;
      }
      
      const newSupertag = result.data as Supertag;
      
      set((state) => ({
        supertags: { ...state.supertags, [newSupertag.id]: newSupertag }
      }));
      
      return newSupertag.id;
    } catch (error) {
      // 认证错误需要重新抛出，让调用方处理
      if (error instanceof AuthenticationError) {
        throw error;
      }
      console.error('创建标签失败:', error);
      return null;
    }
  },

  updateSupertag: async (id, updates) => {
    const supertag = get().supertags[id];
    if (!supertag) return;

    // 防御式循环检测：阻止将父标签设置为自己或后代
    if (updates.parentId !== undefined) {
      const parentId = updates.parentId;
      if (parentId === id) return;
      if (parentId) {
        const blockedIds = get().getDescendantIds(id);
        if (blockedIds.includes(parentId)) return;
      }
    }

    const updatedSupertag = { ...supertag, ...updates };
    
    // 乐观更新
    set((state) => ({
      supertags: {
        ...state.supertags,
        [id]: updatedSupertag,
      },
    }));
    
    // 同步到 API
    await get().syncToAPI(updatedSupertag);
  },

  deleteSupertag: async (id) => {
    try {
      const response = await fetch(`/api/supertags/${id}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      if (!result.success) {
        console.error('删除标签失败:', result.error);
        return false;
      }
      
      set((state) => {
        const newSupertags = { ...state.supertags };
        delete newSupertags[id];
        return { supertags: newSupertags };
      });
      
      return true;
    } catch (error) {
      console.error('删除标签失败:', error);
      return false;
    }
  },

  // ============================================
  // 分类操作（同步到数据库）
  // ============================================
  addCategory: async (name, icon = '📂', color = '#6B7280') => {
    const newId = `cat_${generateId()}`;
    const now = Date.now();
    const existingCategories = Object.values(get().categories);
    const maxOrder = Math.max(...existingCategories.map(c => c.order), -1);
    
    const newCategory: TagCategoryGroup = {
      id: newId,
      name,
      icon,
      color,
      isSystem: false,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };

    // 乐观更新
    set((state) => ({
      categories: { ...state.categories, [newId]: newCategory }
    }));

    // 同步到数据库
    try {
      await categoriesApi.create({
        id: newId,
        name,
        icon,
        color,
        order: maxOrder + 1,
      });
    } catch (error) {
      console.error('创建分类失败:', error);
      // 回滚
      set((state) => {
        const { [newId]: _, ...rest } = state.categories;
        return { categories: rest };
      });
      throw error;
    }

    return newId;
  },

  updateCategory: async (id, updates) => {
    const category = get().categories[id];
    if (!category) return;

    const updatedCategory = {
      ...category,
      ...updates,
      updatedAt: Date.now(),
    };

    // 乐观更新
    set((state) => ({
      categories: {
        ...state.categories,
        [id]: updatedCategory,
      },
    }));

    // 同步到数据库
    try {
      await categoriesApi.update(id, updates);
    } catch (error) {
      console.error('更新分类失败:', error);
      // 回滚
      set((state) => ({
        categories: {
          ...state.categories,
          [id]: category,
        },
      }));
      throw error;
    }
  },

  deleteCategory: async (id) => {
    const category = get().categories[id];
    if (!category || category.isSystem) {
      return false;
    }

    const oldCategories = get().categories;
    const oldSupertags = get().supertags;

    // 乐观更新
    set((state) => {
      const { [id]: _, ...restCategories } = state.categories;
      
      // 将该分类下的标签移动到"未分类"
      const updatedSupertags = { ...state.supertags };
      Object.values(updatedSupertags).forEach(tag => {
        if (tag.categoryId === id) {
          updatedSupertags[tag.id] = {
            ...tag,
            categoryId: PRESET_CATEGORY_IDS.UNCATEGORIZED,
          };
        }
      });
      
      return { 
        categories: restCategories,
        supertags: updatedSupertags,
      };
    });

    // 同步到数据库
    try {
      await categoriesApi.delete(id);
      return true;
    } catch (error) {
      console.error('删除分类失败:', error);
      // 回滚
      set({ categories: oldCategories, supertags: oldSupertags });
      return false;
    }
  },

  reorderCategories: async (categoryIds) => {
    const oldCategories = get().categories;

    // 乐观更新
    set((state) => {
      const newCategories = { ...state.categories };
      categoryIds.forEach((id, index) => {
        if (newCategories[id]) {
          newCategories[id] = {
            ...newCategories[id],
            order: index,
            updatedAt: Date.now(),
          };
        }
      });
      return { categories: newCategories };
    });

    // 同步到数据库
    try {
      await categoriesApi.batchUpdate(
        categoryIds.map((id, index) => ({ id, order: index }))
      );
    } catch (error) {
      console.error('重排分类失败:', error);
      // 回滚
      set({ categories: oldCategories });
      throw error;
    }
  },

  // ============================================
  // 标签分类关联
  // ============================================
  moveTagToCategory: (tagId, categoryId) => {
    const tag = get().supertags[tagId];
    const category = get().categories[categoryId];
    if (!tag || !category) return;

    get().updateSupertag(tagId, { categoryId });
  },

  getTagsByCategory: (categoryId) => {
    const { supertags } = get();
    return Object.values(supertags)
      .filter(tag => tag.categoryId === categoryId && !tag.isSystem)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },

  reorderTagsInCategory: (categoryId, tagIds) => {
    const category = get().categories[categoryId];
    if (!category) return;

    tagIds.forEach(async (tagId, index) => {
      const tag = get().supertags[tagId];
      if (tag && tag.categoryId === categoryId) {
        await get().updateSupertag(tagId, { order: index });
      }
    });
  },

  // ============================================
  // 最近使用标签追踪（同步到数据库）
  // ============================================
  trackTagUsage: (tagId) => {
    set((state) => {
      const filtered = state.recentTags.filter(id => id !== tagId);
      const newRecent = [tagId, ...filtered].slice(0, 20);
      
      // 异步保存到数据库
      debouncedSaveRecentTags(newRecent);
      return { recentTags: newRecent };
    });
  },
  
  getRecentTags: (limit = 10) => {
    const { recentTags, supertags } = get();
    return recentTags
      .filter(id => supertags[id])
      .slice(0, limit);
  },
  
  clearRecentTags: () => {
    set({ recentTags: [] });
    
    // 从数据库删除
    settingsApi.delete(SETTING_KEYS.RECENT_TAGS).catch((error) => {
      // 认证错误静默处理
      if (!(error instanceof AuthenticationError)) {
        console.error('[supertagStore] 清除最近使用标签失败:', error);
      }
    });
  },

  // ============================================
  // 字段操作（同步到 API）
  // ============================================
  addFieldDefinition: async (supertagId, field) => {
    const supertag = get().supertags[supertagId];
    if (!supertag) return;

    const newFieldDefinition: FieldDefinition = {
      ...field,
      id: generateId(),
    };

    const updatedFieldDefinitions = [...supertag.fieldDefinitions, newFieldDefinition];
    await get().updateSupertag(supertagId, { fieldDefinitions: updatedFieldDefinitions });
  },

  updateFieldDefinition: async (supertagId, fieldId, updates) => {
    const supertag = get().supertags[supertagId];
    if (!supertag) return;

    const newFieldDefinitions = supertag.fieldDefinitions.map((field) =>
      field.id === fieldId ? { ...field, ...updates } : field
    );

    await get().updateSupertag(supertagId, { fieldDefinitions: newFieldDefinitions });
  },

  removeFieldDefinition: async (supertagId, fieldId) => {
    const supertag = get().supertags[supertagId];
    if (!supertag) return;

    const newFieldDefinitions = supertag.fieldDefinitions.filter(
      (field) => field.id !== fieldId
    );

    await get().updateSupertag(supertagId, { fieldDefinitions: newFieldDefinitions });
  },

  // ============================================
  // 工具函数
  // ============================================
  getAllCategories: () => {
    return Object.values(get().categories).sort((a, b) => a.order - b.order);
  },

  getCategory: (id) => {
    return get().categories[id];
  },

  getChildren: (tagId) => {
    const { supertags } = get();
    return Object.values(supertags).filter((t) => (t.parentId ?? null) === tagId);
  },

  getDescendantIds: (tagId) => {
    const { supertags } = get();
    const ids = new Set<string>([tagId]);
    let current: string[] = [tagId];
    while (current.length) {
      const next: string[] = [];
      Object.values(supertags).forEach((t) => {
        if (t.parentId && current.includes(t.parentId) && !ids.has(t.id)) {
          ids.add(t.id);
          next.push(t.id);
        }
      });
      current = next;
    }
    return Array.from(ids);
  },

  getResolvedFieldDefinitions: (tagId) => {
    const allTags = get().supertags;
    const tag = allTags[tagId];
    
    // 优先使用 API 返回的 resolvedFieldDefinitions
    if (tag?.resolvedFieldDefinitions && tag.resolvedFieldDefinitions.length > 0) {
      return tag.resolvedFieldDefinitions;
    }
    
    // 否则本地计算
    const visited = new Set<string>();

    const resolve = (id: string): FieldDefinition[] => {
      const t = allTags[id];
      if (!t) return [];
      if (visited.has(id)) return t.fieldDefinitions ?? [];
      visited.add(id);
      const ownDefs = (t.fieldDefinitions ?? []) as FieldDefinition[];
      if (!t.parentId) return ownDefs.map((f) => ({ ...f, inherited: false }));
      const parentDefs = resolve(t.parentId);
      return mergeFieldDefinitionsWithInheritance(parentDefs, ownDefs);
    };

    return resolve(tagId);
  },

  /**
   * AI 生成字段定义
   * 根据标签名称和描述自动生成推荐的字段定义
   */
  generateSchemaFields: async (tagId: string) => {
    const state = get();
    const tag = state.supertags[tagId];
    
    if (!tag) {
      throw new Error('标签不存在');
    }
    
    try {
      const response = await fetch('/api/ai/generate-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagName: tag.name,
          tagDescription: tag.description || '',
          existingFields: (tag.fieldDefinitions || []).map(f => f.name),
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'AI 生成字段失败');
      }
      
      // 返回生成的字段定义
      return result.data?.fields || [];
      
    } catch (error) {
      console.error('[supertagStore] AI 生成字段失败:', error);
      throw error;
    }
  },
}));
