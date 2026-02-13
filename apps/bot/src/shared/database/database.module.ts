import { Global, Module } from '@nestjs/common';
import { drizzleProvider } from './drizzle.provider.js';
import { checkpointerProvider } from './checkpointer.provider.js';

@Global()
@Module({
  providers: [drizzleProvider, checkpointerProvider],
  exports: [drizzleProvider, checkpointerProvider],
})
export class DatabaseModule {}
