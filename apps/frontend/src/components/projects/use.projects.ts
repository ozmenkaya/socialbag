'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface ProjectItem {
  id: string;
  name: string;
  description: string;
  // what the template designs of the project are made with
  brand: {
    logoId?: string;
    logoPath?: string;
    primary?: string;
    accent?: string;
    font?: 'modern' | 'elegant';
    contact?: string;
    approvalPhone?: string;
  };
  integrations: {
    id: string;
    name: string;
    picture?: string;
    providerIdentifier: string;
  }[];
  folders: { id: string; name: string }[];
  sources: {
    id: string;
    type: string;
    externalId: string;
    url: string;
    name: string | null;
    status: 'pending' | 'syncing' | 'ready' | 'no_access' | 'error';
    error: string | null;
    fileCount: number;
    sharedBy: string | null;
    syncedAt: string | null;
  }[];
  // files found in the Drive folders, by kind
  files: Record<string, number>;
}

const isSyncing = (projects?: ProjectItem[]) =>
  !!projects?.some((p) => p.sources.some((s) => s.status === 'syncing'));

export const useProjects = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await fetch('/projects')).json();
  }, [fetch]);

  // follows the sync while a Drive folder is being listed
  return useSWR<ProjectItem[]>('projects', load, {
    refreshInterval: (data) => (isSyncing(data) ? 3000 : 0),
  });
};

export interface ProjectFileItem {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  kind: 'image' | 'video' | 'document' | 'other';
  size: number | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  webUrl: string;
  mediaId: string | null;
}

export interface ProjectFolderItem {
  name: string;
  // "Exterior / Drone"
  path: string;
  count: number;
}

// a page of the files of a folder ("" the root) of a project's Drive, with
// the folders under it; a search looks through every folder
export const useProjectFiles = (
  projectId: string,
  kind: string,
  search: string,
  folder: string,
  page: number
) => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), folder });
    if (kind) {
      params.set('kind', kind);
    }
    if (search) {
      params.set('search', search);
    }
    return (await fetch(`/projects/${projectId}/files?${params.toString()}`)).json();
  }, [fetch, projectId, kind, search, folder, page]);

  return useSWR<{
    total: number;
    pages: number;
    files: ProjectFileItem[];
    folders?: ProjectFolderItem[];
  }>(`project-files-${projectId}-${kind}-${search}-${folder}-${page}`, load);
};
