import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsBoolean, IsObject, IsNumber, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

// =============== TagTemplate DTOs (系统预置标签) ===============

/**
 * 创建系统预置标签 DTO（管理员专用）
 * v3.4: 移除 parentId 和 categoryId
 */
export class CreateTagTemplateDto {
  @ApiProperty({ description: '标签名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '标签颜色', default: '#6366F1' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ description: '标签图标' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: '标签描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '字段定义（JSON Schema）', default: [] })
  @IsArray()
  @IsOptional()
  fieldDefinitions?: any[];

  @ApiPropertyOptional({ description: '是否为全局默认标签', default: true })
  @IsBoolean()
  @IsOptional()
  isGlobalDefault?: boolean;

  @ApiPropertyOptional({ description: '标签状态', default: 'active' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: '默认内容模版（节点树 JSON）' })
  @IsObject()
  @IsOptional()
  templateContent?: any;

  @ApiPropertyOptional({ description: '创建者 ID（预留 UGC）' })
  @IsString()
  @IsOptional()
  creatorId?: string;

  @ApiPropertyOptional({ description: '排序顺序', default: 0 })
  @IsNumber()
  @IsOptional()
  order?: number;
}

/**
 * 更新系统预置标签 DTO（管理员专用）
 * v3.5: 新增，所有字段可选
 */
export class UpdateTagTemplateDto {
  @ApiPropertyOptional({ description: '标签名称' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '标签颜色' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ description: '标签图标' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: '标签描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '字段定义（JSON Schema）' })
  @IsArray()
  @IsOptional()
  fieldDefinitions?: any[];

  @ApiPropertyOptional({ description: '是否为全局默认标签' })
  @IsBoolean()
  @IsOptional()
  isGlobalDefault?: boolean;

  @ApiPropertyOptional({ description: '标签状态' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: '默认内容模版（节点树 JSON）' })
  @IsObject()
  @IsOptional()
  templateContent?: any;

  @ApiPropertyOptional({ description: '排序顺序' })
  @IsNumber()
  @IsOptional()
  order?: number;
}

/**
 * 批量导入标签 DTO（管理员专用）
 * v3.5: 新增，支持批量创建/更新预置标签
 */
export class BatchImportTagsDto {
  @ApiProperty({ description: '标签列表', type: [CreateTagTemplateDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateTagTemplateDto)
  tags: CreateTagTemplateDto[];

  @ApiPropertyOptional({ description: '是否覆盖同名标签（true: upsert，false: 跳过已存在）', default: false })
  @IsBoolean()
  @IsOptional()
  overwrite?: boolean;
}

/**
 * 批量导入结果 DTO
 */
export class BatchImportResultDto {
  @ApiProperty({ description: '成功创建数量' })
  created: number;

  @ApiProperty({ description: '成功更新数量' })
  updated: number;

  @ApiProperty({ description: '跳过数量（已存在且未开启覆盖）' })
  skipped: number;

  @ApiProperty({ description: '处理失败的标签名称及原因' })
  errors: Array<{ name: string; reason: string }>;
}

/**
 * 标签模版响应 DTO
 * v3.4: 移除 parentId, categoryId, resolvedFieldDefinitions
 */
export class TagTemplateResponseDto {
  @ApiProperty({ description: '标签ID' })
  id: string;

  @ApiProperty({ description: '标签名称' })
  name: string;

  @ApiProperty({ description: '标签颜色' })
  color: string;

  @ApiPropertyOptional({ description: '标签图标' })
  icon?: string;

  @ApiPropertyOptional({ description: '标签描述' })
  description?: string;

  @ApiProperty({ description: '字段定义' })
  fieldDefinitions: any[];

  @ApiProperty({ description: '是否为全局默认标签' })
  isGlobalDefault: boolean;

  @ApiProperty({ description: '标签状态' })
  status: string;

  @ApiPropertyOptional({ description: '创建者 ID' })
  creatorId?: string;

  @ApiProperty({ description: '排序顺序' })
  order: number;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: '默认内容模版' })
  templateContent?: any;

  @ApiProperty({ description: '是否为系统标签（兼容旧字段）' })
  isSystem?: boolean;
}

// =============== 搜索响应 DTO ===============

export class SearchTagsResponseDto {
  @ApiProperty({ description: '匹配的标签列表', type: [TagTemplateResponseDto] })
  supertags: TagTemplateResponseDto[];
}

// =============== 向后兼容别名 ===============

/** @deprecated 使用 TagTemplateResponseDto 代替 */
export type SupertagResponseDto = TagTemplateResponseDto;
