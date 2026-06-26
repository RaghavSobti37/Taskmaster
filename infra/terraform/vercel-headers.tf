# CoreKnot edge headers — COOP/COEP for OPFS, SW cache-control

variable "vercel_project" {
  type    = string
  default = "coreknot-client"
}

# ponytail: apply via Vercel project headers UI or API; this documents required values
output "required_headers" {
  value = {
    "Cross-Origin-Opener-Policy"  = "same-origin"
    "Cross-Origin-Embedder-Policy" = "credentialless"
    "Cache-Control-sw"             = "no-cache for /sw.js and /workbox-*.js"
  }
}
