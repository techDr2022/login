# WhatsApp Notifications for Task Assignments

This feature sends WhatsApp notifications to employees when they are assigned new tasks.

## Features

- ✅ Automatic WhatsApp notifications when tasks are assigned
- ✅ Notifications when task assignment changes
- ✅ Respects user notification preferences (`notifyTaskUpdates`)
- ✅ Supports multiple WhatsApp providers (Twilio, Webhook)
- ✅ Phone number normalization (E.164 format)
- ✅ Graceful error handling (task creation succeeds even if notification fails)

## Setup

### 1. Database Migration

First, run the database migration to add the `phoneNumber` field to the User model:

```bash
npm run db:push
```

### 2. Install Dependencies

If using Twilio, install the Twilio package:

```bash
npm install twilio
```

### 3. Configure Environment Variables

Add the following to your `.env` file:

#### Option 1: Twilio (Recommended)

```env
WHATSAPP_PROVIDER="twilio"
TWILIO_ACCOUNT_SID="your-account-sid"
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_WHATSAPP_FROM="+1234567890"
```

**Getting Twilio Credentials:**
1. Sign up at https://www.twilio.com
2. Get a WhatsApp-enabled number from Twilio
3. Complete WhatsApp Business verification
4. Get Account SID and Auth Token from Twilio Console

#### Option 2: Custom Webhook

```env
WHATSAPP_PROVIDER="webhook"
WHATSAPP_WEBHOOK_URL="https://your-webhook-endpoint.com/send-whatsapp"
```

#### Option 3: Disable (Default)

```env
WHATSAPP_PROVIDER="none"
# Or simply don't set WHATSAPP_PROVIDER
```

### 4. Add Phone Numbers to Employees

1. Go to Employees page (Super Admin only)
2. Click "Add Employee" or edit an existing employee
3. Enter the phone number in the "Phone Number (WhatsApp)" field
4. Format: `+91 9876543210` or `9876543210` (will be auto-normalized)

## How It Works

1. **Task Assignment**: When a task is created or updated with an `assignedToId`:
   - System checks if employee has a phone number
   - System checks if `notifyTaskUpdates` is enabled (default: true)
   - System checks if WhatsApp provider is configured
   - If all conditions are met, sends WhatsApp notification

2. **Message Format**:
   ```
   📋 New Task Assigned

   Task: [Task Title]
   Assigned by: [Assigned By Name]
   Priority: 🟡 Medium
   Due Date: 15 Jan 2025, 10:00 AM
   Client: [Client Name]

   Please check your dashboard for more details.
   ```

3. **Error Handling**:
   - If notification fails, task creation/update still succeeds
   - Errors are logged to console for debugging
   - No user-facing errors for notification failures

## Phone Number Format

- Phone numbers are automatically normalized to E.164 format
- Indian numbers without country code are assumed to be +91
- Accepts formats: `+91 9876543210`, `9876543210`, `+1-234-567-8900`, etc.

## User Preferences

Employees can control notifications via the `notifyTaskUpdates` field in their user profile (default: true). If disabled, they won't receive WhatsApp notifications even if they have a phone number.

## Troubleshooting

### Notifications Not Sending

1. **Check Configuration**:
   - Verify `WHATSAPP_PROVIDER` is set correctly
   - Check Twilio credentials (if using Twilio)
   - Verify webhook URL is accessible (if using webhook)

2. **Check Employee Profile**:
   - Ensure employee has phone number in profile
   - Verify `notifyTaskUpdates` is enabled
   - Check phone number format

3. **Check Server Logs**:
   - Look for error messages in console
   - Check for Twilio API errors
   - Verify webhook responses

### Twilio Errors

- **"Twilio package not installed"**: Run `npm install twilio`
- **"Invalid phone number"**: Check phone number format
- **"Unauthorized"**: Verify Account SID and Auth Token
- **"WhatsApp not enabled"**: Complete Twilio WhatsApp verification

### Testing

To test without sending actual messages:
1. Set `WHATSAPP_PROVIDER="none"` temporarily
2. Check console logs for notification attempts
3. Use Twilio sandbox for testing (if available)

## API Integration

The WhatsApp notification service is located in `lib/whatsapp.ts` and can be used independently:

```typescript
import { sendWhatsAppNotification, formatTaskAssignmentMessage } from '@/lib/whatsapp'

// Send a custom message
const result = await sendWhatsAppNotification('+1234567890', 'Hello!')

// Format a task assignment message
const message = formatTaskAssignmentMessage(
  'Task Title',
  'Assigned By Name',
  'High',
  new Date(),
  'Client Name'
)
```

## Future Enhancements

- [ ] Support for WhatsApp Business API (official)
- [ ] Message templates for different notification types
- [ ] Delivery status tracking
- [ ] Notification preferences UI
- [ ] Bulk notification support

