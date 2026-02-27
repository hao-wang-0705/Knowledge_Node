import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @ApiPropertyOptional({ description: '用户邮箱' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: '用户名称' })
  @IsString()
  @IsOptional()
  name?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ description: '用户邮箱' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: '用户名称' })
  @IsString()
  @IsOptional()
  name?: string;
}

export class UserResponseDto {
  @ApiProperty({ description: '用户ID' })
  id: string;

  @ApiPropertyOptional({ description: '用户邮箱' })
  email?: string;

  @ApiPropertyOptional({ description: '用户名称' })
  name?: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}
