'use client';

import { useState, useCallback } from 'react';
import { useNodeStore } from '@/stores/nodeStore';
import { getTemplateById } from '@/utils/command-templates';
import type { CommandConfig } from '@/types';

/**
 * 指令节点配置/执行状态与逻辑
 * 供 NodeComponent 在 node.type === 'command' 时使用
 */
export function useNodeCommand(nodeId: string) {
  const node = useNodeStore((s) => s.nodes[nodeId]);
  const nodes = useNodeStore((s) => s.nodes);
  const updateNode = useNodeStore((s) => s.updateNode);
  const addCommandNode = useNodeStore((s) => s.addCommandNode);
  const deleteNode = useNodeStore((s) => s.deleteNode);
  const executeCommandNode = useNodeStore((s) => s.executeCommandNode);

  const [isExecuting, setIsExecuting] = useState(false);
  const [showCommandConfig, setShowCommandConfig] = useState(false);
  const [pendingCommandNodeId, setPendingCommandNodeId] = useState<string | null>(null);
  const [deleteAfterCommandCreate, setDeleteAfterCommandCreate] = useState(false);

  const handleOpenCommandConfig = useCallback(() => {
    if (node?.type === 'command') {
      setPendingCommandNodeId(nodeId);
      setShowCommandConfig(true);
    }
  }, [node?.type, nodeId]);

  const handleCommandConfigConfirm = useCallback(
    (config: { templateId?: string; prompt: string }) => {
      if (pendingCommandNodeId) {
        const existingNode = nodes[pendingCommandNodeId];
        if (existingNode?.type === 'command') {
          const existingConfig = existingNode.payload as CommandConfig;
          const template = config.templateId ? getTemplateById(config.templateId) : undefined;
          updateNode(pendingCommandNodeId, {
            content: template ? `🤖 ${template.icon} ${template.name}` : '🤖 自定义指令',
            payload: {
              ...existingConfig,
              templateId: config.templateId,
              prompt: config.prompt,
            },
          });
        }
      } else {
        addCommandNode(node?.parentId ?? null, config.templateId, config.prompt, nodeId);
        if (deleteAfterCommandCreate) {
          deleteNode(nodeId);
        }
      }
      setShowCommandConfig(false);
      setPendingCommandNodeId(null);
      setDeleteAfterCommandCreate(false);
    },
    [
      pendingCommandNodeId,
      nodes,
      node?.parentId,
      nodeId,
      updateNode,
      addCommandNode,
      deleteAfterCommandCreate,
      deleteNode,
    ]
  );

  const handleCloseCommandConfig = useCallback(() => {
    setShowCommandConfig(false);
    setPendingCommandNodeId(null);
    setDeleteAfterCommandCreate(false);
  }, []);

  const handleExecuteCommand = useCallback(async () => {
    if (!node || node.type !== 'command' || isExecuting) return;
    const config = node.payload as CommandConfig;
    if (!config?.prompt && !config?.templateId) {
      setPendingCommandNodeId(nodeId);
      setShowCommandConfig(true);
      return;
    }
    setIsExecuting(true);
    try {
      await executeCommandNode(nodeId);
    } catch (error) {
      console.error('[useNodeCommand] 执行失败:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [node, nodeId, executeCommandNode, isExecuting]);

  const handleAddCommandNodeFromContext = useCallback(() => {
    setPendingCommandNodeId(null);
    setShowCommandConfig(true);
  }, []);

  /** 供 handleKeyDown 使用：/ai 回车时打开配置并标记创建后删当前节点 */
  const openCommandConfigAndDeleteCurrentAfterCreate = useCallback(() => {
    setPendingCommandNodeId(null);
    setDeleteAfterCommandCreate(true);
    setShowCommandConfig(true);
  }, []);

  const commandConfigForModal =
    pendingCommandNodeId != null ? (nodes[pendingCommandNodeId]?.payload as CommandConfig) : undefined;

  return {
    isExecuting,
    showCommandConfig,
    setShowCommandConfig,
    pendingCommandNodeId,
    setPendingCommandNodeId,
    deleteAfterCommandCreate,
    setDeleteAfterCommandCreate,
    handleOpenCommandConfig,
    handleCommandConfigConfirm,
    handleCloseCommandConfig,
    handleExecuteCommand,
    handleAddCommandNodeFromContext,
    openCommandConfigAndDeleteCurrentAfterCreate,
    commandConfigForModal,
  };
}
