/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { realdb } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { getStorage, ref as storageRef, getDownloadURL } from 'firebase/storage';
import ImageViewer from '../../components/imageviewer';

function SubeDenetimDetay() {
  const { id } = useParams();
  const { user } = useAuth();
  const [denetim, setDenetim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageUrls, setImageUrls] = useState({});
  const [kategoriler, setKategoriler] = useState({});

  useEffect(() => {
    let mounted = true;

    const loadDenetimData = async () => {
      if (!id) {
        console.error('Denetim ID yok:', id);
        setError('Denetim ID bulunamadı');
        setLoading(false);
        return;
      }

      try {
        // Kategorileri yükle
        const kategorilerRef = ref(realdb, 'kategoriler');
        const kategorilerSnapshot = await get(kategorilerRef);
        if (kategorilerSnapshot.exists() && mounted) {
          setKategoriler(kategorilerSnapshot.val());
        }

        console.log('Kullanıcı bilgisi:', user);
        console.log('Aranan denetim ID:', id);
        const denetimRef = ref(realdb, 'denetimler/' + id);
        const denetimSnapshot = await get(denetimRef);
        
        console.log('Denetim snapshot exists:', denetimSnapshot.exists());
        
        if (!mounted) return;

        if (denetimSnapshot.exists()) {
          const denetimData = denetimSnapshot.val();
          console.log('Bulunan denetim verisi:', denetimData);
          console.log('Şube karşılaştırması:', {
            denetimSubeAdi: denetimData.subeAdi,
            userBranchName: user.branchName,
            eslesme: denetimData.subeAdi === user.branchName
          });

          if (denetimData.subeAdi === user.branchName) {
            console.log('Denetim bulundu ve şube eşleşti');
            
            // Form bilgilerini al
            const formRef = ref(realdb, `denetimFormlari/${denetimData.formId}`);
            const formSnapshot = await get(formRef);
            const formData = formSnapshot.exists() ? formSnapshot.val() : null;

            // Yanıtları array'e dönüştür
            const yanitlarArray = Object.entries(denetimData.yanitlar || {}).map(([soruKey, yanit]) => {
              const soruIndex = parseInt(soruKey.split('_')[1]) - 1;
              const soruBilgisi = formData?.sorular?.[soruIndex] || {};
              
              return {
                id: soruKey,
                kategori: soruBilgisi.kategoriId || yanit.kategoriId,
                soru: yanit.soru,
                tip: yanit.tip,
                yanit: yanit.yanit,
                puan: yanit.puan || 0,
                aciklama: yanit.aciklama || '',
                fotograflar: yanit.fotograflar || {},
                secenekler: yanit.secenekler || {},
                toplamPuan: yanit.toplamPuan || 0
              };
            });

            // Denetim verisini düzenle
            setDenetim({
              ...denetimData,
              id: id,
              formBilgisi: formData,
              sorular: yanitlarArray
            });
          } else {
            console.log('Şube eşleşmedi:', {
              denetimSubeAdi: denetimData.subeAdi,
              userBranchName: user.branchName
            });
            setError('Bu denetimi görüntüleme yetkiniz yok');
          }
        } else {
          console.log('Denetim bulunamadı');
          setError('Denetim bulunamadı');
        }
      } catch (error) {
        console.error('Veri yüklenirken hata:', error);
        setError('Denetim yüklenirken bir hata oluştu');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    loadDenetimData();

    return () => {
      mounted = false;
    };
  }, [id, user.branchName]);

  // Görselleri yükle
  useEffect(() => {
    const loadImages = async () => {
      if (!denetim?.sorular) return;

      const newImageUrls = {};
      const storage = getStorage();

      for (const soru of denetim.sorular) {
        // Evet/Hayır soruları için fotoğraflar
        if (soru.fotograflar && Object.keys(soru.fotograflar).length > 0) {
          for (const [key, foto] of Object.entries(soru.fotograflar)) {
            try {
              if (!foto) continue;
              
              let imagePath = '';
              if (typeof foto === 'string') {
                imagePath = foto.startsWith('/') ? foto.substring(1) : foto;
              } else if (typeof foto === 'object') {
                imagePath = foto.path || foto.url || '';
              }

              if (!imagePath) {
                console.warn('Geçersiz fotoğraf yolu:', foto);
                continue;
              }

              console.log('Yüklenen fotoğraf yolu:', imagePath);
              const imageRef = storageRef(storage, imagePath);
              const url = await getDownloadURL(imageRef);
              newImageUrls[foto] = url;
              console.log('Fotoğraf başarıyla yüklendi:', url);
            } catch (error) {
              console.error('Fotoğraf yüklenirken hata:', error, foto);
              newImageUrls[foto] = null;
            }
          }
        }

        // Çoklu seçim soruları için fotoğraflar
        if (soru.tip === 'coklu_secim' && soru.secenekler) {
          for (const secenek of Object.values(soru.secenekler)) {
            if (secenek.fotograflar && Object.keys(secenek.fotograflar).length > 0) {
              for (const [key, foto] of Object.entries(secenek.fotograflar)) {
                try {
                  if (!foto) continue;
                  
                  let imagePath = '';
                  if (typeof foto === 'string') {
                    imagePath = foto.startsWith('/') ? foto.substring(1) : foto;
                  } else if (typeof foto === 'object') {
                    imagePath = foto.path || foto.url || '';
                  }

                  if (!imagePath) {
                    console.warn('Geçersiz fotoğraf yolu:', foto);
                    continue;
                  }

                  console.log('Yüklenen fotoğraf yolu:', imagePath);
                  const imageRef = storageRef(storage, imagePath);
                  const url = await getDownloadURL(imageRef);
                  newImageUrls[foto] = url;
                  console.log('Fotoğraf başarıyla yüklendi:', url);
                } catch (error) {
                  console.error('Fotoğraf yüklenirken hata:', error, foto);
                  newImageUrls[foto] = null;
                }
              }
            }
          }
        }
      }

      setImageUrls(newImageUrls);
    };

    loadImages();
  }, [denetim]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  if (error || !denetim) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {error || 'Denetim Bulunamadı'}
          </h1>
          <p className="text-gray-600 mb-4">İstediğiniz denetim kaydına ulaşılamadı.</p>
          <Link
            to="/sube-panel/denetimler"
            className="inline-flex items-center text-red-600 hover:text-red-500"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
            </svg>
            Denetimlere Dön
          </Link>
        </div>
      </div>
    );
  }

  // Görsel gösterimi için bileşen
  const ImageComponent = ({ imageUrl, index }) => {
    if (!imageUrl) {
      return (
        <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      );
    }

    return (
      <img
        src={imageUrl}
        alt={`Detay ${index + 1}`}
        className="w-20 h-20 object-cover rounded-lg hover:opacity-90 transition-opacity"
      />
    );
  };

  // Fotoğraflar bölümünü güncelle
  const renderFotograflar = (fotograflar) => {
    if (!fotograflar || Object.keys(fotograflar).length === 0) return null;

    return (
      <div className="mt-2">
        <p className="text-xs text-gray-500 mb-2">Fotoğraflar:</p>
        <div className="flex flex-wrap gap-2">
          {Object.values(fotograflar).map((foto, index) => (
            <div
              key={index}
              className="relative group cursor-pointer"
              onClick={() => imageUrls[foto] && setSelectedImage(imageUrls[foto])}
            >
              <ImageComponent imageUrl={imageUrls[foto]} index={index} />
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg">
                <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Üst Bar */}
      <div className="mb-8">
        <div className="sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center">
            <Link
              to="/sube-panel/denetimler"
              className="mr-4 text-gray-500 hover:text-gray-900"
            >
              ←
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              Denetim Detayları
            </h1>
          </div>
        </div>
      </div>

      {/* Denetim Bilgileri */}
      <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100 mb-8">
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Denetim Bilgileri
          </h3>
        </div>
        <div className="px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Genel Bilgiler */}
            <div className="col-span-2 border-b border-gray-200 pb-4 mb-4">
              <h4 className="text-sm font-medium text-gray-500 mb-3">Genel Bilgiler</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Denetim Tarihi</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {new Date(denetim.denetimTarihi).toLocaleDateString('tr-TR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Toplam Puan</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{denetim.sonuc?.toplamPuan || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Durum</p>
                  <p className={`mt-1 text-sm font-medium ${
                    (denetim.sonuc?.toplamPuan || 0) >= 80
                      ? 'text-green-600'
                      : (denetim.sonuc?.toplamPuan || 0) >= 60
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  }`}>
                    {(denetim.sonuc?.toplamPuan || 0) >= 80
                      ? 'Başarılı'
                      : (denetim.sonuc?.toplamPuan || 0) >= 60
                      ? 'İyileştirme Gerekli'
                      : 'Başarısız'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Bilgileri */}
      <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100 mb-8">
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Form Bilgileri</h3>
        </div>
        <div className="px-6 py-5">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Form Adı</h3>
              <p className="mt-1 text-gray-900">{denetim.formBilgisi?.baslik || denetim.formAdi}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Form Açıklaması</h3>
              <p className="mt-1 text-gray-900">{denetim.formBilgisi?.aciklama || denetim.formAciklama}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Yanıtlar */}
      <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Denetim Yanıtları</h3>
        </div>
        <div className="px-6 py-5">
          <div className="space-y-6">
            {denetim.sorular?.map((soru) => (
              <div key={soru.id} className="bg-gray-50 rounded-lg p-4">
                <div className="space-y-2">
                  {/* Kategori etiketi */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                      {kategoriler[soru.kategori]?.label || 'Kategorisiz'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {soru.soru}
                  </p>
                  
                  {/* Evet/Hayır soruları */}
                  {soru.tip === 'evet_hayir' && (
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        soru.yanit === 'evet' 
                          ? 'bg-green-100 text-green-800'
                          : soru.yanit === 'hayir'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}>
                        {soru.yanit === 'evet' ? 'Evet' : soru.yanit === 'hayir' ? 'Hayır' : 'Yanıtsız'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {soru.puan} puan
                      </span>
                    </div>
                  )}

                  {/* Çoklu seçim soruları */}
                  {soru.tip === 'coklu_secim' && (
                    <div className="space-y-3">
                      {Object.entries(soru.secenekler || {}).map(([secenekMetin, secenekData], idx) => (
                        <div key={idx} className="flex flex-col gap-2 bg-white p-3 rounded-lg">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-900">{secenekMetin}</p>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                secenekData.yanit === 'evet'
                                  ? 'bg-green-100 text-green-800'
                                  : secenekData.yanit === 'hayir'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-800'
                              }`}>
                                {secenekData.yanit === 'evet' ? 'Evet' : secenekData.yanit === 'hayir' ? 'Hayır' : 'Yanıtsız'}
                              </span>
                              {secenekData.yanit === 'evet' && (
                                <span className="text-xs text-gray-500">
                                  {secenekData.puan} puan
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Seçenek açıklaması */}
                          {secenekData.aciklama && (
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Açıklama:</span> {secenekData.aciklama}
                            </p>
                          )}

                          {/* Seçenek fotoğrafları */}
                          {secenekData.fotograflar && Object.keys(secenekData.fotograflar).length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 mb-2">Fotoğraflar:</p>
                              <div className="flex flex-wrap gap-2">
                                {Object.values(secenekData.fotograflar).map((foto, fotoIndex) => (
                                  <div
                                    key={fotoIndex}
                                    className="relative group cursor-pointer"
                                    onClick={() => imageUrls[foto] && setSelectedImage(imageUrls[foto])}
                                  >
                                    <ImageComponent imageUrl={imageUrls[foto]} index={fotoIndex} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      <div className="mt-2 text-xs text-gray-500">
                        Toplam Puan: {soru.toplamPuan}
                      </div>
                    </div>
                  )}

                  {/* Uzun metin soruları */}
                  {soru.tip === 'uzun_metin' && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-600">
                        {soru.yanit || 'Yanıt verilmemiş'}
                      </p>
                    </div>
                  )}

                  {/* Evet/Hayır detayları */}
                  {soru.tip === 'evet_hayir' && (
                    <div className="mt-2">
                      {soru.yanit === 'hayir' && (
                        <>
                          {soru.aciklama && (
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Açıklama:</span> {soru.aciklama}
                            </p>
                          )}
                          {renderFotograflar(soru.fotograflar)}
                        </>
                      )}
                      {soru.yanit === 'evet' && soru.aciklama && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Açıklama:</span> {soru.aciklama}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ImageViewer Modal */}
      {selectedImage && (
        <ImageViewer
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
}

export default SubeDenetimDetay; 