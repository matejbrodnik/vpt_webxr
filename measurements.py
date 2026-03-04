import lpips
import torch
from PIL import Image
import torchvision.transforms as transforms

# Load images
transform = transforms.Compose([
    transforms.Resize((512, 512)),
    transforms.ToTensor()
])

ref = Image.open("Converged.png")
print(ref)


ref = transform(Image.open("Converged.png").convert("RGB")).unsqueeze(0)
fov2 = transform(Image.open("FOV2__100.png").convert("RGB")).unsqueeze(0)
fov3 = transform(Image.open("FOV3__100.png").convert("RGB")).unsqueeze(0)

# Normalize to [-1, 1]
ref = ref * 2 - 1
fov2 = fov2 * 2 - 1
fov3 = fov3 * 2 - 1

# Load LPIPS model
loss_fn = lpips.LPIPS(net='alex')  # 'alex', 'vgg', or 'squeeze'

# Compute distance
distance = loss_fn(ref, fov2)
distance3 = loss_fn(ref, fov3)
print(distance.item())
print(distance3.item())
