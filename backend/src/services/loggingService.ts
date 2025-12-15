import { Request } from 'express';
import { ActionLog } from '../models';

interface LogData {
  user_id?: number;
  action: string;
  details?: any;
  req?: Request;
}

class LoggingService {
  /**
   * Log a user action
   */
  static async logAction(data: LogData): Promise<void> {
    try {
      const { user_id, action, details, req } = data;

      const logData: any = {
        user_id: user_id !== undefined ? user_id : null,
        action,
        details,
      };

      // Extract additional info from request if provided
      if (req) {
        logData.ip_address = this.getClientIP(req);
        logData.user_agent = req.get('User-Agent');
      }

      await ActionLog.create(logData);
    } catch (error) {
      console.error('Error logging action:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Log user login
   */
  static async logLogin(userId: number, req?: Request): Promise<void> {
    await this.logAction({
      user_id: userId,
      action: 'user_login',
      details: { success: true },
      req
    });
  }

  /**
   * Log failed login attempt
   */
  static async logFailedLogin(email: string, req?: Request): Promise<void> {
    await this.logAction({
      action: 'user_login_failed',
      details: { email, success: false },
      req
    });
  }

  /**
   * Log user registration
   */
  static async logRegistration(userId: number, req?: Request): Promise<void> {
    await this.logAction({
      user_id: userId,
      action: 'user_registration',
      details: { success: true },
      req
    });
  }

  /**
   * Log user logout
   */
  static async logLogout(userId: number, req?: Request): Promise<void> {
    await this.logAction({
      user_id: userId,
      action: 'user_logout',
      req
    });
  }

  /**
   * Log admin action
   */
  static async logAdminAction(userId: number, action: string, details: any, req?: Request): Promise<void> {
    await this.logAction({
      user_id: userId,
      action: `admin_${action}`,
      details,
      req
    });
  }

  /**
   * Get client IP address from request
   */
  private static getClientIP(req: Request): string {
    const forwarded = req.get('x-forwarded-for');
    const realIP = req.get('x-real-ip');

    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    if (realIP) {
      return realIP;
    }

    return req.ip || req.connection.remoteAddress || 'unknown';
  }
}

export default LoggingService;