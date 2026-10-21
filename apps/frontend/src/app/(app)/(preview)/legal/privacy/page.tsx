import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_SITE_NAME,
  LEGAL_SITE_URL,
  LEGAL_UPDATED_AT,
} from '@gitroom/frontend/components/legal/legal.constants';

export const metadata = {
  title: `Gizlilik Politikası - ${LEGAL_SITE_NAME}`,
};

export default function Page() {
  return (
    <>
      <h1>Gizlilik Politikası</h1>
      <div className="text-textItemBlur">Son güncelleme: {LEGAL_UPDATED_AT}</div>

      <p>
        Bu gizlilik politikası, {LEGAL_SITE_NAME} ({LEGAL_SITE_URL}) sosyal medya
        yönetim platformunu kullandığınızda hangi kişisel verilerin toplandığını,
        nasıl kullanıldığını ve haklarınızı açıklar. Kişisel verileriniz 6698
        sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ve ilgili mevzuata uygun
        olarak işlenir.
      </p>

      <h2>1. Topladığımız veriler</h2>
      <ul>
        <li>
          <strong>Hesap bilgileri:</strong> ad, e-posta adresi ve oturum açma
          bilgileri.
        </li>
        <li>
          <strong>Bağlı sosyal medya hesapları:</strong> Facebook sayfası,
          Instagram, YouTube gibi bağladığınız hesapların adı, kimliği, profil
          resmi ve bu platformların verdiği erişim anahtarları (token).
        </li>
        <li>
          <strong>İçerik:</strong> oluşturduğunuz, planladığınız veya
          yayınladığınız gönderiler, yorumlar ve yüklediğiniz görsel ve videolar.
        </li>
        <li>
          <strong>Reklam verileri:</strong> bağladığınız Meta reklam hesaplarının
          adı ve para birimi, platform üzerinden oluşturduğunuz reklamların
          kampanya bilgileri, bütçesi ve harcama, erişim, gösterim, tıklama gibi
          performans istatistikleri.
        </li>
        <li>
          <strong>Analiz verileri:</strong> bağlı hesaplarınızın ve
          gönderilerinizin platformlardan alınan istatistikleri.
        </li>
        <li>
          <strong>Teknik veriler:</strong> IP adresi, tarayıcı bilgisi ve
          hizmetin güvenliği için tutulan kayıtlar.
        </li>
      </ul>

      <h2>2. Verileri nasıl kullanıyoruz</h2>
      <ul>
        <li>Gönderilerinizi sizin adınıza planlamak ve yayınlamak,</li>
        <li>İstediğinizde yayınlanmış gönderileri platformlardan silmek,</li>
        <li>
          İstediğinizde gönderilerinizi reklam olarak öne çıkarmak ve
          reklamlarınızı yönetmek,
        </li>
        <li>Hesaplarınızın ve reklamlarınızın istatistiklerini göstermek,</li>
        <li>Hizmeti çalıştırmak, güvenliğini sağlamak ve hataları gidermek.</li>
      </ul>
      <p>
        Verilerinizi satmıyoruz ve reklam amacıyla üçüncü kişilerle
        paylaşmıyoruz.
      </p>

      <h2>3. Meta (Facebook ve Instagram) verileri</h2>
      <p>
        Facebook ve Instagram hesaplarınızı bağladığınızda, Meta&apos;nın
        izninizle verdiği verilere yalnızca sizin başlattığınız işlemler için
        erişiriz: sayfa ve hesap listeniz, gönderi yayınlama ve silme, yorumlar,
        istatistikler ve reklam hesabı yönetimi. Bu veriler Meta Platform
        Koşulları&apos;na uygun olarak kullanılır ve başka bir amaçla işlenmez.
      </p>

      <h2>4. Verilerin paylaşılması</h2>
      <p>Verileriniz yalnızca hizmetin çalışması için gereken taraflarla paylaşılır:</p>
      <ul>
        <li>
          Bağladığınız sosyal medya platformları (Meta, Google/YouTube vb.):
          gönderi yayınlama, silme ve reklam oluşturma işlemleri için,
        </li>
        <li>Altyapı ve barındırma hizmeti sağlayıcıları,</li>
        <li>Yasal bir zorunluluk olduğunda yetkili kurumlar.</li>
      </ul>

      <h2>5. Saklama süresi ve güvenlik</h2>
      <p>
        Verileriniz hesabınız açık kaldığı sürece saklanır. Bir hesabın
        bağlantısını kaldırdığınızda o hesaba ait erişim anahtarı silinir.
        Hesabınızı sildiğinizde verileriniz en geç 30 gün içinde silinir; yasal
        olarak saklanması gereken kayıtlar bu süreden muaftır. Verileriniz
        erişimi kısıtlı sunucularda, şifreli bağlantılar (HTTPS) üzerinden
        işlenir.
      </p>

      <h2>6. Haklarınız</h2>
      <p>KVKK&apos;nın 11. maddesi kapsamında şu haklara sahipsiniz:</p>
      <ul>
        <li>Verilerinizin işlenip işlenmediğini öğrenme ve bilgi talep etme,</li>
        <li>Eksik veya yanlış verilerin düzeltilmesini isteme,</li>
        <li>Verilerinizin silinmesini veya yok edilmesini isteme,</li>
        <li>İşlemeye itiraz etme ve zarara uğramanız hâlinde tazminat talep etme.</li>
      </ul>
      <p>
        Verilerinizin silinmesi için{' '}
        <a href="/legal/data-deletion">Veri Silme Talimatları</a> sayfasına
        bakabilirsiniz.
      </p>

      <h2>7. İletişim</h2>
      <p>
        Bu politika veya verilerinizle ilgili sorularınız için:{' '}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
      </p>

      <h2>8. Değişiklikler</h2>
      <p>
        Bu politikayı zaman zaman güncelleyebiliriz. Güncel sürüm her zaman bu
        sayfada yayınlanır.
      </p>
    </>
  );
}
