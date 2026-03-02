import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsNumber,
  IsInt,
  Min,
} from 'class-validator';

export class CreateNodeDto {
  @ApiPropertyOptional({ description: '节点ID（可选，不提供则自动生成）' })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiPropertyOptional({ description: '节点内容', default: '' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ description: '节点类型', default: 'text' })
  @IsString()
  @IsOptional()
  nodeType?: string;

  @ApiPropertyOptional({ description: '父节点ID' })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ description: '排序顺序', default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '是否折叠', default: false })
  @IsBoolean()
  @IsOptional()
  isCollapsed?: boolean;

  @ApiPropertyOptional({ description: '动态字段', default: {} })
  @IsObject()
  @IsOptional()
  fields?: Record<string, any>;

  @ApiPropertyOptional({ description: '额外数据', default: {} })
  @IsObject()
  @IsOptional()
  payload?: Record<string, any>;

  @ApiPropertyOptional({ description: '功能标签ID' })
  @IsString()
  @IsOptional()
  supertagId?: string;
}

export class UpdateNodeDto {
  @ApiPropertyOptional({ description: '节点内容' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ description: '节点类型' })
  @IsString()
  @IsOptional()
  nodeType?: string;

  @ApiPropertyOptional({ description: '父节点ID' })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ description: '排序顺序' })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '是否折叠' })
  @IsBoolean()
  @IsOptional()
  isCollapsed?: boolean;

  @ApiPropertyOptional({ description: '动态字段' })
  @IsObject()
  @IsOptional()
  fields?: Record<string, any>;

  @ApiPropertyOptional({ description: '额外数据' })
  @IsObject()
  @IsOptional()
  payload?: Record<string, any>;

  @ApiPropertyOptional({ description: '功能标签ID' })
  @IsString()
  @IsOptional()
  supertagId?: string;
}

export class BatchUpdateNodesDto {
  @ApiProperty({ description: '要更新的节点列表' })
  nodes: Array<{ id: string } & UpdateNodeDto>;
}

export class BatchCreateNodesDto {
  @ApiProperty({ description: '要创建的节点列表' })
  nodes: CreateNodeDto[];
}

export class MoveNodeDto {
  @ApiProperty({ description: '新的父节点ID（null表示移到根级别）' })
  @IsString()
  @IsOptional()
  newParentId?: string;

  @ApiProperty({ description: '新的排序顺序' })
  @IsInt()
  @Min(0)
  @IsOptional()
  newSortOrder?: number;
}

export class NodeResponseDto {
  @ApiProperty({ description: '节点ID' })
  id: string;

  @ApiProperty({ description: '用户ID' })
  userId: string;

  @ApiProperty({ description: '节点内容' })
  content: string;

  @ApiProperty({ description: '节点类型' })
  nodeType: string;

  @ApiPropertyOptional({ description: '父节点ID' })
  parentId?: string;

  @ApiProperty({ description: '排序顺序' })
  sortOrder: number;

  @ApiProperty({ description: '是否折叠' })
  isCollapsed: boolean;

  @ApiProperty({ description: '动态字段' })
  fields: Record<string, any>;

  @ApiProperty({ description: '额外数据' })
  payload: Record<string, any>;

  @ApiPropertyOptional({ description: '功能标签ID' })
  supertagId?: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}
