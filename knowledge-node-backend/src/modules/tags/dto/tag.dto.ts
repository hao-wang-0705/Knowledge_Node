import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsBoolean, IsObject } from 'class-validator';

// =============== Supertag DTOs ===============

export class CreateSupertagDto {
  @ApiProperty({ description: '标签名称' })
  @IsString()
  name: string;

  @ApiProperty({ description: '标签颜色' })
  @IsString()
  color: string;

  @ApiPropertyOptional({ description: '标签分类ID' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: '标签图标' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: '标签描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '字段定义', default: [] })
  @IsArray()
  @IsOptional()
  fieldDefinitions?: any[];

  @ApiPropertyOptional({ description: '是否为系统标签', default: false })
  @IsBoolean()
  @IsOptional()
  isSystem?: boolean;

  /** v2.1: 父标签 ID，用于继承 */
  @ApiPropertyOptional({ description: '父标签 ID（继承用）' })
  @IsString()
  @IsOptional()
  parentId?: string;

  /** v2.1: 默认内容模版，JSON 节点树' */
  @ApiPropertyOptional({ description: '默认内容模版（节点树 JSON）' })
  @IsObject()
  @IsOptional()
  templateContent?: any;
}

export class UpdateSupertagDto {
  @ApiPropertyOptional({ description: '标签名称' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '标签颜色' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ description: '标签分类ID' })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: '标签图标' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: '标签描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '字段定义' })
  @IsArray()
  @IsOptional()
  fieldDefinitions?: any[];

  /** v2.1: 父标签 ID */
  @ApiPropertyOptional({ description: '父标签 ID（继承用）' })
  @IsString()
  @IsOptional()
  parentId?: string;

  /** v2.1: 默认内容模版 */
  @ApiPropertyOptional({ description: '默认内容模版（节点树 JSON）' })
  @IsObject()
  @IsOptional()
  templateContent?: any;
}

export class SupertagResponseDto {
  @ApiProperty({ description: '标签ID' })
  id: string;

  @ApiProperty({ description: '标签名称' })
  name: string;

  @ApiProperty({ description: '标签颜色' })
  color: string;

  @ApiPropertyOptional({ description: '标签分类ID' })
  categoryId?: string;

  @ApiPropertyOptional({ description: '标签图标' })
  icon?: string;

  @ApiPropertyOptional({ description: '标签描述' })
  description?: string;

  @ApiProperty({ description: '字段定义' })
  fieldDefinitions: any[];

  @ApiProperty({ description: '是否为系统标签' })
  isSystem: boolean;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;

  /** v2.1: 父标签 ID */
  @ApiPropertyOptional()
  parentId?: string | null;

  /** v2.1: 默认内容模版 */
  @ApiPropertyOptional()
  templateContent?: any;

  /** v2.1: 合并继承后的字段定义（含父标签字段） */
  @ApiPropertyOptional({ description: '合并继承后的字段定义' })
  resolvedFieldDefinitions?: any[];
}

// =============== ContextTag DTOs ===============

export class CreateContextTagDto {
  @ApiProperty({ description: '标签名称' })
  @IsString()
  name: string;

  @ApiProperty({ description: '标签颜色' })
  @IsString()
  color: string;

  @ApiPropertyOptional({ description: '标签描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '别名列表', default: [] })
  @IsArray()
  @IsOptional()
  aliases?: string[];

  @ApiPropertyOptional({ description: '父标签ID' })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ description: '状态', default: 'active' })
  @IsString()
  @IsOptional()
  status?: string;
}

export class UpdateContextTagDto {
  @ApiPropertyOptional({ description: '标签名称' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '标签颜色' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ description: '标签描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '别名列表' })
  @IsArray()
  @IsOptional()
  aliases?: string[];

  @ApiPropertyOptional({ description: '父标签ID' })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ description: '状态' })
  @IsString()
  @IsOptional()
  status?: string;
}

export class ContextTagResponseDto {
  @ApiProperty({ description: '标签ID' })
  id: string;

  @ApiProperty({ description: '标签名称' })
  name: string;

  @ApiProperty({ description: '标签颜色' })
  color: string;

  @ApiPropertyOptional({ description: '标签描述' })
  description?: string;

  @ApiProperty({ description: '别名列表' })
  aliases: string[];

  @ApiPropertyOptional({ description: '父标签ID' })
  parentId?: string;

  @ApiProperty({ description: '状态' })
  status: string;

  @ApiProperty({ description: '关联节点数量' })
  nodeCount: number;

  @ApiPropertyOptional({ description: '最后活跃时间' })
  lastActiveAt?: Date;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

// =============== Batch DTOs ===============

export class BatchCreateSupertagsDto {
  @ApiProperty({ description: '要创建的功能标签列表' })
  @IsArray()
  supertags: CreateSupertagDto[];
}

export class BatchCreateContextTagsDto {
  @ApiProperty({ description: '要创建的上下文标签列表' })
  @IsArray()
  contextTags: CreateContextTagDto[];
}
