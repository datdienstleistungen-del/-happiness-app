const STOCK_IMAGES = {
  motivation: [
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop',
  ],
  nature: [
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&h=1080&fit=crop',
  ],
  wellness: [
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1545389336-cf090694435e?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1512438248247-f0f2a5a8b7f0?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop',
  ],
  fitness: [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=1920&h=1080&fit=crop',
  ],
  liebe: [
    'https://images.unsplash.com/photo-1518568814500-bf0f8d125f46?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1494774157365-9e04c6720e47?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=1920&h=1080&fit=crop',
  ],
  dankbarkeit: [
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920&h=1080&fit=crop',
  ],
}

export default function getStockImages(category) {
  const key = category?.toLowerCase() || 'motivation'
  return STOCK_IMAGES[key] || STOCK_IMAGES.motivation
}
