'use client';

import React, { FC, useCallback, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Button } from '@gitroom/react/form/button';
import { errorMessage } from '@gitroom/frontend/components/media/media.folders';
import {
  ProjectRequestItem,
  useProjectRequests,
} from '@gitroom/frontend/components/projects/use.projects';

const isVideo = (path: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(path);

const RequestRow: FC<{ request: ProjectRequestItem; onSaved: () => void }> = ({
  request,
  onSaved,
}) => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const [open, setOpen] = useState(request.status === 'new');
  const [status, setStatus] = useState(request.status);
  const [reply, setReply] = useState(request.reply || '');
  const [saving, setSaving] = useState(false);
  const statuses = {
    new: t('request_status_new', 'New'),
    in_progress: t('request_status_in_progress', 'In progress'),
    done: t('request_status_done', 'Done'),
  };

  const save = useCallback(async () => {
    setSaving(true);
    const response = await fetch(`/projects/requests/${request.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, reply }),
    });
    setSaving(false);
    if (!response.ok) {
      toaster.show(
        await errorMessage(response, t('request_save_failed', 'Could not save the request')),
        'warning'
      );
      return;
    }
    toaster.show(t('request_saved', 'Saved, the customer sees it on the portal'), 'success');
    onSaved();
  }, [fetch, request.id, status, reply, onSaved, toaster, t]);

  return (
    <div className="flex flex-col gap-[10px] py-[12px] border-t border-newColColor">
      <div className="flex items-start gap-[12px] cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="text-[14px] font-[600] break-words">{request.title}</div>
          <div className="text-[12px] text-textItemBlur">
            {request.projectName} · {request.clientName} ·{' '}
            {new Date(request.createdAt).toLocaleString()}
            {!!request.media.length &&
              ` · ${t('request_files', '{{count}} files', { count: request.media.length })}`}
          </div>
        </div>
        <span
          className={clsx(
            'text-[12px] px-[8px] py-[1px] rounded-[4px] shrink-0',
            request.status === 'new'
              ? 'bg-[#612BD3] text-white'
              : request.status === 'in_progress'
              ? 'bg-[#F79009] text-white'
              : 'bg-[#12B76A] text-white'
          )}
        >
          {statuses[request.status]}
        </span>
      </div>
      {open && (
        <div className="flex flex-col gap-[10px]">
          {!!request.description && (
            <div className="text-[14px] whitespace-pre-wrap break-words">{request.description}</div>
          )}
          {!!request.wantedDate && (
            <div className="text-[13px] text-textItemBlur">
              {t('request_wanted_date', 'Wanted on {{date}}', {
                date: new Date(request.wantedDate).toLocaleDateString(),
                interpolation: { escapeValue: false },
              })}
            </div>
          )}
          {!!request.media.length && (
            <div className="flex gap-[6px] flex-wrap">
              {request.media.map((media) => (
                <a key={media.id} href={media.path} target="_blank" rel="noopener noreferrer">
                  {isVideo(media.path) && !media.thumbnail ? (
                    <div className="w-[72px] h-[72px] rounded-[8px] bg-newBgColorInner flex items-center justify-center text-[12px] text-textItemBlur">
                      Video
                    </div>
                  ) : (
                    <img
                      src={media.thumbnail || media.path}
                      alt=""
                      className="w-[72px] h-[72px] rounded-[8px] object-cover"
                    />
                  )}
                </a>
              ))}
            </div>
          )}
          <div className="flex gap-[8px] items-start mobile:flex-col">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectRequestItem['status'])}
              className="h-[40px] px-[10px] rounded-[8px] bg-newBgColorInner border border-newColColor text-[14px] outline-none"
            >
              {Object.entries(statuses).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <textarea
              value={reply}
              maxLength={2000}
              onChange={(e) => setReply(e.target.value)}
              placeholder={t('request_reply_placeholder', 'Reply to the customer (shown on the portal)')}
              className="flex-1 w-full min-h-[40px] h-[40px] focus:h-[90px] px-[12px] py-[8px] rounded-[8px] bg-newBgColorInner border border-newColColor text-[14px] outline-none focus:border-[#612BD3]"
            />
            <Button onClick={save} loading={saving}>
              {t('save', 'Save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// what the customers asked for from the customer portal (/musteri)
export const ProjectRequests = () => {
  const t = useT();
  const [status, setStatus] = useState('');
  const { data: requests, mutate } = useProjectRequests(status);

  if (!status && !requests?.length) {
    return null;
  }

  return (
    <div className="flex flex-col gap-[12px] p-[16px] rounded-[8px] border border-newColColor bg-newBgColor">
      <div className="flex items-center justify-between gap-[12px] flex-wrap">
        <div className="text-[16px] font-[600]">{t('customer_requests', 'Customer requests')}</div>
        <div className="flex gap-[4px]">
          {[
            ['', t('all', 'All')],
            ['new', t('request_status_new', 'New')],
            ['in_progress', t('request_status_in_progress', 'In progress')],
            ['done', t('request_status_done', 'Done')],
          ].map(([value, label]) => (
            <div
              key={value}
              onClick={() => setStatus(value)}
              className={clsx(
                'h-[32px] px-[10px] flex items-center rounded-[8px] cursor-pointer text-[13px] border border-newColColor',
                status === value ? 'bg-[#612BD3] text-white border-[#612BD3]' : 'hover:bg-boxHover'
              )}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
      {!requests?.length ? (
        <div className="text-[13px] text-textItemBlur">{t('no_requests', 'No requests')}</div>
      ) : (
        <div className="flex flex-col">
          {requests.map((request) => (
            <RequestRow key={request.id} request={request} onSaved={() => mutate()} />
          ))}
        </div>
      )}
    </div>
  );
};
