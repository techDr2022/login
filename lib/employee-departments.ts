export const EMPLOYEE_DEPARTMENTS = [
  'Marketing',
  'Video Editing',
  'Graphic Design',
  'Content Writing',
  'Website Development',
  'SEO',
] as const

export type EmployeeDepartment = (typeof EMPLOYEE_DEPARTMENTS)[number]

export function isEmployeeDepartment(value: unknown): value is EmployeeDepartment {
  return (
    typeof value === 'string' &&
    EMPLOYEE_DEPARTMENTS.includes(value as EmployeeDepartment)
  )
}
