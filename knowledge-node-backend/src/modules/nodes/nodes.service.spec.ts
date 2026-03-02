import { ConflictException } from '@nestjs/common';
import { NodesService } from './nodes.service';

const stubNode = (overrides: Record<string, unknown> = {}) => ({
  id: 'n1',
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

describe('NodesService (ADR-005 tree isolation)', () => {
  const prisma = {
    node: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    notebook: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  let service: NodesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NodesService(prisma as any);
  });

  it('remove: 当节点为笔记本根节点时抛出 ConflictException', async () => {
    prisma.node.findFirst.mockResolvedValue(stubNode({ id: 'root-1', parentId: null }));
    prisma.node.findMany.mockResolvedValue([]);
    prisma.notebook.findFirst.mockResolvedValue({ id: 'nb1', userId: 'u1', rootNodeId: 'root-1' });

    await expect(service.remove('u1', 'root-1')).rejects.toThrow(ConflictException);
    expect(prisma.node.delete).not.toHaveBeenCalled();
  });

  it('remove: 当节点非笔记本根时正常删除', async () => {
    prisma.node.findFirst.mockResolvedValue(stubNode({ id: 'n1', parentId: 'root-1' }));
    prisma.node.findMany.mockResolvedValue([]);
    prisma.notebook.findFirst.mockResolvedValue(null);
    prisma.node.delete.mockResolvedValue({ id: 'n1' });

    const result = await service.remove('u1', 'n1');

    expect(result).toEqual({ success: true });
    expect(prisma.node.delete).toHaveBeenCalledWith({ where: { id: 'n1' } });
  });

  it('create: 继承父节点 scope/notebookId', async () => {
    prisma.node.findFirst.mockResolvedValue({
      id: 'parent-1',
      userId: 'u1',
      scope: 'notebook',
      notebookId: 'nb1',
    });
    prisma.node.create.mockResolvedValue(
      stubNode({
        id: 'new-1',
        content: 'Child',
        parentId: 'parent-1',
        scope: 'notebook',
        notebookId: 'nb1',
      })
    );
    prisma.node.findMany.mockResolvedValue([]);

    await service.create('u1', {
      content: 'Child',
      parentId: 'parent-1',
    });

    expect(prisma.node.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scope: 'notebook',
        notebookId: 'nb1',
        parentId: 'parent-1',
      }),
    });
  });

  it('findAll: 默认排除 notebook 根（buildScopeWhere 排除 notebookRootIds）', async () => {
    prisma.notebook.findMany.mockResolvedValue([
      { rootNodeId: 'root-nb1' },
      { rootNodeId: 'root-nb2' },
    ]);
    prisma.node.findMany.mockResolvedValue([
      stubNode({
        id: 'day-1',
        parentId: null,
        scope: 'daily',
        content: 'Day',
        nodeType: 'daily',
      }),
    ]);

    await service.findAll('u1');

    const findManyCalls = prisma.node.findMany.mock.calls;
    const findAllCall = findManyCalls.find(
      (c) => c[0].where?.AND && Array.isArray(c[0].where.AND)
    );
    expect(findAllCall).toBeDefined();
    expect(findAllCall![0].where).toMatchObject({
      userId: 'u1',
      AND: expect.arrayContaining([
        { OR: [{ scope: 'general' }, { scope: 'daily' }] },
        { id: { notIn: ['root-nb1', 'root-nb2'] } },
      ]),
    });
    expect(findAllCall![0].orderBy).toEqual([
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ]);
  });
});
