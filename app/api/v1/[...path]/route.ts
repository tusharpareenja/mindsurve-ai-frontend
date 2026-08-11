import { NextRequest, NextResponse } from "next/server"

/**
 * Long-lived proxy for FastAPI.
 * Next.js rewrites use a short default proxy timeout; AI turns with
 * attachments often exceed it (ECONNRESET → browser 500).
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

const backendOrigin = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(
  /\/+$/,
  ""
)

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
])

async function proxy(
  req: NextRequest,
  pathParts: string[]
): Promise<NextResponse> {
  const target = `${backendOrigin}/api/v1/${pathParts.join("/")}${req.nextUrl.search}`

  const headers = new Headers()
  req.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return
    headers.set(key, value)
  })

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer()
  }

  let upstream: Response
  try {
    upstream = await fetch(target, init)
  } catch (err) {
    console.error("Backend proxy failed:", target, err)
    return NextResponse.json(
      {
        detail:
          "Couldn't reach the MindSurve API. Make sure the backend is running on port 8000.",
      },
      { status: 502 }
    )
  }

  const outHeaders = new Headers()
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return
    outHeaders.set(key, value)
  })

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  })
}

type Ctx = { params: Promise<{ path: string[] }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params
  return proxy(req, path)
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params
  return proxy(req, path)
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params
  return proxy(req, path)
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params
  return proxy(req, path)
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params
  return proxy(req, path)
}

export async function OPTIONS(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params
  return proxy(req, path)
}
