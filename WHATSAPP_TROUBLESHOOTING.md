# WhatsApp Notification Troubleshooting Guide

## Quick Checklist

When tasks are assigned but WhatsApp notifications are not being sent, check the following:

### 1. Environment Variables Configuration

Check if WhatsApp provider is configured in your `.env` file:

```bash
# Check your environment variables
echo $WHATSAPP_PROVIDER
```

**Required for Twilio:**
```env
WHATSAPP_PROVIDER="twilio"
TWILIO_ACCOUNT_SID="your-account-sid"
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_WHATSAPP_FROM="+1234567890"  # Your Twilio WhatsApp number
```

**Required for Webhook:**
```env
WHATSAPP_PROVIDER="webhook"
WHATSAPP_WEBHOOK_URL="https://your-webhook-endpoint.com/send-whatsapp"
```

**If not set or set to "none":**
- WhatsApp notifications will be disabled
- You'll see a warning in the logs: `[WhatsApp] ⚠️ Notifications disabled`

### 2. Employee Profile Check

For each employee who should receive notifications:

1. **Phone Number**: Employee must have a phone number in their profile
   - Go to Employees page → Edit employee
   - Check "Phone Number" field is filled
   - Format: `+91 9876543210` or `9876543210` (will be auto-normalized)

2. **Notification Preference**: Employee must have task notifications enabled
   - Check `notifyTaskUpdates` field in database (default: `true`)
   - If disabled, employee won't receive notifications even with phone number

### 3. Server Logs

After assigning a task, check your server console/logs for WhatsApp-related messages:

**Success indicators:**
```
[WhatsApp] Task assigned to user: John Doe (user-id)
[WhatsApp] Phone number: +919876543210
[WhatsApp] Notify task updates: true
[WhatsApp] Provider configured: twilio
[WhatsApp] Attempting to send notification to +919876543210
[WhatsApp] ✅ Notification sent successfully. Message ID: SMxxxxx
```

**Common issues you'll see:**

1. **Provider not configured:**
```
[WhatsApp] ⚠️ Notifications disabled. Set WHATSAPP_PROVIDER environment variable to enable.
```

2. **Missing phone number:**
```
[WhatsApp] Skipping notification: User John Doe does not have a phone number
```

3. **Notifications disabled:**
```
[WhatsApp] Skipping notification: User John Doe has task notifications disabled
```

4. **Missing Twilio credentials:**
```
[WhatsApp] ❌ Twilio credentials not configured. Missing: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
```

5. **Twilio API error:**
```
[WhatsApp] ❌ Failed to send notification: [Twilio error message]
```

### 4. Testing Steps

1. **Assign a test task** to an employee
2. **Check server logs** immediately after assignment
3. **Look for `[WhatsApp]` log messages** - they will tell you exactly what's wrong

### 5. Common Issues and Solutions

#### Issue: "WhatsApp notifications are disabled"
**Solution:** Set `WHATSAPP_PROVIDER` environment variable to `"twilio"` or `"webhook"`

#### Issue: "User does not have a phone number"
**Solution:** 
1. Go to Employees page
2. Edit the employee
3. Add their phone number in the "Phone Number" field
4. Save

#### Issue: "User has task notifications disabled"
**Solution:** 
- Check the `notifyTaskUpdates` field in the database for that user
- Default is `true`, but it might have been disabled
- Update it to `true` in the database

#### Issue: "Twilio credentials not configured"
**Solution:**
1. Get your Twilio Account SID and Auth Token from Twilio Console
2. Get your Twilio WhatsApp number
3. Set all three environment variables:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_WHATSAPP_FROM`

#### Issue: "Twilio API error: Invalid phone number"
**Solution:**
- Ensure phone numbers are in correct format
- For Indian numbers, use `+91` prefix
- Phone numbers are auto-normalized, but ensure they're valid

#### Issue: "Twilio API error: Unauthorized"
**Solution:**
- Verify your Twilio Account SID and Auth Token are correct
- Check if your Twilio account is active
- Ensure you have sufficient Twilio credits

### 6. Database Check

To verify employee settings in the database:

```sql
-- Check employee phone numbers and notification settings
SELECT id, name, email, "phoneNumber", "notifyTaskUpdates" 
FROM "User" 
WHERE role = 'EMPLOYEE';
```

### 7. Manual Test

You can test the WhatsApp service directly by creating a simple test script:

```typescript
import { sendWhatsAppNotification } from '@/lib/whatsapp'

const result = await sendWhatsAppNotification(
  '+919876543210', // Replace with test phone number
  'Test message from system'
)

console.log('Result:', result)
```

### 8. Next Steps

1. **Check server logs** when assigning a task - the enhanced logging will show exactly what's happening
2. **Verify environment variables** are set correctly
3. **Check employee profiles** have phone numbers
4. **Test with a known working phone number** if using Twilio
5. **Check Twilio dashboard** for message delivery status (if using Twilio)

## WhatsApp Template Setup (Required for Production)

If you're getting the error: **"Failed to send freeform message because you are outside the allowed window"**

This means you need to set up a WhatsApp Message Template. Here's how:

### Step 1: Create a Template in Twilio

1. Go to [Twilio Console](https://console.twilio.com/) → **Messaging** → **Content Templates**
2. Click **"Create new template"**
3. Fill in the template details:
   - **Name:** Task Assignment Notification (or any name)
   - **Language:** English (or your preferred language)
   - **Category:** Utility (or Marketing if needed)
   - **Body:** Use this template structure:
     ```
     📋 *New Task Assigned*

     *Task:* {{1}}
     *Assigned by:* {{2}}
     *Priority:* {{3}}
     {{4}}
     {{5}}

     Please check your dashboard for more details.
     ```
   - **Variables:** The template will have placeholders for:
     - {{1}} = Task Title
     - {{2}} = Assigned By Name
     - {{3}} = Priority
     - {{4}} = Due Date (optional)
     - {{5}} = Client Name (optional)

4. **Submit for approval** (Twilio will review and approve)
5. Once approved, **copy the Template SID** (starts with `HX...`)

### Step 2: Configure Environment Variables

Add to your `.env` file:
```env
TWILIO_WHATSAPP_TEMPLATE_SID="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_USE_TEMPLATE="true"
```

### Step 3: Update Code (if needed)

The current code supports templates, but you may need to adjust the message formatting to match your template structure. The template variables should be passed in the correct order.

### Alternative: Use Twilio Sandbox (Testing Only)

For testing without templates:
1. Join the Twilio WhatsApp Sandbox
2. Send a message to your Twilio sandbox number
3. You'll have a 24-hour window to receive freeform messages
4. This is only for testing - not suitable for production

## Still Not Working?

If you've checked all the above and notifications still aren't sending:

1. **Share the server logs** - Look for `[WhatsApp]` messages and share them
2. **Verify Twilio account status** - Check Twilio console for account health
3. **Test phone number format** - Try with a different format
4. **Check network/firewall** - Ensure server can reach Twilio/webhook endpoint
5. **Verify template approval** - Ensure your template is approved in Twilio

