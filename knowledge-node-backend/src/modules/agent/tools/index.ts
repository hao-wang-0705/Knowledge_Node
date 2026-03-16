/**
 * Agent 工具导出
 */

export * from './base.tool';
export * from './tool.registry';
export * from './text-generate.tool';
export * from './web-search.tool';
export * from './summarize.tool';
export * from './expand.tool';
export * from './should-suggest-deconstruct.tool';
export * from './aggregate.tool';
export * from './search-nl-parse.tool';

// v5.0: 新工具
export * from './image-recognize.tool';
export * from './voice-recognize.tool';
export * from './smart-structure.tool';

// 向后兼容：保留旧工具导出
export * from './transcribe.tool';
export * from './capture.tool';
export * from './smart-capture.tool';
export * from './smart-deconstruct.tool';
