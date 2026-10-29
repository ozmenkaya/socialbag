'use client';

import { FC, useCallback, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { Button } from '@gitroom/react/form/button';

// the customer approves the design or writes what should change, from the
// link sent on WhatsApp or from the customer portal (url)
export const ApprovalAnswerClient: FC<{
  url: string;
  status: string;
  note?: string | null;
  onAnswered?: () => void;
}> = ({ url, status: initialStatus, note: initialNote, onAnswered }) => {
  const fetch = useFetch();
  const toaster = useToaster();
  const [status, setStatus] = useState(initialStatus);
  const [revising, setRevising] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState<'approve' | 'revision' | ''>('');

  const answer = useCallback(
    (action: 'approve' | 'revision') => async () => {
      if (action === 'revision' && !note.trim()) {
        return;
      }
      setSending(action);
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
          action,
          ...(action === 'revision' ? { note: note.trim() } : {}),
        }),
      });
      setSending('');
      if (!response.ok) {
        toaster.show(
          (await response.json().catch(() => ({})))?.message ||
            'Cevabınız gönderilemedi, tekrar deneyin',
          'warning'
        );
        return;
      }
      setStatus(action === 'approve' ? 'approved' : 'revision');
      onAnswered?.();
    },
    [fetch, url, note, toaster, onAnswered]
  );

  if (status === 'approved') {
    return (
      <div className="bg-newBgColorInner rounded-[12px] p-[16px] text-center text-[15px]">
        Teşekkürler, tasarımı onayladınız. Paylaşım belirlenen tarihte yayınlanacak.
      </div>
    );
  }

  if (status === 'outdated') {
    return (
      <div className="bg-newBgColorInner rounded-[12px] p-[16px] text-center text-[15px]">
        Bu tasarım siz linki açtıktan sonra güncellendi. Size yeni bir onay linki gönderilecek.
      </div>
    );
  }

  if (status === 'revision') {
    return (
      <div className="bg-newBgColorInner rounded-[12px] p-[16px] flex flex-col gap-[6px] text-center text-[15px]">
        <div>Teşekkürler, düzeltme isteğiniz iletildi. Yeni tasarım size tekrar gönderilecek.</div>
        {!!(initialNote || note) && (
          <div className="text-[13px] text-textItemBlur whitespace-pre-wrap">
            “{initialNote || note}”
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-newBgColorInner rounded-[12px] p-[16px] flex flex-col gap-[12px] sticky bottom-[12px]">
      {revising ? (
        <>
          <textarea
            value={note}
            maxLength={2000}
            autoFocus={true}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Neyin değişmesini istersiniz? (yazı, fotoğraf, renk...)"
            className="w-full min-h-[100px] px-[14px] py-[10px] rounded-[8px] bg-newBgColor border border-newColColor text-[14px] outline-none focus:border-[#612BD3]"
          />
          <div className="flex gap-[8px]">
            <Button
              secondary={true}
              className="flex-1 rounded-[8px]"
              onClick={() => setRevising(false)}
              disabled={!!sending}
            >
              Vazgeç
            </Button>
            <Button
              className="flex-1 rounded-[8px]"
              onClick={answer('revision')}
              loading={sending === 'revision'}
              disabled={!note.trim()}
            >
              Düzeltme iste
            </Button>
          </div>
        </>
      ) : (
        <div className="flex gap-[8px]">
          <Button
            secondary={true}
            className="flex-1 rounded-[8px]"
            onClick={() => setRevising(true)}
            disabled={!!sending}
          >
            Düzeltme iste
          </Button>
          <Button
            className="flex-1 rounded-[8px] !bg-[#12B76A]"
            onClick={answer('approve')}
            loading={sending === 'approve'}
          >
            Onayla
          </Button>
        </div>
      )}
    </div>
  );
};
