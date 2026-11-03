import { readPublicImage } from "~/server/services/media/public-image";

/**
 * Streams public panel images (avatars, product photos) stored in the private
 * Blob store. Pathnames are immutable (cuid per upload), so responses cache
 * for a year; anything outside `public/{avatar|product}/…` is a 404.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;
  const image = await readPublicImage(path.join("/"));

  if (!image) {
    return new Response(null, { status: 404 });
  }

  return new Response(Buffer.from(image.data), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
