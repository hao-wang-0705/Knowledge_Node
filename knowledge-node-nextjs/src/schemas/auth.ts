import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, '请输入邮箱').email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码'),
});

export const registerSchema = z
  .object({
    name: z.string().optional(),
    email: z.string().min(1, '请输入邮箱').email('请输入有效的邮箱地址'),
    password: z.string().min(6, '密码长度至少为6位'),
    confirmPassword: z.string().min(1, '请确认密码'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
