'use client';

import React, { createContext, useContext } from 'react';

/** 折叠状态按视图隔离时的视图键：主树 'main'，某搜索节点结果树 `search:${searchNodeId}` */
export const DEFAULT_COLLAPSE_VIEW_KEY = 'main';

export const CollapseViewKeyContext = createContext<string>(DEFAULT_COLLAPSE_VIEW_KEY);

export function useCollapseViewKey(): string {
  return useContext(CollapseViewKeyContext) ?? DEFAULT_COLLAPSE_VIEW_KEY;
}
