import { NextRequest, NextResponse } from "next/server"

/**
 * Lightweight image proxy for CORS (analytics HTML export + configurator thumbs).
 * Passthrough only — no sharp resize dependency.
 */
export async function GET(req: NextRequest) {
  const imageUrl = req.nextUrl.searchParams.get("url")
  if (!imageUrl) {
    return new NextResponse("Missing url parameter", { status: 400 })
  }

  try {
    const decodedUrl = decodeURIComponent(imageUrl)
    // Basic SSRF guard: only http(s)
    const target = new URL(decodedUrl)
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return new NextResponse("Invalid url protocol", { status: 400 })
    }

    const response = await fetch(decodedUrl, {
      method: "GET",
      cache: "force-cache",
      headers: { Accept: "image/*,*/*" },
    })

    if (!response.ok) {
      return new NextResponse(`Failed to fetch image: ${response.statusText}`, {
        status: response.status,
      })
    }

    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get("content-type") || "image/png"

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    console.error("Image proxy error:", error)
    return new NextResponse("Error proxying image", { status: 500 })
  }
}
