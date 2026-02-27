import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    return this.prisma.user.create({
      data: createUserDto,
    });
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
        },
      });
    }

    return user;
  }
}
