import PropTypes from 'prop-types';

function ImageViewer({ image, onClose }) {
  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" 
      onClick={onClose}
    >
      <div className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-white p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              d="M6 18L18 6M6 6l12 12" 
            />
          </svg>
        </button>
        <img 
          src={image} 
          alt="Büyük görüntü" 
          className="max-w-full max-h-[90vh] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

// Prop Types tanımlamaları
ImageViewer.propTypes = {
  image: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired
};

export default ImageViewer;