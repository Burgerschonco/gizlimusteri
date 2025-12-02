import { useState, useEffect } from 'react';
import { ref, get, set, remove } from 'firebase/database';
import { realdb } from '../../firebase/config';
import { toast } from 'react-hot-toast';

function SubeYonetimi() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [savingBranchId, setSavingBranchId] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [newUser, setNewUser] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);

  useEffect(() => {
    loadUsers();
    loadBranches();
  }, []);

  const loadUsers = async () => {
    try {
      const usersRef = ref(realdb, 'branchUsers');
      const snapshot = await get(usersRef);
      
      if (snapshot.exists()) {
        const usersData = Object.entries(snapshot.val())
          .map(([id, data]) => ({
            id,
            ...data
          }));
        setUsers(usersData);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Kullanıcılar yüklenirken hata:', error);
      toast.error('Kullanıcılar yüklenirken bir hata oluştu');
    }
  };

  const loadBranches = async () => {
    try {
      const branchesRef = ref(realdb, 'branches');
      const snapshot = await get(branchesRef);
      
      if (snapshot.exists()) {
        const branchesData = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          name: data.name || '',
          lat: typeof data.lat === 'number' ? data.lat : (data.lat ? parseFloat(data.lat) : ''),
          lng: typeof data.lng === 'number' ? data.lng : (data.lng ? parseFloat(data.lng) : ''),
          distance: typeof data.distance === 'number' ? data.distance : (data.distance ? parseFloat(data.distance) : 100),
          isActive: data.isActive !== false
        }));
        console.log('Yüklenen şubeler:', branchesData);
        setBranches(branchesData);
      } else {
        console.log('Hiç şube bulunamadı!');
        setBranches([]);
      }
    } catch (error) {
      console.error('Şubeler yüklenirken hata:', error);
      toast.error('Şubeler yüklenirken bir hata oluştu');
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const handleBranchCoordChange = (branchId, field, value) => {
    setBranches(prev => prev.map(b => b.id === branchId ? { ...b, [field]: value } : b));
  };

  const handleSaveBranchCoords = async (branchId) => {
    try {
      const branch = branches.find(b => b.id === branchId);
      if (!branch) return;

      const latNum = parseFloat(branch.lat);
      const lngNum = parseFloat(branch.lng);
      const distanceNum = parseFloat(branch.distance);
      
      if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
        toast.error('Lütfen geçerli enlem ve boylam girin');
        return;
      }
      if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
        toast.error('Enlem/Boylam aralığı geçersiz');
        return;
      }
      if (Number.isNaN(distanceNum) || distanceNum <= 0) {
        toast.error('Lütfen geçerli bir mesafe girin (0\'dan büyük olmalı)');
        return;
      }

      setSavingBranchId(branchId);
      const branchRef = ref(realdb, `branches/${branchId}`);
      // Mevcut veriyi getirip merge ederek yazalım
      const snap = await get(branchRef);
      const existing = snap.exists() ? snap.val() : {};
      await set(branchRef, {
        ...existing,
        name: branch.name || existing.name || '',
        isActive: existing.isActive !== false,
        lat: latNum,
        lng: lngNum,
        distance: distanceNum
      });
      toast.success('Konum ve mesafe bilgileri kaydedildi');
    } catch (e) {
      console.error('Konum kaydı hatası:', e);
      toast.error('Konum bilgileri kaydedilemedi');
    } finally {
      setSavingBranchId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBranch) {
      toast.error('Lütfen bir şube seçin');
      return;
    }

    if (newUser.password.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır');
      return;
    }

    setIsLoading(true);

    try {
      // Kullanıcı adının benzersiz olduğunu kontrol et
      const usersRef = ref(realdb, 'branchUsers');
      const snapshot = await get(usersRef);
      
      if (snapshot.exists()) {
        const existingUser = Object.values(snapshot.val()).find(
          user => user.username === newUser.username
        );
        
        if (existingUser) {
          toast.error('Bu kullanıcı adı zaten kullanılıyor');
          setIsLoading(false);
          return;
        }
      }

      // Yeni kullanıcıyı database'e ekle
      const newUserRef = ref(realdb, `branchUsers/${new Date().getTime()}`);
      await set(newUserRef, {
        username: newUser.username,
        password: newUser.password,
        branchName: selectedBranch.name,
        branchId: selectedBranch.id,
        createdAt: new Date().toISOString()
      });

      toast.success('Şube kullanıcısı başarıyla eklendi');
      setNewUser({ username: '', password: '' });
      setSelectedBranch(null);
      await loadUsers();
    } catch (error) {
      console.error('Kullanıcı eklenirken hata:', error);
      toast.error('Kullanıcı oluşturulurken bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (userId) => {
    if (window.confirm('Bu şube kullanıcısını silmek istediğinizden emin misiniz?')) {
      try {
        const userRef = ref(realdb, `branchUsers/${userId}`);
        await remove(userRef);
        toast.success('Kullanıcı başarıyla silindi');
        await loadUsers();
      } catch (error) {
        console.error('Kullanıcı silinirken hata:', error);
        toast.error('Kullanıcı silinirken bir hata oluştu');
      }
    }
  };

  const handleBranchSelect = (e) => {
    const branch = branches.find(b => b.id === e.target.value);
    console.log('Seçilen şube:', branch);
    
    if (branch) {
      setSelectedBranch(branch);
      // Şube adından ilk kelimeyi al ve Türkçe karakterleri değiştir
      const username = branch.name
        .split(' ')[0] // İlk kelimeyi al
        .toLowerCase()
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9]/g, ''); // Sadece harf ve rakamları tut
      
      setNewUser(prev => ({
        ...prev,
        username: username
      }));
      toast.success(`${branch.name} şubesi seçildi`);
    }
  };

  if (isLoadingBranches) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Üst Kısım */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg mb-6">
          <div className="relative p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-blue-600">
                  Şube Kullanıcı Yönetimi
                </h1>
                <p className="mt-2 text-gray-600">Şubelere özel kullanıcı hesaplarını buradan yönetebilirsiniz</p>
              </div>
              <div className="hidden sm:flex items-center gap-4">
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">{users.length}</div>
                  <div className="text-sm text-gray-500">Toplam Kullanıcı</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Sol Panel - Yeni Kullanıcı Ekleme */}
          <div className="xl:col-span-4">
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Yeni Kullanıcı Ekle</h2>
                    <p className="text-sm text-gray-500">Şube kullanıcısı oluşturun</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Şube Seçin
                  </label>
                  <div className="relative">
                    <select
                      value={selectedBranch ? selectedBranch.id : ''}
                      onChange={handleBranchSelect}
                      className="appearance-none w-full px-4 py-3 bg-gray-50/50 border-0 rounded-xl text-base focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all duration-200"
                      required
                    >
                      <option value="">Şube seçin</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                      <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {selectedBranch && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Kullanıcı Adı
                      </label>
                      <input
                        type="text"
                        value={newUser.username}
                        onChange={(e) => setNewUser({ ...newUser, username: e.target.value.toLowerCase() })}
                        className="block w-full px-4 py-3 bg-gray-50/50 border-0 rounded-xl text-base focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all duration-200"
                        placeholder="ornek.sube"
                        required
                      />
                      <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Türkçe karakter, boşluk ve özel karakterler kullanmayın
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Şifre
                      </label>
                      <input
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        className="block w-full px-4 py-3 bg-gray-50/50 border-0 rounded-xl text-base focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all duration-200"
                        placeholder="En az 6 karakter"
                        required
                        minLength={6}
                      />
                      <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Şifre en az 6 karakter olmalıdır
                      </p>
                    </div>

                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-blue-800">Seçilen Şube</h3>
                          <p className="text-sm text-blue-600">{selectedBranch.name}</p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-4 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-xl"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Ekleniyor...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          <span>Kullanıcı Oluştur</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </form>
            </div>
          </div>

          {/* Sağ Panel - Kullanıcı Listesi */}
          <div className="xl:col-span-8">
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Mevcut Kullanıcılar</h2>
                      <p className="text-sm text-gray-500">{users.length} kullanıcı bulundu</p>
                    </div>
                  </div>
                  <div className="sm:hidden">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {users.length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {users.length > 0 ? (
                  <div className="space-y-4">
                    {users.map((user) => (
                      <div key={user.id} className="group bg-gray-50/50 rounded-xl p-4 hover:bg-gray-100/50 transition-all duration-200 border border-gray-100 hover:border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                              {user.branchName ? user.branchName.charAt(0).toUpperCase() : 'S'}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{user.branchName || 'Silinmiş Şube'}</h3>
                              <p className="text-sm text-gray-500">@{user.username}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                Oluşturulma: {new Date(user.createdAt).toLocaleDateString('tr-TR')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDelete(user.id)}
                              className="group/btn p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200"
                            >
                              <svg className="w-5 h-5 group-hover/btn:scale-110 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Henüz Kullanıcı Yok</h3>
                    <p className="text-gray-500 mb-6">İlk şube kullanıcısını oluşturmak için sol paneli kullanın</p>
                    <div className="w-16 h-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full mx-auto"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Şube Konumları Yönetimi */}
          <div className="xl:col-span-12">
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1 1 0 01-1.414 0l-4.243-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Şube Konumları ve Mesafe Ayarları</h2>
                    <p className="text-sm text-gray-500">Her şube için enlem/boylam ve denetim mesafesi girin</p>
                    <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 text-sm text-blue-700">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span><strong>Mesafe Ayarı:</strong> Denetimciler bu mesafe içinde olmalıdır. Varsayılan: 100 metre</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left py-3 px-4 text-gray-600 text-sm font-medium">Şube</th>
                        <th className="text-left py-3 px-4 text-gray-600 text-sm font-medium">Enlem (lat)</th>
                        <th className="text-left py-3 px-4 text-gray-600 text-sm font-medium">Boylam (lng)</th>
                        <th className="text-left py-3 px-4 text-gray-600 text-sm font-medium">Mesafe (mt)</th>
                        <th className="text-right py-3 px-4 text-gray-600 text-sm font-medium">İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {branches.map((b) => (
                        <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 text-gray-800 font-medium">{b.name}</td>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              step="0.000001"
                              value={b.lat === '' ? '' : b.lat}
                              onChange={(e) => handleBranchCoordChange(b.id, 'lat', e.target.value)}
                              placeholder="41.0"
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              step="0.000001"
                              value={b.lng === '' ? '' : b.lng}
                              onChange={(e) => handleBranchCoordChange(b.id, 'lng', e.target.value)}
                              placeholder="29.0"
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={b.distance || 100}
                              onChange={(e) => handleBranchCoordChange(b.id, 'distance', e.target.value)}
                              placeholder="100"
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleSaveBranchCoords(b.id)}
                              disabled={savingBranchId === b.id}
                              className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                              {savingBranchId === b.id ? (
                                <>
                                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                  Kaydediliyor
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                  </svg>
                                  Kaydet
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {branches.length === 0 && (
                        <tr>
                          <td colSpan="5" className="py-8 text-center text-gray-500">Kayıtlı şube bulunamadı</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SubeYonetimi; 