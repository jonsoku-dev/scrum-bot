import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { initTracing } from './shared/otel-setup';

async function bootstrap() {
  initTracing();

  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',').filter((o) => o.trim().length > 0) || ['http://localhost:5173', 'http://localhost:8000'],
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Scrum Bot API')
    .setDescription('The Scrum Bot API description')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = app.get(ConfigService).get('PORT') || 8000;
  await app.listen(port);
}
bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
