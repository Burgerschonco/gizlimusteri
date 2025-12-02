import { useState, useEffect } from 'react';
import { realdb } from '../../firebase/config';
import { ref, get, set, remove } from 'firebase/database';
import { toast } from 'react-hot-toast';

export default function DenetimKategorilerPage() {
  const [kategoriler, setKategoriler] = useState([]);
  const [yeniKategori, setYeniKategori] = useState({ id: '', label: '', order: 0 });
  const [duzenlemeModu, setDuzenlemeModu] = useState(false);
  const [duzenlenecekKategori, setDuzenlenecekKategori] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Kategori adından ID oluştur
  const generateIdFromLabel = (label) => {
    return label
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_');
  };

  // Kategorileri yükle
  useEffect(() => {
    const fetchKategoriler = async () => {
      try {
        const kategorilerRef = ref(realdb, 'kategoriler');
        const snapshot = await get(kategorilerRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          const kategorilerArray = Object.entries(data).map(([id, kategori]) => ({
            id,
            ...kategori,
            order: kategori.order || 0
          }));
          // Sıralama numarasına göre sırala
          kategorilerArray.sort((a, b) => a.order - b.order);
          setKategoriler(kategorilerArray);
        }
      } catch (error) {
        console.error('Kategoriler yüklenirken hata:', error);
        toast.error('Kategoriler yüklenirken bir hata oluştu');
      }
    };

    fetchKategoriler();
  }, []);

  const handleSiraDegistir = async (kategori, yeniSira) => {
    try {
      const kategorilerRef = ref(realdb, 'kategoriler');
      
      // Hedef kategoriyi ve yer değiştireceği kategoriyi bul
      const eskiSira = kategori.order;
      const hedefKategori = kategoriler.find(k => k.order === yeniSira);
      
      if (!hedefKategori) return;

      // Kategorileri güncelle
      const yeniKategoriler = {};
      kategoriler.forEach(k => {
        if (k.id === kategori.id) {
          // Taşınan kategori
          yeniKategoriler[k.id] = {
            ...k,
            order: yeniSira
          };
        } else if (k.id === hedefKategori.id) {
          // Yer değiştirilen kategori
          yeniKategoriler[k.id] = {
            ...k,
            order: eskiSira
          };
        } else {
          // Diğer kategoriler
          yeniKategoriler[k.id] = k;
        }
      });

      // Firebase'i güncelle
      await set(kategorilerRef, yeniKategoriler);
      
      // State'i güncelle
      const yeniKategorilerArray = Object.entries(yeniKategoriler).map(([id, data]) => ({
        id,
        ...data
      }));
      yeniKategorilerArray.sort((a, b) => a.order - b.order);
      setKategoriler(yeniKategorilerArray);
      
      toast.success('Kategori sırası güncellendi');
    } catch (error) {
      console.error('Sıralama güncellenirken hata:', error);
      toast.error('Sıralama güncellenirken bir hata oluştu');
    }
  };

  // Kategori ekle/düzenle
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (duzenlemeModu) {
        // Kategori güncelle
        const yeniId = generateIdFromLabel(duzenlenecekKategori.label);
        const eskiId = duzenlenecekKategori.id;

        if (eskiId !== yeniId) {
          // Eski kategoriyi sil
          await remove(ref(realdb, `kategoriler/${eskiId}`));
          
          // Yeni ID ile kaydet
          await set(ref(realdb, `kategoriler/${yeniId}`), {
            id: yeniId,
            label: duzenlenecekKategori.label,
            order: duzenlenecekKategori.order || 0
          });
          toast.success('Kategori başarıyla güncellendi');
        } else {
          // Sadece label güncelleniyor
          await set(ref(realdb, `kategoriler/${eskiId}`), {
            id: eskiId,
            label: duzenlenecekKategori.label,
            order: duzenlenecekKategori.order || 0
          });
          toast.success('Kategori başarıyla güncellendi');
        }
        setDuzenlemeModu(false);
        setDuzenlenecekKategori(null);
      } else {
        // Yeni kategori ekle
        if (!yeniKategori.label) {
          toast.error('Lütfen kategori adını girin');
          return;
        }

        // ID'yi küçük harf ve tire ile formatla
        const formattedId = generateIdFromLabel(yeniKategori.label);
        
        // En yüksek sıra numarasını bul
        const maxOrder = Math.max(...kategoriler.map(k => k.order || 0), 0);
        
        await set(ref(realdb, `kategoriler/${formattedId}`), {
          id: formattedId,
          label: yeniKategori.label,
          order: maxOrder + 1
        });

        toast.success('Kategori başarıyla eklendi');
        setYeniKategori({ id: '', label: '', order: 0 });
      }

      // Kategorileri yeniden yükle
      const kategorilerRef = ref(realdb, 'kategoriler');
      const snapshot = await get(kategorilerRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const kategorilerArray = Object.entries(data).map(([id, kategori]) => ({
          id,
          ...kategori,
          order: kategori.order || 0
        }));
        kategorilerArray.sort((a, b) => a.order - b.order);
        setKategoriler(kategorilerArray);
      }
    } catch (error) {
      console.error('Kategori eklenirken hata:', error);
      toast.error('Bir hata oluştu');
    }
  };

  // Kategori sil
  const handleDelete = async (kategoriId) => {
    if (window.confirm('Bu kategoriyi silmek istediğinizden emin misiniz?')) {
      try {
        await remove(ref(realdb, `kategoriler/${kategoriId}`));
        toast.success('Kategori başarıyla silindi');
        setKategoriler(kategoriler.filter(k => k.id !== kategoriId));
      } catch (error) {
        console.error('Kategori silinirken hata:', error);
        toast.error('Bir hata oluştu');
      }
    }
  };

  // Filtrelenmiş kategoriler
  const filteredKategoriler = kategoriler.filter(kategori =>
    kategori.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    kategori.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 pb-20">
      {/* Başlık ve İstatistikler */}
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
          Denetim Kategorileri
        </h1>
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-full sm:w-auto bg-white rounded-lg shadow-sm p-4 flex items-center space-x-3">
            <div className="bg-red-100 p-2 rounded-lg">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Toplam Kategori</p>
              <p className="text-xl font-semibold text-gray-800">{kategoriler.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ana İçerik */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
        {/* Sol Panel - Kategori Ekleme/Düzenleme */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {duzenlemeModu ? 'Kategori Düzenle' : 'Yeni Kategori Ekle'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategori Adı
                </label>
                <input
                  type="text"
                  value={duzenlemeModu ? duzenlenecekKategori?.label : yeniKategori.label}
                  onChange={(e) => {
                    const newLabel = e.target.value;
                    const newId = generateIdFromLabel(newLabel);
                    
                    if (duzenlemeModu) {
                      setDuzenlenecekKategori({
                        ...duzenlenecekKategori,
                        label: newLabel,
                        id: duzenlenecekKategori.id // Düzenleme modunda ID değişmez
                      });
                    } else {
                      setYeniKategori({
                        label: newLabel,
                        id: newId,
                        order: 0
                      });
                    }
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  placeholder="Örnek: Temizlik ve Hijyen"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategori ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={duzenlemeModu ? duzenlenecekKategori?.id : yeniKategori.id}
                    disabled
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-500"
                    placeholder="Otomatik oluşturulacak"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
                <p className="mt-1 text-sm text-gray-500">ID otomatik olarak oluşturulur</p>
              </div>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  type="submit"
                  className="w-full sm:flex-1 bg-red-600 text-white px-4 py-3 sm:py-2 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-colors duration-200"
                >
                  {duzenlemeModu ? 'Güncelle' : 'Ekle'}
                </button>
                {duzenlemeModu && (
                  <button
                    type="button"
                    onClick={() => {
                      setDuzenlemeModu(false);
                      setDuzenlenecekKategori(null);
                    }}
                    className="w-full sm:flex-1 bg-gray-100 text-gray-700 px-4 py-3 sm:py-2 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500/20 transition-colors duration-200"
                  >
                    İptal
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Sağ Panel - Kategori Listesi */}
        <div className="lg:col-span-2 order-1 lg:order-2">
          {/* Arama */}
          <div className="mb-4 sm:mb-6">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 sm:py-2.5 bg-white rounded-xl border border-gray-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                placeholder="Kategori ara..."
              />
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Kategori Listesi */}
          <div className="space-y-4">
            {filteredKategoriler.map((kategori, index) => (
              <div
                key={kategori.id}
                className="bg-white rounded-xl shadow-sm p-3 sm:p-4 hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                  <div className="flex-1 min-w-0 mb-2 sm:mb-0">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleSiraDegistir(kategori, Math.max(1, kategori.order - 1))}
                          disabled={index === 0}
                          className="text-gray-500 hover:text-gray-700 disabled:opacity-50 p-1.5 sm:p-1"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => handleSiraDegistir(kategori, Math.min(kategoriler.length, kategori.order + 1))}
                          disabled={index === kategoriler.length - 1}
                          className="text-gray-500 hover:text-gray-700 disabled:opacity-50 p-1.5 sm:p-1"
                        >
                          ↓
                        </button>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 truncate">
                        {kategori.label}
                      </h3>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      ID: {kategori.id}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3 sm:space-x-2 sm:ml-4">
                    <button
                      onClick={() => {
                        setDuzenlemeModu(true);
                        setDuzenlenecekKategori(kategori);
                      }}
                      className="p-2.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                      title="Düzenle"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(kategori.id)}
                      className="p-2.5 sm:p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                      title="Sil"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {filteredKategoriler.length === 0 && (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">Kategori Bulunamadı</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm ? 'Arama kriterlerinize uygun kategori bulunamadı.' : 'Henüz hiç kategori eklenmemiş.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 