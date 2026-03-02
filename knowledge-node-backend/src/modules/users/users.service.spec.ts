import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const prisma = {
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    node: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.node.findFirst.mockResolvedValue(null);
    prisma.node.create.mockResolvedValue({ id: 'root-id' });
    service = new UsersService(prisma as any);
  });

  it('create: 使用传入邮箱创建用户（Happy Path）', async () => {
    prisma.user.create.mockResolvedValue({ id: 'u1', email: 'u1@example.com' });

    await service.create({ email: 'u1@example.com', name: 'U1' });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'u1@example.com',
        name: 'U1',
        passwordHash: '',
      },
    });
  });

  it('create: 缺失邮箱时生成系统兜底邮箱（Edge）', async () => {
    prisma.user.create.mockResolvedValue({ id: 'u2', name: 'U2' });

    await service.create({ name: 'U2' });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: expect.stringMatching(/^user-.*@knowledge-node\.local$/),
        name: 'U2',
        passwordHash: '',
      },
    });
  });

  it('findOne: 用户不存在时抛出 NotFoundException（Edge）', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getOrCreateDefaultUser: 默认用户存在时直接返回（Edge）', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'du1', email: 'default@knowledge-node.local' });

    const result = await service.getOrCreateDefaultUser();

    expect(result.id).toBe('du1');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('getOrCreateDefaultUser: 默认用户不存在时创建并返回（Edge）', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'du2', email: 'default@knowledge-node.local' });

    const result = await service.getOrCreateDefaultUser();

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'default@knowledge-node.local',
        name: 'Default User',
        passwordHash: '',
      },
    });
    expect(result.id).toBe('du2');
  });
});
