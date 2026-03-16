/**
 * Email Service using NotificationAPI SDK
 */
const notificationapi = require('notificationapi-node-server-sdk').default;

export async function sendWelcomeEmail(options: any) {
  const { email, password, role, company, phone } = options;
  const companyName = company || 'SRS Group';
  const loginUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://srs.group';

  if (!process.env.NOTIFICATIONAPI_CLIENT_ID || !process.env.NOTIFICATIONAPI_CLIENT_SECRET) {
    console.log('NotificationAPI credentials not configured, skipping email');
    return { success: true, message: 'Email skipped - credentials not configured' };
  }

  try {
    console.log('Sending email via NotificationAPI SDK...');

    notificationapi.init(
      process.env.NOTIFICATIONAPI_CLIENT_ID,
      process.env.NOTIFICATIONAPI_CLIENT_SECRET
    );

    const emailHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #F5F6FA; border-radius: 12px; overflow: hidden;">
        <div style="width: 100%; height: 8px; background: linear-gradient(to right, #1A245E, #C7322F);"></div>
        <div style="padding: 30px 20px; text-align: center;">
          <h1 style="color: #1A245E; font-size: 28px; margin: 0 0 5px 0;">${companyName}</h1>
          <p style="color: #666; font-size: 14px; margin: 0;">Account access details</p>
          <h2 style="color: #1A245E; font-size: 20px; margin: 20px 0 0 0;">Welcome to Your Account</h2>
        </div>
        <div style="padding: 30px 20px; background-color: white;">
          <p style="color: #333; font-size: 16px;"><strong>Hello,</strong></p>
          <p style="color: #333; font-size: 16px;">Your account has been created successfully. Please use the credentials below to access the system:</p>
          <div style="background: #F5F6FA; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #1A245E;">
            <p style="margin: 8px 0; color: #333;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 8px 0; color: #333;"><strong>Password:</strong> ${password}</p>
            <p style="margin: 8px 0; color: #333;"><strong>Role:</strong> ${role}</p>
            <p style="margin: 8px 0; color: #333;"><strong>Company:</strong> ${companyName}</p>
          </div>
          <div style="background: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #C7322F;">
            <p style="margin: 0; font-size: 14px; color: #856404;"><strong>Security Notice:</strong> Please change your password after your first login for security purposes.</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background: linear-gradient(135deg, #1A245E, #C7322F); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Access Login Site</a>
          </div>
        </div>
        <div style="background: linear-gradient(135deg, #1A245E 0%, rgba(26,36,94,0.7) 50%, rgba(199,50,47,0.7) 100%); padding: 20px; text-align: center;">
          <p style="font-size: 12px; color: white; margin: 0;">
            This is an automated message from ${companyName}.<br>
            &copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.
          </p>
        </div>
      </div>
    `;

    await notificationapi.send({
      type: 'welcome',
      to: {
        id: email,
        email: email
      },
      email: {
        subject: `Welcome to ${companyName} - Your Account Credentials`,
        html: emailHTML
      }
    });

    console.log('Email sent successfully via NotificationAPI SDK');

    let smsResult = { success: true, message: 'No phone number provided' };
    console.log('Phone number for SMS:', phone);
    if (phone) {
      smsResult = await sendWelcomeSMS({ phone, email, password, role, company });
      console.log('SMS Result:', smsResult);
    } else {
      console.log('No phone number provided, sending to test number');
      smsResult = await sendWelcomeSMS({ phone: '+27623661042', email, password, role, company });
    }

    return {
      success: true,
      messageId: 'sdk-sent',
      provider: 'notificationapi',
      smsResult
    };
  } catch (error: any) {
    console.error('NotificationAPI SDK failed:', error.message || error);
    return { success: false, error: error.message || 'SDK error' };
  }
}

function formatSAPhoneNumber(phone: string): string {
  if (!phone) return '+27623661042';

  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  if (cleaned.startsWith('0')) {
    return '+27' + cleaned.substring(1);
  }

  if (cleaned.startsWith('+27')) {
    return cleaned;
  }

  if (cleaned.startsWith('27')) {
    return '+' + cleaned;
  }

  return '+27' + cleaned;
}

export async function sendWelcomeSMS(options: any) {
  const { phone, email, password, role, company } = options;
  const companyName = company || 'SRS Group';
  const formattedPhone = formatSAPhoneNumber(phone);

  if (!process.env.NOTIFICATIONAPI_CLIENT_ID || !process.env.NOTIFICATIONAPI_CLIENT_SECRET) {
    console.log('NotificationAPI credentials not configured, skipping SMS');
    return { success: true, message: 'SMS skipped - credentials not configured' };
  }

  try {
    console.log('Sending SMS via NotificationAPI SDK...');

    notificationapi.init(
      process.env.NOTIFICATIONAPI_CLIENT_ID,
      process.env.NOTIFICATIONAPI_CLIENT_SECRET
    );

    await notificationapi.send({
      type: 'welcome_sms',
      to: {
        id: email,
        number: formattedPhone
      },
      sms: {
        message: `${companyName} - Login: ${email} Password: ${password} Role: ${role}`
      }
    });

    console.log(`SMS sent to: ${formattedPhone} (original: ${phone})`);
    console.log('SMS sent successfully via NotificationAPI SDK');
    return { success: true, messageId: 'sms-sent', provider: 'notificationapi' };
  } catch (error: any) {
    console.error('NotificationAPI SMS failed:', error.message || error);
    console.error('SMS Error Details:', error);
    return { success: false, error: error.message || 'SMS error' };
  }
}

export function generateTempPassword(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
