import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppSwaggerModule } from './app.swagger.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppSwaggerModule, { logger: ['error', 'warn'] });
  
  const config = new DocumentBuilder()
    .setTitle('Scrum Bot API')
    .setDescription('The Scrum Bot API description')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(8000);
}
bootstrap();
