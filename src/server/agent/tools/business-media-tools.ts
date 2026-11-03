import { tool } from "ai";
import { z } from "zod";

import { recordIdSchema } from "~/schemas/record-id.schema";
import type { PublicImageScope } from "~/server/services/media/public-image";
import type { AgentAttachmentStore } from "../agent-attachments";
import { runTool, type AgentCaller } from "../tool-runtime";
import { attachmentNotFound } from "./attachment-tools";

const imageFilename = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .describe(
    "Exact filename of the image (JPEG, PNG or WebP) attached in this conversation",
  );

type UploadedImage =
  | { ok: true; url: string }
  /** Tool-ready failure envelope (missing attachment or upload error). */
  | { ok: false; failure: unknown };

/**
 * Resolves a chat image attachment by filename and stores it as a public
 * panel image through `media.uploadPublicImage` (role and size checks there).
 */
async function uploadAttachmentImage(
  caller: AgentCaller,
  attachments: AgentAttachmentStore,
  filename: string,
  scope: PublicImageScope,
): Promise<UploadedImage> {
  const attachment = attachments.get(filename);

  if (!attachment) {
    return {
      ok: false,
      failure: attachmentNotFound(
        [filename],
        [...attachments.keys()],
        "Ask the user to attach the photo (JPEG, PNG or WebP) in this chat.",
      ),
    };
  }

  const upload = await caller.media.uploadPublicImage({
    scope,
    contentType: attachment.mediaType,
    dataBase64: attachment.dataBase64,
  });

  return upload.result
    ? { ok: true, url: upload.result.url }
    : { ok: false, failure: upload };
}

/**
 * Images from chat attachments: owner profile photo and product photos. The
 * bytes never reach the model; tools take the attachment filename.
 */
export function createBusinessMediaTools(
  caller: AgentCaller,
  attachments: AgentAttachmentStore,
) {
  return {
    setProfilePhoto: tool({
      description:
        "Set the profile photo (avatar) of the business owner from an image attached in this conversation. Find the filename with listChatAttachments.",
      inputSchema: z.object({ filename: imageFilename }),
      execute: ({ filename }) =>
        runTool(async () => {
          const upload = await uploadAttachmentImage(
            caller,
            attachments,
            filename,
            "avatar",
          );

          return upload.ok
            ? caller.profile.updateImage({ image: upload.url })
            : upload.failure;
        }),
    }),
    removeProfilePhoto: tool({
      description:
        "Remove the profile photo of the business owner (the initials are shown instead).",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.profile.updateImage({ image: null })),
    }),
    setProductImage: tool({
      description:
        "Set the public catalog photo of a product from an image attached in this conversation. Get the product id with listProducts (or from createProduct).",
      inputSchema: z.object({
        productId: recordIdSchema,
        filename: imageFilename,
      }),
      execute: ({ productId, filename }) =>
        runTool(async () => {
          const upload = await uploadAttachmentImage(
            caller,
            attachments,
            filename,
            "product",
          );

          return upload.ok
            ? caller.product.update({ id: productId, imageUrl: upload.url })
            : upload.failure;
        }),
    }),
  };
}
