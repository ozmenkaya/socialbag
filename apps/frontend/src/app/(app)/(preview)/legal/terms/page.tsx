import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_SITE_NAME,
  LEGAL_SITE_URL,
  LEGAL_UPDATED_AT,
} from '@gitroom/frontend/components/legal/legal.constants';

export const metadata = {
  title: `Kullanım Şartları - ${LEGAL_SITE_NAME}`,
};

export default function Page() {
  return (
    <>
      <h1>Kullanım Şartları</h1>
      <div className="text-textItemBlur">Son güncelleme: {LEGAL_UPDATED_AT}</div>

      <p>
        Bu şartlar, {LEGAL_SITE_NAME} ({LEGAL_SITE_URL}) platformunu
        kullanımınızı düzenler. Platformu kullanarak bu şartları kabul etmiş
        olursunuz.
      </p>

      <h2>1. Hizmet</h2>
      <p>
        {LEGAL_SITE_NAME}; sosyal medya hesaplarınızı bağlamanızı, gönderi
        planlamanızı ve yayınlamanızı, yayınlanmış gönderileri yönetmenizi,
        istatistikleri görmenizi ve bağladığınız reklam hesaplarıyla
        gönderilerinizi öne çıkarmanızı sağlayan bir sosyal medya yönetim
        platformudur.
      </p>

      <h2>2. Hesabınız</h2>
      <ul>
        <li>Hesap bilgilerinizin doğru olmasından ve gizliliğinden siz sorumlusunuz.</li>
        <li>
          Yalnızca yönetme yetkiniz olan sosyal medya hesaplarını ve reklam
          hesaplarını bağlayabilirsiniz.
        </li>
        <li>Hesabınızda yapılan işlemlerden siz sorumlusunuz.</li>
      </ul>

      <h2>3. İçerik ve sorumluluk</h2>
      <ul>
        <li>Platform üzerinden paylaştığınız içeriğin tüm sorumluluğu size aittir.</li>
        <li>
          İçeriğiniz; yürürlükteki mevzuata ve bağladığınız platformların
          (Meta, Google/YouTube vb.) kurallarına uygun olmalıdır.
        </li>
        <li>
          Hukuka aykırı, yanıltıcı, başkalarının haklarını ihlal eden veya
          istenmeyen (spam) içerik paylaşmak yasaktır.
        </li>
      </ul>

      <h2>4. Reklamlar ve ödemeler</h2>
      <ul>
        <li>
          Platform üzerinden oluşturulan reklamlar, bağladığınız reklam hesabında
          ve o hesabın ödeme yöntemiyle oluşturulur. Reklam harcamaları
          doğrudan ilgili platform (ör. Meta) tarafından faturalandırılır.
        </li>
        <li>
          Reklamlar duraklatılmış olarak oluşturulur ve siz başlatmadan harcama
          yapılmaz. Başlattığınız reklamların bütçesinden ve içeriğinden siz
          sorumlusunuz.
        </li>
        <li>
          Reklamlar, ilgili platformun reklam politikalarına ve onay sürecine
          tabidir.
        </li>
      </ul>

      <h2>5. Üçüncü taraf platformlar</h2>
      <p>
        Hizmet, bağladığınız platformların arayüzlerine (API) dayanır. Bu
        platformların kesintilerinden, kural değişikliklerinden veya
        hesabınıza uyguladıkları kısıtlamalardan {LEGAL_SITE_NAME} sorumlu
        değildir.
      </p>

      <h2>6. Hizmetin değiştirilmesi ve sonlandırılması</h2>
      <p>
        Hizmeti geliştirebilir, değiştirebilir veya bu şartları ihlal eden
        hesapları askıya alabiliriz. Hesabınızı istediğiniz zaman
        kapatabilirsiniz.
      </p>

      <h2>7. Sorumluluğun sınırlandırılması</h2>
      <p>
        Hizmet &quot;olduğu gibi&quot; sunulur. Yasaların izin verdiği ölçüde,
        hizmetin kullanımından doğan dolaylı zararlardan {LEGAL_SITE_NAME}{' '}
        sorumlu tutulamaz.
      </p>

      <h2>8. Gizlilik</h2>
      <p>
        Kişisel verileriniz <a href="/legal/privacy">Gizlilik Politikası</a>{' '}
        kapsamında işlenir.
      </p>

      <h2>9. Uygulanacak hukuk</h2>
      <p>
        Bu şartlar Türkiye Cumhuriyeti hukukuna tabidir.
      </p>

      <h2>10. İletişim</h2>
      <p>
        Sorularınız için:{' '}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
      </p>
    </>
  );
}
