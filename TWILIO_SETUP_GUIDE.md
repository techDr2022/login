# Twilio WhatsApp Setup Guide

This guide will walk you through setting up Twilio WhatsApp notifications for task assignments.

## Step 1: Create a Twilio Account

1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Click **"Start Free Trial"** or **"Sign Up"**
3. Fill in your details:
   - Email address
   - Password
   - Phone number (for verification)
4. Verify your email and phone number
5. Complete the account setup

## Step 2: Get Your Account Credentials

1. After logging in, you'll be taken to the **Twilio Console Dashboard**
2. On the dashboard, you'll see:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click "View" to reveal it)
3. **Copy these values** - you'll need them later

   ⚠️ **Important**: Keep your Auth Token secret! Never commit it to version control.

## Step 3: Get a WhatsApp-Enabled Phone Number

### Option A: Twilio Sandbox (For Testing - Free)

1. In the Twilio Console, go to **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Or go to: [https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn)
3. You'll see a **Sandbox number** (format: `whatsapp:+14155238886`)
4. Follow the instructions to join the sandbox:
   - Send the join code to the sandbox number via WhatsApp
   - Example: Send `join <code>` to `+1 415 523 8886`
5. Once joined, you can send messages to any number that has joined the sandbox

**Note**: Sandbox is limited - only numbers that join the sandbox can receive messages.

### Option B: Production WhatsApp Number (For Real Use)

1. In Twilio Console, go to **Messaging** → **Senders** → **WhatsApp senders**
2. Click **"Request a WhatsApp sender"**
3. Fill out the form:
   - **Business Name**: Your company name
   - **Business Website**: Your website
   - **Business Description**: Brief description
   - **Use Case**: Select "Notifications" or "Customer Service"
   - **Expected Message Volume**: Estimate your monthly volume
4. Submit the request
5. Twilio will review your request (usually takes 1-3 business days)
6. Once approved, you'll receive a WhatsApp-enabled number

## Step 4: Configure Environment Variables

1. Open your `.env` file (or `.env.local`) in the project root
2. Add the following variables:

```env
# WhatsApp Configuration
WHATSAPP_PROVIDER="twilio"
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_auth_token_here"
TWILIO_WHATSAPP_FROM="+14155238886"
```

**Replace the values:**
- `TWILIO_ACCOUNT_SID`: Your Account SID from Step 2
- `TWILIO_AUTH_TOKEN`: Your Auth Token from Step 2
- `TWILIO_WHATSAPP_FROM`: 
  - For Sandbox: `+14155238886` (or your sandbox number)
  - For Production: Your approved WhatsApp number (without `whatsapp:` prefix)

**Example:**
```env
WHATSAPP_PROVIDER="twilio"
TWILIO_ACCOUNT_SID="ACa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
TWILIO_AUTH_TOKEN="abc123def456ghi789jkl012mno345pqr"
TWILIO_WHATSAPP_FROM="+14155238886"
```

## Step 5: Verify Twilio Package is Installed

The `twilio` package should already be in your `package.json`. If not, install it:

```bash
npm install twilio
```

## Step 6: Test the Setup

### Test 1: Verify Configuration

1. Restart your development server:
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```

2. Check the server logs - you should not see any Twilio-related errors

### Test 2: Send a Test Notification

1. Go to the **Employees** page
2. Edit an employee and add a phone number:
   - Format: `+91 9876543210` (with country code)
   - Or: `9876543210` (will auto-add +91 for Indian numbers)
3. Create a new task and assign it to that employee
4. The employee should receive a WhatsApp message

### Test 3: Check Server Logs

If notifications aren't sending, check your server console for error messages. Common issues:

- **"Twilio credentials not configured"**: Check your `.env` file
- **"Invalid phone number"**: Ensure phone numbers include country code
- **"Unauthorized"**: Verify Account SID and Auth Token are correct
- **"WhatsApp not enabled"**: Complete WhatsApp verification process

## Step 7: Troubleshooting

### Issue: "Twilio package not installed"
**Solution**: Run `npm install twilio`

### Issue: "Invalid phone number format"
**Solution**: 
- Phone numbers must include country code
- Format: `+91 9876543210` or `+1 2345678900`
- Indian numbers without country code will auto-add +91

### Issue: "Message not delivered"
**Solution**:
- For Sandbox: Ensure the recipient has joined the sandbox
- For Production: Ensure your WhatsApp number is approved
- Check Twilio Console → Monitor → Logs for delivery status

### Issue: "Rate limit exceeded"
**Solution**:
- Twilio has rate limits on free accounts
- Upgrade to a paid plan for higher limits
- Check your usage in Twilio Console

## Step 8: Monitor Usage

1. Go to Twilio Console → **Monitor** → **Logs** → **Messaging**
2. You can see:
   - All sent messages
   - Delivery status
   - Error messages
   - Costs

## Important Notes

### Sandbox Limitations
- Only numbers that join the sandbox can receive messages
- Limited to testing purposes
- Free to use

### Production Requirements
- Requires business verification
- May take 1-3 business days for approval
- Costs apply per message (check Twilio pricing)
- Can send to any WhatsApp number

### Phone Number Format
- Always include country code: `+91` for India, `+1` for US, etc.
- The system auto-normalizes phone numbers
- Format: `+[country code][number]` (e.g., `+919876543210`)

### Security
- ⚠️ Never commit `.env` file to version control
- ⚠️ Keep Auth Token secret
- ⚠️ Use environment variables in production (Vercel, Railway, etc.)

## Next Steps

Once setup is complete:
1. Add phone numbers to all employees
2. Test by creating and assigning tasks
3. Monitor delivery in Twilio Console
4. Consider upgrading to production WhatsApp number for real use

## Support

- Twilio Documentation: [https://www.twilio.com/docs/whatsapp](https://www.twilio.com/docs/whatsapp)
- Twilio Support: Available in Twilio Console
- Check server logs for detailed error messages


