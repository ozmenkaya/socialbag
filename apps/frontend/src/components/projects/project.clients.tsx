'use client';

import React, { FC, useCallback, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Button } from '@gitroom/react/form/button';
import { errorMessage } from '@gitroom/frontend/components/media/media.folders';
import {
  ProjectClientItem,
  ProjectItem,
  useProjectClients,
} from '@gitroom/frontend/components/projects/use.projects';

const inputClass =
  'w-full h-[44px] px-[14px] rounded-[8px] bg-newBgColorInner border border-newColColor text-[14px] outline-none focus:border-[#612BD3]';

const portalUrl = () => `${window.location.origin}/musteri`;

// the sign in of a customer, shown once after it is set so it can be sent
const Credentials: FC<{ name: string; username: string; password: string }> = ({
  name,
  username,
  password,
}) => {
  const t = useT();
  const toaster = useToaster();
  const message = t(
    'client_credentials_message',
    'Hello {{name}}, you can follow your projects, the planned posts and the designs waiting for your approval here:\n{{url}}\nUsername: {{username}}\nPassword: {{password}}',
    { name, url: portalUrl(), username, password, interpolation: { escapeValue: false } }
  );

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(message);
    toaster.show(t('copied', 'Copied'), 'success');
  }, [message, toaster, t]);

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="text-[13px] text-textItemBlur">
        {t(
          'client_credentials_hint',
          'Send these to the customer, the password is not shown again. It can be changed later from here or by the customer.'
        )}
      </div>
      <div className="flex flex-col gap-[6px] p-[14px] rounded-[8px] bg-newBgColorInner border border-newColColor text-[14px]">
        <div>
          <span className="text-textItemBlur">{t('client_portal_address', 'Address')}: </span>
          {portalUrl()}
        </div>
        <div>
          <span className="text-textItemBlur">{t('client_username', 'Username')}: </span>
          <span className="font-[600]">{username}</span>
        </div>
        <div>
          <span className="text-textItemBlur">{t('client_password', 'Password')}: </span>
          <span className="font-[600]">{password}</span>
        </div>
      </div>
      <div className="flex gap-[8px] justify-end">
        <Button secondary={true} onClick={copy}>
          {t('copy', 'Copy')}
        </Button>
        <Button
          className="!bg-[#12B76A]"
          onClick={() =>
            window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
          }
        >
          {t('send_on_whatsapp', 'Send on WhatsApp')}
        </Button>
      </div>
    </div>
  );
};

const ClientModal: FC<{
  client?: ProjectClientItem;
  projects: ProjectItem[];
  onSaved: () => void;
}> = ({ client, projects, onSaved }) => {
  const t = useT();
  const fetch = useFetch();
  const modals = useModals();
  const toaster = useToaster();
  const [name, setName] = useState(client?.name || '');
  const [username, setUsername] = useState(client?.username || '');
  // empty: generated for a new customer, left as it was for an existing one
  const [password, setPassword] = useState('');
  const [projectIds, setProjectIds] = useState<string[]>(
    client?.projects.map((p) => p.id) || []
  );
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    setSaving(true);
    const response = await fetch(client ? `/projects/clients/${client.id}` : '/projects/clients', {
      method: client ? 'PUT' : 'POST',
      body: JSON.stringify({
        name: name.trim(),
        username: username.trim(),
        ...(password ? { password } : {}),
        projectIds,
      }),
    });
    setSaving(false);
    if (!response.ok) {
      toaster.show(
        await errorMessage(response, t('client_save_failed', 'Could not save the customer')),
        'warning'
      );
      return;
    }
    const saved = await response.json();
    onSaved();
    modals.closeCurrent();
    if (saved.password) {
      modals.openModal({
        title: t('client_credentials', 'Sign in of {{name}}', { name: name.trim() }),
        withCloseButton: true,
        children: (
          <Credentials name={name.trim()} username={saved.username} password={saved.password} />
        ),
      });
    }
  }, [fetch, client, name, username, password, projectIds, onSaved, modals, toaster, t]);

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex flex-col gap-[8px]">
        <div className="text-[14px]">{t('client_name', 'Customer name')}</div>
        <input
          autoFocus={true}
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('client_name_placeholder', 'Person or company')}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-[8px]">
        <div className="text-[14px]">{t('client_username', 'Username')}</div>
        <input
          value={username}
          maxLength={40}
          autoCapitalize="none"
          spellCheck={false}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
          placeholder="plastform"
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-[8px]">
        <div className="text-[14px]">
          {client ? t('client_new_password', 'New password') : t('client_password', 'Password')}
        </div>
        <input
          value={password}
          maxLength={100}
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder={
            client
              ? t('client_password_keep', 'Leave empty to keep the current one')
              : t('client_password_generate', 'Leave empty to generate one')
          }
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-[8px]">
        <div className="text-[14px]">{t('client_projects', 'Projects the customer sees')}</div>
        <div className="flex flex-col gap-[4px] max-h-[200px] overflow-y-auto">
          {projects.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-[10px] cursor-pointer p-[6px] rounded-[8px] hover:bg-boxHover"
            >
              <input
                type="checkbox"
                checked={projectIds.includes(p.id)}
                onChange={() =>
                  setProjectIds((prev) =>
                    prev.includes(p.id) ? prev.filter((r) => r !== p.id) : [...prev, p.id]
                  )
                }
              />
              <div className="flex-1">{p.name}</div>
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          onClick={save}
          loading={saving}
          disabled={!name.trim() || username.trim().length < 3 || (!!password && password.length < 6)}
        >
          {t('save', 'Save')}
        </Button>
      </div>
    </div>
  );
};

