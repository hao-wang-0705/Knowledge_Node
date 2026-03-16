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
          id: randomUUID(),
          logicalId: `user-root-${userId}`,
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
      select: { id: true, parentId: true },
    });
    if (!dailyRoot) {
      await this.prisma.node.create({
        data: {
          id: randomUUID(),
          logicalId: `daily-root-${userId}`,
          userId,
          parentId: userRoot.id,
          content: '每日笔记(Daily Note)',
          nodeType: 'daily',
          nodeRole: 'daily_root',
        },
      });
    } else if (dailyRoot.parentId !== userRoot.id) {
      await this.prisma.node.update({
        where: { id: dailyRoot.id },
        data: { parentId: userRoot.id, sortOrder: 0 },
      });
    }

    // 创建平台指引笔记本（仅新用户首次创建）
    await this.createGuideNotebook(userId, userRoot.id);
  }

  /**
   * 创建平台指引笔记本 - 让新用户快速上手
   */
  private async createGuideNotebook(userId: string, userRootId: string) {
    const guideLogicalId = `guide-notebook-${userId}`;
    
    // 幂等检查：已存在则跳过
    const existingGuide = await this.prisma.node.findFirst({
      where: { userId, logicalId: guideLogicalId },
    });
    if (existingGuide) return;

    // 指引内容定义
    const guideContent = this.getGuideNotebookContent(userId);
    
    // 批量创建所有节点
    const nodesToCreate: Array<{
      id: string;
      logicalId: string;
      userId: string;
      parentId: string;
      content: string;
      nodeType: string;
      nodeRole: string;
      sortOrder: number;
    }> = [];

    // 创建根笔记本节点
    const guideRootId = randomUUID();
    nodesToCreate.push({
      id: guideRootId,
      logicalId: guideLogicalId,
      userId,
      parentId: userRootId,
      content: '🚀 新手村｜3分钟速通指南',
      nodeType: 'text',
      nodeRole: 'normal',
      sortOrder: -1, // 排在最前面
    });

    // 递归添加子节点
    let sortIndex = 0;
    for (const section of guideContent) {
      const sectionId = randomUUID();
      nodesToCreate.push({
        id: sectionId,
        logicalId: `${guideLogicalId}-${section.key}`,
        userId,
        parentId: guideRootId,
        content: section.content,
        nodeType: section.nodeType || 'text',
        nodeRole: 'normal',
        sortOrder: sortIndex++,
      });

      if (section.children) {
        let childIndex = 0;
        for (const child of section.children) {
          nodesToCreate.push({
            id: randomUUID(),
            logicalId: `${guideLogicalId}-${section.key}-${childIndex}`,
            userId,
            parentId: sectionId,
            content: child.content,
            nodeType: (child as { content: string; nodeType?: string }).nodeType || 'text',
            nodeRole: 'normal',
            sortOrder: childIndex++,
          });
        }
      }
    }

    // 事务批量创建
    await this.prisma.$transaction(
      nodesToCreate.map(node => this.prisma.node.create({ data: node }))
    );
  }

  /**
   * 获取指引笔记本内容
   */
  private getGuideNotebookContent(userId: string) {
    return [
      {
        key: 'welcome',
        content: '👋 欢迎来到 Knowledge Node！',
        nodeType: 'heading',
        children: [
          { content: '这是一个为「思考者」打造的知识管理工具。' },
          { content: '在这里，你的每一个想法都值得被记录、被连接、被回顾。' },
          { content: '准备好了吗？让我们开始 3 分钟速通之旅 ⏱️' },
        ],
      },
      {
        key: 'daily',
        content: '📅 第一站：每日笔记',
        nodeType: 'heading',
        children: [
          { content: '💡 试试看：点击侧边栏的「📅 每日笔记」，然后选择今天的日期' },
          { content: '每日笔记是你的「思维日记本」——随时记录闪念、待办、会议要点' },
          { content: '小技巧：养成每天打开它的习惯，让零散想法不再丢失 ✨' },
        ],
      },
      {
        key: 'supertag',
        content: '🏷️ 第二站：超级标签',
        nodeType: 'heading',
        children: [
          { content: '超级标签让你的笔记「活」起来！每种标签都有专属字段：' },
          { content: '☑️ 待办：状态、截止日期、优先级——再也不怕遗忘重要事项' },
          { content: '📅 会议：时间、参与者、地点——会议纪要一目了然' },
          { content: '🔥 问题：紧急度、状态——追踪难题直到解决' },
          { content: '💡 灵感：来源、关联——好点子值得被好好收藏' },
          { content: '📄 文档：版本、作者——知识沉淀的最佳载体' },
          { content: '💡 试试看：在任意节点输入「/」，选择一个超级标签试试！' },
        ],
      },
      {
        key: 'search',
        content: '🔍 第三站：智能搜索',
        nodeType: 'heading',
        children: [
          { content: '忘了笔记放哪儿？用自然语言找回它！' },
          { content: '💡 试试看：点击顶部搜索框，输入「上周的会议记录」' },
          { content: '支持的搜索方式：关键词、时间范围、标签类型...' },
          { content: '小技巧：搜索结果会自动保存，方便下次快速查看 📌' },
        ],
      },
      {
        key: 'notebook',
        content: '📓 第四站：笔记本管理',
        nodeType: 'heading',
        children: [
          { content: '把相关内容放在一起，让知识更有条理' },
          { content: '💡 试试看：在侧边栏底部点击「+ 新建笔记本」' },
          { content: '右键点击笔记本名称 → 重命名 / 删除' },
          { content: '小技巧：按主题或项目分类，找东西更快！' },
        ],
      },
      {
        key: 'shortcuts',
        content: '⌨️ 第五站：快捷键速查',
        nodeType: 'heading',
        children: [
          { content: '掌握快捷键，效率翻倍！以下是最常用的几个：' },
          { content: '「/」→ 呼出指令菜单（插入标签、格式化等）' },
          { content: '「Cmd/Ctrl + K」→ 快速搜索' },
          { content: '「Tab」→ 缩进当前节点' },
          { content: '「Shift + Tab」→ 取消缩进' },
          { content: '「Enter」→ 新建同级节点' },
          { content: '「Cmd/Ctrl + Enter」→ 新建子节点' },
        ],
      },
      {
        key: 'ending',
        content: '🎉 恭喜通关！',
        nodeType: 'heading',
        children: [
          { content: '你已经掌握了 Knowledge Node 的核心功能！' },
          { content: '现在，去创建你的第一个笔记本，开始记录吧 ✍️' },
          { content: '小提示：这个指引笔记本可以随时删除，也可以留着当参考～' },
        ],
      },
    ];
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

  /**
   * 为所有存量用户初始化新手村笔记本
   */
  async initGuideForAllUsers() {
    // 获取所有有 user_root 的用户
    const userRoots = await this.prisma.node.findMany({
      where: { nodeRole: 'user_root' },
      select: { userId: true, id: true },
    });

    const results: { userId: string; status: string }[] = [];
    
    for (const root of userRoots) {
      try {
        await this.createGuideNotebook(root.userId, root.id);
        results.push({ userId: root.userId, status: 'success' });
      } catch (error) {
        results.push({ userId: root.userId, status: `error: ${error.message}` });
      }
    }

    return {
      total: userRoots.length,
      results,
    };
  }
}
