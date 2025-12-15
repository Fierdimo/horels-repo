import { User } from '../models';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      chargeAmountOriginal?: number;
      chargeAmountWithFee?: number;
      chargeExtraFee?: number;
    }
  }
}
