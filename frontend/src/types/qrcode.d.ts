declare module 'qrcode.react' {
  import React from 'react';

  export interface QRCodeProps {
    value: string;
    size?: number;
    bgColor?: string;
    fgColor?: string;
    level?: 'L' | 'M' | 'Q' | 'H';
    includeMargin?: boolean;
    renderAs?: 'svg' | 'canvas';
    imageSettings?: {
      src: string;
      height: number;
      width: number;
      excavate: boolean;
    };
    style?: React.CSSProperties;
    [key: string]: any;
  }

  export const QRCodeCanvas: React.ComponentType<QRCodeProps>;
  export const QRCodeSVG: React.ComponentType<QRCodeProps>;
  
  const QRCode: React.ComponentType<QRCodeProps>;
  export default QRCode;
}
