import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateNotebookDto {
  @ApiProperty({ description: '笔记本名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '笔记本图标' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: '根节点ID（不提供则自动创建）' })
  @IsString()
  @IsOptional()
  rootNodeId?: string;
}

export class UpdateNotebookDto {
  @ApiPropertyOptional({ description: '笔记本名称' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '笔记本图标' })
  @IsString()
  @IsOptional()
  icon?: string;
}

export class NotebookResponseDto {
  @ApiProperty({ description: '笔记本ID' })
  id: string;

  @ApiProperty({ description: '笔记本名称' })
  name: string;

  @ApiPropertyOptional({ description: '笔记本图标' })
  icon?: string;

  @ApiProperty({ description: '根节点ID' })
  rootNodeId: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class NotebookWithNodesDto extends NotebookResponseDto {
  @ApiProperty({ description: '节点数量' })
  nodeCount: number;
}
