import { NotebooksService } from './notebooks.service';

describe('NotebooksService', () => {
  const prisma = {
    notebook: {
      findFirst: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    node: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: NotebooksService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotebooksService(prisma as any);
  });

  it('findOneWithNodes: 能递归返回根节点与子树（Happy Path）', async () => {
    prisma.notebook.findFirst.mockResolvedValue({
      id: 'nb1',
      userId: 'u1',
      name: 'Notebook',
      rootNodeId: 'root-1',
    });
    prisma.node.findFirst.mockResolvedValue({
      id: 'root-1',
      userId: 'u1',
      content: 'Root',
    });
    prisma.node.findMany.mockImplementation(({ where }: { where: { parentId: string } }) => {
      const map: Record<string, any[]> = {
        'root-1': [{ id: 'c1', parentId: 'root-1', userId: 'u1' }],
        c1: [{ id: 'c2', parentId: 'c1', userId: 'u1' }],
        c2: [],
      };
      return Promise.resolve(map[where.parentId] ?? []);
    });

    const result = await service.findOneWithNodes('u1', 'nb1');

    expect(result.nodes.map((n: any) => n.id)).toEqual(['root-1', 'c1', 'c2']);
  });

  it('findOneWithNodes: rootNodeId 为空时返回空节点列表（Edge）', async () => {
    prisma.notebook.findFirst.mockResolvedValue({
      id: 'nb-empty',
      userId: 'u1',
      name: 'Empty',
      rootNodeId: null,
    });

    const result = await service.findOneWithNodes('u1', 'nb-empty');

    expect(result.nodes).toEqual([]);
    expect(prisma.node.findFirst).not.toHaveBeenCalled();
  });

  it('findOneWithNodes: 根节点不存在时返回空节点列表（Edge）', async () => {
    prisma.notebook.findFirst.mockResolvedValue({
      id: 'nb-missing-root',
      userId: 'u1',
      name: 'MissingRoot',
      rootNodeId: 'root-x',
    });
    prisma.node.findFirst.mockResolvedValue(null);

    const result = await service.findOneWithNodes('u1', 'nb-missing-root');

    expect(result.nodes).toEqual([]);
  });

  it('remove: rootNodeId 为空时跳过递归删除但仍删除笔记本（Edge）', async () => {
    prisma.notebook.findFirst.mockResolvedValue({
      id: 'nb2',
      userId: 'u1',
      name: 'NoRoot',
      rootNodeId: null,
    });
    prisma.notebook.delete.mockResolvedValue({ id: 'nb2' });

    const result = await service.remove('u1', 'nb2');

    expect(prisma.node.findMany).not.toHaveBeenCalled();
    expect(prisma.notebook.delete).toHaveBeenCalledWith({ where: { id: 'nb2' } });
    expect(result).toEqual({ success: true });
  });
});
