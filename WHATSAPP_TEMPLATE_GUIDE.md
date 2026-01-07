# WhatsApp Message Template Guide

## Template Body Content for Twilio

When creating a WhatsApp Message Template in Twilio Console, use one of these template bodies:

### Option 1: Simple Template (Recommended)

**Template Body:**
```
📋 *New Task Assigned*

*Task:* {{1}}
*Assigned by:* {{2}}
*Priority:* {{3}}
{{4}}
{{5}}

Please check your dashboard for more details.
```

**Variables:**
- {{1}} = Task Title
- {{2}} = Assigned By Name
- {{3}} = Priority (with emoji)
- {{4}} = Due Date (optional, will be empty if not set)
- {{5}} = Client Name (optional, will be empty if not set)

**Template Settings:**
- **Category:** Utility
- **Language:** English (or your preferred language)
- **Name:** Task Assignment Notification

### Option 2: Detailed Template (With All Fields)

**Template Body:**
```
📋 *New Task Assigned*

*Task:* {{1}}
*Assigned by:* {{2}}
*Priority:* {{3}}
*Due Date:* {{4}}
*Client:* {{5}}

Please check your dashboard for more details.
```

**Variables:**
- {{1}} = Task Title
- {{2}} = Assigned By Name  
- {{3}} = Priority (with emoji)
- {{4}} = Due Date (formatted) or "Not set"
- {{5}} = Client Name or "Not assigned"

### Option 3: Minimal Template (No Optional Fields)

**Template Body:**
```
📋 *New Task Assigned*

*Task:* {{1}}
*Assigned by:* {{2}}
*Priority:* {{3}}

Please check your dashboard for more details.
```

**Variables:**
- {{1}} = Task Title
- {{2}} = Assigned By Name
- {{3}} = Priority (with emoji)

## How to Create the Template in Twilio

1. **Go to Twilio Console:**
   - Navigate to: https://console.twilio.com/us1/develop/sms/content-templates
   - Or: Messaging → Content Templates

2. **Click "Create new template"**

3. **Fill in the details:**
   - **Name:** Task Assignment Notification
   - **Language:** English (or your preferred)
   - **Category:** Utility (recommended) or Marketing
   - **Body:** Copy one of the template bodies above

4. **Add Variables:**
   - Twilio will automatically detect {{1}}, {{2}}, etc.
   - You can name them for reference:
     - Variable 1: Task Title
     - Variable 2: Assigned By
     - Variable 3: Priority
     - Variable 4: Due Date (optional)
     - Variable 5: Client Name (optional)

5. **Submit for Approval:**
   - Click "Submit for approval"
   - Twilio will review (usually takes a few hours to a day)
   - You'll receive an email when approved

6. **Get the Template SID:**
   - Once approved, click on the template
   - Copy the **Content SID** (starts with `HX...`)
   - This is what you'll use in `TWILIO_WHATSAPP_TEMPLATE_SID`

## Template Variable Mapping

The code will send variables in this order:

| Variable | Content | Example |
|----------|---------|---------|
| {{1}} | Task Title | "Create social media posts" |
| {{2}} | Assigned By Name | "John Doe" |
| {{3}} | Priority with Emoji | "🟡 Medium" or "🔴 Urgent" |
| {{4}} | Due Date (if set) | "15 Jan 2025, 10:00 AM" or empty |
| {{5}} | Client Name (if set) | "ABC Clinic" or empty |

## Important Notes

1. **Template Approval:** Templates must be approved by Twilio before use
2. **Variable Count:** Make sure your template has the right number of variables
3. **Optional Fields:** If due date or client is not set, the variable will be empty
4. **Emojis:** Emojis in templates are supported by WhatsApp
5. **Formatting:** Bold text using `*text*` works in WhatsApp

## Testing the Template

After approval:

1. Set in your `.env`:
   ```env
   TWILIO_WHATSAPP_TEMPLATE_SID="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   TWILIO_USE_TEMPLATE="true"
   ```

2. Restart your server

3. Assign a test task and check the logs

4. Verify the message arrives correctly formatted

## Attendance Notification Template (Optional)

If you want to use templates for attendance notifications (clock in/out), create a separate template:

**Template Body:**
```
{{1}} *Employee {{2}}*

*Employee:* {{1}}
*Time:* {{3}}
*Mode:* {{4}}
```

**Variables:**
- {{1}} = Employee Name
- {{2}} = Action (Clock In / Clock Out)
- {{3}} = Time (formatted)
- {{4}} = Mode (Office / Work From Home / Leave)

**Note:** Currently, attendance notifications use freeform messages. To use templates, you would need to:
1. Create a separate template for attendance
2. Set `TWILIO_WHATSAPP_ATTENDANCE_TEMPLATE_SID` (if you want to implement this)
3. The code already supports template variables, so it's ready if you want to add this feature

## Troubleshooting

**Template not found:**
- Verify the Template SID is correct
- Ensure template is approved (status: "Approved")
- Check you're using the Content SID, not Message SID

**Variables not filling:**
- Ensure variable count matches ({{1}} through {{5}})
- Check server logs for variable values being sent

**Template rejected:**
- Review Twilio's template guidelines
- Ensure content follows WhatsApp Business Policy
- Remove any prohibited content

