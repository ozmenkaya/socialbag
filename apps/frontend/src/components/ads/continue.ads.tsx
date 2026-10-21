'use client';

import { FC, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

export const ContinueAds: FC<{
  provider: string;
  searchParams: { code?: string; state?: string; error_description?: string };
}> = ({ provider, searchParams }) => {
  const fetch = useFetch();
  const { push } = useRouter();
  const t = useT();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(
    searchParams.error_description ||
      (!searchParams.code ? 'Missing authorization code' : null)
  );

  useEffect(() => {
    if (started.current || error) {
      return;
    }
    started.current = true;

    (async () => {
      const response = await fetch(`/ads/${provider}/connect`, {
        method: 'POST',
        body: JSON.stringify({
          code: searchParams.code,
          state: searchParams.state,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(
          (Array.isArray(body.message) ? body.message[0] : body.message) ||
            t('ads_connect_failed', 'Could not connect the ads account')
        );
        return;
      }

      push('/settings?tab=ads');
    })();
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center text-white">
      {error ? (
        <div className="flex flex-col items-center gap-[12px]">
          <div>{error}</div>
          <a className="underline" href="/settings?tab=ads">
            {t('back_to_settings', 'Back to settings')}
          </a>
        </div>
      ) : (
        <div>{t('connecting_ads_account', 'Connecting your ads account...')}</div>
      )}
    </div>
  );
};
