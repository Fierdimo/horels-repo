declare module 'qrcode.react' {
  import React from 'react';

  interface QRCodeProps {
    value: string;
    size?: number;
    bgColor?: string;
    fgColor?: string;
    level?: 'L' | 'M' | 'Q' | 'H';
    includeMargin?: boolean;
    renderAs?: 'svg' | 'canvas' | 'img';
    className?: string;
    [key: string]: any;
  }

  const QRCode: React.ComponentType<QRCodeProps>;
  export default QRCode;
}
