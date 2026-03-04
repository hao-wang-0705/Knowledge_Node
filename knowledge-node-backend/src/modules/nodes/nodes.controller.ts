import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { NodesService } from './nodes.service';
import {
  CreateNodeDto,
  UpdateNodeDto,
  BatchCreateNodesDto,
  BatchUpdateNodesDto,
  MoveNodeDto,
  NodeResponseDto,
} from './dto/node.dto';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';

type RepairItemDto = {
  nodeId: string;
  expectedParentId: string | null;
};

type CalendarRepairDto = {
  items?: RepairItemDto[];
  dryRun?: boolean;
  auto?: boolean;
};

@ApiTags('nodes')
@Controller('api/nodes')
@UseGuards(InternalAuthGuard)
@ApiHeader({ name: 'x-user-id', description: '用户ID（由网关注入）', required: true })
@ApiHeader({ name: 'x-internal-api-key', description: '内部网关密钥', required: true })
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Post()
  @ApiOperation({ summary: '创建节点' })
  @ApiResponse({ status: 201, description: '节点创建成功', type: NodeResponseDto })
  create(@CurrentUserId() userId: string, @Body() createNodeDto: CreateNodeDto) {
    return this.nodesService.create(userId, createNodeDto);
  }

  @Post('batch')
  @ApiOperation({ summary: '批量创建节点' })
  @ApiResponse({ status: 201, description: '节点批量创建成功' })
  batchCreate(@CurrentUserId() userId: string, @Body() batchCreateDto: BatchCreateNodesDto) {
    return this.nodesService.batchCreate(userId, batchCreateDto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有节点（可选 rootNodeId 子树）' })
  @ApiQuery({ name: 'rootNodeId', required: false, description: '按根节点查询整棵子树' })
  @ApiResponse({ status: 200, description: '返回节点列表', type: [NodeResponseDto] })
  findAll(@CurrentUserId() userId: string, @Query('rootNodeId') rootNodeId?: string) {
    const options = rootNodeId ? { rootNodeId } : undefined;
    return this.nodesService.findAll(userId, options);
  }

  @Get('root')
  @ApiOperation({ summary: '获取根级别节点' })
  @ApiResponse({ status: 200, description: '返回根节点列表', type: [NodeResponseDto] })
  findRootNodes(@CurrentUserId() userId: string) {
    return this.nodesService.findRootNodes(userId);
  }

  @Get('search')
  @ApiOperation({ summary: '搜索节点' })
  @ApiQuery({ name: 'q', required: true, description: '搜索关键词' })
  @ApiResponse({ status: 200, description: '返回匹配的节点列表', type: [NodeResponseDto] })
  search(@CurrentUserId() userId: string, @Query('q') query: string) {
    return this.nodesService.search(userId, query);
  }

  @Get('supertag/:supertagId')
  @ApiOperation({ summary: '获取指定功能标签的所有节点' })
  @ApiResponse({ status: 200, description: '返回节点列表', type: [NodeResponseDto] })
  findBySupertag(@CurrentUserId() userId: string, @Param('supertagId') supertagId: string) {
    return this.nodesService.findBySupertag(userId, supertagId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个节点' })
  @ApiResponse({ status: 200, description: '返回节点详情', type: NodeResponseDto })
  findOne(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.nodesService.findOne(userId, id);
  }

  @Get(':id/tree')
  @ApiOperation({ summary: '获取节点及其所有子节点（树形结构）' })
  @ApiResponse({ status: 200, description: '返回节点树' })
  findNodeWithChildren(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.nodesService.findNodeWithChildren(userId, id);
  }

  @Patch('batch')
  @ApiOperation({ summary: '批量更新节点' })
  @ApiResponse({ status: 200, description: '节点批量更新成功' })
  batchUpdate(@CurrentUserId() userId: string, @Body() batchUpdateDto: BatchUpdateNodesDto) {
    return this.nodesService.batchUpdate(userId, batchUpdateDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新节点' })
  @ApiResponse({ status: 200, description: '节点更新成功', type: NodeResponseDto })
  update(@CurrentUserId() userId: string, @Param('id') id: string, @Body() updateNodeDto: UpdateNodeDto) {
    return this.nodesService.update(userId, id, updateNodeDto);
  }

  @Patch(':id/move')
  @ApiOperation({ summary: '移动节点' })
  @ApiResponse({ status: 200, description: '节点移动成功', type: NodeResponseDto })
  move(@CurrentUserId() userId: string, @Param('id') id: string, @Body() moveDto: MoveNodeDto) {
    return this.nodesService.move(userId, id, moveDto);
  }

  @Patch(':id/indent')
  @ApiOperation({ summary: '缩进节点' })
  @ApiResponse({ status: 200, description: '节点缩进成功', type: NodeResponseDto })
  indent(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.nodesService.indent(userId, id);
  }

  @Patch(':id/outdent')
  @ApiOperation({ summary: '反缩进节点' })
  @ApiResponse({ status: 200, description: '节点反缩进成功', type: NodeResponseDto })
  outdent(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.nodesService.outdent(userId, id);
  }

  @Patch(':id/toggle-collapse')
  @ApiOperation({ summary: '切换节点折叠状态' })
  @ApiResponse({ status: 200, description: '折叠状态切换成功', type: NodeResponseDto })
  toggleCollapse(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.nodesService.toggleCollapse(userId, id);
  }

  @Delete('batch')
  @ApiOperation({ summary: '批量删除节点' })
  @ApiResponse({ status: 200, description: '节点批量删除成功' })
  batchRemove(@CurrentUserId() userId: string, @Body() body: { ids: string[] }) {
    return this.nodesService.batchRemove(userId, body.ids);
  }

  @Delete('orphans')
  @ApiOperation({ summary: '清理孤儿节点（parentId=null 且 nodeRole=normal 的节点及其子树）' })
  @ApiResponse({ 
    status: 200, 
    description: '孤儿节点清理成功',
    schema: {
      type: 'object',
      properties: {
        deletedCount: { type: 'number', description: '删除的节点数量' },
        deletedIds: { type: 'array', items: { type: 'string' }, description: '删除的节点ID列表' },
      },
    },
  })
  cleanupOrphanNodes(@CurrentUserId() userId: string) {
    return this.nodesService.cleanupOrphanNodes(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除节点' })
  @ApiResponse({ status: 200, description: '节点删除成功' })
  remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.nodesService.remove(userId, id);
  }

  @Get('ops/init-daily/status')
  @ApiOperation({ summary: '检查是否需要初始化 Daily Notes' })
  initDailyStatus(@CurrentUserId() userId: string) {
    return this.nodesService.getDailyInitializationStatus(userId);
  }

  @Post('ops/init-daily')
  @ApiOperation({ summary: '初始化 Daily Notes 结构' })
  initDaily(@CurrentUserId() userId: string) {
    return this.nodesService.initializeDailyNotes(userId);
  }

  @Get('ops/calendar-diagnostic')
  @ApiOperation({ summary: '诊断日历层级关系' })
  calendarDiagnostic(@CurrentUserId() userId: string) {
    return this.nodesService.runCalendarDiagnostic(userId);
  }

  @Post('ops/calendar-repair')
  @ApiOperation({ summary: '修复日历层级关系' })
  calendarRepair(@CurrentUserId() userId: string, @Body() body: CalendarRepairDto) {
    return this.nodesService.repairCalendarHierarchy(userId, body);
  }
}
