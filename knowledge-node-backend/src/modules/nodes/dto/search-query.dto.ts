import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchConditionDto {
  @ApiProperty({ enum: ['tag', 'field', 'keyword', 'ancestor', 'date'] })
  @IsString()
  @IsIn(['tag', 'field', 'keyword', 'ancestor', 'date'])
  type: string;

  @ApiPropertyOptional({ description: '字段名（field/date 类型可选）' })
  @IsOptional()
  @IsString()
  field?: string;

  @ApiProperty({
    enum: ['equals', 'contains', 'gt', 'lt', 'gte', 'lte', 'is', 'isNot', 'hasAny', 'hasAll', 'today', 'withinDays'],
  })
  @IsString()
  @IsIn(['equals', 'contains', 'gt', 'lt', 'gte', 'lte', 'is', 'isNot', 'hasAny', 'hasAll', 'today', 'withinDays'])
  operator: string;

  @ApiProperty({ description: '条件值（字符串、数字、布尔值或字符串数组）' })
  @IsDefined()
  value: string | number | boolean | string[];

  @ApiPropertyOptional({ description: '是否取反（NOT）', default: false })
  @IsOptional()
  @IsBoolean()
  negate?: boolean;
}

export class SearchQueryDto {
  @ApiProperty({ type: [SearchConditionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SearchConditionDto)
  conditions: SearchConditionDto[];

  @ApiProperty({ enum: ['AND', 'OR'], default: 'AND' })
  @IsString()
  @IsIn(['AND', 'OR'])
  logicalOperator: 'AND' | 'OR';

  @ApiPropertyOptional({ description: '分页大小', default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number;

  @ApiPropertyOptional({ description: '分页游标（节点 logicalId）' })
  @IsOptional()
  @IsString()
  cursor?: string;
}
