/**
 * ViewRegistry 单元测试
 * v3.6: 测试视图容器注册表功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ViewRegistry, registerView, DEFAULT_VIEW_TYPE } from './ViewRegistry';
import type { ViewContainerProps } from './ViewRegistry';

// Mock 组件
const MockTableComponent = () => null;
const MockKanbanComponent = () => null;

describe('ViewRegistry', () => {
  beforeEach(() => {
    // 清空注册表
    ViewRegistry.clear();
  });
  
  describe('register', () => {
    it('should register a view container', () => {
      ViewRegistry.register({
        type: 'table',
        component: MockTableComponent as any,
        displayName: 'Table View',
      });
      
      expect(ViewRegistry.has('table')).toBe(true);
    });
    
    it('should overwrite existing registration', () => {
      ViewRegistry.register({
        type: 'table',
        component: MockTableComponent as any,
        displayName: 'Old Table',
      });
      
      ViewRegistry.register({
        type: 'table',
        component: MockKanbanComponent as any,
        displayName: 'New Table',
      });
      
      const entry = ViewRegistry.get('table');
      expect(entry?.displayName).toBe('New Table');
    });
  });
  
  describe('unregister', () => {
    it('should remove a registered view', () => {
      ViewRegistry.register({
        type: 'table',
        component: MockTableComponent as any,
        displayName: 'Table View',
      });
      
      const result = ViewRegistry.unregister('table');
      
      expect(result).toBe(true);
      expect(ViewRegistry.has('table')).toBe(false);
    });
    
    it('should return false for non-existent view', () => {
      const result = ViewRegistry.unregister('kanban');
      expect(result).toBe(false);
    });
  });
  
  describe('get', () => {
    it('should return registered entry', () => {
      ViewRegistry.register({
        type: 'table',
        component: MockTableComponent as any,
        displayName: 'Table View',
        icon: '📊',
      });
      
      const entry = ViewRegistry.get('table');
      
      expect(entry).toBeDefined();
      expect(entry?.displayName).toBe('Table View');
      expect(entry?.icon).toBe('📊');
    });
    
    it('should return undefined for non-existent view', () => {
      const entry = ViewRegistry.get('kanban');
      expect(entry).toBeUndefined();
    });
  });
  
  describe('getComponent', () => {
    it('should return component directly', () => {
      ViewRegistry.register({
        type: 'table',
        component: MockTableComponent as any,
        displayName: 'Table View',
      });
      
      const component = ViewRegistry.getComponent('table');
      expect(component).toBe(MockTableComponent);
    });
    
    it('should return undefined for non-existent view', () => {
      const component = ViewRegistry.getComponent('kanban');
      expect(component).toBeUndefined();
    });
  });
  
  describe('getAll', () => {
    it('should return all registered entries', () => {
      ViewRegistry.register({
        type: 'table',
        component: MockTableComponent as any,
        displayName: 'Table',
      });
      
      ViewRegistry.register({
        type: 'kanban',
        component: MockKanbanComponent as any,
        displayName: 'Kanban',
      });
      
      const all = ViewRegistry.getAll();
      
      expect(all).toHaveLength(2);
      expect(all.map(e => e.type)).toContain('table');
      expect(all.map(e => e.type)).toContain('kanban');
    });
  });
  
  describe('getTypes', () => {
    it('should return all registered types', () => {
      ViewRegistry.register({
        type: 'table',
        component: MockTableComponent as any,
        displayName: 'Table',
      });
      
      ViewRegistry.register({
        type: 'list',
        component: MockTableComponent as any,
        displayName: 'List',
      });
      
      const types = ViewRegistry.getTypes();
      
      expect(types).toContain('table');
      expect(types).toContain('list');
    });
  });
  
  describe('registerView helper', () => {
    it('should work as a convenience function', () => {
      registerView({
        type: 'table',
        component: MockTableComponent as any,
        displayName: 'Table View',
      });
      
      expect(ViewRegistry.has('table')).toBe(true);
    });
  });
  
  describe('DEFAULT_VIEW_TYPE', () => {
    it('should be table', () => {
      expect(DEFAULT_VIEW_TYPE).toBe('table');
    });
  });
});
