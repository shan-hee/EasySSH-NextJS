import { NextResponse } from 'next/server';

/**
 * 健康检查端点
 * 用于 Docker 容器健康检查和服务监控
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'easyssh-frontend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
}
