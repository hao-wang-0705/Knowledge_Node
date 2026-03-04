import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Headers,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto/user.dto';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';

@ApiTags('users')
@Controller('api/users')
@UseGuards(InternalAuthGuard)
@ApiHeader({ name: 'x-user-id', description: '用户ID（由网关注入）', required: true })
@ApiHeader({ name: 'x-internal-api-key', description: '内部网关密钥', required: true })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private assertAdminKey(adminKey: string) {
    const expected = process.env.ADMIN_API_KEY;
    if (!expected || adminKey !== expected) {
      throw new UnauthorizedException('Invalid admin key');
    }
  }

  @Post('internal')
  @ApiOperation({ summary: '创建用户（管理员接口）' })
  @ApiHeader({ name: 'x-admin-key', description: '管理员密钥', required: true })
  @ApiResponse({ status: 201, description: '用户创建成功', type: UserResponseDto })
  create(@Headers('x-admin-key') adminKey: string, @Body() createUserDto: CreateUserDto) {
    this.assertAdminKey(adminKey);
    return this.usersService.create(createUserDto);
  }

  @Get('internal')
  @ApiOperation({ summary: '获取所有用户（管理员接口）' })
  @ApiHeader({ name: 'x-admin-key', description: '管理员密钥', required: true })
  @ApiResponse({ status: 200, description: '返回所有用户列表', type: [UserResponseDto] })
  findAll(@Headers('x-admin-key') adminKey: string) {
    this.assertAdminKey(adminKey);
    return this.usersService.findAll();
  }

  @Post('internal/default')
  @ApiOperation({ summary: '获取或创建默认用户（管理员接口）' })
  @ApiHeader({ name: 'x-admin-key', description: '管理员密钥', required: true })
  @ApiResponse({ status: 200, description: '返回默认用户', type: UserResponseDto })
  getOrCreateDefault(@Headers('x-admin-key') adminKey: string) {
    this.assertAdminKey(adminKey);
    return this.usersService.getOrCreateDefaultUser();
  }

  @Get('me')
  @ApiOperation({ summary: '获取当前用户' })
  @ApiResponse({ status: 200, description: '返回指定用户', type: UserResponseDto })
  findMe(@CurrentUserId() userId: string) {
    return this.usersService.findOne(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: '更新当前用户信息' })
  @ApiResponse({ status: 200, description: '用户更新成功', type: UserResponseDto })
  updateMe(@CurrentUserId() userId: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(userId, updateUserDto);
  }

  @Delete('me')
  @ApiOperation({ summary: '删除当前用户' })
  @ApiResponse({ status: 200, description: '用户删除成功' })
  removeMe(@CurrentUserId() userId: string) {
    return this.usersService.remove(userId);
  }
}
