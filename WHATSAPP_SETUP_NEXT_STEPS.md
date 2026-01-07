# WhatsApp Setup - Next Steps Guide

Great! You've completed:
- ✅ Added WhatsApp phone numbers to employees
- ✅ Installed Twilio package

## Next Steps to Complete WhatsApp Setup

### Step 1: Get Your Twilio Credentials

1. **Log into Twilio Console**: Go to https://console.twilio.com
2. **Get Account SID**:
   - On the dashboard, you'll see your **Account SID** (starts with `AC...`)
   - Copy this value
3. **Get Auth Token**:
   - Click "View" next to Auth Token to reveal it
   - Copy this value
   - ⚠️ **Keep this secret!** Never commit it to version control.

### Step 2: Get Your WhatsApp Number

You have two options:

#### Option A: Twilio Sandbox (Recommended for Testing - FREE)

1. Go to **Messaging** → **Try it out** → **Send a WhatsApp message**
   - Or visit: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
2. You'll see a **Sandbox number** (e.g., `+14155238886`)
3. **Join the sandbox**:
   - Send the join code (shown on the page) to the sandbox number via WhatsApp
   - Example: Send `join <code>` to `+1 415 523 8886`
4. **Note**: Only numbers that join the sandbox can receive messages (testing only)

#### Option B: Production WhatsApp Number (For Real Use)

1. Go to **Messaging** → **Senders** → **WhatsApp senders**
2. Click **"Request a WhatsApp sender"**
3. Fill out the form with your business details
4. Submit and wait for approval (usually 1-3 business days)
5. Once approved, you'll get a WhatsApp-enabled number

### Step 3: Configure Environment Variables

1. **Find your `.env` or `.env.local` file** in the project root
   - If it doesn't exist, create one
   - ⚠️ Make sure it's in `.gitignore` (don't commit it!)

2. **Add these variables**:

```env
# WhatsApp Configuration
WHATSAPP_PROVIDER="twilio"
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_auth_token_here"
TWILIO_WHATSAPP_FROM="+14155238886"
```

**Replace the values:**
- `TWILIO_ACCOUNT_SID`: Your Account SID from Step 1
- `TWILIO_AUTH_TOKEN`: Your Auth Token from Step 1
- `TWILIO_WHATSAPP_FROM`: 
  - For Sandbox: `+14155238886` (or your sandbox number, **without** `whatsapp:` prefix)
  - For Production: Your approved WhatsApp number (e.g., `+1234567890`)

**Example:**
```env
WHATSAPP_PROVIDER="twilio"
TWILIO_ACCOUNT_SID="ACa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
TWILIO_AUTH_TOKEN="abc123def456ghi789jkl012mno345pqr"
TWILIO_WHATSAPP_FROM="+14155238886"
```

### Step 4: Restart Your Development Server

1. Stop your server (Ctrl+C or Cmd+C)
2. Start it again:
   ```bash
   npm run dev
   ```
3. Check the console for any Twilio-related errors

### Step 5: Test the Setup

1. **For Sandbox Testing**:
   - Make sure the employee's phone number has joined the Twilio sandbox
   - Send `join <code>` to the sandbox number from that phone

2. **Create a Test Task**:
   - Go to your application
   - Navigate to Tasks page
   - Create a new task and assign it to an employee who has:
     - ✅ Phone number in their profile
     - ✅ Joined the sandbox (if using sandbox)
   - Click "Create Task"

3. **Check the Results**:
   - The employee should receive a WhatsApp message
   - Check your server console for any error messages
   - Check Twilio Console → **Monitor** → **Logs** → **Messaging** for delivery status

### Step 6: Verify Employee Phone Numbers

Make sure all employees have:
- ✅ Phone number in their user profile (format: `+91 9876543210` or `9876543210`)
- ✅ `notifyTaskUpdates` enabled (default: true)

To check/edit:
1. Go to **Employees** page (Super Admin only)
2. Click on an employee to edit
3. Verify **Phone Number (WhatsApp)** field is filled
4. Ensure notification preferences are enabled

## Troubleshooting

### "Twilio credentials not configured"
- Check your `.env` file has all three variables
- Make sure there are no typos
- Restart your server after adding variables

### "Invalid phone number"
- Phone numbers must include country code
- Format: `+91 9876543210` or `+1 2345678900`
- Indian numbers without country code will auto-add +91

### "Message not delivered" (Sandbox)
- Ensure the recipient has joined the sandbox
- Send `join <code>` to the sandbox number from the employee's phone
- Check the code in Twilio Console → WhatsApp sandbox page

### "Message not delivered" (Production)
- Ensure your WhatsApp number is approved
- Check Twilio Console → Monitor → Logs for errors
- Verify you have sufficient Twilio credits

### "Unauthorized" error
- Verify Account SID and Auth Token are correct
- Check for extra spaces or quotes in `.env` file
- Make sure you copied the full values

### Notifications not sending
1. Check server console for error messages
2. Verify employee has phone number in profile
3. Verify `WHATSAPP_PROVIDER="twilio"` is set
4. Check Twilio Console → Monitor → Logs for delivery status

## Monitor Usage

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

## Quick Checklist

- [ ] Got Twilio Account SID
- [ ] Got Twilio Auth Token
- [ ] Set up WhatsApp number (Sandbox or Production)
- [ ] Added environment variables to `.env` file
- [ ] Restarted development server
- [ ] Verified employee phone numbers are added
- [ ] Tested by creating a task
- [ ] Checked Twilio logs for delivery status

## Support Resources

- Twilio Documentation: https://www.twilio.com/docs/whatsapp
- Twilio Support: Available in Twilio Console
- Check server logs for detailed error messages
- Review `TWILIO_SETUP_GUIDE.md` for more detailed setup instructions

## Next Steps After Setup

Once everything is working:
1. ✅ Add phone numbers to all employees who need notifications
2. ✅ Test with multiple employees
3. ✅ Monitor delivery in Twilio Console
4. ✅ Consider upgrading to production WhatsApp number for real use
5. ✅ Update environment variables in production deployment

