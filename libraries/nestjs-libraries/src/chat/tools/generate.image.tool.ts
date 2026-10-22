import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { MediaAutoPostService } from '@gitroom/nestjs-libraries/database/prisma/media/media.autopost.service';


@Injectable()
export class GenerateImageTool implements AgentToolInterface {
  private storage = UploadFactory.createStorage();

  constructor(
    private _mediaService: MediaService,
    private _subscriptionService: SubscriptionService,
    private _mediaAutoPostService: MediaAutoPostService
  ) {}
  name = 'generateImageTool';

  run() {
    return createTool({
      id: 'generateImageTool',
      description: `Generate image to use in a post,
                    in case the user specified a platform that requires attachment and attachment was not provided,
                    ask if they want to generate a picture of a video.
                    To design from the user's own photos, pass their media ids as referenceMediaIds (look at them with mediaViewTool first)
                    and folderId to save the result in a folder of the media library.
      `,
      mcp: {
        annotations: {
          title: 'Generate Image',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      inputSchema: z.object({
        prompt: z.string(),
        referenceMediaIds: z
          .array(z.string())
          .max(10)
          .optional()
          .describe('Media ids (mediaListTool) the design is based on'),
        size: z
          .enum(['square', 'portrait', 'story', 'landscape'])
          .optional()
          .describe('square 1:1, portrait 4:5 (feed posts), story 9:16 (stories, reels), landscape 16:9'),
        folderId: z
          .string()
          .optional()
          .describe('Folder id (mediaFoldersListTool) to save the result in'),
        quality: z
          .enum(['standard', 'max'])
          .optional()
          .describe(
            'Luma only: max is sharper with cleaner text on the picture and costs about 2.5 times standard, use it when the user asks for it'
          ),
      }),
      // Mastra validates the return against this schema, so it must also
      // allow the graceful { error } shape (same as uploadFromUrlTool)
      outputSchema: z.object({
        id: z.string().optional(),
        path: z.string().optional(),
        error: z.string().optional(),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const org = JSON.parse((context?.requestContext as any)?.get('organization') as string);
        try {
          // Same credit gate as the dashboard's /media/generate-image route -
          // only enforced when billing is enabled (cloud), self-hosted is free
          const total = await this._subscriptionService.checkCredits(org);
          if (process.env.STRIPE_PUBLISHABLE_KEY && total.credits <= 0) {
            return {
              error: 'No AI image credits are available on this account.',
            };
          }

          const image =
            inputData.referenceMediaIds?.length || inputData.size || inputData.quality
              ? await this._mediaService.generateDesign(
                  org,
                  inputData.prompt,
                  inputData.size || 'square',
                  inputData.referenceMediaIds || [],
                  inputData.quality
                )
              : await this._mediaService.generateImage(inputData.prompt, org);
          if (!image) {
            return { error: 'The image provider returned no image.' };
          }

          const file = await this.storage.uploadSimple(
            'data:image/png;base64,' + image
          );

          const saved = await this._mediaService.saveFile(
            org.id,
            file.split('/').pop(),
            file
          );
          if (inputData.folderId) {
            await this._mediaAutoPostService.moveMedia(org.id, {
              media: [saved.id],
              folderId: inputData.folderId,
            });
          }

          return saved;
        } catch (err) {
          return {
            error: `Image generation failed: ${
              err instanceof Error ? err.message : String(err)
            }. The user's image credit was not used.`,
          };
        }
      },
    });
  }
}
