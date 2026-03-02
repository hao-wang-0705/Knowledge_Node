import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private async ensureRootTree(userId: string) {
    let userRoot = await this.prisma.node.findFirst({
      where: { userId, nodeRole: 'user_root' },
      select: { id: true },
    });
    if (!userRoot) {
      userRoot = await this.prisma.node.create({
        data: {
          id: `user-root-${userId}`,
          userId,
          content: '用户根节点',
          nodeType: 'root',
          nodeRole: 'user_root',
        },
        select: { id: true },
      });
    }

    const dailyRoot = await this.prisma.node.findFirst({
      where: { userId, nodeRole: 'daily_root' },
      select: { id: true },
    });
    if (!dailyRoot) {
      await this.prisma.node.create({
        data: {
          id: `daily-root-${userId}`,
          userId,
          parentId: userRoot.id,
          content: '每日笔记(Daily Note)',
          nodeType: 'daily',
          nodeRole: 'daily_root',
        },
      });
    }
  }

  async create(createUserDto: CreateUserDto) {
    const email = createUserDto.email ?? `user-${randomUUID()}@knowledge-node.local`;

    const user = await this.prisma.user.create({
      data: {
        email,
        name: createUserDto.name,
        // 默认用户创建走系统占位密码，注册流程会写入真实哈希
        passwordHash: '',
      },
    });
    await this.ensureRootTree(user.id);
    return user;
  }

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.findOne(id); // 确保用户存在

    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id); // 确保用户存在

    return this.prisma.user.delete({
      where: { id },
    });
  }

  // 获取或创建默认用户（用于开发/测试）
  async getOrCreateDefaultUser() {
    const defaultEmail = 'default@knowledge-node.local';
    
    let user = await this.prisma.user.findUnique({
      where: { email: defaultEmail },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: defaultEmail,
          name: 'Default User',
          passwordHash: '',
        },
      });
    }

    await this.ensureRootTree(user.id);
    return user;
  }
}
