import { useState, useEffect } from 'react';
import { realdb } from '../../firebase/config';
import { ref, onValue, get } from 'firebase/database';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Line, ComposedChart, LineChart, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { useAuth } from '../../context/AuthContext';

// Aylar dizisi
const aylar = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const COLORS = ['#ef4444', '#22c55e', '#eab308', '#3b82f6', '#8b5cf6'];

function SubeAnalizPage() {
  const { user } = useAuth();
  const [denetimler, setDenetimler] = useState([]);
  const [rawDenetimler, setRawDenetimler] = useState(null);
  const [formlar, setFormlar] = useState([]);
  const [istatistikler, setIstatistikler] = useState({
    toplamDenetim: 0,
    ortalamaPuan: 0,
    aylikTrend: [],
    sonDenetimler: [],
    kategoriPuanlari: [],
    performansGelisimi: [],
    basariDagilimi: { basarili: 0, iyilestirme: 0, basarisiz: 0 },
    yillikKarsilastirma: [],
    formAnalizi: []
  });
  const [loading, setLoading] = useState(true);

  // Ham denetimleri yükle
  useEffect(() => {
    const denetimlerRef = ref(realdb, 'denetimler');
    
    const unsubscribeDenetimler = onValue(denetimlerRef, (snapshot) => {
      if (snapshot.exists()) {
        setRawDenetimler(snapshot.val());
      } else {
        setRawDenetimler(null);
      }
      setLoading(false);
    }, (error) => {
      console.error('Denetimler çekilirken hata:', error);
      setLoading(false);
    });

    return () => unsubscribeDenetimler();
  }, []);

  // Formları yükle
  useEffect(() => {
    const formlarRef = ref(realdb, 'denetimFormlari');
    
    const unsubscribeFormlar = onValue(formlarRef, (snapshot) => {
      if (snapshot.exists()) {
        const formData = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data
        }));
        setFormlar(formData);
      }
    });

    return () => unsubscribeFormlar();
  }, []);

  // Denetimleri işle
  useEffect(() => {
    if (!rawDenetimler || !user?.branchName) {
      setDenetimler([]);
      return;
    }

    // Kategori isimlerini al
    const kategorilerRef = ref(realdb, 'kategoriler');
    get(kategorilerRef).then((snapshot) => {
      if (snapshot.exists()) {
        const kategoriler = snapshot.val();
        
        const denetimlerData = Object.entries(rawDenetimler)
          .map(([id, data]) => ({
            id,
            ...data,
            sonuc: {
              ...data.sonuc,
              toplamPuan: Number(data.sonuc?.toplamPuan) || 0,
              yuzde: Number(data.sonuc?.yuzde) || 0
            }
          }))
          .filter(denetim => denetim.subeAdi === user.branchName)
          .sort((a, b) => new Date(b.denetimTarihi) - new Date(a.denetimTarihi));

        setDenetimler(denetimlerData);
        
        // İstatistikleri hesapla
        const aylikTrendData = Array(12).fill().map(() => ({
          denetimSayisi: 0,
          toplamPuan: 0
        }));
        
        // Kategori puanlarını topla
        const kategoriPuanlari = {};
        const performansGelisimi = [];
        let oncekiPuan = null;

        denetimlerData.forEach((denetim, index) => {
          // Aylık trend
          const denetimTarihi = new Date(denetim.denetimTarihi);
          const ayIndex = denetimTarihi.getMonth();
          aylikTrendData[ayIndex].denetimSayisi++;
          aylikTrendData[ayIndex].toplamPuan += denetim.sonuc?.toplamPuan || 0;

          // Kategori puanları
          if (denetim.yanitlar) {
            Object.values(denetim.yanitlar).forEach(yanit => {
              const kategoriId = yanit.kategoriId;
              if (kategoriId && kategoriler[kategoriId]) {
                const kategoriAdi = kategoriler[kategoriId].label;
                if (!kategoriPuanlari[kategoriId]) {
                  kategoriPuanlari[kategoriId] = {
                    kategori: kategoriAdi,
                    toplamPuan: 0,
                    denetimSayisi: 0,
                    maxPuan: 0
                  };
                }

                // Evet/Hayır soruları için
                if (yanit.tip === 'evet_hayir') {
                  kategoriPuanlari[kategoriId].toplamPuan += Number(yanit.puan) || 0;
                  kategoriPuanlari[kategoriId].maxPuan += 10; // Her evet/hayır sorusu 10 puan değerinde
                }
                // Çoklu seçim soruları için
                else if (yanit.tip === 'coklu_secim' && yanit.secenekler) {
                  const secenekPuanlari = Object.values(yanit.secenekler)
                    .reduce((acc, secenek) => acc + (Number(secenek.puan) || 0), 0);
                  kategoriPuanlari[kategoriId].toplamPuan += secenekPuanlari;
                  // Her seçenek 10 puan değerinde
                  kategoriPuanlari[kategoriId].maxPuan += Object.keys(yanit.secenekler).length * 10;
                }
                
                kategoriPuanlari[kategoriId].denetimSayisi++;
              }
            });
          }

          // Performans gelişimi
          const simdikiPuan = denetim.sonuc?.toplamPuan || 0;
          if (oncekiPuan !== null) {
            const degisim = simdikiPuan - oncekiPuan;
            performansGelisimi.push({
              tarih: new Date(denetim.denetimTarihi).toLocaleDateString('tr-TR'),
              puan: simdikiPuan,
              degisim: degisim
            });
          }
          oncekiPuan = simdikiPuan;
        });

        // Başarı dağılımı
        const basariDagilimi = denetimlerData.reduce((acc, denetim) => {
          const puan = denetim.sonuc?.toplamPuan || 0;
          if (puan >= 80) acc.basarili++;
          else if (puan >= 60) acc.iyilestirme++;
          else acc.basarisiz++;
          return acc;
        }, { basarili: 0, iyilestirme: 0, basarisiz: 0 });

        // Yıllık karşılaştırma
        const buYil = new Date().getFullYear();
        const gecenYil = buYil - 1;
        
        const yillikData = denetimlerData.reduce((acc, denetim) => {
          const denetimYili = new Date(denetim.denetimTarihi).getFullYear();
          if (denetimYili === buYil || denetimYili === gecenYil) {
            if (!acc[denetimYili]) {
              acc[denetimYili] = {
                yil: denetimYili,
                toplamPuan: 0,
                denetimSayisi: 0
              };
            }
            acc[denetimYili].toplamPuan += denetim.sonuc?.toplamPuan || 0;
            acc[denetimYili].denetimSayisi++;
          }
          return acc;
        }, {});

        // Aylık trend ortalama puanları hesapla
        aylikTrendData.forEach((ay, index) => {
          ay.ay = aylar[index];
          ay.ortalamaPuan = ay.denetimSayisi > 0 ? Math.round(ay.toplamPuan / ay.denetimSayisi) : 0;
        });

        // Form bazlı analiz
        const formAnalizi = denetimlerData.reduce((acc, denetim) => {
          const formId = denetim.formId;
          const formAdi = denetim.formAdi || 'Bilinmeyen Form';
          
          if (!acc[formId]) {
            acc[formId] = {
              formId,
              formAdi,
              toplamPuan: 0,
              denetimSayisi: 0,
              ortalamaPuan: 0,
              enYuksekPuan: 0,
              enDusukPuan: 100,
              sonPuan: 0,
              trend: []
            };
          }
          
          const puan = denetim.sonuc?.toplamPuan || 0;
          acc[formId].toplamPuan += puan;
          acc[formId].denetimSayisi++;
          acc[formId].enYuksekPuan = Math.max(acc[formId].enYuksekPuan, puan);
          acc[formId].enDusukPuan = Math.min(acc[formId].enDusukPuan, puan);
          acc[formId].trend.push({
            tarih: new Date(denetim.denetimTarihi).toLocaleDateString('tr-TR'),
            puan: puan
          });
          
          // Son puanı güncelle (en yeni denetim)
          if (acc[formId].trend.length === 1) {
            acc[formId].sonPuan = puan;
          }
          
          return acc;
        }, {});

        // Ortalama puanları hesapla
        Object.values(formAnalizi).forEach(form => {
          form.ortalamaPuan = Math.round(form.toplamPuan / form.denetimSayisi);
          form.trend.reverse(); // En yeni denetimler başta olsun
        });

        // Performans gelişimi verilerini hazırla
        const performansData = denetimlerData.map(denetim => ({
          tarih: new Date(denetim.denetimTarihi).toLocaleDateString('tr-TR'),
          puan: denetim.sonuc?.toplamPuan || 0
        })).sort((a, b) => new Date(a.tarih) - new Date(b.tarih));

        // Kategori puanlarını yüzdeye çevir
        const kategoriPuanlariArray = Object.values(kategoriPuanlari).map(k => ({
          ...k,
          ortalamaPuan: k.maxPuan > 0 ? Math.round((k.toplamPuan / k.maxPuan) * 100) : 0
        }));

        // Kategorileri sırala (order'a göre)
        const siraliKategoriPuanlari = kategoriPuanlariArray.sort((a, b) => {
          const kategoriA = Object.values(kategoriler).find(k => k.label === a.kategori);
          const kategoriB = Object.values(kategoriler).find(k => k.label === b.kategori);
          return (kategoriA?.order || 0) - (kategoriB?.order || 0);
        });

        setIstatistikler({
          toplamDenetim: denetimlerData.length,
          ortalamaPuan: denetimlerData.length > 0 
            ? Math.round(denetimlerData.reduce((acc, curr) => acc + (curr.sonuc?.toplamPuan || 0), 0) / denetimlerData.length)
            : 0,
          aylikTrend: aylikTrendData,
          sonDenetimler: denetimlerData.slice(0, 5),
          kategoriPuanlari: siraliKategoriPuanlari,
          performansGelisimi: performansData,
          basariDagilimi,
          yillikKarsilastirma: Object.values(yillikData).map(y => ({
            ...y,
            ortalamaPuan: Math.round(y.toplamPuan / y.denetimSayisi)
          })),
          formAnalizi: Object.values(formAnalizi)
        });
      }
    });
      
    setLoading(false);
  }, [rawDenetimler, user?.branchName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent" />
      </div>
    );
  }

  if (!loading && (!rawDenetimler || denetimler.length === 0)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">Henüz Denetim Kaydı Yok</h3>
            <p className="mt-1 text-sm text-gray-500">
              Denetim kayıtları oluşturuldukça burada analiz sonuçları görüntülenecektir.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const basariDagilimiData = [
    { name: 'Başarılı', value: istatistikler.basariDagilimi.basarili },
    { name: 'İyileştirme Gerekli', value: istatistikler.basariDagilimi.iyilestirme },
    { name: 'Başarısız', value: istatistikler.basariDagilimi.basarisiz }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-red-50 overflow-x-hidden">
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Üst Kısım - Başlık ve Özet */}
        <div className="bg-white/90 backdrop-blur-xl rounded-[1.5rem] sm:rounded-[2.5rem] shadow-xl p-4 sm:p-8 mb-4 sm:mb-8 border border-gray-100">
          <div className="flex flex-col gap-4 sm:gap-6">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-red-600">
                {user?.branchName} Analiz Paneli
              </h1>
              <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
                Şubenizin denetim performansı ve istatistikleri
              </p>
            </div>

            {/* Özet Metrikler */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
              {/* Toplam Denetim */}
              <div className="bg-gradient-to-br from-red-50 to-white p-3 sm:p-6 rounded-xl sm:rounded-2xl border border-red-100">
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-red-500 rounded-lg sm:rounded-xl">
                    <svg className="h-4 w-4 sm:h-6 sm:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Toplam Denetim</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{istatistikler.toplamDenetim}</p>
                  </div>
                </div>
              </div>

              {/* Ortalama Puan */}
              <div className="bg-gradient-to-br from-green-50 to-white p-3 sm:p-6 rounded-xl sm:rounded-2xl border border-green-100">
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-green-500 rounded-lg sm:rounded-xl">
                    <svg className="h-4 w-4 sm:h-6 sm:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Ortalama Puan</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{istatistikler.ortalamaPuan}</p>
                  </div>
                </div>
              </div>

              {/* Son Denetim */}
              <div className="bg-gradient-to-br from-blue-50 to-white p-3 sm:p-6 rounded-xl sm:rounded-2xl border border-blue-100">
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-blue-500 rounded-lg sm:rounded-xl">
                    <svg className="h-4 w-4 sm:h-6 sm:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Son Denetim Puanı</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">
                      {istatistikler.sonDenetimler[0]?.sonuc?.toplamPuan || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Grafikler Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
          {/* Aylık Trend */}
          <div className="bg-white/90 backdrop-blur-xl rounded-[1.5rem] sm:rounded-[2.5rem] shadow-xl p-4 sm:p-8 border border-gray-100">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-6">Aylık Performans Trendi</h2>
            <div className="h-[300px] sm:h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={istatistikler.aylikTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ay" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="denetimSayisi" fill="#ef4444" name="Denetim Sayısı" />
                  <Line yAxisId="right" type="monotone" dataKey="ortalamaPuan" stroke="#22c55e" name="Ortalama Puan" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Başarı Dağılımı */}
          <div className="bg-white/90 backdrop-blur-xl rounded-[1.5rem] sm:rounded-[2.5rem] shadow-xl p-4 sm:p-8 border border-gray-100">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-6">Başarı Dağılımı</h2>
            <div className="h-[300px] sm:h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={basariDagilimiData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {basariDagilimiData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Performans Gelişimi */}
          <div className="bg-white/90 backdrop-blur-xl rounded-[1.5rem] sm:rounded-[2.5rem] shadow-xl p-4 sm:p-8 border border-gray-100">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-6">Performans Gelişimi</h2>
            <div className="h-[300px] sm:h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={istatistikler.performansGelisimi}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tarih" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="puan" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.1}
                    name="Denetim Puanı"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Kategori Bazlı Performans */}
          <div className="bg-white/90 backdrop-blur-xl rounded-[1.5rem] sm:rounded-[2.5rem] shadow-xl p-4 sm:p-8 border border-gray-100">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-6">Kategori Bazlı Performans</h2>
            <div className="h-[300px] sm:h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={istatistikler.kategoriPuanlari}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="kategori" angle={-45} textAnchor="end" height={80} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar 
                    dataKey="ortalamaPuan" 
                    fill="#8b5cf6" 
                    name="Ortalama Puan"
                    label={{ position: 'top' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Son Denetimler Tablosu */}
        <div className="mt-8 bg-white/90 backdrop-blur-xl rounded-[1.5rem] sm:rounded-[2.5rem] shadow-xl p-4 sm:p-8 border border-gray-100">
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-6">Son Denetimler</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Tarih</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Form</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Puan</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Durum</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Değişim</th>
                </tr>
              </thead>
              <tbody>
                {istatistikler.sonDenetimler.map((denetim, index) => (
                  <tr key={denetim.id} className="border-b border-gray-100">
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(denetim.denetimTarihi).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {denetim.formAdi}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {denetim.sonuc?.toplamPuan || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        (denetim.sonuc?.toplamPuan || 0) >= 80
                          ? 'bg-green-100 text-green-800'
                          : (denetim.sonuc?.toplamPuan || 0) >= 60
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {(denetim.sonuc?.toplamPuan || 0) >= 80
                          ? 'Başarılı'
                          : (denetim.sonuc?.toplamPuan || 0) >= 60
                          ? 'İyileştirme Gerekli'
                          : 'Başarısız'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {index < istatistikler.performansGelisimi.length && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          istatistikler.performansGelisimi[index].degisim > 0
                            ? 'bg-green-100 text-green-800'
                            : istatistikler.performansGelisimi[index].degisim < 0
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {istatistikler.performansGelisimi[index].degisim > 0 ? '+' : ''}
                          {istatistikler.performansGelisimi[index].degisim} puan
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Form Bazlı Analiz */}
        <div className="mt-8">
          <h2 className="text-xl sm:text-3xl font-bold text-gray-900 mb-6">Form Bazlı Analizler</h2>
          <div className="grid grid-cols-1 gap-6">
            {formlar.map((form) => {
              const formAnaliz = istatistikler.formAnalizi.find(f => f.formId === form.id) || {
                formId: form.id,
                formAdi: form.baslik,
                denetimSayisi: 0,
                ortalamaPuan: 0,
                enYuksekPuan: 0,
                enDusukPuan: 0,
                sonPuan: 0,
                trend: []
              };

              return (
                <div
                  key={form.id}
                  className="bg-white/90 backdrop-blur-xl rounded-[1.5rem] sm:rounded-[2.5rem] shadow-xl p-4 sm:p-8 border border-gray-100"
                >
                  <div className="flex flex-col gap-6">
                    {/* Form Başlığı */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg sm:text-2xl font-bold text-gray-900">{form.baslik}</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {formAnaliz.denetimSayisi > 0 
                            ? `Toplam ${formAnaliz.denetimSayisi} denetim`
                            : 'Henüz denetim yapılmadı'}
                        </p>
                      </div>
                      {formAnaliz.denetimSayisi > 0 && (
                        <div className="flex items-center gap-2">
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                            formAnaliz.sonPuan >= 80
                              ? 'bg-green-100 text-green-800'
                              : formAnaliz.sonPuan >= 60
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            Son: {formAnaliz.sonPuan} Puan
                          </div>
                        </div>
                      )}
                    </div>

                    {formAnaliz.denetimSayisi > 0 ? (
                      <>
                        {/* Form Metrikleri */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                          {/* Ortalama Puan */}
                          <div className="bg-gradient-to-br from-purple-50 to-white p-4 rounded-xl border border-purple-100">
                            <p className="text-sm font-medium text-gray-500">Ortalama Puan</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">{formAnaliz.ortalamaPuan}</p>
                          </div>

                          {/* En Yüksek Puan */}
                          <div className="bg-gradient-to-br from-green-50 to-white p-4 rounded-xl border border-green-100">
                            <p className="text-sm font-medium text-gray-500">En Yüksek Puan</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">{formAnaliz.enYuksekPuan}</p>
                          </div>

                          {/* En Düşük Puan */}
                          <div className="bg-gradient-to-br from-red-50 to-white p-4 rounded-xl border border-red-100">
                            <p className="text-sm font-medium text-gray-500">En Düşük Puan</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">{formAnaliz.enDusukPuan}</p>
                          </div>

                          {/* Son Denetim Puanı */}
                          <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-xl border border-blue-100">
                            <p className="text-sm font-medium text-gray-500">Son Denetim</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">{formAnaliz.sonPuan}</p>
                          </div>
                        </div>

                        {/* Form Trend Grafiği - Küçültülmüş */}
                        <div className="h-[150px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={formAnaliz.trend}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="tarih" />
                              <YAxis domain={[0, 100]} />
                              <Tooltip />
                              <Line
                                type="monotone"
                                dataKey="puan"
                                stroke="#8b5cf6"
                                strokeWidth={2}
                                dot={{ r: 3, fill: "#8b5cf6" }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    ) : (
                      <div className="py-8 text-center text-gray-500">
                        <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p>Bu form için henüz denetim yapılmamış</p>
                        <p className="text-sm mt-1">Denetim yapıldıkça burada analiz sonuçları görüntülenecektir</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SubeAnalizPage; 