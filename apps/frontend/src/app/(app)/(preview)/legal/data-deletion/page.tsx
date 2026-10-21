import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_SITE_NAME,
  LEGAL_UPDATED_AT,
} from '@gitroom/frontend/components/legal/legal.constants';

export const metadata = {
  title: `Veri Silme Talimatları - ${LEGAL_SITE_NAME}`,
};

export default function Page() {
  return (
    <>
      <h1>Veri Silme Talimatları</h1>
      <div className="text-textItemBlur">Son güncelleme: {LEGAL_UPDATED_AT}</div>

      <p>
        {LEGAL_SITE_NAME}&apos;da saklanan verilerinizin silinmesini aşağıdaki
        yollardan biriyle isteyebilirsiniz.
      </p>

      <h2>1. Bağlı bir hesabı kaldırmak</h2>
      <ol>
        <li>{LEGAL_SITE_NAME}&apos;a giriş yapın.</li>
        <li>
          Kanallar listesinde kaldırmak istediğiniz hesabın menüsünü (⋮) açıp
          bağlantıyı kaldırın.
        </li>
        <li>
          Reklam hesapları için <strong>Ayarlar → Reklam Hesapları</strong>{' '}
          bölümünden bağlantıyı kaldırın.
        </li>
      </ol>
      <p>Bağlantı kaldırıldığında o hesaba ait erişim anahtarı silinir.</p>

      <h2>2. Facebook ayarlarından uygulamayı kaldırmak</h2>
      <ol>
        <li>
          Facebook&apos;ta <strong>Ayarlar ve gizlilik → Ayarlar → Uygulamalar ve
          internet siteleri</strong> bölümüne gidin.
        </li>
        <li>{LEGAL_SITE_NAME} uygulamasını bulup <strong>Kaldır</strong>&apos;a basın.</li>
      </ol>
      <p>
        Bu işlem uygulamanın Facebook ve Instagram verilerinize erişimini
        sonlandırır.
      </p>

      <h2>3. Tüm verilerinizin silinmesini istemek</h2>
      <p>
        Hesabınızın ve tüm verilerinizin silinmesi için{' '}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}?subject=Veri%20silme%20talebi`}>
          {LEGAL_CONTACT_EMAIL}
        </a>{' '}
        adresine, hesabınızda kayıtlı e-posta adresinden &quot;Veri silme
        talebi&quot; konulu bir e-posta gönderin.
      </p>
      <p>
        Talebiniz doğrulandıktan sonra hesabınız, bağlı hesaplarınıza ait erişim
        anahtarları, gönderileriniz, medya dosyalarınız ve reklam kayıtlarınız en
        geç 30 gün içinde silinir ve size bilgi verilir. Yasal olarak saklanması
        zorunlu kayıtlar bu kapsamın dışındadır.
      </p>
      <p>
        Not: Sosyal medya platformlarında zaten yayınlanmış gönderiler ve
        reklam hesabınızdaki kampanyalar o platformlarda kalır; bunları
        platformların kendi araçlarıyla silebilirsiniz.
      </p>
    </>
  );
}
