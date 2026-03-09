/**
 * WidgetRegistry 单元测试
 * v3.6: 测试扩展组件注册表功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WidgetRegistry, registerWidget } from './WidgetRegistry';

// Mock 组件
const MockAIWidget = () => null;
const MockStatsWidget = () => null;

describe('WidgetRegistry', () => {
  beforeEach(() => {
    // 清空注册表
    WidgetRegistry.clear();
  });
  
  describe('register', () => {
    it('should register a widget', () => {
      WidgetRegistry.register({
        type: 'ai-aggregation',
        component: MockAIWidget as any,
        displayName: 'AI Aggregation',
      });
      
      expect(WidgetRegistry.has('ai-aggregation')).toBe(true);
    });
    
    it('should support allowed positions', () => {
      WidgetRegistry.register({
        type: 'ai-aggregation',
        component: MockAIWidget as any,
        displayName: 'AI Aggregation',
        allowedPositions: ['header'],
      });
      
      const entry = WidgetRegistry.get('ai-aggregation');
      expect(entry?.allowedPositions).toContain('header');
    });
  });
  
  describe('getByPosition', () => {
    beforeEach(() => {
      WidgetRegistry.register({
        type: 'ai-aggregation',
        component: MockAIWidget as any,
        displayName: 'AI',
        allowedPositions: ['header', 'sidebar'],
      });
      
      WidgetRegistry.register({
        type: 'stats-bar',
        component: MockStatsWidget as any,
        displayName: 'Stats',
        allowedPositions: ['header'],
      });
    });
    
    it('should return widgets for header position', () => {
      const widgets = WidgetRegistry.getByPosition('header');
      expect(widgets).toHaveLength(2);
    });
    
    it('should return widgets for sidebar position', () => {
      const widgets = WidgetRegistry.getByPosition('sidebar');
      expect(widgets).toHaveLength(1);
      expect(widgets[0].type).toBe('ai-aggregation');
    });
    
    it('should include widgets without position restrictions', () => {
      WidgetRegistry.register({
        type: 'custom',
        component: MockAIWidget as any,
        displayName: 'Custom',
        // 无 allowedPositions，表示所有位置都允许
      });
      
      const headerWidgets = WidgetRegistry.getByPosition('header');
      const sidebarWidgets = WidgetRegistry.getByPosition('sidebar');
      
      expect(headerWidgets.some(w => w.type === 'custom')).toBe(true);
      expect(sidebarWidgets.some(w => w.type === 'custom')).toBe(true);
    });
  });
  
  describe('registerWidget helper', () => {
    it('should work as a convenience function', () => {
      registerWidget({
        type: 'ai-aggregation',
        component: MockAIWidget as any,
        displayName: 'AI',
      });
      
      expect(WidgetRegistry.has('ai-aggregation')).toBe(true);
    });
  });
});
