import { Injectable } from '@nestjs/common';
import { timer } from '@gitroom/helpers/utils/timer';

const LUMA_API = 'https://agents.lumalabs.ai/v1';
const LUMA = `${LUMA_API}/generations`;

export type LumaAspectRatio = '1:1' | '4:5' | '9:16' | '16:9';

export interface LumaGeneration {
  id: string;
  state: 'queued' | 'processing' | 'completed' | 'failed';
  failure_reason?: string | null;
  output: { type: string; url: string }[];
}

// Luma Agents API: uni-1 for images, ray-3.2 for videos. Reference pictures
// are passed as public URLs, which the media library already serves.
// Every call takes the API key: organizations connect their own in the
// integrations settings, LUMA_API_KEY is the server wide fallback.
@Injectable()
export class LumaService {
  // reads the balance, which spends nothing: false when the key is rejected
  async getCredits(apiKey: string): Promise<false | number> {
    const response = await fetch(`${LUMA_API}/credits`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      return false;
    }

    const { balance_credits } = await response.json();
    return balance_credits ?? 0;
  }

  private async request(apiKey: string, url: string, init?: RequestInit): Promise<LumaGeneration> {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(`luma ${response.status}: ${(await response.text()).slice(0, 500)}`);
    }

    return response.json();
  }

  getGeneration(apiKey: string, id: string) {
    return this.request(apiKey, `${LUMA}/${encodeURIComponent(id)}`);
  }

  async generateImage(
    apiKey: string,
    prompt: string,
    aspectRatio: LumaAspectRatio,
    references: string[]
  ) {
    let generation = await this.request(apiKey, LUMA, {
      method: 'POST',
      body: JSON.stringify({
        type: 'image',
        model: process.env.LUMA_IMAGE_MODEL || 'uni-1',
        prompt,
        aspect_ratio: aspectRatio,
        output_format: 'jpeg',
        ...(references.length
          ? { image_ref: references.slice(0, 9).map((url) => ({ url })) }
          : {}),
      }),
    });

    // images finish within a couple of minutes
    for (let i = 0; i < 60 && generation.state !== 'completed'; i++) {
      if (generation.state === 'failed') {
        throw new Error(generation.failure_reason || 'Luma image generation failed');
      }
      await timer(3000);
      generation = await this.getGeneration(apiKey, generation.id);
    }

    const url = generation.output?.find((p) => p.type === 'image')?.url;
    if (!url) {
      throw new Error('Luma image generation timed out');
    }

    const file = await fetch(url);
    return Buffer.from(await file.arrayBuffer()).toString('base64');
  }

  // videos take minutes: the caller polls getGeneration with the returned id
  startVideo(apiKey: string, params: {
    prompt: string;
    aspectRatio: LumaAspectRatio;
    duration: '5s' | '10s';
    resolution: '540p' | '720p' | '1080p';
    startFrame?: string;
  }) {
    return this.request(apiKey, LUMA, {
      method: 'POST',
      body: JSON.stringify({
        type: 'video',
        model: 'ray-3.2',
        prompt: params.prompt,
        aspect_ratio: params.aspectRatio,
        video: {
          duration: params.duration,
          resolution: params.resolution,
          ...(params.startFrame ? { start_frame: { url: params.startFrame } } : {}),
        },
      }),
    });
  }
}
