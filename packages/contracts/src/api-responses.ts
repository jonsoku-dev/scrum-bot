import { z, type ZodTypeAny } from "zod";

export function createApiResponseSchema<T extends ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.boolean(),
    data: dataSchema,
  });
}

export function createApiListResponseSchema<T extends ZodTypeAny>(
  itemSchema: T,
) {
  return z.object({
    success: z.boolean(),
    data: z.array(itemSchema),
    meta: z.object({
      total: z.number(),
    }),
  });
}

export type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export type ApiListResponse<T> = {
  success: boolean;
  data: T[];
  meta: {
    total: number;
  };
};
