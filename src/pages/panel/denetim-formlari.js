import { useState, useEffect } from 'react';
import { ref, get, set, push } from 'firebase/database';
import { realdb } from '../../firebase/config';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';


export default function DenetimFormlariPage() {
  const [sayfa, setSayfa] = useState('liste'); // 'liste', 'form-olustur', 'soru-ekle'
  const [formlar, setFormlar] = useState([]);
  const [kategoriler, setKategoriler] = useState([]);
  const [secilenForm, setSecilenForm] = useState(null);
  const [secilenSoru, setSecilenSoru] = useState(null);
  const [yeniForm, setYeniForm] = useState({
    baslik: '',
    aciklama: '',
    aktif: true,
    sorular: []
  });
  const [yeniSoru, setYeniSoru] = useState({
    soru: '',
    kategoriId: '',
    tip: 'evet_hayir',
    puan: '',
    zorunlu: true,
    secenekler: []
  });
  const [silinecekSoru, setSilinecekSoru] = useState(null);

  const [loading, setLoading] = useState(true);

  // Kategorileri yükle
  useEffect(() => {
    const fetchKategoriler = async () => {
      try {
        const snapshot = await get(ref(realdb, 'kategoriler'));
        if (snapshot.exists()) {
          const data = snapshot.val();
          const kategorilerArray = Object.entries(data).map(([id, kategori]) => ({
            id,
            ...kategori
          }));
          setKategoriler(kategorilerArray);
        }
      } catch (error) {
        console.error('Kategoriler yüklenirken hata:', error);
        toast.error('Kategoriler yüklenemedi');
      }
    };
    fetchKategoriler();
  }, []);

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
      } finally {
        setLoading(false);
      }
    };
    fetchFormlar();
  }, []);

  // Form kaydet
  const handleFormKaydet = async (e) => {
    e.preventDefault();
    try {
      const formId = secilenForm?.id || new Date().getTime().toString();
      const formData = {
        ...yeniForm,
        olusturulmaTarihi: secilenForm?.olusturulmaTarihi || new Date().toISOString(),
        sonGuncellenmeTarihi: new Date().toISOString()
      };

      await set(ref(realdb, `denetimFormlari/${formId}`), formData);
      toast.success(secilenForm ? 'Form güncellendi' : 'Form oluşturuldu');
      
      // Formları yeniden yükle
      const snapshot = await get(ref(realdb, 'denetimFormlari'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        const formlarArray = Object.entries(data).map(([id, form]) => ({
          id,
          ...form
        }));
        setFormlar(formlarArray);
      }

      setSayfa('liste');
      setSecilenForm(null);
      setYeniForm({
        baslik: '',
        aciklama: '',
        aktif: true,
        sorular: []
      });
    } catch (error) {
      console.error('Form kaydedilirken hata:', error);
      toast.error('Form kaydedilemedi');
    }
  };

  // Soru ekle
  const handleSoruEkle = async (e) => {
    e.preventDefault();
    if (!secilenForm) return;

    try {
      const yeniSorular = [
        ...(secilenForm.sorular || []),
        {
          ...yeniSoru,
          id: new Date().getTime().toString()
        }
      ];

      await set(ref(realdb, `denetimFormlari/${secilenForm.id}`), {
        ...secilenForm,
        sorular: yeniSorular,
        sonGuncellenmeTarihi: new Date().toISOString()
      });

      toast.success('Soru eklendi');
      
      // Formları yeniden yükle
      const snapshot = await get(ref(realdb, 'denetimFormlari'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        const formlarArray = Object.entries(data).map(([id, form]) => ({
          id,
          ...form
        }));
        setFormlar(formlarArray);
        // Seçili formu güncelle
        const guncelForm = formlarArray.find(f => f.id === secilenForm.id);
        setSecilenForm(guncelForm);
      }

      setYeniSoru({
        soru: '',
        kategoriId: '',
        tip: 'evet_hayir',
        puan: '',
        zorunlu: true,
        secenekler: []
      });
    } catch (error) {
      console.error('Soru eklenirken hata:', error);
      toast.error('Soru eklenemedi');
    }
  };

  // Soru güncelle
  const handleSoruGuncelle = async (e) => {
    e.preventDefault();
    if (!secilenForm || !secilenSoru) return;

    try {
      const guncelSorular = secilenForm.sorular.map(soru => 
        soru.id === secilenSoru.id ? { ...yeniSoru, id: soru.id } : soru
      );

      await set(ref(realdb, `denetimFormlari/${secilenForm.id}`), {
        ...secilenForm,
        sorular: guncelSorular,
        sonGuncellenmeTarihi: new Date().toISOString()
      });

      toast.success('Soru güncellendi');
      
      // Formları yeniden yükle
      const snapshot = await get(ref(realdb, 'denetimFormlari'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        const formlarArray = Object.entries(data).map(([id, form]) => ({
          id,
          ...form
        }));
        setFormlar(formlarArray);
        // Seçili formu güncelle
        const guncelForm = formlarArray.find(f => f.id === secilenForm.id);
        setSecilenForm(guncelForm);
      }

      setSecilenSoru(null);
      setYeniSoru({
        soru: '',
        kategoriId: '',
        tip: 'evet_hayir',
        puan: '',
        zorunlu: true,
        secenekler: []
      });
    } catch (error) {
      console.error('Soru güncellenirken hata:', error);
      toast.error('Soru güncellenemedi');
    }
  };

  // Soru sil
  const handleSoruSil = async (soruId) => {
    if (!secilenForm) return;
    
    try {
      const guncelSorular = secilenForm.sorular.filter(soru => soru.id !== soruId);

      await set(ref(realdb, `denetimFormlari/${secilenForm.id}`), {
        ...secilenForm,
        sorular: guncelSorular,
        sonGuncellenmeTarihi: new Date().toISOString()
      });

      toast.success('Soru silindi');
      
      // Formları yeniden yükle
      const snapshot = await get(ref(realdb, 'denetimFormlari'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        const formlarArray = Object.entries(data).map(([id, form]) => ({
          id,
          ...form
        }));
        setFormlar(formlarArray);
        // Seçili formu güncelle
        const guncelForm = formlarArray.find(f => f.id === secilenForm.id);
        setSecilenForm(guncelForm);
      }
    } catch (error) {
      console.error('Soru silinirken hata:', error);
      toast.error('Soru silinemedi');
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  // Form Listesi
  if (sayfa === 'liste') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Denetim Formları</h1>
            <p className="mt-2 text-gray-600">Denetim formlarını oluşturun ve yönetin</p>
          </div>
          <button
            onClick={() => {
              setSecilenForm(null);
              setYeniForm({
                baslik: '',
                aciklama: '',
                aktif: true,
                sorular: []
              });
              setSayfa('form-olustur');
            }}
            className="inline-flex items-center gap-2 px-5 py-3 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors duration-200 shadow-sm hover:shadow"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Yeni Form Oluştur
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {formlar.map((form, index) => (
            <div key={form.id} className="group bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-100 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 overflow-hidden">
              {/* Kart Başlığı */}
              <div className="relative p-6 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight pr-2">{form.baslik}</h2>
                  <div className="flex items-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></div>
                      Aktif
                    </span>
                  </div>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">{form.aciklama}</p>
              </div>

              {/* Kart İstatistikleri */}
              <div className="px-6 py-3 bg-gradient-to-r from-gray-50/50 to-gray-100/30 border-t border-gray-100/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-900">{form.sorular?.length || 0}</span>
                      <span className="text-xs text-gray-500 ml-1">Soru</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    ID: {form.id.slice(-6)}
                  </div>
                </div>
              </div>

              {/* Kart Butonları */}
              <div className="p-4 pt-3">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setSecilenForm(form);
                      setSayfa('soru-ekle');
                    }}
                    className="group/btn flex flex-col items-center justify-center gap-1.5 px-3 py-3 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 border border-gray-200 hover:border-red-200 hover:shadow-sm"
                  >
                    <svg className="w-4 h-4 group-hover/btn:scale-110 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className="text-xs font-medium">Sorular</span>
                  </button>
                  <button
                    onClick={() => {
                      setSecilenForm(form);
                      setYeniForm({
                        ...form,
                        sorular: form.sorular || []
                      });
                      setSayfa('form-olustur');
                    }}
                    className="group/btn flex flex-col items-center justify-center gap-1.5 px-3 py-3 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200 border border-gray-200 hover:border-blue-200 hover:shadow-sm"
                  >
                    <svg className="w-4 h-4 group-hover/btn:scale-110 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="text-xs font-medium">Düzenle</span>
                  </button>
                  <button
                    onClick={() => {
                      setSilinecekSoru(form);
                    }}
                    className="group/btn flex flex-col items-center justify-center gap-1.5 px-3 py-3 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 border border-gray-200 hover:border-red-200 hover:shadow-sm"
                  >
                    <svg className="w-4 h-4 group-hover/btn:scale-110 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="text-xs font-medium">Sil</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>


      </div>
    );
  }

  // Form Oluşturma/Düzenleme Sayfası
  if (sayfa === 'form-olustur') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {secilenForm ? 'Form Düzenle' : 'Yeni Form Oluştur'}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {secilenForm ? 'Mevcut formu düzenleyin' : 'Yeni bir denetim formu oluşturun'}
              </p>
            </div>
            <button
              onClick={() => setSayfa('liste')}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Listeye Dön
            </button>
          </div>

          <form onSubmit={handleFormKaydet} className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Form Başlığı</label>
                <input
                  type="text"
                  value={yeniForm.baslik}
                  onChange={(e) => setYeniForm({ ...yeniForm, baslik: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  placeholder="Örn: Restoran Denetim Formu"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Açıklama</label>
                <textarea
                  value={yeniForm.aciklama}
                  onChange={(e) => setYeniForm({ ...yeniForm, aciklama: e.target.value })}
                  rows="3"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  placeholder="Form hakkında kısa bir açıklama yazın"
                />
              </div>

              <div className="relative flex items-start">
                <div className="flex items-center h-5">
                  <input
                    type="checkbox"
                    checked={yeniForm.aktif}
                    onChange={(e) => setYeniForm({ ...yeniForm, aktif: e.target.checked })}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label className="font-medium text-gray-700">Form Aktif</label>
                  <p className="text-gray-500">Bu form denetimlerde kullanılabilir olacak</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setSayfa('liste')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                İptal
              </button>
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                {secilenForm ? 'Güncelle' : 'Oluştur'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Soru Ekleme Sayfası
  if (sayfa === 'soru-ekle') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Soru Ekle</h1>
              <p className="mt-1 text-sm text-gray-500">
                <span className="font-medium text-gray-700">{secilenForm?.baslik}</span> formuna yeni soru ekleyin
              </p>
            </div>
            <button
              onClick={() => setSayfa('liste')}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Listeye Dön
            </button>
          </div>

          {/* Soru Ekleme Formu */}
          <form onSubmit={handleSoruEkle} className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden mb-8">
            <div className="p-6 space-y-8">
              {/* Soru Metni */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Soru Metni
                </label>
                <input
                  type="text"
                  value={yeniSoru.soru}
                  onChange={(e) => setYeniSoru({ ...yeniSoru, soru: e.target.value })}
                  className="mt-1 block w-full px-4 py-3 border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  placeholder="Örn: Mutfak hijyen kurallarına uyuluyor mu?"
                  required
                />
              </div>

              {/* Kategori Seçimi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategori
                </label>
                <select
                  value={yeniSoru.kategoriId}
                  onChange={(e) => setYeniSoru({ ...yeniSoru, kategoriId: e.target.value })}
                  className="mt-1 block w-full px-4 py-3 border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  required
                >
                  <option value="">Kategori Seçin</option>
                  {kategoriler.map(kategori => (
                    <option key={kategori.id} value={kategori.id}>
                      {kategori.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Soru Tipi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">Soru Tipi</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => setYeniSoru({ ...yeniSoru, tip: 'evet_hayir', secenekler: [] })}
                    className={`relative rounded-lg border p-4 flex cursor-pointer focus:outline-none ${
                      yeniSoru.tip === 'evet_hayir'
                        ? 'bg-red-50 border-red-200 z-10'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex-1">
                      <div className={`flex items-center justify-between ${
                        yeniSoru.tip === 'evet_hayir' ? 'text-red-900' : 'text-gray-900'
                      }`}>
                        <div className="flex items-center">
                          <div className="flex items-center gap-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Evet
                            </span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Hayır
                            </span>
                          </div>
                        </div>
                        {yeniSoru.tip === 'evet_hayir' && (
                          <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setYeniSoru({ ...yeniSoru, tip: 'uzun_metin', secenekler: [] })}
                    className={`relative rounded-lg border p-4 flex cursor-pointer focus:outline-none ${
                      yeniSoru.tip === 'uzun_metin'
                        ? 'bg-red-50 border-red-200 z-10'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex-1">
                      <div className={`flex items-center justify-between ${
                        yeniSoru.tip === 'uzun_metin' ? 'text-red-900' : 'text-gray-900'
                      }`}>
                        <div className="flex items-center">
                          <div className="text-sm">
                            <p className="font-medium">Uzun Metin</p>
                            <div className="mt-1">
                              <div className="w-24 h-3 bg-gray-200 rounded"></div>
                              <div className="w-16 h-3 bg-gray-200 rounded mt-1"></div>
                            </div>
                          </div>
                        </div>
                        {yeniSoru.tip === 'uzun_metin' && (
                          <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setYeniSoru({ ...yeniSoru, tip: 'coklu_secim', secenekler: [''] })}
                    className={`relative rounded-lg border p-4 flex cursor-pointer focus:outline-none ${
                      yeniSoru.tip === 'coklu_secim'
                        ? 'bg-red-50 border-red-200 z-10'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex-1">
                      <div className={`flex items-center justify-between ${
                        yeniSoru.tip === 'coklu_secim' ? 'text-red-900' : 'text-gray-900'
                      }`}>
                        <div className="flex items-center">
                          <div className="text-sm">
                            <p className="font-medium">Çoklu Seçim</p>
                            <div className="mt-1 flex flex-col gap-1">
                              <div className="w-20 h-3 bg-gray-200 rounded"></div>
                              <div className="w-16 h-3 bg-gray-200 rounded"></div>
                              <div className="w-24 h-3 bg-gray-200 rounded"></div>
                            </div>
                          </div>
                        </div>
                        {yeniSoru.tip === 'coklu_secim' && (
                          <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Çoklu Seçim Seçenekleri */}
              {yeniSoru.tip === 'coklu_secim' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seçenekler
                  </label>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto p-2">
                    {(yeniSoru.secenekler || []).map((secenek, index) => (
                      <div key={index} className="flex items-start gap-2 bg-gray-50 p-3 rounded-lg">
                        <div className="flex-1 flex flex-col sm:flex-row gap-2">
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              {index + 1}. Seçenek Metni
                            </label>
                            <textarea
                              rows="2"
                              value={typeof secenek === 'string' ? secenek : secenek.metin}
                              onChange={(e) => {
                                const yeniSecenekler = [...(yeniSoru.secenekler || [])];
                                if (typeof secenek === 'string') {
                                  yeniSecenekler[index] = { metin: e.target.value, puan: 0 };
                                } else {
                                  yeniSecenekler[index] = { ...secenek, metin: e.target.value };
                                }
                                setYeniSoru({ 
                                  ...yeniSoru, 
                                  secenekler: yeniSecenekler,
                                  puan: yeniSecenekler.reduce((toplam, s) => toplam + (typeof s === 'string' ? 0 : (parseFloat(s.puan) || 0)), 0).toString()
                                });
                              }}
                              className="block w-full px-3 py-2 border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                              placeholder="Seçenek metnini girin"
                              required
                            />
                          </div>
                          <div className="w-full sm:w-32">
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Puan
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={typeof secenek === 'string' ? '0' : (secenek.puan || '')}
                              onChange={(e) => {
                                const yeniSecenekler = [...(yeniSoru.secenekler || [])];
                                if (typeof secenek === 'string') {
                                  yeniSecenekler[index] = { metin: secenek, puan: e.target.value ? parseFloat(e.target.value) : 0 };
                                } else {
                                  yeniSecenekler[index] = { ...secenek, puan: e.target.value ? parseFloat(e.target.value) : 0 };
                                }
                                setYeniSoru({ 
                                  ...yeniSoru, 
                                  secenekler: yeniSecenekler,
                                  puan: yeniSecenekler.reduce((toplam, s) => toplam + (typeof s === 'string' ? 0 : (parseFloat(s.puan) || 0)), 0).toString()
                                });
                              }}
                              className="block w-full px-3 py-2 border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                              placeholder="0.0"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const yeniSecenekler = (yeniSoru.secenekler || []).filter((_, i) => i !== index);
                            setYeniSoru({ 
                              ...yeniSoru, 
                              secenekler: yeniSecenekler,
                              puan: yeniSecenekler.reduce((toplam, s) => toplam + (typeof s === 'string' ? 0 : (parseFloat(s.puan) || 0)), 0).toString()
                            });
                          }}
                          className="p-2 text-gray-400 hover:text-red-500 self-start mt-6"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setYeniSoru({ 
                        ...yeniSoru, 
                        secenekler: [...(yeniSoru.secenekler || []), { metin: '', puan: 0 }]
                      })}
                      className="w-full mt-2 inline-flex items-center justify-center px-4 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Seçenek Ekle
                    </button>
                  </div>
                </div>
              )}

              {/* Puan */}
              {yeniSoru.tip !== 'coklu_secim' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Puan Değeri</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={yeniSoru.puan}
                    onChange={(e) => setYeniSoru({ ...yeniSoru, puan: e.target.value ? parseFloat(e.target.value) : '' })}
                    className="mt-1 block w-full px-4 py-3 border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    placeholder="Örn: 1.5, 2.3 gibi"
                  />
                  <p className="mt-1 text-sm text-gray-500">Ondalıklı değer girebilirsiniz (Örn: 1.5, 2.3)</p>
                </div>
              )}

              {/* Zorunluluk */}
              <div>
                <div className="relative flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      checked={yeniSoru.zorunlu}
                      onChange={(e) => setYeniSoru({ ...yeniSoru, zorunlu: e.target.checked })}
                      className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3">
                    <label className="text-sm font-medium text-gray-700">Zorunlu Soru</label>
                    <p className="text-gray-500">Bu soru denetim sırasında mutlaka cevaplanmalıdır</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="flex items-center text-sm text-gray-500">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Tüm alanları doldurduğunuzdan emin olun
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setSayfa('liste')}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Soru Ekle
                </button>
              </div>
            </div>
          </form>

          {/* Mevcut Sorular Listesi - Artık tam genişlikte */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Mevcut Sorular</h3>
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {secilenForm?.sorular?.length || 0} soru
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Toplam {secilenForm?.sorular?.reduce((toplam, soru) => toplam + (parseFloat(soru.puan) || 0), 0)} puan
                  </span>
                </div>
              </div>

              <div className="mt-6 space-y-4 max-h-[500px] overflow-y-auto">
                {secilenForm?.sorular?.map((soru, index) => (
                  <div
                    key={soru.id}
                    className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-150"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col items-center space-y-1">
                            <button
                              type="button"
                              onClick={() => {
                                const yeniSorular = [...secilenForm.sorular];
                                const simdikiIndex = index;
                                const oncekiIndex = index - 1;
                                
                                if (oncekiIndex >= 0) {
                                  // Sıraları değiştir
                                  const temp = yeniSorular[simdikiIndex];
                                  yeniSorular[simdikiIndex] = yeniSorular[oncekiIndex];
                                  yeniSorular[oncekiIndex] = temp;
                                  
                                  // Veritabanını güncelle
                                  set(ref(realdb, `denetimFormlari/${secilenForm.id}`), {
                                    ...secilenForm,
                                    sorular: yeniSorular,
                                    sonGuncellenmeTarihi: new Date().toISOString()
                                  }).then(() => {
                                    // State'i güncelle
                                    setSecilenForm({
                                      ...secilenForm,
                                      sorular: yeniSorular
                                    });
                                    toast.success('Soru sırası güncellendi');
                                  }).catch((error) => {
                                    console.error('Sıralama güncellenirken hata:', error);
                                    toast.error('Sıralama güncellenemedi');
                                  });
                                }
                              }}
                              disabled={index === 0}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const yeniSorular = [...secilenForm.sorular];
                                const simdikiIndex = index;
                                const sonrakiIndex = index + 1;
                                
                                if (sonrakiIndex < yeniSorular.length) {
                                  // Sıraları değiştir
                                  const temp = yeniSorular[simdikiIndex];
                                  yeniSorular[simdikiIndex] = yeniSorular[sonrakiIndex];
                                  yeniSorular[sonrakiIndex] = temp;
                                  
                                  // Veritabanını güncelle
                                  set(ref(realdb, `denetimFormlari/${secilenForm.id}`), {
                                    ...secilenForm,
                                    sorular: yeniSorular,
                                    sonGuncellenmeTarihi: new Date().toISOString()
                                  }).then(() => {
                                    // State'i güncelle
                                    setSecilenForm({
                                      ...secilenForm,
                                      sorular: yeniSorular
                                    });
                                    toast.success('Soru sırası güncellendi');
                                  }).catch((error) => {
                                    console.error('Sıralama güncellenirken hata:', error);
                                    toast.error('Sıralama güncellenemedi');
                                  });
                                }
                              }}
                              disabled={index === secilenForm.sorular.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                          <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-red-100 text-red-600 text-sm font-medium">
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{soru.soru}</p>
                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                {kategoriler.find(k => k.id === soru.kategoriId)?.label || 'Kategori Yok'}
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {soru.tip === 'evet_hayir' ? 'Evet/Hayır' : 
                                 soru.tip === 'uzun_metin' ? 'Uzun Metin' : 
                                 soru.tip === 'coklu_secim' ? 'Çoklu Seçim' : 'Bilinmeyen Tip'}
                              </span>
                              {soru.zorunlu && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Zorunlu
                                </span>
                              )}
                              {soru.puan && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  {soru.puan} Puan
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSecilenSoru(soru);
                              setYeniSoru({
                                ...soru,
                                secenekler: soru.tip === 'coklu_secim' ? 
                                  (soru.secenekler || []).map(s => {
                                    if (typeof s === 'string') {
                                      return { metin: s, puan: 0 };
                                    } else if (typeof s === 'object' && s !== null) {
                                      return { metin: s.metin || '', puan: parseFloat(s.puan) || 0 };
                                    }
                                    return { metin: '', puan: 0 };
                                  }) : 
                                  []
                              });
                            }}
                            className="inline-flex items-center p-1 text-gray-400 hover:text-gray-500"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setSilinecekSoru(soru)}
                            className="inline-flex items-center p-1 text-gray-400 hover:text-red-500"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {(!secilenForm?.sorular || secilenForm.sorular.length === 0) && (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Soru Bulunmuyor</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Bu forma henüz soru eklenmemiş
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Soru Düzenleme Modal */}
        {secilenSoru && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => {
                setSecilenSoru(null);
                setYeniSoru({
                  soru: '',
                  kategoriId: '',
                  tip: 'evet_hayir',
                  puan: '',
                  zorunlu: true,
                  secenekler: []
                });
              }}></div>

              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

              <div className="relative inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full sm:p-6">
                <div>
                  <div className="mt-3 text-center sm:mt-0 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Soru Düzenle
                    </h3>
                    <div className="mt-2">
                      <form onSubmit={handleSoruGuncelle} className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Soru Metni
                          </label>
                          <textarea
                            value={yeniSoru.soru}
                            onChange={(e) => setYeniSoru({ ...yeniSoru, soru: e.target.value })}
                            className="mt-1 block w-full px-4 py-3 border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                            rows="2"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Kategori
                          </label>
                          <select
                            value={yeniSoru.kategoriId}
                            onChange={(e) => setYeniSoru({ ...yeniSoru, kategoriId: e.target.value })}
                            className="mt-1 block w-full px-4 py-3 border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                            required
                          >
                            <option value="">Kategori Seçin</option>
                            {kategoriler.map(kategori => (
                              <option key={kategori.id} value={kategori.id}>
                                {kategori.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Soru Tipi
                          </label>
                          <select
                            value={yeniSoru.tip}
                            onChange={(e) => setYeniSoru({ 
                              ...yeniSoru, 
                              tip: e.target.value,
                              secenekler: e.target.value === 'coklu_secim' ? [{ metin: '', puan: 0 }] : [],
                              puan: e.target.value === 'coklu_secim' ? '0' : yeniSoru.puan
                            })}
                            className="mt-1 block w-full px-4 py-3 border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                          >
                            <option value="evet_hayir">Evet/Hayır</option>
                            <option value="uzun_metin">Uzun Metin</option>
                            <option value="coklu_secim">Çoklu Seçim</option>
                          </select>
                        </div>

                        {/* Çoklu Seçim Seçenekleri */}
                        {yeniSoru.tip === 'coklu_secim' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Seçenekler
                            </label>
                            <div className="space-y-3 max-h-[300px] overflow-y-auto p-2">
                              {(yeniSoru.secenekler || []).map((secenek, index) => (
                                <div key={index} className="flex items-start gap-2 bg-gray-50 p-3 rounded-lg">
                                  <div className="flex-1 flex flex-col sm:flex-row gap-2">
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        {index + 1}. Seçenek Metni
                                      </label>
                                      <textarea
                                        rows="2"
                                        value={typeof secenek === 'string' ? secenek : secenek.metin}
                                        onChange={(e) => {
                                          const yeniSecenekler = [...(yeniSoru.secenekler || [])];
                                          if (typeof secenek === 'string') {
                                            yeniSecenekler[index] = { metin: e.target.value, puan: 0 };
                                          } else {
                                            yeniSecenekler[index] = { ...secenek, metin: e.target.value };
                                          }
                                          setYeniSoru({ 
                                            ...yeniSoru, 
                                            secenekler: yeniSecenekler,
                                            puan: yeniSecenekler.reduce((toplam, s) => toplam + (typeof s === 'string' ? 0 : (parseFloat(s.puan) || 0)), 0).toString()
                                          });
                                        }}
                                        className="block w-full px-3 py-2 border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                                        placeholder="Seçenek metnini girin"
                                        required
                                      />
                                    </div>
                                    <div className="w-full sm:w-32">
                                      <label className="block text-xs font-medium text-gray-500 mb-1">
                                        Puan
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={typeof secenek === 'string' ? '0' : (secenek.puan || '')}
                                        onChange={(e) => {
                                          const yeniSecenekler = [...(yeniSoru.secenekler || [])];
                                          if (typeof secenek === 'string') {
                                            yeniSecenekler[index] = { metin: secenek, puan: e.target.value ? parseFloat(e.target.value) : 0 };
                                          } else {
                                            yeniSecenekler[index] = { ...secenek, puan: e.target.value ? parseFloat(e.target.value) : 0 };
                                          }
                                          setYeniSoru({ 
                                            ...yeniSoru, 
                                            secenekler: yeniSecenekler,
                                            puan: yeniSecenekler.reduce((toplam, s) => toplam + (typeof s === 'string' ? 0 : (parseFloat(s.puan) || 0)), 0).toString()
                                          });
                                        }}
                                        className="block w-full px-3 py-2 border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                                        placeholder="0.0"
                                      />
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const yeniSecenekler = (yeniSoru.secenekler || []).filter((_, i) => i !== index);
                                      setYeniSoru({ 
                                        ...yeniSoru, 
                                        secenekler: yeniSecenekler,
                                        puan: yeniSecenekler.reduce((toplam, s) => toplam + (typeof s === 'string' ? 0 : (parseFloat(s.puan) || 0)), 0).toString()
                                      });
                                    }}
                                    className="p-2 text-gray-400 hover:text-red-500 self-start mt-6"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => setYeniSoru({ 
                                  ...yeniSoru, 
                                  secenekler: [...(yeniSoru.secenekler || []), { metin: '', puan: 0 }]
                                })}
                                className="w-full mt-2 inline-flex items-center justify-center px-4 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                              >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Seçenek Ekle
                              </button>
                            </div>
                          </div>
                        )}

                        {yeniSoru.tip !== 'coklu_secim' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Puan
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={yeniSoru.puan}
                              onChange={(e) => setYeniSoru({ ...yeniSoru, puan: e.target.value ? parseFloat(e.target.value) : '' })}
                              className="mt-1 block w-full px-4 py-3 border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                              placeholder="Örn: 1.5, 2.3 gibi"
                            />
                            <p className="mt-1 text-sm text-gray-500">Ondalıklı değer girebilirsiniz (Örn: 1.5, 2.3)</p>
                          </div>
                        )}

                        {/* Zorunluluk */}
                        <div>
                          <div className="relative flex items-start">
                            <div className="flex items-center h-5">
                              <input
                                type="checkbox"
                                checked={yeniSoru.zorunlu}
                                onChange={(e) => setYeniSoru({ ...yeniSoru, zorunlu: e.target.checked })}
                                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                              />
                            </div>
                            <div className="ml-3 text-sm">
                              <label className="font-medium text-gray-700">Zorunlu Soru</label>
                              <p className="text-gray-500">Bu soru denetim sırasında mutlaka cevaplanmalıdır</p>
                            </div>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleSoruGuncelle}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Güncelle
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSecilenSoru(null);
                      setYeniSoru({
                        soru: '',
                        kategoriId: '',
                        tip: 'evet_hayir',
                        puan: '',
                        zorunlu: true,
                        secenekler: []
                      });
                    }}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    İptal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Silme Onay Modalı */}
        {silinecekSoru && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setSilinecekSoru(null)}></div>

              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

              <div className="relative inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Soruyu Sil
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Bu soruyu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                      </p>
                      <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-900">{silinecekSoru?.soru}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={() => {
                      handleSoruSil(silinecekSoru.id);
                      setSilinecekSoru(null);
                    }}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Sil
                  </button>
                  <button
                    type="button"
                    onClick={() => setSilinecekSoru(null)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    İptal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
} 