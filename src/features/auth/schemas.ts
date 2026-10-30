import { z } from 'zod';

export const operationalRoles = [
  'reception',
  'assistant',
  'doctor',
  'department_head',
  'coordinator',
  'follow_up_head',
] as const;

export const AccessRequestSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must not exceed 100 characters'),
  email: z
    .string()
    .trim()
    .email('Please provide a valid hospital email address')
    .toLowerCase(),
  phone: z
    .string()
    .trim()
    .min(10, 'Contact number must be at least 10 digits')
    .max(15, 'Contact number is too long')
    .regex(/^[+0-9\s-]+$/, 'Invalid phone number format'),
  employeeId: z
    .string()
    .trim()
    .max(50, 'Employee ID too long')
    .optional()
    .or(z.literal('')),
  requestedRole: z.enum(operationalRoles, {
    errorMap: () => ({ message: 'Please select a valid operational role' }),
  }),
  departmentId: z
    .string()
    .uuid('Please select a valid department')
    .optional()
    .or(z.literal('')),
  justification: z
    .string()
    .trim()
    .min(10, 'Please provide a justification of at least 10 characters')
    .max(500, 'Justification cannot exceed 500 characters'),
  agreementAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the hospital data privacy agreement' }),
  }),
});

export type AccessRequestInput = z.infer<typeof AccessRequestSchema>;

export const LoginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const SetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    confirmPassword: z.string().min(8, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type SetPasswordInput = z.infer<typeof SetPasswordSchema>;
