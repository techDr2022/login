interface EmployeeCodeInput {
  id: string
  name: string
  joiningDate: Date | string | null
  createdAt: Date | string
}

function dateValue(input: Date | string | null, fallback = Number.MAX_SAFE_INTEGER): number {
  if (!input) return fallback
  const value = new Date(input).getTime()
  return Number.isNaN(value) ? fallback : value
}

export function buildEmployeeCodeMap(
  employees: EmployeeCodeInput[],
  startCode = 5
): Map<string, string> {
  const sorted = [...employees].sort((a, b) => {
    const joiningDiff = dateValue(a.joiningDate) - dateValue(b.joiningDate)
    if (joiningDiff !== 0) return joiningDiff

    const createdDiff = dateValue(a.createdAt, 0) - dateValue(b.createdAt, 0)
    if (createdDiff !== 0) return createdDiff

    return a.name.localeCompare(b.name)
  })

  return new Map(
    sorted.map((employee, index) => [
      employee.id,
      String(startCode + index).padStart(3, '0'),
    ])
  )
}
