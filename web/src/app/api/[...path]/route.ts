import { NextRequest, NextResponse } from 'next/server';

// 运行时读取后端地址（支持运行时配置）
const BACKEND_BASE = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8521';

/**
 * 通用 API 代理 Route Handler
 *
 * 功能：
 * - 支持所有 HTTP 方法（GET/POST/PUT/DELETE/PATCH）
 * - 支持 JSON、FormData、文件上传/下载
 * - 自动转发 Cookie（HttpOnly Cookie 认证）
 * - 自动转发请求头
 * - 运行时读取后端地址配置
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'DELETE');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, 'PATCH');
}

/**
 * 代理请求到后端服务器
 */
async function proxyRequest(
  request: NextRequest,
  path: string[],
  method: string
): Promise<NextResponse> {
  try {
    // 构建后端 URL（保留查询参数）
    const backendUrl = `${BACKEND_BASE}/api/v1/${path.join('/')}${request.nextUrl.search}`;

    // 转发 Cookie（HttpOnly Cookie 认证）
    const cookies = request.cookies.getAll();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // 处理请求体
    let body: any = null;
    const contentType = request.headers.get('content-type');

    if (method !== 'GET' && method !== 'HEAD') {
      if (contentType?.includes('application/json')) {
        // JSON 请求
        try {
          body = JSON.stringify(await request.json());
        } catch (e) {
          // 空请求体
          body = null;
        }
      } else if (contentType?.includes('multipart/form-data')) {
        // 文件上传：直接转发 FormData
        body = await request.formData();
      } else if (contentType?.includes('application/x-www-form-urlencoded')) {
        // 表单数据
        body = await request.text();
      } else {
        // 其他类型（如二进制数据）
        try {
          body = await request.blob();
        } catch (e) {
          body = null;
        }
      }
    }

    // 构建请求头（排除 host 和 connection）
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey !== 'host' && lowerKey !== 'connection') {
        headers[key] = value;
      }
    });

    // 添加 Cookie 头
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    // 转发请求到后端
    const response = await fetch(backendUrl, {
      method,
      headers,
      body,
      // 不自动跟随重定向（让客户端处理）
      redirect: 'manual',
    });

    // 构建响应头
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      // 转发所有响应头（包括 Set-Cookie）
      responseHeaders.set(key, value);
    });

    // 返回响应
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    // 错误处理
    console.error('API Proxy Error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
