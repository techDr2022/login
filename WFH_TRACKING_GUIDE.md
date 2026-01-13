# WFH (Work From Home) Tracking System - Implementation Guide

## Overview

Your system already has a **comprehensive WFH tracking system** implemented! This guide will help you understand how it works and how to use it for the upcoming work-from-home period.

## ✅ Current System Features

### 1. **Automatic Activity Tracking**
- **Mouse & Keyboard Activity**: Tracks all mouse movements, clicks, keyboard input
- **Page Interactions**: Monitors scrolls, touch events, and window focus
- **Automatic Pings**: Sends activity updates to server every 60 minutes (configurable)
- **Inactivity Detection**: Flags employees inactive for 2+ hours (configurable)

### 2. **Real-Time Monitoring Dashboard**
- **Employee View**: Shows activity score, pings, tasks completed, and time spent
- **Admin View**: Complete dashboard showing all WFH employees with metrics
- **Activity Scores**: Calculated based on expected vs actual activity (0-100%)
- **Inactivity Alerts**: Real-time warnings for employees with no activity

### 3. **Productivity Metrics**
- **Activity Score**: Percentage based on activity pings received
- **Task Completion**: Tracks tasks completed during WFH hours
- **Time Spent on Tasks**: Sums up time logged on tasks
- **Activity Pings**: Count of how many times activity was detected

## 🎯 How It Works

### For Employees (Automatic)

1. **Clock In with WFH Mode**
   - Select "Work From Home" when clocking in
   - System automatically starts tracking

2. **Automatic Activity Detection**
   - No manual action needed
   - System tracks mouse, keyboard, clicks automatically
   - Activity pings sent every 60 minutes while active

3. **View Your Activity**
   - Check the "WFH Activity Monitor" section on Attendance page
   - See your activity score, pings, and tasks completed
   - Get warnings if inactive for extended periods

### For Administrators

1. **Monitor All WFH Employees**
   - Go to Attendance page (Super Admin)
   - See "WFH Activity Monitoring" section
   - View all active WFH employees in real-time

2. **Key Metrics to Watch**
   - **Active WFH**: Number of employees currently working from home
   - **Inactive Alerts**: Employees with no activity for threshold period
   - **Average Activity Score**: Overall productivity metric
   - **Activity Pings**: Frequency of activity detection

3. **Filtering Options**
   - Filter by specific employee
   - Adjust inactivity threshold (default: 120 minutes)
   - View only employees with inactivity issues

## 📊 Activity Score Calculation

```
Activity Score = (Actual Pings / Expected Pings) × 100
```

**Where:**
- **Expected Pings** = Hours since login ÷ (Ping Interval in hours)
- **Actual Pings** = Number of activity pings received

**Score Interpretation:**
- **80-100%**: Excellent - Regular activity detected ✅
- **50-79%**: Fair - Some activity but below expected ⚠️
- **0-49%**: Poor - Minimal activity detected ❌

## ⚙️ Current Configuration

Located in `lib/attendance-config.ts`:

```typescript
WFH_ACTIVITY_PING_INTERVAL_MINUTES: 60  // Ping every 60 minutes
WFH_INACTIVITY_THRESHOLD_MINUTES: 120    // Flag if no activity for 2+ hours
WFH_MIN_HOURS_FOR_PRESENT: 8.5          // Minimum hours for WFH to be Present
```

## 🚀 Recommendations for WFH Period

### 1. **Adjust Activity Ping Frequency** (Optional)

For more accurate tracking during WFH, you may want to reduce the ping interval:

**Current**: 60 minutes (ping every hour)
**Recommended**: 30-45 minutes for better accuracy

To change:
- Edit `lib/attendance-config.ts`
- Set `WFH_ACTIVITY_PING_INTERVAL_MINUTES: 30`

### 2. **Adjust Inactivity Threshold** (Optional)

Consider lowering the threshold for quicker detection:

**Current**: 120 minutes (2 hours)
**Recommended**: 90 minutes for faster alerts

To change:
- Edit `lib/attendance-config.ts`
- Set `WFH_INACTIVITY_THRESHOLD_MINUTES: 90`

### 3. **Admin Notifications** (Recommended)

The system can notify admins when employees become inactive. This feature is already partially implemented but can be enhanced.

## 📋 Daily Workflow

### Morning Routine (Employees)
1. Log into the system
2. Go to Attendance page
3. Select "Work From Home" mode
4. Click "Clock In"
5. Start working - tracking happens automatically!

