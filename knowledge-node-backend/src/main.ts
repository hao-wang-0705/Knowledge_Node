import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { randomUUID } from 'crypto';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use((req: any, res: any, next: () => void) => {
    const requestId = req.headers['x-request-id'] || randomUUID();
    const traceId = req.headers['x-trace-id'] || requestId;
    const opId = req.headers['x-op-id'] || null;
    const userId = req.headers['x-user-id'] || null;
    const startedAt = Date.now();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    res.on('finish', () => {
      const payload = {
        level: 'info',
        message: 'http_request',
        requestId,
        traceId,
        opId,
        userId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      };
      console.log(JSON.stringify(payload));
    });
    next();
  });

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // CORS 配置
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  // Swagger API 文档
  const config = new DocumentBuilder()
    .setTitle('Knowledge Node API')
    .setDescription('Knowledge Node 后端 API 文档')
    .setVersion('1.0')
    .addTag('nodes', '节点管理')
    .addTag('notebooks', '笔记本管理')
    .addTag('supertags', '功能标签管理')
    .addTag('context-tags', '上下文标签管理')
    .addTag('users', '用户管理')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 Knowledge Node Backend is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
