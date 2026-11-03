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
  .max(500)
  .describe(
    "Image (JPEG, PNG or WebP, max 5 MB): exact filename attached in this conversation, or the pathname returned by createFileUpload (MCP)",
  );

type UploadedImage =
  | { ok: true; pathname: string; url: string }
  /** Tool-ready failure envelope (missing attachment or upload error). */
  | { ok: false; failure: unknown };

/**
 * Resolves an image attachment by filename and stores it as a public panel
 * image through `media.uploadPublicImage` (role and size checks there).
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
        "Ask the user to attach the photo (JPEG, PNG or WebP).",
      ),
    };
  }

  const upload = await caller.media.uploadPublicImage({
    scope,
    contentType: attachment.mediaType,
    dataBase64: attachment.dataBase64,
  });

  return upload.result
    ? { ok: true, ...upload.result }
    : { ok: false, failure: upload };
}

/**
 * Images from attachments: owner avatar, business logo, product and service
 * photos. The bytes never reach the model; tools take the filename.
 */
export function createBusinessMediaTools(
  caller: AgentCaller,
  attachments: AgentAttachmentStore,
) {
  const withImage = (
    filename: string,
    scope: PublicImageScope,
    apply: (image: { pathname: string; url: string }) => Promise<unknown>,
  ) =>
    runTool(async () => {
      const upload = await uploadAttachmentImage(
        caller,
        attachments,
        filename,
        scope,
      );
      return upload.ok ? apply(upload) : upload.failure;
    });

  return {
    setProfilePhoto: tool({
      description:
        "Set the profile photo (avatar) of the business owner from an attached image.",
      inputSchema: z.object({ filename: imageFilename }),
      execute: ({ filename }) =>
        withImage(filename, "avatar", ({ pathname }) =>
          caller.profile.updateAvatar({ avatarPathname: pathname }),
        ),
    }),
    removeProfilePhoto: tool({
      description:
        "Remove the uploaded profile photo of the owner (initials or the Google picture are shown instead).",
      inputSchema: z.object({}),
      execute: () =>
        runTool(() => caller.profile.updateAvatar({ avatarPathname: null })),
    }),
    setBusinessLogo: tool({
      description:
        "Set the public logo of the business (marketplace profile) from an attached image.",
      inputSchema: z.object({ filename: imageFilename }),
      execute: ({ filename }) =>
        withImage(filename, "logo", ({ pathname }) =>
          caller.businessSettings.updateLogo({ logoPathname: pathname }),
        ),
    }),
    removeBusinessLogo: tool({
      description: "Remove the public logo of the business.",
      inputSchema: z.object({}),
      execute: () =>
        runTool(() =>
          caller.businessSettings.updateLogo({ logoPathname: null }),
        ),
    }),
    setProductImage: tool({
      description:
        "Set the public catalog photo of a product from an attached image. Product id from listProducts or createProduct.",
      inputSchema: z.object({
        productId: recordIdSchema,
        filename: imageFilename,
      }),
      execute: ({ productId, filename }) =>
        withImage(filename, "catalog", ({ url }) =>
          caller.product.update({ id: productId, imageUrl: url }),
        ),
    }),
    setServiceImage: tool({
      description:
        "Set the public catalog photo of a service from an attached image. Service id from listServices or createService.",
      inputSchema: z.object({
        serviceId: recordIdSchema,
        filename: imageFilename,
      }),
      execute: ({ serviceId, filename }) =>
        withImage(filename, "catalog", ({ url }) =>
          caller.service.update({ id: serviceId, imageUrl: url }),
        ),
    }),
  };
}
