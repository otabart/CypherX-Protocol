declare module "next/server" {
    export interface NextResponse {
      json: (body: any, init?: { status?: number }) => Response;
    }
    export const NextResponse: {
      json: (body: any, init?: { status?: number }) => Response;
    };
  }