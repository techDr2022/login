# Attendance Reminder Setup Guide

This guide explains how to set up automatic WhatsApp reminders for employees who haven't clocked in by 10:20 AM IST.

## Overview

The attendance reminder system automatically sends WhatsApp messages to employees who haven't clocked in by 10:20 AM IST every working day.

## Features

- ✅ Automatically checks all active employees at 10:20 AM IST
- ✅ Sends WhatsApp reminders to employees who haven't clocked in
- ✅ Skips public holidays
- ✅ Only sends to employees with phone numbers
- ✅ Includes error handling and logging

## Setup Instructions

### 1. Environment Variables

Add the following environment variable to your `.env` file (optional but recommended for security):

```env
CRON_SECRET=your-secret-key-here
```

This secret key is used to protect the cron endpoint from unauthorized access.

### 2. Vercel Cron Setup (Recommended)

If you're deploying on Vercel, the `vercel.json` file is already configured. The cron job is scheduled to run at:
- **Cron Schedule**: `20 4 * * *` (4:20 AM UTC = 10:20 AM IST)

**Note**: The cron schedule in `vercel.json` uses UTC time. Since IST is UTC+5:30, 10:20 AM IST = 4:50 AM UTC. However, the current schedule is set to `20 4 * * *` (4:20 AM UTC). You may need to adjust this to `50 4 * * *` for exact 10:20 AM IST timing.

To update the schedule:
1. Edit `vercel.json`
2. Change the schedule to `"50 4 * * *"` for 10:20 AM IST
3. Redeploy to Vercel

### 3. Manual Testing

You can manually test the endpoint by calling:

```bash
# Without secret (if CRON_SECRET is not set)
curl https://your-domain.com/api/cron/attendance-reminder

# With secret (if CRON_SECRET is set)
curl https://your-domain.com/api/cron/attendance-reminder?secret=your-secret-key-here
```

### 4. Other Cron Services

If you're not using Vercel, you can set up the cron job using other services:

#### Using a Cron Service (e.g., cron-job.org, EasyCron)

1. Create a new cron job
2. Set the schedule to run at 10:20 AM IST daily
3. Set the URL to: `https://your-domain.com/api/cron/attendance-reminder?secret=your-secret-key-here`
4. Set HTTP method to GET

#### Using a Server with Cron

If you have a server, you can add a cron job:

```bash
# Edit crontab
crontab -e

# Add this line (runs at 10:20 AM IST daily)
20 10 * * * curl -X GET "https://your-domain.com/api/cron/attendance-reminder?secret=your-secret-key-here"
```

## How It Works

1. **Time Check**: The endpoint checks if the current time is around 10:20 AM IST (allows 10-minute window: 10:15-10:25)
2. **Holiday Check**: Skips execution if today is a public holiday
3. **Employee Check**: Fetches all active employees with phone numbers
4. **Attendance Check**: Checks which employees haven't clocked in today
5. **Send Reminders**: Sends WhatsApp messages to employees who haven't clocked in

## Message Format

The reminder message sent to employees:

```
⏰ Attendance Reminder

Hi [Employee Name],

You haven't clocked in yet today ([Current Time]).

Please clock in as soon as possible to mark your attendance.

Thank you!
```

## Public Holidays

The system automatically skips reminders on public holidays. The current list includes:
- Sankranthi Festival
- Republic Day
- Holi Festival
- Ram Navami
- Ugadhi
- Ramadan
- Bakrid
- Ganesh Chaturthi
- Independence Day
- Dussehra
- Diwali
- Christmas Day

To update the holiday list, edit the `PUBLIC_HOLIDAYS` array in `/app/api/cron/attendance-reminder/route.ts`.

## Troubleshooting

### Reminders Not Sending

1. **Check WhatsApp Configuration**: Ensure `WHATSAPP_PROVIDER` is set correctly in your environment variables
2. **Check Phone Numbers**: Verify that employees have phone numbers in the database
3. **Check Logs**: Review server logs for error messages
4. **Test Manually**: Try calling the endpoint manually to see the response

### Timezone Issues

If reminders are sent at the wrong time:
1. Verify the cron schedule matches your timezone
2. The endpoint uses IST (Asia/Kolkata) timezone for time checks
3. Adjust the cron schedule in `vercel.json` or your cron service

### Security

- Always set `CRON_SECRET` in production
- Never expose the secret key in client-side code
- Use HTTPS for the cron endpoint URL

## Response Format

The endpoint returns a JSON response:

```json
{
  "success": true,
  "message": "Reminders sent to 5 employees",
  "employeesChecked": 20,
  "employeesNotClockedIn": 5,
  "remindersSent": 5,
  "errors": 0,
  "results": [
    {
      "employeeId": "user-id",
      "employeeName": "John Doe",
      "phoneNumber": "+911234567890",
      "success": true,
      "messageId": "twilio-message-id"
    }
  ],
  "errors": [] // Only present if there are errors
}
```

## Support

For issues or questions, check:
- Server logs for detailed error messages
- WhatsApp provider configuration
- Employee phone number format (should be in E.164 format: +911234567890)