### During the Day (Employees)
- Work normally - activity is tracked automatically
- Check "WFH Activity Monitor" periodically to see your score
- Update tasks to improve productivity metrics
- Take breaks as needed (short breaks won't trigger alerts)

### Evening Routine (Employees)
1. Go to Attendance page
2. Click "Clock Out"
3. Review your activity summary

### Daily Check (Administrators)
1. Go to Attendance page
2. Check "WFH Activity Monitoring" section
3. Review activity scores and inactivity alerts
4. Follow up with employees showing low activity
5. Export reports if needed

## 🔍 Monitoring Best Practices

### For Employees
1. **Stay Active**: Regular mouse/keyboard activity is automatically tracked
2. **Work on Tasks**: Update and complete tasks to improve metrics
3. **Check Dashboard**: Monitor your activity score throughout the day
4. **Take Breaks**: Short breaks (under 2 hours) are fine
5. **Keep Browser Active**: Ensure the browser tab is active (not minimized)

### For Administrators
1. **Morning Review**: Check WFH activity at start of day
2. **Mid-Day Check**: Review activity scores around lunch time
3. **Afternoon Follow-up**: Address any inactivity warnings
4. **End of Day**: Review daily metrics and patterns
5. **Weekly Reports**: Analyze trends and productivity patterns

## ⚠️ Troubleshooting

### Employee Activity Not Being Tracked

**Problem**: Activity score not updating or showing 0%

**Solutions**:
1. ✅ Ensure you clocked in with "Work From Home" mode
2. ✅ Check that browser tab is active (not minimized)
3. ✅ Verify internet connection for ping delivery
4. ✅ Try refreshing the page to restart tracking
5. ✅ Check browser console for any errors

### Low Activity Score

**Problem**: Activity score is below 50%

**Solutions**:
1. ✅ Check number of activity pings vs expected
2. ✅ Ensure you're actively using mouse/keyboard
3. ✅ Update tasks to show productivity
4. ✅ Verify last activity time is recent
5. ✅ Contact admin if technical issues persist

### Admin Dashboard Not Showing Data

**Problem**: No WFH employees visible in dashboard

**Solutions**:
1. ✅ Verify employees have clocked in with WFH mode
2. ✅ Check date range (defaults to today)
3. ✅ Ensure viewing current day
4. ✅ Refresh data or wait for auto-refresh (2 minutes)
5. ✅ Check that employees haven't clocked out yet

## 🎨 Dashboard Features

### Employee Dashboard Shows:
- Activity Score (color-coded: green/yellow/red)
- Activity Pings count
- Tasks Completed
- Total Task Time
- Last Activity timestamp
- Inactivity warnings (if applicable)

### Admin Dashboard Shows:
- Active WFH count
- Inactive alerts count
- Average activity score
- Total tracked employees
- Detailed table with:
  - Employee name & email
  - Activity score & badge
  - Activity pings
  - Last activity time
  - Tasks completed
  - Task time spent
  - Status (Active/Inactive/Clocked Out)
  - Total hours

## 📈 Reporting Features

### Available Metrics:
- Daily activity scores
- Activity ping frequency
- Task completion rates
- Inactivity incidents
- Hours worked
- Productivity trends

### Export Options:
- Attendance logs (immutable audit trail)
- Payroll export (coming soon)
- Custom date ranges
- Employee-specific reports

## 🔒 Privacy & Ethics

The system is designed to:
- ✅ **Be Transparent**: Employees can see their own metrics
- ✅ **Non-Intrusive**: Only tracks presence, not specific actions
- ✅ **Respectful**: Ensures productivity without micromanaging
- ✅ **Configurable**: Thresholds can be adjusted based on trust levels

## 🚨 Alert System

### Employee Alerts:
- **Yellow Warning**: Appears if inactive for threshold period (default: 2 hours)
- **Auto-Resume**: Activity tracking resumes automatically when work resumes

### Admin Alerts:
- **Dashboard Badge**: Shows count of inactive employees
- **Activity Score Colors**: Green (good), Yellow (fair), Red (poor)
- **Filtered View**: Can filter to see only inactive employees

## 📝 Next Steps

1. **Review Configuration**: Check if ping interval and thresholds suit your needs
2. **Test System**: Have a few employees test WFH tracking before full rollout
3. **Communicate**: Inform employees about the tracking system and how it works
4. **Monitor**: Start monitoring on the first day of WFH period
5. **Adjust**: Fine-tune settings based on initial observations

## 🛠️ Technical Details

### Files Involved:
- `lib/hooks/use-wfh-activity.ts` - Client-side activity tracking
- `app/actions/attendance-actions.ts` - Server-side ping function
- `app/api/attendance/wfh-activity/route.ts` - API for metrics
- `components/attendance/wfh-activity-monitor.tsx` - Admin dashboard
- `components/attendance/employee-attendance-panel.tsx` - Employee view
- `lib/attendance-config.ts` - Configuration settings

### Database Fields:
- `attendances.lastActivityTime` - Last recorded activity
- `attendances.wfhActivityPings` - Count of activity pings
- `attendances.mode` - WFH/OFFICE/LEAVE
- `attendances.totalHours` - Total hours worked

## 💡 Tips for Success

1. **Communicate Transparently**: Let employees know how tracking works
2. **Set Expectations**: Explain what activity scores mean
3. **Be Flexible**: Allow for breaks and natural work patterns
4. **Review Regularly**: Check metrics daily, not constantly
5. **Provide Feedback**: Use data to help employees improve, not punish
6. **Trust Your Team**: Use tracking to ensure productivity, not micromanage

---

**Need Help?**
- Check the `WFH_MONITORING_GUIDE.md` for technical details
- Review `lib/attendance-config.ts` for configuration options
- Contact system administrator for issues

**Last Updated**: Ready for upcoming WFH period
