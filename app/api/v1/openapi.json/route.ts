import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { isPublicApiEnabled, publicApiUnavailableResponse } from "@/lib/api-keys/feature-flag";

export async function GET() {
  if (!isPublicApiEnabled()) {
    return publicApiUnavailableResponse();
  }

  try {
    const specPath = path.join(process.cwd(), "docs", "api", "openapi.json");
    const specContent = fs.readFileSync(specPath, "utf-8");
    const json = JSON.parse(specContent);

    return NextResponse.json(json, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "OpenAPI specification unavailable", message: err.message },
      { status: 500 }
    );
  }
}
