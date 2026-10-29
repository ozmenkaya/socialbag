'use client';

import { FC, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { Button } from '@gitroom/react/form/button';
import { VideoOrImage } from '@gitroom/react/helpers/video.or.image';
import { sanitizePostContent } from '@gitroom/helpers/utils/sanitize.post.content';
import { ApprovalAnswerClient } from '@gitroom/frontend/components/preview/approval.answer.client';
import {
  PortalApproval,
  PortalChannel,
  PortalMe,
  PortalPost,
  PortalRequest,
  usePortalApprovals,
  usePortalMe,
  usePortalPosts,
  usePortalRequests,
} from '@gitroom/frontend/components/portal/use.portal';

// The customer portal is for the customers of the agency, it speaks Turkish
// like the approval link

const inputClass =
  'w-full h-[48px] px-[14px] rounded-[10px] bg-newBgColor border border-newColColor text-[15px] outline-none focus:border-[#612BD3]';

const isVideo = (path: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(path);

const formatDay = (date: Date) =>
  date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
const formatTime = (date: Date) =>
  date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
const formatDateTime = (date: string) =>
  new Date(date).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

// the first lines of a post, without its markup
const excerpt = (html: string) =>
  html
    .replace(/<br\s*\/?>|<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const errorMessage = async (response: Response, fallback: string) =>
  (await response.json().catch(() => ({})))?.message || fallback;

const ChannelAvatar: FC<{ channel: PortalChannel; size?: number }> = ({
  channel,
  size = 40,
}) => (
  <div className="relative shrink-0" style={{ width: size, height: size }}>
    <img
      className="w-full h-full bg-newBgColor rounded-full object-cover"
      alt={channel.name}
      src={channel.picture || '/no-picture.jpg'}
    />
    <img
      className="absolute -end-[4px] -bottom-[4px] w-[18px] h-[18px] bg-newBgColor rounded-full"
      alt={channel.platform}
      src={`/icons/platforms/${channel.platform}.png`}
    />
  </div>
);

const PostBody: FC<{ content: string; images: string[] }> = ({ content, images }) => (
  <div className="flex flex-col gap-[12px]">
    {!!images.length && (
      <div className="flex flex-col gap-[8px]">
        {images.map((image) => (
          <div key={image} className="rounded-[10px] overflow-hidden">
            <VideoOrImage isContain={true} src={image} autoplay={false} />
          </div>
        ))}
      </div>
    )}
    {!!content && (
      <div
        className="text-[14px] whitespace-pre-wrap break-words"
        dangerouslySetInnerHTML={{ __html: sanitizePostContent(content) }}
      />
    )}
  </div>
);

const PortalLogin: FC<{ onSignedIn: () => void }> = ({ onSignedIn }) => {
  const fetch = useFetch();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!username.trim() || !password) {
        return;
      }
      setSending(true);
      setError('');
      const response = await fetch('/public/portal/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password, remember }),
      });
      setSending(false);
      if (!response.ok) {
        setError(
          response.status === 429
            ? 'Çok fazla deneme yapıldı, biraz sonra tekrar deneyin'
            : await errorMessage(response, 'Giriş yapılamadı, tekrar deneyin')
        );
        return;
      }
      onSignedIn();
    },
    [fetch, username, password, remember, onSignedIn]
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-[16px] py-[40px]">
      <form
        onSubmit={submit}
        className="w-full max-w-[400px] bg-newBgColorInner border border-newTableBorder rounded-[16px] p-[24px] flex flex-col gap-[16px]"
      >
        <div className="flex flex-col gap-[4px]">
          <div className="text-[22px] font-[600]">Müşteri paneli</div>
          <div className="text-[14px] text-textItemBlur">
            Projelerinizi, planlanan paylaşımları ve onayınızı bekleyen tasarımları buradan
            takip edin.
          </div>
        </div>
        <label className="flex flex-col gap-[6px]">
          <span className="text-[13px] text-textItemBlur">Kullanıcı adı</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={40}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-[6px]">
          <span className="text-[13px] text-textItemBlur">Şifre</span>
          <div className="relative">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={visible ? 'text' : 'password'}
              autoComplete="current-password"
              maxLength={100}
              className={`${inputClass} pe-[70px]`}
            />
            <span
              onClick={() => setVisible(!visible)}
              className="absolute end-[12px] top-1/2 -translate-y-1/2 text-[13px] text-textItemBlur cursor-pointer select-none"
            >
              {visible ? 'Gizle' : 'Göster'}
            </span>
          </div>
        </label>
        <label className="flex items-center gap-[10px] cursor-pointer select-none text-[14px]">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-[18px] h-[18px] accent-[#612BD3]"
          />
          Beni hatırla
        </label>
        {!!error && <div className="text-[14px] text-[#F97066]">{error}</div>}
        <Button
          type="submit"
          className="rounded-[10px] h-[48px]"
          loading={sending}
          disabled={!username.trim() || !password}
        >
          Giriş yap
        </Button>
        <div className="text-[12px] text-textItemBlur text-center">
          Giriş bilgilerinizi bilmiyorsanız ajansınızdan isteyebilirsiniz.
        </div>
      </form>
    </div>
  );
};

