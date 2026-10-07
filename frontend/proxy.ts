import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Простой rate limiting по IP (в памяти)
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20; // Максимум 20 запросов
const RATE_WINDOW = 60000; // За 60 секунд

function getRateLimitKey(request: NextRequest): string {
  // Используем IP адрес или заголовок X-Forwarded-For
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 
              request.headers.get('x-real-ip') || 
              'unknown';
  return ip;
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);
  
  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false; // Превышен лимит
  }
  
  record.count++;
  return true;
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method;
  
  // Проверяем только POST запросы (Server Actions)
  if (method === 'POST') {
    const contentType = request.headers.get('content-type') || '';
    
    // Проверяем, является ли это запросом к Server Action
    if (contentType.includes('multipart/form-data') || 
        contentType.includes('application/x-www-form-urlencoded')) {
      
      // Проверяем rate limit
      const ip = getRateLimitKey(request);
      if (!checkRateLimit(ip)) {
        console.warn(`Rate limit exceeded for IP: ${ip}`);
        return new NextResponse('Too Many Requests', { status: 429 });
      }
      
      // Проверяем подозрительные Server Action имена
      const actionHeader = request.headers.get('next-action');
      const suspiciousActions = ['x', 'dontcare', 'cloudflare', 'test', 'admin', 'login'];
      
      if (actionHeader) {
        const actionLower = actionHeader.toLowerCase();
        if (suspiciousActions.some(action => actionLower.includes(action))) {
          // Блокируем подозрительные запросы без обработки
          console.warn(`Blocked suspicious Server Action: ${actionHeader} from IP: ${ip}`);
          return new NextResponse(null, { status: 404 });
        }
      }
      
      // Блокируем запросы к корню и несуществующим путям
      if (pathname === '/' || pathname.startsWith('/_next')) {
        // Проверяем User-Agent на известных ботов
        const userAgent = request.headers.get('user-agent') || '';
        const botPatterns = [
          /bot/i, /crawler/i, /spider/i, /scraper/i,
          /curl/i, /wget/i, /python/i, /java/i
        ];
        
        // Если это явно бот и запрос подозрительный - блокируем
        if (botPatterns.some(pattern => pattern.test(userAgent)) && !actionHeader) {
          console.warn(`Blocked bot request from: ${userAgent}`);
          return new NextResponse(null, { status: 403 });
        }
      }
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
