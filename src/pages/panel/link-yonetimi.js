import { useState, useEffect } from 'react';
import { ref, get, set, push, remove, onValue } from 'firebase/database';
import { realdb } from '../../firebase/config';
import { toast } from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

export default function LinkYonetimiPage() {
  const [linkler, setLinkler] = useState([]);
  const [formlar, setFormlar] = useState([]);
  const [subeler, setSubeler] = useState({});
  const [loading, setLoading] = useState(true);
  const [yeniLinkModal, setYeniLinkModal] = useState(false);
  const [seciliLink, setSeciliLink] = useState(null);
  const [yeniLink, setYeniLink] = useState({
    formId: '',
    hedefSube: '',
    baslangicTarihi: '',
    bitisTarihi: '',
    baslangicSaati: '09:00',
    bitisSaati: '18:00',
    aciklama: ''
  });

  // Formları yükle
  useEffect(() => {
    const fetchFormlar = async () => {
      try {
        const snapshot = await get(ref(realdb, 'denetimFormlari'));
        if (snapshot.exists()) {
          const data = snapshot.val();
          const formlarArray = Object.entries(data).map(([id, form]) => ({
            id,
            ...form
          }));
          setFormlar(formlarArray);
        }
      } catch (error) {
        console.error('Formlar yüklenirken hata:', error);
        toast.error('Formlar yüklenemedi');
      }
    };

    // Şubeleri yükle
    const fetchSubeler = async () => {
      try {
        const snapshot = await get(ref(realdb, 'branches'));
        if (snapshot.exists()) {
          const data = snapshot.val();
          const aktifSubeler = {};
          Object.entries(data).forEach(([id, sube]) => {
            if (sube.isActive) {
              aktifSubeler[id] = sube;
            }
          });
          setSubeler(aktifSubeler);
        }
      } catch (error) {
        console.error('Şubeler yüklenirken hata:', error);
        toast.error('Şubeler yüklenemedi');
      }
    };

    // Linkleri yükle
    const fetchLinkler = async () => {
      try {
        const linklerRef = ref(realdb, 'denetimLinkleri');
        const unsubscribe = onValue(linklerRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            const linklerArray = Object.entries(data).map(([id, link]) => ({
              id,
              ...link
            })).sort((a, b) => new Date(b.olusturmaTarihi) - new Date(a.olusturmaTarihi));
            setLinkler(linklerArray);
          } else {
            setLinkler([]);
          }
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Linkler yüklenirken hata:', error);
        toast.error('Linkler yüklenemedi');
        setLoading(false);
      }
    };

    fetchFormlar();
    fetchSubeler();
    fetchLinkler();
  }, []);

  // Yeni link oluştur
  const handleLinkOlustur = async () => {
    try {
      // Validasyon
      if (!yeniLink.formId || !yeniLink.hedefSube || !yeniLink.baslangicTarihi || 
          !yeniLink.bitisTarihi) {
        toast.error('Lütfen tüm zorunlu alanları doldurun');
        return;
      }

      // Tarih kontrolü
      const baslangic = new Date(`${yeniLink.baslangicTarihi}T${yeniLink.baslangicSaati}`);
      const bitis = new Date(`${yeniLink.bitisTarihi}T${yeniLink.bitisSaati}`);
      
      if (baslangic >= bitis) {
        toast.error('Bitiş tarihi başlangıç tarihinden sonra olmalıdır');
        return;
      }

      const linklerRef = ref(realdb, 'denetimLinkleri');
      const yeniLinkRef = push(linklerRef);
      
      const linkData = {
        ...yeniLink,
        id: yeniLinkRef.key,
        olusturmaTarihi: new Date().toISOString(),
        kullanildi: false,
        denetimId: null,
        durum: 'aktif'
      };

      await set(yeniLinkRef, linkData);
      
      toast.success('Link başarıyla oluşturuldu');
      setYeniLinkModal(false);
      setYeniLink({
        formId: '',
        hedefSube: '',
        baslangicTarihi: '',
        bitisTarihi: '',
        baslangicSaati: '09:00',
        bitisSaati: '18:00',
        aciklama: ''
      });
    } catch (error) {
      console.error('Link oluşturulurken hata:', error);
      toast.error('Link oluşturulamadı');
    }
  };

  // Link sil
  const handleLinkSil = async (linkId) => {
    try {
      await remove(ref(realdb, `denetimLinkleri/${linkId}`));
      toast.success('Link başarıyla silindi');
    } catch (error) {
      console.error('Link silinirken hata:', error);
      toast.error('Link silinemedi');
    }
  };

  // Link durumunu kontrol et
  const getLinkDurumu = (link) => {
    const simdi = new Date();
    const baslangic = new Date(`${link.baslangicTarihi}T${link.baslangicSaati}`);
    const bitis = new Date(`${link.bitisTarihi}T${link.bitisSaati}`);

    if (link.kullanildi) {
      return { durum: 'kullanildi', text: 'Kullanıldı', renk: 'bg-green-100 text-green-800' };
    } else if (simdi < baslangic) {
      return { durum: 'bekliyor', text: 'Bekliyor', renk: 'bg-blue-100 text-blue-800' };
    } else if (simdi >= baslangic && simdi <= bitis) {
      return { durum: 'aktif', text: 'Aktif', renk: 'bg-green-100 text-green-800' };
    } else {
      return { durum: 'suresi-doldu', text: 'Süresi Doldu', renk: 'bg-red-100 text-red-800' };
    }
  };

  // Link kopyala
  const linkKopyala = async (linkId) => {
    try {
      const link = `${window.location.origin}/denetim-yap/${linkId}`;
      await navigator.clipboard.writeText(link);
      toast.success('Link kopyalandı');
    } catch (error) {
      console.error('Link kopyalanırken hata:', error);
      toast.error('Link kopyalanamadı');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-red-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Üst Kısım */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg mb-6">
          <div className="relative p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-red-600">
                  Denetim Link Yönetimi
                </h1>
                <p className="mt-2 text-gray-600">Denetim linklerini oluşturun ve takip edin</p>
              </div>
              <button
                onClick={() => setYeniLinkModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors duration-200 shadow-sm hover:shadow"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Yeni Link Oluştur
              </button>
            </div>
          </div>
        </div>

        {/* Link Listesi */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {linkler.map((link) => {
            const durum = getLinkDurumu(link);
            const form = formlar.find(f => f.id === link.formId);
            const sube = subeler[link.hedefSube];
            
            return (
              <div key={link.id} className="bg-white/90 backdrop-blur-xl rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
                {/* Kart Başlığı */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {link.denetimciAdi || 'Belirlenmedi'}
                    </h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${durum.renk}`}>
                      {durum.text}
                    </span>
                  </div>
                                     <div className="space-y-2 text-sm text-gray-600">
                     <p><strong>Form:</strong> {form?.baslik || 'Bilinmeyen Form'}</p>
                     <p><strong>Şube:</strong> {sube?.name || 'Bilinmeyen Şube'}</p>
                     {link.denetimciTelefon && <p><strong>Telefon:</strong> {link.denetimciTelefon}</p>}
                     {link.denetimciEmail && <p><strong>E-posta:</strong> {link.denetimciEmail}</p>}
                     {link.kullanilmaTarihi && (
                       <p><strong>Kullanım:</strong> {new Date(link.kullanilmaTarihi).toLocaleDateString('tr-TR')} {new Date(link.kullanilmaTarihi).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
                     )}
                   </div>
                </div>

                {/* Zaman Bilgileri */}
                <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-gray-600">
                        {new Date(link.baslangicTarihi).toLocaleDateString('tr-TR')} - {new Date(link.bitisTarihi).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-gray-600">
                        {link.baslangicSaati} - {link.bitisSaati}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Kart Alt Kısmı */}
                <div className="p-6 flex items-center gap-2">
                  <button
                    onClick={() => linkKopyala(link.id)}
                    className="flex items-center justify-center flex-1 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-200"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Kopyala
                  </button>
                                     <button
                     onClick={() => setSeciliLink(link)}
                     className="flex items-center justify-center flex-1 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-all duration-200"
                   >
                     <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                     </svg>
                     QR Kod
                   </button>
                   {link.denetimId && (
                     <a
                       href={`/panel/denetim/${link.denetimId}`}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="flex items-center justify-center flex-1 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all duration-200"
                     >
                       <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                       </svg>
                       Denetim
                     </a>
                   )}
                  <button
                    onClick={() => handleLinkSil(link.id)}
                    className="flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-red-600 bg-white hover:bg-red-50 rounded-lg transition-all duration-200 border border-gray-200"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Link bulunamadı */}
        {linkler.length === 0 && (
          <div className="bg-white/90 backdrop-blur-xl rounded-xl shadow p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-red-50 flex items-center justify-center">
              <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Henüz Link Oluşturulmamış</h3>
            <p className="text-sm text-gray-500 mb-6">İlk denetim linkinizi oluşturmak için yukarıdaki butona tıklayın.</p>
            <button
              onClick={() => setYeniLinkModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors duration-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              İlk Linki Oluştur
            </button>
          </div>
        )}

        {/* Yeni Link Oluşturma Modalı */}
        {yeniLinkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-[2rem] p-6 w-full max-w-2xl mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Yeni Denetim Linki Oluştur</h3>
                <button
                  onClick={() => setYeniLinkModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Form Seçimi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Denetim Formu *</label>
                  <select
                    value={yeniLink.formId}
                    onChange={(e) => setYeniLink(prev => ({ ...prev, formId: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50/50 border-0 rounded-xl text-base focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all duration-200"
                  >
                    <option value="">Form Seçiniz</option>
                    {formlar.map((form) => (
                      <option key={form.id} value={form.id}>
                        {form.baslik}
                      </option>
                    ))}
                  </select>
                </div>



                {/* Şube Seçimi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hedef Şube *</label>
                  <select
                    value={yeniLink.hedefSube}
                    onChange={(e) => setYeniLink(prev => ({ ...prev, hedefSube: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50/50 border-0 rounded-xl text-base focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all duration-200"
                  >
                    <option value="">Şube Seçiniz</option>
                    {Object.entries(subeler).map(([id, sube]) => (
                      <option key={id} value={id}>
                        {sube.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tarih Aralığı */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Başlangıç Tarihi *</label>
                    <input
                      type="date"
                      value={yeniLink.baslangicTarihi}
                      onChange={(e) => setYeniLink(prev => ({ ...prev, baslangicTarihi: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50/50 border-0 rounded-xl text-base focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bitiş Tarihi *</label>
                    <input
                      type="date"
                      value={yeniLink.bitisTarihi}
                      onChange={(e) => setYeniLink(prev => ({ ...prev, bitisTarihi: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50/50 border-0 rounded-xl text-base focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Saat Aralığı */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Başlangıç Saati</label>
                    <input
                      type="time"
                      value={yeniLink.baslangicSaati}
                      onChange={(e) => setYeniLink(prev => ({ ...prev, baslangicSaati: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50/50 border-0 rounded-xl text-base focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bitiş Saati</label>
                    <input
                      type="time"
                      value={yeniLink.bitisSaati}
                      onChange={(e) => setYeniLink(prev => ({ ...prev, bitisSaati: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50/50 border-0 rounded-xl text-base focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Açıklama */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                  <textarea
                    value={yeniLink.aciklama}
                    onChange={(e) => setYeniLink(prev => ({ ...prev, aciklama: e.target.value }))}
                    rows="3"
                    className="w-full px-4 py-3 bg-gray-50/50 border-0 rounded-xl text-base focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all duration-200"
                    placeholder="Denetim hakkında ek bilgiler..."
                  />
                </div>
              </div>

              {/* Butonlar */}
              <div className="flex gap-3 mt-8">
                <button
                  onClick={handleLinkOlustur}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors duration-200 font-medium"
                >
                  Link Oluştur
                </button>
                <button
                  onClick={() => setYeniLinkModal(false)}
                  className="flex-1 px-6 py-3 text-gray-700 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors duration-200 font-medium"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QR Kod Modalı */}
        {seciliLink && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-[2rem] p-6 w-full max-w-md mx-4 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">QR Kod</h3>
                <button
                  onClick={() => setSeciliLink(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-white rounded-xl shadow-lg border border-gray-100">
                  <QRCodeSVG 
                    value={`${window.location.origin}/denetim-yap/${seciliLink.id}`} 
                    size={200} 
                    id="qrcode" 
                    className="w-full h-auto" 
                  />
                </div>
                
                <div className="w-full p-3 bg-gray-50 rounded-xl text-sm text-gray-600 break-all text-center">
                  {`${window.location.origin}/denetim-yap/${seciliLink.id}`}
                </div>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => {
                      const svg = document.getElementById('qrcode');
                      const svgData = new XMLSerializer().serializeToString(svg);
                      const canvas = document.createElement('canvas');
                      const ctx = canvas.getContext('2d');
                      const img = new Image();
                      img.onload = () => {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0);
                        const pngFile = canvas.toDataURL('image/png');
                        const downloadLink = document.createElement('a');
                        downloadLink.download = `denetim-qr-${seciliLink.id}.png`;
                        downloadLink.href = pngFile;
                        downloadLink.click();
                      };
                      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                  >
                    QR İndir
                  </button>
                  <button
                    onClick={() => linkKopyala(seciliLink.id)}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
                  >
                    Link Kopyala
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
