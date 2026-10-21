'use client';

import React, { FC, Fragment, useCallback } from 'react';
import useSWR from 'swr';
import dayjs from 'dayjs';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

export interface AdsProviderItem {
  identifier: string;
  name: string;
  socialProviders: string[];
}

export interface AdsConnectionItem {
  id: string;
  provider: string;
  name: string;
  picture?: string;
  tokenExpiration?: string;
}

export const useAdsProviders = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await fetch('/ads/providers')).json();
  }, [fetch]);

  return useSWR<AdsProviderItem[]>('ads-providers', load, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  });
};

export const useAdsConnections = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await fetch('/ads/connections')).json();
  }, [fetch]);

  return useSWR<AdsConnectionItem[]>('ads-connections', load);
};

export const AdsConnectionsComponent: FC = () => {
  const fetch = useFetch();
  const toaster = useToaster();
  const t = useT();
  const { data: providers } = useAdsProviders();
  const { data: connections, mutate } = useAdsConnections();

  const connect = useCallback(
    (identifier: string) => async () => {
      const response = await fetch(`/ads/${identifier}/url`);
      const { url } = await response.json().catch(() => ({}));
      if (!response.ok || !url) {
        toaster.show(
          t('ads_connect_start_failed', 'Could not start the connection'),
          'warning'
        );
        return;
      }
      window.location.href = url;
    },
    [fetch, t, toaster]
  );

  const disconnect = useCallback(
    (connection: AdsConnectionItem) => async () => {
      if (
        !(await deleteDialog(
          t(
            'are_you_sure_you_want_to_disconnect_ads',
            'Are you sure you want to disconnect {{name}}? Existing ads keep running in the ads manager.',
            { name: connection.name }
          )
        ))
      ) {
        return;
      }

      const response = await fetch(`/ads/connections/${connection.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        toaster.show(
          t('ads_disconnect_failed', 'Could not disconnect the ads account'),
          'warning'
        );
        return;
      }
      mutate();
      toaster.show(t('ads_account_disconnected', 'Ads account disconnected'), 'success');
    },
    [fetch, mutate, t, toaster]
  );

  return (
    <div className="flex flex-col">
      <h3 className="text-[20px]">{t('ads_accounts', 'Ad Accounts')}</h3>
      <div className="text-textItemBlur mt-[4px]">
        {t(
          'ads_accounts_description',
          'Connect your ads account to promote published posts. New ads are created paused, nothing is spent until you start them.'
        )}
      </div>
      <div className="my-[16px] mt-[16px] bg-sixth border-fifth items-center border rounded-[4px] p-[24px] flex gap-[24px]">
        <div className="flex flex-col w-full gap-[16px]">
          {!!connections?.length && (
            <div className="grid grid-cols-[1fr,1fr,1fr,1fr] w-full gap-y-[10px]">
              <div>{t('name', 'Name')}</div>
              <div>{t('provider', 'Provider')}</div>
              <div>{t('expires', 'Expires')}</div>
              <div>{t('delete', 'Delete')}</div>
              {connections.map((p) => (
                <Fragment key={p.id}>
                  <div className="flex items-center gap-[8px]">
                    {!!p.picture && (
                      <img
                        className="w-[24px] h-[24px] rounded-full"
                        src={p.picture}
                      />
                    )}
                    {p.name}
                  </div>
                  <div className="flex flex-col justify-center">
                    {providers?.find((a) => a.identifier === p.provider)?.name ||
                      p.provider}
                  </div>
                  <div className="flex flex-col justify-center">
                    {p.tokenExpiration
                      ? dayjs(p.tokenExpiration).format('DD/MM/YYYY')
                      : '-'}
                  </div>
                  <div className="flex flex-col justify-center">
                    <div>
                      <Button onClick={disconnect(p)}>
                        {t('disconnect', 'Disconnect')}
                      </Button>
                    </div>
                  </div>
                </Fragment>
              ))}
            </div>
          )}
          <div className="flex gap-[8px]">
            {providers?.map((p) => (
              <Button key={p.identifier} onClick={connect(p.identifier)}>
                {t('connect_ads_provider', 'Connect {{name}} ads', {
                  name: p.name,
                })}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
