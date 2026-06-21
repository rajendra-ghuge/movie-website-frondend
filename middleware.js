/* global process */

import { next } from '@vercel/functions';

export default function middleware(request) {
  const username = process.env.BASIC_AUTH_USERNAME || 'admin';
  const password = process.env.BASIC_AUTH_PASSWORD;

  // Fail closed so a missing Vercel environment variable never exposes the site.
  if (!password) {
    return new Response('Server authentication is not configured.', {
      status: 500,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  const expectedAuthorization = `Basic ${btoa(`${username}:${password}`)}`;

  if (request.headers.get('authorization') !== expectedAuthorization) {
    return new Response('Authentication Required', {
      status: 401,
      headers: {
        'Cache-Control': 'no-store',
        'WWW-Authenticate': 'Basic realm="Secure Area", charset="UTF-8"',
      },
    });
  }

  return next();
}

export const config = {
  matcher: '/:path*',
};
