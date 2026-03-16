import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsIn, IsOptional } from 'class-validator';

export const EdgeTypeEnum = ['CONTAINS', 'BLOCKS', 'RESOLVES', 'MENTION'] as const;
export type EdgeTypeDto = (typeof EdgeTypeEnum)[number];

export class CreateEdgeDto {
  @ApiProperty({ description: '起点节点 ID（logicalId）' })
  @IsString()
  sourceNodeId: string;

  @ApiProperty({ description: '终点节点 ID（logicalId）' })
  @IsString()
  targetNodeId: string;

  @ApiProperty({ description: '边类型', enum: EdgeTypeEnum })
  @IsIn(EdgeTypeEnum)
  edgeType: EdgeTypeDto;
}

export class EdgeQueryDto {
  @ApiPropertyOptional({ description: '节点 ID（logicalId），查该节点相关边' })
  @IsString()
  @IsOptional()
  nodeId?: string;

  @ApiPropertyOptional({ description: '边类型', enum: EdgeTypeEnum })
  @IsIn(EdgeTypeEnum)
  @IsOptional()
  edgeType?: EdgeTypeDto;

  @ApiPropertyOptional({ description: '方向：in=入边，out=出边', enum: ['in', 'out'] })
  @IsOptional()
  direction?: 'in' | 'out';
}

export class EdgeResponseDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  sourceNodeId: string;
  @ApiProperty()
  targetNodeId: string;
  @ApiProperty({ enum: EdgeTypeEnum })
  edgeType: EdgeTypeDto;
  @ApiProperty()
  createdAt: Date;
}
