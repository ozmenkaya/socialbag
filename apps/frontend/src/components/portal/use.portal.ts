'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface PortalChannel {
  name: string;
  picture: string | null;
  platform: string;
}

export interface PortalProject {
  id: string;
  name: string;
  description: string;
  logo: string | null;
  primary: string | null;
  channels: (PortalChannel & { id: string })[];
}

export interface PortalMe {
  name: string;
  username: string;
  agency: string;
  projects: PortalProject[];
}

export interface PortalPost {
  id: string;
  publishDate: string;
  state: 'scheduled' | 'published';
  url: string | null;
  content: string;
  images: string[];
  projectIds: string[];
  channel: PortalChannel;
}

export interface PortalApproval {
  id: string;
  projectId: string;
  createdAt: string;
  status: 'pending' | 'outdated' | 'approved' | 'revision';
  note: string | null;
  respondedAt: string | null;
  project: { name: string; logo: string | null; primary: string | null } | null;
  posts: {
    id: string;
    publishDate: string;
    channel: PortalChannel;
    values: { content: string; images: string[] }[];
  }[];
}

// null while nobody is signed in to the portal
export const usePortalMe = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    const response = await fetch('/portal/me');
    return response.ok ? ((await response.json()) as PortalMe) : null;
  }, [fetch]);

  return useSWR('portal-me', load, { revalidateOnFocus: false });
};

// the posts planned or published between two dates
export const usePortalPosts = (startDate: string, endDate: string, projectId?: string) => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    const params = new URLSearchParams({ startDate, endDate });
    if (projectId) {
      params.set('projectId', projectId);
    }
    const response = await fetch(`/portal/posts?${params.toString()}`);
    return response.ok ? ((await response.json()) as PortalPost[]) : [];
  }, [fetch, startDate, endDate, projectId]);

  return useSWR(`portal-posts-${startDate}-${endDate}-${projectId || ''}`, load);
};

export const usePortalApprovals = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    const response = await fetch('/portal/approvals');
    return response.ok ? ((await response.json()) as PortalApproval[]) : [];
  }, [fetch]);

  return useSWR('portal-approvals', load, { refreshInterval: 60000 });
};
