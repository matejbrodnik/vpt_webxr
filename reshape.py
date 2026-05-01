import nibabel as nib
import numpy as np
import math
from scipy.ndimage import zoom

data = np.fromfile("../../../Downloads/manix_512x512x460_488281x488281x700012_uint8.raw", dtype=np.uint8)
data = np.fromfile("../../../Downloads/fibersid_400x401x800_uint32.raw", dtype=np.uint32)

# a = 512
# b = 512
# c = 460
a = 400
b = 401
c = 800
data = data.reshape((c,b,a));

k = 2.666667
a = round(a/k)
b = round(b/k)
c = round(c/k)
copy = data[:int(c), :int(b), :int(a)].copy()

data = data[:int(c), :int(b), :int(a)].copy()

copy[(data % 9 == 0) & (data != 0)] = 0
copy[data % 18 == 1] = 70
copy[data % 18 == 2] = 0
copy[data % 18 == 3] = 90
copy[data % 18 == 4] = 0
copy[data % 18 == 5] = 110
copy[data % 18 == 6] = 0
copy[data % 18 == 7] = 130
copy[data % 18 == 8] = 0
copy[data % 18 == 9] = 150
copy[data % 18 == 10] = 0
copy[data % 18 == 11] = 170
copy[data % 18 == 12] = 0
copy[data % 18 == 13] = 190
copy[data % 18 == 14] = 0
copy[data % 18 == 15] = 210
copy[data % 18 == 16] = 0
copy[data % 18 == 17] = 230

# copy = data.copy()
# for i in range(int(c)):
#     for j in range(int(b)):
#         for k in range(int(a)):
#             copy[i, j, k] = data[i, j, k]
            # copy[i, j, k] = data[i*2, j*2, k*2]

print(copy.strides)


# data = data[0:a, 0:b, 0:c]

# data = zoom(data, zoom=0.5, order=0)
# data = data[:, :, ::2]
# data = np.ascontiguousarray(data[:, :, ::2])
# data = data[:, :, ::2].copy()

print("--------")

print(copy.shape)
data = (copy).astype(np.uint8)


outFile = f"../../../Downloads/fibers_{a}x{b}x{c}_.raw"
data = data.transpose(0, 1, 2)
print(data.shape)

data.tofile(outFile)



