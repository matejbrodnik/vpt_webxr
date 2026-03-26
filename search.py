import nibabel as nib
import numpy as np

outFile = "../../../Downloads/mitos/search330430_256x256x256_.raw"
# nii = nib.load("../../../Downloads/fib1-0-0-0.nii/contact-3-2-1.nii.gz")
# nii = nib.load("../../../Downloads/mitos/fusion330430_256x256x256_.raw")

data = np.fromfile("../../../Downloads/mitos/fusion330430_256x256x256_.raw", dtype=np.uint8)
# data = nii.get_fdata(dtype=np.float32)
data = data.reshape((256, 256, 256))
print(data.min(), data.max())
print(np.unique(data))

copy = data.copy()

# 321
# w = 4
# val = 250
# x = 216
# y = 131
# z = 164

# 000
w = 4
val = 250
x = 50
y = 160
z = 230

for i in range(x-w, x+w):
    for j in range(y-w, y+w):
        for k in range(z-w, z+w):
            data[i][j][k] = val

data = (data).astype(np.uint8)
#data = (data * 255).astype(np.uint8)



print(data.min(), data.max())
print(np.unique(data)[:40])

data.tofile(outFile)



