export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 900 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be read.'));
    };
    image.src = url;
  });
}

export function drawColorConcept(canvas, image, color) {
  const context = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  if (image) context.drawImage(image, 0, 0, width, height);
  else {
    context.fillStyle = '#e2e8f0';
    context.fillRect(0, 0, width, height);
  }
  context.save();
  context.globalCompositeOperation = 'multiply';
  context.globalAlpha = 0.45;
  context.fillStyle = color || '#F4E4C8';
  context.fillRect(0, 0, width, height);
  context.restore();
}
