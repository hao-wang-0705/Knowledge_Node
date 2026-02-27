import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // 清理数据库（仅用于测试）
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase can only be used in test environment');
    }
    
    const models = Reflect.ownKeys(this).filter(key => 
      typeof key === 'string' && !key.startsWith('_') && !key.startsWith('$')
    );
    
    return Promise.all(
      models.map(modelKey => (this[modelKey as keyof this] as any)?.deleteMany?.())
    );
  }
}
