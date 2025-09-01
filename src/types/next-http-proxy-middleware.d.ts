declare module 'next-http-proxy-middleware' {
  import { NextApiRequest, NextApiResponse } from 'next';

  interface ProxyOptions {
    target: string;
    pathRewrite?: {
      patternStr: string;
      replaceStr: string;
    }[];
    headers?: Record<string, string>;
    changeOrigin?: boolean;
    secure?: boolean;
    onProxyRes?: (proxyRes: any, req: NextApiRequest, res: NextApiResponse) => void;
    onProxyReq?: (proxyReq: any, req: NextApiRequest, res: NextApiResponse) => void;
    onError?: (err: Error, req: NextApiRequest, res: NextApiResponse) => void;
  }

  export default function httpProxyMiddleware(
    req: NextApiRequest,
    res: NextApiResponse,
    options: ProxyOptions
  ): Promise<unknown>;
}
