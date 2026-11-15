import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Lets `next dev` use the Cloudflare bindings (D1 database, secrets in .dev.vars) locally.
initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false, // the dev badge would sit on top of the dock
  // Security headers on every page and API answer:
  //   frame-ancestors / X-Frame-Options: no other site can show this one inside a frame (clickjacking)
  //   object-src, base-uri, form-action: no plugins, no rewriting where links point, forms only post here
  //   nosniff: files are only ever treated as what they say they are
  //   Referrer-Policy: other sites see only the site address, never a note's path
  //   Permissions-Policy: no camera, microphone or location
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
