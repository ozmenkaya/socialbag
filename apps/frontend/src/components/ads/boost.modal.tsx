'use client';

import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import dayjs from 'dayjs';
import { FormProvider, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { number, object, string } from 'yup';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { Select } from '@gitroom/react/form/select';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useAdsConnections } from '@gitroom/frontend/components/ads/ads.connections.component';

interface AdAccountItem {
  id: string;
  name: string;
  currency: string;
  active: boolean;
}

interface BoostItem {
  id: string;
  objective: string;
  dailyBudget: number;
  currency: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'PAUSED';
  connectionName: string;
  manageUrl: string;
  insights?: {
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
  };
}

const useAdAccounts = (connectionId?: string) => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await fetch(`/ads/connections/${connectionId}/accounts`)).json();
  }, [fetch, connectionId]);

  return useSWR<AdAccountItem[]>(
    connectionId ? `ads-accounts-${connectionId}` : null,
    load,
    { revalidateOnFocus: false }
  );
};

const usePostBoosts = (postId: string) => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await fetch(`/ads/boosts/${postId}`)).json();
  }, [fetch, postId]);

  return useSWR<BoostItem[]>(`ads-boosts-${postId}`, load);
};

const schema = object().shape({
  connectionId: string().required(),
  adAccountId: string().required(),
  objective: string().oneOf(['engagement', 'awareness']).required(),
  dailyBudget: number().typeError('Enter a number').min(1).required(),
  days: number().typeError('Enter a number').integer().min(1).max(90).required(),
  countries: string()
    .matches(/^[A-Za-z]{2}(\s*,\s*[A-Za-z]{2})*$/, 'Use country codes like TR, DE')
    .required(),
  ageMin: number().typeError('Enter a number').integer().min(18).max(65).required(),
  ageMax: number().typeError('Enter a number').integer().min(18).max(65).required(),
  specialAdCategory: string().oneOf(['NONE', 'HOUSING']).required(),
});

const errorMessage = async (response: Response, fallback: string) => {
  const body = await response.json().catch(() => ({}));
  return (Array.isArray(body.message) ? body.message[0] : body.message) || fallback;
};

