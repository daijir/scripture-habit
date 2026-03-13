import React from 'react';
import { ScripturesGallery } from '../../Data/Data';
import './GalleryImages.css';


const GalleryImages = () => {
  if (!ScripturesGallery || ScripturesGallery.length === 0) {
    return <div className="gallery-empty">No images found</div>;
  }

  return (
    <div className="gallery-grid">
      {ScripturesGallery.map((item, idx) => (
        <img
          key={idx}
          src={item.src}
          alt={item.title || `Gallery ${idx}`}
          className="gallery-img"
        />
      ))}
    </div>
  );
};


export default GalleryImages;