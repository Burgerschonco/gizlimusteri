import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PanelLayout() {
  const { logout, user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Çıkış yapılırken hata:', error);
    }
  };

  const LogoutModal = () => (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />
      
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all w-full max-w-lg mx-auto">
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                <h3 className="text-lg font-semibold leading-6 text-gray-900">
                  Çıkış Yap
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Oturumu kapatmak istediğinizden emin misiniz?
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse gap-2 sm:px-6">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex w-full justify-center rounded-xl bg-red-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto"
            >
              Çıkış Yap
            </button>
            <button
              type="button"
              onClick={() => setShowLogoutModal(false)}
              className="mt-3 inline-flex w-full justify-center rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
            >
              İptal
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const adminMenuItems = [
    {
      title: 'Denetimler',
      path: '/panel',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    },
    {
      title: 'Denetim Formları',
      path: '/panel/denetim-formlari',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      title: 'Link Yönetimi',
      path: '/panel/link-yonetimi',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      )
    },
    {
      title: 'Kategoriler',
      path: '/panel/kategoriler',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      )
    },
    {
      title: 'Analiz',
      path: '/panel/analiz',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      title: 'Şube Yönetimi',
      path: '/panel/sube-yonetimi',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    }
  ];

  const branchMenuItems = [
    {
      title: 'Dashboard',
      path: '/sube-panel',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      title: 'Analiz',
      path: '/sube-panel/analiz',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    }
  ];

  const menuItems = isAdmin ? adminMenuItems : branchMenuItems;

  const MobileHeader = () => (
    <div className="bg-gradient-to-br from-red-500 via-red-600 to-red-700 px-3 sm:px-4 py-2 sm:py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
          <img 
            src="/burgerschonlogokırmızı.png" 
            alt="Logo" 
            className="h-6 w-auto sm:h-8 brightness-0 invert flex-shrink-0" 
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-archivo text-white tracking-tight truncate">BURGERSCHÖN</h1>
            <p className="text-xs sm:text-sm text-red-100/90 truncate">Gizli Müşteri Formu</p>
          </div>
        </div>
        <button
          onClick={() => setShowLogoutModal(true)}
          className="p-1.5 sm:p-2 rounded-xl bg-red-500/20 text-white hover:bg-red-500/30 flex-shrink-0 ml-2"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </div>
  );

  const MobileBottomNav = () => {
    // Menü öğelerini kısaltılmış başlıklarla eşleştir
    const getShortTitle = (title) => {
      const shortTitles = {
        'Denetimler': 'Denetim',
        'Denetim Formları': 'Formlar',
        'Link Yönetimi': 'Linkler',
        'Kategoriler': 'Kategori',
        'Analiz': 'Analiz',
        'Şube Yönetimi': 'Şubeler',
        'Dashboard': 'Ana Sayfa'
      };
      return shortTitles[title] || title;
    };

    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 pb-safe z-40">
        <nav className="flex justify-around items-center px-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/panel' || item.path === '/sube-panel'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-2 px-1 min-w-0 flex-1 relative ${
                  isActive ? 'text-red-600' : 'text-gray-500'
                }`
              }
            >
              <div className={`p-2 rounded-lg transition-all duration-200 mb-1 ${
                location.pathname === item.path 
                  ? 'bg-red-50 text-red-600' 
                  : 'text-gray-500'
              }`}>
                <div className="w-5 h-5">
                  {item.icon}
                </div>
              </div>
              <span className="text-[10px] font-medium text-center leading-tight max-w-full truncate px-1">
                {getShortTitle(item.title)}
              </span>
              {location.pathname === item.path && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-red-600 rounded-full" />
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#f8f9fd]">
      {/* Desktop Sidebar */}
      <div className={`hidden lg:block lg:w-[300px] fixed lg:relative inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full bg-gradient-to-b from-slate-800 to-slate-900 text-gray-100">
          {/* Logo Section */}
          <div className="relative h-24 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-transparent"></div>
            <div className="absolute inset-0">
              <svg className="w-full h-full text-red-500/5" fill="currentColor" viewBox="0 0 600 600">
                <path d="M0,0 L600,0 L600,600 L0,600 L0,0 Z M300,150 A150,150 0 1,0 300,450 A150,150 0 1,0 300,150 Z" />
              </svg>
            </div>
            <div className="relative flex items-center h-full px-8">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-white/10 backdrop-blur-xl rounded-2xl">
                  <img 
                    src="/burgerschonlogokırmızı.png" 
                    alt="Logo" 
                    className="h-8 w-auto brightness-0 invert" 
                  />
                </div>
                <div>
                  <h1 className="text-xl font-archivo tracking-wide bg-gradient-to-r from-white via-white to-red-100 bg-clip-text text-transparent">
                    BURGERSCHÖN
                  </h1>
                  <p className="text-sm text-slate-400">Gizli Müşteri Formu</p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 flex flex-col justify-between">
            <div className="px-3 py-6">
              <div className="space-y-1">
                {menuItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/panel' || item.path === '/sube-panel'}
                    className={({ isActive }) =>
                      `group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/20'
                          : 'text-slate-300 hover:bg-white/5'
                      }`
                    }
                  >
                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl mr-3 transition-all duration-200 ${
                      location.pathname === item.path 
                        ? 'bg-white/20 backdrop-blur-sm' 
                        : 'bg-slate-800/50 group-hover:bg-slate-700/50'
                    }`}>
                      {item.icon}
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                      <span>{item.title}</span>
                      {location.pathname === item.path && (
                        <div className="flex items-center space-x-2">
                          <span className="w-1 h-1 rounded-full bg-white/60"></span>
                          <span className="w-1 h-1 rounded-full bg-white/60"></span>
                          <span className="w-1 h-1 rounded-full bg-white"></span>
                        </div>
                      )}
                    </div>
                  </NavLink>
                ))}
              </div>
            </div>

            {/* User Profile */}
            <div className="sticky bottom-0 p-4 bg-slate-900/50 backdrop-blur-sm">
              <div className="p-3 rounded-xl bg-gradient-to-br from-slate-800 via-slate-800/95 to-slate-800/50 backdrop-blur-xl border border-white/5">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 p-0.5">
                      <div className="w-full h-full rounded-lg bg-slate-900/30 backdrop-blur-xl flex items-center justify-center">
                        <span className="text-base font-semibold">
                          {isAdmin 
                            ? user?.email?.[0].toUpperCase() 
                            : user?.branchName?.[0].toUpperCase() || 'Ş'}
                        </span>
                      </div>
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-md ring-2 ring-slate-900"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-slate-200 truncate">
                      {isAdmin ? user?.email : user?.branchName}
                    </h3>
                    <div className="flex items-center mt-0.5 text-xs text-slate-400 space-x-2">
                      <span className="flex items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>
                        Çevrimiçi
                      </span>
                      <span>•</span>
                      <span>{isAdmin ? 'Admin' : 'Şube Kullanıcısı'}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowLogoutModal(true)}
                    className="p-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <MobileHeader />
        </div>

        {/* Content */}
        <div className="flex-1 pb-20 sm:pb-16 lg:pb-0">
          <Outlet />
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="lg:hidden">
          <MobileBottomNav />
        </div>
      </div>

      {/* Logout Modal */}
      {showLogoutModal && <LogoutModal />}
    </div>
  );
} 