import { ref, get, set, remove } from 'firebase/database';
import { realdb } from '../firebase/config';

const defaultAdmin = {
  username: 'admin',
  password: 'admin123',
  type: 'admin'
};

const defaultDenetimci = {
  username: 'denetimci',
  password: 'denetimci123',
  type: 'denetimci'
};

// Varsayılan kullanıcıları oluştur
export const initializeUsers = async () => {
  try {
    const adminRef = ref(realdb, 'users/admin');
    const adminSnapshot = await get(adminRef);
    if (!adminSnapshot.exists()) {
      await set(adminRef, defaultAdmin);
    }

    const denetimciRef = ref(realdb, 'users/denetimci');
    const denetimciSnapshot = await get(denetimciRef);
    if (!denetimciSnapshot.exists()) {
      await set(denetimciRef, defaultDenetimci);
    }
  } catch (error) {
    console.error('Kullanıcılar oluşturulurken hata:', error);
  }
};

// Kullanıcı girişi doğrula
export const validateUser = async (username, password) => {
  try {
    // Admin kontrolü
    if (username === defaultAdmin.username && password === defaultAdmin.password) {
      return defaultAdmin;
    }

    // Denetimci kontrolü
    if (username === defaultDenetimci.username && password === defaultDenetimci.password) {
      return defaultDenetimci;
    }

    return null;
  } catch (error) {
    console.error('Kullanıcı doğrulanırken hata:', error);
    return null;
  }
}; 