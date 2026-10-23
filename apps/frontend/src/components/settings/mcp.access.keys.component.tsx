'use client';

import React, { FC, useCallback, useState } from 'react';
import useSWR from 'swr';
import copy from 'copy-to-clipboard';
import dayjs from 'dayjs';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { Checkbox } from '@gitroom/react/form/checkbox';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';

type McpAccessKey = {
  id: string;
  name: string;
  keyPreview: string;
  readOnly: boolean;
  integrationIds: string[];
  lastUsedAt: string | null;
  createdAt: string;
};

type Channel = {
  id: string;
  name: string;
  identifier: string;
  disabled?: boolean;
};

const useMcpAccessKeys = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await fetch('/mcp-keys')).json() as Promise<McpAccessKey[]>;
  }, []);
  return useSWR('mcp-access-keys', load);
};

const useChannels = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await (await fetch('/integrations/list')).json())
      .integrations as Channel[];
  }, []);
  return useSWR('mcp-access-channels', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
};

const KeyCreated: FC<{ url: string }> = ({ url }) => {
  const t = useT();
  const toaster = useToaster();
  return (
    <div className="flex flex-col gap-[16px] pt-[8px]">
      <p className="text-[14px] text-textColor/80">
        {t(
          'mcp_key_created_info',
          'Copy this URL now, it is shown only once. Paste it in Claude as a custom connector URL.'
        )}
      </p>
      <div className="break-all rounded-[8px] border border-tableBorder p-[12px] text-[13px]">
        {url}
      </div>
      <Button
        type="button"
        onClick={() => {
          copy(url);
          toaster.show(t('copied', 'Copied'), 'success');
        }}
      >
        {t('copy_link', 'Copy Link')}
      </Button>
    </div>
  );
};

