import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const createClientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  doctorOrHospitalName: z.string().min(1, 'Doctor or Hospital name is required'),
  location: z.string().min(1, 'Location is required'),
  services: z.array(z.string()).min(1, 'At least one service is required'),
  accountManagerId: z.string().optional(),
})

export const updateClientSchema = createClientSchema.partial()

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']),
  status: z.enum(['Pending', 'InProgress', 'Review', 'Approved', 'Rejected']).optional(),
  assignedToId: z.string().optional(),
  clientId: z.string().optional(),
  dueDate: z.date().optional(),
  timeSpent: z.number().optional(),
  rejectionFeedback: z.string().optional(),
})

export const updateTaskSchema = createTaskSchema.partial()

export const updateTaskStatusSchema = z.object({
  status: z.enum(['Pending', 'InProgress', 'Review', 'Approved', 'Rejected']),
  rejectionFeedback: z.string().optional(),
})

export const createAttendanceSchema = z.object({
  date: z.date().optional(),
})

export const createChatThreadSchema = z.object({
  type: z.enum(['TEAM', 'DIRECT']),
  targetUserId: z.string().optional(),
})

export const sendMessageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
})

export const markReadSchema = z.object({
  threadId: z.string().min(1, 'Thread ID is required'),
})

export const createEmployeeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().refine(
    (val) => !val || val.length >= 6,
    { message: 'Password must be at least 6 characters' }
  ).optional(),
})

// Client Onboarding Schemas
export const clientOnboardingBasicSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  type: z.enum(['CLINIC', 'HOSPITAL', 'DOCTOR']),
  primaryContactName: z.string().optional(),
  phonePrimary: z.string().optional(),
  phoneWhatsApp: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  addressLine: z.string().optional(),
  area: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  googleMapLink: z.string().url('Invalid URL').optional().or(z.literal('')),
  workingDays: z.array(z.number()).optional(),
  workingTimings: z.string().optional(),
  preferredLanguage: z.enum(['TELUGU', 'ENGLISH', 'BOTH']).optional(),
})

export const clientDoctorSchema = z.object({
  fullName: z.string().min(1, 'Doctor name is required'),
  qualification: z.string().optional(),
  specialization: z.string().optional(),
  experienceYears: z.number().int().positive().optional(),
  registrationNumber: z.string().optional(),
  languagesSpoken: z.array(z.string()).optional(),
  photoAssetId: z.string().optional(),
})

export const clientServiceSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  isPriority: z.boolean().default(false),
  priorityRank: z.number().int().positive().optional(),
})

export const clientUSPSchema = z.object({
  uspText: z.string().min(1, 'USP text is required'),
})

export const clientAccessSchema = z.object({
  type: z.enum(['GMB', 'WEBSITE', 'FACEBOOK', 'INSTAGRAM', 'WHATSAPP']),
  loginUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  username: z.string().optional(),
  password: z.string().optional(), // Will be encrypted
  notes: z.string().optional(),
})

export const clientBrandingSchema = z.object({
  brandColors: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
  }).optional(),
  designerName: z.string().optional(),
  templateBaseCreated: z.boolean().default(false),
})

export const clientTargetingSchema = z.object({
  primaryLocation: z.string().optional(),
  nearbyAreas: z.array(z.string()).optional(),
  mainKeywords: z.array(z.string()).optional(),
  exampleKeywords: z.array(z.string()).optional(),
})

export const clientCompetitorSchema = z.object({
  name: z.string().min(1, 'Competitor name is required'),
  googleMapLink: z.string().url('Invalid URL').optional().or(z.literal('')),
})

export const clientMarketingRequirementSchema = z.object({
  gmbOptimisation: z.boolean().default(false),
  websiteSeo: z.boolean().default(false),
  socialPostsPerWeek: z.number().int().min(0).default(0),
  socialPostsPerMonth: z.number().int().min(0).default(0),
  reelsPerMonth: z.number().int().min(0).default(0),
  googleAds: z.boolean().default(false),
  metaAds: z.boolean().default(false),
  reviewManagement: z.boolean().default(false),
  posters: z.boolean().default(false),
  videos: z.boolean().default(false),
  notes: z.string().optional(),
})

export const clientApprovalSettingsSchema = z.object({
  pointOfContactName: z.string().optional(),
  approvalTimeHours: z.number().int().positive().optional(),
  approvalMode: z.enum(['WHATSAPP', 'EMAIL', 'BOTH']).optional(),
  performanceTrackingMode: z.enum(['AUTO', 'MANUAL']).default('MANUAL'),
})

export const clientKpiMonthlySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
  gmbCalls: z.number().int().min(0).default(0),
  directionRequests: z.number().int().min(0).default(0),
  websiteClicks: z.number().int().min(0).default(0),
  leadsGenerated: z.number().int().min(0).default(0),
  reportStatus: z.enum(['PENDING', 'IN_PROGRESS', 'DONE']).default('PENDING'),
})

export const clientTaskSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
  title: z.string().min(1, 'Title is required'),
  status: z.enum(['Pending', 'InProgress', 'Review', 'Approved', 'Rejected']).default('Pending'),
  assignedToId: z.string().optional(),
  dueDate: z.date().optional(),
  checklist: z.array(z.object({
    text: z.string(),
    completed: z.boolean(),
  })).optional(),
})
