import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { NotebooksService } from './notebooks.service';
import {
  CreateNotebookDto,
  UpdateNotebookDto,
  NotebookResponseDto,
  NotebookWithNodesDto,
} from './dto/notebook.dto';

@ApiTags('notebooks')
@Controller('api/notebooks')
export class NotebooksController {
  constructor(private readonly notebooksService: NotebooksService) {}

  @Post()
  @ApiOperation({ summary: '创建笔记本' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 201, description: '笔记本创建成功', type: NotebookResponseDto })
  create(
    @Headers('x-user-id') userId: string,
    @Body() createNotebookDto: CreateNotebookDto,
  ) {
    return this.notebooksService.create(userId, createNotebookDto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有笔记本' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '返回笔记本列表', type: [NotebookWithNodesDto] })
  findAll(@Headers('x-user-id') userId: string) {
    return this.notebooksService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个笔记本' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '返回笔记本详情', type: NotebookWithNodesDto })
  findOne(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
  ) {
    return this.notebooksService.findOne(userId, id);
  }

  @Get(':id/nodes')
  @ApiOperation({ summary: '获取笔记本及其所有节点' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '返回笔记本及节点数据' })
  findOneWithNodes(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
  ) {
    return this.notebooksService.findOneWithNodes(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新笔记本' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '笔记本更新成功', type: NotebookResponseDto })
  update(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
    @Body() updateNotebookDto: UpdateNotebookDto,
  ) {
    return this.notebooksService.update(userId, id, updateNotebookDto);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: '复制笔记本' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 201, description: '笔记本复制成功', type: NotebookResponseDto })
  duplicate(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
    @Body() body: { newName?: string },
  ) {
    return this.notebooksService.duplicate(userId, id, body.newName);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除笔记本' })
  @ApiHeader({ name: 'x-user-id', description: '用户ID', required: true })
  @ApiResponse({ status: 200, description: '笔记本删除成功' })
  remove(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
  ) {
    return this.notebooksService.remove(userId, id);
  }
}
