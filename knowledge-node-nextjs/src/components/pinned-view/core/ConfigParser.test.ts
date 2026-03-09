/**
 * ConfigParser 单元测试
 * v3.6: 测试 ViewConfig 配置解析和验证
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateViewConfig,
  parseViewConfig,
  getValidLayoutType,
  mergeViewConfig,
  DEFAULT_VIEW_CONFIG,
} from './ConfigParser';
import type { ViewConfig } from '@/types/view-config';

describe('ConfigParser', () => {
  describe('validateViewConfig', () => {
    it('should validate a valid config', () => {
      const config: ViewConfig = {
        version: '1.0',
        layout: {
          type: 'table',
          sortField: 'createdAt',
          sortOrder: 'desc',
        },
      };
      
      const result = validateViewConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject invalid version', () => {
      const config = {
        version: '2.0',
        layout: { type: 'table' },
      };
      
      const result = validateViewConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'version')).toBe(true);
    });
    
    it('should reject missing layout', () => {
      const config = {
        version: '1.0',
      };
      
      const result = validateViewConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'layout')).toBe(true);
    });
    
    it('should reject invalid layout type', () => {
      const config = {
        version: '1.0',
        layout: { type: 'invalid' },
      };
      
      const result = validateViewConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'layout.type')).toBe(true);
    });
    
    it('should require groupByField for kanban layout', () => {
      const config = {
        version: '1.0',
        layout: { type: 'kanban' },
      };
      
      const result = validateViewConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'layout.groupByField')).toBe(true);
    });
    
    it('should accept kanban with groupByField', () => {
      const config: ViewConfig = {
        version: '1.0',
        layout: {
          type: 'kanban',
          groupByField: 'status',
        },
      };
      
      const result = validateViewConfig(config);
      expect(result.valid).toBe(true);
    });
    
    it('should validate widget configs', () => {
      const config: ViewConfig = {
        version: '1.0',
        layout: { type: 'table' },
        widgets: {
          header: [
            {
              id: 'test-widget',
              type: 'ai-aggregation',
              props: {
                query: { filters: [] },
                prompt: 'Test prompt',
              },
            },
          ],
        },
      };
      
      const result = validateViewConfig(config);
      expect(result.valid).toBe(true);
    });
    
    it('should reject widgets with missing id', () => {
      const config = {
        version: '1.0',
        layout: { type: 'table' },
        widgets: {
          header: [
            {
              type: 'ai-aggregation',
              props: {},
            },
          ],
        },
      };
      
      const result = validateViewConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path.includes('id'))).toBe(true);
    });
  });
  
  describe('parseViewConfig', () => {
    it('should return default config for null input', () => {
      const result = parseViewConfig(null);
      expect(result).toEqual(DEFAULT_VIEW_CONFIG);
    });
    
    it('should return default config for undefined input', () => {
      const result = parseViewConfig(undefined);
      expect(result).toEqual(DEFAULT_VIEW_CONFIG);
    });
    
    it('should parse valid config', () => {
      const config: ViewConfig = {
        version: '1.0',
        layout: {
          type: 'kanban',
          groupByField: 'status',
        },
      };
      
      const result = parseViewConfig(config);
      expect(result.layout.type).toBe('kanban');
      expect(result.layout.groupByField).toBe('status');
    });
    
    it('should return default config for invalid input', () => {
      const invalidConfig = {
        version: '999',
        layout: { type: 'invalid' },
      };
      
      const result = parseViewConfig(invalidConfig);
      expect(result).toEqual(DEFAULT_VIEW_CONFIG);
    });
  });
  
  describe('getValidLayoutType', () => {
    it('should return valid layout types', () => {
      expect(getValidLayoutType('table')).toBe('table');
      expect(getValidLayoutType('kanban')).toBe('kanban');
      expect(getValidLayoutType('list')).toBe('list');
    });
    
    it('should return default for invalid types', () => {
      expect(getValidLayoutType('invalid')).toBe('table');
      expect(getValidLayoutType(null)).toBe('table');
      expect(getValidLayoutType(undefined)).toBe('table');
      expect(getValidLayoutType(123)).toBe('table');
    });
  });
  
  describe('mergeViewConfig', () => {
    it('should merge configs correctly', () => {
      const base: ViewConfig = {
        version: '1.0',
        layout: {
          type: 'table',
          sortField: 'createdAt',
          sortOrder: 'asc',
        },
      };
      
      const overrides: Partial<ViewConfig> = {
        layout: {
          type: 'kanban',
          groupByField: 'status',
        },
      };
      
      const result = mergeViewConfig(base, overrides);
      
      expect(result.layout.type).toBe('kanban');
      expect(result.layout.groupByField).toBe('status');
      expect(result.layout.sortField).toBe('createdAt'); // 保留 base 的值
    });
    
    it('should preserve widgets from overrides', () => {
      const base: ViewConfig = {
        version: '1.0',
        layout: { type: 'table' },
        widgets: {
          header: [{ id: 'old', type: 'ai-aggregation', props: {} }],
        },
      };
      
      const overrides: Partial<ViewConfig> = {
        widgets: {
          header: [{ id: 'new', type: 'stats-bar', props: {} }],
        },
      };
      
      const result = mergeViewConfig(base, overrides);
      
      expect(result.widgets?.header).toHaveLength(1);
      expect(result.widgets?.header?.[0].id).toBe('new');
    });
  });
});
