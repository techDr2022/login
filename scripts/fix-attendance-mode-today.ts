/**
 * Script to fix attendance mode for today's records
 * Updates all attendance records with mode = OFFICE to mode = WFH for today
 * 
 * Usage:
 *   npx tsx scripts/fix-attendance-mode-today.ts
 */

import { PrismaClient, AttendanceMode, AttendanceStatus, UserRole } from '@prisma/client'
import { logActivity } from '../lib/activity-log'
import { ATTENDANCE_CONFIG } from '../lib/attendance-config'

const prisma = new PrismaClient()

async function fixAttendanceModeToday() {
  try {
    // Get today's date (start of day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    console.log(`\n🔍 Finding attendance records for today (${today.toISOString().split('T')[0]}) with mode = OFFICE...`)

    // Find all attendance records for today with mode = OFFICE
    const officeAttendances = await prisma.attendances.findMany({
      where: {
        date: today,
        mode: AttendanceMode.OFFICE,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    if (officeAttendances.length === 0) {
      console.log('✅ No attendance records found with mode = OFFICE for today. Nothing to update.')
      return
    }

    console.log(`\n📋 Found ${officeAttendances.length} attendance record(s) with mode = OFFICE:`)
    officeAttendances.forEach(att => {
      console.log(`   - ${att.User.name} (${att.User.email})`)
    })

    // Get first super admin for editedBy field
    const superAdmin = await prisma.user.findFirst({
      where: {
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    })

    if (!superAdmin) {
      console.error('❌ Error: No super admin found for editedBy field')
      return
    }

    console.log(`\n🔄 Updating ${officeAttendances.length} record(s) to WFH mode...`)

    const now = new Date()
    let successCount = 0
    let errorCount = 0

    // Update each attendance record
    for (const attendance of officeAttendances) {
      try {
        // For WFH mode:
        // - Set mode to WFH
        // - Clear earlySignInMinutes and lateSignInMinutes (WFH doesn't use these)
        // - Clear earlyLogoutMinutes and lateLogoutMinutes (WFH doesn't use these)
        // - Initialize lastActivityTime if loginTime exists and not clocked out
        // - Set wfhActivityPings appropriately
        // - Recalculate totalHours and status if already clocked out (add back lunch break)
        // - Set editedBy and editedAt to track the change

        const updateData: any = {
          mode: AttendanceMode.WFH,
          earlySignInMinutes: null,
          lateSignInMinutes: null,
          earlyLogoutMinutes: null,
          lateLogoutMinutes: null,
          editedBy: superAdmin.id,
          editedAt: now,
        }

        // Handle WFH tracking and status based on clock in/out state
        if (attendance.loginTime && !attendance.logoutTime) {
          // User is logged in but not logged out yet
          updateData.status = AttendanceStatus.Present // Will be recalculated on clock out
          updateData.lastActivityTime = now
          updateData.wfhActivityPings = 1
        } else if (attendance.loginTime && attendance.logoutTime && attendance.totalHours !== null) {
          // User has already clocked out - need to recalculate for WFH
          // Office mode subtracts lunch break (0.5 hours) if clocked out after lunch start time, WFH doesn't
          // Check if lunch break was likely subtracted (if logout time was after lunch start)
          const lunchStartTime = new Date(today)
          lunchStartTime.setHours(ATTENDANCE_CONFIG.LUNCH_START_HOUR, ATTENDANCE_CONFIG.LUNCH_START_MINUTE, 0, 0)
          
          let adjustedTotalHours = attendance.totalHours
          if (attendance.logoutTime >= lunchStartTime) {
            // Lunch break was subtracted for OFFICE mode, add it back for WFH
            adjustedTotalHours = attendance.totalHours + (ATTENDANCE_CONFIG.LUNCH_DURATION_MINUTES / 60)
          } else {
            // No lunch break was subtracted, keep totalHours as-is
            // But recalculate from login/logout times for accuracy
            adjustedTotalHours = (attendance.logoutTime.getTime() - attendance.loginTime.getTime()) / (1000 * 60 * 60)
          }
          
          updateData.totalHours = adjustedTotalHours
          
          // Recalculate status: WFH requires >= 8.5 hours to be Present
          updateData.status = adjustedTotalHours >= ATTENDANCE_CONFIG.WFH_MIN_HOURS_FOR_PRESENT 
            ? AttendanceStatus.Present 
            : AttendanceStatus.Absent
          
          updateData.lastActivityTime = null
          updateData.wfhActivityPings = 0
        } else {
          // No login time or incomplete record
          updateData.status = AttendanceStatus.Present
          updateData.lastActivityTime = null
          updateData.wfhActivityPings = 0
        }

        // Update the attendance record
        const updated = await prisma.attendances.update({
          where: { id: attendance.id },
          data: updateData,
        })

        // Log the activity
        await logActivity(superAdmin.id, 'UPDATE', 'Attendance', attendance.id)

        console.log(`   ✅ Updated: ${attendance.User.name}${attendance.logoutTime ? ' (already clocked out - recalculated totalHours and status)' : ''}`)
        successCount++

      } catch (error) {
        console.error(`   ❌ Error updating ${attendance.User.name}:`, error instanceof Error ? error.message : error)
        errorCount++
      }
    }

    console.log(`\n📊 Summary:`)
    console.log(`   ✅ Successfully updated: ${successCount}`)
    if (errorCount > 0) {
      console.log(`   ❌ Errors: ${errorCount}`)
    }
    console.log(`\n✨ Done! All attendance records for today have been updated from OFFICE to WFH mode.\n`)

  } catch (error) {
    console.error('\n❌ Error fixing attendance mode:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
fixAttendanceModeToday()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

