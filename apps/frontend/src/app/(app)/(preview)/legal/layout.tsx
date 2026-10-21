import { ReactNode } from 'react';

export default async function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-newBgColor min-h-screen text-newTextColor">
      <div className="max-w-[820px] mx-auto px-[20px] py-[48px] flex flex-col gap-[16px] leading-[1.7] text-[15px] [&_h1]:text-[28px] [&_h1]:font-[600] [&_h2]:text-[19px] [&_h2]:font-[600] [&_h2]:mt-[16px] [&_ul]:list-disc [&_ul]:ps-[24px] [&_ol]:list-decimal [&_ol]:ps-[24px] [&_a]:underline">
        {children}
        <div className="mt-[32px] text-[13px] text-textItemBlur flex gap-[16px] flex-wrap">
          <a href="/legal/privacy">Gizlilik Politikası</a>
          <a href="/legal/terms">Kullanım Şartları</a>
          <a href="/legal/data-deletion">Veri Silme Talimatları</a>
        </div>
      </div>
    </div>
  );
}
