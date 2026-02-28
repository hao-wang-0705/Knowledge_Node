import { z } from 'zod';

export const commandConfigSchema = z.object({
  activeTab: z.enum(['template', 'custom']),
  selectedTemplateId: z.string().optional(),
  customPrompt: z.string().optional(),
}).refine(
  (data) => {
    if (data.activeTab === 'template') return !!data.selectedTemplateId;
    if (data.activeTab === 'custom') return (data.customPrompt?.trim().length ?? 0) > 0;
    return false;
  },
  { message: '请选择模板或输入自定义指令内容', path: ['customPrompt'] }
);

export type CommandConfigFormData = z.infer<typeof commandConfigSchema>;
