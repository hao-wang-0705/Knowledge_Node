import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Headers,
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

@ApiTags('nodes')
@Controller('api/nodes')
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Post()
  @ApiOperation({ summary: '创建节点' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 201, description: '节点创建成功', type: NodeResponseDto })
  create(
    @Headers('x-user-id') userId: string,
    @Body() createNodeDto: CreateNodeDto,
  ) {
    return this.nodesService.create(userId, createNodeDto);
  }

  @Post('batch')
  @ApiOperation({ summary: '批量创建节点' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 201, description: '节点批量创建成功' })
  batchCreate(
    @Headers('x-user-id') userId: string,
    @Body() batchCreateDto: BatchCreateNodesDto,
  ) {
    return this.nodesService.batchCreate(userId, batchCreateDto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有节点（可选 rootNodeId 子树）' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiQuery({ name: 'rootNodeId', required: false, description: '按根节点查询整棵子树' })
  @ApiResponse({ status: 200, description: '返回节点列表', type: [NodeResponseDto] })
  findAll(
    @Headers('x-user-id') userId: string,
    @Query('rootNodeId') rootNodeId?: string,
  ) {
    const options = rootNodeId ? { rootNodeId } : undefined;
    return this.nodesService.findAll(userId, options);
  }

  @Get('root')
  @ApiOperation({ summary: '获取根级别节点' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '返回根节点列表', type: [NodeResponseDto] })
  findRootNodes(@Headers('x-user-id') userId: string) {
    return this.nodesService.findRootNodes(userId);
  }

  @Get('search')
  @ApiOperation({ summary: '搜索节点' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiQuery({ name: 'q', required: true, description: '搜索关键词' })
  @ApiResponse({ status: 200, description: '返回匹配的节点列表', type: [NodeResponseDto] })
  search(
    @Headers('x-user-id') userId: string,
    @Query('q') query: string,
  ) {
    return this.nodesService.search(userId, query);
  }

  @Get('supertag/:supertagId')
  @ApiOperation({ summary: '获取指定功能标签的所有节点' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '返回节点列表', type: [NodeResponseDto] })
  findBySupertag(
    @Headers('x-user-id') userId: string,
    @Param('supertagId') supertagId: string,
  ) {
    return this.nodesService.findBySupertag(userId, supertagId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个节点' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '返回节点详情', type: NodeResponseDto })
  findOne(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
  ) {
    return this.nodesService.findOne(userId, id);
  }

  @Get(':id/tree')
  @ApiOperation({ summary: '获取节点及其所有子节点（树形结构）' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '返回节点树' })
  findNodeWithChildren(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
  ) {
    return this.nodesService.findNodeWithChildren(userId, id);
  }

  @Patch('batch')
  @ApiOperation({ summary: '批量更新节点' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '节点批量更新成功' })
  batchUpdate(
    @Headers('x-user-id') userId: string,
    @Body() batchUpdateDto: BatchUpdateNodesDto,
  ) {
    return this.nodesService.batchUpdate(userId, batchUpdateDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新节点' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '节点更新成功', type: NodeResponseDto })
  update(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
    @Body() updateNodeDto: UpdateNodeDto,
  ) {
    return this.nodesService.update(userId, id, updateNodeDto);
  }

  @Patch(':id/move')
  @ApiOperation({ summary: '移动节点' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '节点移动成功', type: NodeResponseDto })
  move(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
    @Body() moveDto: MoveNodeDto,
  ) {
    return this.nodesService.move(userId, id, moveDto);
  }

  @Patch(':id/indent')
  @ApiOperation({ summary: '缩进节点' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '节点缩进成功', type: NodeResponseDto })
  indent(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
  ) {
    return this.nodesService.indent(userId, id);
  }

  @Patch(':id/outdent')
  @ApiOperation({ summary: '反缩进节点' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '节点反缩进成功', type: NodeResponseDto })
  outdent(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
  ) {
    return this.nodesService.outdent(userId, id);
  }

  @Patch(':id/toggle-collapse')
  @ApiOperation({ summary: '切换节点折叠状态' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '折叠状态切换成功', type: NodeResponseDto })
  toggleCollapse(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
  ) {
    return this.nodesService.toggleCollapse(userId, id);
  }

  @Delete('batch')
  @ApiOperation({ summary: '批量删除节点' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '节点批量删除成功' })
  batchRemove(
    @Headers('x-user-id') userId: string,
    @Body() body: { ids: string[] },
  ) {
    return this.nodesService.batchRemove(userId, body.ids);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除节点' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '节点删除成功' })
  remove(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
  ) {
    return this.nodesService.remove(userId, id);
  }
}
