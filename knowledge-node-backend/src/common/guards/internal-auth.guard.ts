import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

type RequestWithIdentity = {
  headers: Record<string, string | string[] | undefined>;
  userId?: string;
};

@Injectable()
export class InternalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithIdentity>();
    const apiKey = request.headers['x-internal-api-key'];
    const userId = request.headers['x-user-id'];

    const expectedApiKey = process.env.INTERNAL_API_KEY;
    if (!expectedApiKey) {
      throw new UnauthorizedException('INTERNAL_API_KEY 未配置');
    }

    if (typeof apiKey !== 'string' || apiKey !== expectedApiKey) {
      throw new UnauthorizedException('Invalid internal api key');
    }

    if (typeof userId !== 'string' || !userId.trim()) {
      throw new UnauthorizedException('Missing authenticated user identity');
    }

    request.userId = userId;
    return true;
  }
}
