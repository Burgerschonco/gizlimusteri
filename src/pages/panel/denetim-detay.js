import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { realdb } from '../../firebase/config';
import { ref, get } from 'firebase/database';
import { getStorage, ref as storageRef, getDownloadURL } from 'firebase/storage';
import ImageViewer from '../../components/imageviewer';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { toast } from 'react-hot-toast';

export default function DenetimDetayPage() {
  const { id } = useParams();
  const [kategoriler, setKategoriler] = useState([]);
  const [denetim, setDenetim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageUrls, setImageUrls] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Kategorileri yükle
  useEffect(() => {
    const fetchData = async () => {
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
        setLoading(false);
      } catch (error) {
        console.error('Veri yüklenirken hata:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const fetchDenetim = async () => {
      try {
        const denetimRef = ref(realdb, `denetimler/${id}`);
        const snapshot = await get(denetimRef);
        
        if (snapshot.exists()) {
          const denetimData = snapshot.val();

          // Şube bilgilerini al
          const subeRef = ref(realdb, `branches/${denetimData.subeId}`);
          const subeSnapshot = await get(subeRef);
          const subeData = subeSnapshot.exists() ? subeSnapshot.val() : null;

          // Form bilgilerini al
          const formRef = ref(realdb, `denetimFormlari/${denetimData.formId}`);
          const formSnapshot = await get(formRef);
          const formData = formSnapshot.exists() ? formSnapshot.val() : null;

          // Yanıtları array'e dönüştür
          const yanitlarArray = Object.entries(denetimData.yanitlar || {}).map(([soruKey, yanit]) => {
            const soruIndex = parseInt(soruKey.split('_')[1]) - 1;
            const soruBilgisi = formData?.sorular?.[soruIndex] || {};
            
            const baseYanit = {
              id: soruKey,
              kategori: soruBilgisi.kategoriId || yanit.kategoriId, // Önce form bilgisinden, yoksa yanıttan al
              soru: yanit.soru,
              tip: yanit.tip
            };

            if (yanit.tip === 'evet_hayir') {
              return {
                ...baseYanit,
                yanit: yanit.yanit,
                puan: yanit.puan || 0,
                aciklama: yanit.aciklama || '',
                fotograflar: yanit.fotograflar || {}
              };
            } else if (yanit.tip === 'coklu_secim') {
              return {
                ...baseYanit,
                secenekler: yanit.secenekler || {},
                toplamPuan: yanit.toplamPuan || 0
              };
            } else if (yanit.tip === 'uzun_metin') {
              return {
                ...baseYanit,
                yanit: yanit.yanit || ''
              };
            }

            return null;
          }).filter(Boolean);

          // Denetim verisini düzenle
          const duzenlenmisData = {
            ...denetimData,
            formBilgisi: formData, // Form bilgisini ekle
            sorular: yanitlarArray,
            subeAdi: denetimData.subeAdi || (subeData ? subeData.name : 'İsimsiz Şube'),
            subeAdres: subeData ? subeData.address : '-',
            subeTelefon: subeData ? subeData.phone : '-',
            subeEmail: subeData ? subeData.email : '-'
          };

          console.log('Düzenlenmiş denetim verisi:', duzenlenmisData);
          setDenetim(duzenlenmisData);
        }
        setLoading(false);
      } catch (error) {
        console.error('Denetim detayı yüklenirken hata:', error);
        setLoading(false);
      }
    };

    fetchDenetim();
  }, [id]);

  // Görselleri yükle
  useEffect(() => {
    const loadImages = async () => {
      if (!denetim?.yanitlar) return;
      
      setIsLoading(true);
      console.log('Fotoğraflar yüklenmeye başlıyor...');
      
      try {
        const newImageUrls = {};
        const storage = getStorage();
        const loadedPaths = new Set();

        const processPhotos = async (photos, prefix) => {
          if (!photos) return;
          
          for (const [key, photo] of Object.entries(photos)) {
            try {
              if (!photo) continue;
              
              let imagePath = '';
              if (typeof photo === 'string') {
                imagePath = photo.startsWith('/') ? photo.substring(1) : photo;
              } else if (typeof photo === 'object' && (photo.path || photo.url)) {
                imagePath = photo.path || photo.url;
              }

              if (!imagePath || loadedPaths.has(imagePath)) continue;
              
              loadedPaths.add(imagePath);
              console.log('Fotoğraf yükleniyor:', imagePath);
              
              try {
                const imageRef = storageRef(storage, imagePath);
                const url = await getDownloadURL(imageRef);
                
                const uniqueKey = `${prefix}_${key}`;
                newImageUrls[uniqueKey] = {
                  url,
                  originalKey: photo,
                  path: imagePath
                };
                
                console.log('Fotoğraf başarıyla yüklendi:', uniqueKey, url);
              } catch (downloadError) {
                console.error('Fotoğraf indirme hatası:', downloadError, imagePath);
              }
            } catch (error) {
              console.error('Fotoğraf işleme hatası:', error, photo);
            }
          }
        };

        for (const [soruKey, yanit] of Object.entries(denetim.yanitlar)) {
          if (yanit.fotograflar && Object.keys(yanit.fotograflar).length > 0) {
            console.log('Soru fotoğrafları işleniyor:', soruKey, yanit.fotograflar);
            await processPhotos(yanit.fotograflar, soruKey);
          }

          if (yanit.tip === 'coklu_secim' && yanit.secenekler) {
            for (const [secenekMetin, secenekData] of Object.entries(yanit.secenekler)) {
              if (secenekData.fotograflar && Object.keys(secenekData.fotograflar).length > 0) {
                console.log('Seçenek fotoğrafları işleniyor:', soruKey, secenekMetin, secenekData.fotograflar);
                await processPhotos(secenekData.fotograflar, `${soruKey}_${secenekMetin}`);
              }
            }
          }
        }

        console.log('Tüm fotoğraflar yüklendi. URL\'ler:', newImageUrls);
        setImageUrls(newImageUrls);
      } catch (error) {
        console.error('Fotoğraf yükleme işlemi sırasında hata:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadImages();
  }, [denetim?.yanitlar]);

  // Yükleme durumu
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  // Denetim bulunamadı
  if (!denetim) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Denetim bulunamadı</h3>
          <div className="mt-6">
            <Link
              to="/panel/denetimler"
              className="text-red-600 hover:text-red-500"
            >
              ← Denetimlere Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  console.log('Denetim verisi:', denetim);

  // Soruları kategorilere göre grupla
  const grupluSorular = denetim.yanitlar ? Object.entries(denetim.yanitlar).reduce((acc, [key, soru]) => {
    // Form bilgisinden kategori ID'sini al
    const formSoru = denetim.formBilgisi?.sorular?.find(s => s.soru === soru.soru);
    const kategoriId = formSoru?.kategoriId || soru.kategoriId;
    const kategori = kategoriler.find(k => k.id === kategoriId);
    
    if (kategori) {
      if (!acc[kategoriId]) {
        acc[kategoriId] = {
          label: kategori.label,
          sorular: []
        };
      }
      acc[kategoriId].sorular.push({
        ...soru,
        id: key // key'i id olarak ekle
      });
    } else {
      // Eğer kategori bulunamazsa "Diğer" kategorisine ekle
      const digerKategoriId = 'diger';
      if (!acc[digerKategoriId]) {
        acc[digerKategoriId] = {
          label: 'Diğer',
          sorular: []
        };
      }
      acc[digerKategoriId].sorular.push({
        ...soru,
        id: key // key'i id olarak ekle
      });
    }
    return acc;
  }, {}) : {};

  console.log('Gruplu sorular:', grupluSorular);

  const handlePDFGenerate = async () => {
    try {
      toast.loading('PDF oluşturuluyor...', { id: 'pdfToast' });

      // PDF boyutları ve görsel ayarları
      const imageWidth = 180;  // Görsel genişliği azaltıldı
      const imageHeight = 135; // Görsel yüksekliği azaltıldı
      const imageSpacing = 10; // Görseller arası boşluk azaltıldı

      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);
      
      let currentPage = pdfDoc.addPage([595.28, 841.89]); // A4 boyutu
      const { height, width } = currentPage.getSize();
      const fontSize = 9; // Font boyutu küçültüldü
      const margin = 35; // Kenar boşluğu azaltıldı
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
        
        try {
        currentPage.drawText(safeText, { x, y, ...finalOptions });
        } catch (error) {
          console.error('Metin çizme hatası:', error);
        }
      };

      // Metin genişliğini hesapla
      const measureText = (text, size = fontSize) => {
        if (!text) return 0;
        const safeText = text.toString().normalize('NFKC');
        return customFont.widthOfTextAtSize(safeText, size);
      };

      // Metni satırlara böl
      const wrapText = (text, maxWidth, size = fontSize) => {
        if (!text) return [];
        const safeText = text.toString();
        const words = safeText.split(' ');
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
          const word = words[i];
          const width = measureText(`${currentLine} ${word}`, size);
          
          if (width < maxWidth) {
            currentLine += ` ${word}`;
          } else {
            lines.push(currentLine);
            currentLine = word;
          }
        }
        lines.push(currentLine);
        return lines;
      };

      // Çok satırlı metin çiz
      const drawMultilineText = (text, x, y, maxWidth, options = {}) => {
        if (!text) return 0;
        
        const { size = fontSize, lineHeight = 1.2 } = options;
        const lines = wrapText(text, maxWidth, size);
        let currentY = y;
        const actualHeight = lines.length * (size * lineHeight);
        
        lines.forEach((line) => {
          drawText(line, x, currentY, { ...options, size });
          currentY -= (size * lineHeight);
        });

        return actualHeight;
      };

      const addNewPage = () => {
        currentPage = pdfDoc.addPage([595.28, 841.89]);
        yPos = height - margin;
        drawHeader(false);
        yPos -= 40;
        return yPos;
      };

      const checkAndAddNewPage = (requiredHeight) => {
        if (yPos - requiredHeight < margin) {
          return addNewPage();
        }
        return yPos;
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

        if (opts.shadow) {
          currentPage.drawRectangle({
            x: x + 2,
            y: y - h - 2,
            width: w,
            height: h,
            color: rgb(0.9, 0.9, 0.9),
            opacity: 0.3,
            borderRadius: opts.radius
          });
        }

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

      // Sayfa başlığı çizimi
      const drawHeader = (isFirstPage = true) => {
        if (isFirstPage) {
          // Üst banner
          drawBox(0, height, width, 80, {
            color: colors.primary,
            borderWidth: 0,
            radius: 0
          });

          // Logo
          const logoWidth = 40;
          const logoHeight = 40;
          const logoX = margin;
          const logoY = height - 20 - logoHeight;

          currentPage.drawImage(logoImage, {
            x: logoX,
            y: logoY,
            width: logoWidth,
            height: logoHeight
          });

          // Başlık
          drawText('DENETİM RAPORU', margin + 60, height - 35, {
            size: 16,
            color: colors.text.light
          });

          // Tarih ve şube bilgisi
          const tarih = new Date(denetim.denetimTarihi).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          });
          
          drawText(denetim.subeAdi, width - margin - 200, height - 35, {
            size: 11,
            color: colors.text.light
          });
          drawText(tarih, width - margin - 200, height - 50, {
            size: 9,
            color: colors.text.light
          });

        } else {
          // Diğer sayfalar için minimal header
          drawBox(0, height, width, 30, {
            color: colors.primary,
            borderWidth: 0,
            radius: 0
          });

          drawText(`${denetim.subeAdi} - Denetim Raporu`, margin, height - 20, {
            size: 9,
            color: colors.text.light
          });
        }
      };

      // Başlık çiz
      drawHeader(true);
      yPos -= 100;

      // Özet bilgiler
      const ozetBoxHeight = 80; // Özet kutusu yüksekliği azaltıldı
      yPos = checkAndAddNewPage(ozetBoxHeight + 15);

      drawBox(margin, yPos + 10, contentWidth, ozetBoxHeight, {
        shadow: true,
        color: colors.text.light,
        borderWidth: 0,
        radius: 8
      });

      // Denetim özeti başlığı
      drawText('DENETİM ÖZETİ', margin + 20, yPos - 15, {
        size: 11,
        color: colors.primary
      });

      // Denetim bilgileri
      const denetimciAdi = `${denetim.denetimci?.ad || ''} ${denetim.denetimci?.soyad || ''}`.trim();
      drawText('Denetimci:', margin + 20, yPos - 35, {
        size: fontSize,
        color: colors.text.muted
      });
      drawText(denetimciAdi || '-', margin + 85, yPos - 35);

      // Sağ taraf - Sonuçlar
      const rightColumnX = margin + contentWidth / 2;
      drawText(`Toplam Puan: ${denetim.sonuc?.toplamPuan || 0}`, rightColumnX, yPos - 35, {
        size: 10,
        color: colors.primary
      });

      const tarih = new Date(denetim.denetimTarihi).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      drawText(`Tarih: ${tarih}`, rightColumnX, yPos - 50, {
        size: fontSize,
        color: colors.text.dark
      });

      yPos -= ozetBoxHeight + 15;

      // Her kategori için sorular
      for (const [kategoriId, kategori] of Object.entries(grupluSorular)) {
        if (!kategori || !kategori.sorular?.length) continue;

        yPos = checkAndAddNewPage(40);

        // Kategori başlığı
        drawBox(margin, yPos + 10, contentWidth, 30, {
          color: colors.primary,
          borderWidth: 0,
          radius: 4,
          opacity: 0.1
        });
        
        drawText(kategori.label, margin + 15, yPos - 8, {
          size: 10,
          color: colors.primary
        });
        yPos -= 35;

        // Kategorideki sorular
        for (const soru of kategori.sorular) {
          if (!soru) continue;

          const soruMetni = soru.soru || '';
          const maxSoruWidth = contentWidth - 70;
          
          // Soru yüksekliğini hesapla
          const soruLines = wrapText(soruMetni, maxSoruWidth, fontSize);
          const soruHeight = Math.max(35, (soruLines.length * fontSize * 1.2) + 15);

          yPos = checkAndAddNewPage(soruHeight + 10);

          // Soru kutusu
          drawBox(margin, yPos + 10, contentWidth, soruHeight, {
            shadow: true,
            color: colors.text.light,
            borderWidth: 0,
            radius: 6
          });

          // Soru metni
          const textHeight = drawMultilineText(soruMetni, margin + 15, yPos - 8, maxSoruWidth, {
            size: fontSize,
              color: colors.text.dark,
              lineHeight: 1.2
            });

          // Cevap kutusu ve detaylar
          if (soru.tip === 'evet_hayir') {
            const cevapText = `${soru.yanit === 'evet' ? 'Evet' : soru.yanit === 'hayir' ? 'Hayır' : 'Yanıtsız'}`;

            const cevapWidth = 45;
            const cevapHeight = 18;
            const cevapX = margin + contentWidth - cevapWidth - 15;
            const cevapY = yPos - (soruHeight / 2) + (cevapHeight / 2) - 5;
            
            drawBox(cevapX, cevapY + cevapHeight, cevapWidth, cevapHeight, {
              color: soru.yanit === 'evet' ? rgb(0.9, 1, 0.9) : 
                     soru.yanit === 'hayir' ? rgb(1, 0.95, 0.95) : 
                     rgb(0.98, 0.98, 0.98),
              borderWidth: 0,
              radius: 8
            });

            drawText(cevapText, cevapX + 6, cevapY + 5, {
              size: fontSize - 1,
              color: soru.yanit === 'hayir' ? colors.danger : 
                     soru.yanit === 'evet' ? colors.success :
                     colors.text.muted
            });

            // Puan gösterimi
            if (soru.puan) {
              drawText(`${soru.puan} puan`, cevapX - 50, cevapY + 5, {
                size: fontSize - 1,
                color: colors.text.muted
              });
            }

          } else if (soru.tip === 'coklu_secim' && soru.secenekler) {
            yPos -= soruHeight + 5;

            // Seçenekler için kutu
            const secenekler = Object.entries(soru.secenekler);
            const seceneklerHeight = secenekler.length * 35;
            
            yPos = checkAndAddNewPage(seceneklerHeight + 20);

            // Toplam puan gösterimi
            if (soru.toplamPuan) {
              drawText(`Toplam: ${soru.toplamPuan} puan`, margin + contentWidth - 80, yPos + 5, {
                size: fontSize - 1,
                color: colors.primary
              });
            }

            for (const [secenekMetin, secenekData] of secenekler) {
              const secenekHeight = 30;
              yPos = checkAndAddNewPage(secenekHeight + 15);

              // Seçenek kutusu
              drawBox(margin + 20, yPos + 10, contentWidth - 40, secenekHeight, {
                color: secenekData.yanit === 'evet' ? rgb(0.95, 1, 0.95) :
                       secenekData.yanit === 'hayir' ? rgb(1, 0.95, 0.95) :
                       rgb(0.98, 0.98, 0.98),
                borderWidth: 0,
                radius: 6
              });

              // Seçenek metni
              drawText(secenekMetin, margin + 35, yPos - 5, {
                size: fontSize,
                color: colors.text.dark
              });

              // Seçenek cevabı ve puanı
              const cevapText = secenekData.yanit === 'evet' ? 'Evet' :
                              secenekData.yanit === 'hayir' ? 'Hayır' : 
                              'Yanıtsız';

              drawText(cevapText, margin + contentWidth - 100, yPos - 5, {
                size: fontSize - 1,
                color: secenekData.yanit === 'hayir' ? colors.danger :
                       secenekData.yanit === 'evet' ? colors.success :
                       colors.text.muted
              });

              if (secenekData.yanit === 'evet' && secenekData.puan) {
                drawText(`${secenekData.puan} puan`, margin + contentWidth - 60, yPos - 5, {
                  size: fontSize - 1,
                  color: colors.text.muted
                });
              }

              // Seçenek açıklaması
              if (secenekData.aciklama) {
                yPos -= secenekHeight + 5;
                
                const aciklamaMaxWidth = contentWidth - 80;
                const aciklamaLines = wrapText(secenekData.aciklama, aciklamaMaxWidth, fontSize - 1);
                const aciklamaHeight = Math.max(25, (aciklamaLines.length * (fontSize - 1) * 1.2) + 10);

                yPos = checkAndAddNewPage(aciklamaHeight + 10);

                drawBox(margin + 35, yPos + 10, contentWidth - 70, aciklamaHeight, {
                  color: rgb(0.98, 0.98, 0.98),
                  borderWidth: 0,
                  radius: 4
                });

                drawText('Açıklama:', margin + 45, yPos - 3, {
                  size: fontSize - 1,
                  color: colors.text.muted
                });

                drawMultilineText(secenekData.aciklama, margin + 100, yPos - 3, aciklamaMaxWidth - 60, {
                  size: fontSize - 1,
                  color: colors.text.dark,
                  lineHeight: 1.2
                });

                yPos -= aciklamaHeight + 5;
              } else {
                yPos -= secenekHeight + 5;
              }

              // Seçenek fotoğrafları
              if (secenekData.fotograflar && Object.keys(secenekData.fotograflar).length > 0) {
                const fotograflar = Object.values(secenekData.fotograflar).filter(Boolean);
                if (fotograflar.length > 0) {
                  yPos -= 5;

                  const fotolarPerRow = 2;
                  const rows = Math.ceil(fotograflar.length / fotolarPerRow);
                  const totalHeight = (rows * (imageHeight + imageSpacing)) + 20;

                  yPos = checkAndAddNewPage(totalHeight);

                  drawText('Fotoğraflar:', margin + 35, yPos - 5, {
                    size: fontSize - 1,
                    color: colors.text.muted
                  });

                  yPos -= 20;

                  for (let i = 0; i < fotograflar.length; i += fotolarPerRow) {
                    const rowPhotos = fotograflar.slice(i, i + fotolarPerRow);
                    const rowWidth = (imageWidth * rowPhotos.length) + (imageSpacing * (rowPhotos.length - 1));
                    let xPos = margin + 35 + ((contentWidth - 70 - rowWidth) / 2);

                    for (const foto of rowPhotos) {
                      try {
                        const imageKey = `${soru.id}_${secenekMetin}_${foto}`;
                        const imageData = imageUrls[imageKey];
                        if (imageData && imageData.url) {
                          const response = await fetch(imageData.url);
                          const imageBytes = await response.arrayBuffer();
                          const image = await pdfDoc.embedJpg(imageBytes);
                          const { width: imgWidth, height: imgHeight } = image.size();
                          
                          const scale = Math.min(imageWidth / imgWidth, imageHeight / imgHeight);
                          const scaledWidth = imgWidth * scale;
                          const scaledHeight = imgHeight * scale;
                          
                          currentPage.drawImage(image, {
                            x: xPos,
                            y: yPos - scaledHeight,
                            width: scaledWidth,
                            height: scaledHeight
                          });
                          
                          xPos += imageWidth + imageSpacing;
                        }
                      } catch (error) {
                        console.error('Fotoğraf yükleme hatası:', error);
                      }
                    }
                    yPos -= imageHeight + imageSpacing;
                  }
                }
              }
            }
            continue;
          }

          yPos -= soruHeight + 3;

          // Evet/Hayır detayları
          if (soru.tip === 'evet_hayir') {
            if (soru.yanit === 'hayir' && soru.aciklama) {
              yPos -= 5;

              const aciklamaMaxWidth = contentWidth - 50;
              const aciklamaLines = wrapText(soru.aciklama, aciklamaMaxWidth, fontSize - 1);
              const aciklamaHeight = Math.max(30, (aciklamaLines.length * (fontSize - 1) * 1.2) + 15);

              yPos = checkAndAddNewPage(aciklamaHeight + 10);

            // Açıklama kutusu
            drawBox(margin + 20, yPos + 10, contentWidth - 40, aciklamaHeight, {
              color: rgb(1, 0.95, 0.95),
              borderWidth: 1,
              borderColor: rgb(0.95, 0.8, 0.8),
              radius: 6
            });

              // Açıklama başlığı ve metni
              drawText('Açıklama:', margin + 30, yPos - 5, {
              size: fontSize - 1,
              color: colors.danger
            });

              drawMultilineText(soru.aciklama, margin + 30, yPos - 18, aciklamaMaxWidth, {
                size: fontSize - 1,
              color: colors.danger,
                lineHeight: 1.2
              });

              yPos -= aciklamaHeight + 8;
            }
            if (soru.yanit === 'evet' && soru.aciklama) {
              yPos -= 5;

              const aciklamaMaxWidth = contentWidth - 50;
              const aciklamaLines = wrapText(soru.aciklama, aciklamaMaxWidth, fontSize - 1);
              const aciklamaHeight = Math.max(30, (aciklamaLines.length * (fontSize - 1) * 1.2) + 15);

              yPos = checkAndAddNewPage(aciklamaHeight + 10);

              // Açıklama kutusu
              drawBox(margin + 20, yPos + 10, contentWidth - 40, aciklamaHeight, {
                color: rgb(0.95, 1, 0.95),
                borderWidth: 1,
                borderColor: rgb(0.9, 0.8, 0.8),
                radius: 6
              });

              // Açıklama başlığı ve metni
              drawText('Açıklama:', margin + 30, yPos - 5, {
                size: fontSize - 1,
                color: colors.success
              });

              drawMultilineText(soru.aciklama, margin + 30, yPos - 18, aciklamaMaxWidth, {
                size: fontSize - 1,
                color: colors.success,
                lineHeight: 1.2
              });

              yPos -= aciklamaHeight + 8;
            }

            // Fotoğraflar
          if (soru.fotograflar && Object.keys(soru.fotograflar).length > 0) {
              const fotograflar = Object.values(soru.fotograflar).filter(Boolean);
              if (fotograflar.length > 0) {
                yPos -= 5;

                const fotolarPerRow = 2;
                const rows = Math.ceil(fotograflar.length / fotolarPerRow);
                const totalHeight = (rows * (imageHeight + imageSpacing)) + 20;

                yPos = checkAndAddNewPage(totalHeight);

                drawText('Fotoğraflar:', margin + 15, yPos - 5, {
                  size: fontSize - 1,
                  color: colors.text.muted
                });

                yPos -= 20;

                for (let i = 0; i < fotograflar.length; i += fotolarPerRow) {
                  const rowPhotos = fotograflar.slice(i, i + fotolarPerRow);
                  const rowWidth = (imageWidth * rowPhotos.length) + (imageSpacing * (rowPhotos.length - 1));
                  let xPos = margin + (contentWidth - rowWidth) / 2;

                  for (const foto of rowPhotos) {
                    try {
                      const imageKey = `${soru.id}_${soruMetni}_${foto}`;
                      const imageData = imageUrls[imageKey];
                      if (imageData && imageData.url) {
                        const response = await fetch(imageData.url);
                        const imageBytes = await response.arrayBuffer();
                        const image = await pdfDoc.embedJpg(imageBytes);
                        const { width: imgWidth, height: imgHeight } = image.size();
                        
                        // En-boy oranını koru
                        const scale = Math.min(imageWidth / imgWidth, imageHeight / imgHeight);
                        const scaledWidth = imgWidth * scale;
                        const scaledHeight = imgHeight * scale;
                        
                        currentPage.drawImage(image, {
                          x: xPos,
                          y: yPos - scaledHeight,
                          width: scaledWidth,
                          height: scaledHeight
                        });
                        
                        xPos += imageWidth + imageSpacing;
                      }
                    } catch (error) {
                      console.error('Fotoğraf yükleme hatası:', error);
                    }
                  }
                  yPos -= imageHeight + imageSpacing;
                }
              }
            }
          }

          yPos -= 5;
        }
        yPos -= 10;
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dosyaAdi = `denetim_raporu_${denetim.subeAdi || 'rapor'}_${new Date(denetim.denetimTarihi).toLocaleDateString('tr-TR').replace(/\//g, '-')}.pdf`;
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

  // ImageComponent bileşenini güncelle
  const ImageComponent = React.memo(({ imageKey, index }) => {
    const imageData = imageUrls[imageKey];
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
      if (imageData?.url) {
        console.log('Resim yükleniyor:', imageKey, imageData.url);
        const img = new Image();
        img.onload = () => {
          console.log('Resim başarıyla yüklendi:', imageKey);
          setLoading(false);
        };
        img.onerror = (e) => {
          console.error('Resim yükleme hatası:', imageKey, e);
          setError(true);
          setLoading(false);
        };
        img.src = imageData.url;
      } else {
        console.log('Resim verisi bulunamadı:', imageKey);
        setError(true);
        setLoading(false);
      }
    }, [imageData?.url, imageKey]);

    if (loading) {
      return (
        <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      );
    }

    if (!imageData?.url || error) {
      return (
        <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      );
    }

    return (
      <img
        src={imageData.url}
        alt={`Detay ${index + 1}`}
        className="w-20 h-20 object-cover rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
        loading="lazy"
        onError={(e) => {
          console.error('Resim yükleme hatası (img tag):', imageKey, e);
          setError(true);
        }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedImage(imageData.url);
        }}
      />
    );
  });

  // Fotoğraflar bölümünü güncelle
  const renderFotograflar = (fotograflar, soruKey) => {
    if (!fotograflar || Object.keys(fotograflar).length === 0) return null;

    return (
      <div className="mt-2">
        <p className="text-xs text-gray-500 mb-2">Fotoğraflar:</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(fotograflar).map(([key, foto]) => {
            const imageKey = `${soruKey}_${key}`;
            console.log('Render edilen fotoğraf:', { soruKey, key, imageKey, foto });
            return (
              <div
                key={imageKey}
                className="relative group cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  const imageData = imageUrls[imageKey];
                  if (imageData?.url) {
                    setSelectedImage(imageData.url);
                  }
                }}
              >
                <ImageComponent imageKey={imageKey} index={key} />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Çoklu seçim fotoğrafları için render fonksiyonu
  const renderSecenekFotograflari = (secenekData, soruId, secenekMetin) => {
    if (!secenekData.fotograflar || Object.keys(secenekData.fotograflar).length === 0) return null;

    return (
      <div className="mt-2">
        <p className="text-xs text-gray-500 mb-2">Fotoğraflar:</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(secenekData.fotograflar).map(([key, foto]) => {
            const imageKey = `${soruId}_${secenekMetin}_${key}`;
            console.log('Render edilen seçenek fotoğrafı:', { soruId, secenekMetin, key, imageKey, foto });
            return (
              <div
                key={imageKey}
                className="relative group cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  const imageData = imageUrls[imageKey];
                  if (imageData?.url) {
                    setSelectedImage(imageData.url);
                  }
                }}
              >
                <ImageComponent imageKey={imageKey} index={key} />
              </div>
            );
          })}
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
              to="/panel"
              className="mr-4 text-gray-500 hover:text-gray-900"
            >
              ←
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              Denetim Detayları
            </h1>
          </div>
          <div className="flex gap-4 mt-4 sm:mt-0">
            <Link
              to={`/panel/denetim-analiz/${id}`}
              className="inline-flex items-center px-4 py-2 border border-red-500 rounded-xl shadow-sm text-sm font-medium text-red-600 bg-white hover:bg-red-50"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analiz Görüntüle
            </Link>
            <button
              onClick={handlePDFGenerate}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF İndir
            </button>
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
            {/* Şube Bilgileri */}
            <div className="col-span-2 border-b border-gray-200 pb-4 mb-4">
              <h4 className="text-sm font-medium text-gray-500 mb-3">Şube Bilgileri</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Şube Adı</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{denetim.subeAdi}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Adres</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{denetim.subeAdres || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Telefon</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{denetim.subeTelefon || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">E-posta</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{denetim.subeEmail || '-'}</p>
                </div>
              </div>
            </div>

            {/* Denetim Detayları */}
            <div>
              <h4 className="text-sm font-medium text-gray-500">Denetimci</h4>
              <p className="mt-1 text-sm text-gray-900">
                {denetim.denetimci?.ad} {denetim.denetimci?.soyad}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Tarih</h4>
              <p className="mt-1 text-sm text-gray-900">
                {new Date(denetim.denetimTarihi).toLocaleString('tr-TR')}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Toplam Puan</h4>
              <p className="mt-1 text-sm text-gray-900">
                {denetim.sonuc?.toplamPuan || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sorular ve Cevaplar */}
      <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Sorular ve Cevaplar
          </h3>
        </div>
        <div className="px-6 py-5">
          <div className="space-y-8">
            {Object.entries(grupluSorular).map(([kategoriId, kategori]) => (
              <div key={kategoriId} className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900">
                  {kategori.label}
                </h4>
                <div className="space-y-4">
                  {kategori.sorular.map((soru, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <div className="space-y-2">
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
                                {renderSecenekFotograflari(secenekData, soru.id, secenekMetin)}
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
                                {renderFotograflar(soru.fotograflar, soru.id)}
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