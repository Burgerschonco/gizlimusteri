/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-loop-func */
import { useState, useEffect } from 'react';
import { realdb } from '../../firebase/config';
import { ref, onValue, get } from 'firebase/database';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Line, PieChart, Pie, Cell, Legend, ComposedChart, LineChart
} from 'recharts';

// Aylar dizisi
const aylar = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const COLORS = ['#ef4444', '#22c55e', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

function AnalizPage() {
  const [denetimler, setDenetimler] = useState([]);
  const [subeler, setSubeler] = useState({});
  const [rawDenetimler, setRawDenetimler] = useState(null);
  const [istatistikler, setIstatistikler] = useState({
    toplamDenetim: 0,
    ortalamaPuan: 0,
    subeIstatistikleri: [],
    aylikTrend: [],
    kategoriPuanlari: [],
    performansGelisimi: [],
    basariDagilimi: { basarili: 0, iyilestirme: 0, basarisiz: 0 },
    yillikKarsilastirma: [],
    formAnalizi: []
  });
  const [loading, setLoading] = useState(true);
  const [formlar, setFormlar] = useState([]);

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

  // Denetimleri işle
  useEffect(() => {
    if (!rawDenetimler) {
      setDenetimler([]);
      return;
    }

    if (Object.keys(subeler).length === 0) {
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
          .sort((a, b) => new Date(b.denetimTarihi) - new Date(a.denetimTarihi));

        setDenetimler(denetimlerData);
        
        // İstatistikleri hesapla
        const subeIstatistikleri = {};
        const aylikTrendData = Array(12).fill().map(() => ({
          denetimSayisi: 0,
          toplamPuan: 0
        }));
        
        // Kategori puanlarını topla
        const kategoriPuanlari = {};
        const performansGelisimi = [];
        let oncekiPuan = null;

        denetimlerData.forEach((denetim, index) => {
          // Şube bazlı istatistikler
          if (denetim.subeId) {
            if (!subeIstatistikleri[denetim.subeId]) {
              const sube = subeler[denetim.subeId];
              subeIstatistikleri[denetim.subeId] = {
                count: 0,
                name: sube ? sube.name : 'Bilinmeyen Şube',
                toplamPuan: 0
              };
            }
            subeIstatistikleri[denetim.subeId].count++;
            subeIstatistikleri[denetim.subeId].toplamPuan += denetim.sonuc?.toplamPuan || 0;
          }

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

        // Ortalama puanları hesapla
        Object.values(subeIstatistikleri).forEach(sube => {
          sube.ortalamaPuan = Math.round(sube.toplamPuan / sube.count);
        });

        // Aylık trend ortalama puanları hesapla
        aylikTrendData.forEach(ay => {
          ay.ortalamaPuan = ay.denetimSayisi > 0 ? Math.round(ay.toplamPuan / ay.denetimSayisi) : 0;
        });

        setIstatistikler({
          toplamDenetim: denetimlerData.length,
          ortalamaPuan: denetimlerData.length > 0 
            ? Math.round(denetimlerData.reduce((acc, curr) => acc + (curr.sonuc?.toplamPuan || 0), 0) / denetimlerData.length)
            : 0,
          subeIstatistikleri: Object.values(subeIstatistikleri),
          aylikTrend: aylikTrendData,
          kategoriPuanlari: Object.values(kategoriPuanlari),
          performansGelisimi,
          basariDagilimi,
          yillikKarsilastirma: Object.values(yillikData),
          formAnalizi: Object.values(formAnalizi)
        });
      }
    });
      
    setLoading(false);
  }, [rawDenetimler, subeler]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-red-50 overflow-x-hidden">
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Üst Kısım - Başlık ve Özet */}
        <div className="bg-white/90 backdrop-blur-xl rounded-[1.5rem] sm:rounded-[2.5rem] shadow-xl p-4 sm:p-8 mb-4 sm:mb-8 border border-gray-100">
          <div className="flex flex-col gap-4 sm:gap-6">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-red-600">
                Genel Analiz Paneli
              </h1>
              <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
                Tüm şubelerin denetim performansları ve istatistikleri
              </p>
            </div>

            {/* Özet Metrikler */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {/* Toplam Denetim */}
              <div className="bg-gradient-to-br from-red-50 to-white p-3 sm:p-4 rounded-xl border border-red-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-red-500 rounded-lg">
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Toplam Denetim</p>
                    <p className="text-lg font-bold text-gray-900">{istatistikler.toplamDenetim}</p>
                  </div>
                </div>
              </div>

              {/* Ortalama Puan */}
              <div className="bg-gradient-to-br from-green-50 to-white p-3 sm:p-4 rounded-xl border border-green-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Ortalama Puan</p>
                    <p className="text-lg font-bold text-gray-900">%{istatistikler.ortalamaPuan}</p>
                  </div>
                </div>
              </div>

              {/* Aktif Şube */}
              <div className="bg-gradient-to-br from-blue-50 to-white p-3 sm:p-4 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Aktif Şube</p>
                    <p className="text-lg font-bold text-gray-900">{Object.keys(subeler).length}</p>
                  </div>
                </div>
              </div>

              {/* Başarı Oranı */}
              <div className="bg-gradient-to-br from-purple-50 to-white p-3 sm:p-4 rounded-xl border border-purple-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-500 rounded-lg">
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Başarı Oranı</p>
                    <p className="text-lg font-bold text-gray-900">
                      %{Math.round((istatistikler.basariDagilimi.basarili / istatistikler.toplamDenetim) * 100) || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ana Grafikler Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Şube Performans Dağılımı */}
          <div className="bg-white/90 backdrop-blur-xl rounded-[1.5rem] shadow-xl p-4 sm:p-6 border border-gray-100">
            <h3 className="text-base font-bold text-gray-900 mb-4">Şube Performans Dağılımı</h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={istatistikler.subeIstatistikleri}
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="80%"
                    paddingAngle={2}
                    dataKey="ortalamaPuan"
                    nameKey="name"
                    label={({ name, value }) => `${name}: %${value}`}
                  >
                    {istatistikler.subeIstatistikleri.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem'
                    }}
                    formatter={(value) => `%${value}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Aylık Trend */}
          <div className="bg-white/90 backdrop-blur-xl rounded-[1.5rem] shadow-xl p-4 sm:p-6 border border-gray-100">
            <h3 className="text-base font-bold text-gray-900 mb-4">Aylık Trend</h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={aylar.map((ay, index) => ({
                  ay: window.innerWidth < 640 ? ay.substring(0, 3) : ay,
                  denetimSayisi: istatistikler.aylikTrend[index]?.denetimSayisi || 0,
                  ortalamaPuan: istatistikler.aylikTrend[index]?.ortalamaPuan || 0
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="ay" 
                    stroke="#6b7280" 
                    fontSize={10} 
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    tickMargin={5}
                  />
                  <YAxis yAxisId="left" stroke="#6b7280" fontSize={10} width={30} />
                  <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" fontSize={10} width={30} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem'
                    }}
                  />
                  <Bar 
                    yAxisId="left"
                    dataKey="denetimSayisi" 
                    name="Denetim Sayısı"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={20}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="ortalamaPuan"
                    name="Ortalama Puan"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 2 }}
                    activeDot={{ r: 4, fill: '#3b82f6' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Kategori Performans */}
          <div className="bg-white/90 backdrop-blur-xl rounded-[1.5rem] shadow-xl p-4 sm:p-6 border border-gray-100">
            <h3 className="text-base font-bold text-gray-900 mb-4">Kategori Performans Analizi</h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={istatistikler.kategoriPuanlari}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis 
                    type="number" 
                    stroke="#6b7280" 
                    fontSize={10} 
                    domain={[0, 100]} 
                    tickFormatter={(value) => `%${value}`}
                  />
                  <YAxis 
                    dataKey="kategori" 
                    type="category"
                    width={100}
                    tick={{ fontSize: 10 }}
                    stroke="#6b7280"
                  />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem'
                    }}
                    formatter={(value, name, props) => {
                      return [
                        `%${value}`,
                        `${props.payload.kategori} (${props.payload.denetimSayisi} denetim)`
                      ];
                    }}
                  />
                  <Bar 
                    dataKey={(data) => Math.round((data.toplamPuan / data.maxPuan) * 100)}
                    name="Başarı Oranı"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={20}
                    label={(props) => {
                      const { x, y, width, value } = props;
                      return (
                        <text
                          x={x + width + 5}
                          y={y + 10}
                          fill="#6b7280"
                          fontSize={10}
                          textAnchor="start"
                        >
                          %{value}
                        </text>
                      );
                    }}
                  >
                    {istatistikler.kategoriPuanlari.map((entry, index) => {
                      const oran = Math.round((entry.toplamPuan / entry.maxPuan) * 100);
                      return (
                        <Cell 
                          key={`cell-${index}`}
                          fill={oran >= 85 ? '#22c55e' : 
                                oran >= 70 ? '#f59e0b' : '#ef4444'}
                        />
                      );
                    })}
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

          {/* Başarı Dağılımı */}
          <div className="bg-white/90 backdrop-blur-xl rounded-[1.5rem] shadow-xl p-4 sm:p-6 border border-gray-100">
            <h3 className="text-base font-bold text-gray-900 mb-4">Başarı Dağılımı</h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Başarılı', value: istatistikler.basariDagilimi.basarili },
                      { name: 'İyileştirme Gerekli', value: istatistikler.basariDagilimi.iyilestirme },
                      { name: 'Başarısız', value: istatistikler.basariDagilimi.basarisiz }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="80%"
                    paddingAngle={2}
                    dataKey="value"
                  >
                    <Cell fill="#22c55e" />
                    <Cell fill="#f59e0b" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem'
                    }}
                  />
                  <Legend 
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    wrapperStyle={{
                      fontSize: '0.75rem'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Form ve Yıllık Analiz Grid */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 mt-4 sm:mt-6">
          {/* Form Bazlı Analiz */}
          <div className="bg-white/90 backdrop-blur-xl rounded-[1.5rem] shadow-xl p-4 sm:p-6 border border-gray-100">
            <h3 className="text-base font-bold text-gray-900 mb-4">Form Bazlı Analiz</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {istatistikler.formAnalizi.map((form) => (
                <div 
                  key={form.formId}
                  className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 border border-gray-100"
                >
                  <h4 className="font-semibold text-gray-900 mb-2 truncate">{form.formAdi}</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Ort. Puan:</span>
                      <span className="text-xs font-medium text-gray-900">%{form.ortalamaPuan}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">En Yüksek:</span>
                      <span className="text-xs font-medium text-gray-900">%{form.enYuksekPuan}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Son Puan:</span>
                      <span className="text-xs font-medium text-gray-900">%{form.sonPuan}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Denetim:</span>
                      <span className="text-xs font-medium text-gray-900">{form.denetimSayisi}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Yıllık Karşılaştırma */}
          <div className="bg-white/90 backdrop-blur-xl rounded-[1.5rem] shadow-xl p-4 sm:p-6 border border-gray-100">
            <h3 className="text-base font-bold text-gray-900 mb-4">Yıllık Karşılaştırma</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {istatistikler.yillikKarsilastirma.map((yil) => (
                <div 
                  key={yil.yil}
                  className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 border border-gray-100"
                >
                  <h4 className="font-semibold text-gray-900 mb-2">{yil.yil}</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Ort. Puan:</span>
                      <span className="text-xs font-medium text-gray-900">
                        %{Math.round(yil.toplamPuan / yil.denetimSayisi)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Denetim:</span>
                      <span className="text-xs font-medium text-gray-900">{yil.denetimSayisi}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalizPage;