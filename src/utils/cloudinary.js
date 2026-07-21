const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

export const uploadToCloudinary = async (file, onProgress) => {
  const isVideo = file.type.startsWith('video/')
  const endpoint = isVideo
    ? `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/video/upload`
    : `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', CLOUDINARY_PRESET)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText)
        resolve({
          url: data.secure_url,
          publicId: data.public_id,
          width: data.width,
          height: data.height,
          format: data.format
        })
      } else {
        reject(new Error('Cloudinary Upload fehlgeschlagen'))
      }
    })
    xhr.addEventListener('error', () => {
      reject(new Error('Netzwerkfehler beim Upload'))
    })
    xhr.open('POST', endpoint)
    xhr.send(formData)
  })
}
