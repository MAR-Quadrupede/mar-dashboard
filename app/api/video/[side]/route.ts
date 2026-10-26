import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { side: string } }
) {
  const isRight = params.side === "right";
  const isSnapshot = req.nextUrl.searchParams.get("snapshot") === "1";
  const side = isRight ? "right" : "left";
  const path = isSnapshot ? `snapshot_${side}.jpg` : `stream_${side}.mjpg`;

  // Connect to vision-service via Kubernetes internal DNS, fallback to localhost:30080
  const targets = [
    `http://mar-vision-service.mar-system.svc.cluster.local:8443/${path}`,
    `http://127.0.0.1:30080/${path}`,
    `http://localhost:8443/${path}`
  ];

  for (const url of targets) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          Accept: isSnapshot ? "image/jpeg, */*" : "multipart/x-mixed-replace, image/jpeg, */*"
        }
      });

      if (res.ok && res.body) {
        return new Response(res.body, {
          headers: {
            "Content-Type": isSnapshot ? "image/jpeg" : "multipart/x-mixed-replace; boundary=frame",
            "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Access-Control-Allow-Origin": "*",
            "Connection": isSnapshot ? "close" : "keep-alive"
          }
        });
      }
    } catch {
      // try next target
    }
  }

  return new Response("Vision stream unavailable", { status: 503 });
}
