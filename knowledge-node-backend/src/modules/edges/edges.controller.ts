import { Controller, Get, Post, Delete, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { EdgesService } from './edges.service';
import { CreateEdgeDto, EdgeQueryDto } from './dto/edge.dto';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';

@ApiTags('edges')
@Controller('api/edges')
@UseGuards(InternalAuthGuard)
@ApiHeader({ name: 'x-user-id', description: '用户ID（由网关注入）', required: true })
@ApiHeader({ name: 'x-internal-api-key', description: '内部网关密钥', required: true })
export class EdgesController {
  constructor(private readonly edgesService: EdgesService) {}

  @Post()
  @ApiOperation({ summary: '创建边（CONTAINS/BLOCKS/RESOLVES/MENTION）' })
  @ApiResponse({ status: 200, description: '创建成功' })
  @ApiResponse({ status: 400, description: '语义校验失败或循环依赖' })
  create(@CurrentUserId() userId: string, @Body() dto: CreateEdgeDto) {
    return this.edgesService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: '查询边（按节点、类型、方向）' })
  getEdges(
    @CurrentUserId() userId: string,
    @Query() query: EdgeQueryDto,
  ) {
    return this.edgesService.findEdges(userId, {
      nodeId: query.nodeId,
      edgeType: query.edgeType,
      direction: query.direction,
    });
  }

  @Delete()
  @ApiOperation({ summary: '删除指定边' })
  delete(
    @CurrentUserId() userId: string,
    @Query('sourceNodeId') sourceNodeId: string,
    @Query('targetNodeId') targetNodeId: string,
    @Query('edgeType') edgeType: 'CONTAINS' | 'BLOCKS' | 'RESOLVES' | 'MENTION',
  ) {
    return this.edgesService.deleteBySourceTargetType(
      userId,
      sourceNodeId,
      targetNodeId,
      edgeType,
    );
  }
}