const PasswordForm: FC<{ onClose: () => void }> = ({ onClose }) => {
  const fetch = useFetch();
  const toaster = useToaster();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [sending, setSending] = useState(false);
  const mismatch = !!repeat && password !== repeat;

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!current || password.length < 6 || password !== repeat) {
        return;
      }
      setSending(true);
      const response = await fetch('/portal/password', {
        method: 'POST',
        body: JSON.stringify({ current, password }),
      });
      setSending(false);
      if (!response.ok) {
        toaster.show(await errorMessage(response, 'Şifre değiştirilemedi'), 'warning');
        return;
      }
      toaster.show('Şifreniz değiştirildi', 'success');
      onClose();
    },
    [fetch, toaster, current, password, repeat, onClose]
  );

  return (
    <form
      onSubmit={submit}
      className="bg-newBgColorInner border border-newTableBorder rounded-[12px] p-[16px] flex flex-col gap-[10px]"
    >
      <div className="text-[15px] font-[600]">Şifre değiştir</div>
      <input
        type="password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        autoComplete="current-password"
        placeholder="Mevcut şifre"
        className={inputClass}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        placeholder="Yeni şifre (en az 6 karakter)"
        className={inputClass}
      />
      <input
        type="password"
        value={repeat}
        onChange={(e) => setRepeat(e.target.value)}
        autoComplete="new-password"
        placeholder="Yeni şifre tekrar"
        className={inputClass}
      />
      {mismatch && <div className="text-[13px] text-[#F97066]">Şifreler aynı değil</div>}
      <div className="flex gap-[8px]">
        <Button type="button" secondary={true} className="flex-1 rounded-[8px]" onClick={onClose}>
          Vazgeç
        </Button>
        <Button
          type="submit"
          className="flex-1 rounded-[8px]"
          loading={sending}
          disabled={!current || password.length < 6 || password !== repeat}
        >
          Kaydet
        </Button>
      </div>
    </form>
  );
};

const ApprovalCard: FC<{ approval: PortalApproval; onAnswered: () => void }> = ({
  approval,
  onAnswered,
}) => (
  <div className="flex flex-col gap-[12px]">
    <div className="text-[13px] text-textItemBlur">
      {approval.project?.name} · {formatDateTime(approval.createdAt)} tarihinde gönderildi
    </div>
    {approval.posts.map((post) => (
      <div
        key={post.id}
        className="bg-newBgColorInner border border-newTableBorder rounded-[12px] p-[16px] flex flex-col gap-[12px]"
      >
        <div className="flex items-center gap-[10px]">
          <ChannelAvatar channel={post.channel} />
          <div className="flex flex-col min-w-0">
            <div className="text-[14px] font-[600] truncate">{post.channel.name}</div>
            <div className="text-[12px] text-textItemBlur">
              Yayın tarihi: {formatDateTime(post.publishDate)}
            </div>
          </div>
        </div>
        {post.values.map((value, index) => (
          <PostBody key={index} content={value.content} images={value.images} />
        ))}
      </div>
    ))}
    <ApprovalAnswerClient
      url={`/portal/approvals/${approval.id}`}
      status={approval.status}
      note={approval.note}
      // the thanks stay a moment before the design moves to the answered ones
      onAnswered={() => setTimeout(onAnswered, 4000)}
    />
  </div>
);

