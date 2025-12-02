import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { realdb } from '../../firebase/config';
import { ref, get } from 'firebase/database';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Line,
  ComposedChart,
  LineChart
} from 'recharts';

const COLORS = ['#ef4444', '#22c55e', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function DenetimAnalizPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [denetim, setDenetim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subeGecmisi, setSubeGecmisi] = useState([]);
  const [kategoriAnalizi, setKategoriAnalizi] = useState([]);
  const [aylikTrend, setAylikTrend] = useState([]);
  const [sorunAlanları, setSorunAlanları] = useState([]);
  const [kategoriler, setKategoriler] = useState([]);
  const [soruAnalizleri, setSoruAnalizleri] = useState([]);
  const [yetkisizErisim, setYetkisizErisim] = useState(false);

  // Kategorileri ve denetim verilerini yükle
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!user) {
          setLoading(false);
          return;
        }

        setLoading(true);
        console.log('Veri yükleme başladı');

        // Denetim verilerini al
        const denetimRef = ref(realdb, `denetimler/${id}`);
        const denetimSnapshot = await get(denetimRef);
        
        if (!denetimSnapshot.exists()) {
          console.log('Denetim bulunamadı:', id);
          setDenetim(null);
          setLoading(false);
          return;
        }

        const denetimData = denetimSnapshot.val();

        // Şube yetkisi kontrolü
        if (denetimData.subeAdi !== user.branchName) {
          console.log('Yetkisiz erişim denemesi');
          setYetkisizErisim(true);
          setLoading(false);
          return;
        }

        // Kategorileri al
        const kategorilerRef = ref(realdb, 'kategoriler');
        const kategorilerSnapshot = await get(kategorilerRef);
        const kategorilerData = kategorilerSnapshot.exists() ? kategorilerSnapshot.val() : {};
        const kategorilerArray = Object.entries(kategorilerData).map(([id, kategori]) => ({
          id,
          ...kategori,
          order: kategori.order || 0
        })).sort((a, b) => a.order - b.order);
        
        console.log('Kategoriler yüklendi:', kategorilerArray);
        setKategoriler(kategorilerArray);

        if (!denetimData.formId) {
          console.log('Form ID bulunamadı');
          setDenetim(null);
          setLoading(false);
          return;
        }

        // Form verilerini al
        const formRef = ref(realdb, `denetimFormlari/${denetimData.formId}`);
        const formSnapshot = await get(formRef);
        
        if (!formSnapshot.exists()) {
          console.log('Form bulunamadı:', denetimData.formId);
          setDenetim(null);
          setLoading(false);
          return;
        }

        const formData = formSnapshot.val();
        console.log('Form verisi:', formData);

        // Veri yapısını kontrol et
        const processedData = {
          ...denetimData,
          formBilgisi: formData,
          subeAdi: denetimData.subeAdi || 'Bilinmeyen Şube',
          denetimTarihi: denetimData.denetimTarihi || new Date().toISOString(),
          sonuc: {
            toplamPuan: denetimData.sonuc?.toplamPuan || 0,
            yuzde: denetimData.sonuc?.yuzde || 0
          },
          yanitlar: denetimData.yanitlar || {}
        };

        console.log('İşlenmiş denetim verisi:', processedData);
        setDenetim(processedData);

        // Şubenin tüm denetimlerini al
        const tumDenetimlerRef = ref(realdb, 'denetimler');
        const tumDenetimlerSnapshot = await get(tumDenetimlerRef);
        
        if (tumDenetimlerSnapshot.exists()) {
          const tumDenetimler = Object.entries(tumDenetimlerSnapshot.val())
            .map(([key, value]) => ({ 
              id: key, 
              ...value,
              subeId: value.subeId,
              sonuc: {
                toplamPuan: value.sonuc?.toplamPuan || 0,
                yuzde: value.sonuc?.yuzde || 0
              }
            }))
            .filter(d => d.subeAdi === user.branchName);

          // Şubenin geçmiş denetimleri
          const subeninDenetimleri = tumDenetimler
            .sort((a, b) => new Date(b.denetimTarihi) - new Date(a.denetimTarihi));
          setSubeGecmisi(subeninDenetimleri);

          // Aylık trend analizi
          const sonAltıAy = new Array(6).fill(0).map((_, i) => {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            return {
              ay: date.toLocaleString('tr-TR', { month: 'long' }),
              tarih: date,
              puan: 0,
              denetimSayisi: 0
            };
          }).reverse();

          subeninDenetimleri.forEach(denetim => {
            const denetimTarihi = new Date(denetim.denetimTarihi);
            const ayIndex = sonAltıAy.findIndex(ay => 
              ay.tarih.getMonth() === denetimTarihi.getMonth() &&
              ay.tarih.getFullYear() === denetimTarihi.getFullYear()
            );
            if (ayIndex !== -1) {
              sonAltıAy[ayIndex].puan += denetim.sonuc?.toplamPuan || 0;
              sonAltıAy[ayIndex].denetimSayisi++;
            }
          });

          sonAltıAy.forEach(ay => {
            ay.puan = ay.denetimSayisi > 0 ? Math.round(ay.puan / ay.denetimSayisi) : 0;
          });

          setAylikTrend(sonAltıAy);

          // Kategori analizi
          let kategoriSonuclari = [];
          if (formData && formData.sorular) {
            kategoriSonuclari = kategoriler.map(kategori => {
              // Her kategoriye ait soruları bul
              const kategoriSorulari = Object.entries(formData.sorular)
                .filter(([soruId, soru]) => {
                  // Hem kategoriId hem de yanıt kontrolü yap
                  const yanitVar = denetimData.yanitlar && soruId in denetimData.yanitlar;
                  return soru.kategoriId === kategori.id && yanitVar;
                })
                .map(([soruId, soru]) => ({
                  id: soruId,
                  ...soru,
                  yanit: denetimData.yanitlar[soruId]
                }));

              console.log(`${kategori.label} kategorisi soruları:`, kategoriSorulari);
              
              // Alınan puanı hesapla
              const alinanPuan = kategoriSorulari.reduce((toplam, soru) => {
                if (soru.yanit.tip === 'evet_hayir') {
                  // Evet/Hayır soruları için puan hesaplama
                  return toplam + (soru.yanit.yanit === 'evet' ? Number(soru.puan) : 0);
                } else if (soru.yanit.tip === 'coklu_secim') {
                  // Çoklu seçim soruları için puan hesaplama
                  return toplam + (soru.yanit.toplamPuan || 0);
                }
                return toplam;
              }, 0);

              // Toplam puanı hesapla
              const toplamPuan = kategoriSorulari.reduce((toplam, soru) => {
                if (soru.tip === 'evet_hayir') {
                  return toplam + Number(soru.puan);
                } else if (soru.tip === 'coklu_secim') {
                  return toplam + soru.secenekler.reduce((secenekToplam, secenek) => 
                    secenekToplam + Number(secenek.puan || 0), 0);
                }
                return toplam;
              }, 0);

              // Doğru cevap sayısını hesapla
              const dogruSayisi = kategoriSorulari.reduce((toplam, soru) => {
                if (soru.yanit.tip === 'evet_hayir') {
                  return toplam + (soru.yanit.yanit === 'evet' ? 1 : 0);
                } else if (soru.yanit.tip === 'coklu_secim') {
                  const evetSayisi = Object.values(soru.yanit.secenekler || {})
                    .filter(secenek => secenek.yanit === 'evet').length;
                  return toplam + (evetSayisi > 0 ? 1 : 0);
                }
                return toplam;
              }, 0);

              // Toplam soru sayısını hesapla
              const toplamSoru = kategoriSorulari.length;

              console.log(`${kategori.label} sonuçları:`, {
                alinanPuan,
                toplamPuan,
                dogruSayisi,
                toplamSoru
              });

              return {
                name: kategori.label,
                puan: toplamPuan > 0 ? Math.round((alinanPuan / toplamPuan) * 100) : 0,
                toplamSoru: toplamSoru,
                dogruSayisi: dogruSayisi,
                alinanPuan: alinanPuan,
                maxPuan: toplamPuan
              };
            }).filter(kategori => kategori.toplamSoru > 0);

            console.log('Kategori analizi sonuçları:', kategoriSonuclari);
            setKategoriAnalizi(kategoriSonuclari);
          }

          // Sorun alanlarını belirle
          const sorunlar = kategoriSonuclari
            .filter(k => k.dogruSayisi < k.toplamSoru)
            .map(k => ({
              kategori: k.name,
              puan: k.puan,
              iyilestirmeGerekli: k.toplamSoru - k.dogruSayisi,
              alinanPuan: k.alinanPuan,
              maxPuan: k.maxPuan
            }))
            .sort((a, b) => a.puan - b.puan);

          console.log('Sorun alanları:', sorunlar);
          setSorunAlanları(sorunlar);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Veri yüklenirken hata:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user?.branchName]);

  // Soru analizlerini hesapla
  useEffect(() => {
    if (denetim?.formId && denetim?.yanitlar && user) {
      console.log('Denetim yanitları:', denetim.yanitlar);
      const formRef = ref(realdb, `denetimFormlari/${denetim.formId}`);
      get(formRef).then((snapshot) => {
        if (snapshot.exists()) {
          const formData = snapshot.val();
          console.log('Form verisi:', formData);
          
          // Tüm denetimleri al
          const denetimlerRef = ref(realdb, 'denetimler');
          get(denetimlerRef).then((denetimlerSnapshot) => {
            if (denetimlerSnapshot.exists()) {
              const tumDenetimler = Object.entries(denetimlerSnapshot.val())
                .map(([key, value]) => ({ id: key, ...value }))
                .filter(d => d.formId === denetim.formId && d.subeAdi === user.branchName)
                .sort((a, b) => new Date(b.denetimTarihi) - new Date(a.denetimTarihi));

              console.log('Tüm denetimler:', tumDenetimler);

              // Her soru için analiz yap
              const analizler = Object.entries(formData.sorular || {}).map(([soruId, soru]) => {
                console.log(`Soru analizi başlıyor - ID: ${soruId}`, soru);
                
                // Yanıt ID'sini düzelt
                const yanitId = `soru_${parseInt(soruId) + 1}`;
                console.log(`Yanıt ID'si:`, yanitId);
                
                // Son 6 denetimin trendi
                const trend = tumDenetimler.slice(0, 6).map(d => {
                  const yanit = d.yanitlar?.[yanitId];
                  console.log(`Denetim ${d.id} için yanıt:`, yanit);

                  if (!yanit) return { 
                    tarih: new Date(d.denetimTarihi).toLocaleDateString('tr-TR'), 
                    puan: 0 
                  };

                  if (soru.tip === 'evet_hayir') {
                    return {
                      tarih: new Date(d.denetimTarihi).toLocaleDateString('tr-TR'),
                      puan: yanit.yanit === 'evet' ? 100 : 0
                    };
                  } else if (soru.tip === 'coklu_secim') {
                    let secilenPuan = 0;
                    let maxPuan = 0;

                    // Seçenekleri kontrol et
                    Object.entries(yanit.secenekler || {}).forEach(([secenekMetin, secenekYanit]) => {
                      secilenPuan += secenekYanit.yanit === 'evet' ? Number(secenekYanit.puan || 0) : 0;
                      maxPuan += Number(secenekYanit.puan || 0);
                    });

                    return {
                      tarih: new Date(d.denetimTarihi).toLocaleDateString('tr-TR'),
                      puan: maxPuan > 0 ? Math.round((secilenPuan / maxPuan) * 100) : 0
                    };
                  }
                  return { 
                    tarih: new Date(d.denetimTarihi).toLocaleDateString('tr-TR'), 
                    puan: 0 
                  };
                }).reverse();

                // Başarı oranı hesapla
                let toplamPuan = 0;
                let maxToplamPuan = 0;
                tumDenetimler.forEach(d => {
                  const yanit = d.yanitlar?.[yanitId];
                  if (!yanit) return;

                  if (soru.tip === 'evet_hayir') {
                    toplamPuan += yanit.yanit === 'evet' ? 100 : 0;
                    maxToplamPuan += 100;
                  } else if (soru.tip === 'coklu_secim') {
                    let denetimPuan = 0;
                    let denetimMaxPuan = 0;

                    Object.entries(yanit.secenekler || {}).forEach(([secenekMetin, secenekYanit]) => {
                      const secenek = soru.secenekler.find(s => s.metin === secenekYanit.metin);
                      if (secenek) {
                        if (secenekYanit.yanit === 'evet') {
                          denetimPuan += Number(secenek.puan || 0);
                        }
                        denetimMaxPuan += Number(secenek.puan || 0);
                      }
                    });

                    if (denetimMaxPuan > 0) {
                      toplamPuan += (denetimPuan / denetimMaxPuan) * 100;
                      maxToplamPuan += 100;
                    }
                  }
                });

                const basariOrani = maxToplamPuan > 0 ? toplamPuan / maxToplamPuan * 100 : 0;

                // Seçenek bazlı başarı oranları (çoklu seçim için)
                const secenekAnalizleri = soru.tip === 'coklu_secim' ? 
                  Object.entries(denetim.yanitlar[yanitId]?.secenekler || {}).map(([secenekMetin, secenekYanit]) => {
                    let secenekToplamPuan = 0;
                    let secenekMaxPuan = 0;

                    tumDenetimler.forEach(d => {
                      const denetimYanit = d.yanitlar?.[yanitId];
                      if (!denetimYanit?.secenekler?.[secenekMetin]) return;

                      const denetimSecenekYanit = denetimYanit.secenekler[secenekMetin];
                      secenekToplamPuan += denetimSecenekYanit.yanit === 'evet' ? 100 : 0;
                      secenekMaxPuan += 100;
                    });

                    return {
                      metin: secenekMetin,
                      puan: Number(secenekYanit.puan || 0),
                      basariOrani: secenekMaxPuan > 0 ? (secenekToplamPuan / secenekMaxPuan) * 100 : 0
                    };
                  }) : [];

                console.log(`Soru analizi tamamlandı - ID: ${soruId}`, {
                  basariOrani,
                  trend,
                  secenekAnalizleri
                });

                return {
                  id: soruId,
                  soru: soru.soru,
                  kategoriId: soru.kategoriId,
                  tip: soru.tip,
                  puan: Number(soru.puan || 0),
                  basariOrani,
                  trend,
                  secenekler: secenekAnalizleri
                };
              });

              console.log('Tüm analizler:', analizler);
              setSoruAnalizleri(analizler);
            }
          });
        }
      });
    }
  }, [denetim?.formId, denetim?.yanitlar, user?.branchName]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (yetkisizErisim) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Yetkisiz Erişim</h2>
        <p className="text-gray-600 mb-8">
          Bu denetim raporunu görüntüleme yetkiniz bulunmamaktadır.
        </p>
        <Link
          to="/sube-panel/denetimler"
          className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          Denetimlere Dön
        </Link>
      </div>
    );
  }

  if (!denetim) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Denetim Bulunamadı</h2>
        <p className="text-gray-600 mb-8">
          Denetim ID: {id} <br/>
          Bu ID'ye sahip bir denetim kaydı bulunamadı.
        </p>
        <Link
          to="/sube-panel/denetimler"
          className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          Denetimlere Dön
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Üst Bilgi Kartı */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{denetim.formAdi || 'Denetim Formu'}</h2>
            <p className="text-gray-600">
              Denetim Tarihi: {new Date(denetim.denetimTarihi).toLocaleDateString('tr-TR')}
            </p>
          </div>
          <Link
            to="/sube-panel/denetimler"
            className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Denetimlere Dön
          </Link>
        </div>
      </div>

      {/* Genel Değerlendirme */}
      <div className="mb-6 bg-white p-4 sm:p-6 rounded-lg shadow-lg">
        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4">Genel Değerlendirme</h3>
        <div className="prose prose-red max-w-none text-sm sm:text-base">
          <p>
            Bu denetimde şube {denetim.sonuc?.toplamPuan || 0} puan almıştır.
          </p>
          {subeGecmisi.length > 1 && (
            <p className="mt-3">
              Önceki denetime göre
              {denetim.sonuc?.toplamPuan > subeGecmisi[1]?.sonuc?.toplamPuan
                ? ` ${(denetim.sonuc?.toplamPuan - subeGecmisi[1]?.sonuc?.toplamPuan).toFixed(1)} puan artış`
                : ` ${(subeGecmisi[1]?.sonuc?.toplamPuan - denetim.sonuc?.toplamPuan).toFixed(1)} puan düşüş`}
              göstermiştir.
            </p>
          )}
          <p className="mt-3">
            {sorunAlanları.length > 0
              ? `${sorunAlanları.map(s => s.kategori).join(', ')} alanlarında iyileştirmeler yapılması önerilmektedir.`
              : 'Tüm kategorilerde hedeflenen puanlar alınmıştır. Bu performansın sürdürülebilirliği için düzenli kontroller devam etmelidir.'}
          </p>
        </div>
      </div>

      {/* Özet Metrikler */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
          <h4 className="text-sm font-medium text-gray-500">Toplam Puan</h4>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">
            {denetim.sonuc?.toplamPuan || 0}
          </p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
          <h4 className="text-sm font-medium text-gray-500">Başarı Yüzdesi</h4>
          <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-2">
            %{denetim.sonuc?.yuzde || 0}
          </p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
          <h4 className="text-sm font-medium text-gray-500">Soru Sayısı</h4>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600 mt-2">
            {Object.keys(denetim.yanitlar || {}).length}
          </p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
          <h4 className="text-sm font-medium text-gray-500">Önceki Denetime Göre</h4>
          <p className="text-2xl sm:text-3xl font-bold mt-2 text-gray-900">
            {subeGecmisi.length > 1
              ? `${(denetim.sonuc?.toplamPuan - subeGecmisi[1]?.sonuc?.toplamPuan).toFixed(1)} puan`
              : '-'}
          </p>
        </div>
      </div>

      {/* Ana Grafikler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        {/* Performans Trend Grafiği */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4">Performans Trendi</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={aylikTrend} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ay" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="puan" fill="#ef4444" name="Puan" />
                <Line type="monotone" dataKey="puan" stroke="#8b5cf6" name="Trend" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-xs sm:text-sm text-gray-600">
            <p>Son 6 aylık denetim performans trendi</p>
            {aylikTrend.length > 0 && (
              <p className="mt-2">
                En yüksek: {Math.max(...aylikTrend.map(t => t.puan))} - En düşük: {Math.min(...aylikTrend.map(t => t.puan))}
              </p>
            )}
          </div>
        </div>

        {/* Kategori Dağılımı */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4">Kategori Performans Analizi</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={kategoriAnalizi}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis 
                  type="number" 
                  domain={[0, 100]} 
                  tickFormatter={(value) => `%${value}`}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={100}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => [`%${value}`, 'Başarı Oranı']}
                  contentStyle={{ fontSize: '12px' }}
                />
                <Bar 
                  dataKey="puan" 
                  fill="#ef4444" 
                  radius={[0, 4, 4, 0]}
                  maxBarSize={30}
                  label={(props) => {
                    const { x, y, width, value } = props;
                    return (
                      <text
                        x={x + width + 5}
                        y={y + 15}
                        fill="#374151"
                        fontSize={12}
                        textAnchor="start"
                      >
                        %{value}
                      </text>
                    );
                  }}
                >
                  {kategoriAnalizi.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={entry.puan >= 85 ? '#22c55e' : 
                            entry.puan >= 70 ? '#f59e0b' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[#22c55e]"></div>
              <span>Başarılı (≥%85)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[#f59e0b]"></div>
              <span>İyileştirme (%70-%84)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
              <span>Kritik (&lt;%70)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Soru Bazlı Analizler */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg mt-6">
        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4">Soru Bazlı Performans Analizi</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {soruAnalizleri.map((analiz) => (
            <div 
              key={analiz.id} 
              className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 border border-gray-100"
            >
              <div className="space-y-3">
                {/* Soru Metni */}
                <div className="text-sm font-medium text-gray-900 line-clamp-2" title={analiz.soru}>
                  {analiz.soru}
                </div>

                {/* Başarı Oranı */}
                <div>
                  <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
                    <span>Başarı Oranı</span>
                    <span className="font-medium text-gray-900">%{Math.round(analiz.basariOrani)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full transition-all duration-300"
                      style={{ 
                        width: `${Math.round(analiz.basariOrani)}%`,
                        backgroundColor: analiz.basariOrani >= 85 ? '#22c55e' : 
                                       analiz.basariOrani >= 70 ? '#f59e0b' : '#ef4444'
                      }}
                    />
                  </div>
                </div>

                {/* Çoklu Seçim Seçenekleri */}
                {analiz.tip === 'coklu_secim' && analiz.secenekler && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-500">Seçenek Başarı Oranları:</div>
                    {analiz.secenekler.map((secenek, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-700">{secenek.metin}</span>
                          <span className="font-medium text-gray-900">%{Math.round(secenek.basariOrani)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full transition-all duration-300"
                            style={{ 
                              width: `${Math.round(secenek.basariOrani)}%`,
                              backgroundColor: secenek.basariOrani >= 85 ? '#22c55e' : 
                                            secenek.basariOrani >= 70 ? '#f59e0b' : '#ef4444'
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Trend Grafiği */}
                <div className="h-[50px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analiz.trend}>
                      <Line 
                        type="monotone" 
                        dataKey="puan" 
                        stroke="#8b5cf6" 
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Alt Bilgiler */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">
                    Puan: <span className="font-medium text-gray-900">{analiz.puan}</span>
                  </span>
                  <span className="text-gray-500">
                    Tip: <span className="font-medium text-gray-900">
                      {analiz.tip === 'evet_hayir' ? 'Evet/Hayır' : 'Çoklu Seçim'}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 