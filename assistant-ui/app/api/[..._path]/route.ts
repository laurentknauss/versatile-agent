import { type NextRequest, NextResponse } from 'next/server';

// Next 16 : le runtime "edge" est déprécié. Le proxy ne fait que du fetch et du
// streaming de réponse, donc le runtime Node par défaut suffit largement.
export const runtime = 'nodejs';

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };
}

async function handleRequest(req: NextRequest, method: string) {
  try {
    const path = req.nextUrl.pathname.replace(/^\/?api\//, '');
    const url = new URL(req.url);
    const searchParams = new URLSearchParams(url.search);
    searchParams.delete('_path');
    searchParams.delete('nxtP_path');
    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';

    const options: RequestInit = {
      method,
      headers: {
        'x-api-key': process.env.LANGCHAIN_API_KEY || '',
      },
      signal: req.signal,
    };

    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      options.body = await req.text();
    }

    const res = await fetch(`${process.env.LANGGRAPH_API_URL}/${path}${queryString}`, options);

    const headers = new Headers(res.headers);
    headers.delete('content-encoding');
    headers.delete('content-length');
    headers.delete('transfer-encoding');
    const corsHeaders = getCorsHeaders();
    for (const [key, value] of Object.entries(corsHeaders)) {
      headers.set(key, value);
    }

    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  } catch (e: unknown) {
    // ⚠️ Un échec côté amont n'est pas une erreur interne : tout aplatir en 500
    // affichait « API error: 500 » dans le fil d'assistant-ui (vécu le 2026-09-24)
    // alors que la cause était un `langgraph dev` redémarré en plein run — une
    // édition dans src/ suffit à le relancer. On distingue donc les trois cas.
    if (req.signal.aborted || (e instanceof Error && e.name === 'AbortError')) {
      // Le client a annulé (rechargement, HMR, bouton « stop ») : personne ne lit
      // cette réponse, et 499 évite de la présenter comme une panne serveur.
      return new NextResponse(null, { status: 499, headers: getCorsHeaders() });
    }

    if (e instanceof TypeError) {
      // `fetch` rejette en TypeError quand l'amont est injoignable ou refusé.
      return NextResponse.json(
        { error: `LangGraph injoignable sur ${process.env.LANGGRAPH_API_URL} : ${e.message}` },
        { status: 502, headers: getCorsHeaders() }
      );
    }

    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500, headers: getCorsHeaders() });
  }
}

export const GET = (req: NextRequest) => handleRequest(req, 'GET');
export const POST = (req: NextRequest) => handleRequest(req, 'POST');
export const PUT = (req: NextRequest) => handleRequest(req, 'PUT');
export const PATCH = (req: NextRequest) => handleRequest(req, 'PATCH');
export const DELETE = (req: NextRequest) => handleRequest(req, 'DELETE');
export const OPTIONS = () =>
  new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
