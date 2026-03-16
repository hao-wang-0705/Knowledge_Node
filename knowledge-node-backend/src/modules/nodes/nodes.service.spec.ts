import { ConflictException } from '@nestjs/common';
import { NodesService } from './nodes.service';

const stubNode = (overrides: Record<string, unknown> = {}) => ({
  id: 'n1',
  logicalId: 'n1',
  userId: 'u1',
  parentId: null,
  content: '',
  nodeType: 'text',
  sortOrder: 0,
  isCollapsed: false,
  fields: {},
  payload: {},
  supertagId: null,
  scope: 'general',
  notebookId: null,
  nodeRole: 'normal',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const stubEdgesService = {
  getContainsChildrenPhysicalIds: jest.fn().mockResolvedValue([]),
  getContainsParentPhysicalId: jest.fn().mockResolvedValue(null),
  getContainsParentLogicalIds: jest.fn().mockResolvedValue(new Map()),
  getContainsChildrenLogicalIds: jest.fn().mockResolvedValue(new Map()),
  ensureContainsEdge: jest.fn().mockResolvedValue(undefined),
  removeContainsInEdgeForTarget: jest.fn().mockResolvedValue(undefined),
  syncMentionOutEdgesForSource: jest.fn().mockResolvedValue(undefined),
  findMentionInEdgesForTarget: jest.fn().mockResolvedValue([]),
};

const stubStatusMachineService = {
  getStatusConfig: jest.fn().mockResolvedValue(null),
  getStatusFieldKey: jest.fn().mockResolvedValue(null),
  isBlocked: jest.fn().mockResolvedValue(false),
  isResolved: jest.fn().mockResolvedValue(false),
  isDone: jest.fn().mockResolvedValue(false),
  getBlockedState: jest.fn().mockResolvedValue('Locked'),
  getUnblockedState: jest.fn().mockResolvedValue('Ready'),
};

describe('NodesService (ADR-005 tree isolation)', () => {
  const prisma = {
    node: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    networkEdge: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    notebook: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  let service: NodesService;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    stubEdgesService.getContainsChildrenPhysicalIds.mockResolvedValue([]);
    stubEdgesService.findMentionInEdgesForTarget.mockResolvedValue([]);
    service = new NodesService(prisma as any, stubEdgesService as any, stubStatusMachineService as any);
  });

  it('remove: 当节点为结构根时抛出 ConflictException', async () => {
    prisma.node.findFirst.mockResolvedValue(
      stubNode({ id: 'root-1', logicalId: 'root-1', parentId: null, nodeRole: 'user_root' }),
    );

    await expect(service.remove('u1', 'root-1')).rejects.toThrow(ConflictException);
    expect(prisma.node.deleteMany).not.toHaveBeenCalled();
  });

  it('remove: 当节点非笔记本根时正常删除', async () => {
    prisma.node.findFirst.mockResolvedValue(stubNode({ id: 'n1', logicalId: 'n1', parentId: 'root-1' }));
    prisma.node.deleteMany.mockResolvedValue({ count: 1 });

    const result = await service.remove('u1', 'n1');

    expect(result).toEqual({ success: true });
    expect(prisma.node.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', id: { in: ['n1'] } },
    });
  });

  it('create: 带 parentId 时写入 CONTAINS 边', async () => {
    prisma.node.findFirst
      .mockResolvedValueOnce({ id: 'parent-phy', logicalId: 'parent-1', userId: 'u1' })
      .mockResolvedValueOnce({ logicalId: 'parent-1' }); // mapNodeToApiModel 父 logicalId
    prisma.node.upsert.mockResolvedValue(
      stubNode({
        id: 'new-phy',
        logicalId: 'new-1',
        content: 'Child',
        parentId: 'parent-phy',
      }),
    );
    prisma.node.findMany.mockResolvedValue([]); // mapNodeToApiModel 子节点列表
    stubEdgesService.getContainsParentPhysicalId.mockResolvedValue('parent-phy');
    stubEdgesService.getContainsChildrenPhysicalIds.mockResolvedValue([]);

    await service.create('u1', {
      id: 'new-1',
      content: 'Child',
      parentId: 'parent-1',
    });

    expect(prisma.node.upsert).toHaveBeenCalled();
    expect(stubEdgesService.ensureContainsEdge).toHaveBeenCalledWith('u1', 'parent-1', 'new-1');
  });

  it('create: 会基于 references 同步 MENTION 出边', async () => {
    prisma.node.findFirst.mockResolvedValueOnce(null);
    prisma.node.upsert.mockResolvedValue(
      stubNode({
        id: 'src-phy',
        logicalId: 'src-1',
        content: 'source',
        references: [{ targetNodeId: 'target-1' }],
        fields: {},
      }),
    );
    prisma.node.findMany.mockResolvedValue([]);
    stubEdgesService.getContainsParentPhysicalId.mockResolvedValue(null);
    stubEdgesService.getContainsChildrenPhysicalIds.mockResolvedValue([]);

    await service.create('u1', {
      id: 'src-1',
      content: 'source',
      references: [{ targetNodeId: 'target-1' }],
    });

    expect(stubEdgesService.syncMentionOutEdgesForSource).toHaveBeenCalledWith(
      'u1',
      'src-1',
      ['target-1'],
    );
  });

  it('update: 当 references 变化时会同步 MENTION 出边', async () => {
    jest.spyOn(service as any, 'findNodeByExternalId').mockResolvedValue(
      {
        id: 'src-phy',
        logicalId: 'src-1',
        userId: 'u1',
        parentId: null,
        nodeRole: 'normal',
        sortOrder: 0,
      },
    );
    prisma.node.update.mockResolvedValue(
      stubNode({
        id: 'src-phy',
        logicalId: 'src-1',
        content: 'new',
        references: [{ targetNodeId: 'target-1' }],
        fields: {},
      }),
    );
    prisma.node.findMany.mockResolvedValue([]);
    stubEdgesService.getContainsParentPhysicalId.mockResolvedValue(null);
    stubEdgesService.getContainsChildrenPhysicalIds.mockResolvedValue([]);

    await service.update('u1', 'src-1', {
      references: [{ targetNodeId: 'target-1' }],
    });

    expect(stubEdgesService.syncMentionOutEdgesForSource).toHaveBeenCalledWith(
      'u1',
      'src-1',
      ['target-1'],
    );
  });

  it('findMentionedBy: 返回提及节点及来源类型', async () => {
    stubEdgesService.findMentionInEdgesForTarget.mockResolvedValue([
      { sourceNodeId: 'src-1', targetNodeId: 'target-1', createdAt: new Date() },
    ]);
    prisma.node.findMany.mockResolvedValue([
      stubNode({
        id: 'src-phy',
        logicalId: 'src-1',
        content: 'source node',
        references: [{ targetNodeId: 'target-1' }],
        fields: {},
      }),
    ]);
    stubEdgesService.getContainsParentLogicalIds.mockResolvedValue(new Map());
    stubEdgesService.getContainsChildrenLogicalIds.mockResolvedValue(new Map());
    stubEdgesService.getContainsParentPhysicalId.mockResolvedValue(null);

    const result = await service.findMentionedBy('u1', 'target-1');

    expect(result).toHaveLength(1);
    expect(result[0].node.id).toBe('src-1');
    expect(result[0].sourceType).toBe('reference');
  });

  it('findAll: 返回用户节点并基于 CONTAINS 边推导 parent/children', async () => {
    jest.spyOn(service as any, 'ensureStructuralRoots').mockResolvedValue(undefined);
    prisma.node.findMany.mockResolvedValue([
      stubNode({ id: 'n1', logicalId: 'n1', content: 'A' }),
      stubNode({ id: 'n2', logicalId: 'n2', content: 'B' }),
    ]);

    const result = await service.findAll('u1');

    expect(prisma.node.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });
});
