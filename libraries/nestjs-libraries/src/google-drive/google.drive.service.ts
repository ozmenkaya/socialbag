import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { Readable } from 'stream';
import { drive_v3, google } from 'googleapis';

const FOLDER = 'application/vnd.google-apps.folder';

export interface DriveEntry {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  modifiedTime: string;
  webViewLink: string;
}

// Reads the Drive folders customers share with one service account (as
// viewer): no OAuth consent, and only what was shared is visible. The JSON key
// of the account is at GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE.
@Injectable()
export class GoogleDriveService {
  private _drive?: drive_v3.Drive;
  private _auth?: InstanceType<typeof google.auth.JWT>;

  isEnabled() {
    return !!process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE;
  }

  private key(): { client_email?: string; private_key?: string } {
    try {
      return JSON.parse(readFileSync(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE!, 'utf8'));
    } catch (err) {
      return {};
    }
  }

  // the address customers share their folders with
  email(): string | undefined {
    return this.isEnabled() ? this.key().client_email : undefined;
  }

  private client() {
    if (!this._drive) {
      const key = this.key();
      this._auth = new google.auth.JWT({
        email: key.client_email,
        key: key.private_key,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });
      this._drive = google.drive({ version: 'v3', auth: this._auth });
    }

    return this._drive;
  }

  // undefined when the folder does not exist or is not shared with the account
  async getFolder(id: string) {
    try {
      const { data } = await this.client().files.get({
        fileId: id,
        fields: 'id,name,mimeType,trashed,sharingUser(emailAddress),owners(emailAddress)',
        supportsAllDrives: true,
      });
      return data.trashed
        ? undefined
        : {
            id: data.id,
            name: data.name,
            isFolder: data.mimeType === FOLDER,
            sharedBy: data.sharingUser?.emailAddress || data.owners?.[0]?.emailAddress || undefined,
          };
    } catch (err: any) {
      if (err?.code === 404 || err?.status === 404) {
        return undefined;
      }
      throw err;
    }
  }

  async listFolder(id: string): Promise<DriveEntry[]> {
    const entries: DriveEntry[] = [];
    let pageToken: string | undefined;
    do {
      const { data } = await this.client().files.list({
        q: `'${id}' in parents and trashed = false`,
        fields:
          'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,imageMediaMetadata(width,height),videoMediaMetadata(width,height,durationMillis))',
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      for (const file of data.files || []) {
        entries.push({
          id: file.id!,
          name: file.name || '',
          mimeType: file.mimeType || '',
          isFolder: file.mimeType === FOLDER,
          size: file.size ? Number(file.size) : undefined,
          width: file.imageMediaMetadata?.width || file.videoMediaMetadata?.width || undefined,
          height: file.imageMediaMetadata?.height || file.videoMediaMetadata?.height || undefined,
          durationMs: file.videoMediaMetadata?.durationMillis
            ? Number(file.videoMediaMetadata.durationMillis)
            : undefined,
          modifiedTime: file.modifiedTime || new Date().toISOString(),
          webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
        });
      }
      pageToken = data.nextPageToken || undefined;
    } while (pageToken);

    return entries;
  }

  // the preview Drive renders for pictures, videos and most documents
  async thumbnail(id: string, size: number): Promise<Buffer | undefined> {
    const { data } = await this.client().files.get({
      fileId: id,
      fields: 'thumbnailLink',
      supportsAllDrives: true,
    });
    if (!data.thumbnailLink) {
      return undefined;
    }

    // the account's token only ever goes to Google's own preview hosts
    const url = new URL(data.thumbnailLink.replace(/=s\d+$/, `=s${size}`));
    if (
      url.protocol !== 'https:' ||
      !(url.hostname.endsWith('.googleusercontent.com') || url.hostname === 'drive.google.com')
    ) {
      return undefined;
    }

    let response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) {
      // some previews only open with the account's token
      const { token } = await this._auth!.getAccessToken();
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30000),
      });
    }

    return response.ok ? Buffer.from(await response.arrayBuffer()) : undefined;
  }

  // The service account has no storage of its own, so it cannot create files
  // in a personal Drive: the designs are saved through an Apps Script web app
  // the owner of the folders deployed under their own account
  // (GOOGLE_DRIVE_BRIDGE_URL), the files belong to them
  canSave() {
    return !!process.env.GOOGLE_DRIVE_BRIDGE_URL && !!process.env.GOOGLE_DRIVE_BRIDGE_SECRET;
  }

  async saveFile(folderId: string, subfolder: string, name: string, fileUrl: string) {
    const response = await fetch(process.env.GOOGLE_DRIVE_BRIDGE_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.GOOGLE_DRIVE_BRIDGE_SECRET,
        folderId,
        subfolder,
        name,
        fileUrl,
      }),
      signal: AbortSignal.timeout(120000),
    });
    const data = await response.json().catch(() => ({ error: `The Drive bridge answered ${response.status}` }));
    if (data.error) {
      throw new Error(data.error);
    }
    return data as { id: string; url: string; folderUrl: string; existed: boolean };
  }

  async download(id: string): Promise<Readable> {
    const { data } = await this.client().files.get(
      { fileId: id, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );
    return data as unknown as Readable;
  }
}