// the customers who sign in to the customer portal (/musteri) to follow the
// projects given to them and answer the designs sent for approval
export const ProjectClients: FC<{ projects: ProjectItem[] }> = ({ projects }) => {
  const t = useT();
  const fetch = useFetch();
  const modals = useModals();
  const toaster = useToaster();
  const { data: clients, mutate } = useProjectClients();

  const open = useCallback(
    (client?: ProjectClientItem) => () => {
      modals.openModal({
        title: client
          ? t('edit_client', 'Edit {{name}}', { name: client.name })
          : t('new_client', 'New customer account'),
        withCloseButton: true,
        children: <ClientModal client={client} projects={projects} onSaved={() => mutate()} />,
      });
    },
    [modals, projects, mutate, t]
  );

  const remove = useCallback(
    (client: ProjectClientItem) => async () => {
      if (
        !(await deleteDialog(
          t(
            'delete_client_confirm',
            'Delete the account of {{name}}? The customer can no longer sign in, the projects stay.',
            { name: client.name }
          )
        ))
      ) {
        return;
      }
      const response = await fetch(`/projects/clients/${client.id}`, { method: 'DELETE' });
      if (!response.ok) {
        toaster.show(
          await errorMessage(response, t('client_delete_failed', 'Could not delete the customer')),
          'warning'
        );
        return;
      }
      mutate();
    },
    [fetch, mutate, toaster, t]
  );

  return (
    <div className="flex flex-col gap-[12px] p-[16px] rounded-[8px] border border-newColColor bg-newBgColor">
      <div className="flex items-start justify-between gap-[12px]">
        <div className="flex flex-col gap-[4px]">
          <div className="text-[16px] font-[600]">{t('client_accounts', 'Customer accounts')}</div>
          <div className="text-[13px] text-textItemBlur">
            {t(
              'client_accounts_hint',
              'Customers sign in at {{url}} to see their projects, when the posts go out, and to approve the designs or ask for changes.',
              {
                url: typeof window === 'undefined' ? '/musteri' : portalUrl(),
                interpolation: { escapeValue: false },
              }
            )}
          </div>
        </div>
        <Button onClick={open()} disabled={!projects.length}>
          {t('new_client', 'New customer account')}
        </Button>
      </div>
      {!!clients?.length && (
        <div className="flex flex-col">
          {clients.map((client) => (
            <div
              key={client.id}
              className="flex items-center gap-[12px] py-[10px] border-t border-newColColor mobile:flex-wrap"
            >
              <div className="flex flex-col min-w-0 flex-1">
                <div className="text-[14px] font-[600] truncate">{client.name}</div>
                <div className="text-[12px] text-textItemBlur truncate">
                  {client.username} ·{' '}
                  {client.lastLoginAt
                    ? t('client_last_login', 'last signed in {{date}}', {
                        date: new Date(client.lastLoginAt).toLocaleString(),
                        interpolation: { escapeValue: false },
                      })
                    : t('client_never_signed_in', 'not signed in yet')}
                </div>
              </div>
              <div className="flex gap-[6px] flex-wrap">
                {client.projects.map((p) => (
                  <div key={p.id} className="text-[12px] px-[8px] py-[2px] rounded-[4px] bg-boxHover">
                    {p.name}
                  </div>
                ))}
              </div>
              <div className="flex gap-[10px] text-[13px] text-textItemBlur shrink-0">
                <span className="cursor-pointer hover:text-newTextColor" onClick={open(client)}>
                  {t('edit', 'Edit')}
                </span>
                <span className="cursor-pointer hover:text-[#F97066]" onClick={remove(client)}>
                  {t('delete', 'Delete')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
