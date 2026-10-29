'use client';

import useSWR, { useSWRConfig } from 'swr';
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

  return useSWR('portal-me', load);
};

// a session that ended while the panel was open goes back to signing in
const useSignedOut = () => {
  const { mutate } = useSWRConfig();
  return useCallback(
    (response: Response) => {
      if (response.status === 401) {
        mutate('portal-me');
      }
    },
    [mutate]
  );
};

// the posts planned or published between two dates
export const usePortalPosts = (startDate: string, endDate: string, projectId?: string) => {
  const fetch = useFetch();
  const signedOut = useSignedOut();
  const load = useCallback(async () => {
    const params = new URLSearchParams({ startDate, endDate });
    if (projectId) {
      params.set('projectId', projectId);
    }
    const response = await fetch(`/portal/posts?${params.toString()}`);
    signedOut(response);
    return response.ok ? ((await response.json()) as PortalPost[]) : [];
  }, [fetch, signedOut, startDate, endDate, projectId]);

  return useSWR(`portal-posts-${startDate}-${endDate}-${projectId || ''}`, load);
};

export const usePortalApprovals = () => {
  const fetch = useFetch();
  const signedOut = useSignedOut();
  const load = useCallback(async () => {
    const response = await fetch('/portal/approvals');
    signedOut(response);
    return response.ok ? ((await response.json()) as PortalApproval[]) : [];
  }, [fetch, signedOut]);

  // looked at again when the customer comes back to the page
  return useSWR('portal-approvals', load);
};

export interface PortalRequest {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string;
  title: string;
  description: string;
  wantedDate: string | null;
  status: 'new' | 'in_progress' | 'done';
  reply: string | null;
  createdAt: string;
  media: { id: string; path: string; thumbnail: string | null }[];
}

export const usePortalRequests = () => {
  const fetch = useFetch();
  const signedOut = useSignedOut();
  const load = useCallback(async () => {
    const response = await fetch('/portal/requests');
    signedOut(response);
    return response.ok ? ((await response.json()) as PortalRequest[]) : [];
  }, [fetch, signedOut]);

  return useSWR('portal-requests', load);
};