const ApprovalsTab: FC<{ approvals: PortalApproval[]; onAnswered: () => void }> = ({
  approvals,
  onAnswered,
}) => {
  const waiting = approvals.filter((p) => p.status === 'pending' || p.status === 'outdated');
  const answered = approvals.filter((p) => p.status === 'approved' || p.status === 'revision');

  return (
    <div className="flex flex-col gap-[24px]">
      {!waiting.length ? (
        <div className="bg-newBgColorInner rounded-[12px] p-[24px] text-center text-[15px] text-textItemBlur">
          Onayınızı bekleyen tasarım yok.
        </div>
      ) : (
        waiting.map((approval) => (
          <ApprovalCard key={approval.id} approval={approval} onAnswered={onAnswered} />
        ))
      )}
      {!!answered.length && (
        <div className="flex flex-col gap-[8px]">
          <div className="text-[15px] font-[600]">Önceki cevaplarınız</div>
          {answered.map((approval) => {
            const image = approval.posts
              .flatMap((p) => p.values.flatMap((v) => v.images))
              .find((p) => !isVideo(p));
            return (
              <div
                key={approval.id}
                className="bg-newBgColorInner rounded-[12px] p-[12px] flex gap-[12px] items-start"
              >
                {image ? (
                  <img
                    src={image}
                    alt=""
                    className="w-[56px] h-[56px] rounded-[8px] object-cover shrink-0"
                  />
                ) : (
                  <div className="w-[56px] h-[56px] rounded-[8px] bg-newBgColor shrink-0" />
                )}
                <div className="flex flex-col gap-[4px] min-w-0 flex-1">
                  <div className="flex items-center gap-[8px] flex-wrap">
                    <span
                      className={clsx(
                        'text-[12px] px-[8px] py-[1px] rounded-[4px] text-white',
                        approval.status === 'approved' ? 'bg-[#12B76A]' : 'bg-[#F79009]'
                      )}
                    >
                      {approval.status === 'approved' ? 'Onaylandı' : 'Düzeltme istendi'}
                    </span>
                    <span className="text-[12px] text-textItemBlur">
                      {approval.project?.name}
                      {approval.respondedAt ? ` · ${formatDateTime(approval.respondedAt)}` : ''}
                    </span>
                  </div>
                  <div className="text-[13px] line-clamp-2 break-words">
                    {approval.note
                      ? `“${approval.note}”`
                      : excerpt(approval.posts[0]?.values[0]?.content || '')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const CalendarPost: FC<{ post: PortalPost; projectName?: string }> = ({
  post,
  projectName,
}) => {
  const [open, setOpen] = useState(false);
  const thumbnail = post.images.find((p) => !isVideo(p));
  const date = new Date(post.publishDate);

  return (
    <div className="bg-newBgColorInner rounded-[12px] p-[12px] flex flex-col gap-[12px]">
      <div className="flex gap-[12px] items-start cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="text-[14px] font-[600] w-[44px] shrink-0 pt-[2px]">
          {formatTime(date)}
        </div>
        <div className="flex flex-col gap-[6px] min-w-0 flex-1">
          <div className="flex items-center gap-[8px] min-w-0">
            <ChannelAvatar channel={post.channel} size={24} />
            <span className="text-[13px] font-[500] truncate">{post.channel.name}</span>
            <span
              className={clsx(
                'text-[11px] px-[6px] py-[1px] rounded-[4px] shrink-0',
                post.state === 'published'
                  ? 'bg-[#12B76A] text-white'
                  : 'bg-[#612BD3]/15 text-[#612BD3]'
              )}
            >
              {post.state === 'published' ? 'Yayınlandı' : 'Planlandı'}
            </span>
          </div>
          {!open && (
            <div className="text-[13px] text-textItemBlur line-clamp-2 break-words">
              {excerpt(post.content) || (post.images.length ? 'Görsel paylaşım' : '')}
            </div>
          )}
          {!!projectName && <div className="text-[11px] text-textItemBlur">{projectName}</div>}
        </div>
        {!open &&
          (thumbnail ? (
            <img
              src={thumbnail}
              alt=""
              className="w-[56px] h-[56px] rounded-[8px] object-cover shrink-0"
            />
          ) : post.images.length ? (
            <div className="w-[56px] h-[56px] rounded-[8px] bg-newBgColor shrink-0 flex items-center justify-center text-[11px] text-textItemBlur">
              Video
            </div>
          ) : null)}
      </div>
      {open && (
        <>
          <PostBody content={post.content} images={post.images} />
          {!!post.url && (
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-[#612BD3] hover:underline"
            >
              Paylaşımı aç
            </a>
          )}
        </>
      )}
    </div>
  );
};

const CalendarTab: FC<{ me: PortalMe; projectId?: string }> = ({ me, projectId }) => {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const startDate = month.toISOString();
  const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 1, 0, 0, -1).toISOString();
  const { data: posts, isLoading } = usePortalPosts(startDate, endDate, projectId);

  const days = useMemo(() => {
    const list: { key: string; date: Date; posts: PortalPost[] }[] = [];
    for (const post of posts || []) {
      const date = new Date(post.publishDate);
      const key = dayKey(date);
      const day = list.find((p) => p.key === key);
      if (day) {
        day.posts.push(post);
      } else {
        list.push({ key, date, posts: [post] });
      }
    }
    return list;
  }, [posts]);

  const today = dayKey(new Date());
  const scheduled = (posts || []).filter((p) => p.state === 'scheduled').length;
  const published = (posts || []).length - scheduled;
  const names = new Map(me.projects.map((p) => [p.id, p.name]));

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex items-center justify-between gap-[12px]">
        <div
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="w-[40px] h-[40px] rounded-[10px] bg-newBgColorInner flex items-center justify-center cursor-pointer hover:bg-boxHover text-[18px]"
        >
          ‹
        </div>
        <div className="flex flex-col items-center">
          <div className="text-[16px] font-[600] capitalize">
            {month.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
          </div>
          <div className="text-[12px] text-textItemBlur">
            {scheduled} planlı · {published} yayınlandı
          </div>
        </div>
        <div
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          className="w-[40px] h-[40px] rounded-[10px] bg-newBgColorInner flex items-center justify-center cursor-pointer hover:bg-boxHover text-[18px]"
        >
          ›
        </div>
      </div>
      {isLoading ? (
        <div className="text-center text-textItemBlur py-[24px]">Yükleniyor...</div>
      ) : !days.length ? (
        <div className="bg-newBgColorInner rounded-[12px] p-[24px] text-center text-[15px] text-textItemBlur">
          Bu ay için planlanmış paylaşım yok.
        </div>
      ) : (
        days.map((day) => (
          <div key={day.key} className="flex flex-col gap-[8px]">
            <div className="flex items-center gap-[8px] text-[14px] font-[600]">
              <span className="capitalize">{formatDay(day.date)}</span>
              {day.key === today && (
                <span className="text-[11px] px-[6px] py-[1px] rounded-[4px] bg-[#612BD3] text-white">
                  Bugün
                </span>
              )}
            </div>
            {day.posts.map((post) => (
              <CalendarPost
                key={post.id}
                post={post}
                projectName={
                  !projectId && me.projects.length > 1
                    ? post.projectIds.map((p) => names.get(p)).filter(Boolean).join(', ')
                    : undefined
                }
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
};

const ProjectsTab: FC<{ me: PortalMe; projectId?: string }> = ({ me, projectId }) => (
  <div className="flex flex-col gap-[12px]">
    {me.projects
      .filter((p) => !projectId || p.id === projectId)
      .map((project) => (
        <div
          key={project.id}
          className="bg-newBgColorInner rounded-[12px] p-[16px] flex flex-col gap-[12px] border-t-[4px]"
          style={{ borderTopColor: project.primary || '#612BD3' }}
        >
          <div className="flex items-center gap-[12px]">
            {!!project.logo && (
              <img
                src={project.logo}
                alt={project.name}
                className="h-[40px] max-w-[120px] object-contain"
              />
            )}
            <div className="text-[17px] font-[600]">{project.name}</div>
          </div>
          {!!project.description && (
            <div className="text-[14px] text-textItemBlur whitespace-pre-wrap">
              {project.description}
            </div>
          )}
          {!!project.channels.length && (
            <div className="flex flex-col gap-[8px]">
              <div className="text-[13px] font-[500]">Paylaşım yapılan hesaplar</div>
              {project.channels.map((channel) => (
                <div key={channel.id} className="flex items-center gap-[10px]">
                  <ChannelAvatar channel={channel} size={32} />
                  <span className="text-[14px] truncate">{channel.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
  </div>
);

const REQUEST_STATUS: Record<PortalRequest['status'], [string, string]> = {
  new: ['Alındı', 'bg-[#612BD3]/15 text-[#612BD3]'],
  in_progress: ['Hazırlanıyor', 'bg-[#F79009] text-white'],
  done: ['Tamamlandı', 'bg-[#12B76A] text-white'],
};

interface RequestFile {
  key: string;
  name: string;
  preview: string;
  video: boolean;
  media?: { id: string; path: string };
  failed?: boolean;
}

const RequestForm: FC<{
  me: PortalMe;
  projectId?: string;
  onClose: () => void;
  onSent: () => void;
}> = ({ me, projectId: initialProject, onClose, onSent }) => {
  const fetch = useFetch();
  const toaster = useToaster();
  const [projectId, setProjectId] = useState(initialProject || me.projects[0]?.id || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [wantedDate, setWantedDate] = useState('');
  const [files, setFiles] = useState<RequestFile[]>([]);
  const [sending, setSending] = useState(false);
  const uploading = files.some((p) => !p.media && !p.failed);

  // each file goes up as soon as it is picked, the request only lists them
  const pick = useCallback(
    async (list: FileList | null) => {
      for (const file of Array.from(list || [])) {
        const item: RequestFile = {
          key: `${file.name}-${file.size}-${Math.random()}`,
          name: file.name,
          preview: URL.createObjectURL(file),
          video: file.type.startsWith('video/'),
        };
        setFiles((prev) => [...prev, item]);
        const body = new FormData();
        body.append('file', file);
        const response = await fetch('/portal/upload', { method: 'POST', body }).catch(
          () => undefined
        );
        if (!response?.ok) {
          toaster.show(
            response
              ? await errorMessage(response, `${file.name} yüklenemedi`)
              : `${file.name} yüklenemedi`,
            'warning'
          );
        }
        const media = response?.ok ? await response.json() : undefined;
        setFiles((prev) =>
          prev.map((p) =>
            p.key === item.key ? { ...p, media, failed: !media } : p
          )
        );
      }
    },
    [fetch, toaster]
  );

  const send = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!title.trim() || !projectId || uploading) {
        return;
      }
      setSending(true);
      const response = await fetch('/portal/requests', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          description: description.trim(),
          // noon, so the day stays the same in every time zone
          ...(wantedDate ? { wantedDate: new Date(`${wantedDate}T12:00:00`).toISOString() } : {}),
          mediaIds: files.filter((p) => p.media).map((p) => p.media!.id),
        }),
      });
      setSending(false);
      if (!response.ok) {
        toaster.show(await errorMessage(response, 'Talebiniz gönderilemedi'), 'warning');
        return;
      }
      toaster.show('Talebiniz iletildi', 'success');
      onSent();
    },
    [fetch, toaster, projectId, title, description, wantedDate, files, uploading, onSent]
  );

  return (
    <form
      onSubmit={send}
      className="bg-newBgColorInner border border-newTableBorder rounded-[12px] p-[16px] flex flex-col gap-[12px]"
    >
      <div className="text-[16px] font-[600]">Yeni talep</div>
      {me.projects.length > 1 && (
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className={inputClass}
        >
          {me.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      <input
        value={title}
        maxLength={150}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Ne istiyorsunuz? (ör. Yeni daire tanıtım paylaşımı)"
        className={inputClass}
      />
      <textarea
        value={description}
        maxLength={4000}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Detaylar: metinde ne yazsın, nelere dikkat edelim..."
        className="w-full min-h-[110px] px-[14px] py-[10px] rounded-[10px] bg-newBgColor border border-newColColor text-[15px] outline-none focus:border-[#612BD3]"
      />
      <label className="flex flex-col gap-[6px]">
        <span className="text-[13px] text-textItemBlur">Ne zaman paylaşılsın? (isteğe bağlı)</span>
        <input
          type="date"
          value={wantedDate}
          onChange={(e) => setWantedDate(e.target.value)}
          className={inputClass}
        />
      </label>
      <div className="flex flex-col gap-[8px]">
        <span className="text-[13px] text-textItemBlur">Fotoğraf / video (isteğe bağlı)</span>
        <div className="flex gap-[8px] flex-wrap">
          {files.map((file) => (
            <div
              key={file.key}
              className="relative w-[72px] h-[72px] rounded-[8px] overflow-hidden bg-newBgColor"
            >
              {file.video ? (
                <video src={file.preview} className="w-full h-full object-cover" muted={true} />
              ) : (
                <img src={file.preview} alt={file.name} className="w-full h-full object-cover" />
              )}
              {!file.media && (
                <div className="absolute inset-0 bg-black/50 text-white text-[11px] flex items-center justify-center text-center px-[4px]">
                  {file.failed ? 'Yüklenemedi' : 'Yükleniyor...'}
                </div>
              )}
              {(!!file.media || file.failed) && (
                <div
                  onClick={() => setFiles((prev) => prev.filter((p) => p.key !== file.key))}
                  className="absolute top-[2px] end-[2px] w-[20px] h-[20px] rounded-full bg-black/60 text-white text-[12px] flex items-center justify-center cursor-pointer"
                >
                  ×
                </div>
              )}
            </div>
          ))}
          <label className="w-[72px] h-[72px] rounded-[8px] border border-dashed border-newColColor flex items-center justify-center text-[28px] text-textItemBlur cursor-pointer hover:bg-boxHover">
            +
            <input
              type="file"
              multiple={true}
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                pick(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>
      <div className="flex gap-[8px]">
        <Button type="button" secondary={true} className="flex-1 rounded-[8px]" onClick={onClose}>
          Vazgeç
        </Button>
        <Button
          type="submit"
          className="flex-1 rounded-[8px]"
          loading={sending}
          disabled={!title.trim() || !projectId || uploading}
        >
          {uploading ? 'Dosyalar yükleniyor...' : 'Gönder'}
        </Button>
      </div>
    </form>
  );
};

const RequestsTab: FC<{ me: PortalMe; projectId?: string }> = ({ me, projectId }) => {
  const { data: requests, isLoading, mutate } = usePortalRequests();
  const [creating, setCreating] = useState(false);
  const list = (requests || []).filter((p) => !projectId || p.projectId === projectId);

  return (
    <div className="flex flex-col gap-[12px]">
      {creating ? (
        <RequestForm
          me={me}
          projectId={projectId}
          onClose={() => setCreating(false)}
          onSent={() => {
            setCreating(false);
            mutate();
          }}
        />
      ) : (
        <Button className="rounded-[10px] h-[48px]" onClick={() => setCreating(true)}>
          + Yeni talep oluştur
        </Button>
      )}
      {isLoading ? (
        <div className="text-center text-textItemBlur py-[24px]">Yükleniyor...</div>
      ) : !list.length ? (
        !creating && (
          <div className="bg-newBgColorInner rounded-[12px] p-[24px] text-center text-[15px] text-textItemBlur">
            Paylaşılmasını istediğiniz bir şey mi var? Fotoğraflarıyla birlikte buradan iletin.
          </div>
        )
      ) : (
        list.map((request) => (
          <div
            key={request.id}
            className="bg-newBgColorInner rounded-[12px] p-[14px] flex flex-col gap-[8px]"
          >
            <div className="flex items-start gap-[8px]">
              <div className="flex flex-col min-w-0 flex-1">
                <div className="text-[15px] font-[600] break-words">{request.title}</div>
                <div className="text-[12px] text-textItemBlur">
                  {me.projects.length > 1 ? `${request.projectName} · ` : ''}
                  {formatDateTime(request.createdAt)}
                </div>
              </div>
              <span
                className={clsx(
                  'text-[12px] px-[8px] py-[1px] rounded-[4px] shrink-0',
                  REQUEST_STATUS[request.status][1]
                )}
              >
                {REQUEST_STATUS[request.status][0]}
              </span>
            </div>
            {!!request.description && (
              <div className="text-[14px] whitespace-pre-wrap break-words">{request.description}</div>
            )}
            {!!request.wantedDate && (
              <div className="text-[13px] text-textItemBlur">
                İstenen tarih:{' '}
                {new Date(request.wantedDate).toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
            )}
            {!!request.media.length && (
              <div className="flex gap-[6px] flex-wrap">
                {request.media.map((media) => (
                  <a key={media.id} href={media.path} target="_blank" rel="noopener noreferrer">
                    {isVideo(media.path) && !media.thumbnail ? (
                      <div className="w-[56px] h-[56px] rounded-[8px] bg-newBgColor flex items-center justify-center text-[11px] text-textItemBlur">
                        Video
                      </div>
                    ) : (
                      <img
                        src={media.thumbnail || media.path}
                        alt=""
                        className="w-[56px] h-[56px] rounded-[8px] object-cover"
                      />
                    )}
                  </a>
                ))}
              </div>
            )}
            {!!request.reply && (
              <div className="bg-newBgColor rounded-[8px] p-[10px] text-[14px] whitespace-pre-wrap break-words">
                <div className="text-[12px] text-textItemBlur mb-[2px]">{me.agency}</div>
                {request.reply}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

const PortalHome: FC<{ me: PortalMe }> = ({ me }) => {
  const fetch = useFetch();
  const { data: approvals, mutate } = usePortalApprovals();
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<'approvals' | 'calendar' | 'requests' | 'projects' | ''>('');
  const [changingPassword, setChangingPassword] = useState(false);

  const filtered = (approvals || []).filter((p) => !projectId || p.projectId === projectId);
  const waiting = filtered.filter((p) => p.status === 'pending' || p.status === 'outdated').length;
  // the designs come first when some wait for an answer as the panel opens
  useEffect(() => {
    if (!tab && approvals !== undefined) {
      setTab(waiting ? 'approvals' : 'calendar');
    }
  }, [tab, approvals, waiting]);
  const current = tab;
  const single = me.projects.length === 1 ? me.projects[0] : undefined;

  // a fresh page, nothing of this customer stays for the next one
  const signOut = useCallback(async () => {
    await fetch('/public/portal/logout', { method: 'POST' });
    window.location.href = '/musteri';
  }, [fetch]);

  return (
    <div className="mx-auto w-full max-w-[720px] px-[16px] py-[20px] flex flex-col gap-[16px]">
      <div className="flex items-center gap-[12px] bg-newBgColorInner rounded-[12px] px-[16px] py-[12px]">
        {!!single?.logo && (
          <img
            src={single.logo}
            alt={single.name}
            className="h-[40px] max-w-[110px] object-contain shrink-0"
          />
        )}
        <div className="flex flex-col min-w-0 flex-1">
          <div className="text-[16px] font-[600] truncate">Merhaba, {me.name}</div>
          <div className="text-[13px] text-textItemBlur truncate">{me.agency} müşteri paneli</div>
        </div>
        <div className="flex flex-col items-end gap-[2px] text-[13px] shrink-0">
          <span
            className="cursor-pointer text-textItemBlur hover:text-newTextColor"
            onClick={() => setChangingPassword(!changingPassword)}
          >
            Şifre değiştir
          </span>
          <span className="cursor-pointer text-textItemBlur hover:text-[#F97066]" onClick={signOut}>
            Çıkış
          </span>
        </div>
      </div>

      {changingPassword && <PasswordForm onClose={() => setChangingPassword(false)} />}

      {me.projects.length > 1 && (
        <div className="flex gap-[6px] overflow-x-auto pb-[2px]">
          {[{ id: undefined, name: 'Tüm projeler' }, ...me.projects].map((project) => (
            <div
              key={project.id || 'all'}
              onClick={() => setProjectId(project.id)}
              className={clsx(
                'h-[34px] px-[12px] flex items-center rounded-[8px] cursor-pointer text-[13px] whitespace-nowrap border',
                projectId === project.id
                  ? 'bg-[#612BD3] text-white border-[#612BD3]'
                  : 'border-newColColor hover:bg-boxHover'
              )}
            >
              {project.name}
            </div>
          ))}
        </div>
      )}

      {!me.projects.length ? (
        <div className="bg-newBgColorInner rounded-[12px] p-[24px] text-center text-[15px] text-textItemBlur">
          Hesabınıza henüz bir proje bağlanmadı.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-[4px] bg-newBgColorInner rounded-[12px] p-[4px] sticky top-[8px] z-[10]">
            {(
              [
                ['approvals', 'Onaylar'],
                ['calendar', 'Takvim'],
                ['requests', 'Talepler'],
                ['projects', 'Projeler'],
              ] as const
            ).map(([value, label]) => (
              <div
                key={value}
                onClick={() => setTab(value)}
                className={clsx(
                  'h-[40px] rounded-[9px] flex items-center justify-center gap-[4px] cursor-pointer text-[14px] mobile:text-[13px]',
                  current === value ? 'bg-[#612BD3] text-white' : 'hover:bg-boxHover'
                )}
              >
                {label}
                {value === 'approvals' && !!waiting && (
                  <span
                    className={clsx(
                      'min-w-[20px] h-[20px] px-[5px] rounded-full text-[12px] flex items-center justify-center',
                      current === value ? 'bg-white text-[#612BD3]' : 'bg-[#F97066] text-white'
                    )}
                  >
                    {waiting}
                  </span>
                )}
              </div>
            ))}
          </div>

          {current === 'approvals' && (
            <ApprovalsTab approvals={filtered} onAnswered={() => mutate()} />
          )}
          {current === 'calendar' && <CalendarTab me={me} projectId={projectId} />}
          {current === 'requests' && <RequestsTab me={me} projectId={projectId} />}
          {current === 'projects' && <ProjectsTab me={me} projectId={projectId} />}
        </>
      )}
    </div>
  );
};

export const PortalComponent = () => {
  const { data: me, isLoading, mutate } = usePortalMe();

  if (isLoading || me === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-textItemBlur">
        Yükleniyor...
      </div>
    );
  }

  if (!me) {
    return <PortalLogin onSignedIn={() => mutate()} />;
  }

  return <PortalHome me={me} />;
};
