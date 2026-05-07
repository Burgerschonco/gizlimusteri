/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-loop-func */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { realdb } from '../../firebase/config';
import { ref, get } from 'firebase/database';
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
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { toast } from 'react-hot-toast';

const COLORS = ['#ef4444', '#22c55e', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function DenetimAnalizPage() {
  const { id } = useParams();
  const [denetim, setDenetim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subeGecmisi, setSubeGecmisi] = useState([]);
  const [kategoriAnalizi, setKategoriAnalizi] = useState([]);
  const [aylikTrend, setAylikTrend] = useState([]);
  const [sorunAlanları, setSorunAlanları] = useState([]);
  const [kategoriler, setKategoriler] = useState([]);
  const [soruAnalizleri, setSoruAnalizleri] = useState([]);

  // Kategorileri ve denetim verilerini yükle
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Denetim verilerini al
        const denetimRef = ref(realdb, `denetimler/${id}`);
        const denetimSnapshot = await get(denetimRef);
        
        if (!denetimSnapshot.exists()) {
          setDenetim(null);
          setLoading(false);
          return;
        }

        const denetimData = denetimSnapshot.val();

        // Kategorileri al
        const kategorilerRef = ref(realdb, 'kategoriler');
        const kategorilerSnapshot = await get(kategorilerRef);
        const kategorilerData = kategorilerSnapshot.exists() ? kategorilerSnapshot.val() : {};
        const kategorilerArray = Object.entries(kategorilerData).map(([id, kategori]) => ({
          id,
          ...kategori,
          order: kategori.order || 0
        })).sort((a, b) => a.order - b.order);
        
        setKategoriler(kategorilerArray);

        if (!denetimData.formId) {
          setDenetim(null);
          setLoading(false);
          return;
        }

        // Form verilerini al
        const formRef = ref(realdb, `denetimFormlari/${denetimData.formId}`);
        const formSnapshot = await get(formRef);
        
        if (!formSnapshot.exists()) {
          setDenetim(null);
          setLoading(false);
          return;
        }

        const formData = formSnapshot.val();

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
            }));

          // Şubenin geçmiş denetimleri
          const subeninDenetimleri = tumDenetimler
            .filter(d => d.subeId === denetimData.subeId)
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
              const kategoriSorulari = Object.entries(denetimData.yanitlar || {})
                .filter(([soruId, yanit]) => {
                  const formSoru = formData.sorular[parseInt(soruId.split('_')[1]) - 1];
                  return formSoru && formSoru.kategoriId === kategori.id;
                })
                .map(([soruId, yanit]) => {
                  const formSoru = formData.sorular[parseInt(soruId.split('_')[1]) - 1];
                  return {
                    ...formSoru,
                    yanit: yanit
                  };
                });
              
              let alinanPuan = 0;
              let maxPuan = 0;

              // Her soru için puan hesapla
              kategoriSorulari.forEach(soru => {
                if (soru.yanit.tip === 'evet_hayir') {
                  const soruPuan = Number(soru.yanit.puan || 0);
                  maxPuan += soruPuan;
                  if (soru.yanit.yanit === 'evet') {
                    alinanPuan += soruPuan;
                  }
                } else if (soru.yanit.tip === 'coklu_secim') {
                  let soruMaxPuan = 0;
                  let soruAlinanPuan = 0;
                  
                  Object.values(soru.yanit.secenekler || {}).forEach(secenek => {
                    const secenekPuan = Number(secenek.puan || 0);
                    soruMaxPuan += secenekPuan;
                    if (secenek.yanit === 'evet') {
                      soruAlinanPuan += secenekPuan;
                    }
                  });
                  
                  maxPuan += soruMaxPuan;
                  alinanPuan += soruAlinanPuan;
                }
              });

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

              return {
                name: kategori.label,
                puan: maxPuan > 0 ? Math.round((alinanPuan / maxPuan) * 100) : 0,
                toplamSoru: kategoriSorulari.length,
                dogruSayisi: dogruSayisi,
                alinanPuan: alinanPuan,
                maxPuan: maxPuan
              };
            }).filter(kategori => kategori.toplamSoru > 0);

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

          setSorunAlanları(sorunlar);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Veri yüklenirken hata:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [id]); // Sadece id değiştiğinde çalışacak

  // Soru analizlerini hesapla
  useEffect(() => {
    if (denetim?.formId && denetim?.yanitlar) {
      const formRef = ref(realdb, `denetimFormlari/${denetim.formId}`);
      get(formRef).then((snapshot) => {
        if (snapshot.exists()) {
          const formData = snapshot.val();
          
          // Tüm denetimleri al
          const denetimlerRef = ref(realdb, 'denetimler');
          get(denetimlerRef).then((denetimlerSnapshot) => {
            if (denetimlerSnapshot.exists()) {
              const tumDenetimler = Object.entries(denetimlerSnapshot.val())
                .map(([key, value]) => ({ id: key, ...value }))
                .filter(d => d.formId === denetim.formId)
                .sort((a, b) => new Date(b.denetimTarihi) - new Date(a.denetimTarihi));

              // Her soru için analiz yap
              const analizler = Object.entries(formData.sorular || {}).map(([soruId, soru]) => {
                // Yanıt ID'sini düzelt
                const yanitId = `soru_${parseInt(soruId) + 1}`;
                
                // Son 6 denetimin trendi
                const trend = tumDenetimler.slice(0, 6).map(d => {
                  const yanit = d.yanitlar?.[yanitId];

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
                      if (secenekYanit.puan) {
                        maxPuan += Number(secenekYanit.puan);
                        if (secenekYanit.yanit === 'evet') {
                          secilenPuan += Number(secenekYanit.puan);
                        }
                      }
                    });

                    return {
                      tarih: new Date(d.denetimTarihi).toLocaleDateString('tr-TR'),
                      puan: maxPuan > 0 ? Math.round((secilenPuan / maxPuan) * 100) : 100
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
                      if (secenekYanit.puan) {
                        denetimMaxPuan += Number(secenekYanit.puan);
                        if (secenekYanit.yanit === 'evet') {
                          denetimPuan += Number(secenekYanit.puan);
                        }
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
                      basariOrani: secenekYanit.yanit === 'evet' ? 100 : 0
                    };
                  }) : [];

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

              setSoruAnalizleri(analizler);
            }
          });
        }
      });
    }
  }, [denetim?.formId, denetim?.yanitlar]);

  const handlePDFGenerate = async () => {
    try {
      toast.loading('PDF oluşturuluyor...', { id: 'pdfToast' });

      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);
      
      let currentPage = pdfDoc.addPage([595.28, 841.89]); // A4 boyutu
      const { height, width } = currentPage.getSize();
      const fontSize = 10;
      const margin = 35;
      const contentWidth = width - (margin * 2);

      // Font yükleme
      const fontUrl = 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5Q.ttf';
      const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
      const customFont = await pdfDoc.embedFont(fontBytes);

      // Logo yükleme
      const logoResponse = await fetch('/burgerschonlogokirmizi.png');
      const logoImageBytes = await logoResponse.arrayBuffer();
      const logoImage = await pdfDoc.embedPng(logoImageBytes);

      let yPos = height - margin;

      // Tema renkleri
      const colors = {
        primary: rgb(0.93, 0.11, 0.14),
        secondary: rgb(0.2, 0.2, 0.2),
        success: rgb(0.13, 0.7, 0.3),
        danger: rgb(0.93, 0.11, 0.14),
        light: rgb(0.98, 0.98, 0.98),
        border: rgb(0.9, 0.9, 0.9),
        text: {
          dark: rgb(0.2, 0.2, 0.2),
          muted: rgb(0.6, 0.6, 0.6),
          light: rgb(1, 1, 1)
        }
      };

      // Yardımcı fonksiyonlar
      const drawText = (text, x, y, options = {}) => {
        if (!text) return;
        const defaultOptions = {
          size: fontSize,
          font: customFont,
          color: colors.text.dark,
          maxWidth: contentWidth
        };
        const finalOptions = { ...defaultOptions, ...options };
        const safeText = text.toString().normalize('NFKC');
        currentPage.drawText(safeText, { x, y, ...finalOptions });
      };

      const drawBox = (x, y, w, h, options = {}) => {
        const defaultOptions = {
          color: colors.light,
          borderColor: colors.border,
          borderWidth: 1,
          radius: 8,
          opacity: 1
        };
        const opts = { ...defaultOptions, ...options };
        currentPage.drawRectangle({
          x,
          y: y - h,
          width: w,
          height: h,
          color: opts.color,
          borderColor: opts.borderColor,
          borderWidth: opts.borderWidth,
          borderRadius: opts.radius,
          opacity: opts.opacity
        });
      };

      // Başlık çizimi
      drawBox(0, height, width, 50, {
        color: colors.primary,
        borderWidth: 0,
        radius: 0
      });

      // Logo
      const logoWidth = 25;
      const logoHeight = 25;
      currentPage.drawImage(logoImage, {
        x: margin,
        y: height - 10 - logoHeight,
        width: logoWidth,
        height: logoHeight
      });

      // Başlık
      drawText('DENETİM ANALİZ RAPORU', margin + 40, height - 25, {
        size: 12,
        color: colors.text.light
      });

      // Şube ve tarih bilgisi
      drawText(denetim.subeAdi, width - margin - 120, height - 20, {
        size: 9,
        color: colors.text.light
      });
      drawText(new Date(denetim.denetimTarihi).toLocaleDateString('tr-TR'), width - margin - 120, height - 35, {
        size: 8,
        color: colors.text.light
      });

      yPos -= 40;

      // Soru Bazlı Performans Analizi
      drawText('SORU BAZLI PERFORMANS ANALİZİ', margin, yPos - 12, {
        size: 11,
        color: colors.primary
      });

      yPos -= 20;

      // Her soru için detaylı analiz
      for (const analiz of soruAnalizleri) {
        // Yeni sayfa kontrolü
        if (yPos < margin + 150) {
          currentPage = pdfDoc.addPage([595.28, 841.89]);
          yPos = height - margin;
        }

        const soruBoxHeight = analiz.tip === 'coklu_secim' ? 120 : 80;
        
        drawBox(margin, yPos + 5, contentWidth, soruBoxHeight, {
          color: colors.light,
          borderWidth: 1,
          borderColor: colors.border
        });

        // Kategori Etiketi
        const kategori = kategoriler.find(k => k.id === analiz.kategoriId);
        drawText(kategori?.label || 'Kategori Yok', margin + 8, yPos - 10 - 12, {
          size: 8,
          color: colors.text.dark
        });

        // Soru metni
        const soruLines = analiz.soru.match(/.{1,90}(\s|$)/g) || [analiz.soru];
        soruLines.forEach((line, index) => {
          drawText(line.trim(), margin + 8, yPos - 10 - (index * 12), {
            size: 8,
            color: colors.text.dark
          });
        });

        yPos -= 35 + (soruLines.length - 1) * 12;

        // Başarı oranı
        drawBox(margin + 8, yPos + 4, (contentWidth - 16) * (analiz.basariOrani / 100), 8, {
          color: analiz.basariOrani >= 85 ? rgb(0.13, 0.7, 0.3) :
                 analiz.basariOrani >= 70 ? rgb(0.96, 0.62, 0.04) :
                 rgb(0.93, 0.11, 0.14),
          borderWidth: 0,
          radius: 3
        });

        drawText(`Başarı Oranı: %${Math.round(analiz.basariOrani)}`, margin + 8, yPos - 10, {
          size: 8,
          color: colors.text.dark
        });

        yPos -= 25;

        // Çoklu seçim soruları için seçenek analizleri
        if (analiz.tip === 'coklu_secim' && analiz.secenekler) {
          analiz.secenekler.forEach((secenek, index) => {
            if (yPos < margin + 50) {
              currentPage = pdfDoc.addPage([595.28, 841.89]);
              yPos = height - margin;
            }

            drawText(secenek.metin, margin + 20, yPos - (index * 15), {
              size: 8,
              color: colors.text.dark
            });

            drawBox(margin + 160, yPos - (index * 15) - 3, (contentWidth - 200) * (secenek.basariOrani / 100), 6, {
              color: secenek.basariOrani >= 85 ? rgb(0.13, 0.7, 0.3) :
                     secenek.basariOrani >= 70 ? rgb(0.96, 0.62, 0.04) :
                     rgb(0.93, 0.11, 0.14),
              borderWidth: 0,
              radius: 2
            });

            drawText(`%${Math.round(secenek.basariOrani)}`, margin + contentWidth - 35, yPos - (index * 15), {
              size: 8,
              color: colors.text.dark
            });
          });
          yPos -= (analiz.secenekler.length * 15) + 10;
        }

        yPos -= 30;
      }

      // PDF'i kaydet ve indir
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dosyaAdi = `denetim_analiz_${denetim.subeAdi || 'rapor'}_${new Date(denetim.denetimTarihi).toLocaleDateString('tr-TR').replace(/\//g, '-')}.pdf`;
      link.setAttribute('download', dosyaAdi);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('PDF başarıyla oluşturuldu', { id: 'pdfToast' });
    } catch (error) {
      console.error('PDF oluşturulurken hata:', error);
      toast.error('PDF oluşturulurken bir hata oluştu', { id: 'pdfToast' });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (!denetim) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Denetim Bulunamadı</h2>
        <p className="text-gray-600 mb-8">
          Denetim ID: {id} <br/>
          Bu ID'ye sahip bir denetim kaydı bulunamadı veya erişim izniniz yok.
        </p>
        <Link
          to="/panel/denetimler"
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
            <h2 className="text-2xl font-bold text-gray-900">{denetim.subeAdi}</h2>
            <p className="text-gray-600">
              Denetim Tarihi: {new Date(denetim.denetimTarihi).toLocaleDateString('tr-TR')}
            </p>
          </div>
          <div className="flex gap-4 mt-4 sm:mt-0">
            <button
              onClick={handlePDFGenerate}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF İndir
            </button>
            <Link
              to="/panel/denetimler"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Denetimlere Dön
            </Link>
          </div>
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
                {/* Kategori Etiketi */}
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs font-medium bg-red-50 text-red-600 rounded-md">
                    {kategoriler.find(k => k.id === analiz.kategoriId)?.label || 'Kategori Yok'}
                  </span>
                </div>

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