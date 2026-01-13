# WFH (Work From Home) Monitoring System

## Overview

The WFH monitoring system helps ensure employees are actively working when they clock in from home. It automatically tracks user activity, calculates productivity metrics, and alerts administrators about inactivity.

## Features

### 1. **Automatic Activity Tracking**
- **Mouse movements**: Tracks mouse activity (throttled to every 5 seconds)
- **Keyboard input**: Monitors keyboard presses
- **Page interactions**: Tracks clicks, scrolls, and touch events
- **Window focus**: Monitors when the browser window is active
- **Automatic pings**: Sends activity updates to the server every 60 minutes (configurable)

### 2. **Productivity Metrics**
- **Activity Score**: Calculated based on expected vs actual activity pings (0-100%)
- **Task Completion**: Tracks number of tasks completed during WFH hours
- **Time Spent on Tasks**: Sums up time logged on tasks
- **Task Updates**: Counts task-related activities

### 3. **Inactivity Detection**
- **Warning Threshold**: Alerts when no activity detected for 2+ hours (configurable)
- **Real-time Alerts**: Shows warnings to employees and administrators
- **Activity Pings**: Tracks how many times the system detected activity

### 4. **Admin Dashboard**
- **Real-time Monitoring**: View all active WFH employees
- **Activity Scores**: See productivity scores for each employee
- **Inactivity Alerts**: Filter and view employees with inactivity issues
- **Historical Data**: Review past WFH activity patterns

## How It Works

### For Employees

1. **Clock In with WFH Mode**
   - Select "Work From Home" when clocking in
   - Activity tracking automatically starts

2. **Automatic Tracking**
   - The system silently tracks your activity in the background
   - No manual intervention needed
   - Activity is recorded through normal work interactions

3. **Activity Monitor Panel**
   - View your real-time activity score
   - See number of activity pings
   - Check tasks completed and time spent
   - Receive warnings if inactive for extended periods

4. **Inactivity Warnings**
   - Yellow alert appears if inactive for 2+ hours
   - Warning shows minutes since last activity
   - Activity resumes automatically when you start working again

### For Administrators

1. **WFH Activity Monitor**
   - Access via Attendance page (Super Admin)
   - View all employees currently working from home
   - See activity scores, pings, and productivity metrics

2. **Filtering Options**
   - Filter by specific employee
   - Adjust inactivity threshold (default: 120 minutes)
   - View only employees with inactivity issues

3. **Key Metrics**
   - **Active WFH**: Count of employees currently working from home
   - **Inactive Alerts**: Employees with no activity for threshold period
   - **Average Activity Score**: Overall productivity metric
   - **Total Tracked**: Number of employees with WFH records

## Configuration

### Activity Tracking Settings

Located in `lib/attendance-config.ts`:

```typescript
WFH_ACTIVITY_PING_INTERVAL_MINUTES: 60  // Ping every 60 minutes
WFH_INACTIVITY_THRESHOLD_MINUTES: 120    // Flag if no activity for 2+ hours
WFH_MIN_HOURS_FOR_PRESENT: 8.5          // Minimum hours for WFH to be Present
```

### Adjusting Settings

1. **Ping Interval**: How often activity is recorded (default: 60 minutes)
   - Lower = more frequent tracking (more accurate but more server load)
   - Higher = less frequent tracking (less accurate but less server load)

2. **Inactivity Threshold**: When to show warnings (default: 120 minutes)
   - Lower = more sensitive (catches shorter breaks)
   - Higher = less sensitive (only flags long inactivity)

## Activity Score Calculation

The activity score is calculated as:

```
Activity Score = (Actual Pings / Expected Pings) × 100
```

Where:
- **Expected Pings** = Hours since login ÷ (Ping Interval in hours)
- **Actual Pings** = Number of activity pings received

**Score Interpretation:**
- **80-100%**: Excellent - Regular activity detected
- **50-79%**: Fair - Some activity but below expected
- **0-49%**: Poor - Minimal activity detected

## Best Practices

### For Employees

1. **Stay Active**: Regular mouse/keyboard activity is automatically tracked
2. **Work on Tasks**: Update and complete tasks to improve productivity metrics
3. **Take Breaks**: Short breaks are fine; extended inactivity (>2 hours) triggers warnings
4. **Check Activity Panel**: Monitor your activity score throughout the day

### For Administrators

1. **Regular Monitoring**: Check WFH activity dashboard daily
2. **Review Patterns**: Look for consistent low activity scores
3. **Follow Up**: Contact employees with repeated inactivity warnings
4. **Adjust Thresholds**: Customize inactivity threshold based on your needs

## Privacy & Ethics

- **Transparent**: Employees can see their own activity metrics
- **Non-intrusive**: Only tracks presence, not specific actions
- **Respectful**: Designed to ensure productivity, not micromanage
- **Configurable**: Thresholds can be adjusted to balance monitoring and trust

## Technical Details

### Files Created/Modified

1. **`lib/hooks/use-wfh-activity.ts`**
   - React hook for client-side activity tracking
   - Monitors DOM events and sends pings to server

2. **`app/api/attendance/wfh-activity/route.ts`**
   - API endpoint for fetching WFH activity metrics
   - Calculates productivity scores and inactivity warnings

3. **`components/attendance/employee-attendance-panel.tsx`**
   - Updated to show WFH activity monitor
   - Displays activity score, warnings, and metrics

4. **`components/attendance/wfh-activity-monitor.tsx`**
   - Admin dashboard component
   - Shows all WFH employees with activity metrics

5. **`components/attendance/super-admin-attendance-panel.tsx`**
   - Integrated WFH activity monitor section

### Database Fields Used

- `attendances.lastActivityTime`: Last recorded activity timestamp
- `attendances.wfhActivityPings`: Count of activity pings
- `attendances.mode`: Attendance mode (WFH, OFFICE, LEAVE)
- `attendances.totalHours`: Total hours worked (used for WFH validation)

## Troubleshooting

### Activity Not Being Tracked

1. **Check WFH Mode**: Ensure you clocked in with "Work From Home" mode
2. **Browser Active**: Make sure browser tab is active (not minimized)
3. **Network Issues**: Check internet connection for ping delivery
4. **Refresh Page**: Sometimes a page refresh helps restart tracking

### Low Activity Score

1. **Check Activity Pings**: Look at number of pings vs expected
2. **Review Tasks**: Ensure you're updating/completing tasks
3. **Stay Active**: Regular mouse/keyboard movement is needed
4. **Check Last Activity**: Verify last activity time is recent

### Admin Dashboard Not Showing Data

1. **Check Employee Selection**: Ensure correct employee is selected
2. **Verify WFH Mode**: Only shows employees in WFH mode
3. **Check Date Range**: Ensure viewing current day
4. **Refresh Data**: Click refresh or wait for auto-refresh (2 minutes)

## Future Enhancements

Potential improvements for the WFH monitoring system:

1. **Screenshot Monitoring**: Optional periodic screenshots (with consent)
2. **Application Tracking**: Track which applications/websites are used
3. **Productivity Reports**: Weekly/monthly productivity reports
4. **Team Comparisons**: Compare activity across teams
5. **Custom Alerts**: Configurable alert thresholds per employee
6. **Integration**: Connect with time tracking tools

## Support

For issues or questions:
1. Check this documentation
2. Review activity logs in the admin dashboard
3. Contact system administrator
4. Check browser console for errors

