import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, get, set } from 'firebase/database';
import { realdb } from '../../firebase/config';
import { toast } from 'react-hot-toast';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
// Basit haversine mesafe hesabı (metre)
const haversineDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000; // Dünya yarıçapı (m)
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function DenetimYapPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [yanitlar, setYanitlar] = useState({});
  const [denetimci, setDenetimci] = useState({
    ad: '',
    soyad: '',
    telefon: '',
    email: ''
  });
  const [subeler, setSubeler] = useState({});
  const [secilenSube, setSecilenSube] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [secilenFotograf, setSecilenFotograf] = useState(null);
  const [tesekkurModalVisible, setTesekkurModalVisible] = useState(false);
  const [hataMesaji, setHataMesaji] = useState(null);
  const [kapatiliyor, setKapatiliyor] = useState(false);
  const [kapatmaSayac, setKapatmaSayac] = useState(5);
  const [yuklenenFoto, setYuklenenFoto] = useState(null);
  const [cevaplanmamisSorular, setCevaplanmamisSorular] = useState([]);
  const [konumDogrulandi, setKonumDogrulandi] = useState(false);
  const [konumHatasi, setKonumHatasi] = useState('');
  const [kullaniciKonumu, setKullaniciKonumu] = useState(null);
  const [cevaplanmamisSorularModalVisible, setCevaplanmamisSorularModalVisible] = useState(false);
  const [linkData, setLinkData] = useState(null);
  const [eskiLinkData, setEskiLinkData] = useState(null);

  useEffect(() => {
    const formKontrol = async () => {
      try {
        setLoading(true);

        // Önce yeni link sistemini kontrol et
        const linkRef = ref(realdb, `denetimLinkleri/${id}`);
        const linkSnapshot = await get(linkRef);

        if (linkSnapshot.exists()) {
          const linkData = linkSnapshot.val();
          setLinkData(linkData); // Link verisini state'e kaydet

          // Link kullanılmış mı kontrol et
          if (linkData.kullanildi) {
            setHataMesaji({
              baslik: 'Link Kullanılmış',
              aciklama: 'Bu link daha önceden kullanılmış. Lütfen yönetici ile iletişime geçin.',
              icon: (
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )
            });
            setLoading(false);
            return;
          }

          // Zaman kontrolü
          const simdi = new Date();
          const baslangic = new Date(`${linkData.baslangicTarihi}T${linkData.baslangicSaati}`);
          const bitis = new Date(`${linkData.bitisTarihi}T${linkData.bitisSaati}`);

          if (simdi < baslangic) {
            setHataMesaji({
              baslik: 'Link Henüz Aktif Değil',
              aciklama: `Bu link ${baslangic.toLocaleDateString('tr-TR')} ${linkData.baslangicSaati} tarihinden itibaren kullanılabilir.`,
              icon: (
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )
            });
            setLoading(false);
            return;
          }

          if (simdi > bitis) {
            setHataMesaji({
              baslik: 'Link Süresi Dolmuş',
              aciklama: `Bu linkin kullanım süresi ${bitis.toLocaleDateString('tr-TR')} ${linkData.bitisSaati} tarihinde dolmuş.`,
              icon: (
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )
            });
            setLoading(false);
            return;
          }

          // Form bilgilerini getir (konum doğrulaması ekran yüklendikten sonra gösterilecek)
          const formRef = ref(realdb, `denetimFormlari/${linkData.formId}`);
          const formSnapshot = await get(formRef);

          if (!formSnapshot.exists()) {
            toast.error('Form bulunamadı');
            navigate('/');
            return;
          }

          const formData = formSnapshot.val();

          if (!formData || !formData.sorular || !Array.isArray(formData.sorular)) {
            setHataMesaji({
              baslik: 'Form Verisi Hatalı',
              aciklama: 'Form verisi eksik veya hatalı. Lütfen yönetici ile iletişime geçin.',
              icon: (
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )
            });
            setLoading(false);
            return;
          }

          setForm({
            id: linkData.formId,
            baslik: formData.baslik,
            aciklama: formData.aciklama,
            sorular: formData.sorular
          });

          // Denetimci bilgilerini otomatik doldurma kaldırıldı - kullanıcı kendisi girecek
          // setDenetimci({
          //   ad: linkData.denetimciAdi.split(' ')[0] || '',
          //   soyad: linkData.denetimciAdi.split(' ').slice(1).join(' ') || '',
          //   telefon: linkData.denetimciTelefon || '',
          //   email: linkData.denetimciEmail || ''
          // });

          // Hedef şubeyi otomatik seç
          setSecilenSube(linkData.hedefSube || '');

          // Link kullanımını konum doğrulamasından sonraya taşıyoruz
          // await set(linkRef, {
          //   ...linkData,
          //   kullanildi: true,
          //   kullanilmaTarihi: new Date().toISOString()
          // });

        } else {
          // Eski sistem için geriye dönük uyumluluk
          const eskiLinkRef = ref(realdb, `tekKullanimlikLinkler/${id}`);
          const eskiLinkSnapshot = await get(eskiLinkRef);

          if (eskiLinkSnapshot.exists()) {
            const eskiLinkData = eskiLinkSnapshot.val();
            setEskiLinkData(eskiLinkData); // Eski link verisini state'e kaydet

            if (eskiLinkData.kullanildi) {
              setHataMesaji({
                baslik: 'Link Kullanılmış',
                aciklama: 'Bu link daha önceden kullanılmış. Lütfen yönetici ile iletişime geçin.',
                icon: (
                  <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )
              });
              setLoading(false);
              return;
            }

            if (new Date(eskiLinkData.sonKullanmaTarihi) < new Date()) {
              setHataMesaji({
                baslik: 'Link Süresi Dolmuş',
                aciklama: 'Bu linkin kullanım süresi dolmuş. Lütfen yönetici ile iletişime geçin.',
                icon: (
                  <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )
              });
              setLoading(false);
              return;
            }

            const formRef = ref(realdb, `denetimFormlari/${eskiLinkData.formId}`);
            const formSnapshot = await get(formRef);

            if (!formSnapshot.exists()) {
              toast.error('Form bulunamadı');
              navigate('/');
              return;
            }

            const formData = formSnapshot.val();

            if (!formData || !formData.sorular || !Array.isArray(formData.sorular)) {
              setHataMesaji({
                baslik: 'Form Verisi Hatalı',
                aciklama: 'Form verisi eksik veya hatalı. Lütfen yönetici ile iletişime geçin.',
                icon: (
                  <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )
              });
              setLoading(false);
              return;
            }

            setForm({
              id: eskiLinkData.formId,
              baslik: formData.baslik,
              aciklama: formData.aciklama,
              sorular: formData.sorular
            });

            // Link kullanımını konum doğrulamasından sonraya taşıyoruz
            // await set(eskiLinkRef, {
            //   ...eskiLinkData,
            //   kullanildi: true,
            //   kullanilmaTarihi: new Date().toISOString()
            // });

          } else {
            setHataMesaji({
              baslik: 'Geçersiz Link',
              aciklama: 'Bu link geçersiz veya bulunamadı. Lütfen yönetici ile iletişime geçin.',
              icon: (
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )
            });
            setLoading(false);
            return;
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Form kontrol hatası:', error);
        setHataMesaji({
          baslik: 'Bir Hata Oluştu',
          aciklama: 'İşlem sırasında bir hata oluştu. Lütfen yönetici ile iletişime geçin.',
          icon: (
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        });
        setLoading(false);
      }
    };

    formKontrol();
  }, [id, navigate]);

  // Link kullanımını işaretleme fonksiyonu
  const linkKullanildiIsaretle = async () => {
    try {
      // Yeni link sistemi için
      if (linkData) {
        const linkRef = ref(realdb, `denetimLinkleri/${id}`);
        await set(linkRef, {
          ...linkData,
          kullanildi: true,
          kullanilmaTarihi: new Date().toISOString()
        });
        console.log('Yeni link sistemi - link kullanıldı olarak işaretlendi');
      }
      // Eski link sistemi için
      else if (eskiLinkData) {
        const eskiLinkRef = ref(realdb, `tekKullanimlikLinkler/${id}`);
        await set(eskiLinkRef, {
          ...eskiLinkData,
          kullanildi: true,
          kullanilmaTarihi: new Date().toISOString()
        });
        console.log('Eski link sistemi - link kullanıldı olarak işaretlendi');
      }
    } catch (error) {
      console.error('Link kullanım işaretleme hatası:', error);
    }
  };

  // Şubeleri yükle
  useEffect(() => {
    const fetchSubeler = async () => {
      try {
        const subelerRef = ref(realdb, 'branches');
        const snapshot = await get(subelerRef);

        if (snapshot.exists()) {
          const subeVerileri = {};
          Object.entries(snapshot.val()).forEach(([id, data]) => {
            if (data.isActive) {
              subeVerileri[id] = data;
            }
          });
          setSubeler(subeVerileri);
        }
      } catch (error) {
        console.error('Şubeler yüklenirken hata:', error);
        toast.error('Şubeler yüklenemedi');
      }
    };

    fetchSubeler();
  }, []);

  // Konum doğrulama: 100 m çember içinde mi?
  useEffect(() => {
    const dogrula = async () => {
      try {
        setKonumHatasi('');
        setKonumDogrulandi(false);

        // Geliştirme ortamında konum doğrulamasını atla
        if (process.env.NODE_ENV === 'development') {
          console.log('Geliştirme ortamı: Konum doğrulaması atlanıyor');
          setKonumDogrulandi(true);
          linkKullanildiIsaretle();
          return;
        }

        if (!secilenSube) return;
        const hedefSube = subeler[secilenSube];
        if (!hedefSube || typeof hedefSube.lat !== 'number' || typeof hedefSube.lng !== 'number') {
          setKonumHatasi('Bu şube için konum tanımlanmamış. Lütfen yönetici ile iletişime geçin.');
          return;
        }

        if (!('geolocation' in navigator)) {
          setKonumHatasi('Tarayıcı konum izni desteklemiyor. Lütfen konumu etkinleştirin.');
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            setKullaniciKonumu({ lat: latitude, lng: longitude });
            const mesafe = haversineDistanceMeters(latitude, longitude, hedefSube.lat, hedefSube.lng);
            const maxDistance = hedefSube.distance || 100;
            if (mesafe <= maxDistance) {
              setKonumDogrulandi(true);
              setKonumHatasi('');
              // Konum doğrulandığında link kullanımını işaretle
              linkKullanildiIsaretle();
            } else {
              setKonumDogrulandi(false);
              setKonumHatasi(`Konum doğrulanamadı. Şube merkezine uzaklık: ${Math.round(mesafe)} m (<= ${maxDistance} m olmalı).`);
            }
          },
          (err) => {
            console.error('Konum hatası:', err);
            setKonumHatasi('Konum alınamadı. Lütfen konum izinlerini verin ve tekrar deneyin.');
            setKonumDogrulandi(false);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      } catch (e) {
        console.error(e);
        setKonumHatasi('Konum doğrulaması sırasında hata oluştu.');
        setKonumDogrulandi(false);
      }
    };

    // Şube seçimi yapıldığında veya şubeler yüklendiğinde tetikle
    if (secilenSube && Object.keys(subeler).length > 0) {
      dogrula();
    }
  }, [secilenSube, subeler]);

  const yenidenKonumDogrula = () => {
    try {
      setKonumHatasi('');
      setKonumDogrulandi(false);

      // Geliştirme ortamında konum doğrulamasını atla
      if (process.env.NODE_ENV === 'development') {
        console.log('Geliştirme ortamı: Konum doğrulaması atlanıyor');
        setKonumDogrulandi(true);
        linkKullanildiIsaretle();
        return;
      }

      if (!secilenSube) return;
      const hedefSube = subeler[secilenSube];
      if (!hedefSube || typeof hedefSube.lat !== 'number' || typeof hedefSube.lng !== 'number') {
        setKonumHatasi('Bu şube için konum tanımlanmamış. Lütfen yönetici ile iletişime geçin.');
        return;
      }
      if (!('geolocation' in navigator)) {
        setKonumHatasi('Tarayıcı konum izni desteklemiyor. Lütfen konumu etkinleştirin.');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setKullaniciKonumu({ lat: latitude, lng: longitude });
          const mesafe = haversineDistanceMeters(latitude, longitude, hedefSube.lat, hedefSube.lng);
          const maxDistance = hedefSube.distance || 100;
          if (mesafe <= maxDistance) {
            setKonumDogrulandi(true);
            setKonumHatasi('');
            // Konum doğrulandığında link kullanımını işaretle
            linkKullanildiIsaretle();
          } else {
            setKonumDogrulandi(false);
            setKonumHatasi(`Konum doğrulanamadı. Şube merkezine uzaklık: ${Math.round(mesafe)} m (<= ${maxDistance} m olmalı).`);
          }
        },
        () => setKonumHatasi('Konum alınamadı. Lütfen izin verin ve tekrar deneyin.'),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } catch (e) {
      console.error(e);
      setKonumHatasi('Konum doğrulaması sırasında hata oluştu.');
      setKonumDogrulandi(false);
    }
  };

  const handleYanitChange = (soruKey, field, value) => {
    setYanitlar(prev => {
      // Çoklu seçim soruları için özel kontrol
      if (field === 'yanitlar') {
        const [secenekMetin, secenekYanit] = Object.entries(value)[0];
        return {
          ...prev,
          [soruKey]: {
            ...prev[soruKey],
            yanitlar: {
              ...(prev[soruKey]?.yanitlar || {}),
              [secenekMetin]: secenekYanit
            }
          }
        };
      }

      // Açıklamalar için özel kontrol
      if (field === 'aciklamalar') {
        return {
          ...prev,
          [soruKey]: {
            ...prev[soruKey],
            aciklamalar: {
              ...(prev[soruKey]?.aciklamalar || {}),
              ...value
            }
          }
        };
      }

      // Normal field güncellemesi
      return {
        ...prev,
        [soruKey]: {
          ...prev[soruKey],
          [field]: value
        }
      };
    });
  };

  const handleFotografEkle = async (soruKey, files, secenekMetin = null) => {
    setYuklenenFoto({
      durum: 'başladı',
      mesaj: 'Fotoğraf yükleniyor...'
    });

    const storage = getStorage();
    const yeniFotograflar = {};
    const soru = form.sorular[parseInt(soruKey.split('_')[1]) - 1];

    try {
      for (const file of files) {
        const timestamp = Date.now();
        const fileName = soru.tip === 'coklu_secim' && secenekMetin
          ? `denetimler/${form.id}/${soruKey}/${secenekMetin.replace(/\s+/g, '_')}/${timestamp}_${file.name}`
          : `denetimler/${form.id}/${soruKey}/${timestamp}_${file.name}`;

        setYuklenenFoto({
          durum: 'yükleniyor',
          mesaj: 'Fotoğraf Firebase\'e yükleniyor...'
        });

        const fileRef = storageRef(storage, fileName);
        await uploadBytes(fileRef, file);

        setYuklenenFoto({
          durum: 'url-alınıyor',
          mesaj: 'Fotoğraf URL\'i alınıyor...'
        });

        const downloadURL = await getDownloadURL(fileRef);

        yeniFotograflar[timestamp] = {
          url: downloadURL,
          name: file.name,
          path: fileName
        };
      }

      setYuklenenFoto({
        durum: 'state-güncelleniyor',
        mesaj: 'Fotoğraf bilgileri kaydediliyor...'
      });

      setYanitlar(prev => {
        const prevSoru = prev[soruKey] || {};

        if (soru.tip === 'coklu_secim' && secenekMetin) {
          // Çoklu seçim sorusu için seçenek bazlı fotoğraf ekleme
          return {
            ...prev,
            [soruKey]: {
              ...prevSoru,
              yanitlar: {
                ...(prevSoru.yanitlar || {}),
                [secenekMetin]: 'hayir'
              },
              secenekler: {
                ...(prevSoru.secenekler || {}),
                [secenekMetin]: {
                  ...(prevSoru.secenekler?.[secenekMetin] || {}),
                  fotograflar: {
                    ...(prevSoru.secenekler?.[secenekMetin]?.fotograflar || {}),
                    ...yeniFotograflar
                  }
                }
              }
            }
          };
        } else {
          // Evet/Hayır sorusu için fotoğraf ekleme
          return {
            ...prev,
            [soruKey]: {
              ...prevSoru,
              yanit: 'hayir',
              fotograflar: {
                ...(prevSoru.fotograflar || {}),
                ...yeniFotograflar
              }
            }
          };
        }
      });

      setYuklenenFoto({
        durum: 'tamamlandı',
        mesaj: 'Fotoğraf başarıyla yüklendi!'
      });

      setTimeout(() => {
        setYuklenenFoto(null);
      }, 2000);

      toast.success('Fotoğraflar başarıyla yüklendi');
    } catch (error) {
      console.error('Fotoğraf yükleme hatası:', error);
      setYuklenenFoto({
        durum: 'hata',
        mesaj: 'Fotoğraf yüklenirken hata oluştu: ' + error.message
      });
      toast.error('Fotoğraf yüklenemedi');
    }
  };

  const handleFotografSil = (soruKey, fotografKey, secenekMetin = null) => {
    setYanitlar(prev => {
      const prevSoru = prev[soruKey] || {};
      const soru = form.sorular[parseInt(soruKey.split('_')[1]) - 1];

      if (soru.tip === 'coklu_secim' && secenekMetin) {
        // Çoklu seçim sorusu için seçenek bazlı fotoğraf silme
        const prevSecenekler = prevSoru.secenekler || {};
        const prevSecenek = prevSecenekler[secenekMetin] || {};
        const prevFotograflar = { ...prevSecenek.fotograflar };
        delete prevFotograflar[fotografKey];

        return {
          ...prev,
          [soruKey]: {
            ...prevSoru,
            secenekler: {
              ...prevSecenekler,
              [secenekMetin]: {
                ...prevSecenek,
                fotograflar: prevFotograflar
              }
            }
          }
        };
      } else {
        // Evet/Hayır sorusu için fotoğraf silme
        const prevFotograflar = { ...prevSoru.fotograflar };
        delete prevFotograflar[fotografKey];

        return {
          ...prev,
          [soruKey]: {
            ...prevSoru,
            fotograflar: prevFotograflar
          }
        };
      }
    });
  };

  const handleDenetimKaydet = async () => {
    // Denetimci bilgileri kontrolü
    if (!denetimci.ad || !denetimci.soyad || !denetimci.telefon || !denetimci.email) {
      toast.error('Lütfen denetimci bilgilerini eksiksiz doldurun');
      return;
    }

    // Email formatı kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(denetimci.email)) {
      toast.error('Lütfen geçerli bir e-posta adresi girin');
      return;
    }

    // Telefon formatı kontrolü
    const telefonRegex = /^[0-9]{10}$/;
    const temizTelefon = denetimci.telefon.replace(/\D/g, '');
    if (!telefonRegex.test(temizTelefon)) {
      toast.error('Lütfen geçerli bir telefon numarası girin (5XX XXX XX XX)');
      return;
    }

    if (!secilenSube) {
      toast.error('Lütfen şube seçiniz');
      return;
    }

    // Cevaplanmamış soruları kontrol et
    const cevaplanmamislar = [];
    form.sorular.forEach((soru, index) => {
      const soruKey = `soru_${index + 1}`;
      const yanit = yanitlar[soruKey];

      if (soru.tip === 'coklu_secim') {
        // Tüm seçeneklerin yanıtlanıp yanıtlanmadığını kontrol et
        const yanitlanmisSecenekSayisi = yanit?.yanitlar ? Object.keys(yanit.yanitlar).length : 0;
        if (!yanit?.yanitlar || yanitlanmisSecenekSayisi !== soru.secenekler.length) {
          cevaplanmamislar.push({
            index: index + 1,
            soru: soru.soru,
            soruKey,
            tip: 'coklu_secim'
          });
        } else {
          // Hayır cevapları için açıklama veya fotoğraf kontrolü
          Object.entries(yanit.yanitlar).forEach(([secenekMetin, secenekYanit]) => {
            if (secenekYanit === 'hayir') {
              const aciklama = yanit.aciklamalar?.[secenekMetin];
              const fotograflar = yanit.secenekler?.[secenekMetin]?.fotograflar;
              if (!aciklama && (!fotograflar || Object.keys(fotograflar).length === 0)) {
                cevaplanmamislar.push({
                  index: index + 1,
                  soru: soru.soru,
                  soruKey,
                  secenekMetin,
                  tip: 'coklu_secim',
                  mesaj: 'Bu seçenek için açıklama yazın veya fotoğraf ekleyin'
                });
              }
            }
          });
        }
      } else if (soru.tip === 'evet_hayir') {
        if (!yanit?.yanit) {
          cevaplanmamislar.push({
            index: index + 1,
            soru: soru.soru,
            soruKey,
            tip: 'evet_hayir'
          });
        } else if (yanit.yanit === 'hayir') {
          // Hayır cevabı için açıklama veya fotoğraf kontrolü
          const aciklama = yanit.aciklama;
          const fotograflar = yanit.fotograflar;
          if (!aciklama && (!fotograflar || Object.keys(fotograflar).length === 0)) {
            cevaplanmamislar.push({
              index: index + 1,
              soru: soru.soru,
              soruKey,
              tip: 'evet_hayir',
              mesaj: 'Hayır cevabı için açıklama yazın veya fotoğraf ekleyin'
            });
          }
        }
      }
    });

    if (cevaplanmamislar.length > 0) {
      setCevaplanmamisSorular(cevaplanmamislar);
      setCevaplanmamisSorularModalVisible(true);
      return;
    }

    setGonderiliyor(true);
    try {
      const denetimId = Date.now().toString();
      const denetimRef = ref(realdb, `denetimler/${denetimId}`);

      // Puan hesaplama
      let toplamPuan = 0;
      let evetSayisi = 0;
      let hayirSayisi = 0;

      // Yanıtları düzenle
      const duzenliYanitlar = {};
      form.sorular.forEach((soru, index) => {
        const soruKey = `soru_${index + 1}`;
        const yanit = yanitlar[soruKey];

        if (soru.tip === 'evet_hayir') {
          if (yanit?.yanit === 'evet') {
            evetSayisi++;
            toplamPuan += Number(soru.puan || 0);
          } else if (yanit?.yanit === 'hayir') {
            hayirSayisi++;
          }

          duzenliYanitlar[soruKey] = {
            soru: soru.soru,
            tip: soru.tip,
            kategoriId: soru.kategoriId,
            yanit: yanit?.yanit || '',
            aciklama: yanit?.aciklama || '',
            fotograflar: yanit?.fotograflar || {},
            puan: yanit?.yanit === 'evet' ? Number(soru.puan || 0) : 0
          };

        } else if (soru.tip === 'coklu_secim') {
          const secimYanitlar = yanit?.yanitlar || {};
          let soruPuani = 0;
          let evetVarMi = false;
          let hayirVarMi = false;

          // Her seçenek için yanıt ve puan hesaplama
          const secenekYanitlari = {};
          soru.secenekler.forEach(secenek => {
            const secenekYanit = secimYanitlar[secenek.metin];
            if (secenekYanit === 'evet') {
              soruPuani += Number(secenek.puan || 0);
              evetVarMi = true;
            } else if (secenekYanit === 'hayir') {
              hayirVarMi = true;
            }

            // Seçenek bazlı fotoğrafları al
            const secenekFotograflar = yanit?.secenekler?.[secenek.metin]?.fotograflar || {};

            secenekYanitlari[secenek.metin] = {
              yanit: secenekYanit || '',
              puan: secenekYanit === 'evet' ? Number(secenek.puan || 0) : 0,
              aciklama: yanit?.aciklamalar?.[secenek.metin] || '',
              fotograflar: secenekFotograflar
            };
          });

          if (evetVarMi) evetSayisi++;
          if (hayirVarMi) hayirSayisi++;
          toplamPuan += soruPuani;

          duzenliYanitlar[soruKey] = {
            soru: soru.soru,
            tip: soru.tip,
            kategoriId: soru.kategoriId,
            yanitlar: yanit?.yanitlar || {},
            aciklamalar: yanit?.aciklamalar || {},
            secenekler: secenekYanitlari,
            toplamPuan: soruPuani
          };

        } else if (soru.tip === 'uzun_metin') {
          duzenliYanitlar[soruKey] = {
            soru: soru.soru,
            tip: soru.tip,
            kategoriId: soru.kategoriId,
            yanit: yanit?.yanit || '',
            aciklama: yanit?.aciklama || ''
          };
        }
      });

      const denetimData = {
        formId: form.id,
        formAdi: form.baslik,
        formAciklama: form.aciklama,
        subeId: secilenSube,
        subeAdi: subeler[secilenSube]?.name || 'Bilinmeyen Şube',
        denetimci,
        yanitlar: duzenliYanitlar,
        denetimTarihi: new Date().toISOString(),
        durum: 'tamamlandi',
        sonuc: {
          toplamPuan,
          yuzde: Math.round((evetSayisi / (evetSayisi + hayirSayisi)) * 100),
          evetSayisi,
          hayirSayisi,
          toplamSoru: form.sorular.length
        }
      };

      await set(denetimRef, denetimData);

      // Link verisini güncelle - denetim ID'sini kaydet
      const linkRef = ref(realdb, `denetimLinkleri/${id}`);
      const linkSnapshot = await get(linkRef);
      if (linkSnapshot.exists()) {
        await set(linkRef, {
          ...linkSnapshot.val(),
          denetimId: denetimId,
          kullanilmaTarihi: new Date().toISOString()
        });
      }

      // E-posta gönderme işlemi
      try {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(to right, #DC2626, #EF4444); padding: 20px; text-align: center;">
              <h1 style="font-family: Archivo, Arial, sans-serif; color: white; font-size: 32px; font-weight: 700; margin: 0; letter-spacing: 1px;">
                BURGERSCHÖN
              </h1>
            </div>
            <div style="padding: 20px; background-color: #fff; border-radius: 10px; margin-top: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: #111827; margin-bottom: 20px;">Yeni Gizli Müşteri Denetimi Tamamlandı!</h2>
              
              <div style="background-color: #F3F4F6; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="color: #111827; margin-top: 0;">Denetim Bilgileri</h3>
                <p style="margin: 5px 0;"><strong>Denetimci:</strong> ${denetimci.ad} ${denetimci.soyad}</p>
                <p style="margin: 5px 0;"><strong>Şube:</strong> ${subeler[secilenSube]?.name}</p>
                <p style="margin: 5px 0;"><strong>Şube Adresi:</strong> ${subeler[secilenSube]?.address}</p>
                <p style="margin: 5px 0;"><strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')}</p>
              </div>
              
              <div style="background-color: #FEF2F2; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="color: #111827; margin-top: 0;">Denetim Sonuçları</h3>
                <p style="margin: 5px 0;"><strong>Toplam Puan:</strong> ${denetimData.sonuc.toplamPuan}</p>
                <p style="margin: 5px 0;"><strong>Başarı Yüzdesi:</strong> %${denetimData.sonuc.yuzde}</p>
                <p style="margin: 5px 0;"><strong>Evet Sayısı:</strong> ${denetimData.sonuc.evetSayisi}</p>
                <p style="margin: 5px 0;"><strong>Hayır Sayısı:</strong> ${denetimData.sonuc.hayirSayisi}</p>
              </div>
              
              <a href="https://gizlimusteri.vercel.app/panel/denetim-detay/${denetimId}" 
                 style="display: inline-block; background: linear-gradient(to right, #DC2626, #EF4444); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">
                Detayları Görüntüle
              </a>
            </div>
            
            <div style="text-align: center; margin-top: 20px; color: #6B7280; font-size: 14px;">
              <p>Bu e-posta Burgerschön Denetim Sistemi tarafından otomatik olarak gönderilmiştir.</p>
            </div>
          </div>
        `;

        const response = await fetch('https://burgerschonwebserver.vercel.app/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: 'mehmetaliege@burgerschon.com',
            subject: `Yeni Gizli Müşteri Formu Dolduruldu - ${subeler[secilenSube]?.name}`,
            html: emailHtml
          })
        });

        if (!response.ok) {
          throw new Error('E-posta gönderilemedi');
        }
      } catch (error) {
        console.error('E-posta gönderme hatası:', error);
        // E-posta gönderilemese bile denetim kaydedildiği için kullanıcıya hata göstermeyelim
      }

      toast.success('Denetim başarıyla kaydedildi');
      setTesekkurModalVisible(true);
    } catch (error) {
      console.error('Denetim kaydedilirken hata:', error);
      toast.error('Denetim kaydedilemedi');
    }
    setGonderiliyor(false);
  };

  const handleCevaplanmamisSoruTikla = (soruKey) => {
    setCevaplanmamisSorularModalVisible(false);
    setTimeout(() => {
      const element = document.getElementById(soruKey);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-4', 'ring-red-500', 'ring-opacity-50');
        setTimeout(() => {
          element.classList.remove('ring-4', 'ring-red-500', 'ring-opacity-50');
        }, 2000);
      }
    }, 100);
  };

  // Modal kapatıldığında ilk cevaplanmamış soruya kaydır
  const handleModalKapatVeKaydir = () => {
    setCevaplanmamisSorularModalVisible(false);
    if (cevaplanmamisSorular.length > 0) {
      setTimeout(() => {
        const element = document.getElementById(cevaplanmamisSorular[0].soruKey);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-4', 'ring-red-500', 'ring-opacity-50');
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-red-500', 'ring-opacity-50');
          }, 2000);
        }
      }, 100);
    }
  };

  // Kapatma sayacı için useEffect
  useEffect(() => {
    if (kapatiliyor && kapatmaSayac > 0) {
      const timer = setTimeout(() => {
        setKapatmaSayac(prev => prev - 1);
      }, 1000);

      return () => clearTimeout(timer);
    }

    if (kapatiliyor && kapatmaSayac === 0) {
      window.location.href = "about:blank";
      window.close();
    }
  }, [kapatiliyor, kapatmaSayac]);

  const handleModalKapat = () => {
    setKapatiliyor(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-red-50 flex items-center justify-center">
        <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-xl p-8 flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent" />
          <p className="text-gray-600">Form yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (hataMesaji) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-red-50 flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-xl p-8 max-w-lg w-full">
          <div className="flex flex-col items-center text-center gap-6">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              {hataMesaji.icon}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{hataMesaji.baslik}</h3>
              <p className="text-gray-500 mb-6">{hataMesaji.aciklama}</p>
              {kapatiliyor ? (
                <>
                  <div className="mt-4 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                      <span className="text-xl font-bold text-red-600">{kapatmaSayac}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-4">
                    Sayfa {kapatmaSayac} saniye içinde otomatik olarak kapanacak
                  </p>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <a
                    href="mailto:info@burgerschon.com"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors duration-200 font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2" />
                    </svg>
                    E-posta Gönder
                  </a>
                  <button
                    onClick={handleModalKapat}
                    className="px-6 py-3 text-gray-700 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors duration-200 font-medium"
                  >
                    Sayfayı Kapat
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-red-50 flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-xl p-8 max-w-lg w-full">
          <div className="flex flex-col items-center text-center gap-6">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Form Bulunamadı</h3>
              <p className="text-gray-500 mb-6">İstediğiniz form bulunamadı veya erişim izniniz yok.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Kapatma ekranı
  if (kapatiliyor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-red-50 flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-xl p-8 max-w-lg w-full">
          <div className="flex flex-col items-center text-center gap-6">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Form Tamamlandı</h3>
              <p className="text-gray-500">Bu form tek kullanımlıktır ve artık kullanılamaz.</p>
              <div className="mt-4 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                  <span className="text-xl font-bold text-red-600">{kapatmaSayac}</span>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Sayfa {kapatmaSayac} saniye içinde otomatik olarak kapanacak
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-red-50">
      {!konumDogrulandi && (
        <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="bg-white/90 backdrop-blur-xl rounded-[1.5rem] sm:rounded-[2.5rem] shadow-xl p-6 sm:p-8 border border-gray-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">Konum Doğrulaması Gerekli</h2>
                <p className="text-sm text-gray-600 mb-4">Denetime başlamadan önce, şube konumunun 100 metre çevresinde olduğunuzu doğrulayın.</p>
                {konumHatasi && (
                  <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{konumHatasi}</div>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={yenidenKonumDogrula}
                    className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
                  >
                    Konumu Yeniden Doğrula
                  </button>
                  {kullaniciKonumu && (
                    <span className="text-xs text-gray-500">Mevcut konum alındı</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {konumDogrulandi && (
      <>
      {/* Üst Menü */}
      <div className="sticky top-0 z-40">
        <div className="bg-white/90 backdrop-blur-lg border-b border-gray-100">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-center h-16 sm:h-20">
              <div className="flex items-center gap-3">
                <img
                  src="/burgerschonlogokirmizi.png"
                  alt="Logo"
                  className="h-8 sm:h-10 w-auto"
                />
                <div className="flex flex-col">
                  <h1 className="text-xl sm:text-2xl font-archivo font-bold text-gray-900">
                    BURGERSCHÖN
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500">
                    Gizli Müşteri Formu
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ana İçerik */}
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Başlık */}
        <div className="bg-white/90 backdrop-blur-xl rounded-[1.5rem] sm:rounded-[2.5rem] shadow-xl p-6 sm:p-8 mb-4 sm:mb-8 border border-gray-100">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-red-600">
                  {form.baslik}
                </h1>
                <p className="text-sm sm:text-base text-gray-500 mt-1">{form.aciklama}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Denetimci Bilgileri */}
        <div className="bg-white/90 backdrop-blur-xl rounded-[1.5rem] sm:rounded-[2.5rem] shadow-xl p-6 sm:p-8 mb-6 sm:mb-8 border border-gray-100">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-red-600">
                Denetimci Bilgileri
              </h2>
            </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Şube Seçimi</label>
                  <div className="relative">
                    <select
                      value={secilenSube}
                      onChange={(e) => setSecilenSube(e.target.value)}
                      className="appearance-none block w-full pl-4 pr-12 py-3 bg-gray-50/50 border-0 rounded-xl text-base focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all duration-200"
                      disabled={secilenSube && Object.keys(subeler).length > 0}
                    >
                      <option value="">Şube Seçiniz</option>
                      {Object.entries(subeler).map(([id, sube]) => (
                        <option key={id} value={id}>
                          {sube.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                      <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {secilenSube && (
                    <p className="mt-1 text-xs text-gray-500">
                      Şube otomatik olarak seçildi. Değiştirmek için link yöneticisi ile iletişime geçin.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Ad *</label>
                  <input
                    type="text"
                    value={denetimci.ad}
                    onChange={(e) => setDenetimci(prev => ({ ...prev, ad: e.target.value }))}
                    className="block w-full px-4 py-3 bg-gray-50/50 border-0 rounded-xl text-base focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all duration-200"
                    placeholder="Adınız"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Soyad *</label>
                  <input
                    type="text"
                    value={denetimci.soyad}
                    onChange={(e) => setDenetimci(prev => ({ ...prev, soyad: e.target.value }))}
                    className="block w-full px-4 py-3 bg-gray-50/50 border-0 rounded-xl text-base focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all duration-200"
                    placeholder="Soyadınız"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">Telefon *</label>
                  <input
                    type="tel"
                    value={denetimci.telefon}
                    onChange={(e) => setDenetimci(prev => ({ ...prev, telefon: e.target.value }))}
                    className="block w-full px-4 py-3 bg-gray-50/50 border-0 rounded-xl text-base focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all duration-200"
                    placeholder="(5XX) XXX XX XX"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">E-posta *</label>
                  <input
                    type="email"
                    value={denetimci.email}
                    onChange={(e) => setDenetimci(prev => ({ ...prev, email: e.target.value }))}
                    className="block w-full px-4 py-3 bg-gray-50/50 border-0 rounded-xl text-base focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all duration-200"
                    placeholder="ornek@email.com"
                  />
                </div>
              </div>
          </div>
        </div>

        {/* Sorular */}
        <div className="space-y-4">
          {form.sorular?.map((soru, index) => {
            const soruKey = `soru_${index + 1}`;
            return (
              <div
                key={soru.id}
                id={soruKey}
                className="bg-white/90 backdrop-blur-xl rounded-[1.5rem] sm:rounded-[2.5rem] shadow-xl p-6 sm:p-8 border border-gray-100 transition-all duration-300"
              >
                <div className="flex flex-col gap-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-red-600">{index + 1}</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-medium text-gray-900 leading-tight">{soru.soru}</h3>
                  </div>

                  {/* Yanıt Seçenekleri */}
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700">Yanıt</label>
                    {soru.tip === 'evet_hayir' && (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <label className={`flex-1 relative flex cursor-pointer items-center px-6 py-4 rounded-xl transition-all duration-200 ${yanitlar[soruKey]?.yanit === 'evet'
                            ? 'bg-green-600 text-white ring-2 ring-green-600 ring-offset-2'
                            : 'bg-white hover:bg-green-50 text-gray-900 border-2 border-gray-200'
                          }`}>
                          <input
                            type="radio"
                            value="evet"
                            checked={yanitlar[soruKey]?.yanit === 'evet'}
                            onChange={(e) => handleYanitChange(soruKey, 'yanit', e.target.value)}
                            className="sr-only"
                          />
                          <svg className={`w-5 h-5 mr-3 ${yanitlar[soruKey]?.yanit === 'evet' ? 'text-white' : 'text-green-600'}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-base font-medium">Evet</span>
                        </label>
                        <label className={`flex-1 relative flex cursor-pointer items-center px-6 py-4 rounded-xl transition-all duration-200 ${yanitlar[soruKey]?.yanit === 'hayir'
                            ? 'bg-red-600 text-white ring-2 ring-red-600 ring-offset-2'
                            : 'bg-white hover:bg-red-50 text-gray-900 border-2 border-gray-200'
                          }`}>
                          <input
                            type="radio"
                            value="hayir"
                            checked={yanitlar[soruKey]?.yanit === 'hayir'}
                            onChange={(e) => handleYanitChange(soruKey, 'yanit', e.target.value)}
                            className="sr-only"
                          />
                          <svg className={`w-5 h-5 mr-3 ${yanitlar[soruKey]?.yanit === 'hayir' ? 'text-white' : 'text-red-600'}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span className="text-base font-medium">Hayır</span>
                        </label>
                      </div>
                    )}

                    {soru.tip === 'uzun_metin' && (
                      <textarea
                        value={yanitlar[soruKey]?.yanit || ''}
                        onChange={(e) => handleYanitChange(soruKey, 'yanit', e.target.value)}
                        rows="3"
                        className="mt-1.5 block w-full px-4 py-3 bg-gray-50/50 border-0 rounded-xl text-base focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all duration-200"
                        placeholder="Yanıtınızı buraya yazın..."
                      />
                    )}

                    {/* Çoklu seçim soruları */}
                    {soru.tip === 'coklu_secim' && (
                      <div className="space-y-6">
                        {soru.secenekler.map((secenek, idx) => (
                          <div key={idx} className="space-y-4 p-4 bg-gray-50 rounded-xl">
                            <p className="text-base font-medium text-gray-900">{secenek.metin}</p>
                            <div className="flex flex-col sm:flex-row gap-3">
                              <label className={`flex-1 relative flex cursor-pointer items-center px-6 py-4 rounded-xl transition-all duration-200 ${yanitlar[soruKey]?.yanitlar?.[secenek.metin] === 'evet'
                                  ? 'bg-green-600 text-white ring-2 ring-green-600 ring-offset-2'
                                  : 'bg-white hover:bg-green-50 text-gray-900 border-2 border-gray-200'
                                }`}>
                                <input
                                  type="radio"
                                  name={`${soruKey}_${idx}`}
                                  value="evet"
                                  checked={yanitlar[soruKey]?.yanitlar?.[secenek.metin] === 'evet'}
                                  onChange={(e) => {
                                    handleYanitChange(soruKey, 'yanitlar', {
                                      [secenek.metin]: e.target.value
                                    });
                                  }}
                                  className="sr-only"
                                />
                                <svg className={`w-5 h-5 mr-3 ${yanitlar[soruKey]?.yanitlar?.[secenek.metin] === 'evet' ? 'text-white' : 'text-green-600'}`}
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="text-base font-medium">Evet</span>
                              </label>
                              <label className={`flex-1 relative flex cursor-pointer items-center px-6 py-4 rounded-xl transition-all duration-200 ${yanitlar[soruKey]?.yanitlar?.[secenek.metin] === 'hayir'
                                  ? 'bg-red-600 text-white ring-2 ring-red-600 ring-offset-2'
                                  : 'bg-white hover:bg-red-50 text-gray-900 border-2 border-gray-200'
                                }`}>
                                <input
                                  type="radio"
                                  name={`${soruKey}_${idx}`}
                                  value="hayir"
                                  checked={yanitlar[soruKey]?.yanitlar?.[secenek.metin] === 'hayir'}
                                  onChange={(e) => {
                                    handleYanitChange(soruKey, 'yanitlar', {
                                      [secenek.metin]: e.target.value
                                    });
                                  }}
                                  className="sr-only"
                                />
                                <svg className={`w-5 h-5 mr-3 ${yanitlar[soruKey]?.yanitlar?.[secenek.metin] === 'hayir' ? 'text-white' : 'text-red-600'}`}
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span className="text-base font-medium">Hayır</span>
                              </label>
                            </div>

                            {/* Evet seçildiğinde isteğe bağlı açıklama */}
                            {yanitlar[soruKey]?.yanitlar?.[secenek.metin] === 'evet' && (
                              <div>
                                <label className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-700">Açıklama</span>
                                  <span className="text-xs text-gray-500 font-medium">
                                    (İsteğe bağlı)
                                  </span>
                                </label>
                                <textarea
                                  value={yanitlar[soruKey]?.aciklamalar?.[secenek.metin] || ''}
                                  onChange={(e) => {
                                    handleYanitChange(soruKey, 'aciklamalar', {
                                      [secenek.metin]: e.target.value
                                    });
                                  }}
                                  rows="3"
                                  className="mt-1.5 block w-full px-4 py-3 bg-white border-0 rounded-xl text-base focus:ring-2 focus:ring-green-500/20 focus:bg-white transition-all duration-200"
                                  placeholder="Evet cevabınız için açıklama yazabilirsiniz..."
                                />
                              </div>
                            )}

                            {/* Hayır seçildiğinde zorunlu açıklama ve fotoğraf */}
                            {yanitlar[soruKey]?.yanitlar?.[secenek.metin] === 'hayir' && (
                              <div className="space-y-4">
                                <div>
                                  <label className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700">Açıklama</span>
                                    <span className="text-xs text-red-500 font-medium">
                                      (Zorunlu)
                                    </span>
                                  </label>
                                  <textarea
                                    value={yanitlar[soruKey]?.aciklamalar?.[secenek.metin] || ''}
                                    onChange={(e) => {
                                      handleYanitChange(soruKey, 'aciklamalar', {
                                        [secenek.metin]: e.target.value
                                      });
                                    }}
                                    rows="3"
                                    className="mt-1.5 block w-full px-4 py-3 bg-gray-50/50 border-0 rounded-xl text-base focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all duration-200"
                                    placeholder="Neden hayır olduğunu açıklayın..."
                                  />
                                </div>

                                {/* Fotoğraf yükleme alanı */}
                                <div>
                                  <label className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700">Fotoğraf</span>
                                    <span className="text-xs text-red-500 font-medium">
                                      (Zorunlu)
                                    </span>
                                  </label>
                                  <div className="mt-1.5">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      capture="environment"
                                      onChange={(e) => handleFotografEkle(soruKey, e.target.files, secenek.metin)}
                                      className="block w-full text-sm text-gray-500
                                        file:mr-4 file:py-2 file:px-4
                                        file:rounded-full file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-red-50 file:text-red-600
                                        hover:file:bg-red-100
                                        file:cursor-pointer file:transition-colors"
                                    />
                                  </div>

                                  {/* Fotoğraf önizleme */}
                                  {yanitlar[soruKey]?.secenekler?.[secenek.metin]?.fotograflar &&
                                    Object.entries(yanitlar[soruKey].secenekler[secenek.metin].fotograflar).length > 0 && (
                                      <div className="mt-4">
                                        <p className="text-sm font-medium text-gray-700 mb-2">Yüklenen Fotoğraflar:</p>
                                        <div className="grid grid-cols-2 gap-4">
                                          {Object.entries(yanitlar[soruKey].secenekler[secenek.metin].fotograflar).map(([key, foto]) => (
                                            <div key={key} className="relative">
                                              <img src={foto.url} alt={foto.name} className="w-full h-32 object-cover rounded-lg" />
                                              <button
                                                onClick={() => handleFotografSil(soruKey, key, secenek.metin)}
                                                className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                                              >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {yanitlar[soruKey]?.yanit === 'evet' && (
                    <div>
                      <label className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">Açıklama</span>
                        <span className="text-xs text-gray-500 font-medium">
                          (İsteğe bağlı)
                        </span>
                      </label>
                      <textarea
                        value={yanitlar[soruKey]?.aciklama || ''}
                        onChange={(e) => handleYanitChange(soruKey, 'aciklama', e.target.value)}
                        rows="3"
                        className="mt-1.5 block w-full px-4 py-3 bg-gray-50/50 border-0 rounded-xl text-base focus:ring-2 focus:ring-green-500/20 focus:bg-white transition-all duration-200"
                        placeholder="Evet cevabınız için açıklama yazabilirsiniz..."
                      />
                    </div>
                  )}

                  {yanitlar[soruKey]?.yanit === 'hayir' && (
                    <div className="space-y-4">
                      <div>
                        <label className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">Açıklama</span>
                          <span className="text-xs text-red-500 font-medium">
                            (Zorunlu)
                          </span>
                        </label>
                        <textarea
                          value={yanitlar[soruKey]?.aciklama || ''}
                          onChange={(e) => handleYanitChange(soruKey, 'aciklama', e.target.value)}
                          rows="3"
                          className="mt-1.5 block w-full px-4 py-3 bg-gray-50/50 border-0 rounded-xl text-base focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all duration-200"
                          placeholder="Neden hayır olduğunu açıklayın..."
                        />
                      </div>

                      {/* Fotoğraf yükleme alanı */}
                      <div>
                        <label className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">Fotoğraf</span>
                          <span className="text-xs text-red-500 font-medium">
                            (Zorunlu)
                          </span>
                        </label>
                        <div className="mt-1.5">
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => handleFotografEkle(soruKey, e.target.files)}
                            className="block w-full text-sm text-gray-500
                              file:mr-4 file:py-2 file:px-4
                              file:rounded-full file:border-0
                              file:text-sm file:font-semibold
                              file:bg-red-50 file:text-red-600
                              hover:file:bg-red-100
                              file:cursor-pointer file:transition-colors"
                          />
                        </div>

                        {/* Fotoğraf önizleme */}
                        {yanitlar[soruKey]?.fotograflar && Object.entries(yanitlar[soruKey].fotograflar).length > 0 && (
                          <div className="mt-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">Yüklenen Fotoğraflar:</p>
                            <div className="grid grid-cols-2 gap-4">
                              {Object.entries(yanitlar[soruKey].fotograflar).map(([key, foto]) => (
                                <div key={key} className="relative">
                                  <img src={foto.url} alt={foto.name} className="w-full h-32 object-cover rounded-lg" />
                                  <button
                                    onClick={() => handleFotografSil(soruKey, key)}
                                    className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Konum Doğrulama Bilgisi + Kaydet */}
        <div className="sticky bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-gray-100 py-4 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            {/* Konum uyarıları */}
            {!konumDogrulandi && (
              <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{konumHatasi || 'Denetime başlamadan önce konum doğrulaması yapılmalıdır (100 m içinde).'}</span>
                <button
                  type="button"
                  onClick={() => {
                    // Manuel tekrar dene
                    if (secilenSube && Object.keys(subeler).length > 0) {
                      // tetiklemek için secilenSube state'ini aynı değere set ederek effect çalışmayabilir, noop
                      // burada direkt geolocation çağırıyoruz
                      const hedefSube = subeler[secilenSube];
                      if (!hedefSube) return;
                      if (!('geolocation' in navigator)) return;
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          const { latitude, longitude } = pos.coords;
                          setKullaniciKonumu({ lat: latitude, lng: longitude });
                          const mesafe = haversineDistanceMeters(latitude, longitude, hedefSube.lat, hedefSube.lng);
                          if (mesafe <= 100) {
                            setKonumDogrulandi(true);
                            setKonumHatasi('');
                          } else {
                            setKonumDogrulandi(false);
                            setKonumHatasi(`Konum doğrulanamadı. Şube merkezine uzaklık: ${Math.round(mesafe)} m (<= 100 m olmalı).`);
                          }
                        },
                        () => setKonumHatasi('Konum alınamadı. Lütfen izin verin ve tekrar deneyin.'),
                        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                      );
                    }
                  }}
                  className="ml-auto text-xs text-red-700 hover:text-red-800 underline"
                >
                  Tekrar Dene
                </button>
              </div>
            )}

            <button
              onClick={handleDenetimKaydet}
              disabled={gonderiliyor || !konumDogrulandi}
              className="w-full flex justify-center items-center px-8 py-4 border border-transparent text-lg font-medium rounded-2xl shadow-lg text-white bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-all duration-200"
            >
              {gonderiliyor ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Kaydediliyor...
                </>
              ) : (
                konumDogrulandi ? 'Denetimi Kaydet' : 'Konum Doğrulaması Bekleniyor'
              )}
            </button>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Fotoğraf Görüntüleme Modal */}
      {secilenFotograf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSecilenFotograf(null)}>
          <div className="relative max-w-4xl w-full bg-white rounded-[2.5rem] p-4" onClick={e => e.stopPropagation()}>
            <img
              src={secilenFotograf.url}
              alt="Büyük Fotoğraf"
              className="w-full h-auto rounded-2xl"
            />
            <button
              onClick={() => setSecilenFotograf(null)}
              className="absolute top-6 right-6 bg-red-600/90 text-white rounded-xl p-2 hover:bg-red-700 transition-colors duration-200"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Teşekkür Modalı */}
      {tesekkurModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full text-center shadow-xl">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Teşekkür Ederiz!
            </h3>
            <p className="text-gray-600 mb-8">
              Denetim başarıyla kaydedildi. Katkınız için teşekkür ederiz.
            </p>
            <button
              onClick={handleModalKapat}
              className="w-full px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors duration-200 font-medium"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* Yükleme Durumu Göstergesi */}
      {yuklenenFoto && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm p-4 border-b border-gray-200">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            {yuklenenFoto.durum === 'hata' ? (
              <div className="w-5 h-5 text-red-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            ) : (
              <div className="w-5 h-5 text-red-600 animate-spin">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}
            <span className="text-sm font-medium text-gray-900">{yuklenenFoto.mesaj}</span>
          </div>
        </div>
      )}

      {/* Cevaplanmamış Sorular Modalı */}
      {cevaplanmamisSorularModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-xl">
            <div className="flex flex-col items-center text-center gap-6">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Cevaplanmamış Sorular
                </h3>
                <p className="text-gray-600 mb-6">
                  Lütfen aşağıdaki soruları cevaplayın:
                </p>
                <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                  {cevaplanmamisSorular.map((item, index) => (
                    <div
                      key={index}
                      className="w-full text-left p-4 bg-red-50 rounded-xl"
                    >
                      <span className="font-medium text-red-600">{item.index}.</span>
                      <span className="ml-2 text-gray-900">
                        {item.soru}
                        {item.secenekMetin && (
                          <span className="block mt-1 ml-4 text-sm text-gray-600">
                            • {item.secenekMetin}
                          </span>
                        )}
                        {item.mesaj && (
                          <span className="block mt-1 ml-4 text-sm text-red-500">
                            {item.mesaj}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={handleModalKapatVeKaydir}
                className="w-full px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors duration-200 font-medium"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 