import { NextResponse } from "next/server";
import { OutstandError } from "./outstand";

export function publishingError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Unable to complete the publishing request.";
  const status = error instanceof OutstandError ? error.status : 400;
  return NextResponse.json({ error: message }, { status });
}