import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  // Proxy la request al backend conservando cookies y headers
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const res = await fetch(`${backendUrl}/api/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Copia el header Authorization si existe (por si el frontend lo setea)
      ...(req.headers.get('authorization') ? { authorization: req.headers.get('authorization')! } : {}),
      // Copia cookies si existen
      ...(req.headers.get('cookie') ? { cookie: req.headers.get('cookie')! } : {}),
    },
    body: JSON.stringify(body),
    credentials: 'include',
  });

  // Copia el status y el body de la respuesta del backend
  const data = await res.text();
  const response = new NextResponse(data, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/json',
    },
  });
  // Copia cookies de la respuesta del backend si las hay
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    response.headers.set('set-cookie', setCookie);
  }
  return response;
}
