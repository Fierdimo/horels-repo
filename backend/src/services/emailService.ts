import nodemailer from 'nodemailer';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private mailgunClient: any = null;
  private mailgunDomain: string | null = null;
  private emailProvider: 'nodemailer' | 'mailgun' | null = null;

  constructor() {
    this.initializeEmailService();
  }

  private initializeEmailService() {
    // Check if Mailgun is configured
    if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
      this.initializeMailgun();
    } 
    // Fallback to nodemailer (SMTP)
    else if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      this.initializeNodemailer();
    } 
    else {
      console.warn('⚠️ Email service not configured - missing credentials');
    }
  }

  private initializeMailgun() {
    try { 
      
      const mailgun = new Mailgun(FormData);
      this.mailgunClient = mailgun.client({
        username: 'api',
        key: process.env.MAILGUN_API_KEY as string, 
      });
      this.mailgunDomain = process.env.MAILGUN_DOMAIN as string;
      this.emailProvider = 'mailgun';
      console.log('📧 Email service initialized with Mailgun');
    } catch (error: any) {
      console.error('❌ Failed to initialize Mailgun:', error.message);
    }
  }

  private initializeNodemailer() {
    const emailConfig = {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    };

    this.transporter = nodemailer.createTransport(emailConfig);
    this.emailProvider = 'nodemailer';
    console.log('📧 Email service initialized with Nodemailer (SMTP)');
  }

  /**
   * Send an email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (this.emailProvider === 'mailgun') {
      return this.sendEmailWithMailgun(options);
    } else if (this.emailProvider === 'nodemailer') {
      return this.sendEmailWithNodemailer(options);
    } else {
      console.error('Email service not configured. Email not sent to:', options.to);
      return false;
    }
  }

  /**
   * Send email using Mailgun
   */
  private async sendEmailWithMailgun(options: EmailOptions): Promise<boolean> {
    if (!this.mailgunClient || !this.mailgunDomain) {
      console.error('Mailgun not configured');
      return false;
    }

    try {
      const messageData = {
        from: `${process.env.EMAIL_FROM_NAME || 'Timeshare Exchange'} <${process.env.EMAIL_FROM || `noreply@${this.mailgunDomain}`}>`,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html),
      };

      const result = await this.mailgunClient.messages.create(this.mailgunDomain, messageData);
      return true;
    } catch (error: any) {
      console.error('❌ Error sending email via Mailgun:', error.message);
      console.error('   Status:', error.status);
      console.error('   Details:', error.details || 'No additional details');
      return false;
    }
  }

  /**
   * Send email using Nodemailer (SMTP)
   */
  private async sendEmailWithNodemailer(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      console.error('Nodemailer not configured');
      return false;
    }

    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Timeshare Exchange'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html),
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully via Nodemailer:', info.messageId);
      return true;
    } catch (error: any) {
      console.error('❌ Error sending email via Nodemailer:', error.message);
      return false;
    }
  }

  /**
   * Send owner invitation email
   */
  async sendOwnerInvitation(
    email: string,
    firstName: string | undefined,
    lastName: string | undefined,
    invitationLink: string,
    propertyName: string,
    roomsCount: number
  ): Promise<boolean> {
    const recipientName = firstName && lastName 
      ? `${firstName} ${lastName}`
      : firstName || 'Estimado propietario';

    const subject = 'Invitación para registrarse como propietario';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 30px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          .info-box { background-color: white; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>¡Bienvenido a Timeshare Exchange!</h1>
          </div>
          <div class="content">
            <p>Hola ${recipientName},</p>
            
            <p>Has sido invitado por <strong>${propertyName}</strong> para unirte a nuestra plataforma de intercambio de tiempo compartido.</p>
            
            <div class="info-box">
              <h3>Detalles de tu invitación:</h3>
              <ul>
                <li><strong>Propiedad:</strong> ${propertyName}</li>
                <li><strong>Habitaciones asignadas:</strong> ${roomsCount}</li>
              </ul>
            </div>
            
            <p>Al aceptar esta invitación podrás:</p>
            <ul>
              <li>✓ Aceptar las habitaciones asignadas como reservas confirmadas</li>
              <li>✓ Convertir las habitaciones a créditos para usar en otras propiedades</li>
              <li>✓ Gestionar tus reservas y créditos desde tu cuenta</li>
            </ul>
            
            <center>
              <a href="${invitationLink}" class="button">Aceptar Invitación</a>
            </center>
            
            <p><small>O copia y pega este enlace en tu navegador:</small><br>
            <a href="${invitationLink}">${invitationLink}</a></p>
            
            <p><em>Esta invitación expirará en 30 días.</em></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Timeshare Exchange Platform</p>
            <p>Si no solicitaste esta invitación, puedes ignorar este correo.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
    });
  }

  /**
   * Basic HTML to plain text conversion
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    if (this.emailProvider === 'mailgun') {
      console.log('✅ Mailgun client initialized - no connection test needed');
      return true;
    } else if (this.emailProvider === 'nodemailer' && this.transporter) {
      try {
        await this.transporter.verify();
        console.log('✅ Email service connection verified');
        return true;
      } catch (error: any) {
        console.error('❌ Email service connection failed:', error.message);
        return false;
      }
    } else {
      console.error('Email service not configured');
      return false;
    }
  }
}

export default new EmailService();
