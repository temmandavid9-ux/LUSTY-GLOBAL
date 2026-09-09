declare module 'next' {
  export namespace MetadataRoute {
    export type Sitemap = Array<{
      url: string;
      lastModified?: string | Date;
      changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
      priority?: number;
    }>;
  }
}

declare module 'next/server' {
  export class NextResponse {
    static json(data: any, init?: { status?: number; headers?: Record<string, string> }): Response;
  }
}
