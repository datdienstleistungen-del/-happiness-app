const STOCK_IMAGES = {
  motivation: [
    'https://picsum.photos/seed/mot1/1920/1080',
    'https://picsum.photos/seed/mot2/1920/1080',
    'https://picsum.photos/seed/mot3/1920/1080',
    'https://picsum.photos/seed/mot4/1920/1080',
    'https://picsum.photos/seed/mot5/1920/1080',
  ],
  nature: [
    'https://picsum.photos/seed/nat1/1920/1080',
    'https://picsum.photos/seed/nat2/1920/1080',
    'https://picsum.photos/seed/nat3/1920/1080',
    'https://picsum.photos/seed/nat4/1920/1080',
    'https://picsum.photos/seed/nat5/1920/1080',
  ],
  wellness: [
    'https://picsum.photos/seed/well1/1920/1080',
    'https://picsum.photos/seed/well2/1920/1080',
    'https://picsum.photos/seed/well3/1920/1080',
    'https://picsum.photos/seed/well4/1920/1080',
    'https://picsum.photos/seed/well5/1920/1080',
  ],
  fitness: [
    'https://picsum.photos/seed/fit1/1920/1080',
    'https://picsum.photos/seed/fit2/1920/1080',
    'https://picsum.photos/seed/fit3/1920/1080',
    'https://picsum.photos/seed/fit4/1920/1080',
    'https://picsum.photos/seed/fit5/1920/1080',
  ],
  liebe: [
    'https://picsum.photos/seed/love1/1920/1080',
    'https://picsum.photos/seed/love2/1920/1080',
    'https://picsum.photos/seed/love3/1920/1080',
    'https://picsum.photos/seed/love4/1920/1080',
    'https://picsum.photos/seed/love5/1920/1080',
  ],
  dankbarkeit: [
    'https://picsum.photos/seed/thank1/1920/1080',
    'https://picsum.photos/seed/thank2/1920/1080',
    'https://picsum.photos/seed/thank3/1920/1080',
    'https://picsum.photos/seed/thank4/1920/1080',
    'https://picsum.photos/seed/thank5/1920/1080',
  ],
}

export default function getStockImages(category) {
  const key = category?.toLowerCase() || 'motivation'
  return STOCK_IMAGES[key] || STOCK_IMAGES.motivation
}
