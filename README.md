# Internal Web App

A comprehensive internal web application built with Next.js 14, TypeScript, Prisma, PostgreSQL, and NextAuth.

## Features

- **Authentication & RBAC**: Role-based access control with Super Admin, Manager, and Employee roles
- **Client Management**: Full CRUD operations for clients with account managers
- **Project Management**: Track projects with status, dates, and client associations
- **Task Management**: Task workflow with approval/rejection, priorities, and status tracking
- **Attendance System**: Clock in/out functionality with late detection (9:30 AM IST)
- **Employee Management**: Admin-only employee list with performance metrics
- **Real-time Chat**: SSE-based chat system with multiple thread types (TEAM, DIRECT, TASK, PROJECT)
- **Activity Logging**: Automatic logging of CREATE/UPDATE/DELETE operations
- **Role-based Dashboards**: Customized dashboards for each user role

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth v4 (Credentials Provider)
- **UI**: shadcn/ui components with Tailwind CSS
- **Validation**: Zod
- **Password Hashing**: bcryptjs
- **Real-time**: Server-Sent Events (SSE)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- PostgreSQL database running
- npm or yarn package manager

### Installation

1. Clone the repository and navigate to the project directory:
```bash
cd "final task"
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/internal_app?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-change-in-production"
```

4. Set up the database:
```bash
npm run db:push
```

5. Seed the database:
```bash
npm run db:seed
```

6. Start the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Login Credentials

After seeding, you can login with:
- **Super Admin**: 
  - raviteja@techdr.in / password123
  - abhista@techdr.in / password123
- **Manager**: manager1@techdr.in / password123
- **Employee**: employee1@techdr.in / password123

All passwords are: `password123`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:push` - Push Prisma schema to database
- `npm run db:seed` - Seed database with sample data
- `npm run db:studio` - Open Prisma Studio

## Project Structure

```
├── app/                    # Next.js App Router pages and routes
│   ├── actions/           # Server actions
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard page
│   ├── clients/           # Client management pages
│   ├── projects/          # Project management pages
│   ├── tasks/             # Task management pages
│   ├── attendance/        # Attendance page
│   ├── employees/         # Employee management (admin only)
│   └── login/             # Login page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── clients/          # Client-related components
│   ├── projects/         # Project-related components
│   ├── tasks/            # Task-related components
│   ├── attendance/       # Attendance components
│   ├── employees/        # Employee components
│   └── dashboard/        # Dashboard components
├── lib/                   # Utility libraries
│   ├── auth.ts           # NextAuth configuration
│   ├── prisma.ts         # Prisma client
│   ├── rbac.ts           # RBAC utilities
│   ├── validations.ts    # Zod schemas
│   ├── activity-log.ts   # Activity logging
│   └── dashboard-queries.ts # Dashboard data queries
├── prisma/               # Prisma schema and migrations
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Database seed script
└── types/                # TypeScript type definitions
```

## RBAC Rules

### SUPER_ADMIN
- Full access to all features
- Can approve/reject tasks
- Access to employee management

### MANAGER
- Read employees
- CRUD operations on clients, projects, and tasks
- Can approve/reject tasks
- View team attendance

### EMPLOYEE
- Read-only access to clients, projects, and tasks (only own tasks)
- Clock in/out attendance
- Access to team chat

## Features Overview

### Attendance System
- Clock in/out functionality for employees
- Late detection at 9:30 AM IST
- Attendance history with filtering
- Absent tracking

### Task Workflow
- Status flow: Pending → InProgress → Review → Approved/Rejected
- Only Managers and Super Admins can approve/reject
- Rejection feedback required when rejecting tasks

### Chat System
- Real-time messaging via SSE
- Thread types: TEAM, DIRECT, TASK, PROJECT
- Unread message counts
- Desktop notifications

### Dashboards
- **Super Admin**: Overview of all system metrics, client workload, team attendance
- **Manager**: Team task management, pending approvals, missed deadlines
- **Employee**: Personal tasks, attendance status

## Database Schema

The application uses PostgreSQL with Prisma ORM. Key models include:
- User (with roles)
- Client
- Project
- Task
- Attendance
- ChatThread & ChatMessage
- ActivityLog

See `prisma/schema.prisma` for complete schema definition.

## Contributing

This is an internal application. Please follow the existing code style and ensure all tests pass before submitting changes.

## License

Internal use only.

