import { type Provider } from '@nestjs/common';
import { MemorySaver } from '@langchain/langgraph';

export const CHECKPOINTER = Symbol('CHECKPOINTER');

export const checkpointerProvider: Provider = {
  provide: CHECKPOINTER,
  useFactory: () => {
    return new MemorySaver();
  },
};
