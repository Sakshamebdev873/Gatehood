import { z } from 'zod';

const id = z.string().trim().min(1).max(32);

export const NoticeTargetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('all') }),
  z.object({ type: z.literal('towers'), towers: z.array(id).min(1).max(50) }),
  z.object({ type: z.literal('units'), unitIds: z.array(id).min(1).max(1000) }),
]);

export const RedeemRequest = z.object({
  code: z.string().trim().min(1).max(32),
});
export type RedeemRequest = z.infer<typeof RedeemRequest>;

export const ImportRequest = z.object({
  csv: z.string().min(1).max(1_000_000),
});
export type ImportRequest = z.infer<typeof ImportRequest>;

export const CreateNoticeRequest = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(4000),
  target: NoticeTargetSchema,
  pinned: z.boolean(),
});
export type CreateNoticeRequest = z.infer<typeof CreateNoticeRequest>;

export const PinRequest = z.object({
  pinned: z.boolean(),
});
export type PinRequest = z.infer<typeof PinRequest>;
