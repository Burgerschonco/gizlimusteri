/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { realdb } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

function SubeDashboard() {
  const { user } = useAuth();
  const [branchInfo, setBranchInfo] = useState(null);
  const [denetimler, setDenetimler] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBranchData = async () => {
      try {
        // Şubeye ait denetimleri al
        const denetimlerRef = ref(realdb, 'denetimler');
        const denetimlerSnapshot = await get(denetimlerRef);
        
        if (denetimlerSnapshot.exists()) {
          const denetimlerData = await Promise.all(
            Object.entries(denetimlerSnapshot.val())
              .map(async ([id, data]) => {
                // Form bilgilerini al
                if (!data.formId) {
                  console.log('Form ID bulunamadı:', id);
                  return { id, ...data, formAdi: 'Bilinmeyen Form' };
                }

                try {
                  const formRef = ref(realdb, `denetimFormlari/${data.formId}`);
                  const formSnapshot = await get(formRef);
                  const formData = formSnapshot.exists() ? formSnapshot.val() : null;

                  console.log('Form verisi:', formData);

                  return {
                    id,
                    ...data,
                    formAdi: data.formAdi || 'Form Bulunamadı'
                  };
                } catch (error) {
                  console.error('Form verisi alınırken hata:', error);
                  return { id, ...data, formAdi: 'Form Yüklenemedi' };
                }
              })
          );

          const filteredDenetimler = denetimlerData
            .filter(denetim => denetim.subeAdi === user.branchName)
            .sort((a, b) => new Date(b.denetimTarihi) - new Date(a.denetimTarihi));
          
          setDenetimler(filteredDenetimler);
          console.log('Denetimler yüklendi:', filteredDenetimler);
          console.log('Kullanıcı şube adı:', user.branchName);
        }
      } catch (error) {
        console.error('Veri yüklenirken hata:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadBranchData();
      setBranchInfo(user);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Şube Bilgileri */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Hoş Geldiniz, {user?.branchName}</h1>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Toplam Denetim</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{denetimler.length}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Son 30 Gün</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">
                {denetimler.filter(d => {
                  const date = new Date(d.denetimTarihi);
                  const now = new Date();
                  const diffTime = Math.abs(now - date);
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  return diffDays <= 30;
                }).length}
              </h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ortalama Puan</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">
                {denetimler.length > 0
                  ? Math.round(
                      denetimler.reduce((acc, curr) => acc + (curr.sonuc?.toplamPuan || 0), 0) /
                        denetimler.length
                    )
                  : 0}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Son Denetimler */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-800">Son Denetimler</h2>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-3 px-4 text-gray-600 text-sm font-medium">Tarih</th>
                <th className="text-left py-3 px-4 text-gray-600 text-sm font-medium">Form Adı</th>
                <th className="text-left py-3 px-4 text-gray-600 text-sm font-medium">Puan</th>
                <th className="text-left py-3 px-4 text-gray-600 text-sm font-medium">Durum</th>
                <th className="text-left py-3 px-4 text-gray-600 text-sm font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {denetimler.slice(0, 5).map((denetim) => (
                <tr key={denetim.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-4 text-gray-600">
                    {new Date(denetim.denetimTarihi).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {denetim.formAdi}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium">
                      {denetim.sonuc?.toplamPuan || 0}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-1 rounded-lg text-sm font-medium ${
                      (denetim.sonuc?.toplamPuan || 0) >= 80
                        ? 'bg-green-50 text-green-600'
                        : (denetim.sonuc?.toplamPuan || 0) >= 60
                        ? 'bg-yellow-50 text-yellow-600'
                        : 'bg-red-50 text-red-600'
                    }`}>
                      {(denetim.sonuc?.toplamPuan || 0) >= 80
                        ? 'Başarılı'
                        : (denetim.sonuc?.toplamPuan || 0) >= 60
                        ? 'İyileştirme Gerekli'
                        : 'Başarısız'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center space-x-2 justify-end">
                      <Link
                        to={`/sube-panel/denetim-detay/${denetim.id}`}
                        className="inline-flex items-center px-3 py-1.5 border border-red-500 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Detay
                      </Link>
                      <Link
                        to={`/sube-panel/denetim-analiz/${denetim.id}`}
                        className="inline-flex items-center px-3 py-1.5 border border-blue-500 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Analiz
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {denetimler.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <span>Henüz denetim bulunmuyor</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default SubeDashboard; 