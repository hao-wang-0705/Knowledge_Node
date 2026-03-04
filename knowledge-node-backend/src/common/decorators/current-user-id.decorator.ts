import { createParamDecorator, ExecutionContext } from '@nestjs/common';

type RequestWithIdentity = {
  userId?: string;
};

export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<RequestWithIdentity>();
    return request.userId ?? '';
  },
);