const AddKey: FC<{ reload: () => void }> = ({ reload }) => {
  const t = useT();
  const fetch = useFetch();
  const modals = useModals();
  const toaster = useToaster();
  const { backendUrl, mcpUrl } = useVariables();
  const { data: channels } = useChannels();
  const [name, setName] = useState('');
  const [readOnly, setReadOnly] = useState(true);
  const [allChannels, setAllChannels] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = useCallback(
    (id: string) => () =>
      setSelected((current) =>
        current.includes(id)
          ? current.filter((p) => p !== id)
          : [...current, id]
      ),
    []
  );

  const create = useCallback(async () => {
    if (!name.trim()) {
      toaster.show(t('mcp_key_name_required', 'Give the key a name'), 'warning');
      return;
    }
    if (!allChannels && !selected.length) {
      toaster.show(
        t('mcp_key_channels_required', 'Select at least one channel'),
        'warning'
      );
      return;
    }

    const response = await fetch('/mcp-keys', {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        readOnly,
        integrationIds: allChannels ? [] : selected,
      }),
    });
    if (!response.ok) {
      toaster.show(
        t('mcp_key_create_failed', 'The key could not be created'),
        'warning'
      );
      return;
    }

    const { key } = await response.json();
    reload();
    modals.closeCurrent();
    modals.openModal({
      title: t('mcp_key_created', 'Access key created'),
      withCloseButton: true,
      children: <KeyCreated url={`${mcpUrl || backendUrl}/mcp/${key}`} />,
    });
  }, [name, readOnly, allChannels, selected, mcpUrl, backendUrl]);

  return (
    <div className="flex flex-col gap-[16px] pt-[8px]">
      <Input
        disableForm={true}
        name="mcpKeyName"
        label={t('name', 'Name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Checkbox
        disableForm={true}
        name="mcpKeyReadOnly"
        checked={readOnly}
        onChange={(e) => setReadOnly(e.target.value)}
        label={t(
          'mcp_key_read_only',
          'Read only (cannot schedule, delete or upload anything)'
        )}
      />
      <Checkbox
        disableForm={true}
        name="mcpKeyAllChannels"
        checked={allChannels}
        onChange={(e) => setAllChannels(e.target.value)}
        label={t('mcp_key_all_channels', 'Access to all channels')}
      />
      {!allChannels && (
        <div className="flex max-h-[220px] flex-col gap-[8px] overflow-y-auto">
          {(channels || [])
            .filter((p) => !p.disabled)
            .map((channel) => (
              <Checkbox
                key={channel.id}
                disableForm={true}
                name={`mcpKeyChannel-${channel.id}`}
                checked={selected.includes(channel.id)}
                onChange={toggle(channel.id)}
                label={`${channel.name} (${channel.identifier})`}
              />
            ))}
        </div>
      )}
      <Button type="button" onClick={create}>
        {t('mcp_key_create', 'Create access key')}
      </Button>
    </div>
  );
};

export const McpAccessKeysComponent: FC = () => {
  const t = useT();
  const fetch = useFetch();
  const modals = useModals();
  const { data, mutate } = useMcpAccessKeys();
  const { data: channels } = useChannels();

  const add = useCallback(() => {
    modals.openModal({
      title: t('mcp_key_add', 'Add access key'),
      withCloseButton: true,
      children: <AddKey reload={mutate} />,
    });
  }, [mutate, t]);

  const remove = useCallback(
    (key: McpAccessKey) => async () => {
      if (
        !(await deleteDialog(
          t(
            'mcp_key_delete_confirm',
            'Anything connected with this key stops working. Delete it?'
          )
        ))
      ) {
        return;
      }
      await fetch(`/mcp-keys/${key.id}`, { method: 'DELETE' });
      mutate();
    },
    [t]
  );

  const channelNames = useCallback(
    (key: McpAccessKey) =>
      !key.integrationIds.length
        ? t('mcp_key_all_channels', 'Access to all channels')
        : key.integrationIds
            .map(
              (id) => (channels || []).find((p) => p.id === id)?.name || id
            )
            .join(', '),
    [channels, t]
  );

  return (
    <div className="flex flex-col">
      <h3 className="text-[20px]">
        {t('mcp_access_keys', 'MCP access keys')}
      </h3>
      <div className="text-customColor18 mt-[4px]">
        {t(
          'mcp_access_keys_info',
          'Give an assistant such as Claude limited access: read only, and only the channels you choose. The main API key above always has full access.'
        )}
      </div>
      <div className="my-[16px] flex flex-col gap-[16px] rounded-[4px] border border-fifth bg-sixth p-[24px] mobile:p-[12px]">
        {!!data?.length && (
          <div className="flex flex-col gap-[12px]">
            {data.map((key) => (
              <div
                key={key.id}
                className="flex items-center gap-[12px] mobile:flex-wrap"
              >
                <div className="flex flex-1 flex-col gap-[2px]">
                  <div>
                    {key.name}{' '}
                    <span className="text-[12px] text-textColor/60">
                      {key.keyPreview}
                    </span>
                  </div>
                  <div className="text-[12px] text-textColor/60">
                    {key.readOnly
                      ? t('mcp_key_mode_read_only', 'Read only')
                      : t('mcp_key_mode_full', 'Read and write')}
                    {' · '}
                    {channelNames(key)}
                    {' · '}
                    {key.lastUsedAt
                      ? t('mcp_key_last_used', 'Last used {{date}}', {
                          date: dayjs(key.lastUsedAt).format('YYYY-MM-DD HH:mm'),
                        })
                      : t('mcp_key_never_used', 'Never used')}
                  </div>
                </div>
                <Button
                  type="button"
                  className="!h-[32px] !bg-customColor3 border border-customColor21 rounded-[4px] text-[12px]"
                  onClick={remove(key)}
                >
                  {t('delete', 'Delete')}
                </Button>
              </div>
            ))}
          </div>
        )}
        <div>
          <Button type="button" onClick={add}>
            {t('mcp_key_add', 'Add access key')}
          </Button>
        </div>
      </div>
    </div>
  );
};
