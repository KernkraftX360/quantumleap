"use client";

// Installed once at the root so the auth-aware fetch patch is in place before any
// component issues a request (module top-level runs before React effects).
import { installAuthFetch } from "@/lib/auth-fetch";

installAuthFetch();

export function AuthBridge() {
  return null;
}
