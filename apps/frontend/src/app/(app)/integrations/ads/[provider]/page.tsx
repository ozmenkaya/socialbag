import { ContinueAds } from '@gitroom/frontend/components/ads/continue.ads';

export const dynamic = 'force-dynamic';

export default async function Page(props: {
  params: Promise<{
    provider: string;
  }>;
  searchParams: Promise<any>;
}) {
  const searchParams = await props.searchParams;
  const { provider } = await props.params;

  return <ContinueAds provider={provider} searchParams={searchParams} />;
}
