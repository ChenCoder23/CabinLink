declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
    EMAIL_CODE_SECRET?: string;
  }
}
