import { z } from 'zod';

export const customPromptSchema = z.object({
  customPrompt: z.string().min(1, '请输入自定义指令内容').trim(),
});

export type CustomPromptFormData = z.infer<typeof customPromptSchema>;
