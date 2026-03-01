import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateNotebookDto, UpdateNotebookDto } from './dto/notebook.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class NotebooksService {
  constructor(private prisma: PrismaService) {}

  // 创建笔记本（ADR-005：笔记本树隔离）
  async create(userId: string, createNotebookDto: CreateNotebookDto) {
    const notebookId = uuidv4();
    const rootNodeId = createNotebookDto.rootNodeId || `root-${notebookId}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const notebook = await tx.notebook.create({
        data: {
          id: notebookId,
          name: createNotebookDto.name,
          icon: createNotebookDto.icon,
          rootNodeId,
          userId,
        },
      });
      await tx.node.create({
        data: {
          id: rootNodeId,
          content: createNotebookDto.name,
          nodeType: 'root',
          userId,
          scope: 'notebook',
          notebookId: notebook.id,
        },
      });
      return notebook;
    });

    return result;
  }

  // 获取用户的所有笔记本
  async findAll(userId: string) {
    const notebooks = await this.prisma.notebook.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    return notebooks;
  }

  // 获取单个笔记本
  async findOne(userId: string, id: string) {
    const notebook = await this.prisma.notebook.findFirst({
      where: { id, userId },
    });

    if (!notebook) {
      throw new NotFoundException(`Notebook with ID ${id} not found`);
    }

    return notebook;
  }

  // 获取笔记本及其所有节点
  async findOneWithNodes(userId: string, id: string) {
    const notebook = await this.findOne(userId, id);
    const rootNodeId = notebook.rootNodeId;

    if (!rootNodeId) {
      return { ...notebook, nodes: [] };
    }

    // 获取根节点及其所有子节点
    const rootNode = await this.prisma.node.findFirst({
      where: { id: rootNodeId, userId },
    });

    if (!rootNode) {
      return { ...notebook, nodes: [] };
    }

    // 递归获取所有子节点
    const getAllDescendants = async (parentId: string): Promise<any[]> => {
      const children = await this.prisma.node.findMany({
        where: { parentId, userId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });

      const descendants: any[] = [];
      for (const child of children) {
        descendants.push(child);
        const childDescendants = await getAllDescendants(child.id);
        descendants.push(...childDescendants);
      }
      return descendants;
    };

    const descendants = await getAllDescendants(rootNodeId);
    const nodes = [rootNode, ...descendants];

    return {
      ...notebook,
      nodes,
    };
  }

  // 更新笔记本
  async update(userId: string, id: string, updateNotebookDto: UpdateNotebookDto) {
    await this.findOne(userId, id); // 确保笔记本存在且属于该用户

    return this.prisma.notebook.update({
      where: { id },
      data: updateNotebookDto,
    });
  }

  // 删除笔记本（包括其所有节点）
  async remove(userId: string, id: string) {
    const notebook = await this.findOne(userId, id); // 确保笔记本存在且属于该用户

    // 递归删除所有子节点
    const deleteNodeAndDescendants = async (nodeId: string) => {
      const children = await this.prisma.node.findMany({
        where: { parentId: nodeId, userId },
      });

      for (const child of children) {
        await deleteNodeAndDescendants(child.id);
      }

      await this.prisma.node.delete({
        where: { id: nodeId },
      }).catch(() => {});
    };

    // 删除根节点及其所有子节点
    if (notebook.rootNodeId) {
      await deleteNodeAndDescendants(notebook.rootNodeId);
    }

    // 删除笔记本
    await this.prisma.notebook.delete({
      where: { id },
    });

    return { success: true };
  }

  // 复制笔记本
  async duplicate(userId: string, id: string, newName?: string) {
    const original = await this.findOneWithNodes(userId, id);

    const newNotebookId = uuidv4();
    const newRootNodeId = `root-${newNotebookId}`;
    const sourceRootNodeId = original.rootNodeId;

    if (!sourceRootNodeId) {
      return this.create(userId, {
        name: newName || `${original.name} (副本)`,
        icon: original.icon ?? undefined,
        rootNodeId: newRootNodeId,
      });
    }

    // 创建节点ID映射
    const idMapping: Record<string, string> = {
      [sourceRootNodeId]: newRootNodeId,
    };

    // 为每个节点生成新ID
    original.nodes.forEach((node: any) => {
      if (node.id !== sourceRootNodeId) {
        idMapping[node.id] = uuidv4();
      }
    });

    // 复制节点并更新ID引用（ADR-005：新笔记本树隔离）
    const newNodes = original.nodes.map((node: any) => ({
      id: idMapping[node.id],
      content: node.content,
      nodeType: node.nodeType,
      parentId: node.parentId ? idMapping[node.parentId] : null,
      sortOrder: node.sortOrder,
      isCollapsed: node.isCollapsed,
      fields: node.fields,
      payload: node.payload,
      supertagId: node.supertagId,
      scope: 'notebook',
      notebookId: newNotebookId,
      userId,
    }));

    // 使用事务创建新笔记本和节点
    const [notebook] = await this.prisma.$transaction([
      this.prisma.notebook.create({
        data: {
          id: newNotebookId,
          name: newName || `${original.name} (副本)`,
          icon: original.icon,
          rootNodeId: newRootNodeId,
          userId,
        },
      }),
      this.prisma.node.createMany({
        data: newNodes,
      }),
    ]);

    return notebook;
  }
}