export const BoostModal: FC<{ postId: string }> = ({ postId }) => {
  const fetch = useFetch();
  const toaster = useToaster();
  const t = useT();
  const [saving, setSaving] = useState(false);
  const { data: connections, isLoading: loadingConnections } =
    useAdsConnections();
  const { data: boosts, mutate: mutateBoosts } = usePostBoosts(postId);

  const form = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      connectionId: '',
      adAccountId: '',
      objective: 'engagement',
      dailyBudget: 100,
      days: 7,
      countries: 'TR',
      ageMin: 18,
      ageMax: 65,
      specialAdCategory: 'NONE',
    },
  });

  const connectionId = form.watch('connectionId');
  const adAccountId = form.watch('adAccountId');
  const dailyBudget = form.watch('dailyBudget');
  const days = form.watch('days');
  const specialAdCategory = form.watch('specialAdCategory');
  const { data: accounts, isLoading: loadingAccounts } =
    useAdAccounts(connectionId);

  useEffect(() => {
    if (!connectionId && connections?.length) {
      form.setValue('connectionId', connections[0].id);
    }
  }, [connections, connectionId]);

  useEffect(() => {
    const first = accounts?.find((p) => p.active);
    if (first && !accounts?.some((p) => p.id === adAccountId)) {
      form.setValue('adAccountId', first.id);
    }
  }, [accounts, adAccountId]);

  const currency = accounts?.find((p) => p.id === adAccountId)?.currency || '';
  const total = useMemo(() => {
    return (Number(dailyBudget) || 0) * (Number(days) || 0);
  }, [dailyBudget, days]);

  const submit = useCallback(
    async (values: any) => {
      setSaving(true);
      const response = await fetch('/ads/boosts', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          postId,
          dailyBudget: Number(values.dailyBudget),
          days: Number(values.days),
          ageMin: Number(values.ageMin),
          ageMax: Number(values.ageMax),
          countries: values.countries
            .split(',')
            .map((p: string) => p.trim().toUpperCase())
            .filter(Boolean),
        }),
      });
      setSaving(false);

      if (!response.ok) {
        toaster.show(
          await errorMessage(response, t('boost_failed', 'Could not create the ad')),
          'warning'
        );
        return;
      }

      toaster.show(
        t('boost_created_paused', 'The ad was created paused. Start it when you are ready.'),
        'success'
      );
      mutateBoosts();
    },
    [fetch, postId, mutateBoosts, t, toaster]
  );

  const changeStatus = useCallback(
    (boost: BoostItem, status: 'ACTIVE' | 'PAUSED') => async () => {
      if (status === 'ACTIVE') {
        const days = Math.max(
          1,
          dayjs(boost.endDate).diff(dayjs(boost.startDate), 'day')
        );
        if (
          !(await deleteDialog(
            t(
              'start_boost_confirm',
              `This ad will start spending up to ${boost.dailyBudget} ${boost.currency} per day, around ${boost.dailyBudget * days} ${boost.currency} in total.`,
              {
                daily: boost.dailyBudget,
                total: boost.dailyBudget * days,
                currency: boost.currency,
              }
            ),
            t('yes_start_ad', 'Yes, start the ad'),
            t('start_ad', 'Start ad')
          ))
        ) {
          return;
        }
      }

      const response = await fetch(`/ads/boosts/${boost.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        toaster.show(
          await errorMessage(response, t('boost_status_failed', 'Could not change the ad')),
          'warning'
        );
        return;
      }
      mutateBoosts();
    },
    [fetch, mutateBoosts, t, toaster]
  );

  const remove = useCallback(
    (boost: BoostItem) => async () => {
      if (
        !(await deleteDialog(
          t('delete_boost_confirm', 'Delete this ad from the ads account?')
        ))
      ) {
        return;
      }

      const response = await fetch(`/ads/boosts/${boost.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        toaster.show(
          await errorMessage(response, t('boost_delete_failed', 'Could not delete the ad')),
          'warning'
        );
        return;
      }
      mutateBoosts();
    },
    [fetch, mutateBoosts, t, toaster]
  );

  if (loadingConnections) {
    return (
      <div className="flex items-center justify-center py-[40px]">
        <LoadingComponent />
      </div>
    );
  }

  if (!connections?.length) {
    return (
      <div className="flex flex-col gap-[12px] py-[20px]">
        <div>
          {t(
            'no_ads_connection',
            'Connect an ads account in Settings > Ad Accounts to promote this post.'
          )}
        </div>
        <div>
          <a className="underline" href="/settings?tab=ads">
            {t('go_to_ads_settings', 'Go to Ad Accounts')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[24px]">
      {!!boosts?.length && (
        <div className="flex flex-col gap-[12px]">
          <div className="text-[16px] font-[600]">
            {t('existing_ads', 'Ads for this post')}
          </div>
          {boosts.map((boost) => (
            <div
              key={boost.id}
              className="bg-newBgColorInner border border-newTableBorder rounded-[8px] p-[12px] flex flex-col gap-[8px]"
            >
              <div className="flex justify-between gap-[12px] flex-wrap">
                <div>
                  {boost.status === 'ACTIVE'
                    ? t('ad_active', 'Active')
                    : t('ad_paused', 'Paused')}{' '}
                  · {boost.dailyBudget} {boost.currency}/
                  {t('day', 'day')} ·{' '}
                  {dayjs(boost.startDate).format('DD/MM')} -{' '}
                  {dayjs(boost.endDate).format('DD/MM/YYYY')}
                </div>
                <a
                  className="underline"
                  href={boost.manageUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('open_ads_manager', 'Open in Ads Manager')}
                </a>
              </div>
              {!!boost.insights && (
                <div className="text-textItemBlur text-[13px]">
                  {t('spend', 'Spend')}: {boost.insights.spend} {boost.currency} ·{' '}
                  {t('reach', 'Reach')}: {boost.insights.reach} ·{' '}
                  {t('impressions', 'Impressions')}: {boost.insights.impressions} ·{' '}
                  {t('clicks', 'Clicks')}: {boost.insights.clicks}
                </div>
              )}
              <div className="flex gap-[8px]">
                {boost.status === 'ACTIVE' ? (
                  <Button onClick={changeStatus(boost, 'PAUSED')}>
                    {t('pause_ad', 'Pause')}
                  </Button>
                ) : (
                  <Button onClick={changeStatus(boost, 'ACTIVE')}>
                    {t('start_ad', 'Start ad')}
                  </Button>
                )}
                <Button secondary={true} onClick={remove(boost)}>
                  {t('delete', 'Delete')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <FormProvider {...form}>
        <form
          onSubmit={form.handleSubmit(submit)}
          className="flex flex-col gap-[12px]"
        >
          <div className="text-[16px] font-[600]">
            {t('new_ad', 'New ad')}
          </div>
          <div className="grid grid-cols-2 gap-x-[16px]">
            <Select label={t('ads_account', 'Ads connection')} {...form.register('connectionId')}>
              {connections.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select
              label={t('ad_account', 'Ad account')}
              disabled={loadingAccounts}
              {...form.register('adAccountId')}
            >
              {(accounts || []).map((p) => (
                <option key={p.id} value={p.id} disabled={!p.active}>
                  {p.name} ({p.currency})
                </option>
              ))}
            </Select>
            <Select label={t('objective', 'Objective')} {...form.register('objective')}>
              <option value="engagement">
                {t('objective_engagement', 'Engagement')}
              </option>
              <option value="awareness">
                {t('objective_awareness', 'Reach')}
              </option>
            </Select>
            <Select
              label={t('special_ad_category', 'Special ad category')}
              {...form.register('specialAdCategory')}
            >
              <option value="NONE">{t('none', 'None')}</option>
              <option value="HOUSING">
                {t('housing', 'Housing (real estate)')}
              </option>
            </Select>
            <Input
              label={t('daily_budget', 'Daily budget')}
              type="number"
              step="0.01"
              {...form.register('dailyBudget')}
            />
            <Input
              label={t('days', 'Days')}
              type="number"
              {...form.register('days')}
            />
            <Input
              label={t('countries', 'Countries (codes, e.g. TR, DE)')}
              {...form.register('countries')}
            />
            <div className="grid grid-cols-2 gap-x-[8px]">
              <Input
                label={t('age_min', 'Min age')}
                type="number"
                readOnly={specialAdCategory === 'HOUSING'}
                {...form.register('ageMin')}
              />
              <Input
                label={t('age_max', 'Max age')}
                type="number"
                readOnly={specialAdCategory === 'HOUSING'}
                {...form.register('ageMax')}
              />
            </div>
          </div>
          {specialAdCategory === 'HOUSING' && (
            <div className="text-textItemBlur text-[13px]">
              {t(
                'housing_notice',
                'Housing ads can not be targeted by age, gender or narrow locations.'
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-[12px] flex-wrap">
            <div>
              {t('total_budget', 'Total budget')}: {total} {currency}
            </div>
            <Button type="submit" loading={saving} disabled={!adAccountId}>
              {t('create_paused_ad', 'Create ad (paused)')}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};
