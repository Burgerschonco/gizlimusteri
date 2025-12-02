import { useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

function Camera({ onCapture, onClose, currentPhotos = [], maxPhotos = 3 }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [isStreamReady, setIsStreamReady] = useState(false);

  useEffect(() => {
    let stream = null;

    async function setupCamera() {
      try {
        // Mevcut stream'i temizle
        if (videoRef.current && videoRef.current.srcObject) {
          const tracks = videoRef.current.srcObject.getTracks();
          tracks.forEach(track => track.stop());
        }

        // Yeni stream al
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Video yüklendiğinde hazır olduğunu işaretle
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            setIsStreamReady(true);
          };
        }
      } catch (err) {
        console.error('Kamera erişim hatası:', err);
        setError('Kamera erişimi sağlanamadı! Lütfen kamera izinlerini kontrol edin.');
      }
    }

    setupCamera();

    // Cleanup function
    return () => {
      setIsStreamReady(false);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const takePhoto = () => {
    if (!videoRef.current || !isStreamReady) return;

    try {
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      
      // Video boyutlarını al
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      
      // Canvas boyutlarını ayarla
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      
      const ctx = canvas.getContext('2d');
      // Görüntüyü çevir ve çiz
      ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
      
      const photoData = canvas.toDataURL('image/jpeg', 0.8);
      onCapture(photoData);
    } catch (err) {
      console.error('Fotoğraf çekme hatası:', err);
      setError('Fotoğraf çekilemedi! Lütfen tekrar deneyin.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white space-y-4">
          <p className="text-center px-4">{error}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
          >
            Kapat
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 relative bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
          
          <div className="p-4 bg-black/50 flex items-center justify-between">
            <button
              onClick={onClose}
              className="p-2 text-white hover:text-red-500 transition-colors"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <button
              onClick={takePhoto}
              disabled={!isStreamReady || currentPhotos.length >= maxPhotos}
              className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-full bg-white" />
            </button>

            <div className="w-12 h-12 flex items-center justify-center text-white">
              {currentPhotos.length}/{maxPhotos}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Prop Types tanımlamaları
Camera.propTypes = {
  onCapture: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  currentPhotos: PropTypes.array,
  maxPhotos: PropTypes.number
};

// Default Props
Camera.defaultProps = {
  currentPhotos: [],
  maxPhotos: 3
};

export default Camera;