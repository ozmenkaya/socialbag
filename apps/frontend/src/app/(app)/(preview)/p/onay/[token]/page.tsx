import { internalFetch } from '@gitroom/helpers/utils/internal.fetch';
import { sanitizePostContent } from '@gitroom/helpers/utils/sanitize.post.content';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { VideoOrImage } from '@gitroom/react/helpers/video.or.image';
import { RenderPreviewDateClient } from '@gitroom/frontend/components/preview/render.preview.date.client';
import { ApprovalAnswerClient } from '@gitroom/frontend/components/preview/approval.answer.client';

const loadApproval = async (token: string) => {
  const response = await internalFetch(`/public/approvals/${encodeURIComponent(token)}`);
  return response.ok ? response.json() : null;
};

// the link sent on WhatsApp shows the design as its preview
export async function generateMetadata(props: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await props.params;
  const approval = await loadApproval(token);
  const image = approval?.posts
    ?.flatMap((p: any) => p.values.flatMap((v: any) => v.images))
    .find((p: string) => !/\.(mp4|mov|webm)$/i.test(p));

  const title = approval?.project?.name
    ? `${approval.project.name} · Tasarım onayı`
    : 'Tasarım onayı';
  return {
    title,
    description: 'Yayınlanmadan önce tasarımı inceleyip onaylayın.',
    openGraph: {
      title,
      description: 'Yayınlanmadan önce tasarımı inceleyip onaylayın.',
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ApprovalPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const approval = await loadApproval(token);

  if (!approval) {
    return (
      <div className="fixed start-0 top-0 w-full h-full flex justify-center items-center text-center px-[20px] text-[18px]">
        Bu onay linki bulunamadı ya da yerine yenisi gönderildi.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[640px] px-[16px] py-[20px] flex flex-col gap-[12px]">
      <div className="flex items-center gap-[12px] bg-newBgColorInner rounded-[12px] px-[16px] py-[12px]">
        {!!approval.project?.logo && (
          <img
            src={approval.project.logo}
            alt={approval.project.name}
            className="h-[40px] max-w-[120px] object-contain"
          />
        )}
        <div className="flex flex-col">
          <div className="text-[16px] font-[600]">Tasarım onayı</div>
          {!!approval.project?.name && (
            <div className="text-[13px] text-textItemBlur">{approval.project.name}</div>
          )}
        </div>
      </div>

      {approval.posts.map((post: any) => (
        <div
          key={post.id}
          className="bg-newBgColorInner border border-newTableBorder rounded-[12px] p-[16px] flex flex-col gap-[12px]"
        >
          <div className="flex items-center gap-[10px]">
            <div className="relative w-[40px] h-[40px] shrink-0">
              <img
                className="w-full h-full bg-newBgColor rounded-full"
                alt={post.channel.name}
                src={post.channel.picture}
              />
              <img
                className="absolute -end-[4px] -bottom-[4px] w-[20px] h-[20px] bg-newBgColor rounded-full"
                alt={post.channel.platform}
                src={`/icons/platforms/${post.channel.platform}.png`}
              />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="text-[14px] font-[600] truncate">{post.channel.name}</div>
              <div className="text-[12px] text-textItemBlur">
                Yayın tarihi: <RenderPreviewDateClient date={post.publishDate} />
              </div>
            </div>
          </div>
          {post.values.map((value: any, index: number) => (
            <div key={index} className="flex flex-col gap-[12px]">
              {!!value.images.length && (
                <div className="flex flex-col gap-[8px]">
                  {value.images.map((image: string) => (
                    <div key={image} className="rounded-[10px] overflow-hidden">
                      <VideoOrImage isContain={true} src={image} autoplay={true} />
                    </div>
                  ))}
                </div>
              )}
              {!!value.content && (
                <div
                  className="text-[14px] whitespace-pre-wrap break-words"
                  dangerouslySetInnerHTML={{
                    __html: sanitizePostContent(value.content),
                  }}
                />
              )}
            </div>
          ))}
        </div>
      ))}

      <ApprovalAnswerClient
        token={token}
        status={approval.status}
        note={approval.note}
      />
    </div>
  );
}
