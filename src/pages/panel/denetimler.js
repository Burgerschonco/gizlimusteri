import { useState, useEffect } from 'react';
import { realdb } from '../../firebase/config';
import { ref, onValue, remove } from 'firebase/database';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';

function DenetimlerPage() {
  const [denetimler, setDenetimler] = useState([]);
  const [subeler, setSubeler] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSube, setSelectedSube] = useState('');
  const [error, setError] = useState(null);
  const [silinecekDenetim, setSilinecekDenetim] = useState(null);

  // Şubeleri yükle
  useEffect(() => {
    const subelerRef = ref(realdb, 'branches');
    
    const unsubscribeSubeler = onValue(subelerRef, (snapshot) => {
      if (snapshot.exists()) {
        const subeVerileri = {};
        Object.entries(snapshot.val()).forEach(([id, data]) => {
          if (data.isActive) {
            subeVerileri[id] = data;
          }
        });
        setSubeler(subeVerileri);
      }
    });

    return () => unsubscribeSubeler();
  }, []);

  useEffect(() => {
    const fetchDenetimler = async () => {
      try {
        const denetimlerRef = ref(realdb, 'denetimler');
        
        const unsubscribe = onValue(denetimlerRef, (snapshot) => {
          if (snapshot.exists()) {
            const denetimlerData = Object.entries(snapshot.val())
              .map(([id, data]) => ({
                id,
                ...data,
                subeAdi: data.subeAdi || 'İsimsiz Şube',
                subeId: data.subeId || '',
                denetimci: data.denetimci || { ad: '', soyad: '' },
                sonuc: {
                  ...data.sonuc,
                  toplamPuan: Number(data.sonuc?.toplamPuan) || 0,
                  yuzde: Number(data.sonuc?.yuzde) || 0
                }
              }))
              .sort((a, b) => new Date(b.denetimTarihi) - new Date(a.denetimTarihi));
            
            setDenetimler(denetimlerData);
            setError(null);
          } else {
            setDenetimler([]);
          }
          setLoading(false);
        }, (error) => {
          console.error('Denetimler yüklenirken hata:', error);
          setError('Denetimler yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Beklenmeyen bir hata oluştu:', error);
        setError('Beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyin.');
        setLoading(false);
      }
    };

    fetchDenetimler();
  }, []);

  const filteredDenetimler = denetimler.filter(denetim => {
    const subeName = denetim?.subeAdi || '';
    const denetimciAd = denetim?.denetimci?.ad || '';
    const denetimciSoyad = denetim?.denetimci?.soyad || '';
    const subeFilter = selectedSube ? denetim.subeId === selectedSube : true;
    
    return subeFilter && (
      subeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${denetimciAd} ${denetimciSoyad}`.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Denetim silme fonksiyonu
  const handleDenetimSil = async (denetimId) => {
    try {
      await remove(ref(realdb, `denetimler/${denetimId}`));
      toast.success('Denetim başarıyla silindi');
      setSilinecekDenetim(null);
    } catch (error) {
      console.error('Denetim silinirken hata:', error);
      toast.error('Denetim silinemedi');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg max-w-md mx-auto">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors duration-200"
          >
            Sayfayı Yenile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-red-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Üst Kısım */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg mb-6">
          <div className="relative p-6">
            {/* Dekoratif Arka Plan */}
            <div className="absolute inset-0 opacity-[0.03]">
              <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5"/>
                </pattern>
                <rect width="100" height="100" fill="url(#grid)"/>
              </svg>
            </div>

            {/* Başlık ve İçerik */}
            <div className="relative space-y-6">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-red-600">
                  Gizli Müşteri Denetim Sistemi
                </h1>
                <div className="mt-2 flex items-center space-x-2">
                  <span className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-sm font-medium">
                    {denetimler.length} Denetim
                  </span>
                  <span className="text-sm text-gray-500">kaydı bulundu</span>
                </div>
              </div>

              {/* Arama ve Filtreler */}
              <div className="space-y-4">
                {/* Arama Çubuğu */}
                <div className="relative max-w-2xl">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 text-sm bg-gray-50/50 border-0 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all duration-200"
                    placeholder="Şube veya denetimci ara..."
                  />
                </div>

                {/* Şube Filtreleri */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  <button
                    onClick={() => setSelectedSube('')}
                    className={`relative group w-full ${
                      selectedSube === '' 
                        ? 'bg-red-500 text-white shadow-md' 
                        : 'bg-white hover:bg-red-50 text-gray-600 hover:text-red-500'
                    } h-[88px] rounded-xl transition-all duration-200 border border-gray-100 p-4 flex flex-col justify-between`}
                  >
                    <div className="flex items-center gap-3">
                      <svg className={`h-5 w-5 ${selectedSube === '' ? 'text-white' : 'text-gray-400 group-hover:text-red-500'}`} 
                           fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      <span className="text-sm font-medium">Tüm Şubeler</span>
                    </div>
                    <div className={`text-xs ${selectedSube === '' ? 'text-white/80' : 'text-gray-500'}`}>
                      {denetimler.length} Denetim
                    </div>
                  </button>

                  {Object.entries(subeler).map(([id, sube]) => {
                    const subeCount = denetimler.filter(d => d.subeId === id).length;
                    return (
                      <button
                        key={id}
                        onClick={() => setSelectedSube(id)}
                        className={`relative group w-full ${
                          selectedSube === id 
                            ? 'bg-red-500 text-white shadow-md' 
                            : 'bg-white hover:bg-red-50 text-gray-600 hover:text-red-500'
                        } h-[88px] rounded-xl transition-all duration-200 border border-gray-100 p-4 flex flex-col justify-between`}
                      >
                        <div className="flex items-center gap-3">
                          <svg className={`h-5 w-5 flex-shrink-0 ${selectedSube === id ? 'text-white' : 'text-gray-400 group-hover:text-red-500'}`} 
                               fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <span className="text-sm font-medium truncate">{sube.name}</span>
                        </div>
                        <div className={`text-xs ${selectedSube === id ? 'text-white/80' : 'text-gray-500'}`}>
                          {subeCount} Denetim
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Denetim Kartları */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDenetimler.map((denetim) => (
            <div
              key={denetim.id}
              className="group bg-white/90 backdrop-blur-xl rounded-xl shadow hover:shadow-md transition-all duration-300 overflow-hidden h-[200px] flex flex-col"
            >
              {/* Kart Başlığı */}
              <div className="px-4 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900 group-hover:text-red-600 transition-colors truncate pr-4">
                    {denetim.subeAdi}
                  </h3>
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-50 text-red-500">
                    <span className="text-sm font-bold">{denetim.sonuc.toplamPuan}</span>
                  </div>
                </div>
              </div>

              {/* Kart İçeriği */}
              <div className="flex-1 px-4 py-3">
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" 
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="truncate">{denetim.denetimci.ad} {denetim.denetimci.soyad}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" 
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="truncate">
                      {new Date(denetim.denetimTarihi).toLocaleDateString('tr-TR')}
                      <span className="text-xs text-gray-500 ml-2">
                        {new Date(denetim.denetimTarihi).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Kart Alt Kısmı */}
              <div className="px-4 py-3 bg-gray-50/50 flex items-center gap-2">
                <Link
                  to={`/panel/denetim/${denetim.id}`}
                  className="flex items-center justify-center flex-1 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-200"
                >
                  <span>Detaylar</span>
                  <svg className="ml-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link
                  to={`/panel/denetim-analiz/${denetim.id}`}
                  className="flex items-center justify-center flex-1 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-all duration-200"
                >
                  <span>Analiz</span>
                  <svg className="ml-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </Link>
                <button
                  onClick={() => setSilinecekDenetim(denetim)}
                  className="flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-red-600 bg-white hover:bg-red-50 rounded-lg transition-all duration-200 border border-gray-200"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Silme Onay Modalı */}
        {silinecekDenetim && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setSilinecekDenetim(null)}></div>

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
                      Denetimi Sil
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Bu denetimi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                      </p>
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-900">{silinecekDenetim.subeAdi}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(silinecekDenetim.denetimTarihi).toLocaleDateString('tr-TR')} - 
                          {silinecekDenetim.denetimci.ad} {silinecekDenetim.denetimci.soyad}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={() => handleDenetimSil(silinecekDenetim.id)}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Sil
                  </button>
                  <button
                    type="button"
                    onClick={() => setSilinecekDenetim(null)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    İptal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sonuç Bulunamadı */}
        {filteredDenetimler.length === 0 && (
          <div className="bg-white/90 backdrop-blur-xl rounded-xl shadow p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-red-50 flex items-center justify-center">
              <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Sonuç Bulunamadı</h3>
            <p className="text-sm text-gray-500">Arama kriterlerinize uygun denetim kaydı bulunamamıştır.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DenetimlerPage; 